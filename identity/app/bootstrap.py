from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.keys import ensure_active_key
from app.models import App
from app.security import hash_secret, verify_secret

PORTAL_CLIENT_ID = "portal"


def ensure_portal_app(db: Session, settings: Settings) -> None:
    """Sync the migration-seeded portal client with configuration."""
    app = db.scalar(select(App).where(App.client_id == PORTAL_CLIENT_ID))
    if app is None:
        raise RuntimeError("Portal app missing; run `alembic upgrade head`")
    app.launch_url = settings.portal_url
    app.redirect_uris = [settings.portal_redirect_uri]
    app.post_logout_redirect_uris = [settings.portal_url]
    if not verify_secret(app.client_secret_hash, settings.portal_client_secret):
        app.client_secret_hash = hash_secret(settings.portal_client_secret)
    db.commit()


def bootstrap(db: Session, settings: Settings) -> None:
    ensure_active_key(db, settings.key_encryption_key)
    ensure_portal_app(db, settings)
