import os
import uuid

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-used-for-production")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "30")
os.environ.setdefault("JWT_ALGORITHM", "HS256")

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_api_docs_and_openapi_are_disabled():
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_protected_routes_are_blocked_without_access_token():
    workspace_id = str(uuid.uuid4())
    document_id = str(uuid.uuid4())

    responses = [
        client.get("/auth/me"),
        client.get("/workspaces"),
        client.get("/documents", headers={"X-Workspace-Id": workspace_id}),
        client.get(f"/documents/{document_id}", headers={"X-Workspace-Id": workspace_id}),
        client.post(
            "/retrieval/ask",
            headers={"X-Workspace-Id": workspace_id},
            json={"query": "hello", "top_k": 3},
        ),
    ]

    for response in responses:
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"


def test_public_auth_routes_are_not_blocked_by_auth_middleware():
    login_response = client.post("/auth/login", json={})
    register_response = client.post("/auth/register", json={})
    refresh_response = client.post("/auth/refresh")

    assert login_response.status_code == 422
    assert register_response.status_code == 422
    assert refresh_response.status_code == 401
    assert refresh_response.json()["detail"] == "Invalid refresh token"


def test_events_route_is_not_middleware_blocked_but_still_requires_auth():
    workspace_id = str(uuid.uuid4())
    document_id = str(uuid.uuid4())

    response = client.get(f"/documents/{document_id}/events?workspace_id={workspace_id}")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
