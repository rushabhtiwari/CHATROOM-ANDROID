"""Browser sessions on the identity host. See spec §5.1, §5.6."""

import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import AuthSession, RefreshToken, User
from app.security import hash_token, new_token, utcnow

SESSION_COOKIE = "identity_session"
IDLE_TIMEOUT = timedelta(hours=12)
ABSOLUTE_TIMEOUT = timedelta(hours=24)


def create_session(db: Session, user: User) -> tuple[AuthSession, str]:
    token = new_token()
    now = utcnow()
    row = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        created_at=now,
        last_seen_at=now,
        idle_expires_at=now + IDLE_TIMEOUT,
        absolute_expires_at=now + ABSOLUTE_TIMEOUT,
    )
    db.add(row)
    db.flush()
    return row, token


def is_session_active(row: AuthSession) -> bool:
    now = utcnow()
    return row.revoked_at is None and row.idle_expires_at > now and row.absolute_expires_at > now


def get_active_session(db: Session, token: str | None) -> tuple[AuthSession, User] | None:
    if not token:
        return None
    row = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if row is None or not is_session_active(row):
        return None
    user = db.get(User, row.user_id)
    if user is None or user.status != "active":
        return None
    return row, user


def touch(row: AuthSession) -> None:
    now = utcnow()
    row.last_seen_at = now
    row.idle_expires_at = now + IDLE_TIMEOUT


def revoke_session(db: Session, session_id: uuid.UUID) -> None:
    now = utcnow()
    db.execute(
        update(AuthSession)
        .where(AuthSession.id == session_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.session_id == session_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def revoke_all_for_user(db: Session, user_id: uuid.UUID) -> None:
    now = utcnow()
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def revoke_family(db: Session, family_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
