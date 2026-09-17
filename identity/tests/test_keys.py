from datetime import timedelta

from joserfc import jwt
from sqlalchemy import func, select

from app.keys import ensure_active_key, get_active_key, public_jwks, public_key_set, rotate
from app.models import SigningKey
from app.security import utcnow


def test_ensure_active_key_is_idempotent_and_encrypts(db, settings):
    ensure_active_key(db, settings.key_encryption_key)
    ensure_active_key(db, settings.key_encryption_key)
    rows = db.scalars(select(SigningKey)).all()
    assert len(rows) == 1
    assert "PRIVATE KEY" not in rows[0].private_key_encrypted
    assert "d" not in rows[0].public_jwk


def test_active_key_signs_tokens_verifiable_from_jwks(db, settings):
    ensure_active_key(db, settings.key_encryption_key)
    active = get_active_key(db, settings.key_encryption_key)
    token = jwt.encode({"alg": "RS256"}, {"sub": "x"}, active.key_set)
    decoded = jwt.decode(token, public_key_set(db), algorithms=["RS256"])
    assert decoded.header["kid"] == active.kid


def test_rotate_retires_previous_key_but_keeps_it_published(db, settings):
    ensure_active_key(db, settings.key_encryption_key)
    old = get_active_key(db, settings.key_encryption_key).kid
    new = rotate(db, settings.key_encryption_key)
    db.flush()
    assert get_active_key(db, settings.key_encryption_key).kid == new
    assert {k["kid"] for k in public_jwks(db)["keys"]} == {old, new}
    db.get(SigningKey, old).retired_at = utcnow() - timedelta(hours=25)
    db.flush()
    assert {k["kid"] for k in public_jwks(db)["keys"]} == {new}
    assert db.scalar(select(func.count()).select_from(SigningKey)) == 2
