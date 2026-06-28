import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from auth.documents import require_workspace_document
from auth.workspaces import require_workspace_member
from database import get_db
from models import User
from schemas import RetrievalAskResponse, RetrievalQueryRequest, RetrievalSearchResponse
from services.retrieval import (
    VectorStoreUnavailableError,
    answer_document_query,
    answer_workspace_query,
    get_document_chunks,
    get_document_partition_items,
    search_workspace,
)

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


@router.post("/search", response_model=RetrievalSearchResponse)
def search_documents(
    request: RetrievalQueryRequest,
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, current_user, workspace_id)

    try:
        return search_workspace(workspace_id, request.query, request.top_k)
    except VectorStoreUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/documents/{document_id}/ask", response_model=RetrievalAskResponse)
def ask_document(
    document_id: uuid.UUID,
    request: RetrievalQueryRequest,
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, current_user, workspace_id)
    require_workspace_document(db, workspace_id, document_id)

    try:
        return answer_document_query(workspace_id, document_id, request.query, request.top_k)
    except VectorStoreUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/documents/{document_id}/partition-items")
def get_document_partition_item_details(
    document_id: uuid.UUID,
    content_type: str = Query("all", pattern="^(all|text|image|table)$"),
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, current_user, workspace_id)
    require_workspace_document(db, workspace_id, document_id)
    return get_document_partition_items(workspace_id, document_id, content_type)


@router.get("/documents/{document_id}/chunks")
def get_document_chunk_details(
    document_id: uuid.UUID,
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, current_user, workspace_id)
    require_workspace_document(db, workspace_id, document_id)

    try:
        return get_document_chunks(workspace_id, document_id)
    except VectorStoreUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/ask", response_model=RetrievalAskResponse)
def ask_documents(
    request: RetrievalQueryRequest,
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, current_user, workspace_id)

    try:
        return answer_workspace_query(workspace_id, request.query, request.top_k)
    except VectorStoreUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
