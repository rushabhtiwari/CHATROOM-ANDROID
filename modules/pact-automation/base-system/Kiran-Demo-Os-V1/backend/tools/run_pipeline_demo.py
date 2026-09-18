"""Drive one purchase order end to end, and time every stage.

    python tools/run_pipeline_demo.py                     # the multi-line PO, KPAC faked
    python tools/run_pipeline_demo.py --po PO-MEG-2026-014
    python tools/run_pipeline_demo.py --live              # push to the real KPAC service

Without `--live` the KPAC HTTP surface is replaced with an in-memory stand-in that returns
a saved document, so the whole pipeline can be rehearsed on a laptop with PACT closed. The
record KPAC would have received is printed either way - which is the part worth reading,
because it is where "one PO, one document, every line item" is either true or not.

This resets the mailing ledger before it runs. Do not point it at a ledger you care about.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.demo_customers import DEMO_CUSTOMERS  # noqa: E402
from app.mailing_store import mailing_store  # noqa: E402
from app.write_service import mailing as write_service  # noqa: E402
from app.write_service import po_pipeline  # noqa: E402

DEMO_POS = Path(__file__).resolve().parents[1] / "demo-pos"


class FakeKpac:
    """KPAC's HTTP surface, in memory. The lifecycle is the real one."""

    def __init__(self, document_no: str = "DEMO-1"):
        self.document_no = document_no
        self.records: list[dict] = []

    async def status(self):
        return {"worker_alive": True, "settings": {"profile": "pact_purchase_order"}}

    async def create_entry(self, record, source=""):
        self.records.append(record)
        return {"id": 1, "status": "pending", "record": record}

    async def approve_entry(self, entry_id):
        return {"id": entry_id, "status": "approved"}

    async def entries(self):
        return [
            {
                "id": 1,
                "status": "saved",
                "error": "",
                "result": {"confirmation": {"record_id": self.document_no}},
            }
        ]

    def install(self):
        return patch.multiple(
            "app.pact_client",
            configured=lambda: True,
            status=self.status,
            create_entry=self.create_entry,
            approve_entry=self.approve_entry,
            entries=self.entries,
        )


class Stopwatch:
    def __init__(self):
        self.marks: list[tuple[str, float]] = []
        self._t = time.perf_counter()
        self._start = self._t

    def mark(self, name: str):
        now = time.perf_counter()
        self.marks.append((name, now - self._t))
        self._t = now

    @property
    def total(self) -> float:
        return time.perf_counter() - self._start

    def report(self):
        print("\n  Stage timings")
        for name, seconds in self.marks:
            print(f"    {name:<28} {seconds:7.2f}s")
        print(f"    {'TOTAL':<28} {self.total:7.2f}s")


def customer_for(po_number: str):
    prefix = po_number.split("-")[1].lower() if "-" in po_number else ""
    for customer in DEMO_CUSTOMERS:
        if customer.name.lower().startswith(prefix[:3]):
            return customer
    return DEMO_CUSTOMERS[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--po", default="PO-MEG-2026-015", help="which demo PDF to send")
    parser.add_argument("--live", action="store_true", help="use the real KPAC service")
    args = parser.parse_args()

    path = DEMO_POS / f"{args.po}.pdf"
    if not path.exists():
        print(f"No such demo PO: {path}\nRun tools/make_demo_pos.py first.")
        return 1

    customer = customer_for(args.po)
    mailing_store.reset()
    watch = Stopwatch()

    print(f"\n=== {args.po} from {customer.name} ===")

    # ---- the PO arrives ---------------------------------------------------
    result = write_service.inject_direct_email(
        write_service.DirectMailInput(
            from_address=customer.contact_email,
            to_address="orders@kirancable.com",
            subject=f"Kiran Order {args.po}",
            body_text=f"Please find attached our purchase order {args.po}.",
            actor="demo",
            attachments=[
                write_service.DirectMailAttachment(path.name, "application/pdf", path.read_bytes())
            ],
        )
    )
    watch.mark("intake + receipt")
    job_id = result["ingestJobId"]
    job = mailing_store.job(job_id)
    proposal = po_pipeline._proposal_of(job)

    print(f"\n  status            {job['status']}")
    print(f"  line items read   {len(proposal['lineItems'])}")
    for item in proposal["lineItems"]:
        print(
            f"    {item.get('sr','')}: {item.get('productCode','?'):<8}"
            f"{float(item.get('quantity') or 0):>10,.0f} {item.get('unit') or '':<5}"
            f"@ {float(item.get('rate') or 0):>10,.2f} = {float(item.get('value') or 0):>14,.2f}"
        )
    print(f"  order value       Rs {float(proposal['orderValue']):,.2f}")
    print(f"  receipt           {_mail(job_id, 'RECEIPT')}")

    # ---- gate 1: the admin ------------------------------------------------
    write_service.resolve_on_hold_item(
        write_service.ResolveOnHoldInput(job_id=job_id, action="COMMIT_EDITED", actor="admin")
    )
    watch.mark("admin approval")
    print(f"\n  status            {mailing_store.job(job_id)['status']}")
    print(f"  acknowledgement   {_mail(job_id, 'ACKNOWLEDGEMENT')}")
    for task in mailing_store.tasks(job_id):
        print(f"  task              {task['team']:<14} {task['status']:<6} {task['body']}")

    # ---- gate 2: Accounts -------------------------------------------------
    kpac = FakeKpac()
    if args.live:
        run = asyncio.run(po_pipeline.run_after_accounts_approval(job_id, actor="accounts"))
    else:
        with kpac.install():
            run = asyncio.run(po_pipeline.run_after_accounts_approval(job_id, actor="accounts"))
    watch.mark("accounts approval + PACT")

    print(f"\n  status            {mailing_store.job(job_id)['status']}")
    for step in run.steps:
        print(f"  step              {step.step:<18} {step.status:<7} {step.detail}")

    if kpac.records:
        record = kpac.records[0]
        print(f"\n  KPAC entries created   {len(kpac.records)}  (must be 1: one PO, one document)")
        print(f"  vendor_name            {record['vendor_name']}")
        print(f"  party_ref_no           {record['party_ref_no']}")
        print(f"  grid rows              {len(record['line_items'])}")
        for row in record["line_items"]:
            print(f"    {row['product_code']:<8} qty {row['qty']:<8} unit_price {row['unit_price']}")

    push = mailing_store.saved_pact_push(job_id) or {}
    print(f"\n  PACT document     {push.get('documentNo')}")
    print(f"  proforma          {_mail(job_id, 'PROFORMA')}")
    print(f"  dispatch notice   {_mail(job_id, 'DISPATCH_NOTICE')}")
    print(f"  tasks closed      {[t['status'] for t in mailing_store.tasks(job_id)]}")

    watch.report()
    ok = mailing_store.job(job_id)["status"] == "COMPLETED"
    print(f"\n  {'PASS' if ok else 'FAIL'} - final status "
          f"{mailing_store.job(job_id)['status']}\n")
    return 0 if ok else 1


def _mail(job_id: str, kind: str) -> str:
    row = next(
        (e for e in mailing_store.emails()
         if e.get("ingestJobId") == job_id and e.get("kind") == kind),
        None,
    )
    if not row:
        return "(not sent)"
    where = row.get("deliveredTo") or row.get("toAddress")
    state = "SENT" if row.get("sent") else "recorded, not transmitted"
    return f"{state} -> {where}"


if __name__ == "__main__":
    raise SystemExit(main())
