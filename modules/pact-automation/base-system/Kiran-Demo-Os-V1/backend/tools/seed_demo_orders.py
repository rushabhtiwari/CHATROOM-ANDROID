"""Put the console into its opening position for a demo.

Three orders from three of the four demo customers, each parked at a different point in
the pipeline, so the Orders board shows the whole shape at a glance rather than one row:

    1. Meghdoot   awaiting ADMIN approval     - the live one, to walk through on stage
    2. Sahyadri   awaiting ACCOUNTS approval  - admin approved, team tasked, not in PACT
    3. Vaijanti   completed                   - through both gates, drafted, closed out

Both gates get shown that way: the first order needs an admin, the second needs Accounts,
and the third is what "done" looks like.

Run it from `backend/`:

    python tools/seed_demo_orders.py            # reset and seed
    python tools/seed_demo_orders.py --keep     # add to whatever is already there

The PACT step is faked here on purpose: seeding is something you do before the demo, and
it must not depend on the PACT window being open, or type into it while somebody is
setting up. The *live* proof is `tools/demo_po_e2e.py --live-pact`, which drives the real
robot.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.demo_customers import DEMO_CUSTOMERS  # noqa: E402
from app.mailing_store import mailing_store  # noqa: E402
from app.write_service import mailing as write_service  # noqa: E402
from app.write_service import po_pipeline  # noqa: E402


class FakeKpac:
    """KPAC's surface, in memory, following the real entry lifecycle."""

    def __init__(self, document_no: str):
        self.document_no = document_no

    async def status(self):
        return {
            "worker_alive": True,
            "settings": {"profile": "pact_purchase_order", "dry_run": False},
        }

    async def create_entry(self, record, source=""):
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


def arrive(customer, po: str, quantity: int, value: int, delivery: str, tag: str) -> str:
    result = write_service.inject_direct_email(
        write_service.DirectMailInput(
            from_address=customer.contact_email,
            to_address="orders@kirancable.com",
            subject=f"Purchase Order {po}",
            body_text=(
                "Dear Sir,\n\n"
                f"Please supply {quantity:,} m of cable protection sleeving against this order.\n"
                f"Value Rs {value:,}\n"
                f"Delivery: {delivery}\n\n"
                "Regards,\nPurchase Department"
            ),
            actor="demo-seed",
            attachments=[
                write_service.DirectMailAttachment(
                    f"{po}.pdf", "application/pdf", f"%PDF-1.4\n{tag}\n%%EOF\n".encode()
                )
            ],
        )
    )
    return result["ingestJobId"]


def admin_approve(job_id: str) -> None:
    """Gate 1, as an admin clicking Approve in the console would do it."""
    write_service.resolve_on_hold_item(
        write_service.ResolveOnHoldInput(
            job_id=job_id, action="COMMIT_EDITED", actor="demo-seed"
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep", action="store_true", help="do not reset the ledger first")
    args = parser.parse_args()

    if not args.keep:
        mailing_store.reset()

    meghdoot, sahyadri, vaijanti, _ = DEMO_CUSTOMERS

    # 1 - the live one. Nobody has looked at it yet: gate 1 is in front of it.
    waiting_admin = arrive(meghdoot, "PO-MEG-2026-001", 12000, 180000, "2026-10-15", "meg")

    # 2 - an admin has approved. The customer has their acknowledgement and the three
    #     teams have their tasks; Accounts have not released it, so PACT is untouched.
    waiting_accounts = arrive(sahyadri, "PO-SAH-2026-014", 8000, 124000, "2026-10-22", "sah")
    admin_approve(waiting_accounts)

    # 3 - through both gates. Drafted in PACT, proforma and dispatch notice sent, tasks closed.
    done = arrive(vaijanti, "PO-VAI-2026-007", 5000, 76500, "2026-11-03", "vai")
    admin_approve(done)
    with FakeKpac("1").install():
        asyncio.run(po_pipeline.run_after_accounts_approval(done, actor="demo-seed"))

    print("Seeded three orders:\n")
    for job_id in (waiting_admin, waiting_accounts, done):
        view = po_pipeline.pipeline_view(job_id)
        draft = next(
            (p["documentNo"] for p in view["pactPushes"] if p.get("documentNo")), "-"
        )
        tasks = view["tasks"]
        open_tasks = len([t for t in tasks if t.get("status") == "OPEN"])
        print(f"  {view['poNumber']:<18} {view['customer']}")
        print(
            f"      job {job_id}  |  {view['statusLabel']}"
            f"  |  lines: {len(view['lineItems'])}"
            f"  |  tasks: {open_tasks} open of {len(tasks)}"
            f"  |  PACT draft: {draft}"
        )

    print("\n  Gate 1 is on PO-MEG-2026-001, gate 2 is on PO-SAH-2026-014.")
    print("  Open http://localhost:5173/admin/automation/orders\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
