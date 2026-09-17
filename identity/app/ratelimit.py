"""Per-instance fixed-window rate limiting keyed by client IP."""

import threading
import time
from collections.abc import Callable

from fastapi import HTTPException, Request


class FixedWindowLimiter:
    def __init__(
        self, limit: int, window_seconds: int, clock: Callable[[], float] = time.monotonic
    ):
        self.limit = limit
        self.window_seconds = window_seconds
        self.clock = clock
        self._windows: dict[str, tuple[int, int]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        window = int(self.clock() // self.window_seconds)
        with self._lock:
            current_window, count = self._windows.get(key, (window, 0))
            if current_window != window:
                count = 0
                if len(self._windows) > 10_000:
                    self._windows.clear()
            if count >= self.limit:
                self._windows[key] = (window, count)
                return False
            self._windows[key] = (window, count + 1)
            return True


def rate_limit(limit: int, window_seconds: int = 60) -> Callable[[Request], None]:
    limiter = FixedWindowLimiter(limit, window_seconds)

    def dependency(request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        if not limiter.allow(key):
            raise HTTPException(
                429, "Too many requests", headers={"Retry-After": str(window_seconds)}
            )

    return dependency
