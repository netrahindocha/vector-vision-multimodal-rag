import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Response

from auth.dependencies import get_current_user
from auth.middleware import is_protected_path
from auth.password import verify_password
from auth.tokens import create_access_token, generate_refresh_token, hash_refresh_token
from models import OAuthAccount, RefreshToken, User
from routers import auth as auth_router
from schemas import LoginRequest, RegisterRequest


class FakeDb:
    def __init__(self, *, scalar_result=None, user=None, refresh_token_row=None, oauth_account=None):
        self.scalar_result = scalar_result
        self.user = user
        self.refresh_token_row = refresh_token_row
        self.oauth_account = oauth_account
        self.added = []
        self.committed = False
        self.flushed = False
        self.refreshed = None

    def scalar(self, statement):
        entity = statement.column_descriptions[0].get("entity")
        if entity is RefreshToken and self.refresh_token_row is not None:
            return self.refresh_token_row
        if entity is OAuthAccount:
            return self.oauth_account
        if entity is User and self.user is not None:
            return self.user
        return self.scalar_result

    def get(self, model, object_id):
        if model is User and self.user and self.user.id == object_id:
            return self.user
        return None

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, User):
            self.user = obj
        if isinstance(obj, RefreshToken):
            self.refresh_token_row = obj
        if isinstance(obj, OAuthAccount):
            self.oauth_account = obj

    def flush(self):
        self.flushed = True
        now = datetime.now(UTC)
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
            if isinstance(obj, User):
                obj.created_at = obj.created_at or now
                obj.updated_at = obj.updated_at or now
            if isinstance(obj, RefreshToken):
                obj.created_at = obj.created_at or now

    def commit(self):
        self.committed = True
        self.flush()

    def refresh(self, obj):
        self.refreshed = obj
        if isinstance(obj, User):
            now = datetime.now(UTC)
            obj.created_at = obj.created_at or now
            obj.updated_at = obj.updated_at or now

    def rollback(self):
        pass


def make_user(*, password_hash: str | None = None, active: bool = True) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid.uuid4(),
        email="user@example.com",
        name="User",
        password_hash=password_hash,
        email_verified=False,
        is_active=active,
        created_at=now,
        updated_at=now,
    )


def test_register_creates_user_hashes_password_sets_cookie_and_returns_token():
    db = FakeDb()
    response = Response()
    payload = RegisterRequest(email="USER@example.com", password="password123", name="User")

    result = auth_router.register(payload, response=response, db=db)

    assert result.access_token
    assert result.token_type == "bearer"
    assert result.user.email == "user@example.com"
    assert db.committed is True
    user = next(item for item in db.added if isinstance(item, User))
    assert user.email == "user@example.com"
    assert user.password_hash != "password123"
    assert verify_password("password123", user.password_hash)
    assert any(isinstance(item, RefreshToken) for item in db.added)
    assert "refresh_token=" in response.headers.get("set-cookie", "")


def test_register_rejects_duplicate_email():
    existing_user = make_user()

    with pytest.raises(HTTPException) as exc_info:
        auth_router.register(
            RegisterRequest(email="user@example.com", password="password123", name=None),
            response=Response(),
            db=FakeDb(scalar_result=existing_user),
        )

    assert exc_info.value.status_code == 409


def test_login_accepts_valid_credentials_and_sets_refresh_cookie():
    password_hash = auth_router.hash_password("password123")
    user = make_user(password_hash=password_hash)
    db = FakeDb(scalar_result=user, user=user)
    response = Response()

    result = auth_router.login(
        LoginRequest(email="USER@example.com", password="password123"),
        response=response,
        db=db,
    )

    assert result.access_token
    assert result.user.id == user.id
    assert db.committed is True
    assert "refresh_token=" in response.headers.get("set-cookie", "")


def test_login_rejects_invalid_password():
    user = make_user(password_hash=auth_router.hash_password("password123"))

    with pytest.raises(HTTPException) as exc_info:
        auth_router.login(
            LoginRequest(email="user@example.com", password="wrong-password"),
            response=Response(),
            db=FakeDb(scalar_result=user, user=user),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == auth_router.INVALID_CREDENTIALS_MESSAGE


def test_get_current_user_uses_middleware_payload_and_loads_active_user():
    user = make_user()
    request = SimpleNamespace(state=SimpleNamespace(auth_payload={"sub": str(user.id)}))

    result = get_current_user(request=request, credentials=None, db=FakeDb(user=user))

    assert result is user


def test_get_current_user_rejects_missing_payload_and_credentials():
    request = SimpleNamespace(state=SimpleNamespace(auth_payload=None))

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request=request, credentials=None, db=FakeDb())

    assert exc_info.value.status_code == 401


def test_refresh_rotates_valid_refresh_token_and_sets_new_cookie():
    user = make_user()
    raw_refresh_token = generate_refresh_token()
    token_row = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=1),
        revoked_at=None,
        created_at=datetime.now(UTC),
    )
    db = FakeDb(user=user, refresh_token_row=token_row)
    response = Response()

    result = auth_router.refresh(response=response, refresh_token=raw_refresh_token, db=db)

    assert result.access_token
    assert token_row.revoked_at is not None
    assert db.committed is True
    assert "refresh_token=" in response.headers.get("set-cookie", "")


def test_refresh_rejects_invalid_refresh_token_and_clears_cookie():
    response = Response()

    with pytest.raises(HTTPException) as exc_info:
        auth_router.refresh(response=response, refresh_token="invalid", db=FakeDb())

    assert exc_info.value.status_code == 401
    assert "refresh_token=" in response.headers.get("set-cookie", "")


def test_logout_revokes_refresh_token_and_clears_cookie():
    user = make_user()
    raw_refresh_token = generate_refresh_token()
    token_row = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=1),
        revoked_at=None,
        created_at=datetime.now(UTC),
    )
    response = Response()
    db = FakeDb(user=user, refresh_token_row=token_row)

    result = auth_router.logout(response=response, refresh_token=raw_refresh_token, db=db)

    assert result == {"status": "ok"}
    assert token_row.revoked_at is not None
    assert db.committed is True
    assert "refresh_token=" in response.headers.get("set-cookie", "")


def test_get_or_create_google_user_creates_user_and_oauth_link_for_new_verified_email():
    db = FakeDb()
    userinfo = {
        "sub": "google-sub-1",
        "email": "GOOGLE@example.com",
        "email_verified": True,
        "name": "Google User",
        "picture": "https://example.com/avatar.png",
    }

    user = auth_router.get_or_create_google_user(userinfo, db)

    assert user.email == "google@example.com"
    assert user.email_verified is True
    assert user.password_hash is None
    assert user.name == "Google User"
    assert user.avatar_url == "https://example.com/avatar.png"
    oauth_account = next(item for item in db.added if isinstance(item, OAuthAccount))
    assert oauth_account.user_id == user.id
    assert oauth_account.provider == "google"
    assert oauth_account.provider_account_id == "google-sub-1"


def test_get_or_create_google_user_links_existing_verified_email():
    existing_user = make_user()
    db = FakeDb(user=existing_user)
    userinfo = {
        "sub": "google-sub-2",
        "email": existing_user.email,
        "email_verified": True,
        "name": "Existing Google User",
    }

    user = auth_router.get_or_create_google_user(userinfo, db)

    assert user is existing_user
    assert user.email_verified is True
    oauth_account = next(item for item in db.added if isinstance(item, OAuthAccount))
    assert oauth_account.user_id == existing_user.id
    assert oauth_account.provider_account_id == "google-sub-2"


def test_get_or_create_google_user_rejects_unverified_email_link():
    existing_user = make_user()
    db = FakeDb(user=existing_user)

    with pytest.raises(HTTPException) as exc_info:
        auth_router.get_or_create_google_user(
            {
                "sub": "google-sub-3",
                "email": existing_user.email,
                "email_verified": False,
            },
            db,
        )

    assert exc_info.value.status_code == 400


def test_build_google_authorization_url_contains_required_parameters():
    url = auth_router.build_google_authorization_url(
        "state-123",
        {
            "client_id": "client-id",
            "client_secret": "secret",
            "redirect_uri": "http://localhost:8000/auth/google/callback",
            "frontend_redirect_url": "http://localhost:3000/auth/callback",
        },
    )

    assert url.startswith(auth_router.GOOGLE_AUTHORIZATION_URL)
    assert "client_id=client-id" in url
    assert "state=state-123" in url
    assert "scope=openid+email+profile" in url


def test_middleware_path_matching_protects_expected_routes_and_skips_public_routes():
    assert is_protected_path("/auth/me")
    assert is_protected_path("/workspaces")
    assert is_protected_path("/workspaces/abc")
    assert is_protected_path("/documents")
    assert is_protected_path("/documents/upload")
    assert is_protected_path("/retrieval/ask")

    assert not is_protected_path("/")
    assert not is_protected_path("/health/db")
    assert not is_protected_path("/auth/login")
    assert not is_protected_path("/auth/register")
    assert not is_protected_path("/auth/refresh")
    assert not is_protected_path("/documents/doc-id/events")


def test_access_token_can_be_created_for_test_user():
    user = make_user()
    token = create_access_token(str(user.id))

    assert token
