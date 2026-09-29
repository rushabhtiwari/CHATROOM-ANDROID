"""Calls: the signals between two phones, and the call list they leave behind."""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app import main
from app.chat_log import ChatLog
from app.config import CHAT_PROTOCOL_FILE, CHAT_SEED_FILE
from app.routers import calls, chat

SEED = json.loads(CHAT_SEED_FILE.read_text(encoding="utf-8"))
ALICE = SEED["users"][0]["id"]
BOB = SEED["users"][1]["id"]
CAROL = SEED["users"][2]["id"]


@pytest.fixture
def book(tmp_path):
    chat.use_log(ChatLog(tmp_path / "chat.db", CHAT_SEED_FILE, CHAT_PROTOCOL_FILE))
    calls.use_book(calls.CallBook(tmp_path / "calls.json"))
    yield calls.book()
    calls.use_book(None)
    chat.use_log(None)


@pytest.fixture
def client(book):
    with TestClient(main.app) as test_client:
        yield test_client


def listen(user: str, device: str) -> asyncio.Queue:
    """An open stream, as the router sees one."""
    queue: asyncio.Queue = asyncio.Queue()
    calls._streams[queue] = (user, device)
    return queue


def drain(queue: asyncio.Queue) -> list[tuple[str, dict]]:
    frames = []
    while not queue.empty():
        frames.append(_parse(queue.get_nowait()))
    return frames


def _parse(frame: str) -> tuple[str, dict]:
    kind = next(line[7:] for line in frame.splitlines() if line.startswith("event: "))
    data = next(line[6:] for line in frame.splitlines() if line.startswith("data: "))
    return kind, json.loads(data)


def signals(queue: asyncio.Queue) -> list[dict]:
    return [data for kind, data in drain(queue) if kind == "signal"]


def sig(kind: str, sender: str, to: str, **extra) -> dict:
    body = {"callId": "c1", "kind": kind, "from": sender, "fromDevice": f"{sender}-phone", "to": to}
    return {**body, **extra}


def invite(**extra) -> dict:
    return sig("invite", ALICE, BOB, media="video", roomId="dm-ab", **extra)


# ------------------------------------------------------------ a whole call


def test_a_call_from_invitation_to_hang_up(client):
    alice = listen(ALICE, f"{ALICE}-phone")
    bob_phone = listen(BOB, f"{BOB}-phone")
    bob_tablet = listen(BOB, f"{BOB}-tablet")

    placed = client.post("/api/calls/signal", json=invite())
    assert placed.status_code == 200
    # Both of Bob's devices ring.
    assert placed.json()["delivered"] == 2
    assert [s["kind"] for s in signals(bob_phone)] == ["invite"]
    assert [s["kind"] for s in signals(bob_tablet)] == ["invite"]

    ringing = sig("ringing", BOB, ALICE, toDevice=f"{ALICE}-phone")
    assert client.post("/api/calls/signal", json=ringing).status_code == 200
    assert [s["kind"] for s in signals(alice)] == ["ringing"]

    accepted = client.post(
        "/api/calls/signal", json=sig("accept", BOB, ALICE, toDevice=f"{ALICE}-phone")
    )
    assert accepted.json()["call"]["status"] == "active"
    assert [s["kind"] for s in signals(alice)] == ["accept"]
    # The tablet stops ringing; the phone that answered hears nothing about it.
    tablet = signals(bob_tablet)
    assert [(s["kind"], s["data"]["reason"]) for s in tablet] == [("cancel", "answered_elsewhere")]
    assert signals(bob_phone) == []

    # From here on, only the two devices on the call hear from each other.
    offer = sig("offer", ALICE, BOB, toDevice=f"{BOB}-phone", data={"sdp": "v=0 offer"})
    assert client.post("/api/calls/signal", json=offer).json()["delivered"] == 1
    assert [s["data"]["sdp"] for s in signals(bob_phone)] == ["v=0 offer"]
    assert signals(bob_tablet) == []

    answer = sig("answer", BOB, ALICE, toDevice=f"{ALICE}-phone", data={"sdp": "v=0 answer"})
    client.post("/api/calls/signal", json=answer)
    assert [s["data"]["sdp"] for s in signals(alice)] == ["v=0 answer"]

    ended = client.post(
        "/api/calls/signal", json=sig("hangup", BOB, ALICE, toDevice=f"{ALICE}-phone")
    ).json()["call"]
    assert (ended["status"], ended["outcome"]) == ("ended", "completed")
    assert ended["endedAt"] >= ended["answeredAt"] >= ended["startedAt"]

    for user in (ALICE, BOB):
        listed = client.get("/api/calls/history", params={"user": user}).json()["calls"]
        assert [(c["id"], c["from"], c["to"], c["media"]) for c in listed] == [
            ("c1", ALICE, BOB, "video")
        ]
        # The devices a call rang on are the server's business, not the list's.
        assert "fromDevice" not in listed[0] and "toDevice" not in listed[0]
    assert client.get("/api/calls/history", params={"user": CAROL}).json()["calls"] == []


def test_both_call_lists_change_as_the_call_does(client):
    alice = listen(ALICE, "a")
    bob = listen(BOB, "b")
    client.post("/api/calls/signal", json=invite())
    client.post("/api/calls/signal", json=sig("decline", BOB, ALICE))
    for queue in (alice, bob):
        updates = [data for kind, data in drain(queue) if kind == "call"]
        assert [(u["status"], u["outcome"]) for u in updates] == [
            ("ringing", None),
            ("ended", "declined"),
        ]


@pytest.mark.parametrize(
    "steps, outcome",
    [
        ([sig("decline", BOB, ALICE)], "declined"),
        ([sig("busy", BOB, ALICE)], "busy"),
        ([sig("cancel", ALICE, BOB)], "missed"),
        ([sig("hangup", ALICE, BOB)], "missed"),
        ([sig("hangup", BOB, ALICE)], "declined"),
        ([sig("accept", BOB, ALICE), sig("cancel", ALICE, BOB)], "completed"),
    ],
    ids=["declined", "busy", "cancelled", "caller hung up", "callee hung up", "answered as cancelled"],
)
def test_how_a_call_ends_is_what_the_list_says(client, steps, outcome):
    client.post("/api/calls/signal", json=invite())
    for step in steps:
        assert client.post("/api/calls/signal", json=step).status_code == 200
    listed = client.get("/api/calls/history", params={"user": BOB}).json()["calls"][0]
    assert (listed["status"], listed["outcome"]) == ("ended", outcome)
    assert (listed["answeredAt"] is not None) == (outcome == "completed")


# ------------------------------------------------------------------ refusals


@pytest.mark.parametrize(
    "body, status",
    [
        (sig("invite", "nobody", BOB, media="audio"), 403),
        (sig("invite", ALICE, "nobody", media="audio"), 403),
        (sig("invite", ALICE, ALICE, media="audio"), 400),
        (sig("invite", ALICE, BOB), 400),
        (sig("accept", BOB, ALICE), 404),
    ],
    ids=["unknown caller", "unknown callee", "calling yourself", "no media", "no such call"],
)
def test_refuses_what_is_not_a_call(client, body, status):
    assert client.post("/api/calls/signal", json=body).status_code == status


def test_only_the_two_people_on_a_call_can_signal_it(client):
    client.post("/api/calls/signal", json=invite())
    assert client.post("/api/calls/signal", json=invite()).status_code == 409
    assert client.post("/api/calls/signal", json=sig("accept", CAROL, ALICE)).status_code == 403
    # Only the one being called answers; only the caller cancels.
    assert client.post("/api/calls/signal", json=sig("accept", ALICE, BOB)).status_code == 400
    assert client.post("/api/calls/signal", json=sig("cancel", BOB, ALICE)).status_code == 400
    # Nothing flows on a call nobody has answered.
    offer = sig("offer", ALICE, BOB, data={"sdp": "v=0"})
    assert client.post("/api/calls/signal", json=offer).status_code == 409


def test_a_second_answer_and_anything_after_the_end_are_refused(client):
    client.post("/api/calls/signal", json=invite())
    assert client.post("/api/calls/signal", json=sig("accept", BOB, ALICE)).status_code == 200
    again = sig("accept", BOB, ALICE, fromDevice=f"{BOB}-tablet")
    assert client.post("/api/calls/signal", json=again).status_code == 409
    client.post("/api/calls/signal", json=sig("hangup", ALICE, BOB))
    late = client.post("/api/calls/signal", json=sig("ice", BOB, ALICE, data={"candidate": {}}))
    assert late.status_code == 410


# --------------------------------------------------- rings that nobody hears


def test_an_invitation_rings_a_phone_that_connects_while_it_is_ringing(book):
    calls.book().apply(calls.Signal.model_validate(invite()), calls.now_ms())

    async def connect():
        queue = listen(BOB, "late-phone")
        frames = calls._frames(BOB, "late-phone", queue)
        first = _parse(await frames.__anext__())
        second = _parse(await frames.__anext__())
        await frames.aclose()
        return first, second

    ready, ring = asyncio.run(connect())
    assert ready == ("ready", {"iceServers": calls.CALL_ICE_SERVERS})
    assert ring[0] == "signal"
    assert (ring[1]["kind"], ring[1]["callId"], ring[1]["from"]) == ("invite", "c1", ALICE)
    assert ring[1]["media"] == "video" and ring[1]["fromDevice"] == f"{ALICE}-phone"


def test_a_call_that_rings_out_is_missed_and_both_phones_stop(book):
    now = calls.now_ms()
    book.apply(calls.Signal.model_validate(invite()), now - 60_000)
    alice = listen(ALICE, f"{ALICE}-phone")
    alice_laptop = listen(ALICE, f"{ALICE}-laptop")
    bob = listen(BOB, f"{BOB}-phone")

    calls._sweep(now)

    record = book.records["c1"]
    assert (record["status"], record["outcome"]) == ("ended", "missed")
    assert record["endedAt"] == record["startedAt"] + int(calls.RING_SECONDS * 1000)
    assert [(s["kind"], s["data"]["reason"]) for s in signals(bob)] == [("cancel", "timeout")]
    # Only the phone that placed the call was ringing out.
    assert [(s["kind"], s["to"]) for s in signals(alice)] == [("cancel", ALICE)]
    assert signals(alice_laptop) == []
    # And a phone that connects now does not ring for it.
    assert book.ringing_for(BOB) == []


def test_a_call_both_phones_went_silent_on_is_ended(book):
    now = calls.now_ms()
    book.apply(calls.Signal.model_validate(invite()), now - 600_000)
    book.apply(calls.Signal.model_validate(sig("accept", BOB, ALICE)), now - 590_000)
    calls._sweep(now)
    record = book.records["c1"]
    assert (record["status"], record["outcome"]) == ("ended", "completed")
    assert record["endedAt"] == now - 590_000


def test_keeping_in_touch_keeps_a_long_call_open(book):
    now = calls.now_ms()
    book.apply(calls.Signal.model_validate(invite()), now - 600_000)
    book.apply(calls.Signal.model_validate(sig("accept", BOB, ALICE)), now - 590_000)
    state = sig("state", ALICE, BOB, data={"muted": False, "cameraOn": True})
    book.apply(calls.Signal.model_validate(state), now - 20_000)
    calls._sweep(now)
    assert book.records["c1"]["status"] == "active"


# ---------------------------------------------------------------- the disk


def test_the_list_survives_a_restart_and_open_calls_are_closed(tmp_path):
    path = tmp_path / "calls.json"
    first = calls.CallBook(path)
    now = calls.now_ms()
    first.apply(calls.Signal.model_validate(invite()), now - 5_000)
    first.apply(calls.Signal.model_validate(sig("accept", BOB, ALICE)), now - 4_000)
    ringing = invite(callId="c2")
    first.apply(calls.Signal.model_validate(ringing), now - 1_000)
    first.save()

    reopened = calls.CallBook(path)
    one, two = reopened.records["c1"], reopened.records["c2"]
    assert (one["status"], one["outcome"], one["endedAt"]) == ("ended", "completed", now - 4_000)
    assert (two["status"], two["outcome"]) == ("ended", "missed")


def test_only_the_newest_calls_are_kept(tmp_path, monkeypatch):
    monkeypatch.setattr(calls, "KEEP_RECORDS", 3)
    kept = calls.CallBook(tmp_path / "calls.json")
    for index in range(5):
        kept.apply(calls.Signal.model_validate(invite(callId=f"c{index}")), 1_000 + index)
    kept.save()
    assert list(calls.CallBook(tmp_path / "calls.json").records) == ["c2", "c3", "c4"]


def test_an_unreadable_file_starts_an_empty_list(tmp_path):
    path = tmp_path / "calls.json"
    path.write_text("{not json", encoding="utf-8")
    assert calls.CallBook(path).records == {}


# -------------------------------------------------------------- the stream


def test_an_idle_stream_sends_a_heartbeat_the_app_can_see(book, monkeypatch):
    monkeypatch.setattr(calls, "HEARTBEAT_SECONDS", 0.05)

    async def scenario():
        queue = listen(BOB, "phone")
        frames = calls._frames(BOB, "phone", queue)
        ready = _parse(await frames.__anext__())
        idle = _parse(await asyncio.wait_for(frames.__anext__(), 1))
        await frames.aclose()
        return ready, idle, queue in calls._streams

    ready, idle, still_listed = asyncio.run(scenario())
    assert ready[0] == "ready" and idle[0] == "ping"
    # A closed stream is forgotten.
    assert not still_listed


def test_the_stream_refuses_someone_not_in_the_directory(client):
    assert client.get("/api/calls/events", params={"user": "nobody", "device": "x"}).status_code == 403
    assert client.get("/api/calls/history", params={"user": "nobody"}).status_code == 403


def test_the_default_ice_servers_are_a_stun_server():
    assert calls.CALL_ICE_SERVERS and all("urls" in server for server in calls.CALL_ICE_SERVERS)


def test_a_malformed_ice_setting_falls_back_to_the_default():
    from app.config import _ice_servers

    assert _ice_servers("") == [{"urls": "stun:stun.l.google.com:19302"}]
    assert _ice_servers("{oops") == [{"urls": "stun:stun.l.google.com:19302"}]
    turn = [{"urls": "turn:turn.example.com:3478", "username": "u", "credential": "p"}]
    assert _ice_servers(json.dumps(turn)) == turn
