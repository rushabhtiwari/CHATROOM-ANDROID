from authlib.oauth2.rfc6749 import OAuth2Error
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings, get_settings
from app.db import get_db
from app.keys import public_jwks
from app.oauth.requests import IdentityOAuth2Request, build_oauth_request
from app.oauth.server import SUPPORTED_SCOPES, IdentityServer
from app.pages import render_message
from app.ratelimit import rate_limit
from app.sessions import SESSION_COOKIE, get_active_session, touch

router = APIRouter()


async def oauth_request(
    request: Request, settings: Settings = Depends(get_settings)
) -> IdentityOAuth2Request:
    return await build_oauth_request(request, settings.issuer_url)


@router.get("/.well-known/openid-configuration")
def discovery(settings: Settings = Depends(get_settings)) -> dict:
    issuer = settings.issuer_url
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/authorize",
        "token_endpoint": f"{issuer}/token",
        "userinfo_endpoint": f"{issuer}/userinfo",
        "jwks_uri": f"{issuer}/jwks",
        "end_session_endpoint": f"{issuer}/logout",
        "scopes_supported": SUPPORTED_SCOPES,
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
        "code_challenge_methods_supported": ["S256"],
        "claims_supported": [
            "sub",
            "email",
            "name",
            "picture",
            "role",
            "sid",
            "iss",
            "aud",
            "exp",
            "iat",
            "auth_time",
            "nonce",
        ],
    }


@router.get("/jwks")
def jwks(response: Response, db: Session = Depends(get_db)) -> dict:
    response.headers["Cache-Control"] = "public, max-age=300"
    return public_jwks(db)


@router.get("/authorize", dependencies=[Depends(rate_limit(300))])
def authorize(
    request: Request,
    oreq: IdentityOAuth2Request = Depends(oauth_request),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    server = IdentityServer(db, settings)
    found = get_active_session(db, request.cookies.get(SESSION_COOKIE))
    try:
        grant = server.get_consent_grant(oreq, end_user=found[1] if found else None)
    except OAuth2Error as error:
        if error.redirect_uri:
            return server.handle_error_response(oreq, error)
        return render_message(
            request,
            400,
            "This sign-in link is invalid",
            error.description or error.error,
            settings.portal_url,
            "Back to portal",
        )

    if found is None:
        request.session["next"] = f"/authorize?{request.url.query}"
        return RedirectResponse("/login", status_code=303)

    auth_session, user = found
    client = grant.request.client
    if server.resolve_role_for(user, client) is None:
        audit.record(
            db, "access_denied", request=request, subject_user_id=user.id, app_id=client.app.id
        )
        db.commit()
        return render_message(
            request,
            403,
            f"You don't have access to {client.app.name}",
            "Ask your admin if you need access to this app.",
            settings.portal_url,
            "Back to portal",
        )

    server.ctx.session_id = auth_session.id
    touch(auth_session)
    response = server.create_authorization_response(oreq, grant_user=user, grant=grant)
    db.commit()
    return response


@router.post("/token", dependencies=[Depends(rate_limit(600))])
def token(
    oreq: IdentityOAuth2Request = Depends(oauth_request),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    server = IdentityServer(db, settings)
    response = server.create_token_response(oreq)
    if response.status_code == 200 or server.ctx.commit_on_error:
        db.commit()
    else:
        db.rollback()
    return response
