import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


def _created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("status IN ('active', 'suspended')", name="ck_users_status"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="active")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _created_at()
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def get_user_id(self) -> str:
        return str(self.id)


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = _uuid_pk()
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(255))


class UserDepartment(Base):
    __tablename__ = "user_departments"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("departments.id", ondelete="RESTRICT"), primary_key=True
    )


class App(Base):
    __tablename__ = "apps"
    __table_args__ = (CheckConstraint("status IN ('active', 'disabled')", name="ck_apps_status"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(255), default="")
    launch_url: Mapped[str] = mapped_column(Text)
    client_id: Mapped[str] = mapped_column(String(64), unique=True)
    client_secret_hash: Mapped[str] = mapped_column(Text)
    redirect_uris: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    post_logout_redirect_uris: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    status: Mapped[str] = mapped_column(String(16), default="active")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _created_at()


class AppRole(Base):
    __tablename__ = "app_roles"
    __table_args__ = (
        UniqueConstraint("app_id", "key"),
        UniqueConstraint("app_id", "rank"),
        UniqueConstraint("app_id", "id"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(64))
    label: Mapped[str] = mapped_column(String(255))
    rank: Mapped[int] = mapped_column(Integer)


class DepartmentAppAccess(Base):
    __tablename__ = "department_app_access"
    __table_args__ = (
        ForeignKeyConstraint(["app_id", "app_role_id"], ["app_roles.app_id", "app_roles.id"]),
    )

    department_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), primary_key=True
    )
    app_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("apps.id", ondelete="CASCADE"), primary_key=True
    )
    app_role_id: Mapped[uuid.UUID] = mapped_column()


class UserAppOverride(Base):
    __tablename__ = "user_app_overrides"
    __table_args__ = (
        UniqueConstraint("user_id", "app_id"),
        CheckConstraint("effect IN ('grant', 'deny')", name="ck_user_app_overrides_effect"),
        CheckConstraint(
            "(effect = 'grant') = (app_role_id IS NOT NULL)",
            name="ck_user_app_overrides_grant_has_role",
        ),
        ForeignKeyConstraint(["app_id", "app_role_id"], ["app_roles.app_id", "app_roles.id"]),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id", ondelete="CASCADE"))
    effect: Mapped[str] = mapped_column(String(8))
    app_role_id: Mapped[uuid.UUID | None] = mapped_column()
    reason: Mapped[str] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _created_at()
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthorizationCode(Base):
    __tablename__ = "authorization_codes"

    id: Mapped[uuid.UUID] = _uuid_pk()
    code_hash: Mapped[str] = mapped_column(String(64), unique=True)
    client_id: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("auth_sessions.id", ondelete="CASCADE")
    )
    redirect_uri: Mapped[str] = mapped_column(Text)
    scope: Mapped[str] = mapped_column(Text)
    nonce: Mapped[str | None] = mapped_column(Text)
    code_challenge: Mapped[str] = mapped_column(Text)
    code_challenge_method: Mapped[str] = mapped_column(String(8))
    auth_time: Mapped[int] = mapped_column(Integer)
    refresh_family_id: Mapped[uuid.UUID | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Authlib AuthorizationCodeMixin interface
    def get_redirect_uri(self) -> str:
        return self.redirect_uri

    def get_scope(self) -> str:
        return self.scope

    def get_nonce(self) -> str | None:
        return self.nonce

    def get_auth_time(self) -> int:
        return self.auth_time

    def get_acr(self) -> None:
        return None

    def get_amr(self) -> None:
        return None


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = _uuid_pk()
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    client_id: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("auth_sessions.id", ondelete="CASCADE"), index=True
    )
    scope: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    family_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Authlib TokenMixin interface (subset used by RefreshTokenGrant)
    def check_client(self, client) -> bool:
        return self.client_id == client.get_client_id()

    def get_scope(self) -> str:
        return self.scope


class SigningKey(Base):
    __tablename__ = "signing_keys"

    kid: Mapped[str] = mapped_column(String(64), primary_key=True)
    public_jwk: Mapped[dict] = mapped_column(JSONB)
    private_key_encrypted: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    event: Mapped[str] = mapped_column(String(64), index=True)
    subject_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    app_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("apps.id", ondelete="SET NULL"))
    detail: Mapped[dict] = mapped_column(JSONB, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(64))
    ip: Mapped[str | None] = mapped_column(String(64))
