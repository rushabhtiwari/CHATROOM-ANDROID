"""Verification of tokens this service issued."""

from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet
from joserfc.jwt import JWTClaimsRegistry

LEEWAY_SECONDS = 30


class InvalidToken(Exception):
    pass


def verify_access_token(token: str, keys: KeySet, issuer: str, audience: str | None) -> dict:
    """Verify signature, typ=at+jwt, iss, exp and (optionally) aud. Returns the claims."""
    try:
        decoded = jwt.decode(token, keys, algorithms=["RS256"])
    except (JoseError, ValueError) as exc:
        raise InvalidToken(str(exc)) from exc
    if decoded.header.get("typ") != "at+jwt":
        raise InvalidToken("not an access token")
    claims = {"iss": {"essential": True, "value": issuer}, "exp": {"essential": True}}
    if audience is not None:
        claims["aud"] = {"essential": True, "value": audience}
    try:
        JWTClaimsRegistry(leeway=LEEWAY_SECONDS, **claims).validate(decoded.claims)
    except JoseError as exc:
        raise InvalidToken(str(exc)) from exc
    return decoded.claims


def read_id_token_hint(token: str, keys: KeySet, issuer: str) -> dict:
    """Verify signature and issuer of an ID token; expiry is ignored (OIDC RP-initiated logout)."""
    try:
        decoded = jwt.decode(token, keys, algorithms=["RS256"])
        JWTClaimsRegistry(iss={"essential": True, "value": issuer}).validate(decoded.claims)
    except (JoseError, ValueError) as exc:
        raise InvalidToken(str(exc)) from exc
    if decoded.header.get("typ") == "at+jwt":
        raise InvalidToken("not an ID token")
    return decoded.claims
