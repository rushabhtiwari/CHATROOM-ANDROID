import hashlib
import secrets
from datetime import UTC, datetime

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_token(nbytes: int = 32) -> str:
    """URL-safe random token for sessions, codes and refresh tokens."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Deterministic lookup hash for high-entropy tokens (not for passwords/secrets)."""
    return hashlib.sha256(token.encode()).hexdigest()


def hash_secret(secret: str) -> str:
    return _hasher.hash(secret)


def verify_secret(secret_hash: str, secret: str) -> bool:
    try:
        return _hasher.verify(secret_hash, secret)
    except (VerificationError, InvalidHashError):
        return False
