"""Turning a verified upstream identity into a user and a browser session. See spec §5.2."""

import uuid
from dataclasses import dataclass

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings
from app.models import AuthSession, User
from app.security import utcnow
from app.sessions import create_session


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    hd: str | None
    name: str
    picture: str | None


class LoginDenied(Exception):
    def __init__(self, reason: str):  # "wrong_domain" | "suspended" | "unknown_user"
        super().__init__(reason)
        self.reason = reason


def complete_google_login(
    db: Session, settings: Settings, identity: GoogleIdentity, request: Request | None = None
) -> tuple[AuthSession, str]:
    if identity.hd != settings.company_domain or not identity.email_verified:
        audit.record(
            db,
            "login_denied",
            request=request,
            detail={"reason": "wrong_domain", "email": identity.email, "hd": identity.hd},
        )
        db.commit()
        raise LoginDenied("wrong_domain")

    email = identity.email.lower()
    user = db.scalar(select(User).where(User.google_sub == identity.sub))
    if user is None:
        user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            google_sub=identity.sub,
            email=email,
            name=identity.name,
            avatar_url=identity.picture,
            status="active",
            is_admin=False,
        )
        db.add(user)
        db.flush()
        audit.record(db, "user_created", request=request, subject_user_id=user.id)
    else:
        user.google_sub = identity.sub
        user.email = email
        user.name = identity.name
        user.avatar_url = identity.picture

    return _start_session(db, settings, user, request)


def complete_dev_login(
    db: Session, settings: Settings, user_id: uuid.UUID, request: Request | None = None
) -> tuple[AuthSession, str]:
    user = db.get(User, user_id)
    if user is None:
        raise LoginDenied("unknown_user")
    return _start_session(db, settings, user, request)


def _start_session(
    db: Session, settings: Settings, user: User, request: Request | None
) -> tuple[AuthSession, str]:
    if user.email in settings.admin_emails and not user.is_admin:
        user.is_admin = True
        audit.record(db, "admin_bootstrapped", request=request, subject_user_id=user.id)

    if user.status != "active":
        audit.record(
            db,
            "login_denied",
            request=request,
            subject_user_id=user.id,
            detail={"reason": "suspended"},
        )
        db.commit()
        raise LoginDenied("suspended")

    user.last_login_at = utcnow()
    session, token = create_session(db, user)
    audit.record(db, "login", request=request, subject_user_id=user.id)
    db.commit()
    return session, token
