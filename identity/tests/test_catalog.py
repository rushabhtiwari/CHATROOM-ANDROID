import os
import uuid

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

from app.models import App, AppRole
from tests.conftest import ROOT

CATALOG = {
    "sales": ("Sales", "department", "trending-up"),
    "dispatch": ("Dispatch", "department", "truck"),
    "accounts": ("Accounts", "department", "book-open"),
    "finance": ("Finance", "department", "landmark"),
    "marketing": ("Marketing & RFQ", "department", "megaphone"),
    "purchase": ("Purchase & Procurement", "department", "shopping-cart"),
    "hr": ("HR", "department", "users"),
    "production": ("Production", "department", "factory"),
    "quality": ("Quality", "department", "badge-check"),
    "requisitions": ("Requisitions & Budget", "company", "clipboard-check"),
    "projects": ("Projects", "company", "kanban"),
    "automation": ("Automation", "company", "zap"),
    "chat": ("Chat", "company", "message-circle"),
}


def _app(db, slug: str) -> App:
    return db.scalar(select(App).where(App.slug == slug))


def test_catalog_apps_are_seeded_as_coming_soon(db):
    for slug, (name, category, icon) in CATALOG.items():
        app = _app(db, slug)
        assert (app.name, app.category, app.icon, app.status) == (
            name,
            category,
            icon,
            "coming_soon",
        )
        assert app.client_id == slug
        assert app.launch_url == "" and app.redirect_uris == []
        roles = db.scalars(select(AppRole).where(AppRole.app_id == app.id).order_by(AppRole.rank))
        assert [(r.key, r.rank) for r in roles] == [("member", 10), ("manager", 30)]


def test_existing_apps_default_to_department_category(db):
    portal = _app(db, "portal")
    assert (portal.category, portal.status) == ("department", "active")


def test_logo_requires_content_type(db):
    app = _app(db, "chat")
    app.logo = b"\x89PNG"
    with pytest.raises(IntegrityError):
        db.flush()


def test_seed_leaves_existing_departments_and_apps_alone():
    """Upgrading a database that already has a `sales` department and app keeps them."""
    base = make_url(os.environ["TEST_DATABASE_URL"])
    name = f"identity_migration_{uuid.uuid4().hex[:8]}"
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    url = base.set(database=name).render_as_string(hide_password=False)
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.attributes["database_url"] = url
    engine = create_engine(url)
    try:
        command.upgrade(config, "0001")
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO departments (id, slug, name) "
                    "VALUES (gen_random_uuid(), 'sales', 'Field sales')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO apps (id, slug, name, description, icon, launch_url, "
                    "client_id, client_secret_hash, redirect_uris, post_logout_redirect_uris, "
                    "status, is_system) "
                    "VALUES (gen_random_uuid(), 'chat', 'Team chat', '', '', "
                    "'https://chat.yourco.com', 'chat', '!', "
                    "'{}', '{}', 'active', false)"
                )
            )

        command.upgrade(config, "head")

        with engine.connect() as conn:
            assert (
                conn.scalar(text("SELECT name FROM departments WHERE slug = 'sales'"))
                == "Field sales"
            )
            chat = conn.execute(
                text("SELECT name, status, category FROM apps WHERE slug = 'chat'")
            ).one()
            assert tuple(chat) == ("Team chat", "active", "department")
            assert (
                conn.scalar(
                    text(
                        "SELECT count(*) FROM app_roles r JOIN apps a ON a.id = r.app_id "
                        "WHERE a.slug = 'chat'"
                    )
                )
                == 0
            )
            assert conn.scalar(text("SELECT count(*) FROM apps WHERE status = 'coming_soon'")) == 12
    finally:
        engine.dispose()
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()
