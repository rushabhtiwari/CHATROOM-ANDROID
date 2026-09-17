from tests.factories import (
    add_override,
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import full_login, portal_token, sign_in


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_me_and_my_apps(client, db, settings):
    user = make_user(db, name="Priya")
    sales = make_department(db, "sales")
    add_to_department(db, user, sales)
    crm, crm_roles = make_app(db, slug="crm", name="CRM")
    invoicing, inv_roles = make_app(db, slug="invoicing", name="Invoicing")
    make_app(db, slug="finance")
    grant_department(db, sales, crm, crm_roles["manager"])
    add_override(db, user, invoicing, "grant", inv_roles["viewer"])
    token = portal_token(client, db, user, settings)

    me = client.get("/me", headers=_auth(token)).json()
    apps = client.get("/me/apps", headers=_auth(token)).json()

    assert me["email"] == user.email and me["is_admin"] is False
    assert [d["slug"] for d in me["departments"]] == ["sales"]
    assert [(a["slug"], a["role"]) for a in apps] == [("crm", "manager"), ("invoicing", "viewer")]


def test_me_requires_portal_audience(client, db):
    user = make_user(db)
    dept = make_department(db)
    add_to_department(db, user, dept)
    crm, roles = make_app(db, slug="crm")
    grant_department(db, dept, crm, roles["viewer"])
    sign_in(client, db, user)
    crm_token = full_login(client, crm)["access_token"]

    assert client.get("/me", headers=_auth(crm_token)).status_code == 401
    assert client.get("/me").status_code == 401


def test_suspended_user_token_rejected(client, db, settings):
    user = make_user(db)
    token = portal_token(client, db, user, settings)
    user.status = "suspended"
    db.commit()
    assert client.get("/me", headers=_auth(token)).status_code == 401
