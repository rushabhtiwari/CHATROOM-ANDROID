"""Migration 0003 registers the PACT Automation module (`modules/pact-automation/`)."""

from sqlalchemy import select

from app.models import App, AppRole, Department
from tests.factories import add_to_department, make_user
from tests.oidc_helpers import portal_token

SLUG = "pact-automation"


def _department(db, slug: str) -> Department:
    return db.scalar(select(Department).where(Department.slug == slug))


def _my_app_slugs(client, token) -> set[str]:
    apps = client.get("/me/apps", headers={"Authorization": f"Bearer {token}"}).json()
    return {a["slug"] for a in apps}


def test_pact_automation_is_registered_live_on_the_local_console(db):
    app = db.scalar(select(App).where(App.slug == SLUG))

    assert (app.name, app.category, app.icon, app.status) == (
        "PACT Automation",
        "company",
        "receipt",
        "active",
    )
    assert app.client_id == SLUG and app.is_system is False
    assert app.launch_url == "http://localhost:5173"
    # Live apps must carry an address and one callback URL; the module has no sign-in yet, so
    # the secret stays unusable.
    assert app.redirect_uris == ["http://localhost:5173/api/auth/callback/identity"]
    assert app.client_secret_hash == "!"
    roles = db.scalars(select(AppRole).where(AppRole.app_id == app.id).order_by(AppRole.rank))
    assert [(r.key, r.rank) for r in roles] == [("member", 10), ("manager", 30)]


def test_purchase_and_accounts_can_open_it_and_other_departments_cannot(client, db, settings):
    for department in ("purchase", "accounts"):
        person = make_user(db)
        add_to_department(db, person, _department(db, department))
        token = portal_token(client, db, person, settings)

        assert SLUG in _my_app_slugs(client, token), department

    outsider = make_user(db)
    add_to_department(db, outsider, _department(db, "dispatch"))

    assert SLUG not in _my_app_slugs(client, portal_token(client, db, outsider, settings))


def test_the_tile_carries_the_console_url(client, db, settings):
    person = make_user(db)
    add_to_department(db, person, _department(db, "purchase"))
    token = portal_token(client, db, person, settings)

    apps = client.get("/me/apps", headers={"Authorization": f"Bearer {token}"}).json()
    pact = next(a for a in apps if a["slug"] == SLUG)

    assert (pact["status"], pact["launch_url"], pact["role"]) == (
        "active",
        "http://localhost:5173",
        "member",
    )
