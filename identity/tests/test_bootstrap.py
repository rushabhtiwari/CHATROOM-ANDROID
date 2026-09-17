from sqlalchemy import select

from app.access import resolve_role
from app.bootstrap import bootstrap
from app.models import App
from app.security import verify_secret
from tests.factories import make_user


def test_bootstrap_syncs_portal_client_from_settings(db, settings):
    bootstrap(db, settings)
    bootstrap(db, settings)
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    assert portal.redirect_uris == ["http://localhost:3000/api/auth/callback/identity"]
    assert portal.post_logout_redirect_uris == ["http://localhost:3000"]
    assert verify_secret(portal.client_secret_hash, settings.portal_client_secret)


def test_portal_is_available_to_every_active_user(db, settings):
    bootstrap(db, settings)
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    assert resolve_role(db, make_user(db), portal).key == "user"
    assert resolve_role(db, make_user(db, status="suspended"), portal) is None
