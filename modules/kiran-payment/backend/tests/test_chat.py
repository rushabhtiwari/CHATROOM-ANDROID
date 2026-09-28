"""The chat server: the log, its rules, and the HTTP surface over it."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.chat_log import ChatLog, OpRejected
from app.config import CHAT_PROTOCOL_FILE, CHAT_SEED_FILE
from app.routers import chat

SEED = json.loads(CHAT_SEED_FILE.read_text(encoding="utf-8"))
ALICE = SEED["users"][0]["id"]
BOB = SEED["users"][1]["id"]
ROOM = SEED["rooms"][0]["id"]


def new_log(tmp_path: Path) -> ChatLog:
    return ChatLog(tmp_path / "chat.db", CHAT_SEED_FILE, CHAT_PROTOCOL_FILE)


def send(text: str = "hello", room: str = ROOM) -> dict:
    return {"type": "message.send", "roomId": room, "message": {"id": f"m-{text}", "content": text}}


# ------------------------------------------------------------------- the log


def test_base_is_the_seed_with_times_moved_to_first_start(tmp_path):
    log = new_log(tmp_path)
    assert len(log.base["rooms"]) == len(SEED["rooms"])
    assert len(log.base["messages"]) == len(SEED["messages"])
    # The seed was exported at some point in the past; its newest message
    # should now sit close to the present, not at the export date.
    newest = max(message["timestamp"] for message in log.base["messages"])
    newest_in_seed = max(message["timestamp"] for message in SEED["messages"])
    assert abs(newest - (newest_in_seed + (time.time() * 1000 - SEED["exportedAt"]))) < 5_000


def test_base_is_shifted_once_and_then_kept(tmp_path):
    first = new_log(tmp_path).base
    time.sleep(0.02)
    again = new_log(tmp_path).base
    assert again == first


def test_append_gives_each_op_the_next_place_in_order(tmp_path):
    log = new_log(tmp_path)
    one, _ = log.append("op-1", ALICE, send("one"))
    two, _ = log.append("op-2", BOB, send("two"))
    assert (one["seq"], two["seq"]) == (1, 2)
    assert two["ts"] >= one["ts"]
    assert [entry["opId"] for entry in log.read(0, ALICE)] == ["op-1", "op-2"]
    assert [entry["opId"] for entry in log.read(1, ALICE)] == ["op-2"]
    assert log.head() == 2


def test_a_retried_op_is_stored_once(tmp_path):
    # A client whose request timed out cannot know whether it landed, so it
    # sends again with the same opId. The log must not grow a second copy.
    log = new_log(tmp_path)
    first, duplicate_first = log.append("op-1", ALICE, send("once"))
    again, duplicate_again = log.append("op-1", ALICE, send("once"))
    assert (duplicate_first, duplicate_again) == (False, True)
    assert again["seq"] == first["seq"]
    assert len(log.read(0, ALICE)) == 1


def test_private_ops_reach_only_their_author(tmp_path):
    log = new_log(tmp_path)
    log.append("op-1", ALICE, {"type": "saved.set", "messageId": "m1", "on": True})
    log.append("op-2", ALICE, send("public"))
    assert [e["opId"] for e in log.read(0, ALICE)] == ["op-1", "op-2"]
    assert [e["opId"] for e in log.read(0, BOB)] == ["op-2"]


@pytest.mark.parametrize(
    "actor, op, status",
    [
        (ALICE, {"type": "message.explode", "roomId": ROOM}, 400),
        ("nobody", send(), 403),
        (ALICE, send(room="no-such-room"), 400),
        (ALICE, {"type": "room.create"}, 400),
        (ALICE, {"type": "room.create", "roomId": ROOM, "room": {"id": ROOM}}, 409),
    ],
    ids=["unknown op", "unknown person", "unknown room", "room without id", "room exists"],
)
def test_rejects_what_it_cannot_order(tmp_path, actor, op, status):
    log = new_log(tmp_path)
    with pytest.raises(OpRejected) as caught:
        log.append("op-x", actor, op)
    assert caught.value.status == status
    assert log.read(0, ALICE) == []


def test_a_created_room_can_be_used_and_is_remembered(tmp_path):
    log = new_log(tmp_path)
    log.append("op-1", ALICE, {"type": "room.create", "roomId": "r-new", "room": {"id": "r-new"}})
    log.append("op-2", ALICE, send("first", room="r-new"))
    # A restart rebuilds the set of rooms from the log.
    reopened = new_log(tmp_path)
    reopened.append("op-3", BOB, send("second", room="r-new"))
    assert reopened.head() == 3


# ----------------------------------------------------------------- over HTTP


@pytest.fixture
def client(tmp_path):
    chat.use_log(new_log(tmp_path))
    with TestClient(main.app) as test_client:
        yield test_client
    chat.use_log(None)


def test_http_round_trip(client):
    posted = client.post("/api/chat/ops", json={"opId": "op-1", "actor": ALICE, "op": send()})
    assert posted.status_code == 200
    assert posted.json()["duplicate"] is False

    log = client.get("/api/chat/log", params={"since": 0, "user": BOB}).json()
    assert log["base"]["rooms"]
    assert [entry["opId"] for entry in log["ops"]] == ["op-1"]
    assert log["head"] == 1

    later = client.get("/api/chat/log", params={"since": 1, "user": BOB}).json()
    assert later["base"] is None
    assert later["ops"] == []
    assert later["head"] == 1


def test_http_replay_reports_duplicate(client):
    body = {"opId": "op-1", "actor": ALICE, "op": send()}
    client.post("/api/chat/ops", json=body)
    again = client.post("/api/chat/ops", json=body).json()
    assert again["duplicate"] is True and again["seq"] == 1


def test_http_rejections_carry_their_status(client):
    unknown_person = client.post("/api/chat/ops", json={"opId": "o", "actor": "nobody", "op": send()})
    assert unknown_person.status_code == 403
    bad_op = client.post(
        "/api/chat/ops", json={"opId": "o", "actor": ALICE, "op": {"type": "nope"}}
    )
    assert bad_op.status_code == 400
    assert client.get("/api/chat/log", params={"user": "nobody"}).status_code == 403


def test_attachment_upload_is_served_back(client):
    uploaded = client.post(
        "/api/chat/attachments",
        files={"file": ("site photo.png", b"\x89PNG-bytes", "image/png")},
    )
    assert uploaded.status_code == 201
    body = uploaded.json()
    assert body["url"].startswith("/uploads/chat/") and body["url"].endswith(".png")
    assert (body["name"], body["type"], body["size"]) == ("site photo.png", "image/png", 10)
    try:
        assert client.get(body["url"]).content == b"\x89PNG-bytes"
    finally:
        # Served from the real uploads folder; do not leave test files there.
        (chat.CHAT_UPLOAD_DIR / body["url"].rsplit("/", 1)[1]).unlink(missing_ok=True)


def test_attachment_over_the_limit_is_refused(client, monkeypatch):
    monkeypatch.setattr(chat, "MAX_CHAT_ATTACHMENT_BYTES", 8)
    refused = client.post(
        "/api/chat/attachments", files={"file": ("big.bin", b"123456789", "application/x")}
    )
    assert refused.status_code == 413


# -------------------------------------------------------------- the stream


def test_live_ops_reach_every_stream_that_may_see_them(tmp_path):
    chat.use_log(new_log(tmp_path))
    try:
        alice: asyncio.Queue = asyncio.Queue()
        bob: asyncio.Queue = asyncio.Queue()
        chat._subscribers[alice] = ALICE
        chat._subscribers[bob] = BOB

        public, _ = chat.chat_log().append("op-1", ALICE, send())
        private, _ = chat.chat_log().append(
            "op-2", ALICE, {"type": "thread.follow", "rootId": "m1", "on": True}
        )
        chat._publish(public)
        chat._publish(private)

        assert [alice.get_nowait()["opId"], alice.get_nowait()["opId"]] == ["op-1", "op-2"]
        assert bob.get_nowait()["opId"] == "op-1"
        assert bob.empty()
    finally:
        chat.use_log(None)


def test_a_stream_that_cannot_keep_up_is_dropped_not_blocking(tmp_path):
    chat.use_log(new_log(tmp_path))
    try:
        slow: asyncio.Queue = asyncio.Queue(maxsize=1)
        fast: asyncio.Queue = asyncio.Queue()
        chat._subscribers[slow] = BOB
        chat._subscribers[fast] = BOB
        for index in range(3):
            entry, _ = chat.chat_log().append(f"op-{index}", ALICE, send(str(index)))
            chat._publish(entry)
        assert slow not in chat._subscribers
        assert fast.qsize() == 3
    finally:
        chat.use_log(None)


def _parse(frame: str) -> tuple[str, dict]:
    kind = next(line[7:] for line in frame.splitlines() if line.startswith("event: "))
    data = next(line[6:] for line in frame.splitlines() if line.startswith("data: "))
    return kind, json.loads(data)


def test_stream_sends_the_backlog_then_live_ops_once_each(tmp_path):
    """Backlog, a ready marker, then live ops — with an op that lands during
    the backlog delivered exactly once, and a private op withheld."""

    async def scenario():
        chat.use_log(new_log(tmp_path))
        log = chat.chat_log()
        for index in range(3):
            log.append(f"op-{index}", ALICE, send(str(index)))
        log.append("op-private", ALICE, {"type": "saved.set", "messageId": "m", "on": True})

        queue: asyncio.Queue = asyncio.Queue()
        chat._subscribers[queue] = BOB
        # Lands after the stream subscribed but before it reads the backlog:
        # it is both in the backlog and waiting in the queue.
        early, _ = log.append("op-early", ALICE, send("early"))
        chat._publish(early)
        frames = chat._frames(1, BOB, queue)

        received = [_parse(await frames.__anext__())]  # op-1 (seq 2)
        # An op lands while the backlog is still being sent: it is published
        # to the queue *and* will not be in the backlog already read.
        entry, _ = log.append("op-during", ALICE, send("during"))
        chat._publish(entry)
        while received[-1][0] != "ready":
            received.append(_parse(await frames.__anext__()))
        received.append(_parse(await asyncio.wait_for(frames.__anext__(), 1)))
        await frames.aclose()
        return received

    try:
        received = asyncio.run(scenario())
    finally:
        chat.use_log(None)

    labels = [(kind, data.get("opId")) for kind, data in received]
    # The backlog is read in one query when the stream starts; "op-during"
    # arrives after it, through the queue, exactly once.
    assert labels == [
        ("op", "op-1"),
        ("op", "op-2"),
        ("op", "op-early"),
        ("ready", None),
        ("op", "op-during"),
    ]
    assert labels.count(("op", "op-early")) == 1
    assert ("op", "op-private") not in labels


def test_an_idle_stream_sends_a_heartbeat_the_client_can_see(tmp_path, monkeypatch):
    """A keep-alive comment is invisible to EventSource; a client watching for
    a dead connection needs an event it can actually observe."""
    monkeypatch.setattr(chat, "HEARTBEAT_SECONDS", 0.05)

    async def scenario():
        chat.use_log(new_log(tmp_path))
        queue: asyncio.Queue = asyncio.Queue()
        chat._subscribers[queue] = BOB
        frames = chat._frames(0, BOB, queue)
        ready = _parse(await frames.__anext__())
        idle = _parse(await asyncio.wait_for(frames.__anext__(), 1))
        await frames.aclose()
        return ready, idle

    try:
        ready, idle = asyncio.run(scenario())
    finally:
        chat.use_log(None)
    assert ready[0] == "ready"
    assert idle[0] == "ping"
