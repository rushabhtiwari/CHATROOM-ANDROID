"""KiranOS backend.

Serves the console's data contract under /api, streams live updates over SSE,
stores uploaded receipts under /uploads, and reads those receipts with Claude.

Four concerns share this process because they share a key, a store and a
lifetime: reimbursement claims and their payouts, the in-conversation
assistant, Google Meet and Calendar, and the console's own calendar.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import events
from .config import UPLOAD_DIR
from .routers import agent, calendar, meet, notifications, payouts, receipts, requests, state


@asynccontextmanager
async def lifespan(app: FastAPI):
    events.bind_loop(asyncio.get_running_loop())
    yield


app = FastAPI(
    title="KiranOS API",
    version="1.0.0",
    description="Backend for the KiranOS operations console.",
    lifespan=lifespan,
)

# The Vite dev server proxies /api, so same-origin is the normal path. CORS is
# here so the API also works when a tab is opened straight against :3001.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(state.router, prefix="/api")
app.include_router(requests.router, prefix="/api")
app.include_router(payouts.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(receipts.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(meet.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")

# Uploaded receipts, so thumbnails and the lightbox show the real document.
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
def root() -> dict:
    return {
        "service": "KiranOS API",
        "docs": "/docs",
        "state": "/api/state",
        "events": "/api/events",
    }
