import json
import threading
import traceback
import uuid
from collections import Counter

from sqlalchemy import text

from database import SessionLocal
from models import Document, DocumentChunk, DocumentPartitionItem
from rag.pipeline import (
    analyze_chunk_content,
    create_chunks_by_title,
    create_vector_store,
    partition_document,
    summarize_one_chunk,
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


def update_document_processing_metadata(
    document_id: uuid.UUID | str,
    metadata_update: dict,
) -> None:
    with SessionLocal() as db:
        document = db.get(Document, uuid.UUID(str(document_id)))
        if document is None:
            return

        current_metadata = document.processing_metadata or {}
        document.processing_metadata = {**current_metadata, **metadata_update}
        db.commit()


def serialize_element_metadata(element) -> dict:
    metadata = getattr(element, "metadata", None)
    if metadata is None:
        return {}

    try:
        data = metadata.to_dict()
        if isinstance(data, dict):
            data.pop("image_base64", None)
            data.pop("orig_elements", None)
            return data
    except Exception:
        pass

    return {}


def get_partition_content_type(element) -> str:
    category = getattr(element, "category", None)
    element_type = type(element).__name__
    if category == "Table" or element_type == "Table":
        return "table"
    if category == "Image" or element_type == "Image":
        return "image"
    return "text"


def store_document_partition_items(document: Document, elements) -> None:
    with SessionLocal() as db:
        db.query(DocumentPartitionItem).filter(
            DocumentPartitionItem.document_id == document.id
        ).delete(synchronize_session=False)

        for index, element in enumerate(elements):
            content_type = get_partition_content_type(element)
            element_metadata = serialize_element_metadata(element)
            text_content = getattr(element, "text", None)
            table_html = None
            image_base64 = None

            if content_type == "table":
                table_html = getattr(getattr(element, "metadata", None), "text_as_html", None)
                text_content = text_content or None
            elif content_type == "image":
                image_base64 = getattr(getattr(element, "metadata", None), "image_base64", None)
                text_content = text_content or None

            db.add(
                DocumentPartitionItem(
                    document_id=document.id,
                    workspace_id=document.workspace_id,
                    element_index=index,
                    content_type=content_type,
                    element_type=type(element).__name__,
                    category=getattr(element, "category", None),
                    text=text_content,
                    table_html=table_html,
                    image_base64=image_base64,
                    element_metadata=element_metadata,
                )
            )

        db.commit()


def build_partition_metadata(elements) -> dict:
    categories = Counter(getattr(element, "category", type(element).__name__) for element in elements)
    element_types = Counter(type(element).__name__ for element in elements)
    table_count = categories.get("Table", 0)
    image_count = categories.get("Image", 0)
    text_count = max(len(elements) - table_count - image_count, 0)

    return {
        "partitioning": {
            "elements_found": len(elements),
            "text": text_count,
            "images": image_count,
            "tables": table_count,
            "categories": dict(categories),
            "element_types": dict(element_types),
        }
    }


def build_chunking_metadata(chunks) -> dict:
    return {
        "chunking": {
            "chunks_created": len(chunks),
        }
    }


def parse_json_metadata(value, default):
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return default


def build_chunk_metadata(metadata: dict) -> dict:
    return {key: value for key, value in metadata.items() if key != "original_content"}


def store_document_chunks(document: Document, chunk_documents) -> None:
    with SessionLocal() as db:
        db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document.id
        ).delete(synchronize_session=False)

        for index, chunk_document in enumerate(chunk_documents):
            metadata = dict(chunk_document.metadata or {})
            original_content = parse_json_metadata(metadata.get("original_content"), {})
            content_types = parse_json_metadata(metadata.get("content_types"), [])

            db.add(
                DocumentChunk(
                    document_id=document.id,
                    workspace_id=document.workspace_id,
                    chunk_index=index,
                    raw_text=original_content.get("raw_text") or "",
                    tables_html=original_content.get("tables_html") or [],
                    images_base64=original_content.get("images_base64") or [],
                    content_types=content_types if isinstance(content_types, list) else [],
                    table_count=int(metadata.get("table_count") or 0),
                    image_count=int(metadata.get("image_count") or 0),
                    text_length=int(metadata.get("text_length") or 0),
                    enhanced_content=chunk_document.page_content,
                    chunk_metadata=build_chunk_metadata(metadata),
                )
            )

        db.commit()


def store_raw_document_chunks(document: Document, chunks) -> None:
    with SessionLocal() as db:
        db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document.id
        ).delete(synchronize_session=False)

        for index, chunk in enumerate(chunks):
            chunk_content = analyze_chunk_content(chunk)
            chunk_metadata = {
                "summary_status": "pending",
                "is_multimodal": chunk_content["is_multimodal"],
            }
            if chunk_content.get("page_number") is not None:
                chunk_metadata["page_number"] = chunk_content["page_number"]

            db.add(
                DocumentChunk(
                    document_id=document.id,
                    workspace_id=document.workspace_id,
                    chunk_index=index,
                    raw_text=chunk_content["raw_text"] or "",
                    tables_html=chunk_content["tables_html"] or [],
                    images_base64=chunk_content["images_base64"] or [],
                    content_types=chunk_content["content_types"] or [],
                    table_count=int(chunk_content["table_count"] or 0),
                    image_count=int(chunk_content["image_count"] or 0),
                    text_length=int(chunk_content["text_length"] or 0),
                    enhanced_content=chunk_content["raw_text"] or "",
                    chunk_metadata=chunk_metadata,
                )
            )

        db.commit()


def update_document_chunk_summary(
    document: Document,
    chunk_index: int,
    chunk_document,
) -> None:
    metadata = dict(chunk_document.metadata or {})
    original_content = parse_json_metadata(metadata.get("original_content"), {})
    content_types = parse_json_metadata(metadata.get("content_types"), [])

    with SessionLocal() as db:
        row = (
            db.query(DocumentChunk)
            .filter(
                DocumentChunk.document_id == document.id,
                DocumentChunk.chunk_index == chunk_index,
            )
            .first()
        )

        if row is None:
            row = DocumentChunk(
                document_id=document.id,
                workspace_id=document.workspace_id,
                chunk_index=chunk_index,
            )
            db.add(row)

        row.raw_text = original_content.get("raw_text") or ""
        row.tables_html = original_content.get("tables_html") or []
        row.images_base64 = original_content.get("images_base64") or []
        row.content_types = content_types if isinstance(content_types, list) else []
        row.table_count = int(metadata.get("table_count") or 0)
        row.image_count = int(metadata.get("image_count") or 0)
        row.text_length = int(metadata.get("text_length") or 0)
        row.enhanced_content = chunk_document.page_content
        row.chunk_metadata = build_chunk_metadata(metadata)
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
            store_document_partition_items(document, elements)
            update_document_processing_metadata(
                document_id,
                build_partition_metadata(elements),
            )

            update_document_status(document_id, "processing", "chunking")
            chunks = create_chunks_by_title(elements)
            update_document_processing_metadata(
                document_id,
                build_chunking_metadata(chunks),
            )
            store_raw_document_chunks(document, chunks)

            update_document_status(document_id, "processing", "summarizing")
            documents = []
            total_chunks = len(chunks)
            for index, chunk in enumerate(chunks):
                chunk_document = summarize_one_chunk(chunk, index, total_chunks)
                chunk_document.metadata.update(
                    {
                        "workspace_id": str(document.workspace_id),
                        "document_id": str(document.id),
                        "original_filename": document.original_filename,
                        "chunk_index": index,
                    }
                )
                update_document_chunk_summary(document, index, chunk_document)
                documents.append(chunk_document)

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
