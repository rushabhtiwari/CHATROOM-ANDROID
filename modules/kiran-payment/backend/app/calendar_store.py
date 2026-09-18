"""The calendar behind the in-app calendar.

Every meeting scheduled from a conversation lands here, which is what lets the
console show a real calendar instead of sending people to Google. The store is
the same shape as the rest of this backend: in memory, snapshotted to JSON, and
small enough that a full read costs nothing.

Events created here carry the Google identifiers when Google was reachable, and
carry a `demo` flag when it was not. The calendar renders both the same way —
the distinction belongs in the event detail, not in whether the meeting appears.
"""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from .config import CALENDAR_FILE, DEFAULT_TIME_ZONE

_lock = threading.Lock()
_events: list[dict[str, Any]] = []
_loaded = False

IST = timezone(timedelta(hours=5, minutes=30))


def _now_ms() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp() * 1000)


def _at(day_offset: int, hour: int, minute: int = 0) -> int:
    """A wall-clock time in IST, `day_offset` days from today."""
    base = datetime.now(tz=IST) + timedelta(days=day_offset)
    moment = base.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return int(moment.timestamp() * 1000)


def _seed() -> list[dict[str, Any]]:
    """A working week, so the calendar is never shown empty to a client.

    The entries are the meetings this company actually runs — a production
    review, a vendor call, the monthly MIS — rather than placeholder blocks.
    """
    minutes = 60_000
    return [
        {
            "id": "cal-seed-standup",
            "title": "Production planning standup",
            "description": "Line loading for the week, and any HDPE stock risks.",
            "startAt": _at(0, 9, 30),
            "endAt": _at(0, 9, 30) + 30 * minutes,
            "timeZone": DEFAULT_TIME_ZONE,
            "organizerName": "Suresh Menon",
            "attendeeNames": ["Anjali Rao", "Vikram Shah", "Priya Nair"],
            "roomId": "room-operations",
            "location": "Plant 2 — Conference room",
            "source": "seed",
            "demo": False,
            "createdAt": _now_ms(),
        },
        {
            "id": "cal-seed-vendor",
            "title": "Vendor negotiation — Suraj Polymers",
            "description": "Q3 pricing on HDPE granules against the revised RFQ.",
            "startAt": _at(0, 15, 0),
            "endAt": _at(0, 15, 0) + 45 * minutes,
            "timeZone": DEFAULT_TIME_ZONE,
            "organizerName": "Vikram Shah",
            "attendeeNames": ["Suresh Menon"],
            "roomId": "room-purchase",
            "meetingUri": "https://meet.google.com/new",
            "source": "seed",
            "demo": True,
            "createdAt": _now_ms(),
        },
        {
            "id": "cal-seed-mis",
            "title": "Monthly MIS review",
            "description": "Receivables ageing, department budget utilisation, AI spend.",
            "startAt": _at(1, 11, 0),
            "endAt": _at(1, 11, 0) + 90 * minutes,
            "timeZone": DEFAULT_TIME_ZONE,
            "organizerName": "Priya Nair",
            "attendeeNames": ["Anjali Rao", "Suresh Menon", "Vikram Shah"],
            "roomId": "room-finance",
            "location": "Head office — Boardroom",
            "source": "seed",
            "demo": False,
            "createdAt": _now_ms(),
        },
        {
            "id": "cal-seed-reimbursement",
            "title": "Reimbursement clearing — August cycle",
            "description": "HR and Accounts to clear the pending August claims together.",
            "startAt": _at(2, 16, 0),
            "endAt": _at(2, 16, 0) + 60 * minutes,
            "timeZone": DEFAULT_TIME_ZONE,
            "organizerName": "Anjali Rao",
            "attendeeNames": ["Priya Nair"],
            "roomId": "room-hr",
            "source": "seed",
            "demo": False,
            "createdAt": _now_ms(),
        },
        {
            "id": "cal-seed-dispatch",
            "title": "Dispatch readiness — Bharat Metro order",
            "description": "Confirm the packing list and the ASN before Friday's pickup.",
            "startAt": _at(3, 10, 0),
            "endAt": _at(3, 10, 0) + 45 * minutes,
            "timeZone": DEFAULT_TIME_ZONE,
            "organizerName": "Suresh Menon",
            "attendeeNames": ["Vikram Shah", "Anjali Rao"],
            "roomId": "room-operations",
            "source": "seed",
            "demo": False,
            "createdAt": _now_ms(),
        },
    ]


def _persist() -> None:
    try:
        CALENDAR_FILE.write_text(json.dumps(_events, indent=2), encoding="utf-8")
    except OSError:
        # The calendar is a convenience surface; a read-only disk must not take
        # the API down with it.
        pass


def _ensure_loaded() -> None:
    global _loaded, _events
    if _loaded:
        return
    if CALENDAR_FILE.exists():
        try:
            loaded = json.loads(CALENDAR_FILE.read_text(encoding="utf-8"))
            if isinstance(loaded, list):
                _events = loaded
                _loaded = True
                return
        except (OSError, json.JSONDecodeError):
            pass
    _events = _seed()
    _loaded = True
    _persist()


def list_events(start: Optional[int] = None, end: Optional[int] = None) -> list[dict[str, Any]]:
    """Events overlapping the window, earliest first."""
    with _lock:
        _ensure_loaded()
        rows = list(_events)
    if start is not None:
        rows = [row for row in rows if row["endAt"] >= start]
    if end is not None:
        rows = [row for row in rows if row["startAt"] <= end]
    return sorted(rows, key=lambda row: row["startAt"])


def add_event(event: dict[str, Any]) -> dict[str, Any]:
    """Adds an event, or returns the existing one when the id repeats.

    Meetings scheduled from a conversation carry the client's request id, so a
    retry after an ambiguous failure updates the same row rather than putting a
    second copy of the meeting on everyone's calendar.
    """
    with _lock:
        _ensure_loaded()
        event.setdefault("id", f"cal-{uuid.uuid4().hex[:12]}")
        event.setdefault("createdAt", _now_ms())
        event.setdefault("timeZone", DEFAULT_TIME_ZONE)
        event.setdefault("source", "chat")

        for index, existing in enumerate(_events):
            if existing["id"] == event["id"]:
                merged = {**existing, **event}
                _events[index] = merged
                _persist()
                return merged

        _events.append(event)
        _persist()
        return event


def delete_event(event_id: str) -> bool:
    with _lock:
        _ensure_loaded()
        before = len(_events)
        _events[:] = [row for row in _events if row["id"] != event_id]
        removed = len(_events) != before
        if removed:
            _persist()
        return removed


def reset() -> list[dict[str, Any]]:
    global _events
    with _lock:
        _events = _seed()
        _persist()
        return list(_events)
