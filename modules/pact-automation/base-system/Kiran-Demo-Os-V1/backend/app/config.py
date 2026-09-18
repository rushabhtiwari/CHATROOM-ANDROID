"""Runtime configuration. Everything has a working default except the API key."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

SEED_FILE = BASE_DIR / "seed.json"
# Where the ledgers and uploads live. Overridable so the test suite can point them at a
# temporary directory: every store here calls `reset()` freely, and a suite that resets
# the real `data/mailing.json` wipes the demo's own order ledger - which it did.
DATA_DIR = Path(os.getenv("KIRANOS_DATA_DIR") or (BASE_DIR / "data")).resolve()
UPLOAD_DIR = Path(os.getenv("KIRANOS_UPLOAD_DIR") or (BASE_DIR / "uploads")).resolve()
SNAPSHOT_FILE = DATA_DIR / "state.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

PORT = int(os.getenv("RTS_PORT", "3001"))

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
EXTRACTION_MODEL = os.getenv("RTS_EXTRACTION_MODEL", "claude-haiku-4-5").strip()

OPENCLAW_API_URL = os.getenv("OPENCLAW_API_URL", "").strip()
OPENCLAW_API_KEY = os.getenv("OPENCLAW_API_KEY", "").strip()
OPENCLAW_MODEL = os.getenv("OPENCLAW_MODEL", "openclaw").strip()

PACT_AUTOMATION_URL = os.getenv("PACT_AUTOMATION_URL", "http://127.0.0.1:8765").strip()
PACT_AUTOMATION_TOKEN = os.getenv("PACT_AUTOMATION_TOKEN", "").strip()
PACT_AUTOMATION_TIMEOUT = float(os.getenv("PACT_AUTOMATION_TIMEOUT", "30"))

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
    key = (ANTHROPIC_API_KEY or "").strip()
    if not key or len(key) < 20:
        return False
    lowered = key.lower()
    if (
        lowered.endswith("...")
        or lowered.startswith("your-")
        or "placeholder" in lowered
        or lowered in ("none", "null", "false", "true", "test")
    ):
        return False
    return True


def has_openclaw() -> bool:
    return bool(OPENCLAW_API_URL)
