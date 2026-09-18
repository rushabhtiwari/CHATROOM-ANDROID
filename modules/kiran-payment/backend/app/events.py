"""A tiny SSE fan-out.

Every mutation publishes the whole application state. The dataset is small
(tens of records), so pushing a full snapshot removes an entire class of
client-side merge bugs: a browser tab can never drift, it can only be current.
That is what makes three windows update together during the demo.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

# One queue per connected browser tab.
_subscribers: set[asyncio.Queue] = set()
_loop: asyncio.AbstractEventLoop | None = None


def bind_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Remembers the server loop so sync code can publish safely."""
    global _loop
    _loop = loop


def subscribe() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    _subscribers.add(queue)
    return queue


def unsubscribe(queue: asyncio.Queue) -> None:
    _subscribers.discard(queue)


def subscriber_count() -> int:
    return len(_subscribers)


def _deliver(payload: str) -> None:
    for queue in list(_subscribers):
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            # A tab that cannot keep up is dropped rather than allowed to
            # stall every other tab. It reconnects and refetches.
            unsubscribe(queue)


def publish(event: str, data: Any) -> None:
    """Broadcasts an SSE frame. Safe to call from sync request handlers."""
    payload = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"

    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None

    if running is not None:
        _deliver(payload)
    elif _loop is not None:
        _loop.call_soon_threadsafe(_deliver, payload)
