import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import audit
from app.admin.schemas import AuditOut
from app.config import Settings, get_settings
from app.db import get_db
from app.deps import require_admin
from app.keys import rotate
from app.models import AuditLog, User

router = APIRouter()


@router.get("/audit", response_model=list[AuditOut])
def list_audit(
    event: str | None = None,
    user: uuid.UUID | None = None,
    app: uuid.UUID | None = None,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    before_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[AuditLog]:
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    if event:
        stmt = stmt.where(AuditLog.event == event)
    if user:
        stmt = stmt.where(or_(AuditLog.subject_user_id == user, AuditLog.actor_user_id == user))
    if app:
        stmt = stmt.where(AuditLog.app_id == app)
    if from_:
        stmt = stmt.where(AuditLog.at >= from_)
    if to:
        stmt = stmt.where(AuditLog.at < to)
    if before_id:
        stmt = stmt.where(AuditLog.id < before_id)
    return list(db.scalars(stmt))


@router.post("/keys/rotate")
def rotate_keys(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    admin: User = Depends(require_admin),
) -> dict:
    kid = rotate(db, settings.key_encryption_key)
    audit.record(
        db, "signing_key_rotated", request=request, actor_user_id=admin.id, detail={"kid": kid}
    )
    db.commit()
    return {"kid": kid}
