from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import full_login, sign_in


def _member(db):
    user = make_user(db)
    dept = make_department(db)
    add_to_department(db, user, dept)
    app, roles = make_app(db, slug="invoicing")
    grant_department(db, dept, app, roles["editor"])
    return user, app


def test_userinfo_returns_claims_for_access_token(client, db):
    user, app = _member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)

    response = client.get(
        "/userinfo", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == user.email
    assert response.json()["role"] == "editor"


def test_userinfo_rejects_id_token_and_garbage(client, db):
    user, app = _member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    for bad in (tokens["id_token"], "garbage"):
        response = client.get("/userinfo", headers={"Authorization": f"Bearer {bad}"})
        assert response.status_code == 401


def test_userinfo_rejects_revoked_session(client, db):
    user, app = _member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    client.get("/logout")
    response = client.get(
        "/userinfo", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert response.status_code == 401
