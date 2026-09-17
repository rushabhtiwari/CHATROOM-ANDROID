"""initial schema

Revision ID: 0001
Revises:
"""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

PORTAL_APP_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
PORTAL_ROLE_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


def upgrade() -> None:
    op.create_table(
        "apps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(length=255), nullable=False),
        sa.Column("launch_url", sa.Text(), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("client_secret_hash", sa.Text(), nullable=False),
        sa.Column("redirect_uris", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("post_logout_redirect_uris", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("status IN ('active', 'disabled')", name="ck_apps_status"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "departments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "signing_keys",
        sa.Column("kid", sa.String(length=64), nullable=False),
        sa.Column("public_jwk", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("private_key_encrypted", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("kid"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("google_sub", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('active', 'suspended')", name="ck_users_status"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("google_sub"),
    )
    op.create_table(
        "app_roles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("app_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("app_id", "id"),
        sa.UniqueConstraint("app_id", "key"),
        sa.UniqueConstraint("app_id", "rank"),
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("event", sa.String(length=64), nullable=False),
        sa.Column("subject_user_id", sa.Uuid(), nullable=True),
        sa.Column("app_id", sa.Uuid(), nullable=True),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["subject_user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_log_at"), "audit_log", ["at"], unique=False)
    op.create_index(op.f("ix_audit_log_event"), "audit_log", ["event"], unique=False)
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idle_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_table(
        "user_departments",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("department_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "department_id"),
    )
    op.create_table(
        "authorization_codes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("redirect_uri", sa.Text(), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("nonce", sa.Text(), nullable=True),
        sa.Column("code_challenge", sa.Text(), nullable=False),
        sa.Column("code_challenge_method", sa.String(length=8), nullable=False),
        sa.Column("auth_time", sa.Integer(), nullable=False),
        sa.Column("refresh_family_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["auth_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code_hash"),
    )
    op.create_table(
        "department_app_access",
        sa.Column("department_id", sa.Uuid(), nullable=False),
        sa.Column("app_id", sa.Uuid(), nullable=False),
        sa.Column("app_role_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["app_id", "app_role_id"],
            ["app_roles.app_id", "app_roles.id"],
        ),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("department_id", "app_id"),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("family_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["auth_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_refresh_tokens_family_id"), "refresh_tokens", ["family_id"], unique=False
    )
    op.create_index(
        op.f("ix_refresh_tokens_session_id"), "refresh_tokens", ["session_id"], unique=False
    )
    op.create_table(
        "user_app_overrides",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("app_id", sa.Uuid(), nullable=False),
        sa.Column("effect", sa.String(length=8), nullable=False),
        sa.Column("app_role_id", sa.Uuid(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(effect = 'grant') = (app_role_id IS NOT NULL)",
            name="ck_user_app_overrides_grant_has_role",
        ),
        sa.CheckConstraint("effect IN ('grant', 'deny')", name="ck_user_app_overrides_effect"),
        sa.ForeignKeyConstraint(
            ["app_id", "app_role_id"],
            ["app_roles.app_id", "app_roles.id"],
        ),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "app_id"),
    )

    # Seed the system portal client (spec §6). Secret and URIs are synced from config at startup.
    op.execute(
        sa.text(
            "INSERT INTO apps (id, slug, name, description, icon, launch_url, client_id, "
            "client_secret_hash, redirect_uris, post_logout_redirect_uris, status, is_system) "
            "VALUES (:id, 'portal', 'Portal', 'Company app launcher', '', '', 'portal', '!', "
            "'{}', '{}', 'active', true)"
        ).bindparams(id=PORTAL_APP_ID)
    )
    op.execute(
        sa.text(
            "INSERT INTO app_roles (id, app_id, key, label, rank) "
            "VALUES (:id, :app_id, 'user', 'User', 10)"
        ).bindparams(id=PORTAL_ROLE_ID, app_id=PORTAL_APP_ID)
    )


def downgrade() -> None:
    op.drop_table("user_app_overrides")
    op.drop_index(op.f("ix_refresh_tokens_session_id"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("department_app_access")
    op.drop_table("authorization_codes")
    op.drop_table("user_departments")
    op.drop_table("auth_sessions")
    op.drop_index(op.f("ix_audit_log_event"), table_name="audit_log")
    op.drop_index(op.f("ix_audit_log_at"), table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_table("app_roles")
    op.drop_table("users")
    op.drop_table("signing_keys")
    op.drop_table("departments")
    op.drop_table("apps")
