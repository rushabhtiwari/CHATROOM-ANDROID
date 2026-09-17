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
