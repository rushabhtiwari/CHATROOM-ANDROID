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

from collections.abc import Iterator  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.bootstrap import bootstrap  # noqa: E402
from app.config import Settings, get_settings  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import create_app  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def engine():
    url = os.environ["TEST_DATABASE_URL"]
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine) -> Iterator[Session]:
    """A session whose commits are rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def settings() -> Settings:
    return get_settings()


@pytest.fixture
def make_client(db, settings):
    """Build a TestClient bound to the per-test session; kwargs override settings (env names)."""

    def factory(**setting_overrides: str) -> TestClient:
        previous = {key.upper(): os.environ.get(key.upper()) for key in setting_overrides}
        os.environ.update({key.upper(): value for key, value in setting_overrides.items()})
        get_settings.cache_clear()
        try:
            app = create_app(run_bootstrap=False)
            app_settings = get_settings()
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            get_settings.cache_clear()
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_settings] = lambda: app_settings
        return TestClient(app, base_url=settings.issuer_url, follow_redirects=False)

    bootstrap(db, settings)
    return factory


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()
