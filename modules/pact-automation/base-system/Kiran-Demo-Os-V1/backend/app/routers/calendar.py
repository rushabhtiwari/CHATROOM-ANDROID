"""The console's own calendar.

Meetings scheduled from a conversation land here through `meet.py`; this router
is what the in-app calendar reads and what a manually-created block writes to.
Keeping it server-side rather than in the browser is what lets two people
looking at two different screens see the same week.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from .. import calendar_store
from ..config import DEFAULT_TIME_ZONE

router = APIRouter(prefix="/calendar", tags=["calendar"])


class EventInput(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    description: str = Field(default="", max_length=1_000)
    startAt: int
    endAt: int
    timeZone: str = Field(default=DEFAULT_TIME_ZONE, max_length=100)
    location: str = Field(default="", max_length=200)
    organizerName: str = Field(default="", max_length=160)
    attendeeNames: list[str] = Field(default_factory=list, max_length=50)
    roomId: str = Field(default="", max_length=160)
    meetingUri: str = Field(default="", max_length=500)


@router.get("/events")
def list_events(
    start: Optional[int] = Query(default=None, description="Window start, epoch ms"),
    end: Optional[int] = Query(default=None, description="Window end, epoch ms"),
) -> dict:
    return {"events": calendar_store.list_events(start, end)}


@router.post("/events", status_code=201)
def create_event(body: EventInput) -> dict:
    if body.endAt <= body.startAt:
        raise HTTPException(status_code=400, detail="The end time must be after the start time.")
    event = calendar_store.add_event(
        {
            **body.model_dump(),
            "source": "manual",
            "demo": False,
        }
    )
    return {"event": event}


@router.delete("/events/{event_id}")
def delete_event(event_id: str) -> dict:
    if not calendar_store.delete_event(event_id):
        raise HTTPException(status_code=404, detail="That event is no longer on the calendar.")
    return {"deleted": event_id}


@router.post("/reset")
def reset_calendar() -> dict:
    return {"events": calendar_store.reset()}
