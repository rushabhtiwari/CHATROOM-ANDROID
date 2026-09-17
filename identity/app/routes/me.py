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
