"""Sending outbound mail.

Named for the acknowledgement because that is all it once sent; it now carries every
message the PO pipeline produces (the receipt, the internal notification, the customer's
confirmation invitation and the demo proforma). The behaviour below is unchanged for all
of them, which is the point: one transport, one opt-in switch, one place where a failure
is turned into a fact rather than an exception.

Opt-in by design: with `SMTP_SEND` unset the acknowledgement is still written to
the ledger and shown in the Mails table, it is simply not transmitted. That is
what a demo wants by default — nobody wants a rehearsal to mail a real customer —
and turning it on is one environment variable.

Every outbound message carries `X-Kiran-Ack`. When the console watches the same
account it sends from, its own acknowledgements land back in the inbox; the
poller skips them on that header rather than on the sender, so a self-addressed
demo still works.

## One session, reused

A pipeline stage sends two or three messages back to back (the receipt and the
internal notices at intake; the proforma and the closing message at release), and
each used to open its own connection: TCP, STARTTLS, login, one message, quit.
Against Gmail that is a couple of seconds per message, all of it spent before the
operator's click returns. The session is now kept open for a short while and reused
while it is still alive, so the second and third messages of a stage cost only the
send. A session that has gone stale is dropped and reopened once, transparently.
"""

from __future__ import annotations

import smtplib
import threading
import time
from email.message import EmailMessage
from typing import Optional

from .mail_connection import MailConnection, smtp_settings

ACK_HEADER = "X-Kiran-Ack"

#: How long an idle session is kept before it is closed. Long enough to span one
#: pipeline stage, short enough that a server's own idle limit never bites first.
SESSION_TTL_SECONDS = 45.0


class SmtpError(RuntimeError):
    """A send failure worth showing the operator verbatim."""


class _Session:
    """The one cached SMTP connection, guarded so two threads never share a socket."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._server: Optional[smtplib.SMTP] = None
        self._key: Optional[tuple] = None
        self._last_used = 0.0

    def send(self, settings: dict, message: EmailMessage) -> None:
        key = (settings["host"], settings["port"], settings["user"], settings["password"])
        with self._lock:
            server = self._reuse(key)
            if server is not None:
                try:
                    server.send_message(message)
                    self._last_used = time.monotonic()
                    return
                except (smtplib.SMTPException, OSError):
                    # Stale after all. Fall through to a fresh connection, once.
                    self._close()
            server = self._open(settings)
            try:
                server.send_message(message)
            except (smtplib.SMTPException, OSError):
                self._close()
                raise
            self._server, self._key, self._last_used = server, key, time.monotonic()

    def _reuse(self, key: tuple) -> Optional[smtplib.SMTP]:
        server = self._server
        if server is None:
            return None
        if self._key != key or time.monotonic() - self._last_used > SESSION_TTL_SECONDS:
            self._close()
            return None
        try:
            code, _ = server.noop()
        except (smtplib.SMTPException, OSError):
            self._close()
            return None
        if code != 250:
            self._close()
            return None
        return server

    @staticmethod
    def _open(settings: dict) -> smtplib.SMTP:
        server = smtplib.SMTP(settings["host"], settings["port"], timeout=20)
        try:
            server.ehlo()
            if server.has_extn("starttls"):
                server.starttls()
                server.ehlo()
            server.login(settings["user"], settings["password"])
        except (smtplib.SMTPException, OSError):
            try:
                server.close()
            except Exception:  # noqa: BLE001 - teardown must not mask the real error
                pass
            raise
        return server

    def _close(self) -> None:
        server, self._server, self._key = self._server, None, None
        if server is None:
            return
        try:
            server.quit()
        except Exception:  # noqa: BLE001 - a dead socket is still closed
            try:
                server.close()
            except Exception:  # noqa: BLE001
                pass

    def close(self) -> None:
        with self._lock:
            self._close()


_session = _Session()


def close_session() -> None:
    """Drop the cached connection. Tests and shutdown call this; nothing else needs to."""
    _session.close()


def send_acknowledgement(
    connection: Optional[MailConnection],
    *,
    to_address: str,
    subject: str,
    body_text: str,
    reference: str,
    body_html: Optional[str] = None,
) -> dict:
    """Transmit an acknowledgement, or explain why it was not transmitted.

    Never raises for a disabled or unconfigured mailer: the caller has already
    written the row, and a demo without SMTP must not fail a commit.
    """
    if connection is None:
        return {"sent": False, "reason": "No mailbox is connected."}

    settings = smtp_settings(connection)
    if not settings["enabled"]:
        return {"sent": False, "reason": "SMTP sending is off (set SMTP_SEND=true to enable)."}
    if not to_address:
        return {"sent": False, "reason": "The original message carried no reply address."}

    message = EmailMessage()
    message["From"] = settings["from"]
    message["To"] = to_address
    message["Subject"] = subject
    message[ACK_HEADER] = reference
    message.set_content(body_text)
    if body_html:
        # multipart/alternative: the plain text stays the message, and the HTML is the
        # richer rendering of the same thing. The proforma needs this - a bill rendered
        # as a wall of unstyled text is not a document anybody would keep.
        message.add_alternative(body_html, subtype="html")

    try:
        _session.send(settings, message)
    except (smtplib.SMTPException, OSError) as error:
        # Reported, not raised: the acknowledgement exists on the ledger either
        # way, and a transport failure is an operational fact rather than a
        # reason to unwind a committed order.
        return {"sent": False, "reason": f"SMTP send failed: {error}"}

    return {"sent": True, "reason": None, "via": f"{settings['host']}:{settings['port']}"}
