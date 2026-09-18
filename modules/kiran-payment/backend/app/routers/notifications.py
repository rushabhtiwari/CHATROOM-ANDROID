"""The notification panel's backing store."""

from __future__ import annotations

from fastapi import APIRouter

from ..models import NotificationBody
from ..store import store

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications() -> list[dict]:
    return store.snapshot()["notifications"]


@router.post("", status_code=201)
def push(body: NotificationBody) -> dict:
    return store.push_notification(body.model_dump(by_alias=True))


@router.post("/read-all")
def read_all() -> dict:
    store.mark_all_notifications_read()
    return {"ok": True}


@router.post("/{notification_id}/read")
def read_one(notification_id: str) -> dict:
    store.mark_notification_read(notification_id)
    return {"ok": True}
