import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is required")
    return value


ACCESS_TOKEN_EXPIRE_MINUTES = int(required_env("ACCESS_TOKEN_EXPIRE_MINUTES"))
REFRESH_TOKEN_EXPIRE_DAYS = int(required_env("REFRESH_TOKEN_EXPIRE_DAYS"))
JWT_SECRET_KEY = required_env("JWT_SECRET_KEY")
JWT_ALGORITHM = required_env("JWT_ALGORITHM")


def utc_now() -> datetime:
    return datetime.now(UTC)


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    expires_at = utc_now() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expires_at,
        "iat": utc_now(),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_token_expires_at() -> datetime:
    return utc_now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None

    if payload.get("type") != "access":
        return None
    return payload
