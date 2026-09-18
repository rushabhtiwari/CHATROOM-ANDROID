"""The mailing hub's opening position.

Built in code rather than checked in as JSON, because every timestamp is
relative to the moment the server first starts: the analytics window is always
populated, the SLA chart always has both sides of the target line, and the
Pareto always has a long tail — on a laptop opened for the first time in weeks.

The customers, products and PO shapes are the same ones the rest of the console
already uses, so a demo can move from the Mailing Hub to Sales Orders without
the names changing under the presenter.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from . import mailing_workflow as flow
from .demo_customers import DEMO_CUSTOMERS


def _iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# The reference data the intake filter reads. A sender outside this list is
# quarantined as INTAKE_FILTERED until an operator whitelists the domain.
DOMAINS = [
    ("mothersonsumi.com", "Motherson Sumi Systems Ltd", "CUST-001"),
    ("alstomtransport.in", "Alstom Transport India Ltd", "CUST-002"),
    ("gepower.co.in", "GE Power India Ltd", "CUST-003"),
    ("suzlon.com", "Suzlon Energy Ltd", "CUST-004"),
    ("raychemrpg.com", "Raychem RPG Pvt Ltd", "CUST-005"),
    ("cummins.co.in", "Cummins India Ltd", "CUST-006"),
] + [
    # The four synthetic demo customers. They are whitelisted here so a demo PO from any
    # of them passes the intake filter rather than landing in the quarantine queue, and
    # the company name attached to the domain is what the extractor reports as the
    # customer — which is in turn what PACT's party lookup has to resolve. The names must
    # therefore match `demo_customers.DEMO_CUSTOMERS` character for character.
    (c.domain, c.name, c.code)
    for c in DEMO_CUSTOMERS
]


def _field(value: Any, confidence: float, page: int, snippet: str, source: str = "MODEL") -> dict:
    """One extracted fact plus the evidence for it (§1.4).

    A value with no snippet behind it is pinned to 0.0 — the spec's rule that
    an unevidenced fact is worth nothing, encoded at the point of construction
    rather than checked later.
    """
    return {
        "value": value,
        "confidence": round(confidence, 3) if snippet else 0.0,
        "page": page,
        "bbox": [72, 120 + page * 40, 340, 148 + page * 40],
        "snippet": snippet,
        "source": source,
    }


def _attachment(filename: str, pages: int = 2, ocr: str = "DONE") -> dict:
    return {
        "id": f"DOC-{_sha(filename)[:8].upper()}",
        "filename": filename,
        "mimeType": "application/pdf",
        "sizeBytes": 84_000 + (len(filename) * 977) % 120_000,
        "sha256": _sha(filename),
        "ocrStatus": ocr,
        "pages": pages,
        "url": f"/uploads/mailing/{filename}",
    }


def build_seed() -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    emails: list[dict] = []
    jobs: list[dict] = []
    orders: list[dict] = []
    versions: list[dict] = []
    audit: list[dict] = []
    counters = {"email": 0, "job": 0, "order": 0, "orderVersion": 0, "companyDomain": 0, "audit": 0}

    def new_id(key: str, prefix: str) -> str:
        counters[key] += 1
        return f"{prefix}-{now:%Y}-{counters[key]:04d}"

    def add(
        *,
        hours_ago: float,
        sender: str,
        company: str,
        subject: str,
        status: str,
        po_number: str,
        value: float,
        product: str,
        quantity: int,
        confidence: float,
        cause: str | None = None,
        touched: bool = False,
        ack_after_minutes: float | None = None,
        attachment: str | None = None,
        body: str | None = None,
    ) -> None:
        received = now - timedelta(hours=hours_ago)
        email_id = new_id("email", "MAIL")
        job_id = new_id("job", "JOB")

        attachments = [_attachment(attachment)] if attachment else []
        text = body or (
            f"Dear Kiran Cable Protection,\n\n"
            f"Please find attached our purchase order {po_number} for {quantity:,} m of "
            f"{product}.\n\nDelivery is required against our standard schedule. Kindly "
            f"acknowledge receipt.\n\nRegards,\nProcurement Desk\n{company}"
        )

        emails.append(
            {
                "id": email_id,
                "messageId": f"<{_sha(po_number + sender)[:24]}@{sender.split('@')[-1]}>",
                "direction": "INBOUND",
                "source": "IMAP",
                "fromAddress": sender,
                "toAddress": "orders@kirancable.com",
                "subject": subject,
                "bodyText": text,
                "receivedAt": _iso(received),
                "headers": {
                    "messageId": f"<{_sha(po_number + sender)[:24]}@{sender.split('@')[-1]}>",
                    "returnPath": sender,
                    "spf": "pass",
                    "dkim": "pass" if cause != "UNKNOWN_DOMAIN" else "none",
                    "dmarc": "pass" if cause != "UNKNOWN_DOMAIN" else "fail",
                },
                "attachments": attachments,
                "ingestJobId": job_id,
                "isArchived": False,
            }
        )

        extraction = {
            "fields": {
                "poNumber": _field(po_number, confidence, 1, f"Purchase Order No. {po_number}"),
                "customer": _field(company, min(0.99, confidence + 0.05), 1, company),
                "product": _field(product, confidence - 0.02, 1, product),
                "quantityMetres": _field(quantity, confidence - 0.01, 2, f"{quantity:,} m"),
                "orderValue": _field(value, confidence, 2, f"Rs {value:,.0f}"),
                "deliveryDate": _field(
                    _iso(received + timedelta(days=21))[:10],
                    0.62 if cause == "AMBIGUOUS_DATE" else confidence,
                    2,
                    "" if cause == "AMBIGUOUS_DATE" else "Delivery: 21 days from PO date",
                ),
            },
            "modelConfidence": round(confidence, 3),
        }

        # The seeded lifecycle is the route the real pipeline takes, hop by
        # hop, because the inspector renders it verbatim: a seeded row that
        # skipped VALIDATED would teach an operator the wrong shape.
        def step(minutes: float, status_name: str, actor: str, note: str = "") -> dict:
            return {
                "at": _iso(received + timedelta(minutes=minutes)),
                "status": status_name,
                "action": flow.action_for(status_name),
                "actor": actor,
                "note": note,
            }

        timeline = [step(0, "RECEIVED", "imap-watcher")]

        if status == "NOT_AN_ORDER":
            timeline.append(step(1, "NOT_AN_ORDER", "classifier", flow.CAUSE_LABEL.get(cause or "", "")))
        else:
            timeline.append(step(1, "CLASSIFIED", "classifier"))
            timeline.append(step(2, "EXTRACTING", "extractor"))

            if status == "EXCEPTION":
                timeline.append(step(4, "EXCEPTION", "extractor", flow.CAUSE_LABEL.get(cause or "", "")))
            else:
                timeline.append(step(3, "VALIDATED", "validator"))
                # Every order stops at the admin gate; the ones further along passed
                # through it rather than skipping it.
                timeline.append(step(4, "AWAITING_ADMIN_APPROVAL", "pipeline",
                                     "Receipt sent. Held for an admin to approve."))
                if status != "AWAITING_ADMIN_APPROVAL":
                    timeline.append(step(5, "COMMITTED", "admin"))

        order_id = None
        if flow.is_committed(status):
            order_id = new_id("order", "ORD")
            version_id = new_id("orderVersion", "OV")
            orders.append(
                {
                    "id": order_id,
                    "poNumber": po_number,
                    "customer": company,
                    "customerCode": next((code for dom, name, code in DOMAINS if name == company), "CUST-000"),
                    "orderValue": value,
                    "status": "OPEN",
                    "sourceJobId": job_id,
                    "headVersionId": version_id,
                    "versionNo": 1,
                    "createdAt": _iso(received + timedelta(minutes=5)),
                    "isArchived": False,
                }
            )
            versions.append(
                {
                    "id": version_id,
                    "orderId": order_id,
                    "versionNo": 1,
                    "reason": "INITIAL_COMMIT",
                    "actor": "pipeline" if not touched else "r.deshmukh",
                    "payload": {
                        "poNumber": po_number,
                        "customer": company,
                        "product": product,
                        "quantityMetres": quantity,
                        "orderValue": value,
                    },
                    "createdAt": _iso(received + timedelta(minutes=5)),
                }
            )

        acknowledged_at = None
        if ack_after_minutes is not None:
            acknowledged_at = _iso(received + timedelta(minutes=ack_after_minutes))
            ack_id = new_id("email", "MAIL")
            emails.append(
                {
                    "id": ack_id,
                    "messageId": f"<ack-{_sha(po_number)[:20]}@kirancable.com>",
                    "direction": "OUTBOUND",
                    "source": "SYSTEM",
                    "fromAddress": "orders@kirancable.com",
                    "toAddress": sender,
                    "subject": f"Acknowledged: {po_number} — Kiran Cable Protection",
                    "bodyText": (
                        f"We confirm receipt of purchase order {po_number} for "
                        f"{quantity:,} m of {product}.\n\nOrder reference: {order_id}\n"
                        "Our despatch team will confirm the schedule within one working day."
                    ),
                    "receivedAt": acknowledged_at,
                    "headers": {
                        "messageId": f"<ack-{_sha(po_number)[:20]}@kirancable.com>",
                        "returnPath": "orders@kirancable.com",
                        "spf": "pass",
                        "dkim": "pass",
                        "dmarc": "pass",
                    },
                    "attachments": [],
                    "ingestJobId": job_id,
                    "isArchived": False,
                }
            )
            timeline.append(
                {
                    "at": acknowledged_at,
                    "status": "ACKNOWLEDGED",
                    "action": flow.action_for("ACKNOWLEDGED"),
                    "actor": "ack-dispatcher",
                    "note": f"Acknowledgement {ack_id} dispatched",
                }
            )

        jobs.append(
            {
                "id": job_id,
                "emailLogId": email_id,
                "status": status,
                "holdReason": flow.hold_reason_for(status),
                "cause": cause,
                "confidence": round(confidence, 3),
                "extraction": extraction,
                "correctedJson": None,
                "orderId": order_id,
                "touchedByHuman": touched,
                "createdAt": _iso(received),
                "updatedAt": _iso(received + timedelta(minutes=4)),
                "committedAt": _iso(received + timedelta(minutes=5)) if order_id else None,
                "acknowledgedAt": acknowledged_at,
                "timeline": timeline,
                "isArchived": False,
            }
        )

    # ---- Straight through: clean extractions, acknowledged inside SLA ------
    add(hours_ago=4, sender="procurement@mothersonsumi.com", company="Motherson Sumi Systems Ltd",
        subject="PO PO-MOTH-2026-881 — Silicone Coated Fiberglass Sleeve 6mm",
        status="ACKNOWLEDGED", po_number="PO-MOTH-2026-881", value=2_829_167, quantity=180_000,
        product="Silicone Coated Fiberglass Sleeve 6mm Black", confidence=0.97,
        ack_after_minutes=6, attachment="PO-MOTH-2026-881.pdf")

    add(hours_ago=9, sender="orders@alstomtransport.in", company="Alstom Transport India Ltd",
        subject="Purchase Order PO-ALST-2026-904",
        status="ACKNOWLEDGED", po_number="PO-ALST-2026-904", value=3_926_667, quantity=300_000,
        product="Class H Varnished Sleeving 4mm Amber", confidence=0.96,
        ack_after_minutes=8, attachment="PO-ALST-2026-904.pdf")

    add(hours_ago=27, sender="supplychain@gepower.co.in", company="GE Power India Ltd",
        subject="PO-GE-2026-412 Braided Expandable Sleeving",
        status="ACKNOWLEDGED", po_number="PO-GE-2026-412", value=1_894_286, quantity=175_000,
        product="Braided Expandable Sleeving 18mm Black", confidence=0.95,
        ack_after_minutes=11, attachment="PO-GE-2026-412.pdf")

    add(hours_ago=51, sender="buyer@suzlon.com", company="Suzlon Energy Ltd",
        subject="New order — PO-SUZ-2026-118",
        status="ACKNOWLEDGED", po_number="PO-SUZ-2026-118", value=2_460_000, quantity=190_000,
        product="Silicone Coated Fiberglass Sleeve 8mm Black", confidence=0.94,
        ack_after_minutes=9, attachment="PO-SUZ-2026-118.pdf")

    # One that cleared the pipeline but missed the 15-minute ACK target, so the
    # SLA panel has a real breach to show rather than a flat 100%.
    add(hours_ago=74, sender="materials@cummins.co.in", company="Cummins India Ltd",
        subject="PO-CUM-2026-233 — Heat-shrink tubing",
        status="ACKNOWLEDGED", po_number="PO-CUM-2026-233", value=980_400, quantity=64_000,
        product="Heat-Shrink Tubing 12mm Black", confidence=0.93,
        ack_after_minutes=41, attachment="PO-CUM-2026-233.pdf")

    # ---- On hold: the admin gate -----------------------------------------
    add(hours_ago=2, sender="procurement@raychemrpg.com", company="Raychem RPG Pvt Ltd",
        subject="PO-RPG-2026-556 — bulk order, please confirm",
        status="AWAITING_ADMIN_APPROVAL", po_number="PO-RPG-2026-556", value=6_450_000, quantity=420_000,
        product="PU Coated Sleeve 4mm Clear", confidence=0.96,
        attachment="PO-RPG-2026-556.pdf")

    # ---- On hold: extraction exceptions -----------------------------------
    add(hours_ago=5, sender="orders@alstomtransport.in", company="Alstom Transport India Ltd",
        subject="Revised PO — delivery date under discussion",
        status="EXCEPTION", po_number="PO-ALST-2026-917", value=1_240_000, quantity=96_000,
        product="Class H Varnished Sleeving 6mm Amber", confidence=0.88,
        cause="AMBIGUOUS_DATE", attachment="PO-ALST-2026-917.pdf")

    add(hours_ago=7, sender="procurement@mothersonsumi.com", company="Motherson Sumi Systems Ltd",
        subject="Scanned PO — apologies for the quality",
        status="EXCEPTION", po_number="PO-MOTH-2026-889", value=742_000, quantity=52_000,
        product="Silicone Coated Fiberglass Sleeve 6mm Black", confidence=0.71,
        cause="LOW_CONFIDENCE", attachment="PO-MOTH-2026-889-scan.pdf")

    add(hours_ago=13, sender="supplychain@gepower.co.in", company="GE Power India Ltd",
        subject="Fwd: PO-GE-2026-412 (resending)",
        status="EXCEPTION", po_number="PO-GE-2026-412", value=1_894_286, quantity=175_000,
        product="Braided Expandable Sleeving 18mm Black", confidence=0.95,
        cause="DUPLICATE_PO", attachment="PO-GE-2026-412-fwd.pdf")

    add(hours_ago=31, sender="buyer@suzlon.com", company="Suzlon Energy Ltd",
        subject="PO with new part code",
        status="EXCEPTION", po_number="PO-SUZ-2026-140", value=515_000, quantity=38_000,
        product="KU-SLV-XX-0000 (unmapped)", confidence=0.90,
        cause="UNMAPPED_PRODUCT", attachment="PO-SUZ-2026-140.pdf")

    add(hours_ago=55, sender="materials@cummins.co.in", company="Cummins India Ltd",
        subject="PO attached (photo of printout)",
        status="EXCEPTION", po_number="PO-CUM-2026-244", value=306_000, quantity=21_000,
        product="Heat-Shrink Tubing 8mm Black", confidence=0.34,
        cause="OCR_FAILURE", attachment="PO-CUM-2026-244-photo.pdf")

    # ---- On hold: filtered at intake, unknown domains ----------------------
    add(hours_ago=3, sender="sales@newvendor-industries.com", company="Newvendor Industries",
        subject="Introducing our cable protection range",
        status="NOT_AN_ORDER", po_number="", value=0, quantity=0,
        product="", confidence=0.0, cause="UNKNOWN_DOMAIN",
        body=("Hello,\n\nWe are a manufacturer of cable protection products and would "
              "like to introduce our range. Please find our catalogue attached.\n\n"
              "Best regards,\nSales Team"),
        attachment="Newvendor-Catalogue.pdf")

    add(hours_ago=19, sender="purchase@bharatelectric.co.in", company="Bharat Electric Works",
        subject="Order for braided sleeving — urgent",
        status="NOT_AN_ORDER", po_number="PO-BEW-2026-007", value=430_000, quantity=31_000,
        product="Braided Expandable Sleeving 12mm Black", confidence=0.91,
        cause="UNKNOWN_DOMAIN", attachment="PO-BEW-2026-007.pdf")

    add(hours_ago=44, sender="noreply@marketing-blast.net", company="Marketing Blast",
        subject="Q3 industrial procurement webinar",
        status="NOT_AN_ORDER", po_number="", value=0, quantity=0,
        product="", confidence=0.0, cause="UNKNOWN_DOMAIN",
        body="Join our webinar on procurement automation. Unsubscribe at any time.")

    # ---- Mid-flight, so the ledger is not entirely settled ----------------
    add(hours_ago=0.2, sender="procurement@raychemrpg.com", company="Raychem RPG Pvt Ltd",
        subject="PO-RPG-2026-561",
        status="EXTRACTING", po_number="PO-RPG-2026-561", value=388_000, quantity=27_000,
        product="PU Coated Sleeve 6mm Clear", confidence=0.0,
        attachment="PO-RPG-2026-561.pdf")

    audit.append(
        {
            "id": f"AUD-{now:%Y}-0001",
            "at": _iso(now - timedelta(hours=1)),
            "actor": "system",
            "action": "SEED",
            "subjectType": "MailingStore",
            "subjectId": "-",
            "note": "Mailing hub initialised with the demo ledger.",
        }
    )
    counters["audit"] = 1

    return {
        "version": 1,
        "emails": emails,
        "jobs": jobs,
        "orders": orders,
        "orderVersions": versions,
        # The PACT bridge and the team's task list. Empty at seed time: all three are
        # records of things that happened to a real message, and the seeded history
        # predates them.
        "pactPushes": [],
        "proformas": [],
        "teamTasks": [],
        "companyDomains": [
            {
                "id": f"DOM-{now:%Y}-{index + 1:04d}",
                "domain": domain,
                "companyName": name,
                "companyCode": code,
                "addedAt": _iso(now - timedelta(days=180)),
                "addedBy": "seed",
            }
            for index, (domain, name, code) in enumerate(DOMAINS)
        ],
        "monitor": {
            "connection": "IMAP",
            "host": "imap.kirancable.com",
            "mailbox": "orders@kirancable.com",
            "state": "RUNNING",
            "paused": False,
            "intervalSeconds": 20,
            "lastCheckedAt": _iso(now - timedelta(seconds=42)),
            "lastMessageAt": _iso(now - timedelta(minutes=12)),
            "lastError": None,
            "pollCount": 1_284,
        },
        "audit": audit,
        "seq": {
            "email": counters["email"],
            "job": counters["job"],
            "order": counters["order"],
            "orderVersion": counters["orderVersion"],
            "companyDomain": len(DOMAINS),
            "audit": counters["audit"],
            "pactPush": 0,
            "proforma": 0,
            "teamTask": 0,
        },
    }
