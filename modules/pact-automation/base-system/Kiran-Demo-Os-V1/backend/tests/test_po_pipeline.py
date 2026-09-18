"""The purchase-order pipeline: wording, the two gates, PACT, and the proforma.

These are the rules that cannot be allowed to drift, each asserted independently of the
code that is supposed to enforce it:

  * the automatic receipt says *received* and never *accepted*, *confirmed* or *approved*;
  * the proforma never reads as a tax invoice;
  * **an admin approval, and then an Accounts approval, are the only path to a PACT draft;**
  * one purchase order produces one PACT document carrying every one of its line items.

The third is the important one, so it is attacked from several directions: through the
write service, through the HTTP surface, and by trying to skip a gate.
"""

from __future__ import annotations

import asyncio
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app import mailing_extraction  # noqa: E402
from app import mailing_messages as messages  # noqa: E402
from app import pact_bridge, proforma  # noqa: E402
from app.demo_customers import (  # noqa: E402
    DEMO_CUSTOMERS,
    PactMasterError,
    kpac_profile,
    resolve_pact_party,
    resolve_product_code,
)
from app.main import app  # noqa: E402
from app.mailing_store import mailing_store  # noqa: E402
from app.write_service import mailing as write_service  # noqa: E402
from app.write_service import po_pipeline  # noqa: E402
from app.write_service.errors import WriteServiceError  # noqa: E402


def pdf(tag: str) -> bytes:
    return b"%PDF-1.4\n" + tag.encode() + b"\n%%EOF\n"


MEGHDOOT = DEMO_CUSTOMERS[0]


class PipelineTestCase(unittest.TestCase):
    def setUp(self) -> None:
        mailing_store.reset()
        self.addCleanup(mailing_store.reset)

    def inject(self, **kwargs) -> dict:
        return write_service.inject_direct_email(write_service.DirectMailInput(**kwargs))

    def demo_order(self, po: str = "PO-MEG-2026-001", tag: str = "demo") -> dict:
        """One clean PO from a demo customer, run as far as the pipeline takes it."""
        return self.inject(
            from_address=MEGHDOOT.contact_email,
            to_address="orders@kirancable.com",
            subject=f"Purchase Order {po}",
            body_text="Please supply 12,000 m.\nValue Rs 1,80,000\nDelivery: 2026-10-15",
            actor="tester",
            attachments=[
                write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf(tag))
            ],
        )

    def admin_approve(self, job_id: str, **kwargs) -> dict:
        """Gate 1."""
        return write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=job_id, action="COMMIT_EDITED", actor="admin", **kwargs
            )
        )

    def accounts_approve(self, job_id: str) -> dict:
        """Gate 2."""
        return write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=job_id, action="ACCOUNTS_APPROVE", actor="accounts"
            )
        )

    def outbound(self, job_id: str, kind: str) -> dict | None:
        return next(
            (
                e
                for e in mailing_store.emails()
                if e.get("ingestJobId") == job_id and e.get("kind") == kind
            ),
            None,
        )


# --------------------------------------------------------------------------- #
# The acknowledgement's wording                                                #
# --------------------------------------------------------------------------- #


class TestReceiptWording(unittest.TestCase):
    """The automatic receipt. It goes out before any human has read the order, so it may
    record receipt and nothing else."""

    def render(self, **overrides) -> messages.RenderedEmail:
        args = dict(
            po_number="PO-MEG-2026-014",
            customer_name="Meghdoot Auto Components Pvt Ltd (Demo)",
            seller_name="Kiran Cable Protection Products Pvt Ltd",
            received_at=datetime(2026, 9, 4, 9, 15, tzinfo=timezone.utc),
            line_count=1,
        )
        args.update(overrides)
        return messages.render_receipt(**args)

    def test_never_says_accepted_confirmed_or_approved(self):
        rendered = self.render()
        for banned in ("accepted", "confirmed", "approved", "agreed"):
            self.assertNotIn(banned, rendered.text.lower())
            self.assertNotIn(banned, rendered.subject.lower())

    def test_contains_none_of_the_banned_words_in_any_form(self):
        rendered = self.render()
        for banned in messages.FORBIDDEN_IN_ACKNOWLEDGEMENT:
            self.assertNotIn(banned, rendered.text.lower(), banned)

    def test_does_say_received_and_reviewing(self):
        rendered = self.render()
        # "Received" is the subject line's whole claim; "reviewing" is the body's.
        self.assertIn("received", rendered.subject.lower())
        self.assertIn("receipt", rendered.text.lower())
        self.assertIn("reviewing", rendered.text.lower())

    def test_states_outright_that_it_is_not_an_agreement(self):
        self.assertIn("not an agreement to supply", self.render().text.lower())

    def test_works_when_the_po_number_was_not_found(self):
        self.assertIn("number not found", self.render(po_number="").text)

    def test_the_guard_refuses_wording_that_promises_anything(self):
        with self.assertRaises(messages.ReceiptWordingError):
            messages.assert_receipt_wording("Your order has been accepted.")

    def test_the_post_approval_acknowledgement_is_allowed_to_say_accepted(self):
        """The ban protects the automatic receipt only.

        This message is the output of a person deciding, so it is allowed to report the
        decision - and it must be, or the customer never learns the order was taken.
        """
        rendered = messages.render_order_acknowledgement(
            po_number="PO-MEG-2026-014",
            customer_name="Meghdoot Auto Components Pvt Ltd (Demo)",
            seller_name="Kiran Cable Protection Products Pvt Ltd",
            line_summary="  1  46893   PET YARN   1,800 KGS   477,000.00",
            order_value=477000.0,
            delivery_date="2026-10-15",
        )
        self.assertIn("accepted", rendered.text.lower())

    def test_the_closing_message_says_its_dispatch_details_are_invented(self):
        rendered = messages.render_final_dispatch(
            po_number="PO-MEG-2026-014",
            customer_name="Meghdoot Auto Components Pvt Ltd (Demo)",
            seller_name="Kiran Cable Protection Products Pvt Ltd",
            document_no="1042",
            dispatch_date="19 Sep 2026",
            tracking_url="http://localhost:5173/track/KCP-DEMO-001042",
            tracking_reference="KCP-DEMO-001042",
            line_summary="  1  46893   PET YARN   1,800 KGS   477,000.00",
            order_value=477000.0,
        )
        self.assertIn("DEMONSTRATION MESSAGE", rendered.text)
        self.assertIn("No consignment has been booked", rendered.text)
        self.assertIn("1042", rendered.text)
        self.assertIn("not a tax invoice", rendered.text.lower())


class TestInternalNotification(unittest.TestCase):
    def render(self, problem=None) -> messages.RenderedEmail:
        return messages.render_internal_notification(
            po_number="PO-MEG-2026-001",
            customer_name=MEGHDOOT.name,
            order_value=180000.0,
            quantity_metres=12000,
            delivery_date="2026-10-15",
            confidence=0.94,
            job_url="http://localhost:5173/admin/mailing/inbox?job=JOB-2026-0001",
            pact_master_problem=problem,
        )

    def test_says_plainly_that_nothing_has_been_committed(self):
        text = self.render().text
        self.assertIn("NOTHING HAS BEEN COMMITTED", text)
        self.assertIn("No PACT document exists", text)
        self.assertIn("Accounts release it", text)

    def test_links_to_the_job(self):
        self.assertIn("JOB-2026-0001", self.render().text)

    def test_surfaces_a_pact_master_problem_where_sales_will_see_it(self):
        text = self.render("customer not in PACT master: Nobody Ltd").text
        self.assertIn("customer not in PACT master: Nobody Ltd", text)
        self.assertIn("cannot reach PACT until somebody adds that name", text)


# --------------------------------------------------------------------------- #
# The proforma                                                                 #
# --------------------------------------------------------------------------- #


class TestProforma(unittest.TestCase):
    proposal = {
        "poNumber": "PO-MEG-2026-001",
        "customer": MEGHDOOT.name,
        "quantityMetres": 12000,
        "orderValue": 180000.0,
        "deliveryDate": "2026-10-15",
    }

    def render(self) -> str:
        return proforma.render_proforma_html(
            document_no="1",
            proposal=self.proposal,
            seller_name="Kiran Cable Protection Products Pvt Ltd",
            pact_document_no="1",
        )

    def test_it_says_demo_and_disclaims_itself(self):
        document = self.render()
        self.assertIn("DEMO", document)
        self.assertIn("not a tax invoice", document)
        self.assertIn("not a demand for payment", document)

    def test_it_never_describes_itself_as_a_tax_invoice(self):
        self.assertTrue(proforma.tax_invoice_mentions_are_negated(self.render()))

    def test_the_guard_catches_a_document_that_reads_as_one(self):
        self.assertFalse(proforma.tax_invoice_mentions_are_negated("<h1>TAX INVOICE</h1>"))
        with self.assertRaises(proforma.ProformaError):
            proforma.assert_not_a_tax_invoice("<h1>Tax Invoice</h1>")
        for bad in ("GSTIN 27ABCDE1234F1Z5", "Amount payable within 30 days", "IFSC HDFC0001234"):
            with self.assertRaises(proforma.ProformaError, msg=bad):
                proforma.assert_not_a_tax_invoice(f"<p>{bad}</p>")

    def test_it_says_the_pact_document_is_a_draft_that_was_never_posted(self):
        document = self.render()
        self.assertIn("draft", document.lower())
        self.assertIn("never posted", document.lower())

    def test_the_covering_email_says_demo_in_the_subject(self):
        rendered = messages.render_proforma_email(
            po_number="PO-MEG-2026-001",
            customer_name=MEGHDOOT.name,
            seller_name="Kiran",
            document_no="1",
            proforma_html=self.render(),
            total=180000.0,
        )
        self.assertIn("DEMO PROFORMA", rendered.subject)
        self.assertIn("not a tax invoice", rendered.subject)
        self.assertIn("THIS IS A DEMONSTRATION DOCUMENT", rendered.text)


# --------------------------------------------------------------------------- #
# The PACT master mapping                                                      #
# --------------------------------------------------------------------------- #


class TestPactMaster(unittest.TestCase):
    def test_all_four_demo_customers_map_to_themselves(self):
        for customer in DEMO_CUSTOMERS:
            self.assertEqual(resolve_pact_party(customer.name, {}), customer.name)

    def test_case_and_whitespace_are_transcription_noise(self):
        self.assertEqual(
            resolve_pact_party("  meghdoot   auto components pvt ltd (demo) ", {}),
            MEGHDOOT.name,
        )

    def test_an_unknown_name_fails_with_the_required_wording(self):
        with self.assertRaises(PactMasterError) as caught:
            resolve_pact_party("Motherson Sumi Systems Ltd", {})
        self.assertEqual(
            str(caught.exception), "customer not in PACT master: Motherson Sumi Systems Ltd"
        )

    def test_a_near_match_is_refused_rather_than_guessed(self):
        for near in ("Meghdoot Auto Components Pvt Ltd", "Meghdoot", "Sahyadri Electricals"):
            with self.assertRaises(PactMasterError, msg=near):
                resolve_pact_party(near, {})

    def test_the_table_can_be_extended_from_the_environment(self):
        env = {"PACT_MASTER_MAP": "Motherson Sumi Systems Ltd=MOTHERSON SUMI SYS LTD"}
        self.assertEqual(resolve_pact_party("Motherson Sumi Systems Ltd", env), "MOTHERSON SUMI SYS LTD")
        self.assertEqual(resolve_pact_party(MEGHDOOT.name, env), MEGHDOOT.name)

    def test_a_malformed_mapping_throws_rather_than_being_skipped(self):
        for bad in ("no-equals-sign", "=only-right", "only-left="):
            with self.assertRaises(PactMasterError, msg=bad):
                resolve_pact_party("x", {"PACT_MASTER_MAP": bad})

    def test_the_pact_screen_is_configuration(self):
        self.assertEqual(kpac_profile({}), "pact_purchase_order")
        self.assertEqual(kpac_profile({"KPAC_PROFILE": "pact_sales_order"}), "pact_sales_order")

    def test_product_codes_come_from_the_live_window(self):
        self.assertEqual(resolve_product_code("PET-MONO-0.22-BLACK", {}), "46893")
        self.assertEqual(resolve_product_code("46893", {}), "46893")
        self.assertIsNone(resolve_product_code("SOMETHING-ELSE", {}))
        self.assertEqual(resolve_product_code("NEW", {"PACT_PRODUCT_MAP": "NEW=99999"}), "99999")


# --------------------------------------------------------------------------- #
# The KPAC record                                                              #
# --------------------------------------------------------------------------- #


class TestPactRecord(unittest.TestCase):
    """One purchase order becomes one record carrying every line it asked for."""

    proposal = {
        "poNumber": "PO-MEG-2026-001",
        "customer": MEGHDOOT.name,
        "quantityMetres": 12000,
        "orderValue": 180000.0,
        "deliveryDate": "2026-10-15",
    }

    multi = {
        **proposal,
        "quantityMetres": 3000,
        "orderValue": 765000.0,
        "lineItems": [
            {"sr": 1, "productCode": "46893", "quantity": 1800, "unit": "KGS",
             "rate": 265.0, "value": 477000.0},
            {"sr": 2, "productCode": "42010", "quantity": 1200, "unit": "KGS",
             "rate": 240.0, "value": 288000.0},
        ],
    }

    def test_it_builds_the_purchase_order_profile_columns(self):
        record = pact_bridge.build_record(self.proposal, doc_date="04/09/2026", env={})
        self.assertEqual(record["vendor_name"], MEGHDOOT.name)
        self.assertEqual(record["doc_date"], "04/09/2026")
        self.assertEqual(record["party_ref_no"], "PO-MEG-2026-001")

    def test_the_line_items_are_a_list_of_dicts_not_a_string(self):
        """The worker calls `.get()` on each item, so a string here fails every row."""
        items = pact_bridge.build_record(self.proposal, env={})["line_items"]
        self.assertIsInstance(items, list)
        self.assertTrue(all(isinstance(i, dict) for i in items))
        self.assertEqual(set(items[0]), {"product_code", "qty", "unit_price"})

    def test_a_single_line_order_still_produces_one_row(self):
        items = pact_bridge.build_record(self.proposal, env={})["line_items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["product_code"], "46893")
        self.assertEqual(items[0]["qty"], "12000")
        self.assertEqual(float(items[0]["unit_price"]), 15.0)

    def test_every_line_of_a_multi_line_order_reaches_the_grid(self):
        """The whole point: five lines in, five rows out, one document."""
        items = pact_bridge.build_record(self.multi, env={})["line_items"]
        self.assertEqual(len(items), 2)
        self.assertEqual([i["product_code"] for i in items], ["46893", "42010"])
        self.assertEqual([i["qty"] for i in items], ["1800", "1200"])
        self.assertEqual([float(i["unit_price"]) for i in items], [265.0, 240.0])

    def test_a_line_with_no_quantity_is_dropped_rather_than_typed_as_zero(self):
        proposal = {**self.multi, "lineItems": self.multi["lineItems"] + [
            {"sr": 3, "productCode": "46893", "quantity": 0, "rate": 265.0, "value": 0.0}
        ]}
        self.assertEqual(len(pact_bridge.build_record(proposal, env={})["line_items"]), 2)

    def test_a_customer_pact_does_not_know_stops_the_order(self):
        with self.assertRaises(PactMasterError):
            pact_bridge.build_record({**self.proposal, "customer": "Nobody Ltd"}, env={})

    def test_a_dry_run_is_a_success_with_no_document_rather_than_a_failure(self):
        entry = {"id": 7, "status": "skipped", "error": "DRY RUN - verified OK, nothing was saved"}
        result = pact_bridge._settle(entry, dry_run_setting=True)
        self.assertEqual(result.status, "SUCCEEDED")
        self.assertTrue(result.dry_run)
        self.assertIsNone(result.document_no)

    def test_a_saved_row_reports_the_document_number_pact_gave_it(self):
        entry = {
            "id": 7,
            "status": "saved",
            "error": "",
            "result": {"confirmation": {"record_id": "1"}},
        }
        result = pact_bridge._settle(entry, dry_run_setting=False)
        self.assertEqual(result.status, "SUCCEEDED")
        self.assertEqual(result.document_no, "1")
        self.assertFalse(result.dry_run)

    def test_a_failed_row_carries_the_reason(self):
        entry = {"id": 7, "status": "failed", "error": "Verification failed - nothing was saved"}
        result = pact_bridge._settle(entry, dry_run_setting=False)
        self.assertEqual(result.status, "FAILED")
        self.assertIn("Verification failed", result.detail)


# --------------------------------------------------------------------------- #
# Reading a purchase order's line-item table                                   #
# --------------------------------------------------------------------------- #


class TestLineItemExtraction(unittest.TestCase):
    TABLE = """PURCHASE ORDER
PO number: PO-MEG-2026-014
Please supply the following against this purchase order.
Sr  Product code   Description                              Qty      Unit  Rate      Value
1   46893          PET MONOFILAMENT YARN 0.22MM BLACK       1,800    KGS   265.00    477,000.00
2   42010          SYNTHETIC MONOFILMENT YARN 0.25MM        1,200    KGS   240.00    288,000.00
"""

    def test_every_row_of_the_table_is_read(self):
        items = mailing_extraction.find_line_items(self.TABLE)
        self.assertEqual(len(items), 2)
        self.assertEqual([i["productCode"] for i in items], ["46893", "42010"])
        self.assertEqual([i["quantity"] for i in items], [1800.0, 1200.0])
        self.assertEqual([i["value"] for i in items], [477000.0, 288000.0])

    def test_a_description_with_spaces_is_not_mistaken_for_the_figures(self):
        items = mailing_extraction.find_line_items(self.TABLE)
        self.assertIn("PET MONOFILAMENT YARN", items[0]["description"])

    def test_prose_with_no_table_reads_as_no_rows(self):
        self.assertEqual(
            mailing_extraction.find_line_items("Quantity: 1,800 m\nRate: Rs 265.00"), []
        )


# --------------------------------------------------------------------------- #
# The two gates, from every angle                                              #
# --------------------------------------------------------------------------- #


class TestTheTwoGates(PipelineTestCase):
    def test_a_clean_order_stops_at_the_admin_gate(self):
        """Nothing runs straight through any more, whatever the order is worth."""
        job_id = self.demo_order()["ingestJobId"]
        job = mailing_store.job(job_id)
        self.assertEqual(job["status"], "AWAITING_ADMIN_APPROVAL")
        self.assertEqual(job["holdReason"], "AWAITING_ADMIN")

    def test_the_receipt_went_out_before_the_gate(self):
        job_id = self.demo_order()["ingestJobId"]
        receipt = self.outbound(job_id, "RECEIPT")
        self.assertIsNotNone(receipt, "the customer should already have a receipt")
        self.assertEqual(receipt["toAddress"], MEGHDOOT.contact_email)
        self.assertIsNotNone(self.outbound(job_id, "INTERNAL_NOTIFICATION"))
        # And nothing stronger than a receipt.
        self.assertIsNone(self.outbound(job_id, "ACKNOWLEDGEMENT"))

    def test_the_receipt_promises_nothing(self):
        job_id = self.demo_order()["ingestJobId"]
        body = self.outbound(job_id, "RECEIPT")["bodyText"].lower()
        for banned in ("accepted", "confirmed", "approved"):
            self.assertNotIn(banned, body)

    def test_the_admin_approval_acknowledges_and_tasks_the_team(self):
        job_id = self.demo_order()["ingestJobId"]
        self.admin_approve(job_id)

        job = mailing_store.job(job_id)
        self.assertEqual(job["status"], "AWAITING_ACCOUNTS_APPROVAL")

        ack = self.outbound(job_id, "ACKNOWLEDGEMENT")
        self.assertIsNotNone(ack)
        self.assertIn("accepted", ack["bodyText"].lower())

        tasks = mailing_store.tasks(job_id)
        self.assertEqual(
            sorted(t["team"] for t in tasks), ["ACCOUNTS", "MANUFACTURING", "SALES"]
        )
        self.assertTrue(all(t["status"] == "OPEN" for t in tasks))

    def test_the_timeline_records_both_hops_not_a_jump(self):
        job_id = self.demo_order()["ingestJobId"]
        self.admin_approve(job_id)
        seen = [entry["status"] for entry in mailing_store.job(job_id)["timeline"]]
        self.assertIn("COMMITTED", seen)
        self.assertIn("ACKNOWLEDGED", seen)
        self.assertIn("AWAITING_ACCOUNTS_APPROVAL", seen)

    def test_approving_twice_does_not_send_a_second_acknowledgement(self):
        job_id = self.demo_order()["ingestJobId"]
        self.admin_approve(job_id)
        before = len([e for e in mailing_store.emails() if e.get("kind") == "ACKNOWLEDGEMENT"])
        po_pipeline.run_on_admin_approval(job_id)
        after = len([e for e in mailing_store.emails() if e.get("kind") == "ACKNOWLEDGEMENT"])
        self.assertEqual(before, after)
        self.assertEqual(len(mailing_store.tasks(job_id)), 3)

    def test_accounts_cannot_release_an_order_the_admin_has_not_approved(self):
        job_id = self.demo_order()["ingestJobId"]
        with self.assertRaises(WriteServiceError) as caught:
            self.accounts_approve(job_id)
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIsNone(mailing_store.latest_pact_push(job_id))

    def test_the_pact_half_refuses_a_job_that_is_not_at_the_accounts_gate(self):
        """Belt and braces: the pipeline checks even when the state machine already did."""
        job_id = self.demo_order()["ingestJobId"]
        with self.assertRaises(WriteServiceError) as caught:
            asyncio.run(po_pipeline.run_after_accounts_approval(job_id))
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("Accounts have not released", caught.exception.message)

    def test_nothing_advances_on_its_own(self):
        """There is no timeout into either gate. An order nobody touches stays put."""
        job_id = self.demo_order()["ingestJobId"]
        for _ in range(3):
            self.assertEqual(
                mailing_store.job(job_id)["status"], "AWAITING_ADMIN_APPROVAL"
            )

    def test_a_discarded_order_never_reaches_either_gate(self):
        job_id = self.demo_order()["ingestJobId"]
        write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=job_id, action="REJECT", actor="admin", reason="duplicate of an earlier PO"
            )
        )
        self.assertEqual(mailing_store.job(job_id)["status"], "DISCARDED")
        with self.assertRaises(WriteServiceError):
            self.accounts_approve(job_id)


class TestRemovedCustomerGate(unittest.TestCase):
    """The customer gate is gone, and nothing may quietly refer to it."""

    REMOVED = (
        "AWAITING_CLIENT_CONFIRMATION",
        "CLIENT_REJECTED",
        "CLIENT_AMENDED",
        "PROFORMA_SENT",
        "AWAITING_APPROVAL",
    )

    def test_no_removed_status_survives_in_the_state_machine(self):
        from app import mailing_workflow as flow

        for name in self.REMOVED:
            self.assertNotIn(name, flow.STATUS_LABEL, name)
            self.assertNotIn(name, flow.ALLOWED_NEXT, name)
            self.assertNotIn(name, flow.HOLD_FOR_STATUS, name)
            for successors in flow.ALLOWED_NEXT.values():
                self.assertNotIn(name, successors, name)

    def test_the_module_it_lived_in_is_gone(self):
        with self.assertRaises(ImportError):
            from app import client_confirmation  # noqa: F401

    def test_every_transition_target_is_a_declared_status(self):
        from app import mailing_workflow as flow

        for current, successors in flow.ALLOWED_NEXT.items():
            self.assertIn(current, flow.STATUS_LABEL, current)
            for target in successors:
                self.assertIn(target, flow.STATUS_LABEL, target)


# --------------------------------------------------------------------------- #
# The gated half, with KPAC faked                                              #
# --------------------------------------------------------------------------- #


class FakeKpac:
    """KPAC's HTTP surface, in memory. The lifecycle is the real one."""

    def __init__(self, outcome: str = "saved", document_no: str = "1", dry_run: bool = False):
        self.outcome = outcome
        self.document_no = document_no
        self.dry_run = dry_run
        self.records: list[dict] = []
        self.approved: list[int] = []

    async def status(self) -> dict:
        return {
            "worker_alive": True,
            "settings": {"profile": "pact_purchase_order", "dry_run": self.dry_run},
        }

    async def create_entry(self, record: dict, source: str = "") -> dict:
        self.records.append(record)
        return {"id": 1, "status": "pending", "record": record}

    async def approve_entry(self, entry_id: int) -> dict:
        self.approved.append(entry_id)
        return {"id": entry_id, "status": "approved"}

    async def entries(self) -> list[dict]:
        if self.outcome == "saved":
            return [
                {
                    "id": 1,
                    "status": "saved",
                    "error": "",
                    "result": {"confirmation": {"record_id": self.document_no}},
                }
            ]
        if self.outcome == "dry_run":
            return [{"id": 1, "status": "skipped", "error": "DRY RUN - verified OK, nothing was saved"}]
        if self.outcome == "paused":
            return [{"id": 1, "status": "approved", "error": "window not found - open PACT and log in"}]
        return [{"id": 1, "status": "failed", "error": "Verification failed - nothing was saved"}]

    def install(self):
        return patch.multiple(
            "app.pact_client",
            configured=lambda: True,
            status=self.status,
            create_entry=self.create_entry,
            approve_entry=self.approve_entry,
            entries=self.entries,
        )


class TestGatedHalf(PipelineTestCase):
    """Everything past the Accounts gate: one PACT document, the proforma, the close-out."""

    def released_job(self) -> str:
        job_id = self.demo_order()["ingestJobId"]
        self.admin_approve(job_id)
        return job_id

    def run_gated(self, kpac: FakeKpac, job_id: str):
        with kpac.install():
            return asyncio.run(po_pipeline.run_after_accounts_approval(job_id))

    def test_a_release_produces_one_pact_draft_a_proforma_and_a_closing_message(self):
        job_id = self.released_job()
        kpac = FakeKpac(document_no="1")
        run = self.run_gated(kpac, job_id)

        self.assertTrue(run.ok, [s.detail for s in run.steps])
        self.assertEqual(
            [s.step for s in run.steps],
            ["pact_push", "proforma", "dispatch_notice", "close_tasks"],
        )

        push = mailing_store.saved_pact_push(job_id)
        self.assertEqual(push["documentNo"], "1")
        self.assertEqual(push["profile"], "pact_purchase_order")

        proforma_row = mailing_store.proforma_for_job(job_id)
        self.assertEqual(proforma_row["documentNo"], "1")
        self.assertTrue(proforma_row["isDemo"])
        self.assertIn("not a tax invoice", proforma_row["html"])

        self.assertEqual(mailing_store.job(job_id)["status"], "COMPLETED")
        self.assertEqual(kpac.records[0]["vendor_name"], MEGHDOOT.name)
        self.assertEqual(kpac.approved, [1])

    def test_one_purchase_order_creates_exactly_one_kpac_entry(self):
        """One document, one Save Draft - not one entry per line."""
        job_id = self.released_job()
        kpac = FakeKpac(document_no="1")
        self.run_gated(kpac, job_id)
        self.assertEqual(len(kpac.records), 1)
        self.assertIsInstance(kpac.records[0]["line_items"], list)

    def test_the_closing_message_carries_the_document_number_and_demo_caveats(self):
        job_id = self.released_job()
        self.run_gated(FakeKpac(document_no="1042"), job_id)

        notice = self.outbound(job_id, "DISPATCH_NOTICE")
        self.assertIsNotNone(notice)
        body = notice["bodyText"]
        self.assertIn("1042", body)
        self.assertIn("DEMONSTRATION MESSAGE", body)
        self.assertIn("KCP-DEMO-001042", body)
        self.assertIn("not a tax invoice", body.lower())

    def test_the_admin_approval_does_not_drop_the_order_s_line_items(self):
        """`_merge_corrections` rebuilds the extraction; it must rebuild all of it.

        Listing only `fields` there dropped `lineItems` on every approval, so a three-line
        PO reached PACT as one aggregated row - and looked correct at every step before it.
        """
        job_id = self.demo_order()["ingestJobId"]
        before = mailing_store.job(job_id)["extraction"]["lineItems"]
        self.admin_approve(job_id, corrected_data={"quantityMetres": 11000})
        after = mailing_store.job(job_id)["extraction"]["lineItems"]
        self.assertEqual(before, after)
        self.assertTrue(after)

    def test_the_team_tasks_are_closed_when_the_order_is(self):
        job_id = self.released_job()
        self.assertTrue(all(t["status"] == "OPEN" for t in mailing_store.tasks(job_id)))
        self.run_gated(FakeKpac(document_no="1"), job_id)
        self.assertTrue(all(t["status"] == "DONE" for t in mailing_store.tasks(job_id)))

    def test_a_dry_run_produces_no_document_and_therefore_no_bill(self):
        job_id = self.released_job()
        run = self.run_gated(FakeKpac(outcome="dry_run", dry_run=True), job_id)

        self.assertFalse(run.ok)
        self.assertEqual(run.steps[0].status, "done")
        self.assertEqual(run.steps[1].status, "failed")
        self.assertIn("DRY RUN", run.steps[1].detail)
        self.assertIsNone(mailing_store.proforma_for_job(job_id))
        self.assertIsNone(self.outbound(job_id, "DISPATCH_NOTICE"))

    def test_a_pause_is_retryable_and_never_a_rejection(self):
        job_id = self.released_job()
        run = self.run_gated(FakeKpac(outcome="paused"), job_id)

        self.assertFalse(run.ok)
        self.assertTrue(run.paused)
        self.assertIsNone(mailing_store.saved_pact_push(job_id))
        self.assertIsNone(mailing_store.proforma_for_job(job_id))
        # Not rejected, not closed - still exactly where it was.
        self.assertEqual(mailing_store.job(job_id)["status"], "AWAITING_ACCOUNTS_APPROVAL")

        # And it resumes the moment PACT is open again.
        resumed = self.run_gated(FakeKpac(document_no="2"), job_id)
        self.assertTrue(resumed.ok, [s.detail for s in resumed.steps])
        self.assertEqual(mailing_store.saved_pact_push(job_id)["documentNo"], "2")

    def test_a_failure_stops_before_the_bill(self):
        job_id = self.released_job()
        run = self.run_gated(FakeKpac(outcome="failed"), job_id)
        self.assertFalse(run.ok)
        self.assertFalse(run.paused)
        self.assertEqual(run.steps[0].status, "failed")
        self.assertIsNone(mailing_store.proforma_for_job(job_id))

    def test_re_running_does_not_bill_twice(self):
        """A completed order re-run is a no-op, not a second document and a second bill."""
        job_id = self.released_job()
        self.run_gated(FakeKpac(document_no="1"), job_id)
        self.assertEqual(mailing_store.job(job_id)["status"], "COMPLETED")
        before = len([e for e in mailing_store.emails() if e.get("kind") == "PROFORMA"])

        kpac = FakeKpac(document_no="1")
        again = self.run_gated(kpac, job_id)
        after = len([e for e in mailing_store.emails() if e.get("kind") == "PROFORMA"])

        self.assertTrue(again.ok)
        self.assertEqual(before, after, "a re-run must not send a second proforma")
        self.assertEqual(kpac.records, [], "a re-run must not create a second PACT entry")

    def test_a_customer_not_in_the_pact_master_fails_that_order_and_stops(self):
        """The demo's own hard stop, end to end rather than in isolation."""
        result = self.inject(
            from_address="procurement@mothersonsumi.com",
            to_address="orders@kirancable.com",
            subject="Purchase Order PO-MOTH-2026-500",
            body_text="Please supply 5,000 m.\nValue Rs 75,000\nDelivery: 2026-10-15",
            actor="tester",
            attachments=[write_service.DirectMailAttachment("po.pdf", "application/pdf", pdf("moth"))],
        )
        job_id = result["ingestJobId"]
        self.admin_approve(job_id)

        run = self.run_gated(FakeKpac(), job_id)
        self.assertFalse(run.ok)
        self.assertEqual(run.steps[0].status, "failed")
        self.assertIn("customer not in PACT master", run.steps[0].detail)
        self.assertIn("Motherson Sumi Systems Ltd", run.steps[0].detail)
        self.assertIsNone(mailing_store.proforma_for_job(job_id))


# --------------------------------------------------------------------------- #
# Where demo mail actually goes                                                #
# --------------------------------------------------------------------------- #


class TestMailRedirect(PipelineTestCase):
    """The demo customers live on reserved `.example` domains and can never receive mail.

    That is the safety property: it is not possible to mail a real company by accident.
    `DEMO_MAIL_REDIRECT` is how a presenter still gets the messages in front of them, and
    the thing it must not do is lose track of who each message was written for.
    """

    def test_without_a_redirect_nothing_is_re_addressed(self):
        # Explicitly unset: a developer's own .env usually names their inbox here, and
        # this test is about the behaviour when nothing does.
        with patch.dict("os.environ", {"DEMO_MAIL_REDIRECT": ""}):
            job_id = self.demo_order()["ingestJobId"]
        receipt = self.outbound(job_id, "RECEIPT")
        self.assertEqual(receipt["toAddress"], MEGHDOOT.contact_email)
        self.assertEqual(receipt["deliveredTo"], MEGHDOOT.contact_email)
        self.assertNotIn("[DEMO to", receipt["subject"])

    def test_a_redirect_keeps_both_addresses_on_the_ledger(self):
        with patch.dict("os.environ", {"DEMO_MAIL_REDIRECT": "presenter@example.test"}):
            job_id = self.demo_order()["ingestJobId"]

        receipt = self.outbound(job_id, "RECEIPT")
        # Who it was for, and where it went. A redirected run is only reviewable because
        # both are kept.
        self.assertEqual(receipt["toAddress"], MEGHDOOT.contact_email)
        self.assertEqual(receipt["deliveredTo"], "presenter@example.test")
        # And the stored subject is still the real one - the redirect marker is added at
        # transmission, not written into the record.
        self.assertNotIn("[DEMO to", receipt["subject"])

    def test_the_fabricated_dispatch_details_are_redirected_too(self):
        """The one message with invented facts in it must not reach a real address."""
        with patch.dict("os.environ", {"DEMO_MAIL_REDIRECT": "presenter@example.test"}):
            job_id = self.demo_order()["ingestJobId"]
            self.admin_approve(job_id)
            with FakeKpac(document_no="1").install():
                asyncio.run(po_pipeline.run_after_accounts_approval(job_id))

        notice = self.outbound(job_id, "DISPATCH_NOTICE")
        self.assertEqual(notice["deliveredTo"], "presenter@example.test")
        self.assertEqual(notice["toAddress"], MEGHDOOT.contact_email)


# --------------------------------------------------------------------------- #
# The HTTP surface                                                             #
# --------------------------------------------------------------------------- #


class TestHttpSurface(PipelineTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client = TestClient(app)

    def test_the_public_confirmation_link_is_gone(self):
        """It was the customer gate's only door. Removing the gate removes the door."""
        self.assertEqual(self.client.get("/api/confirm/anything").status_code, 404)

    def test_the_board_lists_jobs_that_reached_the_pipeline(self):
        self.demo_order()
        rows = self.client.get("/api/po-pipeline").json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "AWAITING_ADMIN_APPROVAL")
        self.assertEqual(rows[0]["customer"], MEGHDOOT.name)

    def test_the_view_shows_the_line_items_and_the_tasks(self):
        job_id = self.demo_order()["ingestJobId"]
        body = self.client.get(f"/api/po-pipeline/{job_id}").json()
        self.assertEqual(body["status"], "AWAITING_ADMIN_APPROVAL")
        self.assertTrue(body["lineItems"], "the view should carry the order's lines")
        self.assertEqual(body["tasks"], [])

    def test_the_console_cannot_run_the_pact_half_without_accounts(self):
        job_id = self.demo_order()["ingestJobId"]
        response = self.client.post(f"/api/po-pipeline/{job_id}/run")
        self.assertEqual(response.status_code, 409)
        self.assertIn("Accounts have not released", response.json()["detail"])

    def test_the_two_approval_endpoints_walk_the_order_through(self):
        job_id = self.demo_order()["ingestJobId"]

        first = self.client.post(f"/api/admin/mailing/jobs/{job_id}/approve", json={})
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()["status"], "AWAITING_ACCOUNTS_APPROVAL")

        with FakeKpac(document_no="1").install():
            second = self.client.post(
                f"/api/admin/mailing/jobs/{job_id}/accounts-approve", json={}
            )
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(second.json()["documentNo"], "1")
        self.assertEqual(mailing_store.job(job_id)["status"], "COMPLETED")

    def test_the_tasks_endpoint_lists_what_the_approval_created(self):
        job_id = self.demo_order()["ingestJobId"]
        self.admin_approve(job_id)
        rows = self.client.get("/api/admin/mailing/tasks", params={"jobId": job_id}).json()
        self.assertEqual(sorted(r["team"] for r in rows), ["ACCOUNTS", "MANUFACTURING", "SALES"])


if __name__ == "__main__":
    unittest.main()
