from collections.abc import Callable

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from auth.tokens import decode_access_token

PROTECTED_EXACT_PATHS = {
    "/auth/me",
}
PROTECTED_PREFIXES = (
    "/workspaces",
    "/documents",
    "/retrieval",
)


def is_document_events_path(path: str) -> bool:
    return path.startswith("/documents/") and path.endswith("/events")


def is_protected_path(path: str) -> bool:
    if path in PROTECTED_EXACT_PATHS:
        return True
    if is_document_events_path(path):
        return False
    return any(path == prefix or path.startswith(f"{prefix}/") for prefix in PROTECTED_PREFIXES)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        request.state.auth_payload = None

        if not is_protected_path(request.url.path):
            return await call_next(request)

        authorization = request.headers.get("Authorization")
        if not authorization:
            return unauthorized_response()

        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return unauthorized_response()

        payload = decode_access_token(token)
        if payload is None:
            return unauthorized_response()

        request.state.auth_payload = payload
        return await call_next(request)


def unauthorized_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Not authenticated"},
        headers={"WWW-Authenticate": "Bearer"},
    )
