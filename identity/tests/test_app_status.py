from sqlalchemy import select

from app.models import App, Department
from tests.factories import add_to_department, make_user
from tests.oidc_helpers import auth_request, portal_token, sign_in

COMPANY_TOOLS = ["automation", "chat", "projects", "requisitions"]


def _department(db, slug):
    return db.scalar(select(Department).where(Department.slug == slug))


def test_my_apps_include_coming_soon_apps_with_catalog_fields(client, db, settings):
    person = make_user(db)
    add_to_department(db, person, _department(db, "dispatch"))
    token = portal_token(client, db, person, settings)

    apps = client.get("/me/apps", headers={"Authorization": f"Bearer {token}"}).json()

    assert sorted(a["slug"] for a in apps) == sorted(["dispatch", *COMPANY_TOOLS])
    dispatch = next(a for a in apps if a["slug"] == "dispatch")
    assert dispatch == {
        "slug": "dispatch",
        "name": "Dispatch",
        "description": "Dispatch plans, POD and GRN follow-up",
        "category": "department",
        "status": "coming_soon",
        "icon": "truck",
        "logo_version": None,
        "launch_url": "",
        "role": "member",
    }


def test_disabled_apps_are_hidden_from_my_apps(client, db, settings):
    person = make_user(db)
    add_to_department(db, person, _department(db, "hr"))
    db.scalar(select(App).where(App.slug == "chat")).status = "disabled"
    db.commit()
    token = portal_token(client, db, person, settings)

    slugs = {
        a["slug"]
        for a in client.get("/me/apps", headers={"Authorization": f"Bearer {token}"}).json()
    }

    assert "chat" not in slugs and "hr" in slugs


def test_coming_soon_apps_cannot_sign_anyone_in(client, db):
    person = make_user(db)
    add_to_department(db, person, _department(db, "sales"))
    sign_in(client, db, person)
    app = db.scalar(select(App).where(App.slug == "sales"))
    app.redirect_uris = ["https://sales.yourco.com/callback"]
    db.commit()

    response = client.get("/authorize", params=auth_request(app).params)

    assert response.status_code == 400
    assert "location" not in response.headers
