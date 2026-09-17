import uuid

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog
from app.security import utcnow


def record(
    db: Session,
    event: str,
    *,
    request: Request | None = None,
    actor_user_id: uuid.UUID | None = None,
    subject_user_id: uuid.UUID | None = None,
    app_id: uuid.UUID | None = None,
    detail: dict | None = None,
) -> None:
    """Add an audit entry to the current transaction (caller commits)."""
    db.add(
        AuditLog(
            at=utcnow(),
            event=event,
            actor_user_id=actor_user_id,
            subject_user_id=subject_user_id,
            app_id=app_id,
            detail=detail or {},
            request_id=getattr(request.state, "request_id", None) if request else None,
            ip=request.client.host if request and request.client else None,
        )
    )
