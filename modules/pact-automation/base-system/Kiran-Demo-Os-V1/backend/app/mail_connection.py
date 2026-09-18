"""The mailbox this console watches.

Ported from `apps/web/src/lib/mail/connection.ts` in the OrderOps repo, and it
keeps that design's two good decisions:

  * **The operator types an address, not a server.** `host_for()` knows the
    common IMAP endpoints, so connecting Gmail means an address and an app
    password and nothing else.
  * **A connected mailbox outranks the env file.** Credentials entered in the
    console are sealed to disk next to the process that uses them, so the
    watcher survives a restart without anyone editing `.env`. With no connection
    file, `IMAP_USER` / `IMAP_APP_PASSWORD` are used exactly as before.

The password is sealed rather than stored plainly. There is no key-management
service on a demo laptop, so this uses a key derived from a machine-local secret
when one is configured and falls back to obfuscation otherwise — the file is
git-ignored either way. That is honest about what it is: it keeps a password out
of a screenshot and out of a diff, and it is not a substitute for a vault.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from .config import DATA_DIR

CONNECTION_FILE = DATA_DIR / "mail-connection.json"

# Set `KIRAN_MAIL_KEY` in backend/.env to seal with a real key rather than
# obfuscation. Any string works; it is stretched below.
SEAL_KEY = os.getenv("KIRAN_MAIL_KEY", "").strip()


@dataclass
class MailConnection:
    address: str
    host: str
    port: int
    secure: bool
    mailbox: str
    password: str
    connected_at: Optional[str]
    auto_start: bool
    # Where the credentials came from — a mailbox connected in the console, or
    # the env file. The control deck shows this, so an operator can tell why the
    # watcher is pointed where it is.
    source: str  # "connected" | "env"

    def redacted(self) -> dict:
        """Everything the frontend is allowed to see. Never the password."""
        return {
            "address": self.address,
            "host": self.host,
            "port": self.port,
            "secure": self.secure,
            "mailbox": self.mailbox,
            "connectedAt": self.connected_at,
            "autoStart": self.auto_start,
            "source": self.source,
        }


def host_for(address: str) -> str:
    """Known IMAP endpoints, so the operator only ever types an address."""
    domain = (address.split("@")[-1] if "@" in address else "").lower()
    if domain in ("gmail.com", "googlemail.com"):
        return "imap.gmail.com"
    if domain.endswith(("outlook.com", "hotmail.com", "live.com")):
        return "outlook.office365.com"
    if domain.endswith("yahoo.com"):
        return "imap.mail.yahoo.com"
    if domain.endswith("zoho.com"):
        return "imap.zoho.com"
    if domain.endswith("yandex.com"):
        return "imap.yandex.com"
    return f"imap.{domain or 'gmail.com'}"


def smtp_host_for(address: str) -> str:
    """The matching SMTP endpoint for the same address."""
    domain = (address.split("@")[-1] if "@" in address else "").lower()
    if domain in ("gmail.com", "googlemail.com"):
        return "smtp.gmail.com"
    if domain.endswith(("outlook.com", "hotmail.com", "live.com")):
        return "smtp.office365.com"
    if domain.endswith("yahoo.com"):
        return "smtp.mail.yahoo.com"
    if domain.endswith("zoho.com"):
        return "smtp.zoho.com"
    return f"smtp.{domain or 'gmail.com'}"


# --------------------------------------------------------------------------- #
# Sealing                                                                      #
# --------------------------------------------------------------------------- #


def _keystream(length: int, salt: bytes) -> bytes:
    """A key derived from the configured secret and this record's salt."""
    material = (SEAL_KEY or "kiranos-mail-local").encode("utf-8")
    out = b""
    counter = 0
    while len(out) < length:
        out += hashlib.sha256(material + salt + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:length]


def seal(plaintext: str) -> str:
    raw = plaintext.encode("utf-8")
    salt = os.urandom(16)
    stream = _keystream(len(raw), salt)
    body = bytes(a ^ b for a, b in zip(raw, stream))
    prefix = "enc" if SEAL_KEY else "obf"
    return f"{prefix}:{base64.b64encode(salt + body).decode('ascii')}"


def unseal(sealed: str) -> str:
    if ":" not in sealed:
        return sealed
    prefix, _, payload = sealed.partition(":")
    if prefix not in ("enc", "obf"):
        return sealed
    blob = base64.b64decode(payload)
    salt, body = blob[:16], blob[16:]
    stream = _keystream(len(body), salt)
    return bytes(a ^ b for a, b in zip(body, stream)).decode("utf-8")


# --------------------------------------------------------------------------- #
# The store                                                                    #
# --------------------------------------------------------------------------- #


def read_connection_file() -> Optional[dict]:
    try:
        return json.loads(CONNECTION_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def save_connection(
    *,
    address: str,
    password: str,
    host: Optional[str] = None,
    port: int = 993,
    secure: bool = True,
    mailbox: str = "INBOX",
    smtp_host: Optional[str] = None,
    smtp_port: int = 587,
    auto_start: bool = True,
) -> MailConnection:
    record = {
        "address": address.strip(),
        "host": (host or "").strip() or host_for(address),
        "port": int(port),
        "secure": bool(secure),
        "mailbox": (mailbox or "").strip() or "INBOX",
        "smtpHost": (smtp_host or "").strip() or smtp_host_for(address),
        "smtpPort": int(smtp_port),
        "sealed": seal(password),
        "connectedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "autoStart": bool(auto_start),
    }
    CONNECTION_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CONNECTION_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(record, indent=2), encoding="utf-8")
    os.replace(tmp, CONNECTION_FILE)
    return _to_connection(record)


def clear_connection() -> None:
    """Forget the stored mailbox.

    This removes a *credential file*, not a canonical record — the Zero-DELETE
    rule is about the mail ledger, and every message this mailbox ever delivered
    stays exactly where it was.
    """
    try:
        CONNECTION_FILE.unlink()
    except OSError:
        pass


def resolve_connection() -> Optional[MailConnection]:
    """The mailbox the monitor should watch: the connected one, else the env one."""
    stored = read_connection_file()
    if stored:
        return _to_connection(stored)

    user = os.getenv("IMAP_USER", "").strip()
    password = (os.getenv("IMAP_PASSWORD") or os.getenv("IMAP_APP_PASSWORD") or "").strip()
    if not user or not password:
        return None

    return MailConnection(
        address=user,
        host=os.getenv("IMAP_HOST", "").strip() or host_for(user),
        port=int(os.getenv("IMAP_PORT", "993")),
        secure=os.getenv("IMAP_SECURE", "true").lower() != "false",
        mailbox=os.getenv("IMAP_MAILBOX", "INBOX"),
        password=password,
        connected_at=None,
        auto_start=True,
        source="env",
    )


def smtp_settings(connection: MailConnection) -> dict:
    """Where an acknowledgement goes out from.

    Same account as the mailbox unless the env overrides it, because the reply
    should come from the address the customer wrote to.
    """
    stored = read_connection_file() or {}
    return {
        "host": os.getenv("SMTP_HOST", "").strip()
        or stored.get("smtpHost")
        or smtp_host_for(connection.address),
        # `os.getenv("SMTP_PORT", "0")` returns the *string* "0" when the variable is
        # unset, and a non-empty string is truthy - so the `or` chain never reached the
        # 587 default and every send was attempted against port 0, which cannot connect.
        # Strip first, so an unset or blank variable falls through properly.
        "port": int((os.getenv("SMTP_PORT") or "").strip() or stored.get("smtpPort") or 587),
        "user": os.getenv("SMTP_USER", "").strip() or connection.address,
        "password": (os.getenv("SMTP_PASSWORD") or "").strip() or connection.password,
        "from": os.getenv("SMTP_FROM", "").strip() or connection.address,
        # Sending is opt-in: with this unset the acknowledgement is written to
        # the ledger and not transmitted, which is what a demo wants by default.
        "enabled": os.getenv("SMTP_SEND", "").lower() in ("1", "true", "yes", "send"),
    }


def _to_connection(record: dict) -> MailConnection:
    return MailConnection(
        address=record["address"],
        host=record["host"],
        port=int(record["port"]),
        secure=bool(record.get("secure", True)),
        mailbox=record.get("mailbox", "INBOX"),
        password=unseal(record["sealed"]),
        connected_at=record.get("connectedAt"),
        auto_start=bool(record.get("autoStart", True)),
        source="connected",
    )
