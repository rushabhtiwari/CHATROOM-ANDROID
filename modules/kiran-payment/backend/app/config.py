"""Runtime configuration. Everything has a working default except the API key."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

SEED_FILE = BASE_DIR / "seed.json"
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
SNAPSHOT_FILE = DATA_DIR / "state.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# The chat server. The seed and protocol are generated from the console's
# TypeScript by tools/export-chat-seed.mjs; the log itself is runtime data.
CHAT_SEED_FILE = BASE_DIR / "chat_seed.json"
CHAT_PROTOCOL_FILE = BASE_DIR / "chat_protocol.json"
CHAT_DB_FILE = DATA_DIR / "chat.db"
CHAT_UPLOAD_DIR = UPLOAD_DIR / "chat"
CHAT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
# Matches the console's own ceiling on a single attachment.
MAX_CHAT_ATTACHMENT_BYTES = 15_000_000

PORT = int(os.getenv("RTS_PORT", "3001"))

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
EXTRACTION_MODEL = os.getenv("RTS_EXTRACTION_MODEL", "claude-haiku-4-5").strip()

ENFORCE_BUDGET = os.getenv("RTS_ENFORCE_BUDGET", "false").lower() in ("1", "true", "yes")

# Files the extractor will read. Anything else is stored but not sent to the model.
IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
PDF_TYPES = {".pdf": "application/pdf"}

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB, matching the dropzone's own hint

# ---------------------------------------------------------------------------
# Google Meet & Calendar
#
# All optional. With no credentials the meeting endpoints still answer, with a
# clearly-marked demo link and a Calendar "add event" URL that genuinely works
# in the presenter's own browser. Nothing about the flow changes shape when the
# real credentials arrive — only the link does.
# ---------------------------------------------------------------------------

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_CALENDAR_REFRESH_TOKEN = (
    os.getenv("GOOGLE_CALENDAR_REFRESH_TOKEN") or os.getenv("GOOGLE_REFRESH_TOKEN") or ""
).strip()
GOOGLE_MEET_REFRESH_TOKEN = (
    os.getenv("GOOGLE_MEET_REFRESH_TOKEN") or os.getenv("GOOGLE_REFRESH_TOKEN") or ""
).strip()

CALENDAR_FILE = DATA_DIR / "calendar.json"

# The company runs on IST; every meeting defaults to it unless the client says
# otherwise.
DEFAULT_TIME_ZONE = os.getenv("RTS_TIME_ZONE", "Asia/Kolkata").strip()


def google_configured(kind: str = "calendar") -> bool:
    token = GOOGLE_CALENDAR_REFRESH_TOKEN if kind == "calendar" else GOOGLE_MEET_REFRESH_TOKEN
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and token)


def has_api_key() -> bool:
    return bool(ANTHROPIC_API_KEY)
