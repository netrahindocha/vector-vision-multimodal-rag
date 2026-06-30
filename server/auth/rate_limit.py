import os

from slowapi import Limiter
from slowapi.util import get_remote_address


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is required")
    return value


RATE_LIMIT_STORAGE_URL = required_env("RATE_LIMIT_STORAGE_URL")
RATE_LIMIT_LOGIN = required_env("RATE_LIMIT_LOGIN")
RATE_LIMIT_REGISTER = required_env("RATE_LIMIT_REGISTER")
RATE_LIMIT_GOOGLE_LOGIN = required_env("RATE_LIMIT_GOOGLE_LOGIN")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=RATE_LIMIT_STORAGE_URL,
)
