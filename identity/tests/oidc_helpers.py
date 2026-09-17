import secrets
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

from authlib.oauth2.rfc7636 import create_s256_code_challenge
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import App, User
from app.sessions import SESSION_COOKIE, create_session
from tests.factories import CLIENT_SECRET


@dataclass
class AuthRequest:
    params: dict[str, str]
    verifier: str


def sign_in(client: TestClient, db: Session, user: User) -> str:
    """Give the test browser an identity-service session cookie."""
    auth_session, token = create_session(db, user)
    db.commit()
    client.cookies.set(SESSION_COOKIE, token)
    return str(auth_session.id)


def auth_request(app: App, **overrides: str | None) -> AuthRequest:
    verifier = secrets.token_urlsafe(48)
    params = {
        "response_type": "code",
        "client_id": app.client_id,
        "redirect_uri": app.redirect_uris[0],
        "scope": "openid email profile",
        "state": "state-123",
        "nonce": secrets.token_urlsafe(16),
        "code_challenge": create_s256_code_challenge(verifier),
        "code_challenge_method": "S256",
    }
    for key, value in overrides.items():
        if value is None:
            params.pop(key, None)
        else:
            params[key] = value
    return AuthRequest(params=params, verifier=verifier)


def query_of(location: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlsplit(location).query).items()}


def authorize_code(client: TestClient, app: App) -> tuple[str, AuthRequest]:
    request = auth_request(app)
    response = client.get("/authorize", params=request.params)
    assert response.status_code == 302, response.text
    query = query_of(response.headers["location"])
    assert query["state"] == "state-123"
    return query["code"], request


def exchange_code(
    client: TestClient,
    app: App,
    code: str,
    request: AuthRequest,
    secret: str = CLIENT_SECRET,
    **overrides: str | None,
):
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": request.params["redirect_uri"],
        "code_verifier": request.verifier,
    }
    for key, value in overrides.items():
        if value is None:
            data.pop(key, None)
        else:
            data[key] = value
    return client.post("/token", data=data, auth=(app.client_id, secret))


def refresh(client: TestClient, app: App, refresh_token: str, secret: str = CLIENT_SECRET):
    return client.post(
        "/token",
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        auth=(app.client_id, secret),
    )


def full_login(client: TestClient, app: App, secret: str = CLIENT_SECRET) -> dict:
    code, request = authorize_code(client, app)
    response = exchange_code(client, app, code, request, secret=secret)
    assert response.status_code == 200, response.text
    return response.json() | {"nonce": request.params["nonce"]}


def portal_token(client: TestClient, db: Session, user: User, settings) -> str:
    """Access token for the portal client (aud=portal), as the portal's server would hold."""
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    sign_in(client, db, user)
    tokens = full_login(client, portal, secret=settings.portal_client_secret)
    client.cookies.clear()
    return tokens["access_token"]
