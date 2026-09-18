"""`PACT_AUTO_RELEASE`: one gate instead of two.

With it on, the admin's approval carries the order through the Accounts gate by itself:
the same PACT push, proforma and closing message, without a second click. With it off,
nothing changes - the order waits for Accounts exactly as before. Both are asserted
against the fake KPAC the gated-half tests use, so no robot runs.
"""

from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.mailing_store import mailing_store  # noqa: E402
from app.write_service import mailing as write_service  # noqa: E402
from app.write_service import po_pipeline  # noqa: E402

from tests.test_po_pipeline import FakeKpac, PipelineTestCase  # noqa: E402


def wait_for(job_id: str, status: str, seconds: float = 10.0) -> str:
    """The release runs on a background thread; give it a moment to land."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        current = (mailing_store.job(job_id) or {}).get("status")
        if current == status:
            return current
        time.sleep(0.05)
    return (mailing_store.job(job_id) or {}).get("status")


class TestAutoRelease(PipelineTestCase):
    def test_the_setting_is_off_unless_asked_for(self):
        self.assertFalse(po_pipeline.pact_auto_release({}))
        self.assertFalse(po_pipeline.pact_auto_release({"PACT_AUTO_RELEASE": "false"}))
        self.assertTrue(po_pipeline.pact_auto_release({"PACT_AUTO_RELEASE": "true"}))
        self.assertTrue(po_pipeline.pact_auto_release({"PACT_AUTO_RELEASE": "1"}))

    def test_off_the_order_still_waits_for_accounts(self):
        job_id = self.demo_order()["ingestJobId"]
        with patch.dict("os.environ", {"PACT_AUTO_RELEASE": "false"}):
            result = self.admin_approve(job_id)
        self.assertFalse(result["autoReleased"])
        self.assertEqual(mailing_store.job(job_id)["status"], "AWAITING_ACCOUNTS_APPROVAL")
        self.assertEqual(mailing_store.pact_pushes(job_id), [])

    def test_on_the_admin_approval_reaches_pact_and_completes_the_order(self):
        job_id = self.demo_order()["ingestJobId"]
        kpac = FakeKpac(document_no="7")
        with patch.dict("os.environ", {"PACT_AUTO_RELEASE": "true"}), kpac.install():
            result = self.admin_approve(job_id)
            self.assertTrue(result["autoReleased"])
            self.assertEqual(wait_for(job_id, "COMPLETED"), "COMPLETED")

        # One draft, every line, and the close-out behind it - the same as the Accounts click.
        self.assertEqual(len(kpac.records), 1)
        self.assertEqual(mailing_store.saved_pact_push(job_id)["documentNo"], "7")
        self.assertIsNotNone(mailing_store.proforma_for_job(job_id))
        self.assertTrue(all(t["status"] == "DONE" for t in mailing_store.tasks(job_id)))
        self.assertIsNotNone(self.outbound(job_id, "DISPATCH_NOTICE"))

    def test_on_a_pact_pause_leaves_the_order_retryable_not_failed(self):
        job_id = self.demo_order()["ingestJobId"]
        kpac = FakeKpac(document_no="7", outcome="paused")
        with patch.dict("os.environ", {"PACT_AUTO_RELEASE": "true"}), kpac.install():
            self.admin_approve(job_id)
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline and not mailing_store.pact_pushes(job_id):
                time.sleep(0.05)
            while time.monotonic() < deadline and mailing_store.pact_pushes(job_id)[-1]["status"] == "RUNNING":
                time.sleep(0.05)
        push = mailing_store.latest_pact_push(job_id)
        self.assertEqual(push["status"], "PAUSED")
        # Still at the gate, so the console's Retry runs the same release again.
        self.assertEqual(mailing_store.job(job_id)["status"], "AWAITING_ACCOUNTS_APPROVAL")

    def test_the_view_and_summary_say_which_mode_is_on(self):
        job_id = self.demo_order()["ingestJobId"]
        with patch.dict("os.environ", {"PACT_AUTO_RELEASE": "true"}):
            self.assertTrue(po_pipeline.pipeline_view(job_id)["pactAutoRelease"])
            self.assertTrue(po_pipeline.summary()["pactAutoRelease"])
        with patch.dict("os.environ", {"PACT_AUTO_RELEASE": "false"}):
            self.assertFalse(po_pipeline.pipeline_view(job_id)["pactAutoRelease"])


if __name__ == "__main__":
    unittest.main()
