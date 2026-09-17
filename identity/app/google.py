"""Upstream Google Workspace sign-in (Authlib Starlette client)."""

from functools import lru_cache

import httpx2
from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import Request
from fastapi.responses import RedirectResponse

from app.config import Settings, get_settings
from app.login import GoogleIdentity

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"


class GoogleUnavailable(Exception):
    pass


class GoogleRejected(Exception):
    pass


class GoogleClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.oauth = OAuth()
        self.oauth.register(
            "google",
            server_metadata_url=GOOGLE_DISCOVERY_URL,
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
        )

    async def start(self, request: Request) -> RedirectResponse:
        try:
            return await self.oauth.google.authorize_redirect(
                request,
                f"{self.settings.issuer_url}/google/callback",
                hd=self.settings.company_domain,
                prompt="select_account",
            )
        except httpx2.HTTPError as exc:
            raise GoogleUnavailable(str(exc)) from exc

    async def finish(self, request: Request) -> GoogleIdentity:
        try:
            token = await self.oauth.google.authorize_access_token(request)
        except OAuthError as exc:
            raise GoogleRejected(exc.error) from exc
        except httpx2.HTTPError as exc:
            raise GoogleUnavailable(str(exc)) from exc
        info = token["userinfo"]  # ID token already verified by Authlib (sig, iss, aud, nonce)
        return GoogleIdentity(
            sub=info["sub"],
            email=info["email"],
            email_verified=bool(info.get("email_verified")),
            hd=info.get("hd"),
            name=info.get("name") or info["email"],
            picture=info.get("picture"),
        )


@lru_cache
def _client() -> GoogleClient:
    return GoogleClient(get_settings())


def get_google_client() -> GoogleClient:
    return _client()
