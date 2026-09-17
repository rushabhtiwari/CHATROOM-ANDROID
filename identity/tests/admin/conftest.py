import pytest
from sqlalchemy import select

from app.models import AuditLog
from tests.factories import make_user
from tests.oidc_helpers import portal_token


@pytest.fixture
def admin(db):
    return make_user(db, email="admin@yourco.com", is_admin=True)


@pytest.fixture
def api(client, db, settings, admin):
    """Test client authenticated as an admin via a real portal access token."""
    client.headers["Authorization"] = f"Bearer {portal_token(client, db, admin, settings)}"
    return client


@pytest.fixture
def audited(db):
    def check(event: str) -> bool:
        return db.scalar(select(AuditLog).where(AuditLog.event == event)) is not None

    return check
