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
