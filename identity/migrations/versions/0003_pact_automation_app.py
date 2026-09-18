"""Register the PACT Automation module as a company tool

The module (`modules/pact-automation/`) is three processes on the operator's own Windows
machine, and the tile opens the top one:

    KiranOS console   http://localhost:5173   what a person uses (Vite)
    KiranOS API       http://127.0.0.1:3001   orders, the mailing hub, the PACT bridge
    KPAC robot        http://127.0.0.1:8765   drives PACT RevenU through Windows UI Automation

Nothing is containerised: the robot has to share a Windows session with the PACT window.
The module speaks no OpenID Connect yet, so its client secret hash is the unusable `'!'` and
the callback URLs are placeholders that keep the row valid for the admin UI (an app that is
Live must carry an address and one callback URL). An admin rotates the secret and replaces
the URLs on the day the module gains sign-in.

Revision ID: 0003
Revises: 0002
"""

import uuid

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Same namespace as 0002, so every environment gets the same ids.
NAMESPACE = uuid.UUID("7b1d7f40-3c0e-4a4f-9d2c-6f1f3a2b9c10")

SLUG = "pact-automation"
NAME = "PACT Automation"
CATEGORY = "company"
ICON = "receipt"
DESCRIPTION = (
    "Purchase orders from the inbox to PACT RevenU: the KiranOS console, its mailing "
    "hub, and the robot that fills and verifies every row"
)
# The console the operator opens. The Vite dev server is 5173; a console served another way
# would differ, and then this address and `KIRANOS_APP_URL` in backend/.env both change.
LAUNCH_URL = "http://localhost:5173"
REDIRECT_URIS = ["http://localhost:5173/api/auth/callback/identity"]
POST_LOGOUT_REDIRECT_URIS = ["http://localhost:5173/"]

# Departments that enter documents into PACT. Add more from Admin -> Apps -> PACT Automation.
GRANTED = ["purchase", "accounts"]
ROLES = [("member", "Member", 10), ("manager", "Manager", 30)]


def _id(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{kind}:{key}")


def upgrade() -> None:
    conn = op.get_bind()
    inserted = conn.execute(
        sa.text(
            "INSERT INTO apps (id, slug, name, description, icon, launch_url, client_id, "
            "client_secret_hash, redirect_uris, post_logout_redirect_uris, status, "
            "is_system, category) VALUES (:id, :slug, :name, :description, :icon, :launch_url, "
            ":slug, '!', :redirect_uris, :post_logout_redirect_uris, 'active', false, :category) "
            "ON CONFLICT DO NOTHING RETURNING id"
        ).bindparams(
            sa.bindparam("redirect_uris", type_=sa.ARRAY(sa.Text())),
            sa.bindparam("post_logout_redirect_uris", type_=sa.ARRAY(sa.Text())),
        ),
        {
            "id": _id("app", SLUG),
            "slug": SLUG,
            "name": NAME,
            "description": DESCRIPTION,
            "icon": ICON,
            "launch_url": LAUNCH_URL,
            "redirect_uris": REDIRECT_URIS,
            "post_logout_redirect_uris": POST_LOGOUT_REDIRECT_URIS,
            "category": CATEGORY,
        },
    ).scalar()
    if inserted is None:
        return  # an app with this slug or client id already exists; leave it alone

    for key, label, rank in ROLES:
        conn.execute(
            sa.text(
                "INSERT INTO app_roles (id, app_id, key, label, rank) "
                "VALUES (:id, :app_id, :key, :label, :rank)"
            ),
            {
                "id": _id("role", f"{SLUG}:{key}"),
                "app_id": inserted,
                "key": key,
                "label": label,
                "rank": rank,
            },
        )

    department_ids = dict(
        conn.execute(
            sa.text("SELECT slug, id FROM departments WHERE slug = ANY(:slugs)"),
            {"slugs": GRANTED},
        ).all()
    )
    for slug in GRANTED:
        department_id = department_ids.get(slug)
        if department_id is None:
            continue  # the department was renamed or removed; an admin can grant access later
        conn.execute(
            sa.text(
                "INSERT INTO department_app_access (department_id, app_id, app_role_id) "
                "VALUES (:department_id, :app_id, :role_id) ON CONFLICT DO NOTHING"
            ),
            {
                "department_id": department_id,
                "app_id": inserted,
                "role_id": _id("role", f"{SLUG}:member"),
            },
        )


def downgrade() -> None:
    # Only the row this migration inserted; an app that already owned the slug keeps a different id.
    op.get_bind().execute(sa.text("DELETE FROM apps WHERE id = :id"), {"id": _id("app", SLUG)})
