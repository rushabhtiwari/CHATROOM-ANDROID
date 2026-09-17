from datetime import timedelta

from sqlalchemy import select

from app.models import AuthSession
from app.security import utcnow
from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import sign_in


def test_user_detail_explains_effective_access(api, db):
    user = make_user(db)
    sales = make_department(db, "field-sales")
    add_to_department(db, user, sales)
    crm, crm_roles = make_app(db, slug="crm")
    inv, inv_roles = make_app(db, slug="invoicing")
    grant_department(db, sales, crm, crm_roles["manager"])

    created = api.post(
        f"/admin/users/{user.id}/overrides",
        json={
            "app_id": str(inv.id),
            "effect": "grant",
            "app_role_id": str(inv_roles["viewer"].id),
            "reason": "Quarter close",
            "expires_at": (utcnow() + timedelta(days=30)).isoformat(),
        },
    )
    detail = api.get(f"/admin/users/{user.id}").json()

    assert created.status_code == 201, created.text
    access = {a["app_slug"]: a for a in detail["access"]}
    assert (access["crm"]["role"], access["crm"]["reason"]) == ("manager", "department")
    assert access["crm"]["department_slug"] == "field-sales"
    assert (access["invoicing"]["role"], access["invoicing"]["reason"]) == (
        "viewer",
        "override_grant",
    )
    assert detail["overrides"][0]["active"] is True


def test_override_rules(api, db):
    user = make_user(db)
    app, roles = make_app(db)
    _, other_roles = make_app(db)
    url = f"/admin/users/{user.id}/overrides"
    base = {"app_id": str(app.id), "reason": "r"}
    wrong_app_role = base | {"effect": "grant", "app_role_id": str(other_roles["viewer"].id)}

    assert api.post(url, json=base | {"effect": "grant"}).status_code == 422
    assert api.post(url, json=wrong_app_role).status_code == 422
    first = api.post(url, json=base | {"effect": "deny"})
    assert first.status_code == 201
    assert api.post(url, json=base | {"effect": "deny"}).status_code == 409
    switched = api.patch(
        f"/admin/overrides/{first.json()['id']}",
        json={"effect": "grant", "app_role_id": str(roles["editor"].id)},
    )
    assert switched.json()["effect"] == "grant"
    assert api.delete(f"/admin/overrides/{first.json()['id']}").status_code == 204


def test_suspend_revokes_sessions_and_blocks_self_suspend(api, db, admin, audited):
    user = make_user(db)
    sign_in(api, db, user)
    api.cookies.clear()

    response = api.patch(f"/admin/users/{user.id}", json={"status": "suspended"})

    assert response.json()["status"] == "suspended"
    assert db.scalar(select(AuthSession).where(AuthSession.user_id == user.id)).revoked_at
    assert audited("user_suspended")
    assert api.patch(f"/admin/users/{admin.id}", json={"status": "suspended"}).status_code == 409


def test_replace_departments_and_list_filter(api, db):
    user = make_user(db, email="zed@yourco.com")
    sales = make_department(db, "field-sales")

    response = api.put(
        f"/admin/users/{user.id}/departments", json={"department_ids": [str(sales.id)]}
    )

    assert response.json()["department_slugs"] == ["field-sales"]
    listed = api.get("/admin/users", params={"department": "field-sales"}).json()
    assert [u["email"] for u in listed] == ["zed@yourco.com"]
    assert api.get("/admin/users", params={"query": "ZED"}).json()[0]["id"] == str(user.id)


def test_sign_out_everywhere(api, db, audited):
    user = make_user(db)
    sign_in(api, db, user)
    api.cookies.clear()
    assert api.post(f"/admin/users/{user.id}/signout").status_code == 204
    assert db.scalar(select(AuthSession).where(AuthSession.user_id == user.id)).revoked_at
    assert audited("user_signed_out_everywhere")
