"""Google Meet links and Calendar events.

Ported from the chat module's own server so the console has one backend. Two
shapes of request arrive here:

* `{"roomId": "..."}` — an instant Meet space, for "start a call now".
* `{"kind": "scheduled", ...}` — a Calendar event with a Meet link attached,
  invitations sent, and the event mirrored into this system's own calendar.

Both degrade rather than fail. With no Google credentials the scheduled path
still returns a working `calendar.google.com/render` URL pre-filled with the
title, time and attendees, and the meeting still appears on the in-app
calendar — so the flow can be demonstrated end to end on a laptop that has
never seen an OAuth consent screen.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from .. import calendar_store
from ..config import (
    DEFAULT_TIME_ZONE,
    GOOGLE_CALENDAR_REFRESH_TOKEN,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_MEET_REFRESH_TOKEN,
    google_configured,
)

router = APIRouter(tags=["meetings"])

RATE_LIMIT = 12
RATE_WINDOW = 60.0
GOOGLE_TIMEOUT = 10.0
MAX_ATTENDEES = 50
MAX_DURATION_MS = 24 * 60 * 60 * 1000
CONFERENCE_POLL_DELAYS = (0.25, 0.5, 1.0, 1.5)

_hits: dict[str, deque[float]] = defaultdict(deque)
# Cached per refresh token so every meeting does not re-mint a Google token.
_tokens: dict[str, tuple[str, float]] = {}


class MeetError(Exception):
    def __init__(self, message: str, status: int, retry_after: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.retry_after = retry_after


def _rate_limited(key: str) -> Optional[int]:
    now = time.monotonic()
    window = _hits[key]
    while window and now - window[0] > RATE_WINDOW:
        window.popleft()
    if len(window) >= RATE_LIMIT:
        return max(1, int(RATE_WINDOW - (now - window[0])))
    window.append(now)
    return None


# ---------------------------------------------------------------------------
# Request shapes
# ---------------------------------------------------------------------------


class Attendee(BaseModel):
    id: str = Field(min_length=1, max_length=160)
    name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Each attendee needs a valid calendar email")
        return value


class Organizer(BaseModel):
    id: str = Field(min_length=1, max_length=160)
    name: str = Field(min_length=1, max_length=160)
    email: Optional[str] = Field(default=None, max_length=254)


class MeetingRequest(BaseModel):
    kind: Literal["instant", "scheduled"] = "instant"
    roomId: str = Field(default="", max_length=160)
    requestId: Optional[str] = Field(default=None, max_length=128)
    title: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=1_000)
    startAt: Optional[int] = None
    endAt: Optional[int] = None
    timeZone: str = Field(default=DEFAULT_TIME_ZONE, max_length=100)
    organizer: Optional[Organizer] = None
    attendees: list[Attendee] = Field(default_factory=list)
    location: str = Field(default="", max_length=200)

    def validate_scheduled(self) -> None:
        if not self.title.strip():
            raise MeetError("Meeting title is required", 400)
        if self.startAt is None or self.endAt is None:
            raise MeetError("Meeting needs a start and an end time", 400)
        now_ms = int(datetime.now(tz=timezone.utc).timestamp() * 1000)
        if self.startAt <= now_ms:
            raise MeetError("Meeting start time must be in the future", 400)
        if self.endAt <= self.startAt:
            raise MeetError("Meeting end time must be after its start time", 400)
        if self.endAt - self.startAt > MAX_DURATION_MS:
            raise MeetError("Meeting duration cannot exceed 24 hours", 400)
        if not self.attendees:
            raise MeetError("Select at least one attendee", 400)
        if len(self.attendees) > MAX_ATTENDEES:
            raise MeetError(f"A meeting can have at most {MAX_ATTENDEES} attendees", 400)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _unique(attendees: list[Attendee]) -> list[Attendee]:
    seen: set[str] = set()
    out: list[Attendee] = []
    for attendee in attendees:
        key = attendee.email.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(attendee)
    return out


def _request_seed(body: MeetingRequest) -> str:
    if body.requestId:
        return body.requestId
    return json.dumps(
        {
            "roomId": body.roomId,
            "title": body.title,
            "startAt": body.startAt,
            "endAt": body.endAt,
            "attendees": sorted(a.email.lower() for a in _unique(body.attendees)),
        },
        sort_keys=True,
    )


def _event_id(seed: str) -> str:
    """Calendar event ids accept only lowercase base32hex characters."""
    normalized = re.sub(r"[^a-v0-9]", "", seed.lower())[:28]
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return f"meet{normalized}{digest}"[:64]


def _compact_utc(ms: int) -> str:
    moment = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return moment.strftime("%Y%m%dT%H%M%SZ")


def _demo_calendar_uri(body: MeetingRequest, meeting_uri: str) -> str:
    """A real Google Calendar "add event" URL, pre-filled.

    Worth being precise about: this link is not a mock. It opens Google
    Calendar with the title, window, description and guest list already filled
    in, and the presenter can save it. What it does not do is create the event
    server-side on the company calendar — that needs the credentials.
    """
    params: list[tuple[str, str]] = [
        ("action", "TEMPLATE"),
        ("text", body.title),
        ("dates", f"{_compact_utc(body.startAt or 0)}/{_compact_utc(body.endAt or 0)}"),
        ("stz", body.timeZone),
        ("etz", body.timeZone),
        (
            "details",
            "\n\n".join(filter(None, [body.description, f"Join Google Meet: {meeting_uri}"])),
        ),
        ("location", body.location or meeting_uri),
    ]
    params.extend(("add", attendee.email) for attendee in _unique(body.attendees))
    return f"https://calendar.google.com/calendar/render?{urlencode(params)}"


async def _access_token(refresh_token: str) -> str:
    cached = _tokens.get(refresh_token)
    if cached and cached[1] > time.monotonic():
        return cached[0]

    try:
        async with httpx.AsyncClient(timeout=GOOGLE_TIMEOUT) as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                },
            )
    except httpx.TimeoutException as error:
        raise MeetError("Google sign-in took too long. Try again.", 504) from error
    except httpx.HTTPError as error:
        raise MeetError("Could not reach Google to sign in.", 502) from error

    if response.status_code in (400, 401, 403):
        # Never surface the token endpoint body: it can echo credential material.
        raise MeetError("Google credentials are invalid or the refresh token was revoked.", 401)
    if response.status_code == 429:
        raise MeetError("Google rate limit reached. Try again shortly.", 429, 5)
    if response.status_code >= 400:
        raise MeetError("Google rejected the sign-in request.", 502)

    data = response.json()
    token = data.get("access_token")
    if not token:
        raise MeetError("Google returned no access token.", 502)

    # Refresh a minute early so a token never expires mid-request.
    ttl = max(60, int(data.get("expires_in", 3600))) - 60
    _tokens[refresh_token] = (token, time.monotonic() + ttl)
    return token


def _google_error(status: int, service: str) -> MeetError:
    if status == 401:
        _tokens.clear()
        return MeetError("Google credentials are invalid or the refresh token was revoked.", 401)
    if status == 403:
        return MeetError(f"{service} access is not configured for this project.", 403)
    if status == 429:
        return MeetError(f"{service} rate limit reached. Try again shortly.", 429, 5)
    if status >= 500:
        return MeetError(f"{service} is temporarily unavailable.", 502)
    return MeetError(f"{service} rejected the request.", 400)


# ---------------------------------------------------------------------------
# Google adapters
# ---------------------------------------------------------------------------


async def _instant_space(token: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=GOOGLE_TIMEOUT) as client:
            response = await client.post(
                "https://meet.googleapis.com/v2/spaces",
                headers={"Authorization": f"Bearer {token}"},
                json={},
            )
    except httpx.TimeoutException as error:
        raise MeetError("Google Meet took too long to create a link.", 504) from error
    except httpx.HTTPError as error:
        raise MeetError("Could not connect to Google Meet.", 502) from error

    if response.status_code >= 400:
        raise _google_error(response.status_code, "Google Meet")

    space = response.json()
    if not space.get("meetingUri"):
        raise MeetError("Google Meet returned no meeting link.", 502)
    return {
        "meetingUri": space["meetingUri"],
        "meetingCode": space.get("meetingCode", ""),
        "demo": False,
    }


def _meeting_uri_from(event: dict[str, Any]) -> Optional[str]:
    candidate = event.get("hangoutLink")
    if not candidate:
        for entry in (event.get("conferenceData") or {}).get("entryPoints") or []:
            if entry.get("entryPointType") == "video":
                candidate = entry.get("uri")
                break
    if not candidate or not candidate.startswith("https://meet.google.com/"):
        return None
    return candidate


async def _get_event(client: httpx.AsyncClient, token: str, event_id: str) -> dict[str, Any]:
    response = await client.get(
        f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
        headers={"Authorization": f"Bearer {token}"},
        params={"fields": "id,htmlLink,hangoutLink,conferenceData"},
    )
    if response.status_code >= 400:
        raise _google_error(response.status_code, "Google Calendar")
    return response.json()


async def _scheduled_event(token: str, body: MeetingRequest) -> dict[str, Any]:
    attendees = _unique(body.attendees)
    seed = _request_seed(body)
    event_id = _event_id(seed)

    payload = {
        "id": event_id,
        "summary": body.title,
        "start": {
            "dateTime": datetime.fromtimestamp(
                (body.startAt or 0) / 1000, tz=timezone.utc
            ).isoformat(),
            "timeZone": body.timeZone,
        },
        "end": {
            "dateTime": datetime.fromtimestamp(
                (body.endAt or 0) / 1000, tz=timezone.utc
            ).isoformat(),
            "timeZone": body.timeZone,
        },
        "attendees": [{"email": a.email, "displayName": a.name} for a in attendees],
        "conferenceData": {
            "createRequest": {
                "requestId": body.requestId or event_id,
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "reminders": {"useDefault": True},
        "extendedProperties": {"private": {"kiranRoomId": body.roomId}},
    }
    if body.description:
        payload["description"] = body.description
    if body.location:
        payload["location"] = body.location

    try:
        async with httpx.AsyncClient(timeout=GOOGLE_TIMEOUT) as client:
            response = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers={"Authorization": f"Bearer {token}"},
                params={"conferenceDataVersion": "1", "sendUpdates": "all"},
                json=payload,
            )

            if response.status_code == 409:
                # The stable event id turns an ambiguous retry into a read,
                # rather than a second copy of the meeting.
                event = await _get_event(client, token, event_id)
            elif response.status_code >= 400:
                raise _google_error(response.status_code, "Google Calendar")
            else:
                event = response.json()

            # The Meet link is minted asynchronously; poll briefly for it.
            for wait in CONFERENCE_POLL_DELAYS:
                if _meeting_uri_from(event):
                    break
                status = (
                    (event.get("conferenceData") or {}).get("createRequest", {}).get("status", {})
                )
                if status.get("statusCode") == "failure":
                    raise MeetError(
                        "Google Calendar created the event but could not attach a Meet link.", 502
                    )
                await asyncio.sleep(wait)
                event = await _get_event(client, token, event_id)
    except httpx.TimeoutException as error:
        raise MeetError("Google Calendar took too long. Retry with the same request.", 504) from error
    except httpx.HTTPError as error:
        raise MeetError("Could not connect to Google Calendar.", 502) from error

    meeting_uri = _meeting_uri_from(event)
    if not meeting_uri:
        raise MeetError(
            "Google Calendar created the event, but its Meet link is still being prepared.", 503, 2
        )

    return {
        "meetingUri": meeting_uri,
        "eventId": event.get("id", event_id),
        "calendarUri": event.get("htmlLink", ""),
        "demo": False,
    }


def _demo_scheduled(body: MeetingRequest) -> dict[str, Any]:
    meeting_uri = "https://meet.google.com/new"
    return {
        "meetingUri": meeting_uri,
        "eventId": _event_id(_request_seed(body)),
        "calendarUri": _demo_calendar_uri(body, meeting_uri),
        "demo": True,
    }


def _record(body: MeetingRequest, result: dict[str, Any]) -> None:
    """Mirrors the meeting onto the console's own calendar."""
    organizer = body.organizer
    calendar_store.add_event(
        {
            "id": body.requestId or result["eventId"],
            "title": body.title,
            "description": body.description,
            "startAt": body.startAt,
            "endAt": body.endAt,
            "timeZone": body.timeZone,
            "organizerName": organizer.name if organizer else "",
            "organizerId": organizer.id if organizer else "",
            "attendeeNames": [a.name for a in _unique(body.attendees)],
            "attendeeIds": [a.id for a in _unique(body.attendees)],
            "roomId": body.roomId,
            "location": body.location,
            "meetingUri": result["meetingUri"],
            "calendarUri": result.get("calendarUri", ""),
            "googleEventId": result.get("eventId", ""),
            "demo": result.get("demo", False),
            "source": "chat",
        }
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@router.post("/meet")
async def create_meeting(body: MeetingRequest, request: Request):
    client_key = request.client.host if request.client else "anonymous"
    retry_after = _rate_limited(client_key)
    if retry_after is not None:
        return JSONResponse(
            {"error": f"Too many meetings created. Try again in {retry_after}s."},
            status_code=429,
            headers={"Retry-After": str(retry_after)},
        )

    scheduled = body.kind == "scheduled"

    try:
        if scheduled:
            body.validate_scheduled()
    except MeetError as error:
        return JSONResponse({"error": error.message}, status_code=error.status)

    kind = "calendar" if scheduled else "meet"
    if not google_configured(kind):
        if scheduled:
            result = _demo_scheduled(body)
            _record(body, result)
            return JSONResponse(result)
        return JSONResponse(
            {"meetingUri": "https://meet.google.com/new", "meetingCode": "new", "demo": True}
        )

    refresh = GOOGLE_CALENDAR_REFRESH_TOKEN if scheduled else GOOGLE_MEET_REFRESH_TOKEN
    try:
        token = await _access_token(refresh)
        result = await _scheduled_event(token, body) if scheduled else await _instant_space(token)
        if scheduled:
            _record(body, result)
        return JSONResponse(result)
    except MeetError as error:
        # Bad or revoked credentials should not stop a demonstration: fall back
        # to the same path a machine with no credentials at all would take.
        if error.status in (401, 403):
            if scheduled:
                result = _demo_scheduled(body)
                _record(body, result)
                return JSONResponse(result)
            return JSONResponse(
                {"meetingUri": "https://meet.google.com/new", "meetingCode": "new", "demo": True}
            )
        headers = {"Retry-After": str(error.retry_after)} if error.retry_after else {}
        return JSONResponse({"error": error.message}, status_code=error.status, headers=headers)


@router.get("/meet/status")
def meet_status() -> dict:
    return {
        "calendar": google_configured("calendar"),
        "meet": google_configured("meet"),
        "timeZone": DEFAULT_TIME_ZONE,
    }
