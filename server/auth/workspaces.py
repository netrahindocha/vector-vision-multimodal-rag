import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import User, Workspace, WorkspaceMember

OWNER_ROLE = "owner"
MEMBER_ROLE = "member"


def require_workspace_member(
    db: Session,
    user: User,
    workspace_id: uuid.UUID,
) -> WorkspaceMember:
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    membership = db.get(
        WorkspaceMember,
        {"workspace_id": workspace_id, "user_id": user.id},
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return membership


def require_workspace_owner(
    db: Session,
    user: User,
    workspace_id: uuid.UUID,
) -> WorkspaceMember:
    membership = require_workspace_member(db, user, workspace_id)
    if membership.role != OWNER_ROLE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace owner access required",
        )

    return membership
