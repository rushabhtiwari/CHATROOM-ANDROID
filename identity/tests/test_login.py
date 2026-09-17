import pytest
from sqlalchemy import select

from app.login import GoogleIdentity, LoginDenied, complete_google_login
from app.models import AuditLog, User
from tests.factories import make_user


def _identity(**overrides) -> GoogleIdentity:
    fields = dict(
        sub="google-1",
        email="Priya@yourco.com",
        email_verified=True,
        hd="yourco.com",
        name="Priya Sharma",
        picture="https://img/p.png",
    )
    fields.update(overrides)
    return GoogleIdentity(**fields)


def test_first_login_creates_user_without_access(db, settings):
    auth_session, token = complete_google_login(db, settings, _identity())
    user = db.scalar(select(User).where(User.google_sub == "google-1"))
    assert user.email == "priya@yourco.com"
    assert user.is_admin is False
    assert auth_session.user_id == user.id and token
    assert db.scalar(select(AuditLog).where(AuditLog.event == "user_created"))


def test_returning_user_profile_is_refreshed(db, settings):
    complete_google_login(db, settings, _identity())
    complete_google_login(db, settings, _identity(name="Priya S.", picture=None))
    user = db.scalar(select(User).where(User.google_sub == "google-1"))
    assert user.name == "Priya S." and user.avatar_url is None
    assert user.last_login_at is not None


def test_existing_user_is_linked_by_email(db, settings):
    existing = make_user(db, email="priya@yourco.com")
    complete_google_login(db, settings, _identity())
    assert db.get(User, existing.id).google_sub == "google-1"


@pytest.mark.parametrize(
    "identity",
    [_identity(hd="gmail.com"), _identity(hd=None), _identity(email_verified=False)],
)
def test_wrong_domain_or_unverified_is_denied(db, settings, identity):
    with pytest.raises(LoginDenied) as denied:
        complete_google_login(db, settings, identity)
    assert denied.value.reason == "wrong_domain"
    assert db.scalar(select(User)) is None
    assert db.scalar(select(AuditLog).where(AuditLog.event == "login_denied"))


def test_suspended_user_is_denied(db, settings):
    make_user(db, email="priya@yourco.com", google_sub="google-1", status="suspended")
    with pytest.raises(LoginDenied) as denied:
        complete_google_login(db, settings, _identity())
    assert denied.value.reason == "suspended"


def test_initial_admin_is_bootstrapped(db, settings):
    complete_google_login(db, settings, _identity(sub="g-boss", email="boss@yourco.com"))
    assert db.scalar(select(User).where(User.email == "boss@yourco.com")).is_admin is True
    assert db.scalar(select(AuditLog).where(AuditLog.event == "admin_bootstrapped"))
