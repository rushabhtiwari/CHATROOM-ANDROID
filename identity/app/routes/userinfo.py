import uuid

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.keys import public_key_set
from app.models import AuthSession, User
from app.oauth.tokens import InvalidToken, verify_access_token
from app.sessions import is_session_active

router = APIRouter()


@router.get("/userinfo")
@router.post("/userinfo", operation_id="userinfo_post")
def userinfo(
    request: Request, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> Response:
    scheme, _, raw = request.headers.get("authorization", "").partition(" ")
    unauthorized = JSONResponse(
        {"error": "invalid_token"},
        status_code=401,
        headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
    )
    if scheme.lower() != "bearer" or not raw:
        return unauthorized
    try:
        claims = verify_access_token(raw, public_key_set(db), settings.issuer_url, audience=None)
    except InvalidToken:
        return unauthorized
    user = db.get(User, uuid.UUID(claims["sub"]))
    auth_session = db.get(AuthSession, uuid.UUID(claims["sid"]))
    if user is None or user.status != "active":
        return unauthorized
    if auth_session is None or not is_session_active(auth_session):
        return unauthorized
    return JSONResponse(
        {
            "sub": str(user.id),
            "email": user.email,
            "name": user.name,
            "picture": user.avatar_url,
            "role": claims["role"],
            "sid": claims["sid"],
        }
    )
