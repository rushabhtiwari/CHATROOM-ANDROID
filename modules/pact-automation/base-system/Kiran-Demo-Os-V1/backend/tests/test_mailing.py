"""Mailing Hub — write-service contracts, state machine, and API surface.

WORKING.md §6 asks for tests "proving zero canonical delete, atomic commits, and
audit log generation". Those three are the first three cases below, and they are
proved rather than asserted loosely: the delete test reads the source of the
store and the router, so it fails if someone adds a `del` or reaches around the
write service months from now.
"""

from __future__ import annotations

import ast
import json
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app import mailing_workflow as flow
from app.mailing_store import mailing_store
from app.write_service import WriteServiceError
from app.write_service import mailing as write_service

APP_DIR = Path(__file__).resolve().parent.parent / "app"


def pdf(tag: str) -> bytes:
    """A distinct minimal PDF per test, so SHA-256 dedupe does not cross tests."""
    return b"%PDF-1.7\n/Type /Page \n% " + tag.encode() + b"\n"


class MailingTestCase(unittest.TestCase):
    def setUp(self) -> None:
        # A known opening position for every test. `reset` rebuilds the seed;
        # it does not delete rows from a live ledger.
        mailing_store.reset()
        self.client = TestClient(app)

    def inject(self, **kwargs) -> dict:
        attachments = kwargs.pop("attachments", [])
        return write_service.inject_direct_email(
            write_service.DirectMailInput(attachments=attachments, **kwargs)
        )


# --------------------------------------------------------------------------- #
# §1.1 / §1.2 — the two structural rules, checked against the source           #
# --------------------------------------------------------------------------- #


class TestStructuralRules(MailingTestCase):
    def test_write_service_monopoly(self):
        """No route handler may call a store mutator directly (§1.1).

        The spec's rule is "route handlers must never call
        `prisma.<entity>.create/update/delete`". The equivalent here is that
        `routers/mailing.py` never calls a `mutate_*` method — every change goes
        through `write_service.mailing`.
        """
        source = (APP_DIR / "routers" / "mailing.py").read_text(encoding="utf-8")
        tree = ast.parse(source)

        offenders = [
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr.startswith("mutate_")
        ]
        self.assertEqual(
            offenders,
            [],
            f"routers/mailing.py calls store mutators directly: {offenders}. "
            "Route handlers must go through app/write_service/mailing.py.",
        )

    def test_write_service_is_the_only_mutator_caller(self):
        """Nothing outside the write service *calls* a `mutate_*` method.

        Deliberately AST-based rather than a text search: a module is allowed to
        mention `mutate_` in a comment explaining the rule, and only an actual
        call site breaks it.
        """
        offenders: list[str] = []
        for path in sorted(APP_DIR.rglob("*.py")):
            if path.name == "mailing_store.py":  # the store defines them
                continue
            if path.parent.name == "write_service":  # the one sanctioned caller
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and node.func.attr.startswith("mutate_")
                ):
                    offenders.append(f"{path.relative_to(APP_DIR)}:{node.lineno}")
        self.assertEqual(
            offenders, [], f"these modules bypass the write service: {offenders}"
        )

    def test_zero_delete_policy(self):
        """Canonical rows are append-only or archived — never removed (§1.2)."""
        store_source = (APP_DIR / "mailing_store.py").read_text(encoding="utf-8")
        tree = ast.parse(store_source)

        # No `del` statement, and no list/dict removal call, anywhere in the store.
        deletes = [node for node in ast.walk(tree) if isinstance(node, ast.Delete)]
        self.assertEqual(deletes, [], "mailing_store.py contains a `del` statement.")

        removals = [
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in ("remove", "pop", "clear", "popitem")
        ]
        self.assertEqual(removals, [], f"mailing_store.py removes records: {removals}")

        # And the store exposes no method that could be used to delete one.
        mutators = [name for name in dir(mailing_store) if name.startswith("mutate_")]
        self.assertTrue(mutators, "the store should expose mutators")
        for name in mutators:
            self.assertNotIn("delete", name.lower())
            self.assertNotIn("remove", name.lower())

    def test_discard_keeps_the_record(self):
        """Rejecting a message closes it; the row stays readable forever."""
        held = next(job for job in mailing_store.on_hold() if job["status"] == "EXCEPTION")
        before = len(mailing_store.jobs())

        result = write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=held["id"], action="REJECT", actor="tester",
                reason="Superseded by a revised PO.",
            )
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "DISCARDED")
        self.assertEqual(len(mailing_store.jobs()), before, "a job disappeared")
        surviving = mailing_store.job(held["id"])
        self.assertIsNotNone(surviving)
        self.assertEqual(surviving["decisionNote"], "Superseded by a revised PO.")


# --------------------------------------------------------------------------- #
# §1.3 — idempotent ingestion                                                  #
# --------------------------------------------------------------------------- #


class TestIdempotentIngestion(MailingTestCase):
    def test_same_message_id_is_not_ingested_twice(self):
        first = self.inject(
            from_address="procurement@mothersonsumi.com",
            to_address="orders@kirancable.com",
            subject="Purchase Order PO-MOTH-2026-990",
            body_text="Please supply 12,000 m.\nValue Rs 1,80,000\nDelivery: 2026-10-15",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("a.pdf", "application/pdf", pdf("a"))],
        )
        self.assertFalse(first["deduplicated"])

        again = self.inject(
            from_address="procurement@mothersonsumi.com",
            to_address="orders@kirancable.com",
            subject="Purchase Order PO-MOTH-2026-990",
            body_text="a completely different body",
            actor="tester",
        )
        self.assertTrue(again["deduplicated"])
        self.assertEqual(again["emailLogId"], first["emailLogId"])
        self.assertEqual(again["ingestJobId"], first["ingestJobId"])

    def test_same_attachment_hash_is_not_ingested_twice(self):
        """A forwarded PO is the same document, whatever the subject says."""
        first = self.inject(
            from_address="buyer@suzlon.com", to_address="orders@kirancable.com",
            subject="Purchase Order PO-SUZ-2026-501",
            body_text="Please supply 9,000 m. Delivery: 2026-10-02", actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("shared"))],
        )
        forwarded = self.inject(
            from_address="buyer@suzlon.com", to_address="orders@kirancable.com",
            subject="Fwd: our PO, resending", body_text="see attached", actor="tester",
            attachments=[write_service.DirectMailAttachment("copy.pdf", "application/pdf", pdf("shared"))],
        )
        self.assertTrue(forwarded["deduplicated"])
        self.assertEqual(forwarded["emailLogId"], first["emailLogId"])
        self.assertIn("SHA-256", forwarded["reason"])


# --------------------------------------------------------------------------- #
# The state machine                                                            #
# --------------------------------------------------------------------------- #


class TestStateMachine(MailingTestCase):
    def test_every_status_has_a_label_action_and_tone(self):
        for status in flow.STATUS_LABEL:
            self.assertIn(status, flow.STATUS_ACTION)
            self.assertIn(status, flow.STATUS_TONE)
            self.assertIn(flow.STATUS_TONE[status], ("grey", "blue", "amber", "red", "green"))

    def test_transition_table_is_closed(self):
        """Every successor is itself a known status — no dangling edges."""
        for current, successors in flow.ALLOWED_NEXT.items():
            self.assertIn(current, flow.STATUS_LABEL)
            for successor in successors:
                self.assertIn(successor, flow.STATUS_LABEL, f"{current} -> {successor}")

    def test_terminal_states_refuse_everything(self):
        for status in flow.TERMINAL:
            self.assertEqual(flow.ALLOWED_NEXT[status], set())
            error = flow.transition_error(status, "COMMITTED")
            self.assertIsNotNone(error)
            self.assertIn("closed", error)

    def test_illegal_transition_is_refused_with_a_reason(self):
        error = flow.transition_error("RECEIVED", "ACKNOWLEDGED")
        self.assertIsNotNone(error)
        self.assertIn("Received", error)
        self.assertIn("Acknowledged", error)

    def test_re_entering_the_same_state_is_harmless(self):
        self.assertIsNone(flow.transition_error("EXCEPTION", "EXCEPTION"))

    def test_hold_reason_is_derived_not_stored(self):
        self.assertEqual(flow.hold_reason_for("NOT_AN_ORDER"), flow.HOLD_INTAKE_FILTERED)
        self.assertEqual(flow.hold_reason_for("EXCEPTION"), flow.HOLD_EXCEPTION)
        self.assertEqual(
            flow.hold_reason_for("AWAITING_ADMIN_APPROVAL"), flow.HOLD_AWAITING_ADMIN
        )
        self.assertEqual(
            flow.hold_reason_for("AWAITING_ACCOUNTS_APPROVAL"), flow.HOLD_AWAITING_ACCOUNTS
        )
        self.assertIsNone(flow.hold_reason_for("COMMITTED"))

    def test_whitelist_only_applies_to_intake_filtered(self):
        self.assertIsNone(flow.triage_error("NOT_AN_ORDER", "WHITELIST"))
        self.assertIsNotNone(flow.triage_error("EXCEPTION", "WHITELIST"))

    def test_triage_refuses_a_job_that_is_still_flowing(self):
        error = flow.triage_error("EXTRACTING", "COMMIT_EDITED")
        self.assertIsNotNone(error)
        self.assertIn("not on hold", error)


# --------------------------------------------------------------------------- #
# The pipeline's branches                                                      #
# --------------------------------------------------------------------------- #


class TestPipelineBranches(MailingTestCase):
    def test_clean_order_runs_to_the_admin_gate_and_stops(self):
        """A clean order does not "go straight through" - it stops for an admin.

        The receipt and the internal notification go out ungated, and then the pipeline
        parks at AWAITING_ADMIN_APPROVAL. Nothing has reached PACT and nothing has been
        billed: that needs an admin, and then Accounts.
        """
        result = self.inject(
            from_address="procurement@mothersonsumi.com", to_address="orders@kirancable.com",
            subject="Purchase Order PO-MOTH-2026-991",
            body_text="Please supply 12,000 m.\nValue Rs 1,80,000\nDelivery: 2026-10-15",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("clean"))],
        )
        self.assertEqual(result["status"], "AWAITING_ADMIN_APPROVAL")

        job = mailing_store.job(result["ingestJobId"])
        self.assertFalse(job["touchedByHuman"])
        self.assertEqual(
            [entry["status"] for entry in job["timeline"]],
            ["RECEIVED", "CLASSIFIED", "EXTRACTING", "VALIDATED", "AWAITING_ADMIN_APPROVAL"],
            "the lifecycle should record every hop, not just the destination",
        )
        # The order ledger entry belongs to the admin's approval, not to intake.
        self.assertIsNone(job["orderId"])

        # The customer has a receipt and nothing past the gate has run.
        receipts = [
            e for e in mailing_store.emails()
            if e.get("ingestJobId") == job["id"] and e.get("kind") == "RECEIPT"
        ]
        self.assertEqual(len(receipts), 1)
        self.assertEqual(mailing_store.tasks(job["id"]), [])
        self.assertEqual(mailing_store.pact_pushes(job["id"]), [])
        self.assertIsNone(mailing_store.proforma_for_job(job["id"]))

    def test_unknown_domain_is_quarantined_before_extraction(self):
        result = self.inject(
            from_address="sales@stranger-corp.example", to_address="orders@kirancable.com",
            subject="Purchase Order PO-STR-2026-001",
            body_text="Please supply 5,000 m. Delivery: 2026-11-01", actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("stranger"))],
        )
        self.assertEqual(result["status"], "NOT_AN_ORDER")
        job = mailing_store.job(result["ingestJobId"])
        self.assertEqual(job["cause"], "UNKNOWN_DOMAIN")
        self.assertEqual(job["holdReason"], flow.HOLD_INTAKE_FILTERED)
        self.assertEqual(job["extraction"]["fields"], {}, "a stranger should not be extracted")

    def test_a_large_order_is_marked_as_large_and_held_like_any_other(self):
        result = self.inject(
            from_address="buyer@suzlon.com", to_address="orders@kirancable.com",
            subject="Purchase Order PO-SUZ-2026-777",
            body_text="Please supply 900,000 m.\nValue Rs 90,00,000\nDelivery: 2026-12-01",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("gate"))],
        )
        self.assertEqual(result["status"], "AWAITING_ADMIN_APPROVAL")
        job = mailing_store.job(result["ingestJobId"])
        self.assertEqual(job["holdReason"], flow.HOLD_AWAITING_ADMIN)
        self.assertGreaterEqual(
            job["extraction"]["fields"]["orderValue"]["value"], flow.APPROVAL_GATE_VALUE
        )
        # The value threshold decides nothing now; it only annotates the queue.
        note = job["timeline"][-1]["note"]
        self.assertIn("large-order mark", note)

    def test_missing_delivery_date_raises_an_ambiguous_date_exception(self):
        result = self.inject(
            from_address="orders@alstomtransport.in", to_address="orders@kirancable.com",
            subject="Purchase Order PO-ALST-2026-950",
            body_text="Please supply 8,000 m.\nValue Rs 1,20,000\nDelivery to be confirmed.",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("nodate"))],
        )
        self.assertEqual(result["status"], "EXCEPTION")
        self.assertEqual(mailing_store.job(result["ingestJobId"])["cause"], "AMBIGUOUS_DATE")

    def test_unevidenced_field_is_pinned_to_zero_confidence(self):
        """§1.4 — a value with no source text behind it is worth nothing."""
        result = self.inject(
            from_address="orders@alstomtransport.in", to_address="orders@kirancable.com",
            subject="Purchase Order PO-ALST-2026-951",
            body_text="Please supply 8,000 m.\nValue Rs 1,20,000\nDelivery to be confirmed.",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("eviden"))],
        )
        delivery = mailing_store.job(result["ingestJobId"])["extraction"]["fields"]["deliveryDate"]
        self.assertEqual(delivery["snippet"], "")
        self.assertEqual(delivery["confidence"], 0.0)

    def test_photographed_pdf_fails_ocr(self):
        result = self.inject(
            from_address="materials@cummins.co.in", to_address="orders@kirancable.com",
            subject="Purchase Order PO-CUM-2026-300",
            body_text="Please supply 4,000 m.\nValue Rs 60,000\nDelivery: 2026-10-20",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po-photo.pdf", "application/pdf", pdf("ocr"))],
        )
        self.assertEqual(result["status"], "EXCEPTION")
        self.assertEqual(mailing_store.job(result["ingestJobId"])["cause"], "OCR_FAILURE")

    def test_duplicate_po_is_caught_against_the_ledger(self):
        first = self.inject(
            from_address="supplychain@gepower.co.in", to_address="orders@kirancable.com",
            subject="Purchase Order PO-GE-2026-800",
            body_text="Please supply 10,000 m.\nValue Rs 1,50,000\nDelivery: 2026-10-09",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("dup1"))],
        )
        self.assertEqual(first["status"], "AWAITING_ADMIN_APPROVAL")

        second = self.inject(
            from_address="supplychain@gepower.co.in", to_address="orders@kirancable.com",
            subject="Re-sending Purchase Order PO-GE-2026-800",
            body_text="Please supply 10,000 m.\nValue Rs 1,50,000\nDelivery: 2026-10-09",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po2.pdf", "application/pdf", pdf("dup2"))],
        )
        self.assertEqual(second["status"], "EXCEPTION")
        self.assertEqual(mailing_store.job(second["ingestJobId"])["cause"], "DUPLICATE_PO")


# --------------------------------------------------------------------------- #
# Triage                                                                       #
# --------------------------------------------------------------------------- #


class TestTriage(MailingTestCase):
    def _gated_job(self) -> str:
        return self.inject(
            from_address="buyer@suzlon.com", to_address="orders@kirancable.com",
            subject="Purchase Order PO-SUZ-2026-778",
            body_text="Please supply 900,000 m.\nValue Rs 90,00,000\nDelivery: 2026-12-01",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("triage"))],
        )["ingestJobId"]

    def test_commit_edited_creates_order_version_and_acknowledgement(self):
        """The atomic-commit case from §6: order, version and ACK together."""
        job_id = self._gated_job()
        orders_before = len(mailing_store.orders())

        result = write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=job_id, action="COMMIT_EDITED", actor="k.s.rao",
                corrected_data={"quantityMetres": 880000},
                reason="Quantity corrected against the signed copy.",
            )
        )

        self.assertTrue(result["success"])
        self.assertEqual(len(mailing_store.orders()), orders_before + 1)

        order = mailing_store.order(result["orderId"])
        versions = mailing_store.order_versions(order["id"])
        self.assertEqual(len(versions), 1)
        self.assertEqual(versions[0]["versionNo"], 1)
        self.assertEqual(order["headVersionId"], versions[0]["id"])

        ack = mailing_store.email(result["acknowledgementId"])
        self.assertEqual(ack["direction"], "OUTBOUND")
        self.assertIn(order["poNumber"], ack["subject"])
        # This is the post-approval acknowledgement, so it may say the order was accepted.
        self.assertIn("accepted", ack["subject"].lower())

        # The automatic receipt went out earlier and says nothing of the kind.
        receipt = next(
            e for e in mailing_store.emails()
            if e.get("ingestJobId") == job_id and e.get("kind") == "RECEIPT"
        )
        self.assertIn("received", receipt["subject"].lower())
        for word in ("accepted", "confirmed", "approved", "acknowledged"):
            self.assertNotIn(word, receipt["subject"].lower())
            self.assertNotIn(word, receipt["bodyText"].lower())

        job = mailing_store.job(job_id)
        self.assertEqual(job["status"], "AWAITING_ACCOUNTS_APPROVAL")
        self.assertTrue(job["touchedByHuman"], "a corrected order is not straight-through")
        self.assertEqual(len(mailing_store.tasks(job_id)), 3, "Sales, Accounts, Manufacturing")

    def test_operator_edit_carries_its_own_provenance(self):
        job_id = self._gated_job()
        write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=job_id, action="COMMIT_EDITED", actor="k.s.rao",
                corrected_data={"quantityMetres": 880000},
            )
        )
        field = mailing_store.job(job_id)["extraction"]["fields"]["quantityMetres"]
        self.assertEqual(field["value"], 880000)
        self.assertEqual(field["source"], "HUMAN")
        self.assertEqual(field["confidence"], 1.0)
        self.assertEqual(field["supersededValue"], 900000, "the model's value must survive")

    def test_commit_without_a_po_number_is_refused(self):
        job_id = self._gated_job()
        with self.assertRaises(WriteServiceError) as caught:
            write_service.resolve_on_hold_item(
                write_service.ResolveOnHoldInput(
                    job_id=job_id, action="COMMIT_EDITED", actor="k.s.rao",
                    corrected_data={"poNumber": "   "},
                )
            )
        self.assertIn("PO number is required", caught.exception.message)

    def test_discard_requires_a_note(self):
        job_id = self._gated_job()
        with self.assertRaises(WriteServiceError) as caught:
            write_service.resolve_on_hold_item(
                write_service.ResolveOnHoldInput(job_id=job_id, action="REJECT", actor="k.s.rao")
            )
        self.assertEqual(caught.exception.status_code, 422)
        self.assertIn("decision note", caught.exception.message)

    def test_resolving_a_closed_job_is_refused(self):
        """A DISCARDED job stays closed.

        An admin approval no longer closes a job - it moves to the Accounts gate, which is
        a hold an operator may still act on. So this drives it all the way to the DISCARDED
        sentinel and checks that *that* is refused a second time.
        """
        job_id = self._gated_job()
        write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(job_id=job_id, action="COMMIT_EDITED", actor="k.s.rao")
        )
        self.assertEqual(mailing_store.job(job_id)["status"], "AWAITING_ACCOUNTS_APPROVAL")

        write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=job_id, action="REJECT", actor="k.s.rao", reason="closed by the operator"
            )
        )
        self.assertEqual(mailing_store.job(job_id)["status"], "DISCARDED")

        with self.assertRaises(WriteServiceError) as caught:
            write_service.resolve_on_hold_item(
                write_service.ResolveOnHoldInput(job_id=job_id, action="REJECT", actor="k.s.rao", reason="x")
            )
        self.assertEqual(caught.exception.status_code, 409)

    def test_unknown_job_is_a_404(self):
        with self.assertRaises(WriteServiceError) as caught:
            write_service.resolve_on_hold_item(
                write_service.ResolveOnHoldInput(job_id="JOB-NOPE", action="REJECT", actor="x", reason="y")
            )
        self.assertEqual(caught.exception.status_code, 404)

    def test_whitelisting_reingests_everything_from_that_domain(self):
        for index in (1, 2):
            self.inject(
                from_address="purchase@newco.example", to_address="orders@kirancable.com",
                subject=f"Purchase Order PO-NEW-2026-00{index}",
                body_text=f"Please supply {index}0,000 m.\nValue Rs 2,0{index},000\nDelivery: 2026-11-0{index}",
                actor="tester",
                attachments=[write_service.DirectMailAttachment(
                    f"po{index}.pdf", "application/pdf", pdf(f"newco{index}")
                )],
            )

        quarantined = [
            job for job in mailing_store.on_hold()
            if job["status"] == "NOT_AN_ORDER"
            and "newco.example" in (mailing_store.email(job["emailLogId"]) or {}).get("fromAddress", "")
        ]
        self.assertEqual(len(quarantined), 2)

        result = write_service.whitelist_domain_and_reingest(
            write_service.WhitelistDomainInput(
                domain="newco.example", company_name="Newco Industries", actor="tester"
            )
        )
        self.assertEqual(result["reprocessedCount"], 2)
        self.assertIsNotNone(mailing_store.domain("newco.example"))
        for job in quarantined:
            self.assertNotEqual(mailing_store.job(job["id"])["status"], "NOT_AN_ORDER")

    def test_retry_extraction_keeps_the_job_and_counts_the_attempt(self):
        held = next(job for job in mailing_store.on_hold() if job["status"] == "EXCEPTION")
        result = write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=held["id"], action="RETRY_EXTRACTION", actor="tester"
            )
        )
        self.assertTrue(result["success"])
        job = mailing_store.job(held["id"])
        self.assertEqual(job["retryCount"], 1)
        self.assertTrue(job["touchedByHuman"])


# --------------------------------------------------------------------------- #
# §6 — audit log generation                                                    #
# --------------------------------------------------------------------------- #


class TestAuditTrail(MailingTestCase):
    def test_every_write_service_entry_point_writes_an_audit_row(self):
        before = len(mailing_store.audit(1000))

        injected = self.inject(
            from_address="buyer@suzlon.com", to_address="orders@kirancable.com",
            subject="Purchase Order PO-SUZ-2026-779",
            body_text="Please supply 900,000 m.\nValue Rs 90,00,000\nDelivery: 2026-12-01",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("audit"))],
        )
        write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=injected["ingestJobId"], action="COMMIT_EDITED", actor="k.s.rao"
            )
        )
        write_service.whitelist_domain_and_reingest(
            write_service.WhitelistDomainInput(
                domain="audited.example", company_name="Audited Ltd", actor="tester"
            )
        )
        write_service.run_poll_now("tester")
        write_service.set_monitor_paused(True, "tester")

        entries = mailing_store.audit(1000)
        self.assertGreater(len(entries), before)
        actions = {entry["action"] for entry in entries}
        for expected in (
            "INJECT_DIRECT_EMAIL",
            "RESOLVE_COMMIT_EDITED",
            "WHITELIST_DOMAIN",
            "RUN_POLL",
            "PAUSE_MONITOR",
        ):
            self.assertIn(expected, actions)

        for entry in entries:
            for key in ("actor", "action", "subjectType", "subjectId", "note", "at"):
                self.assertIn(key, entry)

    def test_paused_monitor_refuses_a_poll(self):
        write_service.set_monitor_paused(True, "tester")
        with self.assertRaises(WriteServiceError) as caught:
            write_service.run_poll_now("tester")
        self.assertIn("paused", caught.exception.message)


# --------------------------------------------------------------------------- #
# Analytics                                                                    #
# --------------------------------------------------------------------------- #


class TestAnalytics(MailingTestCase):
    def test_shape_is_complete(self):
        data = mailing_store.analytics()
        for key in ("intake", "stp", "timeseries", "errorBreakdown", "domainStats", "latency", "sla"):
            self.assertIn(key, data)

    def test_pareto_is_ordered_and_cumulative(self):
        pareto = mailing_store.analytics()["errorBreakdown"]
        self.assertTrue(pareto)
        counts = [row["count"] for row in pareto]
        self.assertEqual(counts, sorted(counts, reverse=True), "Pareto must descend")
        self.assertAlmostEqual(pareto[-1]["cumulativeShare"], 1.0, places=3)
        for row in pareto:
            self.assertIn(row["cause"], flow.CAUSE_LABEL)

    def test_stp_counts_only_decided_jobs(self):
        """A job still mid-flight must not drag the rate down (§3.4)."""
        stp = mailing_store.analytics()["stp"]
        jobs = mailing_store.jobs()
        in_flight = [j for j in jobs if j["status"] in ("RECEIVED", "CLASSIFIED", "EXTRACTING")]
        self.assertTrue(in_flight, "the seed should leave something mid-flight")
        self.assertEqual(stp["decided"], len(jobs) - len(in_flight))

        committed = [j for j in jobs if flow.is_committed(j["status"])]
        self.assertEqual(stp["straightThrough"] + stp["touched"], len(committed))
        self.assertAlmostEqual(stp["rate"], stp["straightThrough"] / stp["decided"], places=4)

    def test_latency_percentiles_are_ordered(self):
        latency = mailing_store.analytics()["latency"]
        self.assertIsNotNone(latency["p50"])
        self.assertLessEqual(latency["p50"], latency["p90"])
        self.assertLessEqual(latency["p90"], latency["p99"])

    def test_empty_latency_reports_none_not_a_fake_zero(self):
        from app.mailing_store import _percentile

        self.assertIsNone(_percentile([], 0.5))

    def test_timeseries_covers_the_whole_window(self):
        data = mailing_store.analytics(days=7)
        self.assertEqual(len(data["timeseries"]), 7)
        dates = [row["date"] for row in data["timeseries"]]
        self.assertEqual(dates, sorted(dates), "buckets must run oldest to newest")


# --------------------------------------------------------------------------- #
# §5 — the HTTP surface                                                        #
# --------------------------------------------------------------------------- #


class TestMailingApi(MailingTestCase):
    def test_all_seven_documented_routes_are_mounted(self):
        paths = set(app.openapi()["paths"])
        for route in (
            "/api/admin/mailing/summary",
            "/api/admin/mailing/mails",
            "/api/admin/mailing/mails/{email_id}",
            "/api/admin/mailing/on-hold",
            "/api/admin/mailing/on-hold/{job_id}/resolve",
            "/api/admin/mailing/direct-send",
            "/api/admin/mailing/analytics",
        ):
            self.assertIn(route, paths)

    def test_summary_counters(self):
        body = self.client.get("/api/admin/mailing/summary").json()
        self.assertEqual(
            body["totalMails"], body["inboundCount"] + body["outboundCount"]
        )
        self.assertEqual(
            body["onHoldCount"], sum(body["onHoldByReason"].values())
        )

    def test_mails_pagination_and_filters(self):
        page = self.client.get("/api/admin/mailing/mails?pageSize=5&page=1").json()
        self.assertLessEqual(len(page["items"]), 5)
        self.assertEqual(page["page"], 1)

        outbound = self.client.get("/api/admin/mailing/mails?direction=OUTBOUND").json()
        self.assertTrue(outbound["items"])
        self.assertTrue(all(row["direction"] == "OUTBOUND" for row in outbound["items"]))

        exceptions = self.client.get("/api/admin/mailing/mails?status=EXCEPTION").json()
        self.assertTrue(all(row["status"] == "EXCEPTION" for row in exceptions["items"]))

        search = self.client.get("/api/admin/mailing/mails?q=motherson").json()
        self.assertTrue(search["items"])

    def test_mails_are_newest_first(self):
        items = self.client.get("/api/admin/mailing/mails?pageSize=50").json()["items"]
        stamps = [row["receivedAt"] for row in items]
        self.assertEqual(stamps, sorted(stamps, reverse=True))

    def test_mail_detail_and_404(self):
        first = self.client.get("/api/admin/mailing/mails?pageSize=1").json()["items"][0]
        detail = self.client.get(f"/api/admin/mailing/mails/{first['id']}").json()
        self.assertEqual(detail["email"]["id"], first["id"])
        self.assertIn("headers", detail["email"])
        self.assertIn("bodyText", detail["email"])

        missing = self.client.get("/api/admin/mailing/mails/MAIL-NOPE")
        self.assertEqual(missing.status_code, 404)

    def test_on_hold_groups_and_actions(self):
        body = self.client.get("/api/admin/mailing/on-hold").json()
        self.assertEqual(body["total"], sum(group["count"] for group in body["groups"]))
        for row in body["items"]:
            self.assertIn(row["holdReason"], flow.HOLD_REASON_LABEL)
            self.assertTrue(row["availableActions"], f"{row['id']} offers no action")

    def test_on_hold_filter_by_reason(self):
        body = self.client.get(
            "/api/admin/mailing/on-hold?reason=INTAKE_FILTERED"
        ).json()
        self.assertTrue(all(row["holdReason"] == "INTAKE_FILTERED" for row in body["items"]))

    def test_resolve_over_http(self):
        held = self.client.get("/api/admin/mailing/on-hold?reason=EXCEPTION").json()["items"][0]
        response = self.client.post(
            f"/api/admin/mailing/on-hold/{held['id']}/resolve",
            json={"action": "REJECT", "actor": "tester", "reason": "Duplicate of an earlier PO."},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])

    def test_resolve_surfaces_the_refusal_verbatim(self):
        held = self.client.get("/api/admin/mailing/on-hold?reason=EXCEPTION").json()["items"][0]
        response = self.client.post(
            f"/api/admin/mailing/on-hold/{held['id']}/resolve",
            json={"action": "REJECT", "actor": "tester"},
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("decision note", response.json()["detail"])

    def test_direct_send_over_http(self):
        response = self.client.post(
            "/api/admin/mailing/direct-send",
            data={
                "fromAddress": "procurement@raychemrpg.com",
                "toAddress": "orders@kirancable.com",
                "subject": "Purchase Order PO-RPG-2026-900",
                "bodyText": "Please supply 9,000 m.\nValue Rs 1,32,000\nDelivery: 2026-10-30",
                "actor": "tester",
            },
            files={"attachments": ("po.pdf", pdf("http"), "application/pdf")},
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertFalse(body["deduplicated"])
        self.assertEqual(body["status"], "AWAITING_ADMIN_APPROVAL")

    def test_direct_send_rejects_a_bad_address(self):
        response = self.client.post(
            "/api/admin/mailing/direct-send",
            data={"fromAddress": "not-an-address", "subject": "hello", "actor": "tester"},
        )
        self.assertEqual(response.status_code, 422)

    def test_analytics_over_http(self):
        body = self.client.get("/api/admin/mailing/analytics?days=7").json()
        self.assertEqual(body["windowDays"], 7)
        self.assertEqual(len(body["timeseries"]), 7)

    def test_monitor_poll_and_pause(self):
        polled = self.client.post("/api/admin/mailing/monitor/poll", json={"actor": "tester"})
        self.assertEqual(polled.status_code, 200)

        paused = self.client.post(
            "/api/admin/mailing/monitor/pause", json={"paused": True, "actor": "tester"}
        )
        self.assertTrue(paused.json()["monitor"]["paused"])

        blocked = self.client.post("/api/admin/mailing/monitor/poll", json={"actor": "tester"})
        self.assertEqual(blocked.status_code, 409)




# --------------------------------------------------------------------------- #
# The live mailbox — connection, MIME parsing, and the shared ingest path      #
# --------------------------------------------------------------------------- #


class TestMailboxConnection(MailingTestCase):
    def test_host_is_inferred_from_the_address(self):
        """The operator types an address; the console knows the endpoints."""
        from app.mail_connection import host_for, smtp_host_for

        self.assertEqual(host_for("orders@gmail.com"), "imap.gmail.com")
        self.assertEqual(host_for("po@company.outlook.com"), "outlook.office365.com")
        self.assertEqual(host_for("sales@zoho.com"), "imap.zoho.com")
        self.assertEqual(host_for("orders@kirancable.com"), "imap.kirancable.com")
        self.assertEqual(smtp_host_for("orders@gmail.com"), "smtp.gmail.com")

    def test_password_round_trips_through_the_seal(self):
        from app.mail_connection import seal, unseal

        secret = "abcd efgh ijkl mnop"
        sealed = seal(secret)
        self.assertNotIn(secret, sealed, "the plaintext must not survive in the sealed form")
        self.assertEqual(unseal(sealed), secret)

    def test_two_seals_of_the_same_password_differ(self):
        """A per-record salt, so identical passwords do not look identical."""
        from app.mail_connection import seal, unseal

        first, second = seal("same-password"), seal("same-password")
        self.assertNotEqual(first, second)
        self.assertEqual(unseal(first), unseal(second))

    def test_connection_never_exposes_the_password(self):
        from app.mail_connection import MailConnection

        connection = MailConnection(
            address="orders@kirancable.com", host="imap.kirancable.com", port=993,
            secure=True, mailbox="INBOX", password="super-secret",
            connected_at=None, auto_start=True, source="connected",
        )
        self.assertNotIn("password", connection.redacted())
        self.assertNotIn("super-secret", str(connection.redacted()))

    def test_connect_rejects_a_bad_address_before_touching_the_network(self):
        with self.assertRaises(WriteServiceError) as caught:
            write_service.connect_mailbox(address="not-an-address", password="x", actor="tester")
        self.assertEqual(caught.exception.status_code, 422)

    def test_connect_requires_a_password(self):
        with self.assertRaises(WriteServiceError) as caught:
            write_service.connect_mailbox(address="a@b.com", password="", actor="tester")
        self.assertEqual(caught.exception.status_code, 422)

    def test_poll_without_a_mailbox_reports_zero_rather_than_inventing_traffic(self):
        result = write_service.run_poll_now("tester")
        self.assertEqual(result["newMessages"], 0)
        self.assertFalse(result["connected"])

    def test_status_endpoint_hides_credentials(self):
        body = self.client.get("/api/admin/mailing/monitor").json()
        self.assertIn("monitor", body)
        self.assertIn("connected", body)
        self.assertNotIn("password", json.dumps(body).lower())


class TestMimeParsing(MailingTestCase):
    def _raw(self, *, body: str, attachment: bool = True) -> str:
        from email.message import EmailMessage

        message = EmailMessage()
        message["From"] = "Procurement Desk <procurement@mothersonsumi.com>"
        message["To"] = "orders@kirancable.com"
        message["Subject"] = "Purchase Order PO-MOTH-2026-777"
        message["Message-ID"] = "<real-message-id@mothersonsumi.com>"
        message["Authentication-Results"] = "mx.google.com; spf=pass; dkim=pass; dmarc=fail"
        message.set_content(body)
        if attachment:
            message.add_attachment(
                pdf("mime"), maintype="application", subtype="pdf",
                filename="PO-MOTH-2026-777.pdf",
            )
        return message.as_string()

    def test_a_real_mime_message_becomes_an_inbound_email(self):
        import email as email_module
        from app.imap_source import to_inbound_email

        raw = self._raw(body="Please supply 12,000 m.\nValue Rs 1,80,000\nDelivery: 2026-10-15")
        parsed = to_inbound_email(email_module.message_from_string(raw), uid=42)

        self.assertEqual(parsed.uid, 42)
        self.assertEqual(parsed.message_id, "<real-message-id@mothersonsumi.com>")
        # The bare address out of `Name <addr>` — a display name is not an address.
        self.assertEqual(parsed.from_address, "procurement@mothersonsumi.com")
        self.assertEqual(parsed.to_address, "orders@kirancable.com")
        self.assertIn("12,000 m", parsed.body_text)
        self.assertEqual(len(parsed.attachments), 1)
        self.assertEqual(parsed.attachments[0].filename, "PO-MOTH-2026-777.pdf")
        self.assertEqual(parsed.attachments[0].mime_type, "application/pdf")

    def test_html_only_message_still_yields_readable_text(self):
        import email as email_module
        from email.message import EmailMessage
        from app.imap_source import to_inbound_email

        message = EmailMessage()
        message["From"] = "buyer@suzlon.com"
        message["To"] = "orders@kirancable.com"
        message["Subject"] = "PO"
        message.set_content("<p>Please supply <b>9,000 m</b></p>", subtype="html")

        parsed = to_inbound_email(email_module.message_from_string(message.as_string()), uid=7)
        self.assertIn("9,000 m", parsed.body_text)
        self.assertNotIn("<b>", parsed.body_text)

    def test_authentication_results_are_read_not_invented(self):
        import email as email_module
        from app.imap_source import to_inbound_email

        raw = self._raw(body="Please supply 5,000 m. Delivery: 2026-10-15", attachment=False)
        parsed = to_inbound_email(email_module.message_from_string(raw), uid=9)

        self.assertEqual(write_service._auth_result(parsed.headers, "spf"), "pass")
        self.assertEqual(write_service._auth_result(parsed.headers, "dmarc"), "fail")
        # Nothing in the header for this one, so it must not claim a pass.
        self.assertEqual(write_service._auth_result({}, "spf"), "unknown")

    def test_a_fetched_message_runs_the_same_pipeline_as_an_injection(self):
        """The watcher and the injector share one path — that is the point."""
        import email as email_module
        from app.imap_source import to_inbound_email

        raw = self._raw(body="Please supply 12,000 m.\nValue Rs 1,80,000\nDelivery: 2026-10-15")
        message = to_inbound_email(email_module.message_from_string(raw), uid=101)

        result = write_service.ingest_inbound(message, actor="imap-watcher")
        self.assertFalse(result["deduplicated"])
        self.assertEqual(result["status"], "AWAITING_ADMIN_APPROVAL")

        job = mailing_store.job(result["ingestJobId"])
        self.assertEqual(
            [entry["status"] for entry in job["timeline"]],
            ["RECEIVED", "CLASSIFIED", "EXTRACTING", "VALIDATED", "AWAITING_ADMIN_APPROVAL"],
        )

        stored = mailing_store.email(result["emailLogId"])
        self.assertEqual(stored["source"], "IMAP")
        self.assertEqual(stored["headers"]["spf"], "pass")

    def test_a_refetched_message_is_deduped_by_its_real_message_id(self):
        import email as email_module
        from app.imap_source import to_inbound_email

        raw = self._raw(body="Please supply 12,000 m.\nValue Rs 1,80,000\nDelivery: 2026-10-15")
        first = write_service.ingest_inbound(
            to_inbound_email(email_module.message_from_string(raw), uid=201)
        )
        # The same message at a different UID — a re-list must not duplicate it.
        again = write_service.ingest_inbound(
            to_inbound_email(email_module.message_from_string(raw), uid=202)
        )
        self.assertTrue(again["deduplicated"])
        self.assertEqual(again["emailLogId"], first["emailLogId"])


class TestAcknowledgementDelivery(MailingTestCase):
    def test_ack_is_recorded_and_marked_unsent_when_smtp_is_off(self):
        """A demo must not mail a real customer, and must say so plainly."""
        result = self.inject(
            from_address="procurement@mothersonsumi.com", to_address="orders@kirancable.com",
            subject="Purchase Order PO-MOTH-2026-993",
            body_text="Please supply 12,000 m.\nValue Rs 1,80,000\nDelivery: 2026-10-15",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("ack"))],
        )
        ack = next(
            email for email in mailing_store.emails()
            if email["direction"] == "OUTBOUND" and email.get("ingestJobId") == result["ingestJobId"]
        )
        # Not sent, and the ledger carries the reason rather than leaving the
        # operator to guess whether the customer heard from us.
        self.assertFalse(ack["sent"])
        self.assertTrue(ack["delivery"]["reason"])
        self.assertRegex(ack["delivery"]["reason"], r"(?i)mailbox|smtp")

    def test_send_is_a_no_op_without_a_connection(self):
        from app.smtp_sender import send_acknowledgement

        delivery = send_acknowledgement(
            None, to_address="a@b.com", subject="x", body_text="y", reference="ORD-1"
        )
        self.assertFalse(delivery["sent"])
        self.assertIn("No mailbox", delivery["reason"])


if __name__ == "__main__":
    unittest.main()
