"""Voice and video calls: the introductions, and the call list.

    GET  /api/calls/events?user=U&device=D   signals for U as they happen (SSE)
    POST /api/calls/signal                   one signal to the other side of a call
    GET  /api/calls/history?user=U           U's calls, newest first

The call itself never passes through here. The two phones send each other
audio and video directly, over WebRTC. What they cannot do on their own is
find each other, so this relays the few messages that takes — the invitation,
the answer, each side's session description and network candidates — and
keeps a record of every call for both people's call lists.

A signal is addressed to a person and, optionally, to one of their devices. An
invitation rings every phone the person has open; once one of them answers,
the rest of the call is between those two devices only.
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from ..config import CALL_ICE_SERVERS, CALLS_FILE
from .chat import resolve_actor

router = APIRouter(prefix="/calls", tags=["calls"])

# How long an unanswered call rings. The caller's phone gives up at 45 seconds
# (src/calls/engine.ts in the app); this later cut-off only matters when the
# caller's phone vanished while it was ringing.
RING_SECONDS = 50.0
# The phones on a connected call each check in every 30 seconds. A call that
# has heard from neither for this long is over, even though nobody said so.
SILENT_CALL_SECONDS = 180.0
# As for the chat stream: the app treats two missed heartbeats as a dead line.
HEARTBEAT_SECONDS = 20.0
# Records kept on disk, across everyone's call lists.
KEEP_RECORDS = 500

Kind = Literal[
    "invite",
    "ringing",
    "accept",
    "decline",
    "busy",
    "cancel",
    "hangup",
    "offer",
    "answer",
    "ice",
    "state",
]


class Signal(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    callId: str = Field(min_length=1, max_length=64)
    kind: Kind
    sender: str = Field(alias="from", min_length=1, max_length=64)
    fromDevice: str = Field(min_length=1, max_length=64)
    to: str = Field(min_length=1, max_length=64)
    toDevice: str | None = Field(default=None, max_length=64)
    media: Literal["audio", "video"] | None = None
    roomId: str | None = Field(default=None, max_length=128)
    data: dict | None = None

    def wire(self) -> dict:
        return self.model_dump(by_alias=True, exclude_none=True)


class CallRejected(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def now_ms() -> int:
    return int(time.time() * 1000)


_PRIVATE = {"fromDevice", "toDevice", "lastAt"}


def public(record: dict) -> dict:
    """A record as the call list shows it: without the devices it rang on."""
    return {key: value for key, value in record.items() if key not in _PRIVATE}


class CallBook:
    """Every call, as both people's call lists show it."""

    def __init__(self, path: Path | None):
        self.path = path
        self.records: dict[str, dict] = {}
        if path is None or not path.exists():
            return
        try:
            saved = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            saved = []
        for record in saved if isinstance(saved, list) else []:
            if record.get("status") != "ended":
                # Ringing or connected when the server stopped. Either way the
                # phones stopped waiting for it long ago.
                answered = record.get("answeredAt") is not None
                ended_at = record.get("lastAt") or record["startedAt"]
                _end(record, "completed" if answered else "missed", ended_at)
            self.records[record["id"]] = record

    def save(self) -> None:
        kept = list(self.records.values())[-KEEP_RECORDS:]
        self.records = {record["id"]: record for record in kept}
        if self.path is None:
            return
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(kept), encoding="utf-8")
        temporary.replace(self.path)

    def history(self, user: str, limit: int) -> list[dict]:
        mine = [r for r in self.records.values() if user in (r["from"], r["to"])]
        mine.sort(key=lambda record: record["startedAt"], reverse=True)
        return [public(record) for record in mine[:limit]]

    def ringing_for(self, user: str) -> list[dict]:
        return [r for r in self.records.values() if r["status"] == "ringing" and r["to"] == user]

    def apply(self, signal: Signal, now: int) -> dict | None:
        """Check `signal` against its call and move the call on.

        Returns the record when the signal changed it and None when it did
        not. Raises CallRejected when the signal must not be relayed.
        """
        record = self.records.get(signal.callId)

        if signal.kind == "invite":
            if record is not None:
                raise CallRejected(409, "That call has already started.")
            if signal.sender == signal.to:
                raise CallRejected(400, "You cannot call yourself.")
            if signal.media is None:
                raise CallRejected(400, "Say whether it is a voice or a video call.")
            record = {
                "id": signal.callId,
                "from": signal.sender,
                "to": signal.to,
                "media": signal.media,
                "roomId": signal.roomId,
                "status": "ringing",
                "outcome": None,
                "startedAt": now,
                "answeredAt": None,
                "endedAt": None,
                "lastAt": now,
                "fromDevice": signal.fromDevice,
                "toDevice": None,
            }
            self.records[signal.callId] = record
            return record

        if record is None:
            raise CallRejected(404, "There is no such call.")
        people = {record["from"], record["to"]}
        if signal.sender not in people or signal.to not in people or signal.sender == signal.to:
            raise CallRejected(403, "Only the two people on a call can signal it.")
        if record["status"] == "ended":
            raise CallRejected(410, "The call has ended.")

        record["lastAt"] = now
        caller = signal.sender == record["from"]
        kind = signal.kind

        if kind == "ringing":
            if caller:
                raise CallRejected(400, "Only the phone being called rings.")
            return None

        if kind in ("accept", "decline", "busy"):
            if caller:
                raise CallRejected(400, "Only the person being called can answer.")
            if record["status"] != "ringing":
                raise CallRejected(409, "The call was already answered.")
            if kind == "accept":
                record.update(status="active", answeredAt=now, toDevice=signal.fromDevice)
            else:
                _end(record, "declined" if kind == "decline" else "busy", now)
            return record

        if kind == "cancel":
            if not caller:
                raise CallRejected(400, "Only the caller can cancel a call.")
            # Answered in the same moment the caller gave up: it was a call,
            # however short.
            _end(record, "completed" if record["status"] == "active" else "missed", now)
            return record

        if kind == "hangup":
            if record["status"] == "ringing":
                _end(record, "missed" if caller else "declined", now)
            else:
                _end(record, "completed", now)
            return record

        # offer, answer, ice, state: the connected call's own traffic.
        if record["status"] != "active":
            raise CallRejected(409, "The call has not been answered.")
        return None

    def expire(self, now: int) -> list[dict]:
        """End the calls nobody ended: rung out, or gone silent."""
        ring, silence = int(RING_SECONDS * 1000), int(SILENT_CALL_SECONDS * 1000)
        ended = []
        for record in self.records.values():
            if record["status"] == "ringing" and now - record["startedAt"] > ring:
                _end(record, "missed", record["startedAt"] + ring)
                ended.append(record)
            elif record["status"] == "active" and now - record["lastAt"] > silence:
                _end(record, "completed", record["lastAt"])
                ended.append(record)
        return ended


def _end(record: dict, outcome: str, at: int) -> None:
    record.update(status="ended", outcome=outcome, endedAt=at)


_book: CallBook | None = None


def book() -> CallBook:
    global _book
    if _book is None:
        _book = CallBook(CALLS_FILE)
    return _book


def use_book(value: CallBook | None) -> None:
    """Test seam: run the router against a call book of the test's choosing."""
    global _book
    _book = value
    _streams.clear()


# --------------------------------------------------------------------- stream

# One queue per open stream, with the person and the device it belongs to.
_streams: dict[asyncio.Queue, tuple[str, str]] = {}


def _frame(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _deliver(
    user: str, frame: str, *, device: str | None = None, skip_device: str | None = None
) -> int:
    """Queue `frame` for `user`'s open streams; returns how many took it."""
    delivered = 0
    for queue, (owner, owner_device) in list(_streams.items()):
        if owner != user:
            continue
        if device is not None and owner_device != device:
            continue
        if skip_device is not None and owner_device == skip_device:
            continue
        try:
            queue.put_nowait(frame)
            delivered += 1
        except asyncio.QueueFull:
            # A stream that cannot keep up is dropped; the app reconnects.
            _streams.pop(queue, None)
    return delivered


def _announce(record: dict) -> None:
    """Both call lists change as the call does."""
    frame = _frame("call", public(record))
    _deliver(record["from"], frame)
    _deliver(record["to"], frame)


def _invitation(record: dict) -> dict:
    return {
        "callId": record["id"],
        "kind": "invite",
        "from": record["from"],
        "fromDevice": record["fromDevice"],
        "to": record["to"],
        "media": record["media"],
        "roomId": record["roomId"],
        "data": {"startedAt": record["startedAt"]},
    }


def _sweep(now: int) -> None:
    calls = book()
    ended = calls.expire(now)
    for record in ended:
        if record["answeredAt"] is None:
            # Stop the ringing on the phones that are still at it.
            caller, callee = record["from"], record["to"]
            stop = {
                "callId": record["id"],
                "kind": "cancel",
                "fromDevice": "server",
                "data": {"reason": "timeout"},
            }
            _deliver(callee, _frame("signal", {**stop, "from": caller, "to": callee}))
            _deliver(
                caller,
                _frame("signal", {**stop, "from": callee, "to": caller}),
                device=record["fromDevice"],
            )
        _announce(record)
    if ended:
        calls.save()


async def _frames(user: str, device: str, queue: asyncio.Queue):
    """The stream's content: a ready marker carrying the servers a call needs,
    any invitation still ringing for this person, then each signal as it
    comes. `queue` must already be registered in `_streams`, so a signal sent
    while the stream is starting waits in it. The app ignores an invitation it
    has already seen, so one that arrives both ways rings once.
    """
    try:
        yield _frame("ready", {"iceServers": CALL_ICE_SERVERS})
        _sweep(now_ms())
        for record in book().ringing_for(user):
            yield _frame("signal", _invitation(record))
        while True:
            try:
                frame = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                _sweep(now_ms())
                yield _frame("ping", {})
                continue
            yield frame
    finally:
        _streams.pop(queue, None)


@router.get("/events")
async def events(
    user: str = Query(...), device: str = Query(..., min_length=1, max_length=64)
) -> StreamingResponse:
    """Signals for `user` on `device`, as they are sent."""
    resolve_actor(user)
    queue: asyncio.Queue = asyncio.Queue(maxsize=256)
    _streams[queue] = (user, device)
    return StreamingResponse(
        _frames(user, device, queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------- endpoints


@router.post("/signal")
async def signal(body: Signal) -> dict:
    """Relay one signal, and move its call's record on."""
    resolve_actor(body.sender)
    resolve_actor(body.to)
    now = now_ms()
    _sweep(now)
    calls = book()
    try:
        changed = calls.apply(body, now)
    except CallRejected as error:
        raise HTTPException(status_code=error.status, detail=str(error)) from error

    delivered = _deliver(body.to, _frame("signal", body.wire()), device=body.toDevice)

    if body.kind in ("accept", "decline", "busy"):
        # The person's other phones stop ringing.
        reason = "answered_elsewhere" if body.kind == "accept" else "declined_elsewhere"
        stop = {
            "callId": body.callId,
            "kind": "cancel",
            "from": body.to,
            "fromDevice": "server",
            "to": body.sender,
            "data": {"reason": reason},
        }
        _deliver(body.sender, _frame("signal", stop), skip_device=body.fromDevice)

    if changed is not None:
        calls.save()
        _announce(changed)
    return {"delivered": delivered, "call": public(calls.records[body.callId])}


@router.get("/history")
async def history(
    user: str = Query(...), limit: int = Query(100, ge=1, le=KEEP_RECORDS)
) -> dict:
    """`user`'s calls, newest first."""
    resolve_actor(user)
    _sweep(now_ms())
    return {"calls": book().history(user, limit)}
