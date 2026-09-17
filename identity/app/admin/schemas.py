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
