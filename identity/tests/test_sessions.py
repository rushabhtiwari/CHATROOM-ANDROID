import uuid
from datetime import timedelta

from app.models import RefreshToken
from app.security import hash_token, utcnow
from app.sessions import create_session, get_active_session, revoke_all_for_user, revoke_session
from tests.factories import make_user


def _refresh_row(db, auth_session):
    now = utcnow()
    row = RefreshToken(
        token_hash=hash_token(uuid.uuid4().hex),
        family_id=uuid.uuid4(),
        client_id="crm",
        user_id=auth_session.user_id,
        session_id=auth_session.id,
        scope="openid",
        created_at=now,
        expires_at=now + timedelta(hours=1),
        family_expires_at=now + timedelta(hours=2),
    )
    db.add(row)
    db.flush()
    return row


def test_create_and_lookup_session(db):
    user = make_user(db)
    auth_session, token = create_session(db, user)
    assert auth_session.token_hash != token
    assert get_active_session(db, token) == (auth_session, user)
    assert get_active_session(db, "wrong") is None
    assert get_active_session(db, None) is None


def test_idle_expired_session_is_inactive(db):
    user = make_user(db)
    auth_session, token = create_session(db, user)
    auth_session.idle_expires_at = utcnow() - timedelta(seconds=1)
    assert get_active_session(db, token) is None


def test_suspended_user_session_is_inactive(db):
    user = make_user(db)
    _, token = create_session(db, user)
    user.status = "suspended"
    assert get_active_session(db, token) is None


def test_revoke_session_revokes_its_refresh_tokens(db):
    user = make_user(db)
    auth_session, token = create_session(db, user)
    refresh = _refresh_row(db, auth_session)
    revoke_session(db, auth_session.id)
    db.expire_all()
    assert get_active_session(db, token) is None
    assert db.get(RefreshToken, refresh.id).revoked_at is not None


def test_revoke_all_for_user(db):
    user = make_user(db)
    first, _ = create_session(db, user)
    second, _ = create_session(db, user)
    _, other_token = create_session(db, make_user(db))
    revoke_all_for_user(db, user.id)
    db.expire_all()
    assert first.revoked_at and second.revoked_at
    assert get_active_session(db, other_token) is not None
