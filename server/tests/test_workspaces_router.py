import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from models import Workspace
from routers import workspaces as workspaces_router
from schemas import WorkspaceCreate, WorkspaceUpdate


class FakeDb:
    def __init__(self, workspace=None):
        self.workspace = workspace
        self.added = None
        self.deleted = None
        self.committed = False
        self.refreshed = None

    def get(self, model, object_id):
        if model is Workspace and self.workspace and self.workspace.id == object_id:
            return self.workspace
        return None

    def add(self, obj):
        self.added = obj

    def commit(self):
        self.committed = True

    def refresh(self, obj):
        self.refreshed = obj

    def delete(self, obj):
        self.deleted = obj


def test_create_workspace_commits_and_refreshes_model():
    db = FakeDb()
    payload = WorkspaceCreate(name="Knowledge Base", description="Private docs")

    workspace = workspaces_router.create_workspace(payload, db=db)

    assert isinstance(workspace, Workspace)
    assert workspace.name == "Knowledge Base"
    assert workspace.description == "Private docs"
    assert db.added is workspace
    assert db.committed is True
    assert db.refreshed is workspace


def test_get_workspace_returns_existing_workspace():
    workspace = Workspace(id=uuid.uuid4(), name="Existing", description=None)

    result = workspaces_router.get_workspace(workspace.id, db=FakeDb(workspace))

    assert result is workspace


def test_get_workspace_raises_404_when_missing():
    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.get_workspace(uuid.uuid4(), db=FakeDb())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workspace not found"


def test_update_workspace_only_updates_provided_fields():
    workspace = Workspace(id=uuid.uuid4(), name="Old name", description="Keep me")
    db = FakeDb(workspace)
    payload = WorkspaceUpdate(name="New name")

    result = workspaces_router.update_workspace(workspace.id, payload, db=db)

    assert result is workspace
    assert workspace.name == "New name"
    assert workspace.description == "Keep me"
    assert db.committed is True
    assert db.refreshed is workspace


def test_update_workspace_raises_404_when_missing():
    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.update_workspace(uuid.uuid4(), WorkspaceUpdate(name="Nope"), db=FakeDb())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workspace not found"


def test_delete_workspace_deletes_and_returns_204_response():
    workspace = Workspace(id=uuid.uuid4(), name="Delete me", description=None)
    db = FakeDb(workspace)

    response = workspaces_router.delete_workspace(workspace.id, db=db)

    assert db.deleted is workspace
    assert db.committed is True
    assert response.status_code == 204


def test_delete_workspace_raises_404_when_missing():
    with pytest.raises(HTTPException) as exc_info:
        workspaces_router.delete_workspace(uuid.uuid4(), db=FakeDb())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workspace not found"
