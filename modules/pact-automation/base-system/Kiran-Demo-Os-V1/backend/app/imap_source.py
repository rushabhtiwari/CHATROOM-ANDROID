"""A real mailbox, over IMAP.

Ported from `apps/web/src/lib/email-source/imap-source.ts`, with the same three
properties that make it safe to point at a live account:

  * **A durable UIDVALIDITY/UID cursor.** The first connection baselines at
    `uidNext - 1`, so the account's entire history is never ingested. A restart
    resumes after the last fully handled UID.
  * **The `${n}:*` quirk is filtered explicitly.** An empty IMAP range still
    returns the newest message; without the filter every idle poll would
    re-deliver the same mail.
  * **Credentials are never logged.** This module reports host, user and mailbox
    and nothing else.

Written against Python's stdlib `imaplib` + `email` rather than a dependency, so
there is nothing to install on a laptop the morning of a demo. `EmailSource` is
the seam the write service consumes: swap this for a Gmail push implementation
and nothing downstream of `inject_inbound_email` changes.
"""

from __future__ import annotations

import email
import imaplib
import re
import select
import ssl
import time
from dataclasses import dataclass, field
from email.header import decode_header, make_header
from email.message import Message
from typing import Optional

from .mail_connection import MailConnection

#: IMAP line terminator, as bytes.
CRLF = b"\r\n"


@dataclass
class InboundAttachment:
    filename: str
    mime_type: str
    data: bytes


@dataclass
class InboundEmail:
    """Source-native message, in the shape the intake pipeline consumes."""

    message_id: str
    uid: int
    from_address: str
    to_address: str
    subject: str
    body_text: str
    headers: dict[str, str] = field(default_factory=dict)
    attachments: list[InboundAttachment] = field(default_factory=list)


@dataclass
class MailboxStatus:
    uid_validity: str
    # The UID the next arriving message will get — the baseline for "ignore
    # everything already in this mailbox".
    uid_next: int
    message_count: int


class ImapError(RuntimeError):
    """A mailbox problem worth showing the operator verbatim."""


class ImapEmailSource:
    """Cursor-driven IMAP source. Connect, ask for new UIDs, fetch, dispose."""

    kind = "imap"

    def __init__(self, connection: MailConnection) -> None:
        self._connection = connection
        self._client: Optional[imaplib.IMAP4] = None
        # Set once the server has refused IDLE, so the watcher stops asking.
        self._idle_unsupported = False

    @property
    def connection(self) -> MailConnection:
        return self._connection

    @property
    def connected(self) -> bool:
        return self._client is not None

    # ------------------------------------------------------------------ #
    # Lifecycle                                                          #
    # ------------------------------------------------------------------ #

    def connect(self) -> None:
        """Connects and selects the mailbox. Safe to call when already open."""
        if self._client is not None:
            return

        conn = self._connection
        try:
            client: imaplib.IMAP4 = (
                imaplib.IMAP4_SSL(conn.host, conn.port)
                if conn.secure
                else imaplib.IMAP4(conn.host, conn.port)
            )
        except OSError as error:
            raise ImapError(
                f"Could not reach {conn.host}:{conn.port} — {error}. "
                "Check the host, the port, and whether this network allows IMAP."
            ) from error

        try:
            client.login(conn.address, conn.password)
        except imaplib.IMAP4.error as error:
            detail = _detail(error)
            try:
                client.logout()
            except Exception:  # noqa: BLE001 - teardown must not mask the login error
                pass
            # Gmail's own message here is unhelpful; the app-password hint is
            # the single most common fix.
            if "AUTHENTICATIONFAILED" in detail.upper() or "invalid credentials" in detail.lower():
                raise ImapError(
                    "The mailbox rejected those credentials. For Gmail, use a "
                    "16-character app password, not the account password."
                ) from error
            raise ImapError(f"Login failed: {detail}") from error

        try:
            status, _ = client.select(conn.mailbox, readonly=True)
            if status != "OK":
                raise ImapError(f"Mailbox '{conn.mailbox}' could not be opened.")
        except imaplib.IMAP4.error as error:
            raise ImapError(f"Mailbox '{conn.mailbox}' could not be opened: {_detail(error)}") from error

        self._client = client

    def dispose(self) -> None:
        client, self._client = self._client, None
        if client is None:
            return
        try:
            client.logout()
        except Exception:  # noqa: BLE001 - a dead socket is still disposed
            pass

    def __enter__(self) -> "ImapEmailSource":
        self.connect()
        return self

    def __exit__(self, *_: object) -> None:
        self.dispose()

    # ------------------------------------------------------------------ #
    # Reads                                                              #
    # ------------------------------------------------------------------ #

    def status(self) -> MailboxStatus:
        client = self._require()
        conn = self._connection
        try:
            code, data = client.status(f'"{conn.mailbox}"', "(UIDVALIDITY UIDNEXT MESSAGES)")
        except (imaplib.IMAP4.error, OSError) as error:
            raise ImapError(f"The mailbox connection dropped: {_detail(error)}") from error
        if code != "OK" or not data:
            raise ImapError("The server did not report UIDVALIDITY/UIDNEXT.")

        text = data[0].decode("utf-8", "replace")
        values = dict(re.findall(r"(UIDVALIDITY|UIDNEXT|MESSAGES)\s+(\d+)", text))
        if "UIDVALIDITY" not in values or "UIDNEXT" not in values:
            raise ImapError("The server did not report UIDVALIDITY/UIDNEXT.")

        return MailboxStatus(
            uid_validity=values["UIDVALIDITY"],
            uid_next=int(values["UIDNEXT"]),
            message_count=int(values.get("MESSAGES", 0)),
        )

    def list_new_uids(self, after_uid: int) -> list[int]:
        """UIDs strictly greater than `after_uid`, oldest first."""
        client = self._require()
        try:
            code, data = client.uid("SEARCH", None, f"UID {after_uid + 1}:*")
        except (imaplib.IMAP4.error, OSError) as error:
            raise ImapError(f"The mailbox connection dropped: {_detail(error)}") from error
        if code != "OK":
            raise ImapError("The mailbox refused a UID search.")

        raw = (data[0] or b"").split()
        # The `${n}:*` range returns the newest message even when the range is
        # empty, so anything at or below the cursor is dropped explicitly.
        return sorted({int(item) for item in raw if int(item) > after_uid})

    def get_message(self, uid: int) -> InboundEmail:
        client = self._require()
        try:
            code, data = client.uid("FETCH", str(uid), "(RFC822)")
        except (imaplib.IMAP4.error, OSError) as error:
            raise ImapError(f"The mailbox connection dropped: {_detail(error)}") from error
        if code != "OK" or not data or not isinstance(data[0], tuple):
            raise ImapError(f"Fetch returned no source for UID {uid}.")

        parsed = email.message_from_bytes(data[0][1])
        return to_inbound_email(parsed, uid)

    # ------------------------------------------------------------------ #
    # Waiting                                                            #
    # ------------------------------------------------------------------ #

    @property
    def supports_idle(self) -> bool:
        client = self._client
        if client is None or self._idle_unsupported:
            return False
        return "IDLE" in (client.capabilities or ())

    def idle_wait(self, timeout: float) -> bool:
        """Block until the server announces new mail, or `timeout` seconds pass.

        RFC 2177 IDLE. The connection stays open and selected, and the server pushes an
        untagged `EXISTS` the moment a message arrives - so a purchase order is noticed
        within a second or two of landing rather than at the next scheduled poll. Returns
        True when something arrived, False on a quiet timeout.

        Only ever raises `ImapError`, and only for a connection that has actually gone
        away; the watcher treats that as "reconnect", the same as any other tick failure.
        A server without IDLE (or one that refuses it) returns False immediately with
        `supports_idle` turned off, and the watcher falls back to plain polling.

        Deliberately bounded: RFC 2177 asks clients to re-issue IDLE at least every 29
        minutes, and a short cycle also keeps the heartbeat the control deck shows honest.
        """
        client = self._require()
        if not self.supports_idle:
            return False
        sock = client.socket()
        tag = client._new_tag()
        try:
            client.send(tag + b" IDLE" + CRLF)
            first = client.readline()
        except (imaplib.IMAP4.error, OSError) as error:
            raise ImapError(f"The mailbox connection dropped: {_detail(error)}") from error

        if not first.startswith(b"+"):
            # Refused. Drain the tagged reply if there is one, then stop asking.
            self._idle_unsupported = True
            if not first.startswith(tag):
                try:
                    client.readline()
                except Exception:  # noqa: BLE001 - already giving up on IDLE
                    pass
            return False

        # The wait is done with select() on the raw socket, never with a socket timeout.
        # imaplib reads through a buffered file over the socket, and one timed-out read
        # marks that file object dead for good ("cannot read from timed out object") -
        # which would take the whole session down on the first quiet minute.
        woke = False
        deadline = time.monotonic() + max(1.0, float(timeout))
        try:
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                if not self._wait_readable(sock, min(remaining, 1.0)):
                    continue
                line = client.readline()
                if not line:
                    raise ImapError("The mailbox closed the connection while idling.")
                if _announces_mail(line):
                    woke = True
                    break
                if line.upper().startswith(b"* BYE"):
                    raise ImapError("The mailbox said BYE while idling.")
                # EXPUNGE, FETCH flag changes and the like: not new mail, keep waiting.
        except OSError as error:
            raise ImapError(f"The mailbox connection dropped: {_detail(error)}") from error
        finally:
            try:
                client.send(b"DONE" + CRLF)
                # The server answers DONE with the tagged completion of the IDLE. An
                # EXISTS that arrived in the same packet as the "+ idling" line sits in
                # imaplib's own buffer where select() cannot see it, so it is read here.
                for _ in range(64):
                    reply = client.readline()
                    if not reply or reply.startswith(tag):
                        break
                    if _announces_mail(reply):
                        woke = True
            except Exception as error:  # noqa: BLE001 - a failed DONE means a dead socket
                raise ImapError(f"The mailbox connection dropped: {_detail(error)}") from error
        return woke

    @staticmethod
    def _wait_readable(sock, seconds: float) -> bool:
        """Whether the server has sent something, waiting at most `seconds`.

        Decrypted bytes an SSL socket already holds do not show up in select(), so
        they are checked first.
        """
        try:
            if isinstance(sock, ssl.SSLSocket) and sock.pending():
                return True
        except Exception:  # noqa: BLE001 - fall through to select
            pass
        readable, _, _ = select.select([sock], [], [], max(0.0, seconds))
        return bool(readable)

    def _require(self) -> imaplib.IMAP4:
        if self._client is None:
            raise ImapError("The IMAP client is not connected — call connect() first.")
        return self._client


# --------------------------------------------------------------------------- #
# MIME → InboundEmail                                                          #
# --------------------------------------------------------------------------- #


def to_inbound_email(parsed: Message, uid: int) -> InboundEmail:
    headers = {key.lower(): _decode(value) for key, value in parsed.items()}

    body_parts: list[str] = []
    attachments: list[InboundAttachment] = []

    for part in parsed.walk():
        if part.get_content_maintype() == "multipart":
            continue

        disposition = (part.get("Content-Disposition") or "").lower()
        filename = part.get_filename()

        if filename or "attachment" in disposition:
            payload = part.get_payload(decode=True) or b""
            if not payload:
                continue
            attachments.append(
                InboundAttachment(
                    filename=_decode(filename) if filename else f"attachment-{len(attachments) + 1}",
                    mime_type=part.get_content_type(),
                    data=payload,
                )
            )
            continue

        if part.get_content_type() == "text/plain":
            payload = part.get_payload(decode=True) or b""
            charset = part.get_content_charset() or "utf-8"
            body_parts.append(payload.decode(charset, "replace"))

    # An HTML-only message still has to yield something readable, so its markup
    # is stripped rather than the body being reported as empty.
    if not body_parts:
        for part in parsed.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                body_parts.append(_strip_html(payload.decode(charset, "replace")))
                break

    return InboundEmail(
        message_id=headers.get("message-id") or f"<imap-uid-{uid}@local>",
        uid=uid,
        from_address=_address(headers.get("from", "")),
        to_address=_address(headers.get("to", "")),
        subject=headers.get("subject", "(no subject)"),
        body_text="\n".join(body_parts).strip(),
        headers=headers,
        attachments=attachments,
    )


def _decode(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except (UnicodeDecodeError, LookupError, ValueError):
        return value


def _address(value: str) -> str:
    """The bare address out of `Name <addr@host>`."""
    match = re.search(r"<([^>]+)>", value)
    return (match.group(1) if match else value).strip().lower()


def _strip_html(html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
    text = re.sub(r"(?i)<br\s*/?>|</p>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
    )
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def _announces_mail(line: bytes) -> bool:
    """An untagged EXISTS or RECENT: the server saying the mailbox grew."""
    upper = line.upper()
    return upper.startswith(b"*") and (b"EXISTS" in upper or b"RECENT" in upper)


def _detail(error: Exception) -> str:
    args = getattr(error, "args", None)
    if args and isinstance(args[0], bytes):
        return args[0].decode("utf-8", "replace")
    return str(error)


def verify_mailbox(connection: MailConnection) -> MailboxStatus:
    """Prove credentials against the server before anything is stored."""
    source = ImapEmailSource(connection)
    try:
        source.connect()
        return source.status()
    finally:
        source.dispose()
