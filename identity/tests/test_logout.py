from sqlalchemy import select

from app.models import AuthSession
from app.sessions import SESSION_COOKIE
from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import full_login, refresh, sign_in


def _logged_in(client, db):
    user = make_user(db)
    dept = make_department(db)
    add_to_department(db, user, dept)
    crm, crm_roles = make_app(db, slug="crm")
    sales, sales_roles = make_app(db, slug="sales")
    grant_department(db, dept, crm, crm_roles["viewer"])
    grant_department(db, dept, sales, sales_roles["viewer"])
    sign_in(client, db, user)
    return user, crm, sales, full_login(client, crm), full_login(client, sales)


def test_logout_revokes_session_and_all_apps_refresh_tokens(client, db):
    user, crm, sales, crm_tokens, sales_tokens = _logged_in(client, db)

    response = client.get(
        "/logout",
        params={
            "id_token_hint": crm_tokens["id_token"],
            "post_logout_redirect_uri": "https://crm.yourco.com/",
            "state": "abc",
        },
    )

    assert response.status_code == 303
    assert response.headers["location"] == "https://crm.yourco.com/?state=abc"
    assert f'{SESSION_COOKIE}=""' in response.headers["set-cookie"]
    assert db.scalar(select(AuthSession).where(AuthSession.user_id == user.id)).revoked_at
    assert refresh(client, crm, crm_tokens["refresh_token"]).json()["error"] == "invalid_grant"
    assert refresh(client, sales, sales_tokens["refresh_token"]).json()["error"] == "invalid_grant"


def test_logout_rejects_unregistered_redirect(client, db):
    _, _, _, crm_tokens, _ = _logged_in(client, db)
    response = client.get(
        "/logout",
        params={
            "id_token_hint": crm_tokens["id_token"],
            "post_logout_redirect_uri": "https://evil.example/",
        },
    )
    assert response.status_code == 400
    assert "location" not in response.headers


def test_logout_without_redirect_shows_page(client, db):
    _logged_in(client, db)
    response = client.get("/logout")
    assert response.status_code == 200
    assert "You have signed out" in response.text


def test_logout_rejects_forged_hint(client, db):
    _logged_in(client, db)
    assert client.get("/logout", params={"id_token_hint": "a.b.c"}).status_code == 400
