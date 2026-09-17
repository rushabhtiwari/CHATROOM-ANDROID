"""OIDC authorization server built on Authlib's framework-neutral classes. See spec §5."""

import json
import uuid
from dataclasses import dataclass
from datetime import timedelta

from authlib.oauth2 import AuthorizationServer
from authlib.oauth2.rfc6749 import (
    ClientMixin,
    InvalidGrantError,
    InvalidRequestError,
    grants,
    list_to_scope,
    scope_to_list,
)
from authlib.oauth2.rfc7636 import CodeChallenge
from authlib.oauth2.rfc9068 import JWTBearerTokenGenerator
from authlib.oidc.core import OpenIDCode, UserInfo
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.access import RoleRef, resolve_role
from app.config import Settings
from app.keys import ActiveKey, get_active_key
from app.models import App, AuthorizationCode, AuthSession, RefreshToken, User
from app.oauth.requests import IdentityOAuth2Request
from app.security import hash_token, new_token, utcnow, verify_secret
from app.sessions import is_session_active, revoke_family

ACCESS_TOKEN_TTL = 900
ID_TOKEN_TTL = 900
CODE_TTL = timedelta(seconds=60)
REFRESH_IDLE_TTL = timedelta(hours=12)
REFRESH_ABSOLUTE_TTL = timedelta(hours=24)
# A used refresh token presented again within this window is treated as a concurrent request
# from the same client (e.g. parallel page loads), not as theft.
REFRESH_REUSE_GRACE = timedelta(seconds=30)
SUPPORTED_SCOPES = ["openid", "email", "profile"]


class OAuthClient(ClientMixin):
    def __init__(self, app: App):
        self.app = app

    def get_client_id(self) -> str:
        return self.app.client_id

    def get_default_redirect_uri(self) -> None:
        return None  # redirect_uri is always required

    def get_allowed_scope(self, scope: str | None) -> str:
        if not scope:
            return ""
        return list_to_scope([s for s in scope_to_list(scope) if s in SUPPORTED_SCOPES])

    def check_redirect_uri(self, redirect_uri: str) -> bool:
        return redirect_uri in self.app.redirect_uris

    def check_client_secret(self, client_secret: str) -> bool:
        return verify_secret(self.app.client_secret_hash, client_secret)

    def check_endpoint_auth_method(self, method: str, endpoint: str) -> bool:
        return method in ("client_secret_basic", "client_secret_post")

    def check_response_type(self, response_type: str) -> bool:
        return response_type == "code"

    def check_grant_type(self, grant_type: str) -> bool:
        return grant_type in ("authorization_code", "refresh_token")


@dataclass
class IssueContext:
    """Per-request facts the token generator and ID token need but Authlib doesn't pass."""

    session_id: uuid.UUID | None = None
    role: RoleRef | None = None
    code: AuthorizationCode | None = None
    commit_on_error: bool = False


class IdentityServer(AuthorizationServer):
    def __init__(self, db: Session, settings: Settings):
        super().__init__(scopes_supported=SUPPORTED_SCOPES)
        self.db = db
        self.settings = settings
        self.ctx = IssueContext()
        self._active_key: ActiveKey | None = None
        self.register_token_generator("default", AccessTokenGenerator(self))
        self.register_grant(CodeGrant, [StrictPKCE(), IdentityOpenIDCode(self)])
        self.register_grant(RotatingRefreshGrant)

    @property
    def active_key(self) -> ActiveKey:
        if self._active_key is None:
            self._active_key = get_active_key(self.db, self.settings.key_encryption_key)
        return self._active_key

    def query_client(self, client_id: str) -> OAuthClient | None:
        app = self.db.scalar(select(App).where(App.client_id == client_id, App.status == "active"))
        return OAuthClient(app) if app else None

    def save_token(self, token: dict, request: IdentityOAuth2Request) -> None:
        if "refresh_token" not in token:
            return
        now = utcnow()
        previous: RefreshToken | None = request.refresh_token
        if previous is not None:
            family_id = previous.family_id
            family_expires_at = previous.family_expires_at
        else:
            family_id = uuid.uuid4()
            family_expires_at = now + REFRESH_ABSOLUTE_TTL
            self.ctx.code.refresh_family_id = family_id
        self.db.add(
            RefreshToken(
                token_hash=hash_token(token["refresh_token"]),
                family_id=family_id,
                client_id=request.client.get_client_id(),
                user_id=request.user.id,
                session_id=self.ctx.session_id,
                scope=token.get("scope", ""),
                created_at=now,
                expires_at=min(now + REFRESH_IDLE_TTL, family_expires_at),
                family_expires_at=family_expires_at,
            )
        )

    def create_oauth2_request(self, request) -> IdentityOAuth2Request:
        if isinstance(request, IdentityOAuth2Request):
            return request
        raise TypeError("Pass an IdentityOAuth2Request built by build_oauth_request()")

    def create_json_request(self, request):
        raise NotImplementedError("JSON endpoints are not used")

    def handle_response(self, status: int, body, headers) -> Response:
        if isinstance(body, dict):
            body = json.dumps(body)
        return Response(content=body, status_code=status, headers=dict(headers))

    def send_signal(self, name: str, *args, **kwargs) -> None:
        pass

    def resolve_role_for(self, user: User, client: OAuthClient) -> RoleRef | None:
        return resolve_role(self.db, user, client.app)


class StrictPKCE(CodeChallenge):
    """PKCE with S256 required for every client, including confidential ones (spec §5.8)."""

    SUPPORTED_CODE_CHALLENGE_METHOD = ["S256"]

    def validate_code_challenge(self, grant, redirect_uri):
        data = grant.request.payload.data
        if not data.get("code_challenge"):
            raise InvalidRequestError("Missing 'code_challenge'")
        if data.get("code_challenge_method") != "S256":
            raise InvalidRequestError("'code_challenge_method' must be 'S256'")
        super().validate_code_challenge(grant, redirect_uri)

    def validate_code_verifier(self, grant, result):
        if not grant.request.form.get("code_verifier"):
            raise InvalidRequestError("Missing 'code_verifier'")
        super().validate_code_verifier(grant, result)


class CodeGrant(grants.AuthorizationCodeGrant):
    TOKEN_ENDPOINT_AUTH_METHODS = ["client_secret_basic", "client_secret_post"]
    server: IdentityServer

    def save_authorization_code(self, code: str, request: IdentityOAuth2Request) -> None:
        data = request.payload.data
        now = utcnow()
        auth_session = self.server.db.get(AuthSession, self.server.ctx.session_id)
        self.server.db.add(
            AuthorizationCode(
                code_hash=hash_token(code),
                client_id=request.client.get_client_id(),
                user_id=request.user.id,
                session_id=auth_session.id,
                redirect_uri=data["redirect_uri"],
                scope=request.scope,
                nonce=data.get("nonce"),
                code_challenge=data["code_challenge"],
                code_challenge_method=data["code_challenge_method"],
                auth_time=int(auth_session.created_at.timestamp()),
                created_at=now,
                expires_at=now + CODE_TTL,
            )
        )

    def query_authorization_code(self, code: str, client: OAuthClient):
        db = self.server.db
        row = db.scalar(
            select(AuthorizationCode).where(
                AuthorizationCode.code_hash == hash_token(code),
                AuthorizationCode.client_id == client.get_client_id(),
            )
        )
        if row is None:
            return None
        if row.used_at is not None:
            if row.refresh_family_id is not None:
                revoke_family(db, row.refresh_family_id)
            audit.record(
                db, "code_reuse_detected", subject_user_id=row.user_id, app_id=client.app.id
            )
            self.server.ctx.commit_on_error = True
            return None
        if row.expires_at <= utcnow():
            return None
        return row

    def delete_authorization_code(self, authorization_code: AuthorizationCode) -> None:
        authorization_code.used_at = utcnow()

    def authenticate_user(self, authorization_code: AuthorizationCode) -> User | None:
        db = self.server.db
        user = db.get(User, authorization_code.user_id)
        auth_session = db.get(AuthSession, authorization_code.session_id)
        if user is None or auth_session is None or not is_session_active(auth_session):
            return None
        role = self.server.resolve_role_for(user, self.request.client)
        if role is None:
            return None
        self.server.ctx.session_id = auth_session.id
        self.server.ctx.role = role
        self.server.ctx.code = authorization_code
        return user


class RotatingRefreshGrant(grants.RefreshTokenGrant):
    TOKEN_ENDPOINT_AUTH_METHODS = ["client_secret_basic", "client_secret_post"]
    INCLUDE_NEW_REFRESH_TOKEN = True
    server: IdentityServer

    def authenticate_refresh_token(self, refresh_token: str) -> RefreshToken | None:
        db = self.server.db
        row = db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
        )
        if row is None or row.revoked_at is not None:
            return None
        if row.used_at is not None and utcnow() - row.used_at > REFRESH_REUSE_GRACE:
            revoke_family(db, row.family_id)
            audit.record(
                db,
                "refresh_reuse_detected",
                subject_user_id=row.user_id,
                detail={"client_id": row.client_id},
            )
            self.server.ctx.commit_on_error = True
            return None
        if row.expires_at <= utcnow():
            return None
        return row

    def authenticate_user(self, refresh_token: RefreshToken) -> User:
        db = self.server.db
        user = db.get(User, refresh_token.user_id)
        auth_session = db.get(AuthSession, refresh_token.session_id)
        role = None
        if user is not None and auth_session is not None and is_session_active(auth_session):
            role = self.server.resolve_role_for(user, self.request.client)
        if role is None:
            revoke_family(db, refresh_token.family_id)
            self.server.ctx.commit_on_error = True
            raise InvalidGrantError("Access to this app is no longer available.")
        self.server.ctx.session_id = auth_session.id
        self.server.ctx.role = role
        return user

    def revoke_old_credential(self, refresh_token: RefreshToken) -> None:
        if refresh_token.used_at is None:
            refresh_token.used_at = utcnow()


def _user_claims(user: User, ctx: IssueContext) -> dict:
    return {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name,
        "picture": user.avatar_url,
        "role": ctx.role.key,
        "sid": str(ctx.session_id),
    }


class AccessTokenGenerator(JWTBearerTokenGenerator):
    def __init__(self, server: IdentityServer):
        super().__init__(
            issuer=server.settings.issuer_url,
            refresh_token_generator=lambda **kwargs: new_token(48),
            expires_generator=lambda client, grant_type: ACCESS_TOKEN_TTL,
        )
        self.server = server

    def get_jwks(self):
        return self.server.active_key.key_set

    def get_extra_claims(self, client, grant_type, user, scope) -> dict:
        return _user_claims(user, self.server.ctx)


class IdentityOpenIDCode(OpenIDCode):
    def __init__(self, server: IdentityServer):
        super().__init__(require_nonce=True)
        self.server = server

    def exists_nonce(self, nonce: str, request) -> bool:
        return (
            self.server.db.scalar(
                select(AuthorizationCode.id).where(
                    AuthorizationCode.nonce == nonce,
                    AuthorizationCode.client_id == request.payload.client_id,
                )
            )
            is not None
        )

    def resolve_client_private_key(self, client):
        return self.server.active_key.key_set

    def get_client_algorithm(self, client) -> str:
        return "RS256"

    def get_encode_header(self, client) -> dict:
        return {"alg": "RS256", "kid": self.server.active_key.kid}

    def get_client_claims(self, client) -> dict:
        now = int(utcnow().timestamp())
        return {
            "iss": self.server.settings.issuer_url,
            "aud": client.get_client_id(),
            "iat": now,
            "exp": now + ID_TOKEN_TTL,
        }

    def generate_user_info(self, user: User, scope: str) -> UserInfo:
        return UserInfo(_user_claims(user, self.server.ctx))
