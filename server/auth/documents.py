import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import Document


def require_workspace_document(
    db: Session,
    workspace_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Document:
    document = db.get(Document, document_id)
    if document is None or document.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return document
