"""The chat server: a shared operation log over HTTP and server-sent events.

    GET  /api/chat/log?since=N&user=U     base state (when N is 0) + ops after N
    POST /api/chat/ops                    append one op; idempotent on opId
    GET  /api/chat/events?since=N&user=U  stream of ops after N, as they happen
    POST /api/chat/attachments            store a file; returns its URL

What an op *means* is decided by the clients' shared reducer, not here — see
`app/chat_log.py`.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..chat_log import ChatLog, OpRejected
from ..config import (
    CHAT_DB_FILE,
    CHAT_PROTOCOL_FILE,
    CHAT_SEED_FILE,
    CHAT_UPLOAD_DIR,
    MAX_CHAT_ATTACHMENT_BYTES,
)

router = APIRouter(prefix="/chat", tags=["chat"])

_log: ChatLog | None = None


def chat_log() -> ChatLog:
    global _log
    if _log is None:
        _log = ChatLog(CHAT_DB_FILE, CHAT_SEED_FILE, CHAT_PROTOCOL_FILE)
    return _log


def use_log(log: ChatLog | None) -> None:
    """Test seam: run the router against a log of the test's choosing."""
    global _log
    _log = log
    _subscribers.clear()


def resolve_actor(claimed: str) -> str:
    """Who is making this request.

    There is no sign-in yet (sub-project #1), so the client's claim is taken
    at its word as long as it names someone in the directory. Anyone on the
    network can therefore act as anyone. Real authentication replaces this
    one function; nothing else here needs to change.
    """
    if claimed not in chat_log().users:
        raise HTTPException(status_code=403, detail=f"Unknown person: {claimed!r}")
    return claimed


# --------------------------------------------------------------------- stream

# One queue per open stream, with the user it belongs to: private ops go only
# to the queues of the person who made them.
_subscribers: dict[asyncio.Queue, str] = {}

# How long a quiet stream waits before sending a heartbeat. The client treats
# roughly two missed heartbeats as a dead connection (chat-server-log.ts).
HEARTBEAT_SECONDS = 20.0


def _publish(entry: dict) -> None:
    for queue, user in list(_subscribers.items()):
        if not ChatLog.visible_to(entry, user):
            continue
        try:
            queue.put_nowait(entry)
        except asyncio.QueueFull:
            # A stream that cannot keep up is dropped rather than allowed to
            # stall the others. The client reconnects with its last seq and
            # catches up from the log, so nothing is lost.
            _subscribers.pop(queue, None)


def _frame(entry: dict) -> str:
    return f"id: {entry['seq']}\nevent: op\ndata: {json.dumps(entry)}\n\n"


async def _frames(since: int, user: str, queue: asyncio.Queue):
    """The stream's content: the backlog after `since`, a ready marker, then
    each live op. `queue` must already be registered in `_subscribers`, so an
    op appended while the backlog is being sent waits in it and is not missed;
    anything the backlog already covered is skipped, so nothing is sent twice.
    """
    try:
        last = since
        for entry in chat_log().read(since, user):
            yield _frame(entry)
            last = entry["seq"]
        # Tells the client the backlog is complete: it can stop showing
        # "catching up" and trust what it has.
        yield f"event: ready\ndata: {json.dumps({'head': last})}\n\n"
        while True:
            try:
                entry = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                # A real event, not an SSE comment: EventSource hides comments
                # from the page, and the client needs to *see* that the stream
                # is alive. A connection can die without anyone saying so — a
                # proxy that keeps the browser's side open after the server is
                # gone, a phone changing networks — and silence past a few
                # heartbeats is how the client finds out. It also keeps idle
                # proxies from closing the connection.
                yield "event: ping\ndata: {}\n\n"
                continue
            if entry["seq"] <= last:
                continue
            last = entry["seq"]
            yield _frame(entry)
    finally:
        _subscribers.pop(queue, None)


@router.get("/events")
async def stream(since: int = Query(0, ge=0), user: str = Query(...)) -> StreamingResponse:
    """Ops after `since`, then each new op as it is appended."""
    resolve_actor(user)
    queue: asyncio.Queue = asyncio.Queue(maxsize=512)
    _subscribers[queue] = user
    return StreamingResponse(
        _frames(since, user, queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------- endpoints


@router.get("/log")
async def read_log(since: int = Query(0, ge=0), user: str = Query(...)) -> dict:
    resolve_actor(user)
    log = chat_log()
    ops = log.read(since, user)
    return {
        "base": log.base if since == 0 else None,
        "ops": ops,
        "head": ops[-1]["seq"] if ops else since,
    }


class Append(BaseModel):
    opId: str
    actor: str
    op: dict


@router.post("/ops")
async def append(body: Append) -> dict:
    actor = resolve_actor(body.actor)
    try:
        entry, duplicate = chat_log().append(body.opId, actor, body.op)
    except OpRejected as error:
        raise HTTPException(status_code=error.status, detail=str(error)) from error
    if not duplicate:
        _publish(entry)
    return {"seq": entry["seq"], "ts": entry["ts"], "duplicate": duplicate}


@router.post("/attachments", status_code=201)
async def upload(file: UploadFile = File(...)) -> dict:
    """Store an attachment so every member of the room can load it.

    Before the chat server, attachments stayed on the device that sent them;
    the message travelled, the photo did not.
    """
    data = await file.read(MAX_CHAT_ATTACHMENT_BYTES + 1)
    if len(data) > MAX_CHAT_ATTACHMENT_BYTES:
        raise HTTPException(status_code=413, detail="That file is larger than 15 MB.")
    # The name on disk is ours; the original name travels in the message.
    suffix = Path(file.filename or "").suffix.lower()[:10]
    name = f"{uuid.uuid4().hex}{suffix}"
    (CHAT_UPLOAD_DIR / name).write_bytes(data)
    return {
        "url": f"/uploads/chat/{name}",
        "name": file.filename or name,
        "type": file.content_type or "application/octet-stream",
        "size": len(data),
    }
