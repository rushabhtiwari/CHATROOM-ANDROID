from joserfc import jwt
from joserfc.jwk import KeySet
from sqlalchemy import select

from app.models import AuditLog, User
from tests.factories import (
    add_override,
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import auth_request, full_login, refresh, sign_in


def _app_with_member(db, role="editor"):
    user = make_user(db, name="Priya Sharma")
    dept = make_department(db)
    add_to_department(db, user, dept)
    app, roles = make_app(db, slug="invoicing")
    grant_department(db, dept, app, roles[role])
    return user, app, roles


def _decode(client, token):
    keys = KeySet.import_key_set(client.get("/jwks").json())
    return jwt.decode(token, keys, algorithms=["RS256"])


def test_discovery_document(client, settings):
    doc = client.get("/.well-known/openid-configuration").json()
    assert doc["issuer"] == settings.issuer_url
    assert doc["jwks_uri"] == f"{settings.issuer_url}/jwks"
    assert doc["code_challenge_methods_supported"] == ["S256"]


def test_jwks_is_cacheable_and_public_only(client):
    response = client.get("/jwks")
    assert response.headers["cache-control"] == "public, max-age=300"
    [key] = response.json()["keys"]
    assert key["kty"] == "RSA" and "d" not in key


def test_unauthenticated_authorize_redirects_to_login(client, db):
    _, app, _ = _app_with_member(db)
    response = client.get("/authorize", params=auth_request(app).params)
    assert response.status_code == 303
    assert response.headers["location"] == "/login"


def test_code_flow_issues_tokens_with_app_role(client, db, settings):
    user, app, _ = _app_with_member(db, role="editor")
    sid = sign_in(client, db, user)

    tokens = full_login(client, app)

    assert tokens["token_type"] == "Bearer"
    assert tokens["expires_in"] == 900
    id_token = _decode(client, tokens["id_token"])
    assert id_token.header["kid"]
    assert id_token.claims["iss"] == settings.issuer_url
    assert id_token.claims["aud"] == "invoicing"
    assert id_token.claims["sub"] == str(user.id)
    assert id_token.claims["email"] == user.email
    assert id_token.claims["role"] == "editor"
    assert id_token.claims["sid"] == sid
    assert id_token.claims["nonce"] == tokens["nonce"]
    assert id_token.claims["exp"] - id_token.claims["iat"] == 900

    access = _decode(client, tokens["access_token"])
    assert access.header["typ"] == "at+jwt"
    assert access.claims["aud"] == "invoicing"
    assert access.claims["role"] == "editor"
    assert access.claims["sid"] == sid


def test_second_app_login_is_silent_with_existing_session(client, db):
    user, app, _ = _app_with_member(db)
    sign_in(client, db, user)
    full_login(client, app)
    full_login(client, app)


def test_no_access_shows_page_and_audits(client, db):
    user = make_user(db)
    app, _ = make_app(db, name="Invoicing")
    sign_in(client, db, user)

    response = client.get("/authorize", params=auth_request(app).params)

    assert response.status_code == 403
    assert "You don&#39;t have access to Invoicing" in response.text
    denied = select(AuditLog).where(
        AuditLog.event == "access_denied", AuditLog.subject_user_id == user.id
    )
    assert db.scalar(denied)


def test_refresh_rotates_and_reflects_role_changes(client, db):
    user, app, roles = _app_with_member(db, role="editor")
    sign_in(client, db, user)
    tokens = full_login(client, app)
    add_override(db, user, app, "grant", roles["manager"])
    db.commit()

    response = refresh(client, app, tokens["refresh_token"])

    assert response.status_code == 200, response.text
    new = response.json()
    assert new["refresh_token"] != tokens["refresh_token"]
    assert _decode(client, new["access_token"]).claims["role"] == "manager"


def test_refresh_fails_after_access_removed(client, db):
    user, app, _ = _app_with_member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    add_override(db, user, app, "deny")
    db.commit()

    response = refresh(client, app, tokens["refresh_token"])

    assert response.status_code == 400
    assert response.json()["error"] == "invalid_grant"


def test_refresh_fails_after_suspension(client, db):
    user, app, _ = _app_with_member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    db.get(User, user.id).status = "suspended"
    db.commit()

    assert refresh(client, app, tokens["refresh_token"]).json()["error"] == "invalid_grant"


def test_refresh_reuse_revokes_family(client, db):
    user, app, _ = _app_with_member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    rotated = refresh(client, app, tokens["refresh_token"]).json()

    reuse = refresh(client, app, tokens["refresh_token"])

    assert reuse.json()["error"] == "invalid_grant"
    assert refresh(client, app, rotated["refresh_token"]).json()["error"] == "invalid_grant"
    assert db.scalar(select(AuditLog).where(AuditLog.event == "refresh_reuse_detected"))


def test_refresh_token_bound_to_client(client, db):
    user, app, _ = _app_with_member(db)
    other, _ = make_app(db, slug="crm")
    sign_in(client, db, user)
    tokens = full_login(client, app)

    assert refresh(client, other, tokens["refresh_token"]).json()["error"] == "invalid_grant"
