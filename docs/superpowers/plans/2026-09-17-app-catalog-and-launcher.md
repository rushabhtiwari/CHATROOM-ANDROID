# Central Platform — Plan 3: App Catalog and Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register the company's department apps and company tools (coming soon until built), give every app an icon or uploaded logo, and replace the portal dashboard with a minimal, search-first launcher in a new soft visual style.

**Architecture:** The identity service gains three app attributes (group, coming-soon status, logo) plus a data migration that seeds the catalog everywhere. Logos are validated by their bytes, stored in Postgres, and served only to signed-in people. The portal reads the new fields from `/me/apps`, renders a client-side launcher with Lucide icons in stable soft colours, proxies logos through its own route, and gives admins controls for group, icon, status and logo.

**Tech Stack:** Identity: Python 3.12, FastAPI, SQLAlchemy, Alembic, pytest. Portal: Next.js 16.3.5, React 19.2, `lucide-react` 1.47.0, Inter via `next/font`, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-17-app-catalog-and-launcher-design.md`. Builds on Plans 1 and 2 (`docs/superpowers/plans/2026-09-17-identity-service.md`, `docs/superpowers/plans/2026-09-17-portal.md`).

## Global Constraints

- App statuses are exactly `active` (shown as Live), `coming_soon`, `disabled`. Groups are exactly `department` and `company`.
- Coming-soon apps resolve roles like live apps but can never sign anyone in; only `active` apps are OAuth clients.
- An app can only be `active` with a non-empty address and at least one sign-in callback URL.
- Logos: PNG, JPEG or WebP detected from bytes, at most 256 KB, never SVG; served with `Content-Security-Policy: default-src 'none'` and `X-Content-Type-Options: nosniff`, only to signed-in people.
- Icons: only the 30 curated Lucide names in `portal/lib/icons.tsx`; unknown names draw `app-window`.
- Visual tokens are the ones in spec §4.1; colour appears only in app icons.
- Every identity task ends with `uv run pytest && uv run ruff check . && uv run ruff format --check .` passing; every portal task ends with `npm test && npm run lint && npm run typecheck && npm run format:check` passing, plus its Playwright spec from Task 5.
- Run `uv run …` from `identity/`, `npm …`/`npx …` from `portal/`, `docker compose …` and `git …` from the repository root.

## Decisions made while planning

1. **Scratch names in existing tests change.** Tests that used `sales` and `finance` as throwaway department and app names now collide with the seeded catalog, so they use `field-sales`, `sales-crm` and `treasury`.
2. **Coming-soon tiles are softer than the spec's first draft**: 70% opacity and partly desaturated instead of 55%, because every app starts coming soon and the launcher looked grey. The spec was updated to match.
3. **Testing Library cleanup is registered explicitly** in `vitest.setup.ts`, since Vitest runs without globals.
4. **Logo removal has no separate message.** The preview returns to the icon and the button reads "Upload logo" again.

## Prerequisites

- Plans 1 and 2 are merged, and `docker compose up -d` plus the portal's `.env.local` work.
- Work on a feature branch: `git checkout -b feat/app-catalog`.

## File Map

```
identity/
  app/models.py                     App.category, logo, logo_content_type, logo_updated_at, coming_soon
  migrations/versions/0002_app_catalog.py
  app/access.py                     only `disabled` blocks access
  app/admin/schemas.py, common.py, apps.py   group/status/icon fields, go-live rule, logo endpoints
  app/routes/me.py                  coming-soon apps and catalog fields
  app/logos.py                      byte-sniffing and limits
  app/routes/logos.py               GET /apps/{slug}/logo
  app/main.py                       registers the logo route
  tests/test_catalog.py, test_app_status.py, test_logos.py, admin/test_admin_logos.py (+ updated tests)
portal/
  package.json                      lucide-react
  lib/types.ts, api/client.ts, identity.ts   catalog fields, upload, raw
  lib/icons.tsx, tones.ts, launcher.ts, apps.ts, forms.ts
  components/Launcher.tsx, AppTile.tsx, AppMark.tsx, AccountMenu.tsx, TopBar.tsx, IconPicker.tsx
  app/page.tsx, layout.tsx, globals.css, logos/[slug]/route.ts
  app/admin/apps/page.tsx, [id]/page.tsx, actions.ts
  vitest.setup.ts, e2e/dashboard.spec.ts, e2e/apps.spec.ts
  (removed) components/AppGrid.tsx, lib/monogram.ts and their tests
```

---

### Task 1: Identity: app catalog data model and migration

Add group, logo and coming-soon support to apps, and a migration that seeds the 13 catalog apps, 9 departments, default roles and default access in every environment (spec §3.1, §3.4).

**Files:**
- Modify: `identity/app/models.py`
- Create: `identity/migrations/versions/0002_app_catalog.py`
- Modify: `identity/tests/admin/test_admin_departments.py`
- Modify: `identity/tests/admin/test_admin_users.py`
- Create: `identity/tests/test_catalog.py`
- Modify: `identity/tests/test_logout.py`
- Modify: `identity/tests/test_me.py`

**Interfaces:**
- Produces `App.category` (`department` | `company`), `App.logo` (deferred bytes), `App.logo_content_type`, `App.logo_updated_at`; `App.status` may now be `coming_soon`.
- Produces migration `0002` with the catalog in spec §3.4 (slugs `sales`, `dispatch`, `accounts`, `finance`, `marketing`, `purchase`, `hr`, `production`, `quality`, `requisitions`, `projects`, `automation`, `chat`).

**Notes:**
- Migration `0002` creates the catalog in every environment, not only in development. It is idempotent by slug: existing departments and apps are left untouched, and grants are added only for apps it inserts. `test_seed_leaves_existing_departments_and_apps_alone` proves this on a throwaway database.
- Row ids come from `uuid5` over the slug, so every environment gets the same ids.
- Existing tests that used `sales` and `finance` as scratch department and app names now collide with the catalog, so they switch to `field-sales`, `sales-crm` and `treasury`.
- `apps.logo` is `deferred` so listing apps never loads image bytes.

- [ ] **Step 1: Write the failing tests**

Replace the whole file `identity/tests/admin/test_admin_departments.py`:

```python
from tests.factories import add_to_department, make_app, make_department, make_user


def test_department_lifecycle_and_access(api, db, audited):
    app, roles = make_app(db, slug="crm")
    _, other_roles = make_app(db, slug="sales-crm")
    dept = api.post(
        "/admin/departments", json={"slug": "field-sales", "name": "Field sales"}
    ).json()
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
    assert (
        api.post("/admin/departments", json={"slug": "field-sales", "name": "Dup"}).status_code
        == 409
    )
    assert audited("department_access_replaced")


def test_department_delete_blocked_with_members(api, db):
    dept = make_department(db)
    add_to_department(db, make_user(db), dept)
    empty = make_department(db)
    assert api.delete(f"/admin/departments/{dept.id}").status_code == 409
    assert api.delete(f"/admin/departments/{empty.id}").status_code == 204
```

Replace the whole file `identity/tests/admin/test_admin_users.py`:

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
    sales = make_department(db, "field-sales")
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
    assert access["crm"]["department_slug"] == "field-sales"
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
    sales = make_department(db, "field-sales")

    response = api.put(
        f"/admin/users/{user.id}/departments", json={"department_ids": [str(sales.id)]}
    )

    assert response.json()["department_slugs"] == ["field-sales"]
    listed = api.get("/admin/users", params={"department": "field-sales"}).json()
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

Create `identity/tests/test_catalog.py`:

```python
import os
import uuid

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

from app.models import App, AppRole
from tests.conftest import ROOT

CATALOG = {
    "sales": ("Sales", "department", "trending-up"),
    "dispatch": ("Dispatch", "department", "truck"),
    "accounts": ("Accounts", "department", "book-open"),
    "finance": ("Finance", "department", "landmark"),
    "marketing": ("Marketing & RFQ", "department", "megaphone"),
    "purchase": ("Purchase & Procurement", "department", "shopping-cart"),
    "hr": ("HR", "department", "users"),
    "production": ("Production", "department", "factory"),
    "quality": ("Quality", "department", "badge-check"),
    "requisitions": ("Requisitions & Budget", "company", "clipboard-check"),
    "projects": ("Projects", "company", "kanban"),
    "automation": ("Automation", "company", "zap"),
    "chat": ("Chat", "company", "message-circle"),
}


def _app(db, slug: str) -> App:
    return db.scalar(select(App).where(App.slug == slug))


def test_catalog_apps_are_seeded_as_coming_soon(db):
    for slug, (name, category, icon) in CATALOG.items():
        app = _app(db, slug)
        assert (app.name, app.category, app.icon, app.status) == (
            name,
            category,
            icon,
            "coming_soon",
        )
        assert app.client_id == slug
        assert app.launch_url == "" and app.redirect_uris == []
        roles = db.scalars(select(AppRole).where(AppRole.app_id == app.id).order_by(AppRole.rank))
        assert [(r.key, r.rank) for r in roles] == [("member", 10), ("manager", 30)]


def test_existing_apps_default_to_department_category(db):
    portal = _app(db, "portal")
    assert (portal.category, portal.status) == ("department", "active")


def test_logo_requires_content_type(db):
    app = _app(db, "chat")
    app.logo = b"\x89PNG"
    with pytest.raises(IntegrityError):
        db.flush()


def test_seed_leaves_existing_departments_and_apps_alone():
    """Upgrading a database that already has a `sales` department and app keeps them."""
    base = make_url(os.environ["TEST_DATABASE_URL"])
    name = f"identity_migration_{uuid.uuid4().hex[:8]}"
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    url = base.set(database=name).render_as_string(hide_password=False)
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.attributes["database_url"] = url
    engine = create_engine(url)
    try:
        command.upgrade(config, "0001")
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO departments (id, slug, name) "
                    "VALUES (gen_random_uuid(), 'sales', 'Field sales')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO apps (id, slug, name, description, icon, launch_url, "
                    "client_id, client_secret_hash, redirect_uris, post_logout_redirect_uris, "
                    "status, is_system) "
                    "VALUES (gen_random_uuid(), 'chat', 'Team chat', '', '', "
                    "'https://chat.yourco.com', 'chat', '!', "
                    "'{}', '{}', 'active', false)"
                )
            )

        command.upgrade(config, "head")

        with engine.connect() as conn:
            assert (
                conn.scalar(text("SELECT name FROM departments WHERE slug = 'sales'"))
                == "Field sales"
            )
            chat = conn.execute(
                text("SELECT name, status, category FROM apps WHERE slug = 'chat'")
            ).one()
            assert tuple(chat) == ("Team chat", "active", "department")
            assert (
                conn.scalar(
                    text(
                        "SELECT count(*) FROM app_roles r JOIN apps a ON a.id = r.app_id "
                        "WHERE a.slug = 'chat'"
                    )
                )
                == 0
            )
            assert conn.scalar(text("SELECT count(*) FROM apps WHERE status = 'coming_soon'")) == 12
    finally:
        engine.dispose()
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()
```

Replace the whole file `identity/tests/test_logout.py`:

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
    sales, sales_roles = make_app(db, slug="sales-crm")
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

Replace the whole file `identity/tests/test_me.py`:

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
    sales = make_department(db, "field-sales")
    add_to_department(db, user, sales)
    crm, crm_roles = make_app(db, slug="crm", name="CRM")
    invoicing, inv_roles = make_app(db, slug="invoicing", name="Invoicing")
    make_app(db, slug="treasury")
    grant_department(db, sales, crm, crm_roles["manager"])
    add_override(db, user, invoicing, "grant", inv_roles["viewer"])
    token = portal_token(client, db, user, settings)

    me = client.get("/me", headers=_auth(token)).json()
    apps = client.get("/me/apps", headers=_auth(token)).json()

    assert me["email"] == user.email and me["is_admin"] is False
    assert [d["slug"] for d in me["departments"]] == ["field-sales"]
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
cd identity
uv run pytest tests/test_catalog.py
```

Expected: FAIL — `4 failed`.

- [ ] **Step 3: Implement**

Replace the whole file `identity/app/models.py`:

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
    LargeBinary,
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
    __table_args__ = (
        CheckConstraint("status IN ('active', 'coming_soon', 'disabled')", name="ck_apps_status"),
        CheckConstraint("category IN ('department', 'company')", name="ck_apps_category"),
        CheckConstraint("(logo IS NULL) = (logo_content_type IS NULL)", name="ck_apps_logo_type"),
    )

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
    category: Mapped[str] = mapped_column(
        String(16), default="department", server_default="department"
    )
    logo: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    logo_content_type: Mapped[str | None] = mapped_column(String(32))
    logo_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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

Create `identity/migrations/versions/0002_app_catalog.py`:

```python
"""App catalog: categories, coming-soon status, logos, and the company's department apps

Revision ID: 0002
Revises: 0001
"""

import uuid

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Stable ids so every environment gets the same rows.
NAMESPACE = uuid.UUID("7b1d7f40-3c0e-4a4f-9d2c-6f1f3a2b9c10")

DEPARTMENTS = [
    ("sales", "Sales"),
    ("dispatch", "Dispatch"),
    ("accounts", "Accounts"),
    ("finance", "Finance"),
    ("marketing", "Marketing"),
    ("purchase", "Purchase"),
    ("hr", "HR"),
    ("production", "Production"),
    ("quality", "Quality"),
]

# slug, name, category, icon, description, departments granted `member`
ALL = [slug for slug, _ in DEPARTMENTS]
APPS = [
    (
        "sales",
        "Sales",
        "department",
        "trending-up",
        "Pending orders, invoices, customer MIS and credit checks",
        ["sales"],
    ),
    (
        "dispatch",
        "Dispatch",
        "department",
        "truck",
        "Dispatch plans, POD and GRN follow-up",
        ["dispatch"],
    ),
    (
        "accounts",
        "Accounts",
        "department",
        "book-open",
        "Bank reconciliation and vendor outstanding",
        ["accounts"],
    ),
    (
        "finance",
        "Finance",
        "department",
        "landmark",
        "Receivables reports and UTR capture",
        ["finance"],
    ),
    (
        "marketing",
        "Marketing & RFQ",
        "department",
        "megaphone",
        "Enquiries to RFQs, quotations and demand planning",
        ["marketing"],
    ),
    (
        "purchase",
        "Purchase & Procurement",
        "department",
        "shopping-cart",
        "Purchase requests, vendor quotes, POs and GRN",
        ["purchase"],
    ),
    ("hr", "HR", "department", "users", "Onboarding, leave, attendance and performance", ["hr"]),
    (
        "production",
        "Production",
        "department",
        "factory",
        "Production planning and tracking",
        ["production"],
    ),
    (
        "quality",
        "Quality",
        "department",
        "badge-check",
        "Inspections and quality records",
        ["quality"],
    ),
    (
        "requisitions",
        "Requisitions & Budget",
        "company",
        "clipboard-check",
        "Requisitions, approvals and monthly budgets",
        ALL,
    ),
    (
        "projects",
        "Projects",
        "company",
        "kanban",
        "Tasks, timelines, time tracking and costing",
        ALL,
    ),
    ("automation", "Automation", "company", "zap", "Your to-do list and escalations", ALL),
    ("chat", "Chat", "company", "message-circle", "Channels, messages and the AI assistant", ALL),
]

ROLES = [("member", "Member", 10), ("manager", "Manager", 30)]


def _id(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{kind}:{key}")


def upgrade() -> None:
    op.drop_constraint("ck_apps_status", "apps", type_="check")
    op.create_check_constraint(
        "ck_apps_status", "apps", "status IN ('active', 'coming_soon', 'disabled')"
    )
    op.add_column(
        "apps",
        sa.Column("category", sa.String(length=16), server_default="department", nullable=False),
    )
    op.add_column("apps", sa.Column("logo", sa.LargeBinary(), nullable=True))
    op.add_column("apps", sa.Column("logo_content_type", sa.String(length=32), nullable=True))
    op.add_column("apps", sa.Column("logo_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint("ck_apps_category", "apps", "category IN ('department', 'company')")
    op.create_check_constraint(
        "ck_apps_logo_type", "apps", "(logo IS NULL) = (logo_content_type IS NULL)"
    )

    conn = op.get_bind()
    for slug, name in DEPARTMENTS:
        conn.execute(
            sa.text(
                "INSERT INTO departments (id, slug, name) VALUES (:id, :slug, :name) "
                "ON CONFLICT DO NOTHING"
            ),
            {"id": _id("department", slug), "slug": slug, "name": name},
        )
    department_ids = dict(
        conn.execute(
            sa.text("SELECT slug, id FROM departments WHERE slug = ANY(:slugs)"),
            {"slugs": ALL},
        ).all()
    )

    for slug, name, category, icon, description, granted in APPS:
        inserted = conn.execute(
            sa.text(
                "INSERT INTO apps (id, slug, name, description, icon, launch_url, client_id, "
                "client_secret_hash, redirect_uris, post_logout_redirect_uris, status, "
                "is_system, category) VALUES (:id, :slug, :name, :description, :icon, '', "
                ":slug, '!', '{}', '{}', 'coming_soon', false, :category) "
                "ON CONFLICT DO NOTHING RETURNING id"
            ),
            {
                "id": _id("app", slug),
                "slug": slug,
                "name": name,
                "description": description,
                "icon": icon,
                "category": category,
            },
        ).scalar()
        if inserted is None:
            continue  # an app with this slug or client id already exists; leave it alone
        for key, label, rank in ROLES:
            conn.execute(
                sa.text(
                    "INSERT INTO app_roles (id, app_id, key, label, rank) "
                    "VALUES (:id, :app_id, :key, :label, :rank)"
                ),
                {
                    "id": _id("role", f"{slug}:{key}"),
                    "app_id": inserted,
                    "key": key,
                    "label": label,
                    "rank": rank,
                },
            )
        for department in granted:
            conn.execute(
                sa.text(
                    "INSERT INTO department_app_access (department_id, app_id, app_role_id) "
                    "VALUES (:department_id, :app_id, :role_id) ON CONFLICT DO NOTHING"
                ),
                {
                    "department_id": department_ids[department],
                    "app_id": inserted,
                    "role_id": _id("role", f"{slug}:member"),
                },
            )


def downgrade() -> None:
    op.execute("UPDATE apps SET status = 'disabled' WHERE status = 'coming_soon'")
    op.drop_constraint("ck_apps_logo_type", "apps", type_="check")
    op.drop_constraint("ck_apps_category", "apps", type_="check")
    op.drop_column("apps", "logo_updated_at")
    op.drop_column("apps", "logo_content_type")
    op.drop_column("apps", "logo")
    op.drop_column("apps", "category")
    op.drop_constraint("ck_apps_status", "apps", type_="check")
    op.create_check_constraint("ck_apps_status", "apps", "status IN ('active', 'disabled')")
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_catalog.py
```

Expected: `4 passed`.

- [ ] **Step 5: Run all checks**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: every command succeeds (`111 passed`).

- [ ] **Step 6: Confirm the models match the migrations**

```bash
cp -n .env.example .env
DATABASE_URL=postgresql+psycopg://central:central@localhost:5433/identity_test uv run alembic check
```

Expected: `No new upgrade operations detected.` (the test run above left `identity_test` at head).

- [ ] **Step 7: Commit**

```bash
git add -A identity
git commit -m "feat(identity): app catalog data model and seeded department apps"
```

---

### Task 2: Identity: coming-soon status rules and catalog fields in the API

Coming-soon apps resolve access like live ones but can't sign anyone in; `/me/apps` and the admin app API expose group, status, icon and logo version; apps can only go live with an address and callback URL (spec §3.2, §3.3).

**Files:**
- Modify: `identity/app/access.py`
- Modify: `identity/app/admin/apps.py`
- Modify: `identity/app/admin/common.py`
- Modify: `identity/app/admin/schemas.py`
- Modify: `identity/app/routes/me.py`
- Modify: `identity/tests/admin/test_admin_apps.py`
- Modify: `identity/tests/test_access_decide.py`
- Create: `identity/tests/test_app_status.py`

**Interfaces:**
- Consumes the model and migration from Task 1.
- Produces `app.admin.schemas.AppStatus`, `AppCategory`, `ICON_PATTERN`, `GO_LIVE_MESSAGE`; `AppOut` gains `category`, `logo_version`.
- Produces `app.admin.common.logo_version(app) -> int | None`.
- Produces `GET /me/apps` items `{slug, name, description, category, status, icon, logo_version, launch_url, role}` for `active` and `coming_soon` apps.

**Notes:**
- `decide()` now treats only `disabled` as unavailable, so people are ready to use an app the moment it goes live. Sign-in stays blocked because `query_client` still returns only `active` apps.
- Registration defaults to `coming_soon`, and the address and callback URLs become optional until the app goes live.

- [ ] **Step 1: Write the failing tests**

Replace the whole file `identity/tests/admin/test_admin_apps.py`:

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


COMING_SOON_BODY = {
    "slug": "stores",
    "name": "Stores",
    "category": "department",
    "icon": "warehouse",
    "roles": [{"key": "member", "label": "Member", "rank": 10}],
}


def test_register_coming_soon_app_without_addresses(api):
    created = api.post("/admin/apps", json=COMING_SOON_BODY)

    assert created.status_code == 201, created.text
    body = created.json()
    assert (body["status"], body["category"], body["icon"]) == (
        "coming_soon",
        "department",
        "warehouse",
    )
    assert (body["launch_url"], body["redirect_uris"], body["logo_version"]) == ("", [], None)


def test_live_apps_need_an_address_and_callback(api, db):
    live_without_urls = api.post("/admin/apps", json=COMING_SOON_BODY | {"status": "active"})
    assert live_without_urls.status_code == 422
    assert "before it can go live" in live_without_urls.text

    app_id = api.post("/admin/apps", json=COMING_SOON_BODY).json()["id"]
    refused = api.patch(f"/admin/apps/{app_id}", json={"status": "active"})
    launched = api.patch(
        f"/admin/apps/{app_id}",
        json={
            "status": "active",
            "launch_url": "https://stores.yourco.com",
            "redirect_uris": ["https://stores.yourco.com/api/auth/callback/identity"],
        },
    )

    assert refused.status_code == 422
    assert "before it can go live" in refused.json()["detail"]
    assert launched.status_code == 200 and launched.json()["status"] == "active"


def test_category_and_icon_are_validated(api):
    assert api.post("/admin/apps", json=COMING_SOON_BODY | {"category": "team"}).status_code == 422
    assert (
        api.post("/admin/apps", json=COMING_SOON_BODY | {"icon": "Not An Icon"}).status_code == 422
    )


def test_apps_can_change_group_and_icon(api, db):
    app, _ = make_app(db, slug="crm")
    response = api.patch(f"/admin/apps/{app.id}", json={"category": "company", "icon": "headset"})
    assert (response.json()["category"], response.json()["icon"]) == ("company", "headset")
```

Replace the whole file `identity/tests/test_access_decide.py`:

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
    (
        "coming-soon app still resolves so access is ready at launch",
        {"app_status": "coming_soon", "department_grants": [DepartmentGrant(SALES, VIEWER)]},
        VIEWER,
        "department",
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

Create `identity/tests/test_app_status.py`:

```python
from sqlalchemy import select

from app.models import App, Department
from tests.factories import add_to_department, make_user
from tests.oidc_helpers import auth_request, portal_token, sign_in

COMPANY_TOOLS = ["automation", "chat", "projects", "requisitions"]


def _department(db, slug):
    return db.scalar(select(Department).where(Department.slug == slug))


def test_my_apps_include_coming_soon_apps_with_catalog_fields(client, db, settings):
    person = make_user(db)
    add_to_department(db, person, _department(db, "dispatch"))
    token = portal_token(client, db, person, settings)

    apps = client.get("/me/apps", headers={"Authorization": f"Bearer {token}"}).json()

    assert sorted(a["slug"] for a in apps) == sorted(["dispatch", *COMPANY_TOOLS])
    dispatch = next(a for a in apps if a["slug"] == "dispatch")
    assert dispatch == {
        "slug": "dispatch",
        "name": "Dispatch",
        "description": "Dispatch plans, POD and GRN follow-up",
        "category": "department",
        "status": "coming_soon",
        "icon": "truck",
        "logo_version": None,
        "launch_url": "",
        "role": "member",
    }


def test_disabled_apps_are_hidden_from_my_apps(client, db, settings):
    person = make_user(db)
    add_to_department(db, person, _department(db, "hr"))
    db.scalar(select(App).where(App.slug == "chat")).status = "disabled"
    db.commit()
    token = portal_token(client, db, person, settings)

    slugs = {
        a["slug"]
        for a in client.get("/me/apps", headers={"Authorization": f"Bearer {token}"}).json()
    }

    assert "chat" not in slugs and "hr" in slugs


def test_coming_soon_apps_cannot_sign_anyone_in(client, db):
    person = make_user(db)
    add_to_department(db, person, _department(db, "sales"))
    sign_in(client, db, person)
    app = db.scalar(select(App).where(App.slug == "sales"))
    app.redirect_uris = ["https://sales.yourco.com/callback"]
    db.commit()

    response = client.get("/authorize", params=auth_request(app).params)

    assert response.status_code == 400
    assert "location" not in response.headers
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd identity
uv run pytest tests/test_app_status.py tests/admin/test_admin_apps.py tests/test_access_decide.py
```

Expected: FAIL — `6 failed, 23 passed`.

- [ ] **Step 3: Implement**

Replace the whole file `identity/app/access.py`:

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
    if app_status == "disabled":
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

Replace the whole file `identity/app/admin/apps.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app import audit
from app.admin.common import conflict, get_or_404, logo_version, validate_uris
from app.admin.schemas import (
    GO_LIVE_MESSAGE,
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
        category=app.category,
        logo_version=logo_version(app),
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
    if body.launch_url:
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
        category=body.category,
        client_id=body.slug,
        client_secret_hash=hash_secret(secret),
        redirect_uris=body.redirect_uris,
        post_logout_redirect_uris=body.post_logout_redirect_uris,
        status=body.status,
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
    if changes.get("launch_url"):
        validate_uris([changes["launch_url"]], settings, "launch_url")
    if "redirect_uris" in changes:
        validate_uris(changes["redirect_uris"], settings, "redirect_uris")
    if "post_logout_redirect_uris" in changes:
        validate_uris(changes["post_logout_redirect_uris"], settings, "post_logout_redirect_uris")
    for field, value in changes.items():
        setattr(app, field, value)
    if app.status == "active" and not (app.launch_url and app.redirect_uris):
        db.rollback()
        raise HTTPException(422, GO_LIVE_MESSAGE)
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

Replace the whole file `identity/app/admin/common.py`:

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


def logo_version(app) -> int | None:
    """Cache-busting version for an app's logo: last change as epoch seconds, or None."""
    return int(app.logo_updated_at.timestamp()) if app.logo_updated_at else None


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

Replace the whole file `identity/app/admin/schemas.py`:

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


AppStatus = Literal["active", "coming_soon", "disabled"]
AppCategory = Literal["department", "company"]
ICON_PATTERN = r"^[a-z0-9-]{0,40}$"
GO_LIVE_MESSAGE = (
    "An app needs its address and at least one sign-in callback URL before it can go live"
)


class AppIn(BaseModel):
    slug: str = Field(pattern=SLUG_PATTERN)
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    category: AppCategory = "department"
    icon: str = Field(default="", pattern=ICON_PATTERN)
    status: AppStatus = "coming_soon"
    launch_url: str = ""
    redirect_uris: list[str] = []
    post_logout_redirect_uris: list[str] = []
    roles: list[RoleIn] = Field(min_length=1)

    @model_validator(mode="after")
    def _unique_roles(self) -> "AppIn":
        if len({r.key for r in self.roles}) != len(self.roles):
            raise ValueError("role keys must be unique")
        if len({r.rank for r in self.roles}) != len(self.roles):
            raise ValueError("role ranks must be unique")
        if self.status == "active" and not (self.launch_url and self.redirect_uris):
            raise ValueError(GO_LIVE_MESSAGE)
        return self


class AppUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: AppCategory | None = None
    icon: str | None = Field(default=None, pattern=ICON_PATTERN)
    launch_url: str | None = None
    redirect_uris: list[str] | None = None
    post_logout_redirect_uris: list[str] | None = None
    status: AppStatus | None = None


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
    category: str
    logo_version: int | None
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

Replace the whole file `identity/app/routes/me.py`:

```python
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.access import resolve_role
from app.admin.common import logo_version
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
    category: str
    status: str
    icon: str
    logo_version: int | None
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
        select(App)
        .where(App.status.in_(("active", "coming_soon")), App.is_system.is_(False))
        .order_by(App.name)
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
                    category=app.category,
                    status=app.status,
                    icon=app.icon,
                    logo_version=logo_version(app),
                    launch_url=app.launch_url,
                    role=role.key,
                )
            )
    return result
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/test_app_status.py tests/admin/test_admin_apps.py tests/test_access_decide.py
```

Expected: `29 passed`.

- [ ] **Step 5: Run all checks**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: every command succeeds (`119 passed`).

- [ ] **Step 6: Commit**

```bash
git add -A identity
git commit -m "feat(identity): coming-soon apps and catalog fields in the API"
```

---

### Task 3: Identity: app logos

Upload, replace and remove an app's logo, with the type detected from the file's bytes, and serve it to signed-in people with safe headers (spec §3.3).

**Files:**
- Modify: `identity/app/admin/apps.py`
- Modify: `identity/app/admin/common.py`
- Create: `identity/app/logos.py`
- Modify: `identity/app/main.py`
- Create: `identity/app/routes/logos.py`
- Create: `identity/tests/admin/test_admin_logos.py`
- Create: `identity/tests/test_logos.py`

**Interfaces:**
- Produces `app.logos`: `MAX_LOGO_BYTES = 262144`, `LOGO_ERROR`, `detect_image_type(data) -> str | None`.
- Produces `PUT /admin/apps/{id}/logo` (multipart `file`) → app, `DELETE /admin/apps/{id}/logo` → 204, `GET /apps/{slug}/logo` (portal token) → image bytes.

**Notes:**
- SVG is refused because an SVG can contain script. The declared upload type is ignored; only the leading bytes count.
- Served logos carry `Content-Security-Policy: default-src 'none'` and `X-Content-Type-Options: nosniff`, so even a crafted file can't run as a page on the identity host.

- [ ] **Step 1: Write the failing tests**

Create `identity/tests/admin/test_admin_logos.py`:

```python
import struct
import zlib

from sqlalchemy import select

from app.models import App
from tests.factories import make_app, make_user
from tests.oidc_helpers import portal_token


def png(size: int = 0) -> bytes:
    """A valid 1x1 PNG, optionally padded with an ancillary chunk to reach roughly `size` bytes."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    pixels = chunk(b"IDAT", zlib.compress(b"\x00\xff\xff\xff"))
    padding = chunk(b"tEXt", b"x" * max(0, size - 70)) if size else b""
    return b"\x89PNG\r\n\x1a\n" + header + padding + pixels + chunk(b"IEND", b"")


JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 40
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
GIF = b"GIF89a" + b"\x00" * 40


def upload(api, app_id, content: bytes, name="logo.png", declared="image/png"):
    return api.put(f"/admin/apps/{app_id}/logo", files={"file": (name, content, declared)})


def test_upload_detects_type_from_bytes_and_serves_it(api, db, audited):
    app, _ = make_app(db, slug="crm")

    response = upload(api, app.id, JPEG, name="logo.png", declared="image/png")

    assert response.status_code == 200, response.text
    assert isinstance(response.json()["logo_version"], int)
    served = api.get("/apps/crm/logo")
    assert served.status_code == 200
    assert served.content == JPEG
    assert served.headers["content-type"] == "image/jpeg"
    assert served.headers["cache-control"] == "private, max-age=86400"
    assert served.headers["x-content-type-options"] == "nosniff"
    assert served.headers["content-security-policy"] == "default-src 'none'"
    assert audited("app_logo_updated")


def test_png_and_webp_are_accepted(api, db):
    app, _ = make_app(db, slug="crm")
    assert upload(api, app.id, png()).status_code == 200
    assert api.get("/apps/crm/logo").headers["content-type"] == "image/png"
    assert upload(api, app.id, WEBP, name="logo.webp", declared="image/webp").status_code == 200
    assert api.get("/apps/crm/logo").headers["content-type"] == "image/webp"


def test_other_types_and_large_files_are_rejected(api, db):
    app, _ = make_app(db, slug="crm")
    message = "Logo must be a PNG, JPEG or WebP image up to 256 KB"

    for content, name, declared in [
        (SVG, "logo.svg", "image/svg+xml"),
        (SVG, "logo.png", "image/png"),
        (GIF, "logo.gif", "image/gif"),
        (b"hello", "logo.txt", "text/plain"),
        (png(256 * 1024 + 1), "big.png", "image/png"),
    ]:
        response = upload(api, app.id, content, name=name, declared=declared)
        assert response.status_code == 422, name
        assert response.json()["detail"] == message
    assert db.get(App, app.id).logo_content_type is None


def test_remove_logo(api, db, audited):
    app, _ = make_app(db, slug="crm")
    upload(api, app.id, png())

    assert api.delete(f"/admin/apps/{app.id}/logo").status_code == 204

    assert api.get("/apps/crm/logo").status_code == 404
    assert api.get(f"/admin/apps/{app.id}").json()["logo_version"] is None
    assert audited("app_logo_removed")


def test_logo_is_visible_to_any_signed_in_person_but_not_anonymous(client, db, settings):
    app, _ = make_app(db, slug="crm")
    app.logo, app.logo_content_type = png(), "image/png"
    db.commit()
    token = portal_token(client, db, make_user(db), settings)

    assert (
        client.get("/apps/crm/logo", headers={"Authorization": f"Bearer {token}"}).status_code
        == 200
    )
    assert client.get("/apps/crm/logo").status_code == 401
    assert (
        client.get("/apps/nope/logo", headers={"Authorization": f"Bearer {token}"}).status_code
        == 404
    )


def test_logo_version_appears_in_app_detail(api, db):
    chat = db.scalar(select(App).where(App.slug == "chat"))
    upload(api, chat.id, png())
    detail = api.get(f"/admin/apps/{chat.id}").json()
    assert detail["logo_version"] is not None


def test_non_admins_cannot_upload(client, db, settings):
    app, _ = make_app(db, slug="crm")
    token = portal_token(client, db, make_user(db), settings)
    response = client.put(
        f"/admin/apps/{app.id}/logo",
        files={"file": ("logo.png", png(), "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
```

Create `identity/tests/test_logos.py`:

```python
from app.logos import detect_image_type


def test_detect_image_type():
    assert detect_image_type(b"\x89PNG\r\n\x1a\n rest") == "image/png"
    assert detect_image_type(b"\xff\xd8\xff\xdb rest") == "image/jpeg"
    assert detect_image_type(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"
    assert detect_image_type(b"RIFF\x00\x00\x00\x00WAVEfmt ") is None
    assert detect_image_type(b"<svg/>") is None
    assert detect_image_type(b"") is None
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd identity
uv run pytest tests/admin/test_admin_logos.py tests/test_logos.py
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.logos'`.

- [ ] **Step 3: Implement**

Replace the whole file `identity/app/admin/apps.py`:

```python
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app import audit
from app.admin.common import conflict, get_or_404, logo_version, validate_uris
from app.admin.schemas import (
    GO_LIVE_MESSAGE,
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
from app.logos import LOGO_ERROR, MAX_LOGO_BYTES, detect_image_type
from app.models import App, AppRole, Department, DepartmentAppAccess, User, UserAppOverride
from app.security import hash_secret, new_token, utcnow

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
        category=app.category,
        logo_version=logo_version(app),
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
    if body.launch_url:
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
        category=body.category,
        client_id=body.slug,
        client_secret_hash=hash_secret(secret),
        redirect_uris=body.redirect_uris,
        post_logout_redirect_uris=body.post_logout_redirect_uris,
        status=body.status,
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
    if changes.get("launch_url"):
        validate_uris([changes["launch_url"]], settings, "launch_url")
    if "redirect_uris" in changes:
        validate_uris(changes["redirect_uris"], settings, "redirect_uris")
    if "post_logout_redirect_uris" in changes:
        validate_uris(changes["post_logout_redirect_uris"], settings, "post_logout_redirect_uris")
    for field, value in changes.items():
        setattr(app, field, value)
    if app.status == "active" and not (app.launch_url and app.redirect_uris):
        db.rollback()
        raise HTTPException(422, GO_LIVE_MESSAGE)
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


@router.put("/apps/{app_id}/logo", response_model=AppOut)
async def upload_logo(
    app_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    data = await file.read(MAX_LOGO_BYTES + 1)
    content_type = detect_image_type(data)
    if content_type is None or len(data) > MAX_LOGO_BYTES:
        raise HTTPException(422, LOGO_ERROR)
    app = get_or_404(db, App, app_id)
    app.logo = data
    app.logo_content_type = content_type
    app.logo_updated_at = utcnow()
    audit.record(
        db,
        "app_logo_updated",
        request=request,
        actor_user_id=admin.id,
        app_id=app.id,
        detail={"content_type": content_type, "bytes": len(data)},
    )
    db.commit()
    return _out(db, app)


@router.delete("/apps/{app_id}/logo", status_code=204)
def remove_logo(
    app_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    app = get_or_404(db, App, app_id)
    app.logo = None
    app.logo_content_type = None
    app.logo_updated_at = utcnow()
    audit.record(db, "app_logo_removed", request=request, actor_user_id=admin.id, app_id=app.id)
    db.commit()


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

Replace the whole file `identity/app/admin/common.py`:

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


def logo_version(app) -> int | None:
    """Cache-busting version for an app's logo: last change as epoch seconds, or None."""
    if app.logo_content_type is None or app.logo_updated_at is None:
        return None
    return int(app.logo_updated_at.timestamp())


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

Create `identity/app/logos.py`:

```python
"""App logo validation. See catalog spec §3.3."""

MAX_LOGO_BYTES = 256 * 1024
LOGO_ERROR = "Logo must be a PNG, JPEG or WebP image up to 256 KB"


def detect_image_type(data: bytes) -> str | None:
    """Content type from the file's leading bytes; the uploader's declared type is not trusted."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
```

Replace the whole file `identity/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.admin import apps as admin_apps
from app.admin import departments as admin_departments
from app.admin import system as admin_system
from app.admin import users as admin_users
from app.bootstrap import bootstrap
from app.config import get_settings
from app.db import get_sessionmaker
from app.observability import configure_logging, request_context_middleware
from app.routes import health, login, logos, logout, me, oidc, userinfo


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
    app.include_router(oidc.router)
    app.include_router(userinfo.router)
    app.include_router(logout.router)
    app.include_router(login.router)
    app.include_router(me.router)
    app.include_router(logos.router)
    app.include_router(admin_apps.router, prefix="/admin", tags=["admin"])
    app.include_router(admin_departments.router, prefix="/admin", tags=["admin"])
    app.include_router(admin_users.router, prefix="/admin", tags=["admin"])
    app.include_router(admin_system.router, prefix="/admin", tags=["admin"])
    if settings.dev_login_enabled:
        app.include_router(login.dev_router)
    return app
```

Create `identity/app/routes/logos.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, undefer

from app.db import get_db
from app.deps import current_user
from app.models import App, User

router = APIRouter()


@router.get("/apps/{slug}/logo")
def app_logo(slug: str, db: Session = Depends(get_db), _: User = Depends(current_user)) -> Response:
    app = db.scalar(select(App).options(undefer(App.logo)).where(App.slug == slug))
    if app is None or app.logo is None:
        raise HTTPException(404, "No logo")
    return Response(
        content=app.logo,
        media_type=app.logo_content_type,
        headers={
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
        },
    )
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
uv run pytest tests/admin/test_admin_logos.py tests/test_logos.py
```

Expected: `8 passed`.

- [ ] **Step 5: Run all checks**

```bash
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

Expected: every command succeeds (`127 passed`).

- [ ] **Step 6: Commit**

```bash
git add -A identity
git commit -m "feat(identity): app logo upload and serving"
```

---

### Task 4: Portal: catalog data, icons and tones

Portal types and API client support for the catalog (multipart upload, raw responses), the curated Lucide icon set, and stable soft colour pairs per app.

**Files:**
- Modify: `portal/app/admin/apps/actions.ts`
- Modify: `portal/components/AppGrid.test.tsx`
- Modify: `portal/lib/api/client.test.ts`
- Modify: `portal/lib/api/client.ts`
- Create: `portal/lib/icons.test.tsx`
- Create: `portal/lib/icons.tsx`
- Modify: `portal/lib/identity.ts`
- Create: `portal/lib/tones.test.ts`
- Create: `portal/lib/tones.ts`
- Modify: `portal/lib/types.ts`
- Modify: `portal/package.json`

**Interfaces:**
- Produces `lib/types.ts`: `AppStatus`, `AppCategory`; `MyApp` gains `category`, `status`, `logo_version`; `AppSummary` gains `category`, `logo_version`.
- Produces API client methods `upload<T>(path, form)` (PUT multipart) and `raw(path) -> Response`.
- Produces `identity.uploadLogo(id, file)`, `identity.removeLogo(id)`, `identity.logo(slug) -> Response`.
- Produces `lib/icons.tsx`: `AppIcon({ name, size? })`, `APP_ICON_NAMES`, `DEFAULT_ICON = "app-window"`, `AppIconName`.
- Produces `lib/tones.ts`: `TONES`, `appTone(slug) -> { background, color }`.

**Notes:**
- `identity.createApp` accepts `category`, `icon` and `status` as optional fields. The current register form passes `status: "active"`, so registering behaves as before until Task 6 adds the new form.

- [ ] **Step 1: Add the icon library**

```bash
cd portal
npm install --save-exact lucide-react@1.47.0
```

Expected: `package.json` lists `"lucide-react": "1.47.0"`.

- [ ] **Step 2: Write the failing tests**

Replace the whole file `portal/components/AppGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppGrid } from "@/components/AppGrid";

describe("AppGrid", () => {
  it("links each app tile to its launch URL in a new tab", () => {
    render(
      <AppGrid
        apps={[
          {
            slug: "crm",
            name: "Sales CRM",
            description: "Leads and deals",
            icon: "",
            launch_url: "https://crm.yourco.com",
            category: "department",
            status: "active",
            logo_version: null,
            role: "manager",
          },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: /Sales CRM/ });
    expect(link).toHaveAttribute("href", "https://crm.yourco.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("SC");
    expect(link).toHaveTextContent("Your role: manager");
  });

  it("explains what to do when there are no apps", () => {
    render(<AppGrid apps={[]} />);
    expect(screen.getByRole("heading", { name: "No apps yet" })).toBeInTheDocument();
    expect(screen.getByText(/Ask an admin/)).toBeInTheDocument();
  });
});
```

Replace the whole file `portal/lib/api/client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, errorMessage } from "@/lib/api/client";

function client(response: Response) {
  const fetch = vi.fn(async () => response);
  const onUnauthorized = vi.fn(() => {
    throw new Error("redirected to sign-in");
  });
  const api = createApiClient({
    baseUrl: "http://idp",
    getAccessToken: async () => "tok",
    onUnauthorized: onUnauthorized as unknown as () => never,
    fetch,
  });
  return { api, fetch, onUnauthorized };
}

describe("createApiClient", () => {
  it("sends the bearer token, JSON body and query string", async () => {
    const { api, fetch } = client(Response.json({ ok: true }));

    await api.patch("/admin/users/1", { status: "suspended" });
    await api.get("/admin/users", { query: "sam", department: "", limit: 50 });

    const [patchUrl, patchInit] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(patchUrl)).toBe("http://idp/admin/users/1");
    expect(patchInit.method).toBe("PATCH");
    expect(patchInit.headers).toEqual({ Authorization: "Bearer tok", "Content-Type": "application/json" });
    expect(patchInit.body).toBe('{"status":"suspended"}');
    expect(String(fetch.mock.calls[1][0 as never])).toBe("http://idp/admin/users?query=sam&limit=50");
  });

  it("returns undefined for 204 responses", async () => {
    const { api } = client(new Response(null, { status: 204 }));
    await expect(api.delete("/admin/overrides/1")).resolves.toBeUndefined();
  });

  it("sends people back to sign in on 401", async () => {
    const { api, onUnauthorized } = client(Response.json({ detail: "Invalid token" }, { status: 401 }));
    await expect(api.get("/me")).rejects.toThrow("redirected to sign-in");
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("throws ApiError with the service's message", async () => {
    const { api } = client(Response.json({ detail: "Department still has members; move them first" }, { status: 409 }));
    const error = await api.delete("/admin/departments/1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "Department still has members; move them first" });
  });
});

describe("errorMessage", () => {
  it("joins FastAPI validation errors by field", () => {
    const body = {
      detail: [
        { loc: ["body", "slug"], msg: "String should match pattern" },
        { loc: ["body"], msg: "Value error, role ranks must be unique" },
      ],
    };
    expect(errorMessage(422, body)).toBe("slug: String should match pattern; role ranks must be unique");
  });

  it("falls back to a generic message", () => {
    expect(errorMessage(500, null)).toBe("The identity service returned an error (500).");
  });
});

describe("file uploads and raw responses", () => {
  it("uploads multipart form data without a JSON content type", async () => {
    const { api, fetch } = client(Response.json({ id: "a1" }));
    const form = new FormData();
    form.set("file", new Blob(["png"], { type: "image/png" }), "logo.png");

    await api.upload("/admin/apps/a1/logo", form);

    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://idp/admin/apps/a1/logo");
    expect(init.method).toBe("PUT");
    expect(init.headers).toEqual({ Authorization: "Bearer tok" });
    expect(init.body).toBe(form);
  });

  it("returns raw responses so callers can stream bytes", async () => {
    const { api } = client(new Response("bytes", { status: 404 }));
    const response = await api.raw("/apps/crm/logo");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("bytes");
  });

  it("still sends people to sign in when a raw request is unauthorised", async () => {
    const { api, onUnauthorized } = client(new Response(null, { status: 401 }));
    await expect(api.raw("/apps/crm/logo")).rejects.toThrow("redirected to sign-in");
    expect(onUnauthorized).toHaveBeenCalled();
  });
});
```

Create `portal/lib/icons.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { APP_ICON_NAMES, AppIcon, DEFAULT_ICON } from "@/lib/icons";

describe("AppIcon", () => {
  it("offers the curated icon set", () => {
    expect(APP_ICON_NAMES).toHaveLength(30);
    expect(APP_ICON_NAMES).toContain("truck");
    expect(APP_ICON_NAMES).toContain(DEFAULT_ICON);
  });

  it("draws every curated icon as an SVG", () => {
    for (const name of APP_ICON_NAMES) {
      const { container, unmount } = render(<AppIcon name={name} />);
      expect(container.querySelector("svg"), name).not.toBeNull();
      unmount();
    }
  });

  it("falls back to the default icon for unknown or empty names", () => {
    const unknown = render(<AppIcon name="not-an-icon" />).container.innerHTML;
    const empty = render(<AppIcon name="" />).container.innerHTML;
    const fallback = render(<AppIcon name={DEFAULT_ICON} />).container.innerHTML;
    expect(unknown).toBe(fallback);
    expect(empty).toBe(fallback);
  });
});
```

Create `portal/lib/tones.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { appTone, TONES } from "@/lib/tones";

describe("appTone", () => {
  it("gives each app a stable soft colour pair", () => {
    expect(appTone("dispatch")).toEqual(appTone("dispatch"));
    expect(TONES).toContainEqual(appTone("dispatch"));
  });

  it("spreads the catalog across several tones", () => {
    const slugs = ["sales", "dispatch", "accounts", "finance", "marketing", "purchase", "hr", "production", "quality"];
    expect(new Set(slugs.map((slug) => appTone(slug).background)).size).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

```bash
cd portal
npx vitest run lib/api lib/icons.test.tsx lib/tones.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/tones"`.

- [ ] **Step 4: Implement**

Replace the whole file `portal/app/admin/apps/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, runAction } from "@/lib/actions";
import { lines, parseRoles, requiredText, text } from "@/lib/forms";
import { identity } from "@/lib/identity";

export async function registerApp(_: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const created = await identity.createApp({
      slug: requiredText(form, "slug", "Short name"),
      name: requiredText(form, "name", "Name"),
      description: text(form, "description"),
      status: "active",
      launch_url: requiredText(form, "launch_url", "App address"),
      redirect_uris: lines(text(form, "redirect_uris")),
      post_logout_redirect_uris: lines(text(form, "post_logout_redirect_uris")),
      roles: parseRoles(text(form, "roles")),
    });
    revalidatePath("/admin/apps");
    return {
      status: "ok",
      message: `${created.name} registered. Give these credentials to the app's developers.`,
      secret: { clientId: created.client_id, clientSecret: created.client_secret },
    };
  });
}

export async function updateApp(id: string, isSystem: boolean, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const common = { name: requiredText(form, "name", "Name"), description: text(form, "description") };
    await identity.updateApp(
      id,
      isSystem
        ? common
        : {
            ...common,
            launch_url: requiredText(form, "launch_url", "App address"),
            redirect_uris: lines(text(form, "redirect_uris")),
            post_logout_redirect_uris: lines(text(form, "post_logout_redirect_uris")),
            status: text(form, "status") === "disabled" ? "disabled" : "active",
          },
    );
    revalidatePath(`/admin/apps/${id}`);
    revalidatePath("/admin/apps");
    return { status: "ok", message: "Changes saved." };
  });
}

export async function rotateSecret(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const secret = await identity.rotateSecret(id);
    return {
      status: "ok",
      message: "New secret created. The old one stops working now.",
      secret: { clientId: secret.client_id, clientSecret: secret.client_secret },
    };
  });
}

export async function addRole(appId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const [role] = parseRoles(`${text(form, "key")}, ${text(form, "label")}, ${text(form, "rank")}`);
    await identity.createRole(appId, role);
    revalidatePath(`/admin/apps/${appId}`);
    return { status: "ok", message: `Role ${role.label} added.` };
  });
}

export async function deleteRole(appId: string, roleId: string): Promise<ActionResult> {
  return runAction(async () => {
    await identity.deleteRole(roleId);
    revalidatePath(`/admin/apps/${appId}`);
    return { status: "ok", message: "Role deleted." };
  });
}
```

Replace the whole file `portal/lib/api/client.ts`:

```ts
/** HTTP client for the identity service. Pure: dependencies are injected so it is unit-testable. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ValidationItem = { loc?: (string | number)[]; msg?: string };

export function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return (detail as ValidationItem[])
      .map((item) => {
        const field = item.loc?.filter((part) => part !== "body").join(".");
        const msg = (item.msg ?? "is invalid").replace(/^Value error, /, "");
        return field ? `${field}: ${msg}` : msg;
      })
      .join("; ");
  }
  return `The identity service returned an error (${status}).`;
}

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string>;
  onUnauthorized: () => never;
  fetch?: typeof fetch;
};

export type Query = Record<string, string | number | undefined | null>;

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? fetch;

  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const url = new URL(path, options.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await doFetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await options.getAccessToken()}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 401) options.onUnauthorized();
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, payload));
    return payload as T;
  }

  /** PUT multipart form data; the browser-style boundary header is set by fetch. */
  async function upload<T>(path: string, form: FormData): Promise<T> {
    const response = await doFetch(new URL(path, options.baseUrl), {
      method: "PUT",
      headers: { Authorization: `Bearer ${await options.getAccessToken()}` },
      body: form,
      cache: "no-store",
    });
    if (response.status === 401) options.onUnauthorized();
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, payload));
    return payload as T;
  }

  /** GET without parsing, for passing bytes through (e.g. logos). Only 401 is handled here. */
  async function raw(path: string): Promise<Response> {
    const response = await doFetch(new URL(path, options.baseUrl), {
      headers: { Authorization: `Bearer ${await options.getAccessToken()}` },
      cache: "no-store",
    });
    if (response.status === 401) options.onUnauthorized();
    return response;
  }

  return {
    upload,
    raw,
    get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
    put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
    patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
    delete: (path: string) => request<void>("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
```

Create `portal/lib/icons.tsx`:

```tsx
import {
  AppWindow,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  ChartColumn,
  ClipboardCheck,
  Factory,
  FileText,
  Folder,
  Headset,
  Kanban,
  Landmark,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  Zap,
} from "lucide-react";

/** The icons admins can choose for an app (catalog spec §4.5). Keys are stored on the app. */
const ICONS = {
  "trending-up": TrendingUp,
  truck: Truck,
  "book-open": BookOpen,
  landmark: Landmark,
  megaphone: Megaphone,
  "shopping-cart": ShoppingCart,
  users: Users,
  factory: Factory,
  "badge-check": BadgeCheck,
  "clipboard-check": ClipboardCheck,
  kanban: Kanban,
  zap: Zap,
  "message-circle": MessageCircle,
  "app-window": AppWindow,
  briefcase: Briefcase,
  "building-2": Building2,
  calculator: Calculator,
  calendar: Calendar,
  "chart-column": ChartColumn,
  "file-text": FileText,
  folder: Folder,
  headset: Headset,
  package: Package,
  receipt: Receipt,
  settings: Settings,
  "shield-check": ShieldCheck,
  store: Store,
  wallet: Wallet,
  warehouse: Warehouse,
  wrench: Wrench,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof ICONS;

export const DEFAULT_ICON: AppIconName = "app-window";
export const APP_ICON_NAMES = Object.keys(ICONS) as AppIconName[];

export function AppIcon({ name, size = 28 }: { name: string; size?: number }) {
  const Icon = ICONS[name as AppIconName] ?? ICONS[DEFAULT_ICON];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
```

Replace the whole file `portal/lib/identity.ts`:

```ts
import "server-only";

import { redirect } from "next/navigation";

import { createApiClient } from "@/lib/api/client";
import { env } from "@/lib/env";
import type { RoleInput } from "@/lib/forms";
import { getAccessToken } from "@/lib/session";
import type {
  AppCategory,
  AppDetail,
  AppStatus,
  AppSummary,
  AuditEntry,
  ClientSecret,
  DepartmentWithAccess,
  Me,
  MyApp,
  Override,
  Role,
  UserDetail,
  UserSummary,
} from "@/lib/types";

const api = () =>
  createApiClient({
    baseUrl: env.identityApiUrl,
    getAccessToken,
    onUnauthorized: () => redirect("/signin"),
  });

export const identity = {
  me: () => api().get<Me>("/me"),
  myApps: () => api().get<MyApp[]>("/me/apps"),

  listUsers: (query: { query?: string; department?: string; status?: string; offset?: number; limit?: number }) =>
    api().get<UserSummary[]>("/admin/users", query),
  getUser: (id: string) => api().get<UserDetail>(`/admin/users/${id}`),
  updateUser: (id: string, body: { status?: "active" | "suspended"; is_admin?: boolean }) =>
    api().patch<UserDetail>(`/admin/users/${id}`, body),
  setUserDepartments: (id: string, departmentIds: string[]) =>
    api().put<UserDetail>(`/admin/users/${id}/departments`, { department_ids: departmentIds }),
  signOutUser: (id: string) => api().post<void>(`/admin/users/${id}/signout`),
  createOverride: (
    userId: string,
    body: {
      app_id: string;
      effect: "grant" | "deny";
      app_role_id: string | null;
      reason: string;
      expires_at: string | null;
    },
  ) => api().post<Override>(`/admin/users/${userId}/overrides`, body),
  deleteOverride: (id: string) => api().delete(`/admin/overrides/${id}`),

  listDepartments: () => api().get<DepartmentWithAccess[]>("/admin/departments"),
  createDepartment: (body: { slug: string; name: string }) =>
    api().post<DepartmentWithAccess>("/admin/departments", body),
  renameDepartment: (id: string, name: string) =>
    api().patch<DepartmentWithAccess>(`/admin/departments/${id}`, { name }),
  deleteDepartment: (id: string) => api().delete(`/admin/departments/${id}`),
  setDepartmentAccess: (id: string, grants: { app_id: string; app_role_id: string }[]) =>
    api().put<DepartmentWithAccess>(`/admin/departments/${id}/access`, grants),

  listApps: () => api().get<AppSummary[]>("/admin/apps"),
  getApp: (id: string) => api().get<AppDetail>(`/admin/apps/${id}`),
  createApp: (body: {
    slug: string;
    name: string;
    description: string;
    category?: AppCategory;
    icon?: string;
    status?: AppStatus;
    launch_url: string;
    redirect_uris: string[];
    post_logout_redirect_uris: string[];
    roles: RoleInput[];
  }) => api().post<AppSummary & ClientSecret>("/admin/apps", body),
  updateApp: (
    id: string,
    body: Partial<
      Pick<
        AppSummary,
        | "name"
        | "description"
        | "category"
        | "icon"
        | "launch_url"
        | "redirect_uris"
        | "post_logout_redirect_uris"
        | "status"
      >
    >,
  ) => api().patch<AppSummary>(`/admin/apps/${id}`, body),
  rotateSecret: (id: string) => api().post<ClientSecret>(`/admin/apps/${id}/rotate-secret`),
  uploadLogo: (id: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return api().upload<AppSummary>(`/admin/apps/${id}/logo`, form);
  },
  removeLogo: (id: string) => api().delete(`/admin/apps/${id}/logo`),
  logo: (slug: string) => api().raw(`/apps/${encodeURIComponent(slug)}/logo`),
  createRole: (appId: string, body: RoleInput) => api().post<Role>(`/admin/apps/${appId}/roles`, body),
  deleteRole: (id: string) => api().delete(`/admin/app-roles/${id}`),

  listAudit: (query: { event?: string; from?: string; to?: string; before_id?: string; limit?: number }) =>
    api().get<AuditEntry[]>("/admin/audit", query),
};
```

Create `portal/lib/tones.ts`:

```ts
/** Soft background/foreground pairs for app icons (catalog spec §4.1). */
export const TONES = [
  { background: "#E3F1EE", color: "#1D6B5F" }, // teal
  { background: "#E6EDFB", color: "#3056A8" }, // blue
  { background: "#FBF0DF", color: "#9A6216" }, // amber
  { background: "#F2E8F4", color: "#82408A" }, // plum
  { background: "#E5F2E6", color: "#2F7039" }, // green
  { background: "#FBE9EC", color: "#A63D52" }, // rose
  { background: "#ECEFF3", color: "#47525F" }, // slate
  { background: "#ECEAFB", color: "#4F46A5" }, // indigo
] as const;

export type Tone = (typeof TONES)[number];

/** A stable tone per app, so an app keeps its colour everywhere. */
export function appTone(slug: string): Tone {
  let hash = 2166136261;
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return TONES[hash % TONES.length];
}
```

Replace the whole file `portal/lib/types.ts`:

```ts
/** Shapes returned by the identity service (identity/app/admin/schemas.py, identity/app/routes/me.py). */

export type Department = { id: string; slug: string; name: string };

export type Me = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
  departments: Department[];
};

export type AppStatus = "active" | "coming_soon" | "disabled";
export type AppCategory = "department" | "company";

export type MyApp = {
  slug: string;
  name: string;
  description: string;
  category: AppCategory;
  status: Exclude<AppStatus, "disabled">;
  icon: string;
  logo_version: number | null;
  launch_url: string;
  role: string;
};

export type Role = { id: string; key: string; label: string; rank: number };

export type AppSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  launch_url: string;
  client_id: string;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  status: AppStatus;
  is_system: boolean;
  category: AppCategory;
  logo_version: number | null;
  roles: Role[];
};

export type AppDetail = AppSummary & {
  departments: {
    department_id: string;
    department_slug: string;
    department_name: string;
    app_role_id: string;
    role_key: string;
  }[];
};

export type ClientSecret = { client_id: string; client_secret: string };

export type AccessReason =
  "suspended" | "app_disabled" | "system_app" | "override_deny" | "override_grant" | "department" | "no_access";

export type EffectiveAccess = {
  app_id: string;
  app_slug: string;
  app_name: string;
  role: string | null;
  reason: AccessReason;
  department_slug: string | null;
  override_id: string | null;
};

export type Override = {
  id: string;
  app_id: string;
  effect: "grant" | "deny";
  app_role_id: string | null;
  reason: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  active: boolean;
};

export type UserSummary = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: "active" | "suspended";
  is_admin: boolean;
  last_login_at: string | null;
  department_slugs: string[];
};

export type UserDetail = UserSummary & {
  departments: Department[];
  overrides: Override[];
  access: EffectiveAccess[];
};

export type DepartmentWithAccess = Department & {
  member_count: number;
  access: { app_id: string; app_slug: string; app_role_id: string; role_key: string }[];
};

export type AuditEntry = {
  id: number;
  at: string;
  event: string;
  actor_user_id: string | null;
  subject_user_id: string | null;
  app_id: string | null;
  detail: Record<string, unknown>;
  request_id: string | null;
  ip: string | null;
};
```

- [ ] **Step 5: Run the task's tests and confirm they pass**

```bash
npx vitest run lib/api lib/icons.test.tsx lib/tones.test.ts
```

Expected: `14 passed`.

- [ ] **Step 6: Run all checks**

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Expected: every command succeeds (`38 passed`).

- [ ] **Step 7: Commit**

```bash
git add -A portal
git commit -m "feat(portal): catalog types, logo client, icons and tones"
```

---

### Task 5: Portal: new look, top bar and launcher

Replace the dashboard with the soft launcher (greeting, search, grouped icon tiles, coming-soon tiles, logos), move sign-out into an account menu, and apply the new visual language everywhere (spec §4.1–4.3).

**Files:**
- Modify: `portal/app/globals.css`
- Modify: `portal/app/layout.tsx`
- Create: `portal/app/logos/[slug]/route.ts`
- Modify: `portal/app/page.tsx`
- Create: `portal/components/AccountMenu.test.tsx`
- Create: `portal/components/AccountMenu.tsx`
- Delete: `portal/components/AppGrid.test.tsx`
- Delete: `portal/components/AppGrid.tsx`
- Create: `portal/components/AppTile.tsx`
- Create: `portal/components/Launcher.test.tsx`
- Create: `portal/components/Launcher.tsx`
- Modify: `portal/components/TopBar.tsx`
- Modify: `portal/e2e/dashboard.spec.ts`
- Create: `portal/lib/launcher.test.ts`
- Create: `portal/lib/launcher.ts`
- Delete: `portal/lib/monogram.test.ts`
- Delete: `portal/lib/monogram.ts`
- Modify: `portal/vitest.setup.ts`

**Interfaces:**
- Consumes `AppIcon`, `appTone`, `MyApp`, `identity.logo` (Task 4).
- Produces `lib/launcher.ts`: `groupApps(apps, query) -> AppGroup[]`, `firstLiveMatch(groups)`, `greetingFor(hour | null)`.
- Produces components `Launcher({ apps, firstName })`, `AppTile({ app })`, `AccountMenu({ name, email, children })`; `TopBar` now renders Admin plus the account menu.
- Produces route `GET /logos/{slug}` passing the identity logo through with the signed-in person's token.
- Produces the full stylesheet, including admin classes used in Task 6 (`.app-cell`, `.radio-row`, `.icon-picker`, `.icon-options`, `.icon-option`, `.logo-field`, `.status-coming_soon`).

**Notes:**
- `vitest.setup.ts` now calls Testing Library's `cleanup` after each test. Without Vitest globals it isn't registered automatically, and tests that render more than once would see each other's output.
- The greeting uses `useSyncExternalStore` with a `null` server snapshot, so the server renders "Welcome" and the browser switches to the local time of day without a hydration mismatch.
- Coming-soon tiles are `div`s with `aria-disabled="true"`, not links, so they can't be opened or tabbed to as links.
- `AppGrid` and `lib/monogram` are deleted; `AppTile` and the tones replace them.

- [ ] **Step 1: Run the identity service with Tasks 1–3**

```bash
docker compose up -d --build
curl -s localhost:8000/readyz
```

Expected: `{"status":"ok"}`. Starting the container runs migration `0002`, so the development database now has the catalog.

- [ ] **Step 2: Write the failing tests**

Create `portal/components/AccountMenu.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountMenu } from "@/components/AccountMenu";

function renderMenu() {
  return render(
    <AccountMenu name="Ada Admin" email="admin@yourco.com">
      <button type="button">Sign out</button>
    </AccountMenu>,
  );
}

describe("AccountMenu", () => {
  it("shows initials and opens to reveal the account and sign-out", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Account menu for Ada Admin" });
    expect(trigger).toHaveTextContent("AA");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("admin@yourco.com")).toBeNull();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("admin@yourco.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("closes on Escape and on clicks outside", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Account menu for Ada Admin" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
```

Create `portal/components/Launcher.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Launcher } from "@/components/Launcher";
import type { MyApp } from "@/lib/types";

const base = { description: "", icon: "", logo_version: null, role: "member" } as const;
const APPS: MyApp[] = [
  {
    ...base,
    slug: "example",
    name: "Example App",
    category: "department",
    status: "active",
    launch_url: "http://localhost:3001",
    description: "Reference integration",
  },
  {
    ...base,
    slug: "sales",
    name: "Sales",
    category: "department",
    status: "coming_soon",
    launch_url: "",
    description: "Orders and invoices",
  },
  {
    ...base,
    slug: "chat",
    name: "Chat",
    category: "company",
    status: "coming_soon",
    launch_url: "",
    logo_version: 1789000000,
  },
];

afterEach(() => vi.restoreAllMocks());

describe("Launcher", () => {
  it("shows live apps as links and coming-soon apps as disabled tiles", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);

    const live = screen.getByRole("link", { name: /Example App/ });
    expect(live).toHaveAttribute("href", "http://localhost:3001");
    expect(live).toHaveAttribute("target", "_blank");
    expect(live).toHaveAttribute("title", "Reference integration");

    const soon = screen.getByText("Sales").closest("[aria-disabled]");
    expect(soon).toHaveAttribute("aria-disabled", "true");
    expect(soon).toHaveAttribute("title", "Orders and invoices. Coming soon.");
    expect(within(soon as HTMLElement).getByText("Soon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sales/ })).toBeNull();
  });

  it("uses the uploaded logo when there is one", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    const tile = screen.getByText("Chat").closest("[aria-disabled]") as HTMLElement;
    expect(tile.querySelector("img")).toHaveAttribute("src", "/logos/chat?v=1789000000");
  });

  it("falls back to the icon if the logo can't load", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    const tile = screen.getByText("Chat").closest("[aria-disabled]") as HTMLElement;
    fireEvent.error(tile.querySelector("img") as HTMLImageElement);
    expect(tile.querySelector("img")).toBeNull();
    expect(tile.querySelector("svg")).not.toBeNull();
  });

  it("groups apps and filters them as you type", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    expect(screen.getByRole("heading", { name: "Departments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Company tools" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Find an app" }), { target: { value: "invoices" } });

    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.queryByText("Chat")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Company tools" })).toBeNull();
  });

  it("says when nothing matches", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find an app" }), { target: { value: "payroll" } });
    expect(screen.getByText('No apps match "payroll".')).toBeInTheDocument();
  });

  it("opens the first live match when you press Enter", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<Launcher apps={APPS} firstName="Sam" />);
    const search = screen.getByRole("searchbox", { name: "Find an app" });

    fireEvent.change(search, { target: { value: "a" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(open).toHaveBeenCalledWith("http://localhost:3001", "_blank", "noopener,noreferrer");
  });

  it("focuses search when you press /", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("searchbox", { name: "Find an app" })).toHaveFocus();
  });

  it("explains what to do when there are no apps", () => {
    render(<Launcher apps={[]} firstName="Nia" />);
    expect(
      screen.getByText("You don't have any apps yet. Ask an admin to add you to your department."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
```

Replace the whole file `portal/e2e/dashboard.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { signInAs, USERS } from "./helpers";

test("signed-out visitors are sent to the identity service", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
});

test("people see their department's apps and the company tools", async ({ page }) => {
  await signInAs(page, USERS.sales);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sam");
  const departments = page.getByRole("region", { name: "Departments" });
  const tools = page.getByRole("region", { name: "Company tools" });

  const example = departments.getByRole("link", { name: "Example App" });
  await expect(example).toHaveAttribute("href", "http://localhost:3001");
  await expect(departments.locator('[aria-disabled="true"]', { hasText: "Sales" })).toContainText("Soon");
  await expect(departments.getByText("Dispatch")).toHaveCount(0);
  for (const name of ["Automation", "Chat", "Projects", "Requisitions & Budget"]) {
    await expect(tools.locator('[aria-disabled="true"]', { hasText: name })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("search narrows the launcher", async ({ page }) => {
  await signInAs(page, USERS.sales);
  const search = page.getByRole("searchbox", { name: "Find an app" });

  await search.fill("messages");
  await expect(page.getByText("Chat")).toBeVisible();
  await expect(page.getByText("Projects")).toHaveCount(0);

  await search.fill("payroll");
  await expect(page.getByText('No apps match "payroll".')).toBeVisible();
});

test("people without a department see what to do next", async ({ page }) => {
  await signInAs(page, USERS.newcomer);
  await expect(page.getByText("You don't have any apps yet.")).toBeVisible();
});

test("signing out ends the identity session too", async ({ page }) => {
  await signInAs(page, USERS.sales);
  await page.getByRole("button", { name: `Account menu for ${USERS.sales}` }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
});
```

Create `portal/lib/launcher.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { firstLiveMatch, greetingFor, groupApps } from "@/lib/launcher";
import type { MyApp } from "@/lib/types";

function app(slug: string, patch: Partial<MyApp> = {}): MyApp {
  return {
    slug,
    name: slug[0].toUpperCase() + slug.slice(1),
    description: `${slug} description`,
    category: "department",
    status: "active",
    icon: "",
    logo_version: null,
    launch_url: `https://${slug}.yourco.com`,
    role: "member",
    ...patch,
  };
}

const APPS = [
  app("sales", { status: "coming_soon", launch_url: "" }),
  app("chat", { category: "company", description: "Channels and messages" }),
  app("accounts"),
  app("projects", { category: "company", status: "coming_soon", launch_url: "" }),
];

describe("groupApps", () => {
  it("puts departments first, company tools second, sorted by name", () => {
    expect(groupApps(APPS, "").map((g) => [g.label, g.apps.map((a) => a.slug)])).toEqual([
      ["Departments", ["accounts", "sales"]],
      ["Company tools", ["chat", "projects"]],
    ]);
  });

  it("filters by name or description, ignoring case, and drops empty groups", () => {
    expect(groupApps(APPS, "MESSAGES").map((g) => [g.label, g.apps.map((a) => a.slug)])).toEqual([
      ["Company tools", ["chat"]],
    ]);
    expect(groupApps(APPS, "  sal ").flatMap((g) => g.apps.map((a) => a.slug))).toEqual(["sales"]);
    expect(groupApps(APPS, "nothing like this")).toEqual([]);
  });
});

describe("firstLiveMatch", () => {
  it("skips coming-soon apps", () => {
    expect(firstLiveMatch(groupApps(APPS, "s"))?.slug).toBe("accounts");
    expect(firstLiveMatch(groupApps(APPS, "sales"))).toBeUndefined();
  });
});

describe("greetingFor", () => {
  it.each([
    [0, "Good evening"],
    [5, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good evening"],
    [null, "Welcome"],
  ])("hour %s → %s", (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});
```

Replace the whole file `portal/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so Testing Library can't register its automatic cleanup.
afterEach(cleanup);
```

- [ ] **Step 3: Run the tests and confirm they fail**

```bash
cd portal
npx vitest run lib/launcher.test.ts components/Launcher.test.tsx components/AccountMenu.test.tsx
CI=1 npx playwright test e2e/dashboard.spec.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/launcher"`; Playwright can't start the portal because the build fails on the missing modules.

- [ ] **Step 4: Implement**

Remove the files this task replaces:

```bash
git rm portal/components/AppGrid.test.tsx portal/components/AppGrid.tsx portal/lib/monogram.test.ts portal/lib/monogram.ts
```

Replace the whole file `portal/app/globals.css`:

```css
/* Visual language: catalog spec §4.1. Colour lives in app icons; everything else stays quiet. */
:root {
  --canvas: #ffffff;
  --subtle: #f7f8fa;
  --ink: #18202b;
  --muted: #6b7684;
  --line: #e6e9ed;
  --accent: #1d6b5f;
  --accent-soft: #e3f1ee;
  --danger: #b42318;
  --ok: #1f7a4d;
  --radius-control: 10px;
  --radius-icon: 16px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--canvas);
  color: var(--ink);
  font-family: var(--font-sans), system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--accent);
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1,
h2,
h3 {
  font-weight: 600;
  line-height: 1.25;
}

code {
  font-size: 0.9em;
  overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}

/* ---------- top bar ---------- */
.topbar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  height: 56px;
  padding: 0 clamp(1rem, 4vw, 2rem);
  border-bottom: 1px solid var(--line);
  background: var(--canvas);
}

.wordmark {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
  color: var(--ink);
  text-decoration: none;
}

.topbar-nav {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.topbar-nav > a {
  color: var(--muted);
  font-weight: 500;
  text-decoration: none;
}

.topbar-nav > a:hover {
  color: var(--ink);
}

.account {
  position: relative;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: var(--accent-soft);
  color: var(--accent);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.account-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 10;
  min-width: 220px;
  padding: 0.9rem;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: 12px;
  display: grid;
  gap: 0.15rem;
}

.account-name {
  font-weight: 600;
}

.account-email {
  color: var(--muted);
  margin-bottom: 0.6rem;
}

.account-panel .button {
  width: 100%;
}

/* ---------- buttons & forms ---------- */
.button {
  font: inherit;
  font-weight: 500;
  border-radius: var(--radius-control);
  padding: 0.5rem 0.9rem;
  border: 1px solid transparent;
  cursor: pointer;
}

.button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.button-primary {
  background: var(--accent);
  color: #fff;
}

.button-quiet {
  background: var(--canvas);
  color: var(--ink);
  border-color: var(--line);
}

.button-quiet:hover {
  background: var(--subtle);
}

.button-danger {
  background: var(--canvas);
  color: var(--danger);
  border-color: var(--line);
}

label {
  display: grid;
  gap: 0.3rem;
  font-weight: 500;
}

input,
select,
textarea {
  font: inherit;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--canvas);
  color: var(--ink);
  min-width: 0;
}

input:disabled,
textarea:disabled {
  background: var(--subtle);
  color: var(--muted);
}

textarea {
  min-height: 4.5rem;
}

.hint {
  color: var(--muted);
  font-weight: 400;
  font-size: 13px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem 1.25rem;
  align-items: start;
  max-width: 56rem;
}

.form-grid .wide {
  grid-column: 1 / -1;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}

.form-error {
  color: var(--danger);
  margin-top: 0.5rem;
}

.form-ok {
  color: var(--ok);
  margin-top: 0.5rem;
}

.secret {
  margin: 0.75rem 0 0;
  padding: 0.9rem 1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--subtle);
  color: var(--ink);
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1rem;
  max-width: 44rem;
}

.secret dt {
  font-weight: 600;
}

.secret dd {
  margin: 0;
}

.secret .hint {
  grid-column: 1 / -1;
}

/* ---------- launcher ---------- */
.launcher {
  max-width: 760px;
  margin: 0 auto;
  padding: clamp(2.5rem, 8vh, 4.5rem) 1.25rem 4rem;
  font-size: 15px;
}

.launcher h1 {
  text-align: center;
  font-size: 28px;
  letter-spacing: -0.02em;
}

.launcher-search {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 480px;
  margin: 1.25rem auto 2.25rem;
  padding: 0 0.9rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--subtle);
  color: var(--muted);
}

.launcher-search:focus-within {
  border-color: var(--accent);
  background: var(--canvas);
}

.launcher-search input {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 0.75rem 0;
  outline: none;
}

.launcher-empty {
  text-align: center;
  color: var(--muted);
  margin-top: 2rem;
}

.launcher-group {
  margin-top: 1.75rem;
}

.launcher-group h2 {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 1rem;
}

.launcher-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1.5rem 0.5rem;
}

.tile {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
  border-radius: 14px;
  color: var(--ink);
  text-decoration: none;
  text-align: center;
}

a.tile:hover .tile-mark {
  transform: translateY(-2px);
}

.tile-mark {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-icon);
  overflow: hidden;
  transition: transform 120ms ease;
}

.tile-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--canvas);
}

.tile-name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
}

.tile-soon {
  cursor: default;
}

.tile-soon .tile-mark {
  opacity: 0.7;
  filter: saturate(0.6);
}

.tile-soon .tile-name {
  color: var(--muted);
}

.soon {
  font-size: 11px;
  color: var(--muted);
  background: var(--subtle);
  border-radius: 999px;
  padding: 0 0.5rem;
  margin-top: -0.25rem;
}

@media (max-width: 900px) {
  .launcher-group ul {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .launcher-group ul {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* ---------- admin ---------- */
.admin {
  display: grid;
  grid-template-columns: 14rem 1fr;
  min-height: calc(100vh - 56px);
}

.admin-nav {
  background: var(--subtle);
  border-right: 1px solid var(--line);
  padding: 1.25rem 0.75rem;
  display: grid;
  align-content: start;
  gap: 0.15rem;
}

.admin-nav a {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  color: var(--ink);
  text-decoration: none;
  font-weight: 500;
}

.admin-nav a:hover {
  background: var(--canvas);
}

.admin-nav a[aria-current="page"] {
  background: var(--canvas);
  color: var(--accent);
  box-shadow: inset 2px 0 0 var(--accent);
}

.admin-main {
  padding: 2rem clamp(1rem, 3vw, 2.5rem) 4rem;
  min-width: 0;
  max-width: 72rem;
}

.admin-main h1 {
  font-size: 22px;
  letter-spacing: -0.01em;
  margin-bottom: 0.25rem;
}

.admin-main section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--line);
}

.admin-main h2 {
  font-size: 15px;
  margin-bottom: 0.9rem;
}

.table-wrap {
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: tabular-nums;
}

th,
td {
  text-align: left;
  padding: 0 0.75rem;
  height: 44px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}

th {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.status {
  font-size: 13px;
  font-weight: 500;
}

.status-suspended,
.status-disabled {
  color: var(--danger);
}

.status-coming_soon {
  color: var(--muted);
}

.app-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.app-cell .tile-mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
}

.department {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--line);
}

.department-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  align-items: baseline;
  margin-bottom: 0.75rem;
}

.pager {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.checkbox-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  border: 0;
  padding: 0;
  margin: 0 0 0.75rem;
}

.checkbox-list label,
.radio-row label {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  font-weight: 400;
}

.radio-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  border: 0;
  padding: 0;
  margin: 0;
}

.radio-row legend,
.icon-picker legend {
  font-weight: 500;
  padding: 0;
  margin-bottom: 0.4rem;
}

.icon-picker {
  border: 0;
  padding: 0;
  margin: 0;
}

.icon-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
  gap: 0.4rem;
}

.icon-option {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  padding: 0.6rem 0.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  font-size: 11px;
  font-weight: 400;
  color: var(--muted);
  cursor: pointer;
}

.icon-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.icon-option:has(input:checked) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.icon-option:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.logo-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.logo-field .tile-mark {
  width: 64px;
  height: 64px;
}

@media (max-width: 720px) {
  .admin {
    grid-template-columns: 1fr;
  }

  .admin-nav {
    border-right: 0;
    border-bottom: 1px solid var(--line);
    display: flex;
    flex-wrap: wrap;
  }
}
```

Replace the whole file `portal/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Every page depends on the signed-in person, so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Central",
  description: "Your company apps in one place",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
```

Create `portal/app/logos/[slug]/route.ts`:

```ts
import { identity } from "@/lib/identity";

/** Passes an app's logo through from the identity service using the signed-in person's token. */
export async function GET(_request: Request, { params }: RouteContext<"/logos/[slug]">) {
  const { slug } = await params;
  const upstream = await identity.logo(slug);
  if (!upstream.ok) return new Response(null, { status: 404 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
```

Replace the whole file `portal/app/page.tsx`:

```tsx
import { Launcher } from "@/components/Launcher";
import { TopBar } from "@/components/TopBar";
import { identity } from "@/lib/identity";

export default async function Home() {
  const [me, apps] = await Promise.all([identity.me(), identity.myApps()]);
  return (
    <>
      <TopBar me={me} />
      <Launcher apps={apps} firstName={me.name.split(" ")[0]} />
    </>
  );
}
```

Create `portal/components/AccountMenu.tsx`:

```tsx
"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function AccountMenu({ name, email, children }: { name: string; email: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onMouseDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <div className="account" ref={root}>
      <button
        type="button"
        className="avatar"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        {initials(name)}
      </button>
      {open && (
        <div className="account-panel">
          <p className="account-name">{name}</p>
          <p className="account-email">{email}</p>
          {children}
        </div>
      )}
    </div>
  );
}
```

Create `portal/components/AppTile.tsx`:

```tsx
"use client";

import { useState } from "react";

import { AppIcon } from "@/lib/icons";
import { appTone } from "@/lib/tones";
import type { MyApp } from "@/lib/types";

export function AppTile({ app }: { app: MyApp }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const tone = appTone(app.slug);
  const mark = (
    <span className="tile-mark" style={{ backgroundColor: tone.background, color: tone.color }}>
      {app.logo_version !== null && !logoFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from an authenticated route handler
        <img src={`/logos/${app.slug}?v=${app.logo_version}`} alt="" onError={() => setLogoFailed(true)} />
      ) : (
        <AppIcon name={app.icon} />
      )}
    </span>
  );

  if (app.status === "active") {
    return (
      <a className="tile" href={app.launch_url} target="_blank" rel="noopener noreferrer" title={app.description}>
        {mark}
        <span className="tile-name">{app.name}</span>
      </a>
    );
  }
  return (
    <div className="tile tile-soon" aria-disabled="true" title={`${app.description}. Coming soon.`}>
      {mark}
      <span className="tile-name">{app.name}</span>
      <span className="soon">Soon</span>
    </div>
  );
}
```

Create `portal/components/Launcher.tsx`:

```tsx
"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AppTile } from "@/components/AppTile";
import { firstLiveMatch, greetingFor, groupApps } from "@/lib/launcher";
import type { MyApp } from "@/lib/types";

const subscribeToNothing = () => () => {};

export function Launcher({ apps, firstName }: { apps: MyApp[]; firstName: string }) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  // The hour is only known in the browser; the server renders a neutral greeting.
  const hour = useSyncExternalStore(
    subscribeToNothing,
    () => new Date().getHours(),
    () => null,
  );
  const groups = groupApps(apps, query);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        search.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="launcher">
      <h1>
        {greetingFor(hour)}, {firstName}
      </h1>

      {apps.length === 0 ? (
        <p className="launcher-empty">You don&apos;t have any apps yet. Ask an admin to add you to your department.</p>
      ) : (
        <>
          <label className="launcher-search">
            <Search size={18} aria-hidden="true" />
            <input
              ref={search}
              type="search"
              aria-label="Find an app"
              placeholder="Find an app"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const match = firstLiveMatch(groups);
                if (match) window.open(match.launch_url, "_blank", "noopener,noreferrer");
              }}
            />
          </label>

          {groups.length === 0 && <p className="launcher-empty">No apps match &quot;{query.trim()}&quot;.</p>}

          {groups.map((group) => (
            <section key={group.category} className="launcher-group" aria-labelledby={`group-${group.category}`}>
              <h2 id={`group-${group.category}`}>{group.label}</h2>
              <ul>
                {group.apps.map((app) => (
                  <li key={app.slug}>
                    <AppTile app={app} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
```

Replace the whole file `portal/components/TopBar.tsx`:

```tsx
import Link from "next/link";

import { signOutEverywhere } from "@/app/actions";
import { AccountMenu } from "@/components/AccountMenu";
import type { Me } from "@/lib/types";

export function TopBar({ me }: { me: Me }) {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        Central
      </Link>
      <nav aria-label="Main" className="topbar-nav">
        {me.is_admin && <Link href="/admin/users">Admin</Link>}
        <AccountMenu name={me.name} email={me.email}>
          <form action={signOutEverywhere}>
            <button type="submit" className="button button-quiet">
              Sign out
            </button>
          </form>
        </AccountMenu>
      </nav>
    </header>
  );
}
```

Create `portal/lib/launcher.ts`:

```ts
import type { AppCategory, MyApp } from "@/lib/types";

export type AppGroup = { category: AppCategory; label: string; apps: MyApp[] };

const GROUPS: { category: AppCategory; label: string }[] = [
  { category: "department", label: "Departments" },
  { category: "company", label: "Company tools" },
];

/** Apps matching the search (name or description, case-insensitive), grouped and sorted by name. */
export function groupApps(apps: MyApp[], query: string): AppGroup[] {
  const needle = query.trim().toLowerCase();
  const matches = apps.filter(
    (app) => !needle || app.name.toLowerCase().includes(needle) || app.description.toLowerCase().includes(needle),
  );
  return GROUPS.map((group) => ({
    ...group,
    apps: matches.filter((app) => app.category === group.category).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.apps.length > 0);
}

export function firstLiveMatch(groups: AppGroup[]): MyApp | undefined {
  return groups.flatMap((group) => group.apps).find((app) => app.status === "active");
}

/** Time-of-day greeting; `null` (not yet known on the server) gives a neutral greeting. */
export function greetingFor(hour: number | null): string {
  if (hour === null) return "Welcome";
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}
```

- [ ] **Step 5: Run the task's tests and confirm they pass**

```bash
npx vitest run lib/launcher.test.ts components/Launcher.test.tsx components/AccountMenu.test.tsx
CI=1 npx playwright test e2e/dashboard.spec.ts
```

Expected: `19 passed`; Playwright `5 passed`.

- [ ] **Step 6: Run all checks**

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Expected: every command succeeds (`53 passed`).

- [ ] **Step 7: Commit**

```bash
git add -A portal
git commit -m "feat(portal): soft launcher, account menu and new visual language"
```

---

### Task 6: Portal: admin catalog controls

Admins see each app's icon, group and status, register coming-soon apps, pick icons, take apps live, and upload or remove logos (spec §4.3–4.5).

**Files:**
- Modify: `portal/app/admin/apps/[id]/page.tsx`
- Modify: `portal/app/admin/apps/actions.ts`
- Modify: `portal/app/admin/apps/page.tsx`
- Create: `portal/components/AppMark.tsx`
- Modify: `portal/components/AppTile.tsx`
- Create: `portal/components/IconPicker.test.tsx`
- Create: `portal/components/IconPicker.tsx`
- Modify: `portal/e2e/apps.spec.ts`
- Create: `portal/lib/apps.ts`
- Modify: `portal/lib/forms.test.ts`
- Modify: `portal/lib/forms.ts`

**Interfaces:**
- Consumes everything from Tasks 4–5.
- Produces `lib/forms.ts` `parseStatus(value)`, `parseCategory(value)`; `lib/apps.ts` `STATUS_LABELS`, `CATEGORY_LABELS`.
- Produces components `AppMark({ slug, icon, logoVersion })`, `IconPicker({ defaultValue })` (radio group named `icon`).
- Produces server actions `uploadLogo(id)`, `removeLogo(id)`; `registerApp` and `updateApp` send `category`, `icon`, `status`.

**Notes:**
- `AppMark` is extracted from `AppTile` so the launcher, the apps table and the logo preview draw an app identically, including the fallback when a logo fails to load.
- After "Remove logo" the page re-renders without the remove form, so the visible confirmation is the preview returning to the icon and the button reading "Upload logo" again.

- [ ] **Step 1: Write the failing tests**

Create `portal/components/IconPicker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IconPicker } from "@/components/IconPicker";
import { APP_ICON_NAMES } from "@/lib/icons";

describe("IconPicker", () => {
  it("offers every curated icon as a named radio with the current one selected", () => {
    render(<IconPicker defaultValue="truck" />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(APP_ICON_NAMES.length);
    expect(screen.getByRole("radio", { name: "truck" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "truck" })).toHaveAttribute("name", "icon");
    expect(screen.getByRole("group", { name: "Icon" })).toBeInTheDocument();
  });

  it("selects the default icon when the app has none", () => {
    render(<IconPicker defaultValue="" />);
    expect(screen.getByRole("radio", { name: "app-window" })).toBeChecked();
  });
});
```

Replace the whole file `portal/e2e/apps.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { signInAs, unique, USERS } from "./helpers";

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await signInAs(page, USERS.admin);
});

test("the apps list shows each app's group and status", async ({ page }) => {
  await page.goto("/admin/apps");
  const chat = page.getByRole("row", { name: /Chat/ });
  await expect(chat).toContainText("Company tools");
  await expect(chat).toContainText("Coming soon");
  await expect(page.getByRole("row", { name: /Example App/ })).toContainText("Live");
});

test("admins register a coming-soon app, then take it live", async ({ page }) => {
  const slug = unique("e2e-app");
  await page.goto("/admin/apps");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${slug}`);
  await page.getByLabel("Short name").fill(slug);
  await page.getByRole("radio", { name: "Company tools" }).check();
  await page.getByRole("radio", { name: "warehouse" }).check({ force: true });
  await page.getByRole("button", { name: "Register app" }).click();

  await expect(page.getByRole("status")).toContainText(`E2E ${slug} registered.`);
  await expect(page.getByRole("status")).toContainText("Copy the secret now.");

  await page.reload();
  await page.getByRole("link", { name: `E2E ${slug}` }).click();
  await expect(page.getByRole("heading", { name: `E2E ${slug}` })).toBeVisible();
  await expect(page.getByRole("radio", { name: "warehouse" })).toBeChecked();

  const settings = page.getByRole("region", { name: "Settings" });
  await settings.getByLabel("Status").selectOption({ label: "Live" });
  await settings.getByRole("button", { name: "Save changes" }).click();
  await expect(settings.locator(".form-error")).toContainText("before it can go live");

  await settings.getByLabel("App address").fill(`https://${slug}.yourco.com`);
  await settings
    .getByLabel("Sign-in callback URLs, one per line")
    .fill(`https://${slug}.yourco.com/api/auth/callback/identity`);
  await settings.getByRole("button", { name: "Save changes" }).click();
  await expect(settings.getByRole("status")).toContainText("Changes saved.");

  await page.getByLabel("Key").fill("approver");
  await page.getByLabel("Label").fill("Approver");
  await page.getByLabel("Rank").fill("20");
  await page.getByRole("button", { name: "Add role" }).click();
  await expect(page.getByRole("row", { name: /Approver approver 20/ })).toBeVisible();
});

test("admins upload a logo that people see in the launcher", async ({ page }) => {
  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  const logo = page.getByRole("region", { name: "Logo" });

  await logo.getByLabel("Logo image").setInputFiles({ name: "chat.png", mimeType: "image/png", buffer: PNG });
  await logo.getByRole("button", { name: "Upload logo" }).click();
  await expect(logo.getByRole("status")).toContainText("Logo saved.");

  await page.goto("/");
  const tile = page
    .getByRole("region", { name: "Company tools" })
    .locator('[aria-disabled="true"]', { hasText: "Chat" });
  await expect(tile.locator("img")).toHaveAttribute("src", /\/logos\/chat\?v=\d+/);
  expect(
    (await page.request.get((await tile.locator("img").getAttribute("src")) ?? "")).headers()["content-type"],
  ).toBe("image/png");

  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByRole("region", { name: "Logo" }).getByRole("button", { name: "Remove logo" }).click();
  // Once removed, the preview falls back to the icon and the upload button is back.
  await expect(page.getByRole("region", { name: "Logo" }).getByRole("button", { name: "Upload logo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Logo" }).locator(".tile-mark img")).toHaveCount(0);
  await page.goto("/");
  await expect(
    page
      .getByRole("region", { name: "Company tools" })
      .locator('[aria-disabled="true"]', { hasText: "Chat" })
      .locator("img"),
  ).toHaveCount(0);
});

test("the built-in portal app cannot be reconfigured", async ({ page }) => {
  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Portal" }).click();
  await expect(page.getByLabel("App address")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create new secret" })).toHaveCount(0);
});
```

Replace the whole file `portal/lib/forms.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  expiryFromDate,
  FormError,
  lines,
  parseCategory,
  parseExceptionChoice,
  parseRoles,
  parseStatus,
  requiredText,
} from "@/lib/forms";

describe("form parsing", () => {
  it("reads required text", () => {
    const form = new FormData();
    form.set("name", "  Sales ");
    expect(requiredText(form, "name", "Name")).toBe("Sales");
    expect(() => requiredText(form, "slug", "Slug")).toThrow(new FormError("Slug is required."));
  });

  it("splits lines", () => {
    expect(lines("https://a/cb\r\n\n  https://b/cb  ")).toEqual(["https://a/cb", "https://b/cb"]);
  });

  it("parses roles", () => {
    expect(parseRoles("viewer, Viewer, 10\nmanager,Manager,30")).toEqual([
      { key: "viewer", label: "Viewer", rank: 10 },
      { key: "manager", label: "Manager", rank: 30 },
    ]);
    expect(() => parseRoles("viewer, Viewer")).toThrow('Role line 1 must look like "viewer, Viewer, 10".');
    expect(() => parseRoles("  ")).toThrow("Add at least one role.");
  });

  it("parses exception choices", () => {
    expect(parseExceptionChoice("app1:deny")).toEqual({ app_id: "app1", effect: "deny", app_role_id: null });
    expect(parseExceptionChoice("app1:grant:role9")).toEqual({ app_id: "app1", effect: "grant", app_role_id: "role9" });
    expect(() => parseExceptionChoice("")).toThrow("Choose what the exception should do.");
  });

  it("turns a date into an end-of-day expiry", () => {
    expect(expiryFromDate("")).toBeNull();
    expect(expiryFromDate("2026-11-30")).toBe("2026-11-30T23:59:59Z");
    expect(() => expiryFromDate("30/11/2026")).toThrow("Expiry must be a date.");
  });

  it("parses app status and group", () => {
    expect(parseStatus("coming_soon")).toBe("coming_soon");
    expect(parseStatus("active")).toBe("active");
    expect(() => parseStatus("launched")).toThrow("Choose a status.");
    expect(parseCategory("company")).toBe("company");
    expect(() => parseCategory("")).toThrow("Choose a group.");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd portal
npx vitest run lib/forms.test.ts components/IconPicker.test.tsx
CI=1 npx playwright test e2e/apps.spec.ts
```

Expected: FAIL — `Failed to resolve import "@/components/IconPicker"`; Playwright can't start the portal because the build fails on the missing modules.

- [ ] **Step 3: Implement**

Replace the whole file `portal/app/admin/apps/[id]/page.tsx`:

```tsx
import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AppMark } from "@/components/AppMark";
import { IconPicker } from "@/components/IconPicker";
import { requireAdmin } from "@/lib/admin";
import { identity } from "@/lib/identity";

import { addRole, deleteRole, removeLogo, rotateSecret, updateApp, uploadLogo } from "../actions";

export default async function AppPage({ params }: PageProps<"/admin/apps/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const app = await identity.getApp(id);
  const locked = app.is_system;

  return (
    <>
      <h1>{app.name}</h1>
      <p className="hint">
        Client ID <code>{app.client_id}</code>
        {locked && ". The portal's addresses and secret come from its deployment settings."}
      </p>

      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading">Settings</h2>
        <ActionForm action={updateApp.bind(null, app.id, locked)} className="form-grid">
          <label>
            Name
            <input name="name" defaultValue={app.name} required />
          </label>
          {!locked && (
            <label>
              Status
              <select name="status" defaultValue={app.status}>
                <option value="coming_soon">Coming soon</option>
                <option value="active">Live</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          )}
          <label className="wide">
            Description
            <input name="description" defaultValue={app.description} />
          </label>
          {!locked && (
            <>
              <fieldset className="radio-row wide">
                <legend>Group</legend>
                <label>
                  <input
                    type="radio"
                    name="category"
                    value="department"
                    defaultChecked={app.category === "department"}
                  />
                  Departments
                </label>
                <label>
                  <input type="radio" name="category" value="company" defaultChecked={app.category === "company"} />
                  Company tools
                </label>
              </fieldset>
              <div className="wide">
                <IconPicker defaultValue={app.icon} />
              </div>
            </>
          )}
          <label className="wide">
            App address
            <input name="launch_url" type="url" defaultValue={app.launch_url} disabled={locked} />
          </label>
          <label className="wide">
            Sign-in callback URLs, one per line
            <textarea name="redirect_uris" defaultValue={app.redirect_uris.join("\n")} disabled={locked} />
          </label>
          <label className="wide">
            Sign-out return URLs, one per line
            <textarea
              name="post_logout_redirect_uris"
              defaultValue={app.post_logout_redirect_uris.join("\n")}
              disabled={locked}
            />
          </label>
          <div className="wide">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ActionForm>
      </section>

      {!locked && (
        <section aria-labelledby="logo-heading">
          <h2 id="logo-heading">Logo</h2>
          <p className="hint">A PNG, JPEG or WebP image up to 256 KB. It replaces the icon everywhere.</p>
          <div className="logo-field" style={{ marginTop: "0.75rem" }}>
            <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} />
            <ActionForm action={uploadLogo.bind(null, app.id)} className="form-row">
              <label>
                Logo image
                <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required />
              </label>
              <SubmitButton tone="quiet">{app.logo_version === null ? "Upload logo" : "Replace logo"}</SubmitButton>
            </ActionForm>
            {app.logo_version !== null && (
              <ActionForm action={removeLogo.bind(null, app.id)}>
                <SubmitButton tone="danger">Remove logo</SubmitButton>
              </ActionForm>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="roles-heading">
        <h2 id="roles-heading">Roles</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Key sent to the app</th>
                <th>Rank</th>
                {!locked && <th />}
              </tr>
            </thead>
            <tbody>
              {app.roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.label}</td>
                  <td>
                    <code>{role.key}</code>
                  </td>
                  <td>{role.rank}</td>
                  {!locked && (
                    <td>
                      <ActionForm action={deleteRole.bind(null, app.id, role.id)}>
                        <SubmitButton tone="danger">Delete</SubmitButton>
                      </ActionForm>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!locked && (
          <ActionForm action={addRole.bind(null, app.id)} className="form-row">
            <label>
              Key
              <input name="key" required pattern="[a-z][a-z0-9_]{0,63}" placeholder="approver" />
            </label>
            <label>
              Label
              <input name="label" required placeholder="Approver" />
            </label>
            <label>
              Rank
              <input name="rank" type="number" min={0} required placeholder="20" />
            </label>
            <SubmitButton tone="quiet">Add role</SubmitButton>
          </ActionForm>
        )}
      </section>

      <section aria-labelledby="departments-heading">
        <h2 id="departments-heading">Departments with access</h2>
        {app.departments.length === 0 ? (
          <p>
            No department has access yet. Grant it on the <Link href="/admin/departments">Departments</Link> page.
          </p>
        ) : (
          <ul>
            {app.departments.map((grant) => (
              <li key={grant.department_id}>
                {grant.department_name}: {app.roles.find((r) => r.id === grant.app_role_id)?.label ?? grant.role_key}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!locked && (
        <section aria-labelledby="secret-heading">
          <h2 id="secret-heading">Client secret</h2>
          <p className="hint">
            Create a new secret if the current one may have leaked. The app stops signing people in until it uses the
            new secret.
          </p>
          <ActionForm action={rotateSecret.bind(null, app.id)}>
            <SubmitButton tone="danger">Create new secret</SubmitButton>
          </ActionForm>
        </section>
      )}
    </>
  );
}
```

Replace the whole file `portal/app/admin/apps/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, runAction } from "@/lib/actions";
import { FormError, lines, parseCategory, parseRoles, parseStatus, requiredText, text } from "@/lib/forms";
import { identity } from "@/lib/identity";

const MAX_LOGO_BYTES = 256 * 1024;

function refreshApp(id: string) {
  revalidatePath(`/admin/apps/${id}`);
  revalidatePath("/admin/apps");
  revalidatePath("/");
}

export async function registerApp(_: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const created = await identity.createApp({
      slug: requiredText(form, "slug", "Short name"),
      name: requiredText(form, "name", "Name"),
      description: text(form, "description"),
      category: parseCategory(text(form, "category")),
      icon: text(form, "icon"),
      status: parseStatus(text(form, "status")),
      launch_url: text(form, "launch_url"),
      redirect_uris: lines(text(form, "redirect_uris")),
      post_logout_redirect_uris: lines(text(form, "post_logout_redirect_uris")),
      roles: parseRoles(text(form, "roles")),
    });
    revalidatePath("/admin/apps");
    return {
      status: "ok",
      message: `${created.name} registered. Give these credentials to the app's developers.`,
      secret: { clientId: created.client_id, clientSecret: created.client_secret },
    };
  });
}

export async function updateApp(id: string, isSystem: boolean, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const common = { name: requiredText(form, "name", "Name"), description: text(form, "description") };
    await identity.updateApp(
      id,
      isSystem
        ? common
        : {
            ...common,
            category: parseCategory(text(form, "category")),
            icon: text(form, "icon"),
            status: parseStatus(text(form, "status")),
            launch_url: text(form, "launch_url"),
            redirect_uris: lines(text(form, "redirect_uris")),
            post_logout_redirect_uris: lines(text(form, "post_logout_redirect_uris")),
          },
    );
    refreshApp(id);
    return { status: "ok", message: "Changes saved." };
  });
}

export async function uploadLogo(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const file = form.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new FormError("Choose an image to upload.");
    if (file.size > MAX_LOGO_BYTES) throw new FormError("Logo must be a PNG, JPEG or WebP image up to 256 KB");
    await identity.uploadLogo(id, file);
    refreshApp(id);
    return { status: "ok", message: "Logo saved." };
  });
}

export async function removeLogo(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await identity.removeLogo(id);
    refreshApp(id);
    return { status: "ok", message: "Logo removed." };
  });
}

export async function rotateSecret(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const secret = await identity.rotateSecret(id);
    return {
      status: "ok",
      message: "New secret created. The old one stops working now.",
      secret: { clientId: secret.client_id, clientSecret: secret.client_secret },
    };
  });
}

export async function addRole(appId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const [role] = parseRoles(`${text(form, "key")}, ${text(form, "label")}, ${text(form, "rank")}`);
    await identity.createRole(appId, role);
    revalidatePath(`/admin/apps/${appId}`);
    return { status: "ok", message: `Role ${role.label} added.` };
  });
}

export async function deleteRole(appId: string, roleId: string): Promise<ActionResult> {
  return runAction(async () => {
    await identity.deleteRole(roleId);
    revalidatePath(`/admin/apps/${appId}`);
    return { status: "ok", message: "Role deleted." };
  });
}
```

Replace the whole file `portal/app/admin/apps/page.tsx`:

```tsx
import Link from "next/link";

import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AppMark } from "@/components/AppMark";
import { IconPicker } from "@/components/IconPicker";
import { requireAdmin } from "@/lib/admin";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/apps";
import { identity } from "@/lib/identity";

import { registerApp } from "./actions";

export default async function AppsPage() {
  await requireAdmin();
  const apps = await identity.listApps();
  return (
    <>
      <h1>Apps</h1>
      <p className="hint">Department apps and company tools that people open from Central.</p>

      <section className="table-wrap" aria-label="Registered apps">
        <table>
          <thead>
            <tr>
              <th>App</th>
              <th>Group</th>
              <th>Status</th>
              <th>Client ID</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id}>
                <td>
                  <span className="app-cell">
                    <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} />
                    <Link href={`/admin/apps/${app.id}`}>{app.name}</Link>
                    {app.is_system && <span className="hint">Built in</span>}
                  </span>
                </td>
                <td>{CATEGORY_LABELS[app.category]}</td>
                <td className={`status status-${app.status}`}>{STATUS_LABELS[app.status]}</td>
                <td>
                  <code>{app.client_id}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="register-app">
        <h2 id="register-app">Register an app</h2>
        <ActionForm action={registerApp} className="form-grid">
          <label>
            Name
            <input name="name" required placeholder="Stores" />
          </label>
          <label>
            Short name
            <input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,63}" placeholder="stores" />
            <span className="hint">Becomes the client ID. Can&apos;t be changed later.</span>
          </label>
          <label className="wide">
            Description
            <input name="description" placeholder="Stock levels, issues and receipts" />
          </label>
          <fieldset className="radio-row wide">
            <legend>Group</legend>
            <label>
              <input type="radio" name="category" value="department" defaultChecked />
              Departments
            </label>
            <label>
              <input type="radio" name="category" value="company" />
              Company tools
            </label>
          </fieldset>
          <div className="wide">
            <IconPicker defaultValue="" />
          </div>
          <label>
            Status
            <select name="status" defaultValue="coming_soon">
              <option value="coming_soon">Coming soon</option>
              <option value="active">Live</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="wide">
            App address
            <input name="launch_url" type="url" placeholder="https://stores.yourco.com" />
            <span className="hint">Needed when the app is live.</span>
          </label>
          <label className="wide">
            Sign-in callback URLs, one per line
            <textarea name="redirect_uris" placeholder="https://stores.yourco.com/api/auth/callback/identity" />
            <span className="hint">Needed when the app is live.</span>
          </label>
          <label className="wide">
            Sign-out return URLs, one per line (optional)
            <textarea name="post_logout_redirect_uris" placeholder="https://stores.yourco.com/" />
          </label>
          <label className="wide">
            Roles, one per line as key, label, rank
            <textarea name="roles" required defaultValue={"member, Member, 10\nmanager, Manager, 30"} />
            <span className="hint">A higher rank wins when someone&apos;s departments give different roles.</span>
          </label>
          <div className="wide">
            <SubmitButton>Register app</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
```

Create `portal/components/AppMark.tsx`:

```tsx
"use client";

import { useState } from "react";

import { AppIcon } from "@/lib/icons";
import { appTone } from "@/lib/tones";

type Props = { slug: string; icon: string; logoVersion: number | null };

/** An app's logo when it has one (falling back if it fails to load), otherwise its tinted icon. */
export function AppMark({ slug, icon, logoVersion }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const tone = appTone(slug);
  return (
    <span className="tile-mark" style={{ backgroundColor: tone.background, color: tone.color }}>
      {logoVersion !== null && !logoFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from an authenticated route handler
        <img src={`/logos/${slug}?v=${logoVersion}`} alt="" onError={() => setLogoFailed(true)} />
      ) : (
        <AppIcon name={icon} />
      )}
    </span>
  );
}
```

Replace the whole file `portal/components/AppTile.tsx`:

```tsx
import { AppMark } from "@/components/AppMark";
import type { MyApp } from "@/lib/types";

export function AppTile({ app }: { app: MyApp }) {
  const mark = <AppMark slug={app.slug} icon={app.icon} logoVersion={app.logo_version} />;
  if (app.status === "active") {
    return (
      <a className="tile" href={app.launch_url} target="_blank" rel="noopener noreferrer" title={app.description}>
        {mark}
        <span className="tile-name">{app.name}</span>
      </a>
    );
  }
  return (
    <div className="tile tile-soon" aria-disabled="true" title={`${app.description}. Coming soon.`}>
      {mark}
      <span className="tile-name">{app.name}</span>
      <span className="soon">Soon</span>
    </div>
  );
}
```

Create `portal/components/IconPicker.tsx`:

```tsx
import { APP_ICON_NAMES, AppIcon, DEFAULT_ICON } from "@/lib/icons";

export function IconPicker({ defaultValue }: { defaultValue: string }) {
  const selected = APP_ICON_NAMES.includes(defaultValue as (typeof APP_ICON_NAMES)[number])
    ? defaultValue
    : DEFAULT_ICON;
  return (
    <fieldset className="icon-picker">
      <legend>Icon</legend>
      <div className="icon-options">
        {APP_ICON_NAMES.map((name) => (
          <label key={name} className="icon-option">
            <input type="radio" name="icon" value={name} defaultChecked={name === selected} />
            <AppIcon name={name} size={22} />
            {name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

Create `portal/lib/apps.ts`:

```ts
import type { AppCategory, AppStatus } from "@/lib/types";

export const STATUS_LABELS: Record<AppStatus, string> = {
  active: "Live",
  coming_soon: "Coming soon",
  disabled: "Disabled",
};

export const CATEGORY_LABELS: Record<AppCategory, string> = {
  department: "Departments",
  company: "Company tools",
};
```

Replace the whole file `portal/lib/forms.ts`:

```ts
import type { AppCategory, AppStatus } from "@/lib/types";

/** Parsing helpers for admin form submissions. Throws FormError with a user-facing message. */

export class FormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormError";
  }
}

export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function requiredText(form: FormData, name: string, label: string): string {
  const value = text(form, name);
  if (!value) throw new FormError(`${label} is required.`);
  return value;
}

/** One entry per non-empty line. */
export function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export type RoleInput = { key: string; label: string; rank: number };

/** Roles written one per line as `key, Label, rank`, e.g. `viewer, Viewer, 10`. */
export function parseRoles(value: string): RoleInput[] {
  const roles = lines(value).map((line, index) => {
    const [key, label, rank] = line.split(",").map((part) => part.trim());
    const parsedRank = Number(rank);
    if (!key || !label || !Number.isInteger(parsedRank)) {
      throw new FormError(`Role line ${index + 1} must look like "viewer, Viewer, 10".`);
    }
    return { key, label, rank: parsedRank };
  });
  if (roles.length === 0) throw new FormError("Add at least one role.");
  return roles;
}

export type ExceptionChoice =
  { app_id: string; effect: "deny"; app_role_id: null } | { app_id: string; effect: "grant"; app_role_id: string };

/** Values from the exception picker: `<appId>:deny` or `<appId>:grant:<roleId>`. */
export function parseExceptionChoice(value: string): ExceptionChoice {
  const [appId, effect, roleId] = value.split(":");
  if (appId && effect === "deny" && roleId === undefined) {
    return { app_id: appId, effect: "deny", app_role_id: null };
  }
  if (appId && effect === "grant" && roleId) {
    return { app_id: appId, effect: "grant", app_role_id: roleId };
  }
  throw new FormError("Choose what the exception should do.");
}

/** `YYYY-MM-DD` from a date input → end of that day in UTC, or null when empty. */
export function expiryFromDate(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FormError("Expiry must be a date.");
  return `${value}T23:59:59Z`;
}

const STATUSES: AppStatus[] = ["active", "coming_soon", "disabled"];
const CATEGORIES: AppCategory[] = ["department", "company"];

export function parseStatus(value: string): AppStatus {
  if (!STATUSES.includes(value as AppStatus)) throw new FormError("Choose a status.");
  return value as AppStatus;
}

export function parseCategory(value: string): AppCategory {
  if (!CATEGORIES.includes(value as AppCategory)) throw new FormError("Choose a group.");
  return value as AppCategory;
}
```

- [ ] **Step 4: Run the task's tests and confirm they pass**

```bash
npx vitest run lib/forms.test.ts components/IconPicker.test.tsx
CI=1 npx playwright test e2e/apps.spec.ts
```

Expected: `8 passed`; Playwright `4 passed`.

- [ ] **Step 5: Run all checks**

```bash
npm test && npm run lint && npm run typecheck && npm run format:check
```

Expected: every command succeeds (`56 passed`).

- [ ] **Step 6: Run the whole end-to-end suite twice**

```bash
CI=1 npm run test:e2e
CI=1 npm run test:e2e
```

Expected: `15 passed` both times. The logo test restores Chat's icon, so runs are repeatable.

- [ ] **Step 7: Commit**

```bash
git add -A portal
git commit -m "feat(portal): admin controls for groups, icons, status and logos"
```

---

## Done When

- `cd identity && uv run pytest` reports `127 passed`.
- `cd portal && npm test` reports `56 passed`; lint, typecheck and format checks pass; `CI=1 npm run test:e2e` reports `15 passed` twice in a row.
- At http://localhost:3000, `sam@yourco.com` sees the launcher with Example App (live) under Departments, Sales marked Soon, and the four company tools marked Soon.
- As `admin@yourco.com`, uploading a PNG logo for Chat shows it in the launcher; removing it brings the chat icon back.
