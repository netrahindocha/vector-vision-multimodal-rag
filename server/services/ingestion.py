import threading
import traceback
import uuid

from sqlalchemy import text

from database import SessionLocal
from models import Document
from rag.pipeline import (
    create_chunks_by_title,
    create_vector_store,
    partition_document,
    summarize_chunks,
)

MAX_CONCURRENT_INGESTIONS = 1
ingestion_semaphore = threading.Semaphore(MAX_CONCURRENT_INGESTIONS)


def update_document_status(
    document_id: uuid.UUID | str,
    status: str,
    stage: str,
    error_message: str | None = None,
    completed: bool = False,
) -> None:
    with SessionLocal() as db:
        document = db.get(Document, uuid.UUID(str(document_id)))
        if document is None:
            return

        document.status = status
        document.stage = stage
        document.error_message = error_message
        if completed:
            db.execute(
                text(
                    "UPDATE documents "
                    "SET status = :status, stage = :stage, error_message = :error_message, "
                    "completed_at = now(), updated_at = now() "
                    "WHERE id = CAST(:document_id AS UUID)"
                ),
                {
                    "document_id": str(document_id),
                    "status": status,
                    "stage": stage,
                    "error_message": error_message,
                },
            )
        else:
            db.execute(
                text(
                    "UPDATE documents "
                    "SET status = :status, stage = :stage, error_message = :error_message, "
                    "updated_at = now() "
                    "WHERE id = CAST(:document_id AS UUID)"
                ),
                {
                    "document_id": str(document_id),
                    "status": status,
                    "stage": stage,
                    "error_message": error_message,
                },
            )
        db.commit()


def claim_queued_document(document_id: uuid.UUID | str) -> Document | None:
    with SessionLocal() as db:
        result = db.execute(
            text(
                "UPDATE documents "
                "SET status = 'processing', stage = 'starting', started_at = now(), "
                "updated_at = now(), error_message = NULL "
                "WHERE id = CAST(:document_id AS UUID) AND status = 'queued' "
                "RETURNING id"
            ),
            {"document_id": str(document_id)},
        ).first()
        db.commit()

        if result is None:
            return None

        return db.get(Document, uuid.UUID(str(document_id)))


def process_pending_documents_once() -> None:
    with SessionLocal() as db:
        db.execute(
            text(
                "UPDATE documents "
                "SET status = 'queued', stage = 'uploaded', updated_at = now() "
                "WHERE status = 'processing' AND updated_at < now() - interval '1 hour'"
            )
        )
        queued_document_ids = db.execute(
            text("SELECT id FROM documents WHERE status = 'queued' ORDER BY created_at")
        ).scalars().all()
        db.commit()

    for queued_document_id in queued_document_ids:
        process_document_ingestion(queued_document_id)


def start_pending_document_recovery() -> None:
    thread = threading.Thread(target=process_pending_documents_once, daemon=True)
    thread.start()


def process_document_ingestion(document_id: uuid.UUID | str) -> None:
    with ingestion_semaphore:
        document = claim_queued_document(document_id)
        if document is None:
            return

        try:
            update_document_status(document_id, "processing", "partitioning")
            elements = partition_document(document.storage_path)

            update_document_status(document_id, "processing", "chunking")
            chunks = create_chunks_by_title(elements)

            update_document_status(document_id, "processing", "summarizing")
            documents = summarize_chunks(chunks)
            for index, chunk_document in enumerate(documents):
                chunk_document.metadata.update(
                    {
                        "workspace_id": str(document.workspace_id),
                        "document_id": str(document.id),
                        "original_filename": document.original_filename,
                        "chunk_index": index,
                    }
                )

            update_document_status(document_id, "processing", "embedding")
            create_vector_store(documents)

            update_document_status(document_id, "completed", "completed", completed=True)
        except Exception as exc:
            error = f"{exc}\n{traceback.format_exc()}"
            update_document_status(
                document_id,
                "failed",
                "failed",
                error_message=error[:5000],
                completed=True,
            )
