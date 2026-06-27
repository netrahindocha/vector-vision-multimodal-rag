import json
import uuid
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from models import Document, Workspace
from routers import documents as documents_router


class FakeDb:
    def __init__(self, *, workspace=None, document=None):
        self.workspace = workspace
        self.document = document
        self.added = None
        self.committed = False
        self.refreshed = None

    def get(self, model, object_id):
        if model is Workspace and self.workspace and self.workspace.id == object_id:
            return self.workspace
        if model is Document and self.document and self.document.id == object_id:
            return self.document
        return None

    def add(self, obj):
        self.added = obj

    def commit(self):
        self.committed = True

    def refresh(self, obj):
        self.refreshed = obj


def test_sanitize_filename_removes_paths_and_unsafe_characters():
    assert documents_router.sanitize_filename("../../my report(1).pdf") == "my_report_1_.pdf"
    assert documents_router.sanitize_filename("valid-file_1.pdf") == "valid-file_1.pdf"
    assert documents_router.sanitize_filename("###") == "___"


def test_sanitize_filename_falls_back_for_empty_names():
    assert documents_router.sanitize_filename("") == "uploaded_file"


def test_format_sse_event_serializes_event_name_and_payload():
    payload = {"status": "processing", "stage": "chunking"}

    event = documents_router.format_sse_event("document_status", payload)

    assert event.startswith("event: document_status\n")
    assert event.endswith("\n\n")
    assert json.loads(event.split("data: ", 1)[1]) == payload


def test_document_status_payload_handles_nullable_fields():
    document = SimpleNamespace(
        id=uuid.uuid4(),
        status="queued",
        stage="uploaded",
        error_message=None,
        updated_at=None,
        processing_metadata={"partitioning": {"elements_found": 3}},
    )

    payload = documents_router.document_status_payload(document)

    assert payload == {
        "id": str(document.id),
        "status": "queued",
        "stage": "uploaded",
        "error_message": None,
        "updated_at": None,
        "processing_metadata": {"partitioning": {"elements_found": 3}},
    }


def test_get_document_file_rejects_wrong_workspace(tmp_path):
    workspace_id = uuid.uuid4()
    document = Document(
        id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        original_filename="a.pdf",
        stored_filename="a.pdf",
        content_type="application/pdf",
        size_bytes=1,
        storage_path=str(tmp_path / "a.pdf"),
    )

    with pytest.raises(HTTPException) as exc_info:
        documents_router.get_document_file(document.id, workspace_id=workspace_id, db=FakeDb(document=document))

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Document not found"


def test_upload_document_persists_file_and_queues_ingestion(tmp_path, monkeypatch):
    workspace = Workspace(id=uuid.uuid4(), name="Research", description=None)
    db = FakeDb(workspace=workspace)
    queued_document_ids: list[str] = []

    monkeypatch.setattr(documents_router, "UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(
        documents_router.process_document_ingestion_task,
        "delay",
        lambda document_id: queued_document_ids.append(document_id),
    )

    upload = SimpleNamespace(
        filename="Quarterly Fraud Report.pdf",
        content_type="application/pdf",
        file=BytesIO(b"hello world"),
    )

    document = documents_router.upload_document(file=upload, workspace_id=workspace.id, db=db)

    assert db.committed is True
    assert db.added is document
    assert db.refreshed is document
    assert queued_document_ids == [str(document.id)]
    assert document.workspace_id == workspace.id
    assert document.original_filename == "Quarterly Fraud Report.pdf"
    assert document.stored_filename.endswith("_Quarterly_Fraud_Report.pdf")
    assert document.size_bytes == len(b"hello world")
    assert document.status == "queued"
    assert document.stage == "uploaded"
    assert (tmp_path / str(workspace.id) / document.stored_filename).read_bytes() == b"hello world"


def test_upload_document_returns_404_for_missing_workspace():
    upload = SimpleNamespace(filename="a.pdf", content_type="application/pdf", file=BytesIO(b"x"))

    with pytest.raises(HTTPException) as exc_info:
        documents_router.upload_document(file=upload, workspace_id=uuid.uuid4(), db=FakeDb())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Workspace not found"
