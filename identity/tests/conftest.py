import os

os.environ.setdefault(
    "TEST_DATABASE_URL", "postgresql+psycopg://central:central@localhost:5433/identity_test"
)
os.environ.update(
    ENVIRONMENT="test",
    DATABASE_URL=os.environ["TEST_DATABASE_URL"],
    COMPANY_DOMAIN="yourco.com",
    ISSUER_URL="http://localhost:8000",
    KEY_ENCRYPTION_KEY="uB0yq0lqV3m7vJx9I6kzvJ6o4wqkJ7mYwR2fT5bq8nE=",
    SESSION_SECRET="test-session-secret",
    INITIAL_ADMIN_EMAILS="boss@yourco.com",
    PORTAL_URL="http://localhost:3000",
    PORTAL_CLIENT_SECRET="portal-secret",
    DEV_LOGIN_ENABLED="false",
)

import pytest  # noqa: E402

from app.config import Settings, get_settings  # noqa: E402


@pytest.fixture
def settings() -> Settings:
    return get_settings()
