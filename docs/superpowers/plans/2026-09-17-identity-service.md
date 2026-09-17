# Central Platform — Plan 1: Identity Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI identity service: an OpenID Connect provider that federates Google Workspace sign-in, resolves each user's per-app role from departments and exceptions, and serves the `/me` and admin APIs the portal will use.

**Architecture:** One FastAPI service over PostgreSQL. Authlib's framework-neutral `AuthorizationServer` handles the OAuth/OIDC protocol through a small FastAPI adapter; joserfc signs and verifies RS256 JWTs; access rules are a pure function over rows loaded with SQLAlchemy. Browser state is a hashed session cookie on the identity host; apps receive short-lived JWT access tokens, ID tokens and rotating refresh tokens.

**Tech Stack:** Python 3.12, uv, FastAPI 0.141, SQLAlchemy 2.0 + psycopg 3, Alembic 1.20, Authlib 1.8 (+ httpx2), joserfc 1.7, argon2-cffi, cryptography (Fernet), Jinja2, pytest 9, ruff, PostgreSQL 16, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-16-central-platform-sso-design.md`

**Series:** This is Plan 1 of 3. Plan 2 (portal: Next.js dashboard and admin console) and Plan 3 (reference Next.js app + Python API, integration guide, OpenID conformance run) build on the service and seed data produced here.

## Global Constraints

- Python `>=3.12`; dependency ranges exactly as in `identity/pyproject.toml` (Task 1). Authlib is pinned `>=1.8,<1.9` because the adapter in Task 7 uses its 1.8 request/payload API.
- All OAuth/OIDC protocol handling goes through Authlib and all JWT/JWK work through joserfc — no hand-written token signing, verification or PKCE comparison.
- PKCE is required for every client and only `S256` is accepted; `nonce` is required; redirect and post-logout URIs match exactly.
- Lifetimes: authorization code 60 s; access and ID tokens 900 s; refresh tokens rotate on every use, 12 h idle / 24 h absolute per family; browser session 12 h idle / 24 h absolute.
- Tokens, codes, session cookies are stored only as sha256 hashes; client secrets as argon2 hashes; private signing keys Fernet-encrypted with `KEY_ENCRYPTION_KEY`.
- Every token carries only the role for its own `aud` client.
- Every admin mutation, sign-in, denial and reuse detection writes an `audit_log` row.
- The system client id is `portal`; its redirect URI is `{PORTAL_URL}/api/auth/callback/identity` (Auth.js provider id `identity`).
- The service refuses to start with `DEV_LOGIN_ENABLED=true` when `ENVIRONMENT=production`, and requires an `https://` `ISSUER_URL` in staging and production.
- Line length 100; `uv run ruff check .` and `uv run ruff format --check .` must pass at the end of every task.
- Run every `uv run …` command from the `identity/` directory; run `docker compose …` and `git …` from the repository root.

## Decisions made while planning (spec clarifications)

These fill gaps in the spec; update the spec if any is unwanted.

1. **`SESSION_SECRET`** (new setting) signs the 10-minute cookie that carries the pending `/authorize` request and Google `state` through sign-in.
2. **`TRUSTED_PROXIES`** is realised as the container's `FORWARDED_ALLOW_IPS`, passed to uvicorn `--forwarded-allow-ips`, instead of application code.
3. **Extra columns:** `authorization_codes` gains `code_challenge_method`, `auth_time` and `refresh_family_id` (so code reuse can revoke the tokens it issued); `refresh_tokens` gains `scope` and `family_expires_at`; `users.google_sub` is nullable so dev-seeded and pre-created users can exist before first Google sign-in (linked by email on first sign-in).
4. **Portal role:** migration `0001` seeds the portal client with one role, `user` (rank 10).
5. **Rate limits** are in-memory per replica: `/authorize` 300/min, `/token` 600/min, `/google/callback` 60/min per client IP.
6. **Admins cannot suspend or demote themselves** (409), to avoid locking out the last admin.
7. **App client id = slug**, fixed at registration.
8. **Request IDs:** HTML error pages show the request ID; JSON API errors carry it in the `X-Request-ID` response header (every response has it) rather than in the body.
9. **Deferred to later plans:** portal UI and admin navigation (Plan 2); reference apps, integration guide and the OpenID conformance run (Plan 3).

## Prerequisites

- Docker with Compose v2, Python 3.12, and uv (`curl -LsSf https://astral.sh/uv/install.sh | sh`).
- The repository root already contains `docs/`. Work on a feature branch: `git checkout -b feat/identity-service`.

## File Map

```
docker-compose.yml                       Postgres (Task 1) + identity service (Task 14)
identity/
  pyproject.toml, uv.lock, .env.example, .gitignore, Dockerfile, README.md
  alembic.ini
  docker/postgres-init.sql               creates identity_test
  migrations/env.py, script.py.mako
  migrations/versions/0001_initial_schema.py
  app/
    config.py        Settings + production safety checks
    db.py            engine/session factory, get_db dependency
    security.py      token hashing, argon2 secrets, utcnow
    models.py        all tables
    access.py        role resolution (pure decide + DB loader)
    audit.py         audit_log writer
    sessions.py      browser sessions + revocation
    keys.py          signing keys, rotation, JWKS
    bootstrap.py     startup: active key + portal client sync
    login.py         Google identity -> user + session
    google.py        Authlib Starlette client for Google
    pages.py         HTML message pages
    templates/       base.html, message.html, dev_login.html
    ratelimit.py     per-IP fixed-window limiter
    observability.py request id, JSON logs, HSTS
    deps.py          portal bearer auth, require_admin
    seed.py          development data
    main.py          app factory
    oauth/
      requests.py    FastAPI -> Authlib request adapter
      server.py      IdentityServer, grants, PKCE, token generator, OIDC ID token
      tokens.py      access-token and id_token_hint verification
    routes/
      health.py oidc.py userinfo.py logout.py login.py me.py
    admin/
      common.py schemas.py apps.py departments.py users.py system.py
  tests/
    conftest.py factories.py oidc_helpers.py test_*.py
    admin/conftest.py admin/test_admin_*.py
```

---

### Task 1: Project scaffold, settings, local Postgres

Create the `identity/` Python project, typed settings with production safety checks, and a Docker Compose Postgres for development and tests.

**Files:**
- Create: `identity/pyproject.toml`
- Create: `identity/tests/__init__.py`
- Create: `identity/tests/conftest.py`
- Create: `identity/tests/test_config.py`
- Create: `docker-compose.yml`
- Create: `identity/.gitignore`
- Create: `identity/.env.example`
- Create: `identity/docker/postgres-init.sql`
- Create: `identity/app/__init__.py`
- Create: `identity/app/config.py`

**Interfaces:**
- Produces `app.config.Settings` — fields `environment`, `company_domain`, `issuer_url`, `database_url`, `google_client_id`, `google_client_secret`, `key_encryption_key`, `session_secret`, `initial_admin_emails`, `portal_url`, `portal_client_secret`, `dev_login_enabled`; properties `admin_emails: set[str]`, `portal_redirect_uri: str` (`{portal_url}/api/auth/callback/identity`), `secure_cookies: bool`.
- Produces `app.config.get_settings() -> Settings` (`lru_cache`d; tests call `.cache_clear()`).
- Produces the test environment block and `settings` fixture in `tests/conftest.py`.

- [ ] **Step 1: Create the project and install dependencies**

`identity/pyproject.toml`

```toml
[project]
name = "identity"
version = "0.1.0"
description = "Central identity service: OIDC provider, access rules and admin API"
requires-python = ">=3.12"
dependencies = [
  "alembic>=1.20,<2",
  "argon2-cffi>=25.1",
  "authlib>=1.8,<1.9",
  "cryptography>=46",
  "fastapi>=0.141,<1",
  "httpx2>=2.13",
  "itsdangerous>=2.2",
  "jinja2>=3.1",
  "joserfc>=1.7,<2",
  "psycopg[binary]>=3.3",
  "pydantic-settings>=2.15",
  "python-multipart>=0.0.32",
  "sqlalchemy>=2.0.54,<2.1",
  "uvicorn[standard]>=0.53",
]

[dependency-groups]
dev = ["httpx>=0.28", "pytest>=9.1", "ruff>=0.16"]

[tool.uv]
package = false

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q -p no:warnings"

[tool.ruff]
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP"]
ignore = ["B008"]  # FastAPI Depends()/Query() defaults
```

Then from the repository root:

```bash
cd identity
uv sync
```

Expected: Creates `identity/.venv` and `identity/uv.lock`.

- [ ] **Step 2: Write the failing tests**

`identity/tests/__init__.py` — empty file (package marker).

`identity/tests/conftest.py`

```python
import os

os.environ.setdefault(
    "TEST_DATABASE_URL", "postgresql+psycopg://central:central@localhost:5433/identity_test"
)
os.environ.update(
    ENVIRONMENT="test",
    DATABASE_URL=os.environ["TEST_DATABASE_URL"],
    COMPANY_DOMAIN="yourco.com",
    ISSUER_URL="http://localhost:8000",
    KEY_ENCRYPTION_KEY="uB0yq0lqV3m7vJx9I6kzvJ6o4wqkJ7mYwR2fT5bq8nE=",
    SESSION_SECRET="test-session-secret",
    INITIAL_ADMIN_EMAILS="boss@yourco.com",
    PORTAL_URL="http://localhost:3000",
    PORTAL_CLIENT_SECRET="portal-secret",
    DEV_LOGIN_ENABLED="false",
)

import pytest  # noqa: E402

from app.config import Settings, get_settings  # noqa: E402


@pytest.fixture
def settings() -> Settings:
    return get_settings()
```

`identity/tests/test_config.py`

```python
import pytest
from pydantic import ValidationError

from app.config import Settings


def test_production_refuses_dev_login():
    with pytest.raises(ValidationError, match="DEV_LOGIN_ENABLED"):
        Settings(
            environment="production", dev_login_enabled=True, issuer_url="https://auth.yourco.com"
        )


def test_production_requires_https_issuer():
    with pytest.raises(ValidationError, match="https"):
        Settings(environment="production", issuer_url="http://auth.yourco.com")


def test_admin_emails_are_normalised():
    parsed = Settings(initial_admin_emails=" Boss@YourCo.com, ,ops@yourco.com")
    assert parsed.admin_emails == {"boss@yourco.com", "ops@yourco.com"}
```

- [ ] **Step 3: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_config.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 4: Implement**

`docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: central
      POSTGRES_PASSWORD: central
      POSTGRES_DB: identity
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./identity/docker/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U central -d identity"]
      interval: 2s
      retries: 30

volumes:
  pgdata:
```

`identity/.gitignore`

```text
.venv/
__pycache__/
.pytest_cache/
.ruff_cache/
.env
```

`identity/.env.example`

```bash
# Copy to .env for running the service outside Docker (uv run uvicorn ...).
ENVIRONMENT=development
DATABASE_URL=postgresql+psycopg://central:central@localhost:5433/identity
COMPANY_DOMAIN=yourco.com
ISSUER_URL=http://localhost:8000
# Generate: uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
KEY_ENCRYPTION_KEY=uB0yq0lqV3m7vJx9I6kzvJ6o4wqkJ7mYwR2fT5bq8nE=
SESSION_SECRET=dev-session-secret
INITIAL_ADMIN_EMAILS=admin@yourco.com
PORTAL_URL=http://localhost:3000
PORTAL_CLIENT_SECRET=dev-portal-secret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DEV_LOGIN_ENABLED=true
```

`identity/docker/postgres-init.sql`

```sql
CREATE DATABASE identity_test;
```

`identity/app/__init__.py` — empty file (package marker).

`identity/app/config.py`

```python
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "staging", "production"] = "development"
    company_domain: str
    issuer_url: str
    database_url: str
    google_client_id: str = ""
    google_client_secret: str = ""
    key_encryption_key: str
    session_secret: str
    initial_admin_emails: str = ""
    portal_url: str
    portal_client_secret: str
    dev_login_enabled: bool = False

    @model_validator(mode="after")
    def _check_production_safety(self) -> "Settings":
        if self.environment == "production" and self.dev_login_enabled:
            raise ValueError("DEV_LOGIN_ENABLED must not be true when ENVIRONMENT=production")
        if self.environment in ("staging", "production") and not self.issuer_url.startswith(
            "https://"
        ):
            raise ValueError("ISSUER_URL must use https outside development")
        return self

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.initial_admin_emails.split(",") if e.strip()}

    @property
    def portal_redirect_uri(self) -> str:
        return f"{self.portal_url}/api/auth/callback/identity"

    @property
    def secure_cookies(self) -> bool:
        return self.issuer_url.startswith("https://")


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_config.py
```

Expected: `3 passed`

- [ ] **Step 6: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `3 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml identity
git commit -m "feat(identity): project scaffold, settings and dev Postgres"
```

---

### Task 2: Data model, initial migration, DB test fixtures

All tables from spec §4 as SQLAlchemy models, secret-hashing helpers, the Alembic migration that creates the schema and seeds the system `portal` client, and per-test transactional fixtures.

**Files:**
- Create: `identity/tests/factories.py`
- Create: `identity/tests/test_migrations.py`
- Create: `identity/app/db.py`
- Create: `identity/app/security.py`
- Create: `identity/app/models.py`
- Create: `identity/alembic.ini`
- Create: `identity/migrations/env.py`
- Create: `identity/migrations/script.py.mako`
- Create: `identity/migrations/versions/0001_initial_schema.py`
- Modify: `identity/tests/conftest.py`

**Interfaces:**
- Consumes `get_settings()` (Task 1).
- Produces `app.db`: `Base`, `get_sessionmaker()`, `get_db()` (FastAPI dependency yielding a `Session`).
- Produces `app.security`: `utcnow()`, `new_token(nbytes=32)`, `hash_token(token) -> str` (sha256 hex, for high-entropy tokens only), `hash_secret(secret) -> str` and `verify_secret(hash, secret) -> bool` (argon2).
- Produces `app.models`: `User`, `Department`, `UserDepartment`, `App`, `AppRole`, `DepartmentAppAccess`, `UserAppOverride`, `AuthSession`, `AuthorizationCode` (Authlib code interface), `RefreshToken` (`check_client`, `get_scope`), `SigningKey`, `AuditLog`.
- Produces fixtures `engine` (session scope; drops the schema and runs `alembic upgrade head`) and `db` (per test; `commit()` becomes a savepoint, everything rolls back afterwards).
- Produces `tests/factories.py`: `make_user`, `make_department`, `make_app -> (App, {role_key: AppRole})` (roles viewer=10, editor=20, manager=30; secret `CLIENT_SECRET`), `add_to_department`, `grant_department`, `add_override`.

- [ ] **Step 1: Start Postgres**

```bash
docker compose up -d postgres
docker compose ps
```

Expected: `postgres` is `healthy`. The init script also creates the `identity_test` database.

- [ ] **Step 2: Write the failing tests**

`identity/tests/conftest.py` (replace the whole file)

```python
import os

os.environ.setdefault(
    "TEST_DATABASE_URL", "postgresql+psycopg://central:central@localhost:5433/identity_test"
)
os.environ.update(
    ENVIRONMENT="test",
    DATABASE_URL=os.environ["TEST_DATABASE_URL"],
    COMPANY_DOMAIN="yourco.com",
    ISSUER_URL="http://localhost:8000",
    KEY_ENCRYPTION_KEY="uB0yq0lqV3m7vJx9I6kzvJ6o4wqkJ7mYwR2fT5bq8nE=",
    SESSION_SECRET="test-session-secret",
    INITIAL_ADMIN_EMAILS="boss@yourco.com",
    PORTAL_URL="http://localhost:3000",
    PORTAL_CLIENT_SECRET="portal-secret",
    DEV_LOGIN_ENABLED="false",
)

from collections.abc import Iterator  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.config import Settings, get_settings  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def engine():
    url = os.environ["TEST_DATABASE_URL"]
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine) -> Iterator[Session]:
    """A session whose commits are rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def settings() -> Settings:
    return get_settings()
```

`identity/tests/factories.py`

```python
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import (
    App,
    AppRole,
    Department,
    DepartmentAppAccess,
    User,
    UserAppOverride,
    UserDepartment,
)
from app.security import hash_secret

CLIENT_SECRET = "app-client-secret"


def make_user(db: Session, email: str | None = None, **fields) -> User:
    email = email or f"user-{uuid.uuid4().hex[:8]}@yourco.com"
    user = User(
        email=email,
        name=fields.pop("name", email.split("@")[0]),
        status=fields.pop("status", "active"),
        is_admin=fields.pop("is_admin", False),
        **fields,
    )
    db.add(user)
    db.flush()
    return user


def make_department(db: Session, slug: str | None = None) -> Department:
    slug = slug or f"dept-{uuid.uuid4().hex[:8]}"
    department = Department(slug=slug, name=slug.title())
    db.add(department)
    db.flush()
    return department


def make_app(
    db: Session,
    slug: str | None = None,
    roles: tuple[tuple[str, int], ...] = (("viewer", 10), ("editor", 20), ("manager", 30)),
    **fields,
) -> tuple[App, dict[str, AppRole]]:
    slug = slug or f"app-{uuid.uuid4().hex[:8]}"
    app = App(
        slug=slug,
        name=fields.pop("name", slug.title()),
        description="",
        icon="",
        launch_url=f"https://{slug}.yourco.com",
        client_id=fields.pop("client_id", slug),
        client_secret_hash=hash_secret(CLIENT_SECRET),
        redirect_uris=fields.pop("redirect_uris", [f"https://{slug}.yourco.com/callback"]),
        post_logout_redirect_uris=fields.pop(
            "post_logout_redirect_uris", [f"https://{slug}.yourco.com/"]
        ),
        status=fields.pop("status", "active"),
        is_system=False,
        **fields,
    )
    db.add(app)
    db.flush()
    role_rows = {}
    for key, rank in roles:
        role = AppRole(app_id=app.id, key=key, label=key.title(), rank=rank)
        db.add(role)
        role_rows[key] = role
    db.flush()
    return app, role_rows


def add_to_department(db: Session, user: User, department: Department) -> None:
    db.add(UserDepartment(user_id=user.id, department_id=department.id))
    db.flush()


def grant_department(db: Session, department: Department, app: App, role: AppRole) -> None:
    db.add(DepartmentAppAccess(department_id=department.id, app_id=app.id, app_role_id=role.id))
    db.flush()


def add_override(
    db: Session,
    user: User,
    app: App,
    effect: str,
    role: AppRole | None = None,
    expires_at: datetime | None = None,
) -> UserAppOverride:
    override = UserAppOverride(
        user_id=user.id,
        app_id=app.id,
        effect=effect,
        app_role_id=role.id if role else None,
        reason="test",
        expires_at=expires_at,
    )
    db.add(override)
    db.flush()
    return override
```

`identity/tests/test_migrations.py`

```python
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import App, AppRole, UserAppOverride
from tests.factories import make_app, make_user


def test_portal_client_is_seeded(db):
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    assert portal.is_system is True
    roles = db.scalars(select(AppRole).where(AppRole.app_id == portal.id)).all()
    assert [(r.key, r.rank) for r in roles] == [("user", 10)]


def test_grant_override_requires_role(db):
    user = make_user(db)
    app, _ = make_app(db)
    db.add(UserAppOverride(user_id=user.id, app_id=app.id, effect="grant", reason="x"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_override_role_must_belong_to_same_app(db):
    user = make_user(db)
    app, _ = make_app(db)
    _, other_roles = make_app(db)
    db.add(
        UserAppOverride(
            user_id=user.id,
            app_id=app.id,
            effect="grant",
            app_role_id=other_roles["viewer"].id,
            reason="x",
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()
```

- [ ] **Step 3: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_migrations.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.models'`

- [ ] **Step 4: Implement**

`identity/app/db.py`

```python
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def get_sessionmaker() -> sessionmaker[Session]:
    global _engine, _SessionLocal
    if _SessionLocal is None:
        _engine = create_engine(get_settings().database_url, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    return _SessionLocal


def get_db() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        yield session
```

`identity/app/security.py`

```python
import hashlib
import secrets
from datetime import UTC, datetime

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_token(nbytes: int = 32) -> str:
    """URL-safe random token for sessions, codes and refresh tokens."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Deterministic lookup hash for high-entropy tokens (not for passwords/secrets)."""
    return hashlib.sha256(token.encode()).hexdigest()


def hash_secret(secret: str) -> str:
    return _hasher.hash(secret)


def verify_secret(secret_hash: str, secret: str) -> bool:
    try:
        return _hasher.verify(secret_hash, secret)
    except (VerificationError, InvalidHashError):
        return False
```

`identity/app/models.py`

```python
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
```

`identity/alembic.ini`

```ini
[alembic]
script_location = migrations
prepend_sys_path = .
path_separator = os
file_template = %%(rev)s_%%(slug)s

[loggers]
keys = root

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARNING
handlers = console

[handler_console]
class = StreamHandler
args = (sys.stderr,)
formatter = generic

[formatter_generic]
format = %(levelname)s %(name)s %(message)s
```

`identity/migrations/env.py`

```python
from alembic import context
from sqlalchemy import create_engine

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.config import get_settings
from app.db import Base

target_metadata = Base.metadata


def run_migrations() -> None:
    url = context.config.attributes.get("database_url") or get_settings().database_url
    engine = create_engine(url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations()
```

`identity/migrations/script.py.mako`

```text
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
"""

import sqlalchemy as sa
from alembic import op
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = None
depends_on = None


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

`identity/migrations/versions/0001_initial_schema.py`

```python
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
```

- [ ] **Step 5: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_migrations.py
```

Expected: `3 passed`

- [ ] **Step 6: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `6 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 7: Confirm the migration matches the models**

```bash
cd identity
cp .env.example .env
uv run alembic upgrade head
uv run alembic check
```

Expected: `No new upgrade operations detected.`

- [ ] **Step 8: Commit**

```bash
git add identity
git commit -m "feat(identity): data model, initial migration and DB test fixtures"
```

---

### Task 3: Access resolution

The role rules from spec §4.2: a pure, table-tested `decide()` plus a loader that reads the database.

**Files:**
- Create: `identity/tests/test_access_decide.py`
- Create: `identity/tests/test_access_resolve.py`
- Create: `identity/app/access.py`

**Interfaces:**
- Consumes models (Task 2).
- Produces dataclasses `RoleRef(id, key, rank)`, `OverrideRef(id, effect, role, expires_at)`, `DepartmentGrant(department_id, role)`, `Decision(role, reason, override_id=None, department_id=None)`.
- Produces `decide(*, user_status, app_status, app_is_system, app_roles, override, department_grants, now) -> Decision`.
- Produces `resolve_access(db, user, app, now=None) -> Decision` and `resolve_role(db, user, app, now=None) -> RoleRef | None`.
- `Decision.reason` is one of `suspended`, `app_disabled`, `system_app`, `override_deny`, `override_grant`, `department`, `no_access`.

- [ ] **Step 1: Write the failing tests**

`identity/tests/test_access_decide.py`

```python
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.access import DepartmentGrant, OverrideRef, RoleRef, decide

NOW = datetime(2026, 9, 16, 12, 0, tzinfo=UTC)
VIEWER = RoleRef(uuid.uuid4(), "viewer", 10)
EDITOR = RoleRef(uuid.uuid4(), "editor", 20)
MANAGER = RoleRef(uuid.uuid4(), "manager", 30)
SALES = uuid.uuid4()
FINANCE = uuid.uuid4()


def _decide(**overrides):
    args = dict(
        user_status="active",
        app_status="active",
        app_is_system=False,
        app_roles=[VIEWER, EDITOR, MANAGER],
        override=None,
        department_grants=[],
        now=NOW,
    )
    args.update(overrides)
    return decide(**args)


def _override(effect, role=None, expires_at=None):
    return OverrideRef(id=uuid.uuid4(), effect=effect, role=role, expires_at=expires_at)


CASES = [
    ("no access by default", {}, None, "no_access"),
    (
        "suspended beats everything",
        {"user_status": "suspended", "override": _override("grant", MANAGER)},
        None,
        "suspended",
    ),
    (
        "disabled app",
        {"app_status": "disabled", "department_grants": [DepartmentGrant(SALES, VIEWER)]},
        None,
        "app_disabled",
    ),
    ("system app gives lowest role", {"app_is_system": True}, VIEWER, "system_app"),
    ("system app with no roles", {"app_is_system": True, "app_roles": []}, None, "no_access"),
    (
        "single department",
        {"department_grants": [DepartmentGrant(SALES, EDITOR)]},
        EDITOR,
        "department",
    ),
    (
        "highest department role wins",
        {"department_grants": [DepartmentGrant(FINANCE, VIEWER), DepartmentGrant(SALES, MANAGER)]},
        MANAGER,
        "department",
    ),
    (
        "deny beats department",
        {"override": _override("deny"), "department_grants": [DepartmentGrant(SALES, MANAGER)]},
        None,
        "override_deny",
    ),
    (
        "grant replaces a higher department role",
        {
            "override": _override("grant", VIEWER),
            "department_grants": [DepartmentGrant(SALES, MANAGER)],
        },
        VIEWER,
        "override_grant",
    ),
    (
        "grant without departments",
        {"override": _override("grant", EDITOR)},
        EDITOR,
        "override_grant",
    ),
    (
        "future expiry still active",
        {
            "override": _override("deny", expires_at=NOW + timedelta(seconds=1)),
            "department_grants": [DepartmentGrant(SALES, VIEWER)],
        },
        None,
        "override_deny",
    ),
    (
        "expired deny is ignored",
        {
            "override": _override("deny", expires_at=NOW),
            "department_grants": [DepartmentGrant(SALES, VIEWER)],
        },
        VIEWER,
        "department",
    ),
    (
        "expired grant falls back to no access",
        {"override": _override("grant", MANAGER, expires_at=NOW - timedelta(days=1))},
        None,
        "no_access",
    ),
]


@pytest.mark.parametrize(("case", "kwargs", "expected_role", "expected_reason"), CASES)
def test_decide(case, kwargs, expected_role, expected_reason):
    decision = _decide(**kwargs)
    assert decision.role == expected_role, case
    assert decision.reason == expected_reason, case


def test_decision_reports_winning_department():
    grants = [DepartmentGrant(FINANCE, VIEWER), DepartmentGrant(SALES, MANAGER)]
    assert _decide(department_grants=grants).department_id == SALES
```

`identity/tests/test_access_resolve.py`

```python
from datetime import timedelta

from app.access import resolve_access, resolve_role
from app.security import utcnow
from tests.factories import (
    add_override,
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)


def test_resolves_highest_role_across_departments(db):
    user = make_user(db)
    sales, finance = make_department(db), make_department(db)
    add_to_department(db, user, sales)
    add_to_department(db, user, finance)
    app, roles = make_app(db)
    grant_department(db, sales, app, roles["manager"])
    grant_department(db, finance, app, roles["viewer"])

    decision = resolve_access(db, user, app)

    assert decision.role.key == "manager"
    assert decision.department_id == sales.id


def test_ignores_departments_the_user_is_not_in(db):
    user = make_user(db)
    other = make_department(db)
    app, roles = make_app(db)
    grant_department(db, other, app, roles["manager"])

    assert resolve_role(db, user, app) is None


def test_ignores_grants_for_other_apps(db):
    user = make_user(db)
    sales = make_department(db)
    add_to_department(db, user, sales)
    crm, crm_roles = make_app(db)
    invoicing, _ = make_app(db)
    grant_department(db, sales, crm, crm_roles["viewer"])

    assert resolve_role(db, user, invoicing) is None


def test_override_grant_and_expiry(db):
    user = make_user(db)
    app, roles = make_app(db)
    add_override(db, user, app, "grant", roles["viewer"], expires_at=utcnow() + timedelta(days=1))

    assert resolve_role(db, user, app).key == "viewer"
    assert resolve_role(db, user, app, now=utcnow() + timedelta(days=2)) is None
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_access_decide.py tests/test_access_resolve.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.access'`

- [ ] **Step 3: Implement**

`identity/app/access.py`

```python
"""Access resolution: which role (if any) a user has in an app. See spec §4.2."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import App, AppRole, DepartmentAppAccess, User, UserAppOverride, UserDepartment
from app.security import utcnow


@dataclass(frozen=True)
class RoleRef:
    id: uuid.UUID
    key: str
    rank: int


@dataclass(frozen=True)
class OverrideRef:
    id: uuid.UUID
    effect: str  # "grant" | "deny"
    role: RoleRef | None
    expires_at: datetime | None


@dataclass(frozen=True)
class DepartmentGrant:
    department_id: uuid.UUID
    role: RoleRef


@dataclass(frozen=True)
class Decision:
    role: RoleRef | None
    # suspended | app_disabled | system_app | override_deny | override_grant
    # | department | no_access
    reason: str
    override_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None


def decide(
    *,
    user_status: str,
    app_status: str,
    app_is_system: bool,
    app_roles: list[RoleRef],
    override: OverrideRef | None,
    department_grants: list[DepartmentGrant],
    now: datetime,
) -> Decision:
    if user_status != "active":
        return Decision(None, "suspended")
    if app_status != "active":
        return Decision(None, "app_disabled")
    if app_is_system:
        if not app_roles:
            return Decision(None, "no_access")
        return Decision(min(app_roles, key=lambda r: r.rank), "system_app")
    if override is not None and (override.expires_at is None or override.expires_at > now):
        if override.effect == "deny":
            return Decision(None, "override_deny", override_id=override.id)
        return Decision(override.role, "override_grant", override_id=override.id)
    if department_grants:
        best = max(department_grants, key=lambda g: g.role.rank)
        return Decision(best.role, "department", department_id=best.department_id)
    return Decision(None, "no_access")


def _role_ref(role: AppRole) -> RoleRef:
    return RoleRef(id=role.id, key=role.key, rank=role.rank)


def resolve_access(db: Session, user: User, app: App, now: datetime | None = None) -> Decision:
    now = now or utcnow()
    role_rows = db.scalars(select(AppRole).where(AppRole.app_id == app.id))
    roles = {r.id: _role_ref(r) for r in role_rows}

    override_row = db.scalar(
        select(UserAppOverride).where(
            UserAppOverride.user_id == user.id, UserAppOverride.app_id == app.id
        )
    )
    override = None
    if override_row is not None:
        override = OverrideRef(
            id=override_row.id,
            effect=override_row.effect,
            role=roles.get(override_row.app_role_id) if override_row.app_role_id else None,
            expires_at=override_row.expires_at,
        )

    grant_rows = db.execute(
        select(DepartmentAppAccess.department_id, DepartmentAppAccess.app_role_id)
        .join(UserDepartment, UserDepartment.department_id == DepartmentAppAccess.department_id)
        .where(UserDepartment.user_id == user.id, DepartmentAppAccess.app_id == app.id)
    ).all()
    grants = [DepartmentGrant(department_id=d, role=roles[r]) for d, r in grant_rows]

    return decide(
        user_status=user.status,
        app_status=app.status,
        app_is_system=app.is_system,
        app_roles=list(roles.values()),
        override=override,
        department_grants=grants,
        now=now,
    )


def resolve_role(db: Session, user: User, app: App, now: datetime | None = None) -> RoleRef | None:
    return resolve_access(db, user, app, now).role
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_access_decide.py tests/test_access_resolve.py
```

Expected: `18 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `24 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): access resolution rules"
```

---

### Task 4: Browser sessions, signing keys, audit, bootstrap

Identity-host sessions with idle/absolute expiry and revocation; encrypted RSA signing keys with rotation and a JWKS that keeps retired keys for 24 h; the audit recorder; startup bootstrap.

**Files:**
- Create: `identity/tests/test_sessions.py`
- Create: `identity/tests/test_keys.py`
- Create: `identity/tests/test_bootstrap.py`
- Create: `identity/app/audit.py`
- Create: `identity/app/sessions.py`
- Create: `identity/app/keys.py`
- Create: `identity/app/bootstrap.py`

**Interfaces:**
- Consumes `app.security` (Task 2), `resolve_role` (Task 3, in tests).
- Produces `app.audit.record(db, event, *, request=None, actor_user_id=None, subject_user_id=None, app_id=None, detail=None)` — adds a row to the current transaction; the caller commits.
- Produces `app.sessions`: `SESSION_COOKIE`, `IDLE_TIMEOUT` (12 h), `ABSOLUTE_TIMEOUT` (24 h), `create_session(db, user) -> (AuthSession, token)`, `is_session_active(row)`, `get_active_session(db, token) -> (AuthSession, User) | None`, `touch(row)`, `revoke_session(db, session_id)`, `revoke_all_for_user(db, user_id)`, `revoke_family(db, family_id)`.
- Produces `app.keys`: `ActiveKey(kid, key)` with `.key_set`, `ensure_active_key(db, encryption_key)`, `rotate(db, encryption_key) -> kid` (caller commits), `get_active_key(db, encryption_key)`, `public_jwks(db) -> dict`, `public_key_set(db) -> KeySet`.
- Produces `app.bootstrap`: `PORTAL_CLIENT_ID = "portal"`, `ensure_portal_app(db, settings)`, `bootstrap(db, settings)`.

- [ ] **Step 1: Write the failing tests**

`identity/tests/test_sessions.py`

```python
import uuid
from datetime import timedelta

from app.models import RefreshToken
from app.security import hash_token, utcnow
from app.sessions import create_session, get_active_session, revoke_all_for_user, revoke_session
from tests.factories import make_user


def _refresh_row(db, auth_session):
    now = utcnow()
    row = RefreshToken(
        token_hash=hash_token(uuid.uuid4().hex),
        family_id=uuid.uuid4(),
        client_id="crm",
        user_id=auth_session.user_id,
        session_id=auth_session.id,
        scope="openid",
        created_at=now,
        expires_at=now + timedelta(hours=1),
        family_expires_at=now + timedelta(hours=2),
    )
    db.add(row)
    db.flush()
    return row


def test_create_and_lookup_session(db):
    user = make_user(db)
    auth_session, token = create_session(db, user)
    assert auth_session.token_hash != token
    assert get_active_session(db, token) == (auth_session, user)
    assert get_active_session(db, "wrong") is None
    assert get_active_session(db, None) is None


def test_idle_expired_session_is_inactive(db):
    user = make_user(db)
    auth_session, token = create_session(db, user)
    auth_session.idle_expires_at = utcnow() - timedelta(seconds=1)
    assert get_active_session(db, token) is None


def test_suspended_user_session_is_inactive(db):
    user = make_user(db)
    _, token = create_session(db, user)
    user.status = "suspended"
    assert get_active_session(db, token) is None


def test_revoke_session_revokes_its_refresh_tokens(db):
    user = make_user(db)
    auth_session, token = create_session(db, user)
    refresh = _refresh_row(db, auth_session)
    revoke_session(db, auth_session.id)
    db.expire_all()
    assert get_active_session(db, token) is None
    assert db.get(RefreshToken, refresh.id).revoked_at is not None


def test_revoke_all_for_user(db):
    user = make_user(db)
    first, _ = create_session(db, user)
    second, _ = create_session(db, user)
    _, other_token = create_session(db, make_user(db))
    revoke_all_for_user(db, user.id)
    db.expire_all()
    assert first.revoked_at and second.revoked_at
    assert get_active_session(db, other_token) is not None
```

`identity/tests/test_keys.py`

```python
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
```

`identity/tests/test_bootstrap.py`

```python
from sqlalchemy import select

from app.access import resolve_role
from app.bootstrap import bootstrap
from app.models import App
from app.security import verify_secret
from tests.factories import make_user


def test_bootstrap_syncs_portal_client_from_settings(db, settings):
    bootstrap(db, settings)
    bootstrap(db, settings)
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    assert portal.redirect_uris == ["http://localhost:3000/api/auth/callback/identity"]
    assert portal.post_logout_redirect_uris == ["http://localhost:3000"]
    assert verify_secret(portal.client_secret_hash, settings.portal_client_secret)


def test_portal_is_available_to_every_active_user(db, settings):
    bootstrap(db, settings)
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    assert resolve_role(db, make_user(db), portal).key == "user"
    assert resolve_role(db, make_user(db, status="suspended"), portal) is None
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_sessions.py tests/test_keys.py tests/test_bootstrap.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.sessions'`

- [ ] **Step 3: Implement**

`identity/app/audit.py`

```python
import uuid

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog
from app.security import utcnow


def record(
    db: Session,
    event: str,
    *,
    request: Request | None = None,
    actor_user_id: uuid.UUID | None = None,
    subject_user_id: uuid.UUID | None = None,
    app_id: uuid.UUID | None = None,
    detail: dict | None = None,
) -> None:
    """Add an audit entry to the current transaction (caller commits)."""
    db.add(
        AuditLog(
            at=utcnow(),
            event=event,
            actor_user_id=actor_user_id,
            subject_user_id=subject_user_id,
            app_id=app_id,
            detail=detail or {},
            request_id=getattr(request.state, "request_id", None) if request else None,
            ip=request.client.host if request and request.client else None,
        )
    )
```

`identity/app/sessions.py`

```python
"""Browser sessions on the identity host. See spec §5.1, §5.6."""

import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import AuthSession, RefreshToken, User
from app.security import hash_token, new_token, utcnow

SESSION_COOKIE = "identity_session"
IDLE_TIMEOUT = timedelta(hours=12)
ABSOLUTE_TIMEOUT = timedelta(hours=24)


def create_session(db: Session, user: User) -> tuple[AuthSession, str]:
    token = new_token()
    now = utcnow()
    row = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        created_at=now,
        last_seen_at=now,
        idle_expires_at=now + IDLE_TIMEOUT,
        absolute_expires_at=now + ABSOLUTE_TIMEOUT,
    )
    db.add(row)
    db.flush()
    return row, token


def is_session_active(row: AuthSession) -> bool:
    now = utcnow()
    return row.revoked_at is None and row.idle_expires_at > now and row.absolute_expires_at > now


def get_active_session(db: Session, token: str | None) -> tuple[AuthSession, User] | None:
    if not token:
        return None
    row = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if row is None or not is_session_active(row):
        return None
    user = db.get(User, row.user_id)
    if user is None or user.status != "active":
        return None
    return row, user


def touch(row: AuthSession) -> None:
    now = utcnow()
    row.last_seen_at = now
    row.idle_expires_at = now + IDLE_TIMEOUT


def revoke_session(db: Session, session_id: uuid.UUID) -> None:
    now = utcnow()
    db.execute(
        update(AuthSession)
        .where(AuthSession.id == session_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.session_id == session_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def revoke_all_for_user(db: Session, user_id: uuid.UUID) -> None:
    now = utcnow()
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def revoke_family(db: Session, family_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
```

`identity/app/keys.py`

```python
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
```

`identity/app/bootstrap.py`

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.keys import ensure_active_key
from app.models import App
from app.security import hash_secret, verify_secret

PORTAL_CLIENT_ID = "portal"


def ensure_portal_app(db: Session, settings: Settings) -> None:
    """Sync the migration-seeded portal client with configuration."""
    app = db.scalar(select(App).where(App.client_id == PORTAL_CLIENT_ID))
    if app is None:
        raise RuntimeError("Portal app missing; run `alembic upgrade head`")
    app.launch_url = settings.portal_url
    app.redirect_uris = [settings.portal_redirect_uri]
    app.post_logout_redirect_uris = [settings.portal_url]
    if not verify_secret(app.client_secret_hash, settings.portal_client_secret):
        app.client_secret_hash = hash_secret(settings.portal_client_secret)
    db.commit()


def bootstrap(db: Session, settings: Settings) -> None:
    ensure_active_key(db, settings.key_encryption_key)
    ensure_portal_app(db, settings)
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_sessions.py tests/test_keys.py tests/test_bootstrap.py
```

Expected: `10 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `34 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): sessions, signing keys, audit and bootstrap"
```

---

### Task 5: Login service

Turn a verified Google identity into a user and session: domain and verified-email checks, just-in-time creation, linking by email, admin bootstrap, suspension (spec §5.2).

**Files:**
- Create: `identity/tests/test_login.py`
- Create: `identity/app/login.py`

**Interfaces:**
- Consumes `audit.record`, `sessions.create_session` (Task 4).
- Produces `app.login`: `GoogleIdentity(sub, email, email_verified, hd, name, picture)`, `LoginDenied(reason)` with reason `wrong_domain | suspended | unknown_user`, `complete_google_login(db, settings, identity, request=None) -> (AuthSession, token)`, `complete_dev_login(db, settings, user_id, request=None) -> (AuthSession, token)`.

- [ ] **Step 1: Write the failing tests**

`identity/tests/test_login.py`

```python
import pytest
from sqlalchemy import select

from app.login import GoogleIdentity, LoginDenied, complete_google_login
from app.models import AuditLog, User
from tests.factories import make_user


def _identity(**overrides) -> GoogleIdentity:
    fields = dict(
        sub="google-1",
        email="Priya@yourco.com",
        email_verified=True,
        hd="yourco.com",
        name="Priya Sharma",
        picture="https://img/p.png",
    )
    fields.update(overrides)
    return GoogleIdentity(**fields)


def test_first_login_creates_user_without_access(db, settings):
    auth_session, token = complete_google_login(db, settings, _identity())
    user = db.scalar(select(User).where(User.google_sub == "google-1"))
    assert user.email == "priya@yourco.com"
    assert user.is_admin is False
    assert auth_session.user_id == user.id and token
    assert db.scalar(select(AuditLog).where(AuditLog.event == "user_created"))


def test_returning_user_profile_is_refreshed(db, settings):
    complete_google_login(db, settings, _identity())
    complete_google_login(db, settings, _identity(name="Priya S.", picture=None))
    user = db.scalar(select(User).where(User.google_sub == "google-1"))
    assert user.name == "Priya S." and user.avatar_url is None
    assert user.last_login_at is not None


def test_existing_user_is_linked_by_email(db, settings):
    existing = make_user(db, email="priya@yourco.com")
    complete_google_login(db, settings, _identity())
    assert db.get(User, existing.id).google_sub == "google-1"


@pytest.mark.parametrize(
    "identity",
    [_identity(hd="gmail.com"), _identity(hd=None), _identity(email_verified=False)],
)
def test_wrong_domain_or_unverified_is_denied(db, settings, identity):
    with pytest.raises(LoginDenied) as denied:
        complete_google_login(db, settings, identity)
    assert denied.value.reason == "wrong_domain"
    assert db.scalar(select(User)) is None
    assert db.scalar(select(AuditLog).where(AuditLog.event == "login_denied"))


def test_suspended_user_is_denied(db, settings):
    make_user(db, email="priya@yourco.com", google_sub="google-1", status="suspended")
    with pytest.raises(LoginDenied) as denied:
        complete_google_login(db, settings, _identity())
    assert denied.value.reason == "suspended"


def test_initial_admin_is_bootstrapped(db, settings):
    complete_google_login(db, settings, _identity(sub="g-boss", email="boss@yourco.com"))
    assert db.scalar(select(User).where(User.email == "boss@yourco.com")).is_admin is True
    assert db.scalar(select(AuditLog).where(AuditLog.event == "admin_bootstrapped"))
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_login.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.login'`

- [ ] **Step 3: Implement**

`identity/app/login.py`

```python
"""Turning a verified upstream identity into a user and a browser session. See spec §5.2."""

import uuid
from dataclasses import dataclass

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings
from app.models import AuthSession, User
from app.security import utcnow
from app.sessions import create_session


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    hd: str | None
    name: str
    picture: str | None


class LoginDenied(Exception):
    def __init__(self, reason: str):  # "wrong_domain" | "suspended" | "unknown_user"
        super().__init__(reason)
        self.reason = reason


def complete_google_login(
    db: Session, settings: Settings, identity: GoogleIdentity, request: Request | None = None
) -> tuple[AuthSession, str]:
    if identity.hd != settings.company_domain or not identity.email_verified:
        audit.record(
            db,
            "login_denied",
            request=request,
            detail={"reason": "wrong_domain", "email": identity.email, "hd": identity.hd},
        )
        db.commit()
        raise LoginDenied("wrong_domain")

    email = identity.email.lower()
    user = db.scalar(select(User).where(User.google_sub == identity.sub))
    if user is None:
        user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            google_sub=identity.sub,
            email=email,
            name=identity.name,
            avatar_url=identity.picture,
            status="active",
            is_admin=False,
        )
        db.add(user)
        db.flush()
        audit.record(db, "user_created", request=request, subject_user_id=user.id)
    else:
        user.google_sub = identity.sub
        user.email = email
        user.name = identity.name
        user.avatar_url = identity.picture

    return _start_session(db, settings, user, request)


def complete_dev_login(
    db: Session, settings: Settings, user_id: uuid.UUID, request: Request | None = None
) -> tuple[AuthSession, str]:
    user = db.get(User, user_id)
    if user is None:
        raise LoginDenied("unknown_user")
    return _start_session(db, settings, user, request)


def _start_session(
    db: Session, settings: Settings, user: User, request: Request | None
) -> tuple[AuthSession, str]:
    if user.email in settings.admin_emails and not user.is_admin:
        user.is_admin = True
        audit.record(db, "admin_bootstrapped", request=request, subject_user_id=user.id)

    if user.status != "active":
        audit.record(
            db,
            "login_denied",
            request=request,
            subject_user_id=user.id,
            detail={"reason": "suspended"},
        )
        db.commit()
        raise LoginDenied("suspended")

    user.last_login_at = utcnow()
    session, token = create_session(db, user)
    audit.record(db, "login", request=request, subject_user_id=user.id)
    db.commit()
    return session, token
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_login.py
```

Expected: `8 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `42 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): Google login service with just-in-time provisioning"
```

---

### Task 6: Web application shell

FastAPI app factory with request IDs, JSON logs, HSTS, the flow-state cookie, HTML message pages, rate limiting and health endpoints; client test fixtures.

**Files:**
- Create: `identity/tests/test_platform.py`
- Create: `identity/app/pages.py`
- Create: `identity/app/templates/base.html`
- Create: `identity/app/templates/message.html`
- Create: `identity/app/ratelimit.py`
- Create: `identity/app/observability.py`
- Create: `identity/app/routes/__init__.py`
- Create: `identity/app/routes/health.py`
- Create: `identity/app/main.py`
- Modify: `identity/tests/conftest.py`

**Interfaces:**
- Produces `app.main.create_app(run_bootstrap=True) -> FastAPI`; run it with `uvicorn app.main:create_app --factory`.
- Produces `app.pages.render_message(request, status_code, title, message, link_url=None, link_label=None)` and `app.pages.templates`.
- Produces `app.ratelimit.rate_limit(limit, window_seconds=60)` (dependency factory, per-IP) and `FixedWindowLimiter`.
- Produces fixtures `make_client(**env_overrides) -> TestClient` and `client` (base URL = issuer, redirects not followed, `get_db` bound to the test session).
- Later tasks add routers to `create_app` with the exact edits shown in their steps.

- [ ] **Step 1: Write the failing tests**

`identity/tests/conftest.py` (replace the whole file)

```python
import os

os.environ.setdefault(
    "TEST_DATABASE_URL", "postgresql+psycopg://central:central@localhost:5433/identity_test"
)
os.environ.update(
    ENVIRONMENT="test",
    DATABASE_URL=os.environ["TEST_DATABASE_URL"],
    COMPANY_DOMAIN="yourco.com",
    ISSUER_URL="http://localhost:8000",
    KEY_ENCRYPTION_KEY="uB0yq0lqV3m7vJx9I6kzvJ6o4wqkJ7mYwR2fT5bq8nE=",
    SESSION_SECRET="test-session-secret",
    INITIAL_ADMIN_EMAILS="boss@yourco.com",
    PORTAL_URL="http://localhost:3000",
    PORTAL_CLIENT_SECRET="portal-secret",
    DEV_LOGIN_ENABLED="false",
)

from collections.abc import Iterator  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.bootstrap import bootstrap  # noqa: E402
from app.config import Settings, get_settings  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import create_app  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def engine():
    url = os.environ["TEST_DATABASE_URL"]
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine) -> Iterator[Session]:
    """A session whose commits are rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def settings() -> Settings:
    return get_settings()


@pytest.fixture
def make_client(db, settings):
    """Build a TestClient bound to the per-test session; kwargs override settings (env names)."""

    def factory(**setting_overrides: str) -> TestClient:
        previous = {key.upper(): os.environ.get(key.upper()) for key in setting_overrides}
        os.environ.update({key.upper(): value for key, value in setting_overrides.items()})
        get_settings.cache_clear()
        try:
            app = create_app(run_bootstrap=False)
            app_settings = get_settings()
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            get_settings.cache_clear()
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_settings] = lambda: app_settings
        return TestClient(app, base_url=settings.issuer_url, follow_redirects=False)

    bootstrap(db, settings)
    return factory


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()
```

`identity/tests/test_platform.py`

```python
from app.ratelimit import FixedWindowLimiter


def test_fixed_window_limiter():
    now = [0.0]
    limiter = FixedWindowLimiter(limit=2, window_seconds=60, clock=lambda: now[0])
    assert limiter.allow("ip") and limiter.allow("ip")
    assert not limiter.allow("ip")
    assert limiter.allow("other-ip")
    now[0] = 61.0
    assert limiter.allow("ip")


def test_health_and_readiness(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").status_code == 200


def test_request_id_is_echoed_or_generated(client):
    echoed = client.get("/healthz", headers={"X-Request-ID": "abc-123"})
    assert echoed.headers["x-request-id"] == "abc-123"
    generated = client.get("/healthz", headers={"X-Request-ID": "bad id!"}).headers["x-request-id"]
    assert generated != "bad id!" and len(generated) == 32
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_platform.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Implement**

`identity/app/pages.py`

```python
from pathlib import Path

from fastapi import Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory=Path(__file__).parent / "templates")


def render_message(
    request: Request,
    status_code: int,
    title: str,
    message: str,
    link_url: str | None = None,
    link_label: str | None = None,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request,
        "message.html",
        {
            "title": title,
            "message": message,
            "link_url": link_url,
            "link_label": link_label,
            "request_id": getattr(request.state, "request_id", ""),
        },
        status_code=status_code,
    )
```

`identity/app/templates/base.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}Sign in{% endblock %}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f6f7f9; color: #1d2330; margin: 0; }
    main { max-width: 28rem; margin: 12vh auto; padding: 2rem; background: #fff;
           border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 1.25rem; margin: 0 0 .75rem; }
    p { line-height: 1.5; }
    a.button, button { display: inline-block; padding: .6rem 1rem; border-radius: 8px; border: 0;
           background: #2f5bea; color: #fff; text-decoration: none; font: inherit; cursor: pointer; }
    .muted { color: #6b7280; font-size: .8rem; margin-top: 1.5rem; }
    ul { list-style: none; padding: 0; } li { margin: .5rem 0; }
  </style>
</head>
<body><main>{% block content %}{% endblock %}</main></body>
</html>
```

`identity/app/templates/message.html`

```html
{% extends "base.html" %}
{% block title %}{{ title }}{% endblock %}
{% block content %}
  <h1>{{ title }}</h1>
  <p>{{ message }}</p>
  {% if link_url %}<a class="button" href="{{ link_url }}">{{ link_label }}</a>{% endif %}
  {% if request_id %}<p class="muted">Reference: {{ request_id }}</p>{% endif %}
{% endblock %}
```

`identity/app/ratelimit.py`

```python
"""Per-instance fixed-window rate limiting keyed by client IP."""

import threading
import time
from collections.abc import Callable

from fastapi import HTTPException, Request


class FixedWindowLimiter:
    def __init__(
        self, limit: int, window_seconds: int, clock: Callable[[], float] = time.monotonic
    ):
        self.limit = limit
        self.window_seconds = window_seconds
        self.clock = clock
        self._windows: dict[str, tuple[int, int]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        window = int(self.clock() // self.window_seconds)
        with self._lock:
            current_window, count = self._windows.get(key, (window, 0))
            if current_window != window:
                count = 0
                if len(self._windows) > 10_000:
                    self._windows.clear()
            if count >= self.limit:
                self._windows[key] = (window, count)
                return False
            self._windows[key] = (window, count + 1)
            return True


def rate_limit(limit: int, window_seconds: int = 60) -> Callable[[Request], None]:
    limiter = FixedWindowLimiter(limit, window_seconds)

    def dependency(request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        if not limiter.allow(key):
            raise HTTPException(
                429, "Too many requests", headers={"Retry-After": str(window_seconds)}
            )

    return dependency
```

`identity/app/observability.py`

```python
import json
import logging
import re
import time
import uuid

from fastapi import Request

logger = logging.getLogger("identity")
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"level": record.levelname, "logger": record.name, "message": record.getMessage()}
        payload.update(getattr(record, "fields", {}))
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


def request_context_middleware(hsts: bool):
    async def middleware(request: Request, call_next):
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if _REQUEST_ID_RE.match(incoming) else uuid.uuid4().hex
        request.state.request_id = request_id
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        if hsts:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        logger.info(
            "request",
            extra={
                "fields": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            },
        )
        return response

    return middleware
```

`identity/app/routes/__init__.py` — empty file (package marker).

`identity/app/routes/health.py`

```python
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SigningKey

router = APIRouter()


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
def readyz(db: Session = Depends(get_db)) -> JSONResponse:
    try:
        db.execute(text("SELECT 1"))
        active = db.scalar(select(SigningKey.kid).where(SigningKey.retired_at.is_(None)))
    except Exception:
        return JSONResponse({"status": "unavailable", "database": False}, status_code=503)
    if active is None:
        return JSONResponse({"status": "unavailable", "signing_key": False}, status_code=503)
    return JSONResponse({"status": "ok"})
```

`identity/app/main.py`

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.bootstrap import bootstrap
from app.config import get_settings
from app.db import get_sessionmaker
from app.observability import configure_logging, request_context_middleware
from app.routes import health


def create_app(run_bootstrap: bool = True) -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if run_bootstrap:
            configure_logging()
            with get_sessionmaker()() as db:
                bootstrap(db, settings)
        yield

    is_prod = settings.environment == "production"
    app = FastAPI(
        title="Identity Service",
        lifespan=lifespan,
        docs_url=None if is_prod else "/docs",
        redoc_url=None,
        openapi_url=None if is_prod else "/openapi.json",
    )
    app.middleware("http")(request_context_middleware(hsts=settings.secure_cookies))
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="identity_flow",
        max_age=600,
        same_site="lax",
        https_only=settings.secure_cookies,
    )
    app.include_router(health.router)
    return app
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_platform.py
```

Expected: `3 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `45 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): app shell, observability, rate limiting and health checks"
```

---

### Task 7: OIDC authorization code flow

Discovery, JWKS, `/authorize` and `/token` on Authlib's framework-neutral server: authorization code with mandatory S256 PKCE and nonce, rotating refresh tokens with reuse detection, JWT access tokens and ID tokens carrying the per-app role.

**Files:**
- Create: `identity/tests/oidc_helpers.py`
- Create: `identity/tests/test_oidc_flow.py`
- Create: `identity/tests/test_oidc_negative.py`
- Create: `identity/app/oauth/__init__.py`
- Create: `identity/app/oauth/requests.py`
- Create: `identity/app/oauth/tokens.py`
- Create: `identity/app/oauth/server.py`
- Create: `identity/app/routes/oidc.py`
- Modify: `identity/app/main.py`

**Interfaces:**
- Consumes `resolve_role` (Task 3); sessions, keys, audit (Task 4); `render_message`, `rate_limit` (Task 6).
- Produces `app.oauth.requests`: `IdentityOAuth2Request`, `build_oauth_request(request, issuer_url)`.
- Produces `app.oauth.server`: `IdentityServer(db, settings)` with `.ctx` and `.resolve_role_for(user, client)`; `OAuthClient`; constants `ACCESS_TOKEN_TTL = 900`, `ID_TOKEN_TTL = 900`, `SUPPORTED_SCOPES`.
- Produces `app.oauth.tokens`: `InvalidToken`, `verify_access_token(token, keys, issuer, audience) -> dict` (requires `typ: at+jwt`), `read_id_token_hint(token, keys, issuer) -> dict` (ignores expiry).
- Produces test helpers `tests/oidc_helpers.py`: `sign_in`, `auth_request`, `query_of`, `authorize_code`, `exchange_code`, `refresh`, `full_login`, `portal_token`.

**Notes:**
- Authlib ships server integrations only for Flask and Django. `app/oauth/requests.py` is the small adapter for FastAPI: route handlers stay synchronous (Authlib and SQLAlchemy calls are blocking) and an async dependency reads the form body first.
- The request URI given to Authlib is rebuilt from `ISSUER_URL`, so Authlib's HTTPS check sees the public scheme behind a TLS-terminating proxy.
- `IdentityServer` is built per request around the request's DB session. `IssueContext` carries the session id and resolved role into the token generator and ID token, which Authlib does not pass through.
- `/token` commits on success. On an error it rolls back, except when a reuse was detected (`ctx.commit_on_error`), so the revocation persists.

- [ ] **Step 1: Write the failing tests**

`identity/tests/oidc_helpers.py`

```python
import secrets
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

from authlib.oauth2.rfc7636 import create_s256_code_challenge
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import App, User
from app.sessions import SESSION_COOKIE, create_session
from tests.factories import CLIENT_SECRET


@dataclass
class AuthRequest:
    params: dict[str, str]
    verifier: str


def sign_in(client: TestClient, db: Session, user: User) -> str:
    """Give the test browser an identity-service session cookie."""
    auth_session, token = create_session(db, user)
    db.commit()
    client.cookies.set(SESSION_COOKIE, token)
    return str(auth_session.id)


def auth_request(app: App, **overrides: str | None) -> AuthRequest:
    verifier = secrets.token_urlsafe(48)
    params = {
        "response_type": "code",
        "client_id": app.client_id,
        "redirect_uri": app.redirect_uris[0],
        "scope": "openid email profile",
        "state": "state-123",
        "nonce": secrets.token_urlsafe(16),
        "code_challenge": create_s256_code_challenge(verifier),
        "code_challenge_method": "S256",
    }
    for key, value in overrides.items():
        if value is None:
            params.pop(key, None)
        else:
            params[key] = value
    return AuthRequest(params=params, verifier=verifier)


def query_of(location: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlsplit(location).query).items()}


def authorize_code(client: TestClient, app: App) -> tuple[str, AuthRequest]:
    request = auth_request(app)
    response = client.get("/authorize", params=request.params)
    assert response.status_code == 302, response.text
    query = query_of(response.headers["location"])
    assert query["state"] == "state-123"
    return query["code"], request


def exchange_code(
    client: TestClient,
    app: App,
    code: str,
    request: AuthRequest,
    secret: str = CLIENT_SECRET,
    **overrides: str | None,
):
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": request.params["redirect_uri"],
        "code_verifier": request.verifier,
    }
    for key, value in overrides.items():
        if value is None:
            data.pop(key, None)
        else:
            data[key] = value
    return client.post("/token", data=data, auth=(app.client_id, secret))


def refresh(client: TestClient, app: App, refresh_token: str, secret: str = CLIENT_SECRET):
    return client.post(
        "/token",
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        auth=(app.client_id, secret),
    )


def full_login(client: TestClient, app: App, secret: str = CLIENT_SECRET) -> dict:
    code, request = authorize_code(client, app)
    response = exchange_code(client, app, code, request, secret=secret)
    assert response.status_code == 200, response.text
    return response.json() | {"nonce": request.params["nonce"]}


def portal_token(client: TestClient, db: Session, user: User, settings) -> str:
    """Access token for the portal client (aud=portal), as the portal's server would hold."""
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    sign_in(client, db, user)
    tokens = full_login(client, portal, secret=settings.portal_client_secret)
    client.cookies.clear()
    return tokens["access_token"]
```

`identity/tests/test_oidc_flow.py`

```python
from joserfc import jwt
from joserfc.jwk import KeySet
from sqlalchemy import select

from app.models import AuditLog, User
from tests.factories import (
    add_override,
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import auth_request, full_login, refresh, sign_in


def _app_with_member(db, role="editor"):
    user = make_user(db, name="Priya Sharma")
    dept = make_department(db)
    add_to_department(db, user, dept)
    app, roles = make_app(db, slug="invoicing")
    grant_department(db, dept, app, roles[role])
    return user, app, roles


def _decode(client, token):
    keys = KeySet.import_key_set(client.get("/jwks").json())
    return jwt.decode(token, keys, algorithms=["RS256"])


def test_discovery_document(client, settings):
    doc = client.get("/.well-known/openid-configuration").json()
    assert doc["issuer"] == settings.issuer_url
    assert doc["jwks_uri"] == f"{settings.issuer_url}/jwks"
    assert doc["code_challenge_methods_supported"] == ["S256"]


def test_jwks_is_cacheable_and_public_only(client):
    response = client.get("/jwks")
    assert response.headers["cache-control"] == "public, max-age=300"
    [key] = response.json()["keys"]
    assert key["kty"] == "RSA" and "d" not in key


def test_unauthenticated_authorize_redirects_to_login(client, db):
    _, app, _ = _app_with_member(db)
    response = client.get("/authorize", params=auth_request(app).params)
    assert response.status_code == 303
    assert response.headers["location"] == "/login"


def test_code_flow_issues_tokens_with_app_role(client, db, settings):
    user, app, _ = _app_with_member(db, role="editor")
    sid = sign_in(client, db, user)

    tokens = full_login(client, app)

    assert tokens["token_type"] == "Bearer"
    assert tokens["expires_in"] == 900
    id_token = _decode(client, tokens["id_token"])
    assert id_token.header["kid"]
    assert id_token.claims["iss"] == settings.issuer_url
    assert id_token.claims["aud"] == "invoicing"
    assert id_token.claims["sub"] == str(user.id)
    assert id_token.claims["email"] == user.email
    assert id_token.claims["role"] == "editor"
    assert id_token.claims["sid"] == sid
    assert id_token.claims["nonce"] == tokens["nonce"]
    assert id_token.claims["exp"] - id_token.claims["iat"] == 900

    access = _decode(client, tokens["access_token"])
    assert access.header["typ"] == "at+jwt"
    assert access.claims["aud"] == "invoicing"
    assert access.claims["role"] == "editor"
    assert access.claims["sid"] == sid


def test_second_app_login_is_silent_with_existing_session(client, db):
    user, app, _ = _app_with_member(db)
    sign_in(client, db, user)
    full_login(client, app)
    full_login(client, app)


def test_no_access_shows_page_and_audits(client, db):
    user = make_user(db)
    app, _ = make_app(db, name="Invoicing")
    sign_in(client, db, user)

    response = client.get("/authorize", params=auth_request(app).params)

    assert response.status_code == 403
    assert "You don&#39;t have access to Invoicing" in response.text
    denied = select(AuditLog).where(
        AuditLog.event == "access_denied", AuditLog.subject_user_id == user.id
    )
    assert db.scalar(denied)


def test_refresh_rotates_and_reflects_role_changes(client, db):
    user, app, roles = _app_with_member(db, role="editor")
    sign_in(client, db, user)
    tokens = full_login(client, app)
    add_override(db, user, app, "grant", roles["manager"])
    db.commit()

    response = refresh(client, app, tokens["refresh_token"])

    assert response.status_code == 200, response.text
    new = response.json()
    assert new["refresh_token"] != tokens["refresh_token"]
    assert _decode(client, new["access_token"]).claims["role"] == "manager"


def test_refresh_fails_after_access_removed(client, db):
    user, app, _ = _app_with_member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    add_override(db, user, app, "deny")
    db.commit()

    response = refresh(client, app, tokens["refresh_token"])

    assert response.status_code == 400
    assert response.json()["error"] == "invalid_grant"


def test_refresh_fails_after_suspension(client, db):
    user, app, _ = _app_with_member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    db.get(User, user.id).status = "suspended"
    db.commit()

    assert refresh(client, app, tokens["refresh_token"]).json()["error"] == "invalid_grant"


def test_refresh_reuse_revokes_family(client, db):
    user, app, _ = _app_with_member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    rotated = refresh(client, app, tokens["refresh_token"]).json()

    reuse = refresh(client, app, tokens["refresh_token"])

    assert reuse.json()["error"] == "invalid_grant"
    assert refresh(client, app, rotated["refresh_token"]).json()["error"] == "invalid_grant"
    assert db.scalar(select(AuditLog).where(AuditLog.event == "refresh_reuse_detected"))


def test_refresh_token_bound_to_client(client, db):
    user, app, _ = _app_with_member(db)
    other, _ = make_app(db, slug="crm")
    sign_in(client, db, user)
    tokens = full_login(client, app)

    assert refresh(client, other, tokens["refresh_token"]).json()["error"] == "invalid_grant"
```

`identity/tests/test_oidc_negative.py`

```python
from datetime import timedelta

from sqlalchemy import select

from app.models import AuthorizationCode
from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import (
    auth_request,
    authorize_code,
    exchange_code,
    query_of,
    refresh,
    sign_in,
)


def _setup(db, client):
    user = make_user(db)
    dept = make_department(db)
    add_to_department(db, user, dept)
    app, roles = make_app(db, slug="crm")
    grant_department(db, dept, app, roles["viewer"])
    sign_in(client, db, user)
    return app


def test_unknown_client_renders_error_without_redirect(client, db):
    app = _setup(db, client)
    response = client.get("/authorize", params=auth_request(app, client_id="nope").params)
    assert response.status_code == 400
    assert "location" not in response.headers


def test_unregistered_redirect_uri_never_redirects(client, db):
    app = _setup(db, client)
    params = auth_request(app, redirect_uri="https://evil.example/callback").params
    response = client.get("/authorize", params=params)
    assert response.status_code == 400
    assert "location" not in response.headers


def test_redirect_uri_must_match_exactly(client, db):
    app = _setup(db, client)
    params = auth_request(app, redirect_uri=app.redirect_uris[0] + "/extra").params
    assert client.get("/authorize", params=params).status_code == 400


def test_missing_pkce_is_rejected_via_redirect(client, db):
    app = _setup(db, client)
    params = auth_request(app, code_challenge=None, code_challenge_method=None).params
    response = client.get("/authorize", params=params)
    assert response.status_code == 302
    assert query_of(response.headers["location"])["error"] == "invalid_request"


def test_plain_pkce_is_rejected(client, db):
    app = _setup(db, client)
    params = auth_request(app, code_challenge_method="plain").params
    response = client.get("/authorize", params=params)
    assert query_of(response.headers["location"])["error"] == "invalid_request"


def test_missing_nonce_is_rejected(client, db):
    app = _setup(db, client)
    response = client.get("/authorize", params=auth_request(app, nonce=None).params)
    assert query_of(response.headers["location"])["error"] == "invalid_request"


def test_wrong_code_verifier(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    response = exchange_code(client, app, code, request, code_verifier="x" * 64)
    assert response.json()["error"] == "invalid_grant"


def test_missing_code_verifier(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    response = exchange_code(client, app, code, request, code_verifier=None)
    assert response.json()["error"] == "invalid_request"


def test_wrong_client_secret(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    response = exchange_code(client, app, code, request, secret="wrong")
    assert response.status_code == 401
    assert response.json()["error"] == "invalid_client"


def test_redirect_uri_mismatch_at_token(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    other_uri = "https://crm.yourco.com/other"
    response = exchange_code(client, app, code, request, redirect_uri=other_uri)
    assert response.json()["error"] == "invalid_grant"


def test_expired_code(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    row = db.scalar(select(AuthorizationCode))
    row.expires_at = row.expires_at - timedelta(minutes=5)
    db.commit()
    assert exchange_code(client, app, code, request).json()["error"] == "invalid_grant"


def test_code_reuse_fails_and_revokes_issued_tokens(client, db):
    app = _setup(db, client)
    code, request = authorize_code(client, app)
    tokens = exchange_code(client, app, code, request).json()

    second = exchange_code(client, app, code, request)

    assert second.json()["error"] == "invalid_grant"
    assert refresh(client, app, tokens["refresh_token"]).json()["error"] == "invalid_grant"


def test_disabled_app_is_refused(client, db):
    app = _setup(db, client)
    app.status = "disabled"
    db.commit()
    assert client.get("/authorize", params=auth_request(app).params).status_code == 400
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_oidc_flow.py tests/test_oidc_negative.py
```

Expected: FAIL — `KeyError: 'issuer'`

- [ ] **Step 3: Implement**

`identity/app/oauth/__init__.py` — empty file (package marker).

`identity/app/oauth/requests.py`

```python
"""Adapts FastAPI requests to Authlib's framework-neutral OAuth2Request."""

from collections import defaultdict

from authlib.oauth2.rfc6749 import OAuth2Payload, OAuth2Request
from fastapi import Request


class _Payload(OAuth2Payload):
    def __init__(self, datalist: dict[str, list[str]]):
        self._datalist = defaultdict(list, datalist)

    @property
    def data(self) -> dict[str, str]:
        return {key: values[0] for key, values in self._datalist.items() if values}

    @property
    def datalist(self) -> defaultdict[str, list]:
        return self._datalist


def _multi(items: list[tuple[str, str]]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for key, value in items:
        out.setdefault(key, []).append(value)
    return out


class IdentityOAuth2Request(OAuth2Request):
    def __init__(
        self,
        method: str,
        uri: str,
        headers,
        query: list[tuple[str, str]],
        form: list[tuple[str, str]],
    ):
        super().__init__(method=method, uri=uri, headers=headers)
        self._args = {k: v[0] for k, v in _multi(query).items()}
        self._form = {k: v[0] for k, v in _multi(form).items()}
        self.payload = _Payload(_multi(query + form))

    @property
    def args(self) -> dict[str, str]:
        return self._args

    @property
    def form(self) -> dict[str, str]:
        return self._form


async def build_oauth_request(request: Request, issuer_url: str) -> IdentityOAuth2Request:
    """Build from the public issuer URL so Authlib's HTTPS check sees the external scheme."""
    form = list((await request.form()).multi_items()) if request.method == "POST" else []
    uri = issuer_url + request.url.path
    if request.url.query:
        uri += "?" + request.url.query
    return IdentityOAuth2Request(
        method=request.method,
        uri=uri,
        headers=request.headers,
        query=list(request.query_params.multi_items()),
        form=[(k, v) for k, v in form if isinstance(v, str)],
    )
```

`identity/app/oauth/tokens.py`

```python
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
```

`identity/app/oauth/server.py`

```python
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
        if row.used_at is not None:
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
```

`identity/app/routes/oidc.py`

```python
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
```

In `identity/app/main.py`, replace:

```python
from app.routes import health
```

with:

```python
from app.routes import health, oidc
```

In `identity/app/main.py`, replace:

```python
    app.include_router(health.router)
```

with:

```python
    app.include_router(health.router)
    app.include_router(oidc.router)
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_oidc_flow.py tests/test_oidc_negative.py
```

Expected: `24 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `69 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): OIDC authorization code flow with PKCE and refresh rotation"
```

---

### Task 8: UserInfo and logout

`/userinfo` for access tokens, and RP-initiated `/logout` that revokes the browser session and every refresh token bound to it across all apps (spec §5.4, §5.6).

**Files:**
- Create: `identity/tests/test_userinfo.py`
- Create: `identity/tests/test_logout.py`
- Create: `identity/app/routes/userinfo.py`
- Create: `identity/app/routes/logout.py`
- Modify: `identity/app/main.py`

**Interfaces:**
- Consumes `verify_access_token`, `read_id_token_hint` (Task 7); `get_active_session`, `revoke_session` (Task 4).
- Produces `GET|POST /userinfo` → `{sub, email, name, picture, role, sid}` and `GET /logout?id_token_hint=&post_logout_redirect_uri=&state=&client_id=`.

- [ ] **Step 1: Write the failing tests**

`identity/tests/test_userinfo.py`

```python
from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import full_login, sign_in


def _member(db):
    user = make_user(db)
    dept = make_department(db)
    add_to_department(db, user, dept)
    app, roles = make_app(db, slug="invoicing")
    grant_department(db, dept, app, roles["editor"])
    return user, app


def test_userinfo_returns_claims_for_access_token(client, db):
    user, app = _member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)

    response = client.get(
        "/userinfo", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == user.email
    assert response.json()["role"] == "editor"


def test_userinfo_rejects_id_token_and_garbage(client, db):
    user, app = _member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    for bad in (tokens["id_token"], "garbage"):
        response = client.get("/userinfo", headers={"Authorization": f"Bearer {bad}"})
        assert response.status_code == 401


def test_userinfo_rejects_revoked_session(client, db):
    user, app = _member(db)
    sign_in(client, db, user)
    tokens = full_login(client, app)
    client.get("/logout")
    response = client.get(
        "/userinfo", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert response.status_code == 401
```

`identity/tests/test_logout.py`

```python
from sqlalchemy import select

from app.models import AuthSession
from app.sessions import SESSION_COOKIE
from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import full_login, refresh, sign_in


def _logged_in(client, db):
    user = make_user(db)
    dept = make_department(db)
    add_to_department(db, user, dept)
    crm, crm_roles = make_app(db, slug="crm")
    sales, sales_roles = make_app(db, slug="sales")
    grant_department(db, dept, crm, crm_roles["viewer"])
    grant_department(db, dept, sales, sales_roles["viewer"])
    sign_in(client, db, user)
    return user, crm, sales, full_login(client, crm), full_login(client, sales)


def test_logout_revokes_session_and_all_apps_refresh_tokens(client, db):
    user, crm, sales, crm_tokens, sales_tokens = _logged_in(client, db)

    response = client.get(
        "/logout",
        params={
            "id_token_hint": crm_tokens["id_token"],
            "post_logout_redirect_uri": "https://crm.yourco.com/",
            "state": "abc",
        },
    )

    assert response.status_code == 303
    assert response.headers["location"] == "https://crm.yourco.com/?state=abc"
    assert f'{SESSION_COOKIE}=""' in response.headers["set-cookie"]
    assert db.scalar(select(AuthSession).where(AuthSession.user_id == user.id)).revoked_at
    assert refresh(client, crm, crm_tokens["refresh_token"]).json()["error"] == "invalid_grant"
    assert refresh(client, sales, sales_tokens["refresh_token"]).json()["error"] == "invalid_grant"


def test_logout_rejects_unregistered_redirect(client, db):
    _, _, _, crm_tokens, _ = _logged_in(client, db)
    response = client.get(
        "/logout",
        params={
            "id_token_hint": crm_tokens["id_token"],
            "post_logout_redirect_uri": "https://evil.example/",
        },
    )
    assert response.status_code == 400
    assert "location" not in response.headers


def test_logout_without_redirect_shows_page(client, db):
    _logged_in(client, db)
    response = client.get("/logout")
    assert response.status_code == 200
    assert "You have signed out" in response.text


def test_logout_rejects_forged_hint(client, db):
    _logged_in(client, db)
    assert client.get("/logout", params={"id_token_hint": "a.b.c"}).status_code == 400
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_userinfo.py tests/test_logout.py
```

Expected: FAIL — `assert 404 == 200`

- [ ] **Step 3: Implement**

`identity/app/routes/userinfo.py`

```python
import uuid

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.keys import public_key_set
from app.models import AuthSession, User
from app.oauth.tokens import InvalidToken, verify_access_token
from app.sessions import is_session_active

router = APIRouter()


@router.get("/userinfo")
@router.post("/userinfo", operation_id="userinfo_post")
def userinfo(
    request: Request, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> Response:
    scheme, _, raw = request.headers.get("authorization", "").partition(" ")
    unauthorized = JSONResponse(
        {"error": "invalid_token"},
        status_code=401,
        headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
    )
    if scheme.lower() != "bearer" or not raw:
        return unauthorized
    try:
        claims = verify_access_token(raw, public_key_set(db), settings.issuer_url, audience=None)
    except InvalidToken:
        return unauthorized
    user = db.get(User, uuid.UUID(claims["sub"]))
    auth_session = db.get(AuthSession, uuid.UUID(claims["sid"]))
    if user is None or user.status != "active":
        return unauthorized
    if auth_session is None or not is_session_active(auth_session):
        return unauthorized
    return JSONResponse(
        {
            "sub": str(user.id),
            "email": user.email,
            "name": user.name,
            "picture": user.avatar_url,
            "role": claims["role"],
            "sid": claims["sid"],
        }
    )
```

`identity/app/routes/logout.py`

```python
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
```

In `identity/app/main.py`, replace:

```python
from app.routes import health, oidc
```

with:

```python
from app.routes import health, logout, oidc, userinfo
```

In `identity/app/main.py`, replace:

```python
    app.include_router(oidc.router)
```

with:

```python
    app.include_router(oidc.router)
    app.include_router(userinfo.router)
    app.include_router(logout.router)
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_userinfo.py tests/test_logout.py
```

Expected: `7 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `76 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): userinfo and RP-initiated logout"
```

---

### Task 9: Google sign-in and dev login routes

Browser login: `/login`, Google redirect and callback (Authlib Starlette client with `httpx2`), error pages, and the development-only user picker.

**Files:**
- Create: `identity/tests/test_login_routes.py`
- Create: `identity/app/google.py`
- Create: `identity/app/templates/dev_login.html`
- Create: `identity/app/routes/login.py`
- Modify: `identity/app/main.py`

**Interfaces:**
- Consumes `complete_google_login`, `complete_dev_login`, `LoginDenied` (Task 5).
- Produces `app.google`: `GoogleClient(settings)` with async `start(request)` and `finish(request) -> GoogleIdentity`, `GoogleUnavailable`, `GoogleRejected`, dependency `get_google_client()`.
- Produces `GET /login`, `GET /login/google`, `GET /google/callback`, and `GET|POST /dev-login` (only when `DEV_LOGIN_ENABLED=true`).

**Notes:**
- Tests replace Google with a fake through the `get_google_client` dependency. Real Google ID-token verification (signature, issuer, audience, nonce) is done by Authlib inside `authorize_access_token`.
- Only a pending `/authorize?…` path saved in the signed flow cookie is followed after login, so the callback cannot be used as an open redirect.

- [ ] **Step 1: Write the failing tests**

`identity/tests/test_login_routes.py`

```python
from fastapi.responses import RedirectResponse

from app.google import GoogleRejected, GoogleUnavailable, get_google_client
from app.login import GoogleIdentity
from app.sessions import SESSION_COOKIE
from tests.factories import make_app, make_user
from tests.oidc_helpers import auth_request


class FakeGoogle:
    def __init__(self, identity=None, error=None):
        self.identity, self.error = identity, error

    async def start(self, request):
        return RedirectResponse("https://accounts.google.com/o/oauth2/auth?fake=1", 302)

    async def finish(self, request):
        if self.error:
            raise self.error
        return self.identity


def _identity(**overrides):
    fields = dict(
        sub="g-1",
        email="priya@yourco.com",
        email_verified=True,
        hd="yourco.com",
        name="Priya",
        picture=None,
    )
    return GoogleIdentity(**(fields | overrides))


def _with_google(client, fake):
    client.app.dependency_overrides[get_google_client] = lambda: fake
    return client


def test_login_redirects_to_google_by_default(client):
    assert client.get("/login").headers["location"] == "/login/google"
    _with_google(client, FakeGoogle())
    assert client.get("/login/google").headers["location"].startswith("https://accounts.google")


def test_callback_sets_session_cookie_and_resumes_authorize(client, db):
    app, _ = make_app(db, slug="crm")
    _with_google(client, FakeGoogle(_identity()))
    params = auth_request(app).params
    assert client.get("/authorize", params=params).headers["location"] == "/login"

    response = client.get("/google/callback")

    assert response.status_code == 303
    assert response.headers["location"].startswith("/authorize?")
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=") and "HttpOnly" in cookie
    assert "samesite=lax" in cookie.lower()


def test_callback_without_pending_request_goes_to_portal(client, settings):
    _with_google(client, FakeGoogle(_identity()))
    assert client.get("/google/callback").headers["location"] == settings.portal_url


def test_callback_wrong_domain_page(client):
    _with_google(client, FakeGoogle(_identity(hd="gmail.com")))
    response = client.get("/google/callback")
    assert response.status_code == 403
    assert "Use your company Google account" in response.text
    assert "Reference:" in response.text


def test_callback_suspended_page(client, db):
    make_user(db, email="priya@yourco.com", google_sub="g-1", status="suspended")
    _with_google(client, FakeGoogle(_identity()))
    assert "Your account is suspended" in client.get("/google/callback").text


def test_google_unavailable_page(client):
    _with_google(client, FakeGoogle(error=GoogleUnavailable("down")))
    response = client.get("/google/callback")
    assert response.status_code == 503
    assert "Sign-in temporarily unavailable" in response.text


def test_google_rejected_page(client):
    _with_google(client, FakeGoogle(error=GoogleRejected("mismatching_state")))
    assert client.get("/google/callback").status_code == 400


def test_dev_login_disabled_by_default(client):
    assert client.get("/dev-login").status_code == 404


def test_dev_login_when_enabled(make_client, db):
    dev_client = make_client(dev_login_enabled="true")
    user = make_user(db, name="Dev Person")
    assert dev_client.get("/login").headers["location"] == "/dev-login"
    assert "Dev Person" in dev_client.get("/dev-login").text

    response = dev_client.post("/dev-login", data={"user_id": str(user.id)})

    assert response.status_code == 303
    assert response.headers["set-cookie"].startswith(f"{SESSION_COOKIE}=")
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_login_routes.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.google'`

- [ ] **Step 3: Implement**

`identity/app/google.py`

```python
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
```

`identity/app/templates/dev_login.html`

```html
{% extends "base.html" %}
{% block title %}Dev sign-in{% endblock %}
{% block content %}
  <h1>Development sign-in</h1>
  <p>Google sign-in is bypassed. Choose a user:</p>
  <ul>
  {% for user in users %}
    <li>
      <form method="post" action="/dev-login">
        <input type="hidden" name="user_id" value="{{ user.id }}">
        <button type="submit">{{ user.name }} &lt;{{ user.email }}&gt;{% if user.is_admin %} · admin{% endif %}</button>
      </form>
    </li>
  {% endfor %}
  </ul>
{% endblock %}
```

`identity/app/routes/login.py`

```python
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
```

In `identity/app/main.py`, replace:

```python
from app.routes import health, logout, oidc, userinfo
```

with:

```python
from app.routes import health, login, logout, oidc, userinfo
```

In `identity/app/main.py`, replace:

```python
    app.include_router(logout.router)
```

with:

```python
    app.include_router(logout.router)
    app.include_router(login.router)
```

In `identity/app/main.py`, replace:

```python
    return app
```

with:

```python
    if settings.dev_login_enabled:
        app.include_router(login.dev_router)
    return app
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_login_routes.py
```

Expected: `9 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `85 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): Google sign-in and dev login routes"
```

---

### Task 10: Portal bearer auth and `/me`

Authenticate portal API calls with `aud=portal` access tokens; expose `/me` and `/me/apps`.

**Files:**
- Create: `identity/tests/test_me.py`
- Create: `identity/app/deps.py`
- Create: `identity/app/routes/me.py`
- Modify: `identity/app/main.py`

**Interfaces:**
- Produces `app.deps.current_user` (401 unless a valid `aud=portal` access token for an active user) and `app.deps.require_admin` (403 unless `is_admin`).
- Produces `GET /me` → `{id, email, name, avatar_url, is_admin, departments: [{id, slug, name}]}` and `GET /me/apps` → `[{slug, name, description, icon, launch_url, role}]` (active non-portal apps the user can open).

- [ ] **Step 1: Write the failing tests**

`identity/tests/test_me.py`

```python
from tests.factories import (
    add_override,
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import full_login, portal_token, sign_in


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_me_and_my_apps(client, db, settings):
    user = make_user(db, name="Priya")
    sales = make_department(db, "sales")
    add_to_department(db, user, sales)
    crm, crm_roles = make_app(db, slug="crm", name="CRM")
    invoicing, inv_roles = make_app(db, slug="invoicing", name="Invoicing")
    make_app(db, slug="finance")
    grant_department(db, sales, crm, crm_roles["manager"])
    add_override(db, user, invoicing, "grant", inv_roles["viewer"])
    token = portal_token(client, db, user, settings)

    me = client.get("/me", headers=_auth(token)).json()
    apps = client.get("/me/apps", headers=_auth(token)).json()

    assert me["email"] == user.email and me["is_admin"] is False
    assert [d["slug"] for d in me["departments"]] == ["sales"]
    assert [(a["slug"], a["role"]) for a in apps] == [("crm", "manager"), ("invoicing", "viewer")]


def test_me_requires_portal_audience(client, db):
    user = make_user(db)
    dept = make_department(db)
    add_to_department(db, user, dept)
    crm, roles = make_app(db, slug="crm")
    grant_department(db, dept, crm, roles["viewer"])
    sign_in(client, db, user)
    crm_token = full_login(client, crm)["access_token"]

    assert client.get("/me", headers=_auth(crm_token)).status_code == 401
    assert client.get("/me").status_code == 401


def test_suspended_user_token_rejected(client, db, settings):
    user = make_user(db)
    token = portal_token(client, db, user, settings)
    user.status = "suspended"
    db.commit()
    assert client.get("/me", headers=_auth(token)).status_code == 401
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_me.py
```

Expected: FAIL — `KeyError: 'email'`

- [ ] **Step 3: Implement**

`identity/app/deps.py`

```python
import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.bootstrap import PORTAL_CLIENT_ID
from app.config import Settings, get_settings
from app.db import get_db
from app.keys import public_key_set
from app.models import User
from app.oauth.tokens import InvalidToken, verify_access_token


def current_user(
    request: Request, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> User:
    """User from a portal access token (aud=portal). Spec §6."""
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Missing bearer token", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = verify_access_token(
            token, public_key_set(db), settings.issuer_url, audience=PORTAL_CLIENT_ID
        )
    except InvalidToken:
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"}) from None
    user = db.get(User, uuid.UUID(claims["sub"]))
    if user is None or user.status != "active":
        raise HTTPException(401, "Inactive user", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Admin access required")
    return user
```

`identity/app/routes/me.py`

```python
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.access import resolve_role
from app.db import get_db
from app.deps import current_user
from app.models import App, Department, User, UserDepartment

router = APIRouter()


class DepartmentOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None
    is_admin: bool
    departments: list[DepartmentOut]


class MyAppOut(BaseModel):
    slug: str
    name: str
    description: str
    icon: str
    launch_url: str
    role: str


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> MeOut:
    departments = db.scalars(
        select(Department)
        .join(UserDepartment, UserDepartment.department_id == Department.id)
        .where(UserDepartment.user_id == user.id)
        .order_by(Department.name)
    ).all()
    return MeOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        is_admin=user.is_admin,
        departments=[DepartmentOut(id=d.id, slug=d.slug, name=d.name) for d in departments],
    )


@router.get("/me/apps", response_model=list[MyAppOut])
def my_apps(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[MyAppOut]:
    apps = db.scalars(
        select(App).where(App.status == "active", App.is_system.is_(False)).order_by(App.name)
    ).all()
    result = []
    for app in apps:
        role = resolve_role(db, user, app)
        if role is not None:
            result.append(
                MyAppOut(
                    slug=app.slug,
                    name=app.name,
                    description=app.description,
                    icon=app.icon,
                    launch_url=app.launch_url,
                    role=role.key,
                )
            )
    return result
```

In `identity/app/main.py`, replace:

```python
from app.routes import health, login, logout, oidc, userinfo
```

with:

```python
from app.routes import health, login, logout, me, oidc, userinfo
```

In `identity/app/main.py`, replace:

```python
    app.include_router(login.router)
```

with:

```python
    app.include_router(login.router)
    app.include_router(me.router)
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_me.py
```

Expected: `3 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `88 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): portal bearer auth and /me endpoints"
```

---

### Task 11: Admin API: apps and roles

Register apps (client secret returned once), edit, disable, rotate secrets, and manage roles.

**Files:**
- Create: `identity/tests/admin/__init__.py`
- Create: `identity/tests/admin/conftest.py`
- Create: `identity/tests/admin/test_admin_apps.py`
- Create: `identity/app/admin/__init__.py`
- Create: `identity/app/admin/common.py`
- Create: `identity/app/admin/schemas.py`
- Create: `identity/app/admin/apps.py`
- Modify: `identity/app/main.py`

**Interfaces:**
- Consumes `require_admin` (Task 10).
- Produces `app.admin.common`: `get_or_404(db, model, id)`, `conflict(message)`, `validate_uris(uris, settings, field)`, `SLUG_PATTERN`.
- Produces every admin request/response model in `app.admin.schemas` (Tasks 12–13 import from it).
- Produces fixtures in `tests/admin/conftest.py`: `admin`, `api` (client carrying an admin's portal token), `audited(event) -> bool`.

- [ ] **Step 1: Write the failing tests**

`identity/tests/admin/__init__.py` — empty file (package marker).

`identity/tests/admin/conftest.py`

```python
import pytest
from sqlalchemy import select

from app.models import AuditLog
from tests.factories import make_user
from tests.oidc_helpers import portal_token


@pytest.fixture
def admin(db):
    return make_user(db, email="admin@yourco.com", is_admin=True)


@pytest.fixture
def api(client, db, settings, admin):
    """Test client authenticated as an admin via a real portal access token."""
    client.headers["Authorization"] = f"Bearer {portal_token(client, db, admin, settings)}"
    return client


@pytest.fixture
def audited(db):
    def check(event: str) -> bool:
        return db.scalar(select(AuditLog).where(AuditLog.event == event)) is not None

    return check
```

`identity/tests/admin/test_admin_apps.py`

```python
from sqlalchemy import select

from app.models import App
from tests.factories import grant_department, make_app, make_department, make_user
from tests.oidc_helpers import portal_token

APP_BODY = {
    "slug": "invoicing",
    "name": "Invoicing",
    "launch_url": "https://invoicing.yourco.com",
    "redirect_uris": ["https://invoicing.yourco.com/api/auth/callback/identity"],
    "post_logout_redirect_uris": ["https://invoicing.yourco.com/"],
    "roles": [
        {"key": "viewer", "label": "Viewer", "rank": 10},
        {"key": "manager", "label": "Manager", "rank": 30},
    ],
}


def test_non_admin_gets_403_and_anonymous_401(client, db, settings):
    token = portal_token(client, db, make_user(db), settings)
    assert (
        client.get("/admin/apps", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    )
    assert client.get("/admin/apps", headers={"Authorization": ""}).status_code == 401


def test_register_app_returns_secret_once(api, audited):
    created = api.post("/admin/apps", json=APP_BODY)

    assert created.status_code == 201, created.text
    assert created.json()["client_id"] == "invoicing"
    assert len(created.json()["client_secret"]) > 30
    detail = api.get(f"/admin/apps/{created.json()['id']}").json()
    assert "client_secret" not in detail
    assert [r["key"] for r in detail["roles"]] == ["viewer", "manager"]
    assert api.post("/admin/apps", json=APP_BODY).status_code == 409
    assert audited("app_created")


def test_register_app_rejects_insecure_uris_and_duplicate_ranks(api):
    insecure = APP_BODY | {"slug": "crm", "redirect_uris": ["http://crm.yourco.com/cb"]}
    duplicate_rank = APP_BODY | {
        "slug": "crm",
        "roles": [{"key": "a", "label": "A", "rank": 10}, {"key": "b", "label": "B", "rank": 10}],
    }
    assert api.post("/admin/apps", json=insecure).status_code == 422
    assert api.post("/admin/apps", json=duplicate_rank).status_code == 422


def test_update_and_disable_app(api, db):
    app, _ = make_app(db, slug="crm")
    response = api.patch(f"/admin/apps/{app.id}", json={"name": "CRM", "status": "disabled"})
    assert response.status_code == 200
    assert (response.json()["name"], response.json()["status"]) == ("CRM", "disabled")


def test_rotate_secret(api, db, audited):
    app, _ = make_app(db, slug="crm")
    response = api.post(f"/admin/apps/{app.id}/rotate-secret")
    assert response.status_code == 200
    assert response.json()["client_id"] == "crm"
    assert audited("app_secret_rotated")


def test_portal_app_is_protected(api, db):
    portal = db.scalar(select(App).where(App.client_id == "portal"))
    assert api.patch(f"/admin/apps/{portal.id}", json={"status": "disabled"}).status_code == 409
    assert api.post(f"/admin/apps/{portal.id}/rotate-secret").status_code == 409


def test_role_crud_and_delete_blocked_while_referenced(api, db):
    app, roles = make_app(db)
    grant_department(db, make_department(db), app, roles["viewer"])
    roles_url = f"/admin/apps/{app.id}/roles"

    created = api.post(roles_url, json={"key": "auditor", "label": "Auditor", "rank": 15})
    clash = api.post(roles_url, json={"key": "x", "label": "X", "rank": 15})
    renamed = api.patch(f"/admin/app-roles/{created.json()['id']}", json={"label": "Audit"})

    assert created.status_code == 201 and clash.status_code == 409
    assert renamed.json()["label"] == "Audit"
    assert api.delete(f"/admin/app-roles/{roles['viewer'].id}").status_code == 409
    assert api.delete(f"/admin/app-roles/{roles['manager'].id}").status_code == 204
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/admin/test_admin_apps.py
```

Expected: FAIL — `AssertionError: assert 404 == 403`

- [ ] **Step 3: Implement**

`identity/app/admin/__init__.py` — empty file (package marker).

`identity/app/admin/common.py`

```python
import uuid
from urllib.parse import urlsplit

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import Settings

SLUG_PATTERN = r"^[a-z0-9][a-z0-9-]{1,63}$"


def get_or_404[T](db: Session, model: type[T], id_: uuid.UUID) -> T:
    row = db.get(model, id_)
    if row is None:
        raise HTTPException(404, f"{model.__name__} not found")
    return row


def conflict(message: str) -> HTTPException:
    return HTTPException(409, message)


def validate_uris(uris: list[str], settings: Settings, field: str) -> list[str]:
    """Absolute URLs; https required except localhost outside staging/production."""
    for uri in uris:
        parts = urlsplit(uri)
        local = parts.hostname in ("localhost", "127.0.0.1")
        allow_http = local and settings.environment in ("development", "test")
        schemes = ("https", "http") if allow_http else ("https",)
        if parts.scheme not in schemes or not parts.hostname:
            raise HTTPException(422, f"{field}: '{uri}' must be an absolute https URL")
        if parts.fragment:
            raise HTTPException(422, f"{field}: '{uri}' must not contain a fragment")
    return uris
```

`identity/app/admin/schemas.py`

```python
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.admin.common import SLUG_PATTERN


class RoleIn(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    label: str = Field(min_length=1, max_length=255)
    rank: int = Field(ge=0)


class RoleUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=255)
    rank: int | None = Field(default=None, ge=0)


class RoleOut(BaseModel):
    id: uuid.UUID
    key: str
    label: str
    rank: int


class DepartmentIn(BaseModel):
    slug: str = Field(pattern=SLUG_PATTERN)
    name: str = Field(min_length=1, max_length=255)


class DepartmentUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class DepartmentGrantIn(BaseModel):
    app_id: uuid.UUID
    app_role_id: uuid.UUID


class DepartmentGrantOut(BaseModel):
    app_id: uuid.UUID
    app_slug: str
    app_role_id: uuid.UUID
    role_key: str


class DepartmentOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    member_count: int
    access: list[DepartmentGrantOut]


class AppIn(BaseModel):
    slug: str = Field(pattern=SLUG_PATTERN)
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    icon: str = ""
    launch_url: str
    redirect_uris: list[str] = Field(min_length=1)
    post_logout_redirect_uris: list[str] = []
    roles: list[RoleIn] = Field(min_length=1)

    @model_validator(mode="after")
    def _unique_roles(self) -> "AppIn":
        if len({r.key for r in self.roles}) != len(self.roles):
            raise ValueError("role keys must be unique")
        if len({r.rank for r in self.roles}) != len(self.roles):
            raise ValueError("role ranks must be unique")
        return self


class AppUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    icon: str | None = None
    launch_url: str | None = None
    redirect_uris: list[str] | None = Field(default=None, min_length=1)
    post_logout_redirect_uris: list[str] | None = None
    status: Literal["active", "disabled"] | None = None


class AppOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str
    icon: str
    launch_url: str
    client_id: str
    redirect_uris: list[str]
    post_logout_redirect_uris: list[str]
    status: str
    is_system: bool
    roles: list[RoleOut]


class AppDepartmentGrantOut(BaseModel):
    department_id: uuid.UUID
    department_slug: str
    department_name: str
    app_role_id: uuid.UUID
    role_key: str


class AppDetailOut(AppOut):
    departments: list[AppDepartmentGrantOut]


class AppCreatedOut(AppOut):
    client_secret: str


class ClientSecretOut(BaseModel):
    client_id: str
    client_secret: str


class UserSummaryOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None
    status: str
    is_admin: bool
    last_login_at: datetime | None
    department_slugs: list[str]


class EffectiveAccessOut(BaseModel):
    app_id: uuid.UUID
    app_slug: str
    app_name: str
    role: str | None
    reason: str
    department_slug: str | None = None
    override_id: uuid.UUID | None = None


class OverrideIn(BaseModel):
    app_id: uuid.UUID
    effect: Literal["grant", "deny"]
    app_role_id: uuid.UUID | None = None
    reason: str = Field(min_length=1)
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def _grant_needs_role(self) -> "OverrideIn":
        if (self.effect == "grant") != (self.app_role_id is not None):
            raise ValueError("app_role_id is required for grant and forbidden for deny")
        return self


class OverrideUpdate(BaseModel):
    effect: Literal["grant", "deny"] | None = None
    app_role_id: uuid.UUID | None = None
    reason: str | None = Field(default=None, min_length=1)
    expires_at: datetime | None = None


class OverrideOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    effect: str
    app_role_id: uuid.UUID | None
    reason: str
    created_by: uuid.UUID | None
    created_at: datetime
    expires_at: datetime | None
    active: bool


class UserDepartmentOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str


class UserDetailOut(UserSummaryOut):
    departments: list[UserDepartmentOut]
    overrides: list[OverrideOut]
    access: list[EffectiveAccessOut]


class UserUpdate(BaseModel):
    status: Literal["active", "suspended"] | None = None
    is_admin: bool | None = None


class UserDepartmentsIn(BaseModel):
    department_ids: list[uuid.UUID]


class AuditOut(BaseModel):
    id: int
    at: datetime
    event: str
    actor_user_id: uuid.UUID | None
    subject_user_id: uuid.UUID | None
    app_id: uuid.UUID | None
    detail: dict
    request_id: str | None
    ip: str | None
```

`identity/app/admin/apps.py`

```python
import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app import audit
from app.admin.common import conflict, get_or_404, validate_uris
from app.admin.schemas import (
    AppCreatedOut,
    AppDetailOut,
    AppIn,
    AppOut,
    AppUpdate,
    ClientSecretOut,
    RoleIn,
    RoleOut,
    RoleUpdate,
)
from app.config import Settings, get_settings
from app.db import get_db
from app.deps import require_admin
from app.models import App, AppRole, Department, DepartmentAppAccess, User, UserAppOverride
from app.security import hash_secret, new_token

router = APIRouter()

SYSTEM_MANAGED_FIELDS = {"status", "redirect_uris", "post_logout_redirect_uris", "launch_url"}


def _roles(db: Session, app: App) -> list[RoleOut]:
    rows = db.scalars(select(AppRole).where(AppRole.app_id == app.id).order_by(AppRole.rank))
    return [RoleOut(id=r.id, key=r.key, label=r.label, rank=r.rank) for r in rows]


def _out(db: Session, app: App) -> dict:
    return dict(
        id=app.id,
        slug=app.slug,
        name=app.name,
        description=app.description,
        icon=app.icon,
        launch_url=app.launch_url,
        client_id=app.client_id,
        redirect_uris=app.redirect_uris,
        post_logout_redirect_uris=app.post_logout_redirect_uris,
        status=app.status,
        is_system=app.is_system,
        roles=_roles(db, app),
    )


def _ensure_not_system(db: Session, app_id: uuid.UUID) -> None:
    if db.get(App, app_id).is_system:
        raise conflict("Portal roles cannot be changed")


@router.get("/apps", response_model=list[AppOut])
def list_apps(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[dict]:
    return [_out(db, a) for a in db.scalars(select(App).order_by(App.name))]


@router.post("/apps", response_model=AppCreatedOut, status_code=201)
def create_app_client(
    body: AppIn,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    admin: User = Depends(require_admin),
) -> dict:
    validate_uris([body.launch_url], settings, "launch_url")
    validate_uris(body.redirect_uris, settings, "redirect_uris")
    validate_uris(body.post_logout_redirect_uris, settings, "post_logout_redirect_uris")
    if db.scalar(select(App).where((App.slug == body.slug) | (App.client_id == body.slug))):
        raise conflict(f"An app with slug '{body.slug}' already exists")
    secret = new_token(32)
    app = App(
        slug=body.slug,
        name=body.name,
        description=body.description,
        icon=body.icon,
        launch_url=body.launch_url,
        client_id=body.slug,
        client_secret_hash=hash_secret(secret),
        redirect_uris=body.redirect_uris,
        post_logout_redirect_uris=body.post_logout_redirect_uris,
        status="active",
        is_system=False,
    )
    db.add(app)
    db.flush()
    for role in body.roles:
        db.add(AppRole(app_id=app.id, key=role.key, label=role.label, rank=role.rank))
    audit.record(db, "app_created", request=request, actor_user_id=admin.id, app_id=app.id)
    db.commit()
    return _out(db, app) | {"client_secret": secret}


@router.get("/apps/{app_id}", response_model=AppDetailOut)
def get_app(
    app_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> dict:
    app = get_or_404(db, App, app_id)
    grants = db.execute(
        select(Department.id, Department.slug, Department.name, AppRole.id, AppRole.key)
        .join(DepartmentAppAccess, DepartmentAppAccess.department_id == Department.id)
        .join(AppRole, AppRole.id == DepartmentAppAccess.app_role_id)
        .where(DepartmentAppAccess.app_id == app.id)
        .order_by(Department.name)
    ).all()
    departments = [
        dict(
            department_id=d_id,
            department_slug=slug,
            department_name=name,
            app_role_id=role_id,
            role_key=key,
        )
        for d_id, slug, name, role_id, key in grants
    ]
    return _out(db, app) | {"departments": departments}


@router.patch("/apps/{app_id}", response_model=AppOut)
def update_app(
    app_id: uuid.UUID,
    body: AppUpdate,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    admin: User = Depends(require_admin),
) -> dict:
    app = get_or_404(db, App, app_id)
    changes = body.model_dump(exclude_unset=True)
    if app.is_system and changes.keys() & SYSTEM_MANAGED_FIELDS:
        raise conflict("The portal's status and URLs are managed by configuration")
    if "launch_url" in changes:
        validate_uris([changes["launch_url"]], settings, "launch_url")
    if "redirect_uris" in changes:
        validate_uris(changes["redirect_uris"], settings, "redirect_uris")
    if "post_logout_redirect_uris" in changes:
        validate_uris(changes["post_logout_redirect_uris"], settings, "post_logout_redirect_uris")
    for field, value in changes.items():
        setattr(app, field, value)
    audit.record(
        db,
        "app_updated",
        request=request,
        actor_user_id=admin.id,
        app_id=app.id,
        detail={"fields": sorted(changes)},
    )
    db.commit()
    return _out(db, app)


@router.post("/apps/{app_id}/rotate-secret", response_model=ClientSecretOut)
def rotate_secret(
    app_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ClientSecretOut:
    app = get_or_404(db, App, app_id)
    if app.is_system:
        raise conflict("The portal's secret is managed by configuration")
    secret = new_token(32)
    app.client_secret_hash = hash_secret(secret)
    audit.record(db, "app_secret_rotated", request=request, actor_user_id=admin.id, app_id=app.id)
    db.commit()
    return ClientSecretOut(client_id=app.client_id, client_secret=secret)


@router.get("/apps/{app_id}/roles", response_model=list[RoleOut])
def list_roles(
    app_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> list[RoleOut]:
    return _roles(db, get_or_404(db, App, app_id))


@router.post("/apps/{app_id}/roles", response_model=RoleOut, status_code=201)
def create_role(
    app_id: uuid.UUID,
    body: RoleIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> RoleOut:
    app = get_or_404(db, App, app_id)
    _ensure_not_system(db, app.id)
    clash = db.scalar(
        select(AppRole).where(
            AppRole.app_id == app.id, (AppRole.key == body.key) | (AppRole.rank == body.rank)
        )
    )
    if clash:
        raise conflict("Role key and rank must be unique within the app")
    role = AppRole(app_id=app.id, key=body.key, label=body.label, rank=body.rank)
    db.add(role)
    audit.record(
        db,
        "role_created",
        request=request,
        actor_user_id=admin.id,
        app_id=app.id,
        detail={"key": body.key},
    )
    db.commit()
    return RoleOut(id=role.id, key=role.key, label=role.label, rank=role.rank)


@router.patch("/app-roles/{role_id}", response_model=RoleOut)
def update_role(
    role_id: uuid.UUID,
    body: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> RoleOut:
    role = get_or_404(db, AppRole, role_id)
    _ensure_not_system(db, role.app_id)
    if body.rank is not None and body.rank != role.rank:
        taken = db.scalar(
            select(AppRole).where(AppRole.app_id == role.app_id, AppRole.rank == body.rank)
        )
        if taken:
            raise conflict("Role rank must be unique within the app")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(role, field, value)
    audit.record(
        db,
        "role_updated",
        request=request,
        actor_user_id=admin.id,
        app_id=role.app_id,
        detail={"key": role.key},
    )
    db.commit()
    return RoleOut(id=role.id, key=role.key, label=role.label, rank=role.rank)


@router.delete("/app-roles/{role_id}", status_code=204)
def delete_role(
    role_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    role = get_or_404(db, AppRole, role_id)
    _ensure_not_system(db, role.app_id)
    in_use = db.scalar(
        select(
            exists().where(DepartmentAppAccess.app_role_id == role.id)
            | exists().where(UserAppOverride.app_role_id == role.id)
        )
    )
    if in_use:
        raise conflict("Role is assigned to a department or exception; reassign it first")
    audit.record(
        db,
        "role_deleted",
        request=request,
        actor_user_id=admin.id,
        app_id=role.app_id,
        detail={"key": role.key},
    )
    db.delete(role)
    db.commit()
```

In `identity/app/main.py`, replace:

```python
from app.bootstrap import bootstrap
```

with:

```python
from app.admin import apps as admin_apps
from app.bootstrap import bootstrap
```

In `identity/app/main.py`, replace:

```python
    app.include_router(me.router)
```

with:

```python
    app.include_router(me.router)
    app.include_router(admin_apps.router, prefix="/admin", tags=["admin"])
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/admin/test_admin_apps.py
```

Expected: `7 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `95 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): admin API for apps and roles"
```

---

### Task 12: Admin API: departments, users, exceptions

Department CRUD and app grants; user search; user detail with effective access and reasons; suspend and admin toggles; department membership; sign out everywhere; exceptions.

**Files:**
- Create: `identity/tests/admin/test_admin_departments.py`
- Create: `identity/tests/admin/test_admin_users.py`
- Create: `identity/app/admin/departments.py`
- Create: `identity/app/admin/users.py`
- Modify: `identity/app/main.py`

**Interfaces:**
- Consumes `resolve_access` (Task 3), `revoke_all_for_user` (Task 4), `app.admin.common` and `app.admin.schemas` (Task 11).
- Produces the `/admin/departments…`, `/admin/users…` and `/admin/overrides/{id}` routes from spec §6.

- [ ] **Step 1: Write the failing tests**

`identity/tests/admin/test_admin_departments.py`

```python
from tests.factories import add_to_department, make_app, make_department, make_user


def test_department_lifecycle_and_access(api, db, audited):
    app, roles = make_app(db, slug="crm")
    _, other_roles = make_app(db, slug="sales")
    dept = api.post("/admin/departments", json={"slug": "sales", "name": "Sales"}).json()
    access_url = f"/admin/departments/{dept['id']}/access"

    ok = api.put(access_url, json=[{"app_id": str(app.id), "app_role_id": str(roles["editor"].id)}])
    wrong_role = api.put(
        access_url, json=[{"app_id": str(app.id), "app_role_id": str(other_roles["editor"].id)}]
    )
    renamed = api.patch(f"/admin/departments/{dept['id']}", json={"name": "Sales Team"})

    assert ok.status_code == 200
    assert ok.json()["access"] == [
        {
            "app_id": str(app.id),
            "app_slug": "crm",
            "app_role_id": str(roles["editor"].id),
            "role_key": "editor",
        }
    ]
    assert wrong_role.status_code == 422
    assert renamed.json()["name"] == "Sales Team"
    assert api.post("/admin/departments", json={"slug": "sales", "name": "Dup"}).status_code == 409
    assert audited("department_access_replaced")


def test_department_delete_blocked_with_members(api, db):
    dept = make_department(db)
    add_to_department(db, make_user(db), dept)
    empty = make_department(db)
    assert api.delete(f"/admin/departments/{dept.id}").status_code == 409
    assert api.delete(f"/admin/departments/{empty.id}").status_code == 204
```

`identity/tests/admin/test_admin_users.py`

```python
from datetime import timedelta

from sqlalchemy import select

from app.models import AuthSession
from app.security import utcnow
from tests.factories import (
    add_to_department,
    grant_department,
    make_app,
    make_department,
    make_user,
)
from tests.oidc_helpers import sign_in


def test_user_detail_explains_effective_access(api, db):
    user = make_user(db)
    sales = make_department(db, "sales")
    add_to_department(db, user, sales)
    crm, crm_roles = make_app(db, slug="crm")
    inv, inv_roles = make_app(db, slug="invoicing")
    grant_department(db, sales, crm, crm_roles["manager"])

    created = api.post(
        f"/admin/users/{user.id}/overrides",
        json={
            "app_id": str(inv.id),
            "effect": "grant",
            "app_role_id": str(inv_roles["viewer"].id),
            "reason": "Quarter close",
            "expires_at": (utcnow() + timedelta(days=30)).isoformat(),
        },
    )
    detail = api.get(f"/admin/users/{user.id}").json()

    assert created.status_code == 201, created.text
    access = {a["app_slug"]: a for a in detail["access"]}
    assert (access["crm"]["role"], access["crm"]["reason"]) == ("manager", "department")
    assert access["crm"]["department_slug"] == "sales"
    assert (access["invoicing"]["role"], access["invoicing"]["reason"]) == (
        "viewer",
        "override_grant",
    )
    assert detail["overrides"][0]["active"] is True


def test_override_rules(api, db):
    user = make_user(db)
    app, roles = make_app(db)
    _, other_roles = make_app(db)
    url = f"/admin/users/{user.id}/overrides"
    base = {"app_id": str(app.id), "reason": "r"}
    wrong_app_role = base | {"effect": "grant", "app_role_id": str(other_roles["viewer"].id)}

    assert api.post(url, json=base | {"effect": "grant"}).status_code == 422
    assert api.post(url, json=wrong_app_role).status_code == 422
    first = api.post(url, json=base | {"effect": "deny"})
    assert first.status_code == 201
    assert api.post(url, json=base | {"effect": "deny"}).status_code == 409
    switched = api.patch(
        f"/admin/overrides/{first.json()['id']}",
        json={"effect": "grant", "app_role_id": str(roles["editor"].id)},
    )
    assert switched.json()["effect"] == "grant"
    assert api.delete(f"/admin/overrides/{first.json()['id']}").status_code == 204


def test_suspend_revokes_sessions_and_blocks_self_suspend(api, db, admin, audited):
    user = make_user(db)
    sign_in(api, db, user)
    api.cookies.clear()

    response = api.patch(f"/admin/users/{user.id}", json={"status": "suspended"})

    assert response.json()["status"] == "suspended"
    assert db.scalar(select(AuthSession).where(AuthSession.user_id == user.id)).revoked_at
    assert audited("user_suspended")
    assert api.patch(f"/admin/users/{admin.id}", json={"status": "suspended"}).status_code == 409


def test_replace_departments_and_list_filter(api, db):
    user = make_user(db, email="zed@yourco.com")
    sales = make_department(db, "sales")

    response = api.put(
        f"/admin/users/{user.id}/departments", json={"department_ids": [str(sales.id)]}
    )

    assert response.json()["department_slugs"] == ["sales"]
    listed = api.get("/admin/users", params={"department": "sales"}).json()
    assert [u["email"] for u in listed] == ["zed@yourco.com"]
    assert api.get("/admin/users", params={"query": "ZED"}).json()[0]["id"] == str(user.id)


def test_sign_out_everywhere(api, db, audited):
    user = make_user(db)
    sign_in(api, db, user)
    api.cookies.clear()
    assert api.post(f"/admin/users/{user.id}/signout").status_code == 204
    assert db.scalar(select(AuthSession).where(AuthSession.user_id == user.id)).revoked_at
    assert audited("user_signed_out_everywhere")
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/admin/test_admin_departments.py tests/admin/test_admin_users.py
```

Expected: FAIL — `KeyError: 'id'`

- [ ] **Step 3: Implement**

`identity/app/admin/departments.py`

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import audit
from app.admin.common import conflict, get_or_404
from app.admin.schemas import (
    DepartmentGrantIn,
    DepartmentGrantOut,
    DepartmentIn,
    DepartmentOut,
    DepartmentUpdate,
)
from app.db import get_db
from app.deps import require_admin
from app.models import App, AppRole, Department, DepartmentAppAccess, User, UserDepartment

router = APIRouter()


def _out(db: Session, department: Department) -> DepartmentOut:
    members = db.scalar(
        select(func.count())
        .select_from(UserDepartment)
        .where(UserDepartment.department_id == department.id)
    )
    grants = db.execute(
        select(App.id, App.slug, AppRole.id, AppRole.key)
        .join(DepartmentAppAccess, DepartmentAppAccess.app_id == App.id)
        .join(AppRole, AppRole.id == DepartmentAppAccess.app_role_id)
        .where(DepartmentAppAccess.department_id == department.id)
        .order_by(App.slug)
    ).all()
    return DepartmentOut(
        id=department.id,
        slug=department.slug,
        name=department.name,
        member_count=members,
        access=[
            DepartmentGrantOut(app_id=a, app_slug=s, app_role_id=r, role_key=k)
            for a, s, r, k in grants
        ],
    )


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> list[DepartmentOut]:
    return [_out(db, d) for d in db.scalars(select(Department).order_by(Department.name))]


@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department(
    body: DepartmentIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> DepartmentOut:
    if db.scalar(select(Department).where(Department.slug == body.slug)):
        raise conflict(f"Department '{body.slug}' already exists")
    department = Department(slug=body.slug, name=body.name)
    db.add(department)
    db.flush()
    audit.record(
        db,
        "department_created",
        request=request,
        actor_user_id=admin.id,
        detail={"slug": body.slug},
    )
    db.commit()
    return _out(db, department)


@router.patch("/departments/{department_id}", response_model=DepartmentOut)
def update_department(
    department_id: uuid.UUID,
    body: DepartmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> DepartmentOut:
    department = get_or_404(db, Department, department_id)
    department.name = body.name
    audit.record(
        db,
        "department_updated",
        request=request,
        actor_user_id=admin.id,
        detail={"slug": department.slug},
    )
    db.commit()
    return _out(db, department)


@router.delete("/departments/{department_id}", status_code=204)
def delete_department(
    department_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    department = get_or_404(db, Department, department_id)
    if db.scalar(select(UserDepartment).where(UserDepartment.department_id == department.id)):
        raise conflict("Department still has members; move them first")
    audit.record(
        db,
        "department_deleted",
        request=request,
        actor_user_id=admin.id,
        detail={"slug": department.slug},
    )
    db.delete(department)
    db.commit()


@router.put("/departments/{department_id}/access", response_model=DepartmentOut)
def replace_department_access(
    department_id: uuid.UUID,
    body: list[DepartmentGrantIn],
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> DepartmentOut:
    department = get_or_404(db, Department, department_id)
    if len({g.app_id for g in body}) != len(body):
        raise HTTPException(422, "Each app may appear only once")
    for grant in body:
        app = db.get(App, grant.app_id)
        role = db.get(AppRole, grant.app_role_id)
        if app is None or role is None or role.app_id != app.id:
            raise HTTPException(422, f"Role {grant.app_role_id} does not belong to {grant.app_id}")
        if app.is_system:
            raise HTTPException(422, "The portal cannot be assigned to departments")
    db.execute(
        delete(DepartmentAppAccess).where(DepartmentAppAccess.department_id == department.id)
    )
    for grant in body:
        db.add(
            DepartmentAppAccess(
                department_id=department.id, app_id=grant.app_id, app_role_id=grant.app_role_id
            )
        )
    audit.record(
        db,
        "department_access_replaced",
        request=request,
        actor_user_id=admin.id,
        detail={
            "slug": department.slug,
            "grants": [{"app_id": str(g.app_id), "app_role_id": str(g.app_role_id)} for g in body],
        },
    )
    db.commit()
    return _out(db, department)
```

`identity/app/admin/users.py`

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app import audit
from app.access import resolve_access
from app.admin.common import conflict, get_or_404
from app.admin.schemas import (
    EffectiveAccessOut,
    OverrideIn,
    OverrideOut,
    OverrideUpdate,
    UserDepartmentsIn,
    UserDetailOut,
    UserSummaryOut,
    UserUpdate,
)
from app.db import get_db
from app.deps import require_admin
from app.models import App, AppRole, Department, User, UserAppOverride, UserDepartment
from app.security import utcnow
from app.sessions import revoke_all_for_user

router = APIRouter()


def _departments(db: Session, user: User) -> list[Department]:
    return list(
        db.scalars(
            select(Department)
            .join(UserDepartment, UserDepartment.department_id == Department.id)
            .where(UserDepartment.user_id == user.id)
            .order_by(Department.name)
        )
    )


def _summary(db: Session, user: User) -> dict:
    return dict(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        status=user.status,
        is_admin=user.is_admin,
        last_login_at=user.last_login_at,
        department_slugs=[d.slug for d in _departments(db, user)],
    )


def _override_out(row: UserAppOverride) -> OverrideOut:
    return OverrideOut(
        id=row.id,
        app_id=row.app_id,
        effect=row.effect,
        app_role_id=row.app_role_id,
        reason=row.reason,
        created_by=row.created_by,
        created_at=row.created_at,
        expires_at=row.expires_at,
        active=row.expires_at is None or row.expires_at > utcnow(),
    )


def _detail(db: Session, user: User) -> dict:
    slugs = {d.id: d.slug for d in db.scalars(select(Department))}
    access = []
    for app in db.scalars(select(App).where(App.is_system.is_(False)).order_by(App.name)):
        decision = resolve_access(db, user, app)
        access.append(
            EffectiveAccessOut(
                app_id=app.id,
                app_slug=app.slug,
                app_name=app.name,
                role=decision.role.key if decision.role else None,
                reason=decision.reason,
                department_slug=slugs.get(decision.department_id),
                override_id=decision.override_id,
            )
        )
    overrides = db.scalars(select(UserAppOverride).where(UserAppOverride.user_id == user.id))
    return _summary(db, user) | {
        "departments": [
            {"id": d.id, "slug": d.slug, "name": d.name} for d in _departments(db, user)
        ],
        "overrides": [_override_out(o) for o in overrides],
        "access": access,
    }


def _validate_override(db: Session, app: App, effect: str, role_id: uuid.UUID | None) -> None:
    if app.is_system:
        raise HTTPException(422, "Exceptions cannot target the portal; suspend the user instead")
    if effect == "grant":
        role = db.get(AppRole, role_id) if role_id else None
        if role is None or role.app_id != app.id:
            raise HTTPException(422, "app_role_id must be a role of the selected app")
    elif role_id is not None:
        raise HTTPException(422, "Deny exceptions do not take a role")


@router.get("/users", response_model=list[UserSummaryOut])
def list_users(
    query: str | None = None,
    department: str | None = None,
    status: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[dict]:
    stmt = select(User).order_by(User.email).limit(limit).offset(offset)
    if query:
        pattern = f"%{query.lower()}%"
        stmt = stmt.where(or_(User.email.ilike(pattern), User.name.ilike(pattern)))
    if status:
        stmt = stmt.where(User.status == status)
    if department:
        stmt = (
            stmt.join(UserDepartment, UserDepartment.user_id == User.id)
            .join(Department, Department.id == UserDepartment.department_id)
            .where(Department.slug == department)
        )
    return [_summary(db, u) for u in db.scalars(stmt)]


@router.get("/users/{user_id}", response_model=UserDetailOut)
def get_user(
    user_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> dict:
    return _detail(db, get_or_404(db, User, user_id))


@router.patch("/users/{user_id}", response_model=UserDetailOut)
def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = get_or_404(db, User, user_id)
    if user.id == admin.id and (body.status == "suspended" or body.is_admin is False):
        raise conflict("You cannot suspend or demote yourself")
    if body.status is not None and body.status != user.status:
        user.status = body.status
        if body.status == "suspended":
            revoke_all_for_user(db, user.id)
        event = "user_suspended" if body.status == "suspended" else "user_reactivated"
        audit.record(db, event, request=request, actor_user_id=admin.id, subject_user_id=user.id)
    if body.is_admin is not None and body.is_admin != user.is_admin:
        user.is_admin = body.is_admin
        audit.record(
            db,
            "admin_granted" if body.is_admin else "admin_revoked",
            request=request,
            actor_user_id=admin.id,
            subject_user_id=user.id,
        )
    db.commit()
    return _detail(db, user)


@router.put("/users/{user_id}/departments", response_model=UserDetailOut)
def replace_user_departments(
    user_id: uuid.UUID,
    body: UserDepartmentsIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = get_or_404(db, User, user_id)
    ids = set(body.department_ids)
    found = set(db.scalars(select(Department.id).where(Department.id.in_(ids))))
    if found != ids:
        raise HTTPException(422, "Unknown department id")
    db.execute(delete(UserDepartment).where(UserDepartment.user_id == user.id))
    for department_id in ids:
        db.add(UserDepartment(user_id=user.id, department_id=department_id))
    audit.record(
        db,
        "user_departments_replaced",
        request=request,
        actor_user_id=admin.id,
        subject_user_id=user.id,
        detail={"department_ids": sorted(str(i) for i in ids)},
    )
    db.commit()
    return _detail(db, user)


@router.post("/users/{user_id}/signout", status_code=204)
def sign_out_everywhere(
    user_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    user = get_or_404(db, User, user_id)
    revoke_all_for_user(db, user.id)
    audit.record(
        db,
        "user_signed_out_everywhere",
        request=request,
        actor_user_id=admin.id,
        subject_user_id=user.id,
    )
    db.commit()


@router.get("/users/{user_id}/overrides", response_model=list[OverrideOut])
def list_overrides(
    user_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> list[OverrideOut]:
    user = get_or_404(db, User, user_id)
    rows = db.scalars(select(UserAppOverride).where(UserAppOverride.user_id == user.id))
    return [_override_out(r) for r in rows]


@router.post("/users/{user_id}/overrides", response_model=OverrideOut, status_code=201)
def create_override(
    user_id: uuid.UUID,
    body: OverrideIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> OverrideOut:
    user = get_or_404(db, User, user_id)
    app = db.get(App, body.app_id)
    if app is None:
        raise HTTPException(422, "Unknown app_id")
    _validate_override(db, app, body.effect, body.app_role_id)
    existing = db.scalar(
        select(UserAppOverride).where(
            UserAppOverride.user_id == user.id, UserAppOverride.app_id == app.id
        )
    )
    if existing:
        raise conflict("This user already has an exception for this app; edit it instead")
    row = UserAppOverride(
        user_id=user.id,
        app_id=app.id,
        effect=body.effect,
        app_role_id=body.app_role_id,
        reason=body.reason,
        created_by=admin.id,
        expires_at=body.expires_at,
    )
    db.add(row)
    db.flush()
    audit.record(
        db,
        "override_created",
        request=request,
        actor_user_id=admin.id,
        subject_user_id=user.id,
        app_id=app.id,
        detail={"effect": body.effect, "reason": body.reason},
    )
    db.commit()
    db.refresh(row)
    return _override_out(row)


@router.patch("/overrides/{override_id}", response_model=OverrideOut)
def update_override(
    override_id: uuid.UUID,
    body: OverrideUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> OverrideOut:
    row = get_or_404(db, UserAppOverride, override_id)
    changes = body.model_dump(exclude_unset=True)
    effect = changes.get("effect", row.effect)
    if "app_role_id" in changes:
        role_id = changes["app_role_id"]
    else:
        role_id = None if effect == "deny" else row.app_role_id
    _validate_override(db, db.get(App, row.app_id), effect, role_id)
    row.effect = effect
    row.app_role_id = role_id
    if "reason" in changes:
        row.reason = changes["reason"]
    if "expires_at" in changes:
        row.expires_at = changes["expires_at"]
    audit.record(
        db,
        "override_updated",
        request=request,
        actor_user_id=admin.id,
        subject_user_id=row.user_id,
        app_id=row.app_id,
        detail={"fields": sorted(changes)},
    )
    db.commit()
    return _override_out(row)


@router.delete("/overrides/{override_id}", status_code=204)
def delete_override(
    override_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    row = get_or_404(db, UserAppOverride, override_id)
    audit.record(
        db,
        "override_deleted",
        request=request,
        actor_user_id=admin.id,
        subject_user_id=row.user_id,
        app_id=row.app_id,
    )
    db.delete(row)
    db.commit()
```

In `identity/app/main.py`, replace:

```python
from app.admin import apps as admin_apps
```

with:

```python
from app.admin import apps as admin_apps
from app.admin import departments as admin_departments
from app.admin import users as admin_users
```

In `identity/app/main.py`, replace:

```python
    app.include_router(admin_apps.router, prefix="/admin", tags=["admin"])
```

with:

```python
    app.include_router(admin_apps.router, prefix="/admin", tags=["admin"])
    app.include_router(admin_departments.router, prefix="/admin", tags=["admin"])
    app.include_router(admin_users.router, prefix="/admin", tags=["admin"])
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/admin/test_admin_departments.py tests/admin/test_admin_users.py
```

Expected: `7 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `102 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): admin API for departments, users and exceptions"
```

---

### Task 13: Admin API: audit log and key rotation

Paged, filterable audit log and signing-key rotation.

**Files:**
- Create: `identity/tests/admin/test_admin_system.py`
- Create: `identity/app/admin/system.py`
- Modify: `identity/app/main.py`

**Interfaces:**
- Consumes `keys.rotate` (Task 4).
- Produces `GET /admin/audit?event=&user=&app=&from=&to=&before_id=&limit=` (newest first; page with `before_id`) and `POST /admin/keys/rotate` → `{kid}`.

- [ ] **Step 1: Write the failing tests**

`identity/tests/admin/test_admin_system.py`

```python
from datetime import timedelta

from sqlalchemy import select

from app.models import SigningKey
from app.security import utcnow


def test_audit_log_filters(api, admin):
    api.post("/admin/departments", json={"slug": "ops", "name": "Ops"})
    entries = api.get("/admin/audit", params={"event": "department_created"}).json()
    assert len(entries) == 1
    assert entries[0]["actor_user_id"] == str(admin.id)
    assert entries[0]["request_id"]


def test_key_rotation_keeps_old_key_published(api, db):
    old_kid = db.scalar(select(SigningKey.kid).where(SigningKey.retired_at.is_(None)))
    old_token = api.headers["Authorization"]

    new_kid = api.post("/admin/keys/rotate").json()["kid"]

    kids = {k["kid"] for k in api.get("/jwks").json()["keys"]}
    assert {old_kid, new_kid} <= kids
    assert api.get("/me", headers={"Authorization": old_token}).status_code == 200


def test_retired_key_unpublished_after_24h(api, db):
    old_kid = db.scalar(select(SigningKey.kid).where(SigningKey.retired_at.is_(None)))
    api.post("/admin/keys/rotate")
    db.get(SigningKey, old_kid).retired_at = utcnow() - timedelta(hours=25)
    db.commit()
    assert old_kid not in {k["kid"] for k in api.get("/jwks").json()["keys"]}
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/admin/test_admin_system.py
```

Expected: FAIL — `KeyError: 0`

- [ ] **Step 3: Implement**

`identity/app/admin/system.py`

```python
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import audit
from app.admin.schemas import AuditOut
from app.config import Settings, get_settings
from app.db import get_db
from app.deps import require_admin
from app.keys import rotate
from app.models import AuditLog, User

router = APIRouter()


@router.get("/audit", response_model=list[AuditOut])
def list_audit(
    event: str | None = None,
    user: uuid.UUID | None = None,
    app: uuid.UUID | None = None,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    before_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[AuditLog]:
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    if event:
        stmt = stmt.where(AuditLog.event == event)
    if user:
        stmt = stmt.where(or_(AuditLog.subject_user_id == user, AuditLog.actor_user_id == user))
    if app:
        stmt = stmt.where(AuditLog.app_id == app)
    if from_:
        stmt = stmt.where(AuditLog.at >= from_)
    if to:
        stmt = stmt.where(AuditLog.at < to)
    if before_id:
        stmt = stmt.where(AuditLog.id < before_id)
    return list(db.scalars(stmt))


@router.post("/keys/rotate")
def rotate_keys(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    admin: User = Depends(require_admin),
) -> dict:
    kid = rotate(db, settings.key_encryption_key)
    audit.record(
        db, "signing_key_rotated", request=request, actor_user_id=admin.id, detail={"kid": kid}
    )
    db.commit()
    return {"kid": kid}
```

In `identity/app/main.py`, replace:

```python
from app.admin import departments as admin_departments
```

with:

```python
from app.admin import departments as admin_departments
from app.admin import system as admin_system
```

In `identity/app/main.py`, replace:

```python
    app.include_router(admin_users.router, prefix="/admin", tags=["admin"])
```

with:

```python
    app.include_router(admin_users.router, prefix="/admin", tags=["admin"])
    app.include_router(admin_system.router, prefix="/admin", tags=["admin"])
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/admin/test_admin_system.py
```

Expected: `3 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `105 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Commit**

```bash
git add identity
git commit -m "feat(identity): admin audit log and key rotation"
```

---

### Task 14: Dev seed, container image, Compose service, README

Idempotent development seed (users, departments, and the `example` client Plan 3 uses), the production image, the `identity` Compose service, and operator docs.

**Files:**
- Create: `identity/tests/test_seed.py`
- Create: `identity/app/seed.py`
- Create: `identity/Dockerfile`
- Create: `identity/README.md`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces `python -m app.seed` (refuses unless `ENVIRONMENT=development`): users `admin@` (admin, sales), `sam@` (sales), `fiona@` (finance), `newbie@yourco.com` (none); departments `sales`, `finance`; client `example` (secret `dev-client-secret`, redirect `http://localhost:3001/api/auth/callback/identity`, roles viewer/manager, sales→manager, finance→viewer).
- Produces Compose service `identity` at http://localhost:8000 (dev login on, migrations and seed run at start).

- [ ] **Step 1: Write the failing tests**

`identity/tests/test_seed.py`

```python
from sqlalchemy import func, select

from app.access import resolve_role
from app.models import App, User
from app.seed import seed


def test_seed_is_idempotent_and_grants_example_access(db):
    seed(db)
    seed(db)
    assert db.scalar(select(func.count()).select_from(User)) == 4
    example = db.scalar(select(App).where(App.slug == "example"))
    sam = db.scalar(select(User).where(User.email == "sam@yourco.com"))
    newbie = db.scalar(select(User).where(User.email == "newbie@yourco.com"))
    assert resolve_role(db, sam, example).key == "manager"
    assert resolve_role(db, newbie, example) is None
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
uv run pytest tests/test_seed.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.seed'`

- [ ] **Step 3: Implement**

`identity/app/seed.py`

```python
"""Idempotent development data: `python -m app.seed`. Refuses to run outside development."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_sessionmaker
from app.models import App, AppRole, Department, DepartmentAppAccess, User, UserDepartment
from app.security import hash_secret

DEV_CLIENT_SECRET = "dev-client-secret"

DEPARTMENTS = [("sales", "Sales"), ("finance", "Finance")]
USERS = [
    ("admin@yourco.com", "Ada Admin", True, ["sales"]),
    ("sam@yourco.com", "Sam Sales", False, ["sales"]),
    ("fiona@yourco.com", "Fiona Finance", False, ["finance"]),
    ("newbie@yourco.com", "Nia New", False, []),
]
EXAMPLE_APP = {
    "slug": "example",
    "name": "Example App",
    "description": "Reference Next.js + Python integration",
    "launch_url": "http://localhost:3001",
    "redirect_uris": ["http://localhost:3001/api/auth/callback/identity"],
    "post_logout_redirect_uris": ["http://localhost:3001/"],
    "roles": [("viewer", "Viewer", 10), ("manager", "Manager", 30)],
    "department_roles": {"sales": "manager", "finance": "viewer"},
}


def seed(db: Session) -> None:
    departments = {}
    for slug, name in DEPARTMENTS:
        department = db.scalar(select(Department).where(Department.slug == slug))
        if department is None:
            department = Department(slug=slug, name=name)
            db.add(department)
            db.flush()
        departments[slug] = department

    for email, name, is_admin, dept_slugs in USERS:
        if db.scalar(select(User).where(User.email == email)) is None:
            user = User(email=email, name=name, is_admin=is_admin, status="active")
            db.add(user)
            db.flush()
            for slug in dept_slugs:
                db.add(UserDepartment(user_id=user.id, department_id=departments[slug].id))

    spec = EXAMPLE_APP
    if db.scalar(select(App).where(App.slug == spec["slug"])) is None:
        app = App(
            slug=spec["slug"],
            name=spec["name"],
            description=spec["description"],
            icon="",
            launch_url=spec["launch_url"],
            client_id=spec["slug"],
            client_secret_hash=hash_secret(DEV_CLIENT_SECRET),
            redirect_uris=spec["redirect_uris"],
            post_logout_redirect_uris=spec["post_logout_redirect_uris"],
            status="active",
            is_system=False,
        )
        db.add(app)
        db.flush()
        roles = {}
        for key, label, rank in spec["roles"]:
            roles[key] = AppRole(app_id=app.id, key=key, label=label, rank=rank)
            db.add(roles[key])
        db.flush()
        for dept_slug, role_key in spec["department_roles"].items():
            db.add(
                DepartmentAppAccess(
                    department_id=departments[dept_slug].id,
                    app_id=app.id,
                    app_role_id=roles[role_key].id,
                )
            )
    db.commit()


def main() -> None:
    if get_settings().environment != "development":
        raise SystemExit("Refusing to seed: ENVIRONMENT must be 'development'")
    with get_sessionmaker()() as db:
        seed(db)
    print("Seeded development data. Example client secret:", DEV_CLIENT_SECRET)


if __name__ == "__main__":
    main()
```

`identity/Dockerfile`

```dockerfile
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.8 /uv /bin/uv

WORKDIR /srv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/srv/.venv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app

ENV PATH="/srv/.venv/bin:$PATH" FORWARDED_ALLOW_IPS="127.0.0.1"
EXPOSE 8000
USER nobody
CMD ["sh", "-c", "uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips \"$FORWARDED_ALLOW_IPS\""]
```

`docker-compose.yml` (replace the whole file)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: central
      POSTGRES_PASSWORD: central
      POSTGRES_DB: identity
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./identity/docker/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U central -d identity"]
      interval: 2s
      retries: 30

  identity:
    build: ./identity
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      ENVIRONMENT: development
      DATABASE_URL: postgresql+psycopg://central:central@postgres:5432/identity
      COMPANY_DOMAIN: yourco.com
      ISSUER_URL: http://localhost:8000
      KEY_ENCRYPTION_KEY: uB0yq0lqV3m7vJx9I6kzvJ6o4wqkJ7mYwR2fT5bq8nE=
      SESSION_SECRET: dev-session-secret
      INITIAL_ADMIN_EMAILS: admin@yourco.com
      PORTAL_URL: http://localhost:3000
      PORTAL_CLIENT_SECRET: dev-portal-secret
      DEV_LOGIN_ENABLED: "true"
    command: >
      sh -c "alembic upgrade head && python -m app.seed &&
             uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000"
    ports:
      - "8000:8000"

volumes:
  pgdata:
```

`identity/README.md`

````markdown
# Identity Service

Central sign-in for company apps. It is an OpenID Connect provider that federates Google
Workspace, decides each user's role per app (department grants plus per-person exceptions),
and serves the user and admin APIs the portal uses.

Design: `docs/superpowers/specs/2026-09-16-central-platform-sso-design.md`.

## Local development

Requires Docker, Python 3.12 and [uv](https://docs.astral.sh/uv/).

```bash
# Everything in containers (identity on http://localhost:8000, dev login enabled)
docker compose up --build

# Or run the service from source against the Compose Postgres
docker compose up -d postgres
cd identity
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:create_app --factory --reload
```

With `DEV_LOGIN_ENABLED=true`, `/login` goes to `/dev-login`, a picker of seeded users, so no
Google credentials are needed. The service refuses to start with dev login enabled when
`ENVIRONMENT=production`.

Seeded users: `admin@yourco.com` (admin, Sales), `sam@yourco.com` (Sales),
`fiona@yourco.com` (Finance), `newbie@yourco.com` (no department). The seeded client `example`
uses secret `dev-client-secret`.

## Tests

```bash
docker compose up -d postgres
cd identity
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

Tests use the `identity_test` database (`TEST_DATABASE_URL` overrides it). The schema is rebuilt
from the Alembic migrations at the start of each run, and every test is rolled back.

## Configuration

| Variable | Purpose |
|---|---|
| `ENVIRONMENT` | `development`, `test`, `staging` or `production` |
| `COMPANY_DOMAIN` | Google Workspace domain allowed to sign in |
| `ISSUER_URL` | Public URL of this service, e.g. `https://auth.yourco.com` (https required outside development) |
| `DATABASE_URL` | `postgresql+psycopg://…` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client (see below) |
| `KEY_ENCRYPTION_KEY` | Fernet key that encrypts private signing keys at rest |
| `SESSION_SECRET` | Signs the short-lived sign-in flow cookie |
| `INITIAL_ADMIN_EMAILS` | Comma-separated emails made admin on first sign-in |
| `PORTAL_URL`, `PORTAL_CLIENT_SECRET` | Portal client registration, synced at startup |
| `DEV_LOGIN_ENABLED` | Development-only user picker |
| `FORWARDED_ALLOW_IPS` | (container) proxy addresses trusted for `X-Forwarded-*` |

Generate a key-encryption key with
`uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.

## Google OAuth client

In Google Cloud Console, for the Workspace organisation:

1. Set the OAuth consent screen user type to **Internal**.
2. Create an OAuth client ID of type **Web application**.
3. Add the authorized redirect URI `https://auth.<your-domain>/google/callback`.
4. Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Operating

- Run `alembic upgrade head` as a one-off job before rolling out a new version.
- Run at least two replicas behind the TLS-terminating proxy, and set `FORWARDED_ALLOW_IPS` to the proxy addresses.
- `/healthz` reports the process is up; `/readyz` reports database reachability and an active signing key.
- Logs are JSON on stdout, one line per request, with `request_id` (also returned as `X-Request-ID`).
- Rate limits are per replica and held in memory.
````

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_seed.py
```

Expected: `1 passed`

- [ ] **Step 5: Run the full suite and lint**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: `106 passed`, `All checks passed!`, and no files needing formatting.

- [ ] **Step 6: Run the whole stack and walk the login flow**

```bash
docker compose up --build -d
curl -s localhost:8000/readyz
curl -s localhost:8000/.well-known/openid-configuration
```

Expected: `{"status":"ok"}`, then a discovery document whose `issuer` is `http://localhost:8000`. Opening http://localhost:8000/dev-login in a browser lists the four seeded users.

> The Dockerfile and Compose `identity` service were not built during planning (Docker was unavailable on the planning machine). Everything else in this task was run.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml identity
git commit -m "feat(identity): dev seed, container image, compose service and README"
```

---

## Done When

- `uv run pytest` reports `106 passed` and ruff is clean.
- `docker compose up --build` serves http://localhost:8000; `/readyz` is `ok`; dev login lists the seeded users.
- Signing in as `sam@yourco.com` against client `example` yields tokens whose `role` is `manager`; `fiona@yourco.com` gets `viewer`; `newbie@yourco.com` sees the "You don't have access" page.
