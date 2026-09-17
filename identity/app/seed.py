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
