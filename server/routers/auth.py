from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth.cookies import (
    REFRESH_TOKEN_COOKIE_NAME,
    clear_refresh_token_cookie,
    set_refresh_token_cookie,
)
from auth.dependencies import get_current_user
from auth.password import hash_password, verify_password
from auth.tokens import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    refresh_token_expires_at,
)
from database import get_db
from models import RefreshToken, User
from schemas import LoginRequest, RegisterRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"


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


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
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
def login(
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
