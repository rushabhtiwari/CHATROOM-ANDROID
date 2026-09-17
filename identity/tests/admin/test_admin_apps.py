from sqlalchemy import select

from app.models import App
from tests.factories import grant_department, make_app, make_department, make_user
from tests.oidc_helpers import portal_token

APP_BODY = {
    "slug": "invoicing",
    "name": "Invoicing",
    "launch_url": "https://invoicing.yourco.com",
    "redirect_uris": ["https://invoicing.yourco.com/api/auth/callback/identity"],
    "post_logout_redirect_uris": ["https://invoicing.yourco.com/"],
    "roles": [
        {"key": "viewer", "label": "Viewer", "rank": 10},
        {"key": "manager", "label": "Manager", "rank": 30},
    ],
}


def test_non_admin_gets_403_and_anonymous_401(client, db, settings):
    token = portal_token(client, db, make_user(db), settings)
    assert (
        client.get("/admin/apps", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    )
    assert client.get("/admin/apps", headers={"Authorization": ""}).status_code == 401


def test_register_app_returns_secret_once(api, audited):
    created = api.post("/admin/apps", json=APP_BODY)

    assert created.status_code == 201, created.text
    assert created.json()["client_id"] == "invoicing"
    assert len(created.json()["client_secret"]) > 30
    detail = api.get(f"/admin/apps/{created.json()['id']}").json()
    assert "client_secret" not in detail
    assert [r["key"] for r in detail["roles"]] == ["viewer", "manager"]
    assert api.post("/admin/apps", json=APP_BODY).status_code == 409
    assert audited("app_created")


def test_register_app_rejects_insecure_uris_and_duplicate_ranks(api):
    insecure = APP_BODY | {"slug": "crm", "redirect_uris": ["http://crm.yourco.com/cb"]}
    duplicate_rank = APP_BODY | {
        "slug": "crm",
        "roles": [{"key": "a", "label": "A", "rank": 10}, {"key": "b", "label": "B", "rank": 10}],
    }
    assert api.post("/admin/apps", json=insecure).status_code == 422
    assert api.post("/admin/apps", json=duplicate_rank).status_code == 422


def test_update_and_disable_app(api, db):
    app, _ = make_app(db, slug="crm")
    response = api.patch(f"/admin/apps/{app.id}", json={"name": "CRM", "status": "disabled"})
    assert response.status_code == 200
    assert (response.json()["name"], response.json()["status"]) == ("CRM", "disabled")


def test_rotate_secret(api, db, audited):
    app, _ = make_app(db, slug="crm")
    response = api.post(f"/admin/apps/{app.id}/rotate-secret")
    assert response.status_code == 200
    assert response.json()["client_id"] == "crm"
    assert audited("app_secret_rotated")


def test_portal_app_is_protected(api, db):
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    assert api.patch(f"/admin/apps/{portal.id}", json={"status": "disabled"}).status_code == 409
    assert api.post(f"/admin/apps/{portal.id}/rotate-secret").status_code == 409


def test_role_crud_and_delete_blocked_while_referenced(api, db):
    app, roles = make_app(db)
    grant_department(db, make_department(db), app, roles["viewer"])
    roles_url = f"/admin/apps/{app.id}/roles"

    created = api.post(roles_url, json={"key": "auditor", "label": "Auditor", "rank": 15})
    clash = api.post(roles_url, json={"key": "x", "label": "X", "rank": 15})
    renamed = api.patch(f"/admin/app-roles/{created.json()['id']}", json={"label": "Audit"})

    assert created.status_code == 201 and clash.status_code == 409
    assert renamed.json()["label"] == "Audit"
    assert api.delete(f"/admin/app-roles/{roles['viewer'].id}").status_code == 409
    assert api.delete(f"/admin/app-roles/{roles['manager'].id}").status_code == 204
