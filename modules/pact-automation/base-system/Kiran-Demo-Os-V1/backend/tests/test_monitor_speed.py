"""The watcher's fast path, and the console's view of KPAC.

Two things a demo feels directly:

  * a purchase order is noticed the moment it lands, because the watcher idles on an
    open IMAP session rather than logging in once a minute; and when the server has no
    IDLE, or drops it, the loop still polls on a short schedule;
  * the automation summary says whether KPAC is actually there.

Both are tested against fakes: no mailbox, no robot.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import mail_monitor, pact_bridge  # noqa: E402
from app.imap_source import ImapEmailSource, ImapError  # noqa: E402
from app.mail_connection import MailConnection  # noqa: E402
from app.mailing_store import mailing_store  # noqa: E402
from app.write_service import mailing as write_service  # noqa: E402
from app.write_service import po_pipeline  # noqa: E402


def connection() -> MailConnection:
    return MailConnection(
        address="orders@example.com", host="imap.example.com", port=993, secure=True,
        mailbox="INBOX", password="x", connected_at=None, auto_start=True, source="env",
    )


QUIET = object()   # "nothing arrives before the deadline" in a scripted stream

CRLF = b"\r\n"


class FakeImap:
    """Just enough of imaplib.IMAP4 for `idle_wait`: a scripted stream of lines.

    Doubles as its own socket: `readable()` is what select() would report, and a QUIET
    marker in the script stands for "nothing arrives before the deadline".
    """

    def __init__(self, lines: list, capabilities=("IMAP4rev1", "IDLE")) -> None:
        self.capabilities = capabilities
        self.sent: list[bytes] = []
        self._lines = list(lines)

    def socket(self):
        return self

    def _new_tag(self):
        return b"A001"

    def send(self, data):
        self.sent.append(data)

    def readable(self) -> bool:
        return bool(self._lines) and self._lines[0] is not QUIET

    def readline(self):
        if not self._lines:
            return b"A001 OK" + CRLF
        item = self._lines.pop(0)
        if item is QUIET:
            return b"A001 OK" + CRLF
        if isinstance(item, Exception):
            raise item
        return item


def source_with(client: FakeImap) -> ImapEmailSource:
    source = ImapEmailSource(connection())
    source._client = client  # noqa: SLF001 - the seam the test needs
    return source


class TestIdleWait(unittest.TestCase):
    def run_idle(self, client: FakeImap, seconds: float = 30) -> bool:
        """`idle_wait` against the script, with the socket wait and the clock faked.

        When the script says QUIET the fake wait consumes the marker and jumps the clock
        past the deadline, which is exactly what a real quiet interval looks like from
        inside `idle_wait`.
        """
        source = source_with(client)
        clock = {"now": 0.0}

        def waiting(sock, secs):
            if sock.readable():
                return True
            if sock._lines and sock._lines[0] is QUIET:
                sock._lines.pop(0)
            clock["now"] += 10_000
            return False

        with patch("app.imap_source.time.monotonic", lambda: clock["now"]), \
             patch.object(ImapEmailSource, "_wait_readable", staticmethod(waiting)):
            return source.idle_wait(seconds)

    def test_new_mail_wakes_the_wait(self):
        client = FakeImap([b"+ idling" + CRLF, b"* 43 EXISTS" + CRLF, b"A001 OK IDLE terminated" + CRLF])
        self.assertTrue(self.run_idle(client))
        self.assertEqual(client.sent, [b"A001 IDLE" + CRLF, b"DONE" + CRLF])

    def test_a_quiet_timeout_is_not_new_mail(self):
        client = FakeImap([b"+ idling" + CRLF, QUIET, b"A001 OK IDLE terminated" + CRLF])
        self.assertFalse(self.run_idle(client))
        self.assertEqual(client.sent, [b"A001 IDLE" + CRLF, b"DONE" + CRLF])

    def test_flag_changes_do_not_wake_it(self):
        client = FakeImap([
            b"+ idling" + CRLF, b"* 12 FETCH (FLAGS (\\Seen))" + CRLF, b"* 12 EXPUNGE" + CRLF,
            QUIET, b"A001 OK done" + CRLF,
        ])
        self.assertFalse(self.run_idle(client))

    def test_mail_announced_alongside_the_done_reply_still_counts(self):
        client = FakeImap([b"+ idling" + CRLF, QUIET, b"* 44 EXISTS" + CRLF, b"A001 OK done" + CRLF])
        self.assertTrue(self.run_idle(client))

    def test_a_server_without_idle_returns_at_once(self):
        client = FakeImap([], capabilities=("IMAP4rev1",))
        source = source_with(client)
        self.assertFalse(source.supports_idle)
        self.assertFalse(source.idle_wait(30))
        self.assertEqual(client.sent, [])

    def test_a_refused_idle_turns_itself_off(self):
        client = FakeImap([b"A001 BAD not allowed" + CRLF])
        source = source_with(client)
        self.assertFalse(source.idle_wait(30))
        self.assertFalse(source.supports_idle)

    def test_a_dropped_connection_is_an_imap_error(self):
        client = FakeImap([b"+ idling" + CRLF, b""])
        with self.assertRaises(ImapError):
            self.run_idle(client)


class TestPollReusesTheWatcherSession(unittest.TestCase):
    def setUp(self) -> None:
        mailing_store.reset()
        self.addCleanup(mailing_store.reset)

    def test_a_session_the_watcher_owns_is_not_disposed_by_the_poll(self):
        class Quiet(ImapEmailSource):
            connects = 0
            disposals = 0

            def connect(self):
                type(self).connects += 1
                self._client = object()

            def dispose(self):
                type(self).disposals += 1
                self._client = None

            def status(self):
                from app.imap_source import MailboxStatus
                return MailboxStatus(uid_validity="1", uid_next=100, message_count=99)

            def list_new_uids(self, after_uid):
                return []

        source = Quiet(connection())
        with patch.object(write_service, "resolve_connection", return_value=connection()):
            result = write_service.run_poll_now("loop", manual=False, source=source)
        self.assertTrue(result["connected"])
        self.assertEqual(Quiet.connects, 1)
        self.assertEqual(Quiet.disposals, 0)
        self.assertTrue(source.connected)


class TestIntervals(unittest.TestCase):
    def setUp(self) -> None:
        mailing_store.reset()
        self.addCleanup(mailing_store.reset)

    def test_the_seeded_minute_no_longer_wins(self):
        mailing_store.mutate_monitor({"intervalSeconds": 60})
        with patch.dict("os.environ", {"MAIL_POLL_SECONDS": "20"}):
            self.assertEqual(mail_monitor._interval(), 20.0)

    def test_a_shorter_stored_interval_is_honoured_down_to_the_floor(self):
        mailing_store.mutate_monitor({"intervalSeconds": 1})
        with patch.dict("os.environ", {"MAIL_POLL_SECONDS": "20"}):
            self.assertEqual(mail_monitor._interval(), mail_monitor.MIN_POLL_SECONDS)

    def test_backoff_starts_in_seconds_and_caps_at_a_minute(self):
        self.assertEqual(mail_monitor._backoff(1), 5.0)
        self.assertEqual(mail_monitor._backoff(2), 10.0)
        self.assertEqual(mail_monitor._backoff(10), mail_monitor.MAX_BACKOFF_SECONDS)


class TestKpacStatusInTheSummary(unittest.TestCase):
    def setUp(self) -> None:
        mailing_store.reset()
        self.addCleanup(mailing_store.reset)
        pact_bridge._status_cache = (0.0, {})
        self.addCleanup(lambda: setattr(pact_bridge, "_status_cache", (0.0, {})))

    def test_an_unreachable_kpac_reads_as_offline_not_as_an_error(self):
        with patch.dict("os.environ", {"PACT_AUTOMATION_URL": "http://127.0.0.1:9"}), \
             patch.object(pact_bridge, "PACT_AUTOMATION_URL", "http://127.0.0.1:9"):
            block = po_pipeline.summary()["kpac"]
        self.assertFalse(block["reachable"])
        self.assertIn("not reachable", block["detail"])

    def test_a_live_kpac_is_reported_with_its_profile_and_mode(self):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {
                    "worker_alive": True, "busy": False, "current": None, "step": "",
                    "settings": {"profile": "pact_purchase_order", "dry_run": True, "mode": "DRY RUN"},
                }

        class Client:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def get(self, *args, **kwargs):
                return Response()

        with patch.object(pact_bridge.httpx, "Client", Client):
            block = pact_bridge.kpac_status()
        self.assertTrue(block["reachable"])
        self.assertTrue(block["workerAlive"])
        self.assertTrue(block["profileMatches"])
        self.assertTrue(block["dryRun"])
        self.assertEqual(block["mode"], "DRY RUN")

    def test_the_answer_is_cached_briefly(self):
        calls = {"n": 0}

        class Client:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def get(self, *args, **kwargs):
                calls["n"] += 1
                raise OSError("down")

        with patch.object(pact_bridge.httpx, "Client", Client):
            pact_bridge.kpac_status()
            pact_bridge.kpac_status()
        self.assertEqual(calls["n"], 1)


if __name__ == "__main__":
    unittest.main()
