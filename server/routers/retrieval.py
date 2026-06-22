import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Workspace
from schemas import RetrievalAskResponse, RetrievalQueryRequest, RetrievalSearchResponse
from services.retrieval import (
    VectorStoreUnavailableError,
    answer_workspace_query,
    search_workspace,
)

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


def ensure_workspace_exists(workspace_id: uuid.UUID, db: Session) -> None:
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")


@router.post("/search", response_model=RetrievalSearchResponse)
def search_documents(
    request: RetrievalQueryRequest,
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
):
    ensure_workspace_exists(workspace_id, db)

    try:
        return search_workspace(workspace_id, request.query, request.top_k)
    except VectorStoreUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/ask", response_model=RetrievalAskResponse)
def ask_documents(
    request: RetrievalQueryRequest,
    workspace_id: uuid.UUID = Header(..., alias="X-Workspace-Id"),
    db: Session = Depends(get_db),
):
    ensure_workspace_exists(workspace_id, db)

    try:
        return answer_workspace_query(workspace_id, request.query, request.top_k)
    except VectorStoreUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
