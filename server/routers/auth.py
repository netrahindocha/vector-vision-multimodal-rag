import os
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth.cookies import (
    AUTH_COOKIE_SAMESITE,
    AUTH_COOKIE_SECURE,
    REFRESH_TOKEN_COOKIE_NAME,
    clear_refresh_token_cookie,
    set_refresh_token_cookie,
)
from auth.dependencies import get_current_user
from auth.password import hash_password, verify_password
from auth.rate_limit import RATE_LIMIT_GOOGLE_LOGIN, RATE_LIMIT_LOGIN, RATE_LIMIT_REGISTER, limiter
from auth.tokens import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    refresh_token_expires_at,
)
from database import get_db
from models import OAuthAccount, RefreshToken, User
from schemas import LoginRequest, RegisterRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"
GOOGLE_PROVIDER = "google"
GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_OAUTH_STATE_COOKIE_NAME = "google_oauth_state"
GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = int(timedelta(minutes=5).total_seconds())


def normalize_email(email: str) -> str:
    return email.strip().lower()


def issue_access_token(user: User) -> str:
    return create_access_token(subject=str(user.id))


def create_refresh_token_session(user: User, db: Session) -> str:
    refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=refresh_token_expires_at(),
        )
    )
    return refresh_token


def issue_token_response(user: User, refresh_token: str, response: Response) -> TokenResponse:
    set_refresh_token_cookie(response, refresh_token)
    return TokenResponse(
        access_token=issue_access_token(user),
        user=UserRead.model_validate(user),
    )


def is_expired(expires_at: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at <= datetime.now(UTC)


def get_active_refresh_token_row(
    refresh_token: str | None,
    db: Session,
) -> RefreshToken | None:
    if not refresh_token:
        return None

    token_hash = hash_refresh_token(refresh_token)
    token_row = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    if token_row is None or is_expired(token_row.expires_at):
        return None

    return token_row


def required_oauth_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=500, detail=f"{name} environment variable is required")
    return value


def get_google_oauth_settings() -> dict[str, str]:
    return {
        "client_id": required_oauth_env("GOOGLE_CLIENT_ID"),
        "client_secret": required_oauth_env("GOOGLE_CLIENT_SECRET"),
        "redirect_uri": required_oauth_env("GOOGLE_REDIRECT_URI"),
        "frontend_redirect_url": required_oauth_env("FRONTEND_AUTH_REDIRECT_URL"),
    }


def build_google_authorization_url(state: str, settings: dict[str, str]) -> str:
    query = urlencode(
        {
            "client_id": settings["client_id"],
            "redirect_uri": settings["redirect_uri"],
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
    )
    return f"{GOOGLE_AUTHORIZATION_URL}?{query}"


def set_google_oauth_state_cookie(response: Response, state: str) -> None:
    response.set_cookie(
        key=GOOGLE_OAUTH_STATE_COOKIE_NAME,
        value=state,
        max_age=GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        path="/auth/google/callback",
    )


def clear_google_oauth_state_cookie(response: Response) -> None:
    response.delete_cookie(
        key=GOOGLE_OAUTH_STATE_COOKIE_NAME,
        path="/auth/google/callback",
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
    )


def exchange_google_code_for_userinfo(code: str, settings: dict[str, str]) -> dict:
    with httpx.Client(timeout=15) as client:
        token_response = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings["client_id"],
                "client_secret": settings["client_secret"],
                "redirect_uri": settings["redirect_uri"],
                "grant_type": "authorization_code",
            },
        )
        token_response.raise_for_status()
        token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Google OAuth token exchange failed")

        userinfo_response = client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        userinfo_response.raise_for_status()
        return userinfo_response.json()


def get_or_create_google_user(userinfo: dict, db: Session) -> User:
    provider_account_id = userinfo.get("sub")
    email = userinfo.get("email")
    email_verified = bool(userinfo.get("email_verified"))
    if not provider_account_id or not email:
        raise HTTPException(status_code=400, detail="Google account did not provide required profile data")

    oauth_account = db.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == GOOGLE_PROVIDER,
            OAuthAccount.provider_account_id == provider_account_id,
        )
    )
    if oauth_account is not None:
        user = db.get(User, oauth_account.user_id)
        if user is None or not user.is_active:
            raise HTTPException(status_code=401, detail="Google account is not active")
        return user

    normalized_email = normalize_email(email)
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None:
        user = User(
            email=normalized_email,
            name=userinfo.get("name"),
            avatar_url=userinfo.get("picture"),
            password_hash=None,
            email_verified=email_verified,
            is_active=True,
        )
        db.add(user)
        db.flush()
    elif not email_verified:
        raise HTTPException(status_code=400, detail="Google email must be verified to link accounts")
    elif not user.is_active:
        raise HTTPException(status_code=401, detail="User account is not active")

    if email_verified and not user.email_verified:
        user.email_verified = True
    if user.avatar_url is None and userinfo.get("picture"):
        user.avatar_url = userinfo.get("picture")
    if user.name is None and userinfo.get("name"):
        user.name = userinfo.get("name")

    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=GOOGLE_PROVIDER,
            provider_account_id=provider_account_id,
            provider_email=normalized_email,
        )
    )
    return user


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_REGISTER)
def register(
    request: Request,
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    email = normalize_email(payload.email)
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    user = User(
        email=email,
        name=payload.name.strip() if payload.name else None,
        password_hash=hash_password(payload.password),
        email_verified=False,
        is_active=True,
    )
    db.add(user)
    db.flush()

    refresh_token = create_refresh_token_session(user, db)
    db.commit()
    db.refresh(user)

    return issue_token_response(user, refresh_token, response)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(RATE_LIMIT_LOGIN)
def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    email = normalize_email(payload.email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_MESSAGE,
        )

    refresh_token = create_refresh_token_session(user, db)
    db.commit()

    return issue_token_response(user, refresh_token, response)


@router.get("/google/login")
@limiter.limit(RATE_LIMIT_GOOGLE_LOGIN)
def google_login(request: Request):
    settings = get_google_oauth_settings()
    state = secrets.token_urlsafe(32)
    response = RedirectResponse(build_google_authorization_url(state, settings))
    set_google_oauth_state_cookie(response, state)
    return response


@router.get("/google/callback")
def google_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    stored_state: str | None = Cookie(default=None, alias=GOOGLE_OAUTH_STATE_COOKIE_NAME),
    db: Session = Depends(get_db),
):
    settings = get_google_oauth_settings()
    redirect_response = RedirectResponse(settings["frontend_redirect_url"])
    clear_google_oauth_state_cookie(redirect_response)

    if not code or not state or not stored_state or not secrets.compare_digest(state, stored_state):
        redirect_response.headers["Location"] = f"{settings['frontend_redirect_url']}?error=oauth_state"
        return redirect_response

    try:
        userinfo = exchange_google_code_for_userinfo(code, settings)
        user = get_or_create_google_user(userinfo, db)
        refresh_token = create_refresh_token_session(user, db)
        db.commit()
        db.refresh(user)
        set_refresh_token_cookie(redirect_response, refresh_token)
        return redirect_response
    except Exception:
        db.rollback()
        redirect_response.headers["Location"] = f"{settings['frontend_redirect_url']}?error=oauth_failed"
        return redirect_response


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE_NAME),
    db: Session = Depends(get_db),
):
    token_row = get_active_refresh_token_row(refresh_token, db)
    if token_row is None:
        clear_refresh_token_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.get(User, token_row.user_id)
    if user is None or not user.is_active:
        clear_refresh_token_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_row.revoked_at = datetime.now(UTC)
    new_refresh_token = create_refresh_token_session(user, db)
    db.commit()

    return issue_token_response(user, new_refresh_token, response)


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE_NAME),
    db: Session = Depends(get_db),
):
    token_row = get_active_refresh_token_row(refresh_token, db)
    if token_row is not None:
        token_row.revoked_at = datetime.now(UTC)
        db.commit()

    clear_refresh_token_cookie(response)
    return {"status": "ok"}
