import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Document, Workspace
from schemas import DocumentRead

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))


def sanitize_filename(filename: str) -> str:
    safe_name = Path(filename).name
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", safe_name)
    return safe_name or "uploaded_file"


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
    )

    db.add(document)
    db.commit()
    db.refresh(document)
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
