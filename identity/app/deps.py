import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.bootstrap import PORTAL_CLIENT_ID
from app.config import Settings, get_settings
from app.db import get_db
from app.keys import public_key_set
from app.models import User
from app.oauth.tokens import InvalidToken, verify_access_token


def current_user(
    request: Request, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> User:
    """User from a portal access token (aud=portal). Spec §6."""
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Missing bearer token", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = verify_access_token(
            token, public_key_set(db), settings.issuer_url, audience=PORTAL_CLIENT_ID
        )
    except InvalidToken:
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"}) from None
    user = db.get(User, uuid.UUID(claims["sub"]))
    if user is None or user.status != "active":
        raise HTTPException(401, "Inactive user", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Admin access required")
    return user
