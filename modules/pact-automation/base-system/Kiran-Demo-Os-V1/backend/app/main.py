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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import events, mail_monitor
from .config import BASE_DIR, UPLOAD_DIR
from .routers import (
    agent,
    calendar,
    mailing,
    meet,
    notifications,
    pipeline,
    pact,
    payouts,
    receipts,
    requests,
    state,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    events.bind_loop(asyncio.get_running_loop())
    # The mailbox watcher. Idles when no mailbox is connected, so this is free
    # on a demo machine and live the moment credentials are entered.
    mail_monitor.start()
    try:
        yield
    finally:
        await mail_monitor.stop()


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
app.include_router(pact.router, prefix="/api")
app.include_router(meet.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
# The Mailing Hub. Mounted at the spec's own path, so /api/admin/mailing/* is
# exactly what WORKING.md §5 tabulates.
app.include_router(mailing.router, prefix="/api")
# The PO pipeline's own view, and the Accounts release into PACT. Internal only - the
# customer-facing confirmation link this replaced no longer exists.
app.include_router(pipeline.router, prefix="/api")
# Uploaded receipts, so thumbnails and the lightbox show the real document.
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# --------------------------------------------------------------------------- #
# The console, served by this process when it has been built                    #
# --------------------------------------------------------------------------- #
#
# Normally the console is served by Vite on :5173 and proxies /api here. That needs a
# second, much larger process, and on a machine under memory pressure it is the first
# thing Windows kills - it took the console down three times in one demo session at
# ~300 MB free, while this process survived every one of them.
#
# So if `master-frontend/varun/dist` exists, this process serves it too: no node, no
# proxy, one origin, and the console cannot be killed without the API going with it.
# Nothing changes when the bundle is absent - the JSON descriptor below is still the
# root, and the Vite dev server is still the right thing to use while editing.
#
#     cd master-frontend\varun && npm run build      # then open http://localhost:3001
#
CONSOLE_DIR = BASE_DIR.parent / "master-frontend" / "varun" / "dist"
CONSOLE_INDEX = CONSOLE_DIR / "index.html"
CONSOLE_BUILT = CONSOLE_INDEX.is_file()

API_ROOT = {
    "service": "KiranOS API",
    "docs": "/docs",
    "state": "/api/state",
    "events": "/api/events",
}


@app.get("/api")
def api_root() -> dict:
    """The API's own descriptor, always here whether or not the console is built.

    `/` is a nicety that changes with the build; this does not, so anything that wants to
    ask "is the API up and what does it serve" has one answer it can rely on.
    """
    return API_ROOT


@app.get("/")
def root():
    """The console when it is built, the API descriptor when it is not."""
    if CONSOLE_BUILT:
        return FileResponse(CONSOLE_INDEX)
    return API_ROOT


if CONSOLE_BUILT:
    app.mount(
        "/assets", StaticFiles(directory=CONSOLE_DIR / "assets"), name="console-assets"
    )

    # Registered last, so every route above still wins. A single-page app owns its own
    # routing: /admin/automation/orders is not a file, and answering 404 for it would
    # break every deep link and every refresh.
    @app.get("/{path:path}")
    def console(path: str):
        if path.startswith(("api/", "uploads/", "docs", "openapi.json")):
            # Not the console's to answer. Let it 404 as an API path rather than
            # handing back index.html, which would turn a typo into a blank page.
            raise HTTPException(status_code=404, detail=f"No such path: /{path}")
        candidate = CONSOLE_DIR / path
        if path and candidate.is_file() and CONSOLE_DIR in candidate.resolve().parents:
            return FileResponse(candidate)
        return FileResponse(CONSOLE_INDEX)
