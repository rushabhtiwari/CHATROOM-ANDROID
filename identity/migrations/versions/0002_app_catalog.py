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
