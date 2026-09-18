"""The ledger survives a read that fails while another writer holds the file.

Before this, one transient `PermissionError` on a re-read replaced the live order ledger
with the demo seed and persisted it. The write side had retries; the read side did not.
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import mailing_store as module  # noqa: E402
from app.mailing_store import mailing_store  # noqa: E402


class TestLedgerReads(unittest.TestCase):
    def setUp(self) -> None:
        mailing_store.reset()
        self.addCleanup(mailing_store.reset)

    def _add_job(self) -> str:
        email = mailing_store.mutate_append_email({"messageId": "<x@y>", "direction": "INBOUND",
                                                   "fromAddress": "a@b.com", "subject": "s"})
        job = mailing_store.mutate_append_job({"emailLogId": email["id"], "status": "RECEIVED"})
        return job["id"]

    def test_a_transient_read_failure_keeps_the_in_memory_ledger(self):
        job_id = self._add_job()
        real_read = Path.read_text
        calls = {"n": 0}

        def flaky(self_path, *args, **kwargs):
            if self_path == module.MAILING_FILE and calls["n"] < 2:
                calls["n"] += 1
                raise PermissionError(5, "Access is denied")
            return real_read(self_path, *args, **kwargs)

        # Force a re-sync: pretend the file is newer than what we last saw.
        mailing_store._mtime = 0.0
        with patch.object(Path, "read_text", flaky):
            self.assertIsNotNone(mailing_store.job(job_id))
        self.assertEqual(calls["n"], 2)                # retried, then read
        self.assertIsNotNone(mailing_store.job(job_id))

    def test_a_persistent_read_failure_never_writes_seed_over_the_file(self):
        job_id = self._add_job()
        before = module.MAILING_FILE.read_bytes()

        def broken(self_path, *args, **kwargs):
            if self_path == module.MAILING_FILE:
                raise PermissionError(5, "Access is denied")
            return Path.read_text(self_path, *args, **kwargs)

        mailing_store._mtime = 0.0
        with patch.object(module.MailingStore, "_READ_ATTEMPTS", 2), \
             patch.object(Path, "read_text", broken):
            # Reads keep answering from memory, and nothing touches the disk.
            self.assertIsNotNone(mailing_store.job(job_id))
        self.assertEqual(module.MAILING_FILE.read_bytes(), before)
        self.assertIn(job_id, [j["id"] for j in json.loads(before)["jobs"]])

    def test_a_reload_picks_up_another_process_write(self):
        """The reason `_sync` exists at all still holds."""
        job_id = self._add_job()
        data = json.loads(module.MAILING_FILE.read_text(encoding="utf-8"))
        data["jobs"][-1]["status"] = "CLASSIFIED"
        module.MAILING_FILE.write_text(json.dumps(data), encoding="utf-8")
        mailing_store._mtime = 0.0
        self.assertEqual(mailing_store.job(job_id)["status"], "CLASSIFIED")


if __name__ == "__main__":
    unittest.main()
