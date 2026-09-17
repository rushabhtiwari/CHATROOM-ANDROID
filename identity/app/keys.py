"""RSA signing keys: generation, encryption at rest, rotation, JWKS. See spec §5.7."""

from dataclasses import dataclass
from datetime import timedelta

from cryptography.fernet import Fernet
from joserfc.jwk import KeySet, RSAKey
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SigningKey
from app.security import new_token, utcnow

RETIRED_KEY_PUBLISH_WINDOW = timedelta(hours=24)


@dataclass(frozen=True)
class ActiveKey:
    kid: str
    key: RSAKey

    @property
    def key_set(self) -> KeySet:
        return KeySet([self.key])


def _generate(db: Session, fernet: Fernet) -> SigningKey:
    kid = new_token(12)
    key = RSAKey.generate_key(2048, parameters={"kid": kid, "use": "sig", "alg": "RS256"})
    now = utcnow()
    row = SigningKey(
        kid=kid,
        public_jwk=key.as_dict(private=False),
        private_key_encrypted=fernet.encrypt(key.as_pem(private=True)).decode(),
        created_at=now,
        activated_at=now,
    )
    db.add(row)
    return row


def ensure_active_key(db: Session, encryption_key: str) -> None:
    if db.scalar(select(SigningKey).where(SigningKey.retired_at.is_(None))) is None:
        _generate(db, Fernet(encryption_key))
        db.commit()


def rotate(db: Session, encryption_key: str) -> str:
    now = utcnow()
    for row in db.scalars(select(SigningKey).where(SigningKey.retired_at.is_(None))):
        row.retired_at = now
    row = _generate(db, Fernet(encryption_key))
    return row.kid


def get_active_key(db: Session, encryption_key: str) -> ActiveKey:
    row = db.scalar(
        select(SigningKey)
        .where(SigningKey.retired_at.is_(None))
        .order_by(SigningKey.activated_at.desc())
    )
    if row is None:
        raise RuntimeError("No active signing key; ensure_active_key() must run at startup")
    pem = Fernet(encryption_key).decrypt(row.private_key_encrypted.encode())
    key = RSAKey.import_key(pem, parameters={"kid": row.kid, "use": "sig", "alg": "RS256"})
    return ActiveKey(kid=row.kid, key=key)


def public_jwks(db: Session) -> dict:
    cutoff = utcnow() - RETIRED_KEY_PUBLISH_WINDOW
    rows = db.scalars(
        select(SigningKey).where(
            (SigningKey.retired_at.is_(None)) | (SigningKey.retired_at > cutoff)
        )
    )
    return {"keys": [row.public_jwk for row in rows]}


def public_key_set(db: Session) -> KeySet:
    return KeySet.import_key_set(public_jwks(db))
