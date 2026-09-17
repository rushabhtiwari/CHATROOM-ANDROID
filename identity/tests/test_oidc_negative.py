from datetime import timedelta

from sqlalchemy import select

from app.models import AuthorizationCode
from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import (
    auth_request,
    authorize_code,
    exchange_code,
    query_of,
    refresh,
    sign_in,
)


def _setup(db, client):
    user = make_user(db)
    dept = make_department(db)
    add_to_department(db, user, dept)
    app, roles = make_app(db, slug="crm")
    grant_department(db, dept, app, roles["viewer"])
    sign_in(client, db, user)
    return app


def test_unknown_client_renders_error_without_redirect(client, db):
    app = _setup(db, client)
    response = client.get("/authorize", params=auth_request(app, client_id="nope").params)
    assert response.status_code == 400
    assert "location" not in response.headers


def test_unregistered_redirect_uri_never_redirects(client, db):
    app = _setup(db, client)
    params = auth_request(app, redirect_uri="https://evil.example/callback").params
    response = client.get("/authorize", params=params)
    assert response.status_code == 400
    assert "location" not in response.headers


def test_redirect_uri_must_match_exactly(client, db):
    app = _setup(db, client)
    params = auth_request(app, redirect_uri=app.redirect_uris[0] + "/extra").params
    assert client.get("/authorize", params=params).status_code == 400


def test_missing_pkce_is_rejected_via_redirect(client, db):
    app = _setup(db, client)
    params = auth_request(app, code_challenge=None, code_challenge_method=None).params
    response = client.get("/authorize", params=params)
    assert response.status_code == 302
    assert query_of(response.headers["location"])["error"] == "invalid_request"


def test_plain_pkce_is_rejected(client, db):
    app = _setup(db, client)
    params = auth_request(app, code_challenge_method="plain").params
    response = client.get("/authorize", params=params)
    assert query_of(response.headers["location"])["error"] == "invalid_request"


def test_missing_nonce_is_rejected(client, db):
    app = _setup(db, client)
    response = client.get("/authorize", params=auth_request(app, nonce=None).params)
    assert query_of(response.headers["location"])["error"] == "invalid_request"


def test_wrong_code_verifier(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    response = exchange_code(client, app, code, request, code_verifier="x" * 64)
    assert response.json()["error"] == "invalid_grant"


def test_missing_code_verifier(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    response = exchange_code(client, app, code, request, code_verifier=None)
    assert response.json()["error"] == "invalid_request"


def test_wrong_client_secret(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    response = exchange_code(client, app, code, request, secret="wrong")
    assert response.status_code == 401
    assert response.json()["error"] == "invalid_client"


def test_redirect_uri_mismatch_at_token(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    other_uri = "https://crm.yourco.com/other"
    response = exchange_code(client, app, code, request, redirect_uri=other_uri)
    assert response.json()["error"] == "invalid_grant"


def test_expired_code(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    row = db.scalar(select(AuthorizationCode))
    row.expires_at = row.expires_at - timedelta(minutes=5)
    db.commit()
    assert exchange_code(client, app, code, request).json()["error"] == "invalid_grant"


def test_code_reuse_fails_and_revokes_issued_tokens(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    tokens = exchange_code(client, app, code, request).json()

    second = exchange_code(client, app, code, request)

    assert second.json()["error"] == "invalid_grant"
    assert refresh(client, app, tokens["refresh_token"]).json()["error"] == "invalid_grant"


def test_disabled_app_is_refused(client, db):
    app = _setup(db, client)
    app.status = "disabled"
    db.commit()
    assert client.get("/authorize", params=auth_request(app).params).status_code == 400
