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
