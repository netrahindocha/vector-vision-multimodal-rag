import asyncio
import json
import os
import re
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models import Document, Workspace
from schemas import DocumentRead
from tasks.ingestion_tasks import process_document_ingestion_task

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))


def sanitize_filename(filename: str) -> str:
    safe_name = Path(filename).name
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", safe_name)
    return safe_name or "uploaded_file"


def document_status_payload(document: Document) -> dict:
    return {
        "id": str(document.id),
        "status": document.status,
        "stage": document.stage,
        "error_message": document.error_message,
        "updated_at": document.updated_at.isoformat() if document.updated_at else None,
        "processing_metadata": document.processing_metadata,
    }


def format_sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
):
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    document_id = uuid.uuid4()
    original_filename = file.filename or "uploaded_file"
    safe_filename = sanitize_filename(original_filename)
    stored_filename = f"{document_id}_{safe_filename}"

    workspace_upload_dir = UPLOAD_DIR / str(workspace_id)
    storage_path = workspace_upload_dir / stored_filename

    size_bytes = 0
    try:
        workspace_upload_dir.mkdir(parents=True, exist_ok=True)
        with storage_path.open("wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                size_bytes += len(chunk)
                buffer.write(chunk)
    except Exception as exc:
        if storage_path.exists():
            storage_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save uploaded file: {exc}",
        ) from exc
    finally:
        file.file.close()

    document = Document(
        id=document_id,
        workspace_id=workspace_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        content_type=file.content_type,
        size_bytes=size_bytes,
        storage_path=str(storage_path),
        status="queued",
        stage="uploaded",
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    process_document_ingestion_task.delay(str(document.id))
    return document


@router.get("/{document_id}/events")
async def stream_document_events(
    document_id: uuid.UUID,
    request: Request,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)
    if document is None or document.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Document not found")

    async def event_generator():
        last_signature = None
        last_heartbeat_at = time.monotonic()

        yield "retry: 3000\n\n"

        while True:
            if await request.is_disconnected():
                break

            with SessionLocal() as stream_db:
                current_document = stream_db.get(Document, document_id)
                if current_document is None or current_document.workspace_id != workspace_id:
                    break

                payload = document_status_payload(current_document)

            signature = (
                payload["status"],
                payload["stage"],
                payload["error_message"],
                payload["updated_at"],
                json.dumps(payload.get("processing_metadata"), sort_keys=True),
            )
            if signature != last_signature:
                yield format_sse_event("document_status", payload)
                last_signature = signature
                last_heartbeat_at = time.monotonic()

            if payload["status"] in {"completed", "failed"}:
                break

            now = time.monotonic()
            if now - last_heartbeat_at >= 15:
                yield ": heartbeat\n\n"
                last_heartbeat_at = now

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: uuid.UUID,
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
):
    document = db.get(Document, document_id)
    if document is None or document.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("", response_model=list[DocumentRead])
def list_workspace_documents(
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
):
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return db.scalars(
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
    ).all()
