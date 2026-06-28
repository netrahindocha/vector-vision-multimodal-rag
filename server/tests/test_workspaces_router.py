import uuid

import pytest
from fastapi import HTTPException

from models import User, Workspace, WorkspaceMember
from routers import workspaces as workspaces_router
from schemas import WorkspaceCreate, WorkspaceUpdate


class FakeDb:
    def __init__(self, *, workspace=None, membership=None):
        self.workspace = workspace
        self.membership = membership
        self.added = []
        self.deleted = None
        self.committed = False
        self.flushed = False
        self.refreshed = None

    def get(self, model, object_id):
        if model is Workspace and self.workspace and self.workspace.id == object_id:
            return self.workspace
        if model is WorkspaceMember and self.membership:
            workspace_id = object_id.get("workspace_id") if isinstance(object_id, dict) else None
            user_id = object_id.get("user_id") if isinstance(object_id, dict) else None
            if self.membership.workspace_id == workspace_id and self.membership.user_id == user_id:
                return self.membership
        return None

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        self.flushed = True
        for obj in self.added:
            if isinstance(obj, Workspace) and obj.id is None:
                obj.id = uuid.uuid4()

    def commit(self):
        self.committed = True

    def refresh(self, obj):
        self.refreshed = obj

    def delete(self, obj):
        self.deleted = obj


def make_user() -> User:
    return User(id=uuid.uuid4(), email="user@example.com", is_active=True)


def make_membership(workspace: Workspace, user: User, role: str = "owner") -> WorkspaceMember:
    return WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=role)


def test_create_workspace_commits_refreshes_model_and_adds_owner_membership():
    db = FakeDb()
    user = make_user()
    payload = WorkspaceCreate(name="Knowledge Base", description="Private docs")

    workspace = workspaces_router.create_workspace(payload, db=db, current_user=user)

    assert isinstance(workspace, Workspace)
    assert workspace.name == "Knowledge Base"
    assert workspace.description == "Private docs"
    assert db.added[0] is workspace
    assert isinstance(db.added[1], WorkspaceMember)
    assert db.added[1].workspace_id == workspace.id
    assert db.added[1].user_id == user.id
    assert db.added[1].role == "owner"
    assert db.flushed is True
    assert db.committed is True
    assert db.refreshed is workspace


def test_get_workspace_returns_existing_workspace_for_member():
    user = make_user()
    workspace = Workspace(id=uuid.uuid4(), name="Existing", description=None)
    membership = make_membership(workspace, user, role="member")

    result = workspaces_router.get_workspace(
        workspace.id,
        db=FakeDb(workspace=workspace, membership=membership),
        current_user=user,
    )

    assert result is workspace


def test_get_workspace_raises_404_when_missing():
    user = make_user()

    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.get_workspace(uuid.uuid4(), db=FakeDb(), current_user=user)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workspace not found"


def test_get_workspace_raises_404_when_user_is_not_member():
    user = make_user()
    workspace = Workspace(id=uuid.uuid4(), name="Existing", description=None)

    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.get_workspace(
            workspace.id,
            db=FakeDb(workspace=workspace),
            current_user=user,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workspace not found"


def test_update_workspace_only_updates_provided_fields_for_owner():
    user = make_user()
    workspace = Workspace(id=uuid.uuid4(), name="Old name", description="Keep me")
    membership = make_membership(workspace, user, role="owner")
    db = FakeDb(workspace=workspace, membership=membership)
    payload = WorkspaceUpdate(name="New name")

    result = workspaces_router.update_workspace(
        workspace.id,
        payload,
        db=db,
        current_user=user,
    )

    assert result is workspace
    assert workspace.name == "New name"
    assert workspace.description == "Keep me"
    assert db.committed is True
    assert db.refreshed is workspace


def test_update_workspace_raises_403_when_member_is_not_owner():
    user = make_user()
    workspace = Workspace(id=uuid.uuid4(), name="Old name", description=None)
    membership = make_membership(workspace, user, role="member")

    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.update_workspace(
            workspace.id,
            WorkspaceUpdate(name="Nope"),
            db=FakeDb(workspace=workspace, membership=membership),
            current_user=user,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Workspace owner access required"


def test_update_workspace_raises_404_when_missing():
    user = make_user()

    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.update_workspace(
            uuid.uuid4(),
            WorkspaceUpdate(name="Nope"),
            db=FakeDb(),
            current_user=user,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workspace not found"


def test_delete_workspace_deletes_and_returns_204_response_for_owner():
    user = make_user()
    workspace = Workspace(id=uuid.uuid4(), name="Delete me", description=None)
    membership = make_membership(workspace, user, role="owner")
    db = FakeDb(workspace=workspace, membership=membership)

    response = workspaces_router.delete_workspace(
        workspace.id,
        db=db,
        current_user=user,
    )

    assert db.deleted is workspace
    assert db.committed is True
    assert response.status_code == 204


def test_delete_workspace_raises_403_when_member_is_not_owner():
    user = make_user()
    workspace = Workspace(id=uuid.uuid4(), name="Delete me", description=None)
    membership = make_membership(workspace, user, role="member")

    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.delete_workspace(
            workspace.id,
            db=FakeDb(workspace=workspace, membership=membership),
            current_user=user,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Workspace owner access required"


def test_delete_workspace_raises_404_when_missing():
    user = make_user()

    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.delete_workspace(uuid.uuid4(), db=FakeDb(), current_user=user)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workspace not found"
