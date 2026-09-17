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
