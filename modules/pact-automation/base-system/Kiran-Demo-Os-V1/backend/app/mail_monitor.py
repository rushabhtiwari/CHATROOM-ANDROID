"""The watcher loop.

Ported from the OrderOps poller (`apps/web/scripts/poll-inbox.ts`), minus the
process boundary: this console is one process, so the loop is an asyncio task on
the app's lifespan rather than a separate `mail:poll` script.

Three behaviours are carried over verbatim, because each one is the difference
between a watcher that survives a demo and one that does not:

  * **Exponential backoff on failure**, capped, so a mailbox that goes away does
    not turn into a tight reconnect loop against someone's mail server.
  * **The IMAP work runs in a worker thread.** `imaplib` is blocking; awaiting it
    on the event loop would stall every other request in the console.
  * **It never runs without a mailbox.** With no connection configured the loop
    idles rather than spinning — injection is how mail arrives in a demo, and a
    watcher that reports activity it did not do is worse than no watcher.

## Why a purchase order is noticed in seconds now

The loop used to log in, search, and log out once a minute, so a PO that landed
just after a tick sat unseen for most of that minute - and after one failed tick
the wait doubled, up to five minutes. Two changes:

  * **One session, kept open.** The loop owns a single `ImapEmailSource` and
    reuses it tick after tick. A tick is now a SEARCH on an open connection
    rather than a fresh TLS handshake and login.
  * **IDLE between ticks.** On that open session the loop asks the server to
    push a notification when mail arrives (RFC 2177), and wakes and fetches
    the moment it does. The wait is bounded by `MAIL_POLL_SECONDS` so a server
    that never pushes, or drops IDLE quietly, still gets polled on a short
    schedule; a server without IDLE at all simply sleeps that long instead.

Anything that goes wrong with the session - a dropped socket, a BYE, a refused
command - disposes it, and the next tick reconnects with the same capped
backoff as before, now starting from seconds rather than a minute.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from .imap_source import ImapEmailSource, ImapError
from .mail_connection import MailConnection, resolve_connection
from .mailing_store import mailing_store
from .write_service import WriteServiceError
from .write_service import mailing as write_service

logger = logging.getLogger("kiranos.mail")

# The loop's own identity in the audit log — see `run_poll_now(manual=...)`.
LOOP_ACTOR = "monitor-loop"

# How long to sit when there is nothing to watch (no mailbox, or paused). Short, so
# connecting a mailbox or pressing Resume takes effect within a few seconds.
IDLE_SECONDS = 5.0

# The longest the loop waits between looks at the mailbox. With IDLE this is only the
# upper bound - new mail wakes the loop at once; without it, this is the poll period.
DEFAULT_POLL_SECONDS = 20.0
MIN_POLL_SECONDS = 5.0

# After a failure the wait starts here and doubles per failure, capped.
BACKOFF_BASE_SECONDS = 5.0
MAX_BACKOFF_SECONDS = 60.0

_task: Optional[asyncio.Task] = None


def _interval() -> float:
    """The poll ceiling. `MAIL_POLL_SECONDS` in the env wins; the monitor record's own
    `intervalSeconds` is honoured only when it is shorter, so a value seeded at sixty
    seconds cannot quietly put a minute back between looks."""
    raw = (os.getenv("MAIL_POLL_SECONDS") or "").strip()
    try:
        configured = float(raw) if raw else DEFAULT_POLL_SECONDS
    except ValueError:
        configured = DEFAULT_POLL_SECONDS
    stored = mailing_store.monitor().get("intervalSeconds")
    try:
        stored_value = float(stored) if stored else configured
    except (TypeError, ValueError):
        stored_value = configured
    return max(MIN_POLL_SECONDS, min(configured, stored_value))


def _idle_enabled() -> bool:
    return (os.getenv("MAIL_IDLE") or "true").strip().lower() not in ("0", "false", "no", "off")


def _backoff(failures: int) -> float:
    return min(BACKOFF_BASE_SECONDS * (2 ** max(0, failures - 1)), MAX_BACKOFF_SECONDS)


def _same_mailbox(source: ImapEmailSource, connection: MailConnection) -> bool:
    current = source.connection
    return (
        current.address == connection.address
        and current.host == connection.host
        and current.port == connection.port
        and current.mailbox == connection.mailbox
        and current.password == connection.password
    )


def _wait(source: ImapEmailSource, seconds: float) -> bool:
    """Block in the worker thread until new mail or the deadline. True = new mail."""
    if not _idle_enabled():
        return False
    return source.idle_wait(seconds)


async def _loop() -> None:
    failures = 0
    source: Optional[ImapEmailSource] = None

    def drop() -> None:
        nonlocal source
        if source is not None:
            source.dispose()
            source = None

    try:
        while True:
            try:
                connection = resolve_connection()
                monitor = mailing_store.monitor()

                if connection is None or monitor.get("paused"):
                    # Nothing to watch, or deliberately stopped. Idle quietly, and do
                    # not hold a login open to a mailbox nobody is reading.
                    drop()
                    await asyncio.sleep(IDLE_SECONDS)
                    continue

                if source is not None and not _same_mailbox(source, connection):
                    drop()          # the operator connected a different mailbox
                if source is None:
                    source = ImapEmailSource(connection)

                # imaplib is blocking; keep it off the event loop so the rest of the
                # console stays responsive while a mailbox is slow.
                result = await asyncio.to_thread(
                    write_service.run_poll_now, LOOP_ACTOR, manual=False, source=source
                )
                if result["newMessages"]:
                    logger.info("mail_poll_ingested count=%s", result["newMessages"])
                failures = 0

                interval = _interval()
                if source.connected and _idle_enabled() and source.supports_idle:
                    woke = await asyncio.to_thread(_wait, source, interval)
                    if woke:
                        logger.info("mail_idle_woke")
                    # Either way the loop goes straight back to a poll: a wake fetches
                    # the new message; a timeout is the scheduled look.
                else:
                    await asyncio.sleep(interval)

            except asyncio.CancelledError:
                raise
            except (WriteServiceError, ImapError) as error:
                # The store already carries `lastError`, so the control deck shows
                # this without the log being the only place it exists.
                drop()
                failures += 1
                delay = _backoff(failures)
                message = getattr(error, "message", None) or str(error)
                logger.warning("mail_poll_failed attempt=%s retry_in=%ss: %s", failures, delay, message)
                await asyncio.sleep(delay)
            except Exception:  # noqa: BLE001 - the watcher must outlive any single tick
                drop()
                failures += 1
                delay = _backoff(failures)
                logger.exception("mail_poll_crashed attempt=%s retry_in=%ss", failures, delay)
                await asyncio.sleep(delay)
    finally:
        drop()


def start() -> None:
    """Starts the watcher. Safe to call when it is already running."""
    global _task
    if _task and not _task.done():
        return
    _task = asyncio.get_running_loop().create_task(_loop(), name="mail-monitor")
    logger.info("mail_monitor_started")


async def stop() -> None:
    global _task
    task, _task = _task, None
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("mail_monitor_stopped")
