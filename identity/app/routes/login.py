import uuid

from fastapi import APIRouter, Depends, Form, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.google import GoogleClient, GoogleRejected, GoogleUnavailable, get_google_client
from app.login import LoginDenied, complete_dev_login, complete_google_login
from app.models import User
from app.pages import render_message, templates
from app.ratelimit import rate_limit
from app.sessions import ABSOLUTE_TIMEOUT, SESSION_COOKIE

router = APIRouter()
dev_router = APIRouter()

_DENIED = {
    "wrong_domain": (
        "Use your company Google account",
        "Sign in with your work Google account to continue.",
    ),
    "suspended": ("Your account is suspended", "Contact an admin to restore access."),
    "unknown_user": ("Unknown user", "That user does not exist."),
}
_UNAVAILABLE = (
    "Sign-in temporarily unavailable",
    "Google sign-in could not be reached. Try again in a minute.",
)


def _finish_login(request: Request, token: str, settings: Settings) -> Response:
    next_url = request.session.pop("next", None)
    if not (isinstance(next_url, str) and next_url.startswith("/authorize?")):
        next_url = settings.portal_url
    response = RedirectResponse(next_url, status_code=303)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(ABSOLUTE_TIMEOUT.total_seconds()),
        path="/",
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
    )
    return response


def _denied(request: Request, reason: str) -> Response:
    title, message = _DENIED[reason]
    return render_message(request, 403, title, message)


@router.get("/login")
def login(settings: Settings = Depends(get_settings)) -> Response:
    return RedirectResponse("/dev-login" if settings.dev_login_enabled else "/login/google", 303)


@router.get("/login/google")
async def google_start(
    request: Request, google: GoogleClient = Depends(get_google_client)
) -> Response:
    try:
        return await google.start(request)
    except GoogleUnavailable:
        return render_message(request, 503, *_UNAVAILABLE)


@router.get("/google/callback", dependencies=[Depends(rate_limit(60))])
async def google_callback(
    request: Request,
    google: GoogleClient = Depends(get_google_client),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        identity = await google.finish(request)
    except GoogleUnavailable:
        return render_message(request, 503, *_UNAVAILABLE)
    except GoogleRejected:
        return render_message(
            request,
            400,
            "Sign-in did not complete",
            "Please start signing in again.",
            settings.portal_url,
            "Back to portal",
        )
    try:
        _, token = await run_in_threadpool(complete_google_login, db, settings, identity, request)
    except LoginDenied as denied:
        return _denied(request, denied.reason)
    return _finish_login(request, token, settings)


@dev_router.get("/dev-login")
def dev_login_page(request: Request, db: Session = Depends(get_db)) -> Response:
    users = db.scalars(select(User).where(User.status == "active").order_by(User.email)).all()
    return templates.TemplateResponse(request, "dev_login.html", {"users": users})


@dev_router.post("/dev-login")
def dev_login(
    request: Request,
    user_id: uuid.UUID = Form(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        _, token = complete_dev_login(db, settings, user_id, request)
    except LoginDenied as denied:
        return _denied(request, denied.reason)
    return _finish_login(request, token, settings)
