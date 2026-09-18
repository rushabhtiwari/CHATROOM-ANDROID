"""Whole-state reads, the live event stream, and demo controls."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from .. import events
from ..extraction import describe_backend
from ..store import store

router = APIRouter(tags=["state"])


@router.get("/state")
def get_state() -> dict:
    """The whole world in one call. What the app loads with on boot."""
    return store.snapshot()


@router.get("/health")
def health() -> dict:
    snapshot = store.snapshot()
    return {
        "ok": True,
        "version": snapshot["version"],
        "requests": len(snapshot["requests"]),
        "listeners": events.subscriber_count(),
        "extraction": describe_backend(),
    }


@router.post("/demo/reset")
def reset_demo() -> dict:
    """Puts every store back to seed so the demo can be run again."""
    return store.reset()


@router.get("/events")
async def stream_events() -> StreamingResponse:
    """Server-sent events: one `state` frame per mutation, from any tab.

    This is what makes the demo work. An employee files a claim in one window
    and HR's queue updates in another without a refresh.
    """
    queue = events.subscribe()

    async def generator():
        try:
            # Send the current state immediately so a reconnecting tab is
            # correct before the next mutation, not after it.
            import json

            yield f"event: state\ndata: {json.dumps(store.snapshot(), default=str)}\n\n"

            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield payload
                except asyncio.TimeoutError:
                    # Keeps proxies from closing an idle connection.
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            raise
        finally:
            events.unsubscribe(queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
