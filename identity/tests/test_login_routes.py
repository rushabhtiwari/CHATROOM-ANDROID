from fastapi.responses import RedirectResponse

from app.google import GoogleRejected, GoogleUnavailable, get_google_client
from app.login import GoogleIdentity
from app.sessions import SESSION_COOKIE
from tests.factories import make_app, make_user
from tests.oidc_helpers import auth_request


class FakeGoogle:
    def __init__(self, identity=None, error=None):
        self.identity, self.error = identity, error

    async def start(self, request):
        return RedirectResponse("https://accounts.google.com/o/oauth2/auth?fake=1", 302)

    async def finish(self, request):
        if self.error:
            raise self.error
        return self.identity


def _identity(**overrides):
    fields = dict(
        sub="g-1",
        email="priya@yourco.com",
        email_verified=True,
        hd="yourco.com",
        name="Priya",
        picture=None,
    )
    return GoogleIdentity(**(fields | overrides))


def _with_google(client, fake):
    client.app.dependency_overrides[get_google_client] = lambda: fake
    return client


def test_login_redirects_to_google_by_default(client):
    assert client.get("/login").headers["location"] == "/login/google"
    _with_google(client, FakeGoogle())
    assert client.get("/login/google").headers["location"].startswith("https://accounts.google")


def test_callback_sets_session_cookie_and_resumes_authorize(client, db):
    app, _ = make_app(db, slug="crm")
    _with_google(client, FakeGoogle(_identity()))
    params = auth_request(app).params
    assert client.get("/authorize", params=params).headers["location"] == "/login"

    response = client.get("/google/callback")

    assert response.status_code == 303
    assert response.headers["location"].startswith("/authorize?")
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=") and "HttpOnly" in cookie
    assert "samesite=lax" in cookie.lower()


def test_callback_without_pending_request_goes_to_portal(client, settings):
    _with_google(client, FakeGoogle(_identity()))
    assert client.get("/google/callback").headers["location"] == settings.portal_url


def test_callback_wrong_domain_page(client):
    _with_google(client, FakeGoogle(_identity(hd="gmail.com")))
    response = client.get("/google/callback")
    assert response.status_code == 403
    assert "Use your company Google account" in response.text
    assert "Reference:" in response.text


def test_callback_suspended_page(client, db):
    make_user(db, email="priya@yourco.com", google_sub="g-1", status="suspended")
    _with_google(client, FakeGoogle(_identity()))
    assert "Your account is suspended" in client.get("/google/callback").text


def test_google_unavailable_page(client):
    _with_google(client, FakeGoogle(error=GoogleUnavailable("down")))
    response = client.get("/google/callback")
    assert response.status_code == 503
    assert "Sign-in temporarily unavailable" in response.text


def test_google_rejected_page(client):
    _with_google(client, FakeGoogle(error=GoogleRejected("mismatching_state")))
    assert client.get("/google/callback").status_code == 400


def test_dev_login_disabled_by_default(client):
    assert client.get("/dev-login").status_code == 404


def test_dev_login_when_enabled(make_client, db):
    dev_client = make_client(dev_login_enabled="true")
    user = make_user(db, name="Dev Person")
    assert dev_client.get("/login").headers["location"] == "/dev-login"
    assert "Dev Person" in dev_client.get("/dev-login").text

    response = dev_client.post("/dev-login", data={"user_id": str(user.id)})

    assert response.status_code == 303
    assert response.headers["set-cookie"].startswith(f"{SESSION_COOKIE}=")
