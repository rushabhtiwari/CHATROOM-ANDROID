import uuid
from urllib.parse import urlsplit

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import Settings

SLUG_PATTERN = r"^[a-z0-9][a-z0-9-]{1,63}$"


def get_or_404[T](db: Session, model: type[T], id_: uuid.UUID) -> T:
    row = db.get(model, id_)
    if row is None:
        raise HTTPException(404, f"{model.__name__} not found")
    return row


def conflict(message: str) -> HTTPException:
    return HTTPException(409, message)


def logo_version(app) -> int | None:
    """Cache-busting version for an app's logo: last change as epoch seconds, or None."""
    if app.logo_content_type is None or app.logo_updated_at is None:
        return None
    return int(app.logo_updated_at.timestamp())


def validate_uris(uris: list[str], settings: Settings, field: str) -> list[str]:
    """Absolute URLs; https required except localhost outside staging/production."""
    for uri in uris:
        parts = urlsplit(uri)
        local = parts.hostname in ("localhost", "127.0.0.1")
        allow_http = local and settings.environment in ("development", "test")
        schemes = ("https", "http") if allow_http else ("https",)
        if parts.scheme not in schemes or not parts.hostname:
            raise HTTPException(422, f"{field}: '{uri}' must be an absolute https URL")
        if parts.fragment:
            raise HTTPException(422, f"{field}: '{uri}' must not contain a fragment")
    return uris
