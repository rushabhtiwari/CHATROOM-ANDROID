import uuid

from authlib.common.urls import add_params_to_uri
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings, get_settings
from app.db import get_db
from app.keys import public_key_set
from app.models import App, AuthSession
from app.oauth.tokens import InvalidToken, read_id_token_hint
from app.pages import render_message
from app.sessions import SESSION_COOKIE, get_active_session, revoke_session

router = APIRouter()


@router.get("/logout")
def logout(
    request: Request,
    id_token_hint: str | None = None,
    post_logout_redirect_uri: str | None = None,
    state: str | None = None,
    client_id: str | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    hint: dict = {}
    if id_token_hint:
        try:
            hint = read_id_token_hint(id_token_hint, public_key_set(db), settings.issuer_url)
        except InvalidToken:
            return render_message(
                request,
                400,
                "Sign-out link is invalid",
                "The sign-out request could not be verified.",
            )

    redirect_to = None
    if post_logout_redirect_uri:
        requested_client = hint.get("aud") or client_id
        if isinstance(requested_client, list):
            requested_client = requested_client[0] if requested_client else None
        app = None
        if requested_client:
            app = db.scalar(select(App).where(App.client_id == requested_client))
        if app is None or post_logout_redirect_uri not in app.post_logout_redirect_uris:
            return render_message(
                request,
                400,
                "Sign-out link is invalid",
                "The return address is not registered for this app.",
            )
        redirect_to = post_logout_redirect_uri
        if state:
            redirect_to = add_params_to_uri(redirect_to, [("state", state)])

    session_ids: set[uuid.UUID] = set()
    found = get_active_session(db, request.cookies.get(SESSION_COOKIE))
    if found:
        session_ids.add(found[0].id)
    if hint.get("sid"):
        session_ids.add(uuid.UUID(hint["sid"]))
    for session_id in session_ids:
        auth_session = db.get(AuthSession, session_id)
        if auth_session is None:
            continue
        revoke_session(db, session_id)
        audit.record(db, "logout", request=request, subject_user_id=auth_session.user_id)
    db.commit()

    if redirect_to:
        response: Response = RedirectResponse(redirect_to, status_code=303)
    else:
        response = render_message(
            request,
            200,
            "You have signed out",
            "You are signed out of all apps.",
            settings.portal_url,
            "Sign in again",
        )
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response
