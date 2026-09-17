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
