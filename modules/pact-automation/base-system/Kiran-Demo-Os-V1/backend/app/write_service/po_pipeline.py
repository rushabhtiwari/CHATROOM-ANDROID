"""The purchase-order pipeline, from a message on the ledger to a dispatched order.

This is part of the write service and obeys its monopoly: `mailing_store.mutate_*` is
called from here and from `mailing.py`, and from nowhere else.

```
  PO email read
        |
        +- run_on_intake            1. automatic receipt to the customer   <- NO GATE
        |                           2. internal notification               <- NO GATE
        |                              status: AWAITING_ADMIN_APPROVAL
        |
        |  ------------------------ GATE 1: the admin -----------------------
        |
        +- run_on_admin_approval    3. acknowledgement to the customer
        |                           4. tasks for Sales, Accounts, Manufacturing
        |                              status: AWAITING_ACCOUNTS_APPROVAL
        |
        |  ------------------------ GATE 2: Accounts ------------------------
        |
        +- run_after_accounts_approval
                                    5. ONE PACT Purchase Order draft, every line
                                       item, ONE Save Draft
                                    6. demo proforma
                                    7. closing message: document number, demo
                                       dispatch date, demo tracking link
                                    8. the team's tasks are closed
                                       status: COMPLETED
```

## Why 1 and 2 are ungated

They cost nothing and commit nothing. A customer whose PO lands in an automated inbox
should hear that it arrived within seconds, not after somebody clicks something; Sales
seeing an order early is how a wrong price gets caught before any work starts. Neither
message may imply agreement, and for the receipt that is enforced in the wording itself
(`mailing_messages.assert_receipt_wording`) rather than by hoping.

## Why the rest is gated, absolutely

Everything after the first gate starts work inside the company, and everything after the
second writes into the accounting system. Both gates are people. There is no flag, no
confidence threshold and no timeout that reaches past either: an order nobody approves
sits where it is.

There is no customer-facing gate. The removed `AWAITING_CLIENT_CONFIRMATION` states put a
customer's mail client on the critical path of an internal workflow, which is a strange
place for it to be.

## The demo dispatch date and tracking link

Step 7 states a dispatch date and a tracking reference that are **invented**. Nothing has
been handed to a carrier. `mailing_messages.DEMO_DISPATCH_BANNER` says so in the body of
the message, and `SMTP_SEND` is off by default, so a rehearsal writes the mail to the
ledger without transmitting it. The demo customers live on reserved `.example` domains
that cannot receive mail at all, and `DEMO_MAIL_REDIRECT` sends everything to one inbox
the presenter owns.

## Rules every step shares

* **A step can fail without losing the order.** Each records its outcome and the run stops
  at the first failure with everything before it intact.
* **Re-running resumes.** Every step has an idempotency check, so a retry after a KPAC
  outage does not send a second receipt or bill twice.
* **A PACT pause is not a failure.** It is retryable the moment somebody opens PACT, and
  it must never be recorded as a rejection.
* **PACT is Save Draft only.** The robot's `post` action is not wired up at all.
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from .. import mailing_extraction
from .. import mailing_messages as messages
from .. import mailing_workflow as flow
from .. import pact_bridge, proforma as proforma_doc
from ..demo_customers import (
    DEMO_CUSTOMERS,
    PactMasterError,
    is_in_pact_master,
    kpac_profile,
    resolve_pact_party,
)
from ..mail_connection import resolve_connection, smtp_settings
from ..mailing_store import domain_of, mailing_store, now_iso
from ..smtp_sender import send_acknowledgement
from ..store import store as console_store
from .errors import WriteServiceError

PIPELINE_ACTOR = "pipeline"

SELLER_NAME = "Kiran Cable Protection Products Pvt Ltd"

#: The steps, in order. Named here so the timeline, the tests and the runbook all refer
#: to the same set rather than three hand-copied lists.
INTAKE_STEPS = ("receipt", "internal_notification")
ADMIN_STEPS = ("acknowledgement", "team_tasks")
ACCOUNTS_STEPS = ("pact_push", "proforma", "dispatch_notice", "close_tasks")

#: Kept as the old name because the console and the tests import it.
RECEIPT_STEPS = INTAKE_STEPS
GATED_STEPS = ACCOUNTS_STEPS

#: Who gets a task when an admin approves an order, and what each is asked to do.
#:
#: Three teams, one task each, created together so the order desk, the accounts desk and
#: the floor all learn about the same order at the same moment. `role` is what the console
#: notification is addressed to; the task row on the mailing ledger is the work itself.
TEAM_TASKS = (
    ("SALES", "Confirm the order with the customer's buyer and log the delivery promise."),
    ("ACCOUNTS", "Check credit and pricing, then release this order into PACT."),
    ("MANUFACTURING", "Schedule production against the line items on this order."),
)

def pact_auto_release(env: dict[str, str] | None = None) -> bool:
    """Whether the admin's approval releases the order straight into PACT.

    Off, the flow has two human gates: an admin approves, then Accounts release. On, the
    second gate is passed through automatically the moment the first is cleared - the
    acknowledgement and the team tasks still happen, and then the PACT draft, the
    proforma and the closing message follow without a second click. Every state the
    order passes through is unchanged, so the timeline still reads the same way and the
    Accounts queue still works for anyone who turns this off again.

    A setting rather than a code path, because which of the two a company wants is a
    question about its own sign-off rules, not about this software.
    """
    source = env if env is not None else os.environ
    return (source.get("PACT_AUTO_RELEASE") or "").strip().lower() in ("1", "true", "yes", "on")


#: How far ahead the demo's fabricated dispatch date sits. Invented - see the module
#: docstring. Overridable so a rehearsal can put it wherever the story needs it.
DEMO_DISPATCH_DAYS = int(os.getenv("DEMO_DISPATCH_DAYS") or 12)


@dataclass
class StepOutcome:
    step: str
    #: "done" | "paused" | "failed"
    status: str
    detail: str
    skipped: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "step": self.step,
            "status": self.status,
            "detail": self.detail,
            "skipped": self.skipped,
            "at": now_iso(),
        }


@dataclass
class PipelineRun:
    ok: bool
    paused: bool = False
    steps: list[StepOutcome] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "paused": self.paused,
            "steps": [s.as_dict() for s in self.steps],
        }


# --------------------------------------------------------------------------- #
# Shared helpers                                                               #
# --------------------------------------------------------------------------- #


def _app_url() -> str:
    return (os.getenv("KIRANOS_APP_URL") or "http://localhost:5173").rstrip("/")


def _job_or_die(job_id: str) -> dict:
    job = mailing_store.job(job_id)
    if not job:
        raise WriteServiceError(f"No ingest job matches '{job_id}'.", 404)
    return job


def _email_or_die(job: dict) -> dict:
    email = mailing_store.email(job["emailLogId"])
    if not email:
        raise WriteServiceError(f"Ingest job '{job['id']}' has no message behind it.", 404)
    return email


def _customer_address(job: dict) -> str:
    return (_email_or_die(job).get("fromAddress") or "").strip()


def _internal_recipients() -> list[str]:
    """Who gets the internal heads-up.

    Empty is a configuration problem rather than a silent no-op: a notification nobody
    receives is indistinguishable from one that was never built. The default is the demo's
    own sales desk so a fresh checkout still shows the step working.
    """
    raw = os.getenv("INTERNAL_NOTIFY_ADDRESSES") or "sales@kirancable.com"
    return [a.strip() for a in raw.replace(";", ",").split(",") if a.strip()]


def _record_step(job_id: str, outcome: StepOutcome) -> None:
    """Append to the job's own step log — the timeline the console renders."""
    job = mailing_store.job(job_id) or {}
    steps = list(job.get("pipelineSteps") or [])
    steps.append(outcome.as_dict())
    mailing_store.mutate_job_fields(job_id, {"pipelineSteps": steps})


def _redirect_to() -> str:
    """Where demo mail actually goes, when it is redirected.

    The four demo customers live on `.example` domains, which are reserved and will never
    accept mail. That is deliberate — it makes it impossible to mail a real company by
    accident. But a demo in front of a client wants the messages to *arrive* somewhere the
    presenter can open, so `DEMO_MAIL_REDIRECT` names one inbox and every customer-facing
    message goes there instead.

    The ledger records both addresses: `toAddress` stays the customer the message was
    written for, and `deliveredTo` says where it actually went. A redirected run is only
    reviewable because both are kept.
    """
    return (os.getenv("DEMO_MAIL_REDIRECT") or "").strip()


#: Domains reserved by RFC 2606 / RFC 6761. Mail to them cannot be delivered anywhere,
#: which is why the demo customers live on them.
RESERVED_DOMAINS = (".example", ".invalid", ".test", ".localhost")
RESERVED_EXACT = ("example.com", "example.net", "example.org")


def _allowed_recipients() -> set[str]:
    raw = os.getenv("DEMO_MAIL_ALLOWED") or ""
    return {a.strip().lower() for a in raw.replace(";", ",").split(",") if a.strip()}


def _allowed_domains() -> set[str]:
    """Whole domains a presenter has opted in, as `DEMO_MAIL_ALLOWED_DOMAINS`.

    `DEMO_MAIL_ALLOWED` names one address at a time, which is right when you know who
    will be sending. It is wrong for the demo this system is actually shown in: a
    colleague or a client sends a purchase order from whatever personal address is to
    hand, and every reply the pipeline writes for them - the receipt, the
    acknowledgement, the proforma, the closing message - is refused at the wire because
    nobody added that exact address to a list first. The order still runs; the person who
    sent it simply hears nothing, which reads as the automation being broken.

    So a domain can be opted in as a whole. `DEMO_MAIL_ALLOWED_DOMAINS=gmail.com` says
    "anybody sending from a Gmail address may receive the demo's replies", which pairs
    with `TRUSTED_SENDER_DOMAINS=gmail.com` on the way in: the same population that may
    send is the population that may be answered.

    It is deliberately not defaulted to anything. A domain listed here is a decision that
    real mail may leave this machine to real people at it, and that decision belongs in
    one visible line of `.env` rather than in this module.
    """
    raw = os.getenv("DEMO_MAIL_ALLOWED_DOMAINS") or ""
    return {
        d.strip().lower().lstrip("@")
        for d in raw.replace(";", ",").split(",")
        if d.strip()
    }


def may_transmit(address: str) -> tuple[bool, str]:
    """Whether this demo may actually put a message on the wire to `address`.

    `SMTP_SEND` is one environment variable away from mailing a real company a fabricated
    dispatch date and a tracking link for a consignment that does not exist. That is the
    one failure in this pipeline with consequences outside the demo, so it is refused here
    rather than trusted to configuration:

      * a reserved domain (`.example`, `.invalid`, `.test`) can never receive mail at all,
        which is exactly why the four demo customers live on one;
      * `DEMO_MAIL_REDIRECT` is the presenter's own inbox and is always allowed;
      * `DEMO_MAIL_ALLOWED` lists any other address a presenter has deliberately opted in;
      * `DEMO_MAIL_ALLOWED_DOMAINS` opts in a whole domain, for the demo where anybody may
        send an order from their own address and has to be answered at it.

    Anything else is recorded on the ledger and not transmitted. The operator sees why.
    """
    address = (address or "").strip().lower()
    if not address:
        return False, "no address"
    if "@" not in address:
        return False, f"refused: {address} is not an email address."

    domain = address.rsplit("@", 1)[-1]
    if domain in RESERVED_EXACT or any(domain.endswith(suffix) for suffix in RESERVED_DOMAINS):
        return True, ""
    if address == (_redirect_to() or "").strip().lower():
        return True, ""
    if address in _allowed_recipients():
        return True, ""
    if domain in _allowed_domains():
        return True, ""
    return False, (
        f"refused: {address} is a real address and this is a demo. Set DEMO_MAIL_REDIRECT "
        "to your own inbox, add the address to DEMO_MAIL_ALLOWED, or allow the whole "
        f"domain with DEMO_MAIL_ALLOWED_DOMAINS={domain}, to transmit to it."
    )


def _send(
    *,
    job: dict,
    kind: str,
    to_address: str,
    rendered: messages.RenderedEmail,
    dedupe_key: str,
) -> dict:
    """Write the outbound row, then try to transmit it.

    The row exists either way. `smtp_sender` never raises for a disabled or unconfigured
    mailer, so on a demo machine with no credentials every message is still on the ledger
    and readable in the Mails table — it simply says plainly that it was not transmitted.

    This is also the idempotency point for every message the pipeline sends: the dedupe
    key is `(kind, job)`, so a re-run claims the existing row rather than producing a
    second receipt or a second bill.
    """
    existing = next(
        (e for e in mailing_store.emails() if e.get("dedupeKey") == dedupe_key),
        None,
    )
    if existing:
        return existing

    redirect = _redirect_to()
    delivered_to = redirect or to_address
    subject = f"[DEMO to {to_address}] {rendered.subject}" if redirect else rendered.subject
    banner = (
        f"[This message was written for {to_address} and redirected here because "
        "DEMO_MAIL_REDIRECT is set. Nothing was sent to that address.]"
    )
    body_text = f"{banner}\n\n{rendered.text}" if redirect else rendered.text

    row = mailing_store.mutate_append_email(
        {
            "messageId": f"<{dedupe_key}@kirancable.com>",
            "direction": "OUTBOUND",
            "source": "SYSTEM",
            "kind": kind,
            "fromAddress": "orders@kirancable.com",
            "toAddress": to_address,
            "deliveredTo": delivered_to,
            "subject": rendered.subject,
            "bodyText": rendered.text,
            "bodyHtml": rendered.html,
            "headers": {
                "messageId": f"<{dedupe_key}@kirancable.com>",
                "returnPath": "orders@kirancable.com",
                "spf": "pass",
                "dkim": "pass",
                "dmarc": "pass",
            },
            "attachments": [],
            "ingestJobId": job["id"],
            "dedupeKey": dedupe_key,
        }
    )
    connection = resolve_connection()
    would_send = bool(connection) and smtp_settings(connection)["enabled"]
    permitted, refusal = may_transmit(delivered_to)
    if would_send and not permitted:
        # The row still exists and the console still shows the message; it simply was not
        # put on the wire. A demo that silently mails a real customer is worse than one
        # that visibly did not. When SMTP is off anyway, `send_acknowledgement` gives the
        # more accurate reason and this guard stays quiet.
        delivery = {"sent": False, "reason": refusal}
    else:
        delivery = send_acknowledgement(
            connection,
            to_address=delivered_to,
            subject=subject,
            body_text=body_text,
            body_html=rendered.html,
            reference=job["id"],
        )
    if redirect:
        delivery = {**delivery, "redirectedFrom": to_address}
    mailing_store.mutate_email_fields(row["id"], {"delivery": delivery, "sent": delivery["sent"]})
    return mailing_store.email(row["id"]) or row


def _already_sent(job_id: str, dedupe_key: str) -> bool:
    return any(e.get("dedupeKey") == dedupe_key for e in mailing_store.emails())


def _describe(row: dict) -> str:
    delivery = row.get("delivery") or {}
    where = row.get("deliveredTo") or row.get("toAddress")
    redirected = (
        f" (written for {row['toAddress']})"
        if row.get("deliveredTo") and row["deliveredTo"] != row.get("toAddress")
        else ""
    )
    if delivery.get("sent"):
        return f"sent to {where}{redirected} via {delivery.get('via', 'SMTP')}"
    return f"recorded for {where}{redirected} - {delivery.get('reason', 'not transmitted')}"


def _proposal_of(job: dict) -> dict:
    """The customer-facing view of what we read.

    Always `extraction`, never `correctedJson`. The two are not alternatives: `extraction`
    is the current best reading, already carrying any operator edits merged in by
    `_merge_corrections`, while `correctedJson` records only *which fields a human changed*
    and is a diff rather than a document. Reading the diff would silently drop every field
    the operator did not touch - including the PO number.
    """
    return mailing_extraction.proposal_from_extraction(job.get("extraction") or {})


# --------------------------------------------------------------------------- #
# Line items, shared by every message and by PACT                              #
# --------------------------------------------------------------------------- #


def _line_items(proposal: dict) -> list[dict]:
    return list(proposal.get("lineItems") or [])


def _line_summary(proposal: dict) -> str:
    """The order's lines as a plain-text block, for the customer-facing messages."""
    items = _line_items(proposal)
    if not items:
        return "  (no line items were read from the document)"
    rows = []
    for item in items:
        rows.append(
            "  {sr:>2}  {code:<8}{desc:<38}{qty:>10,.0f} {unit:<5}{value:>14,.2f}".format(
                sr=item.get("sr", ""),
                code=str(item.get("productCode") or ""),
                desc=str(item.get("description") or "")[:36],
                qty=float(item.get("quantity") or 0),
                unit=str(item.get("unit") or ""),
                value=float(item.get("value") or 0),
            )
        )
    return "\n".join(rows)


# --------------------------------------------------------------------------- #
# 1 + 2 — intake. No gate.                                                     #
# --------------------------------------------------------------------------- #


def run_on_intake(job_id: str, *, actor: str = PIPELINE_ACTOR) -> PipelineRun:
    """Send the automatic receipt and notify Sales, then park the order for an admin.

    Takes no approval argument, deliberately: this function *cannot* be made to depend on
    one, and so cannot drift behind a gate — or become the reason somebody moves a gate to
    get a receipt out sooner.
    """
    job = _job_or_die(job_id)
    email = _email_or_die(job)
    proposal = _proposal_of(job)
    run = PipelineRun(ok=True)

    # ---- 1. the automatic receipt ----------------------------------------
    receipt_key = f"ack-{job_id.lower()}"
    if _already_sent(job_id, receipt_key):
        outcome = StepOutcome("receipt", "done", "already sent on an earlier run", True)
    else:
        try:
            rendered = messages.render_receipt(
                po_number=str(proposal.get("poNumber") or ""),
                customer_name=str(proposal.get("customer") or ""),
                seller_name=SELLER_NAME,
                received_at=datetime.now(timezone.utc),
                line_count=len(_line_items(proposal)) or 1,
            )
            row = _send(
                job=job,
                kind="RECEIPT",
                to_address=email.get("fromAddress", ""),
                rendered=rendered,
                dedupe_key=receipt_key,
            )
            outcome = StepOutcome("receipt", "done", _describe(row))
        except Exception as error:  # noqa: BLE001 - a step failure is data, not a crash
            outcome = StepOutcome("receipt", "failed", str(error))

    run.steps.append(outcome)
    _record_step(job_id, outcome)
    if outcome.status != "done":
        run.ok = False
        return run

    # ---- 2. the internal notification ------------------------------------
    problem: Optional[str] = None
    try:
        resolve_pact_party(proposal.get("customer"))
    except PactMasterError as error:
        # Surfaced now, while somebody can still fix it, rather than after the admin has
        # approved and the push fails.
        problem = str(error)

    sent, failed = 0, []
    for index, address in enumerate(_internal_recipients()):
        key = f"notify-{job_id.lower()}-{index}"
        if _already_sent(job_id, key):
            sent += 1
            continue
        try:
            rendered = messages.render_internal_notification(
                po_number=str(proposal.get("poNumber") or ""),
                customer_name=str(proposal.get("customer") or ""),
                order_value=float(proposal.get("orderValue") or 0),
                quantity_metres=proposal.get("quantityMetres"),
                delivery_date=proposal.get("deliveryDate"),
                confidence=float(job.get("confidence") or 0),
                job_url=f"{_app_url()}/admin/mailing/inbox?job={job_id}",
                pact_master_problem=problem,
            )
            _send(
                job=job,
                kind="INTERNAL_NOTIFICATION",
                to_address=address,
                rendered=rendered,
                dedupe_key=key,
            )
            sent += 1
        except Exception as error:  # noqa: BLE001
            failed.append(f"{address}: {error}")

    if sent == 0:
        outcome = StepOutcome("internal_notification", "failed", "; ".join(failed) or "no recipients")
        run.ok = False
    else:
        detail = f"notified {sent} recipient(s)"
        if failed:
            detail += f"; {len(failed)} failed: {'; '.join(failed)}"
        if problem:
            detail += f" (flagged: {problem})"
        outcome = StepOutcome("internal_notification", "done", detail)

    run.steps.append(outcome)
    _record_step(job_id, outcome)
    return run


#: The old name. `_advance_pipeline` and the tests still call it.
def run_on_receipt(job_id: str, *, actor: str = PIPELINE_ACTOR) -> PipelineRun:
    return run_on_intake(job_id, actor=actor)


# --------------------------------------------------------------------------- #
# 3 + 4 — after the admin approves                                             #
# --------------------------------------------------------------------------- #


def run_on_admin_approval(job_id: str, *, actor: str = PIPELINE_ACTOR) -> PipelineRun:
    """Tell the customer their order is accepted, and put the work in front of the teams.

    Reached only from `COMMITTED`, which is only reachable from `AWAITING_ADMIN_APPROVAL`.
    Ends with the order parked at the Accounts gate.
    """
    job = _job_or_die(job_id)
    proposal = _proposal_of(job)
    run = PipelineRun(ok=True)

    # ---- 3. the acknowledgement ------------------------------------------
    ack_key = f"orderack-{job_id.lower()}"
    if _already_sent(job_id, ack_key):
        outcome = StepOutcome("acknowledgement", "done", "already sent on an earlier run", True)
    else:
        try:
            rendered = messages.render_order_acknowledgement(
                po_number=str(proposal.get("poNumber") or ""),
                customer_name=str(proposal.get("customer") or ""),
                seller_name=SELLER_NAME,
                line_summary=_line_summary(proposal),
                order_value=float(proposal.get("orderValue") or 0),
                delivery_date=str(proposal.get("deliveryDate") or ""),
            )
            row = _send(
                job=job,
                kind="ACKNOWLEDGEMENT",
                to_address=_customer_address(job),
                rendered=rendered,
                dedupe_key=ack_key,
            )
            outcome = StepOutcome("acknowledgement", "done", _describe(row))
        except Exception as error:  # noqa: BLE001
            outcome = StepOutcome("acknowledgement", "failed", str(error))

    run.steps.append(outcome)
    _record_step(job_id, outcome)
    if outcome.status != "done":
        run.ok = False
        return run

    # ---- 4. the team's tasks ---------------------------------------------
    created = _create_team_tasks(job, proposal)
    outcome = StepOutcome(
        "team_tasks",
        "done",
        f"tasked {', '.join(t['team'] for t in created)}" if created
        else "tasks already existed for this order",
        skipped=not created,
    )
    run.steps.append(outcome)
    _record_step(job_id, outcome)

    # ---- park at the Accounts gate ---------------------------------------
    current = mailing_store.job(job_id) or {}
    if current.get("status") == "COMMITTED":
        moved, error = mailing_store.mutate_transition(
            job_id, "ACKNOWLEDGED", actor,
            "Customer acknowledged and the team tasked. Nothing has reached PACT.",
        )
        if error:
            raise WriteServiceError(error, 409)
        current = moved or {}
    if (current or {}).get("status") == "ACKNOWLEDGED":
        _, error = mailing_store.mutate_transition(
            job_id, "AWAITING_ACCOUNTS_APPROVAL", actor,
            "Waiting for Accounts to release this order into PACT.",
        )
        if error:
            raise WriteServiceError(error, 409)
    return run


def _create_team_tasks(job: dict, proposal: dict) -> list[dict]:
    """One task per team, mirrored into the console's own notification panel.

    Idempotent on the job: a re-run finds the existing rows and creates nothing. The
    notification store is the console's existing one (`routers/notifications.py` reads it)
    — there is no second notification system here, only a second writer to the first.
    """
    existing = {t.get("team") for t in mailing_store.tasks(job["id"])}
    po_number = str(proposal.get("poNumber") or "")
    customer = str(proposal.get("customer") or "")
    created: list[dict] = []

    for team, what in TEAM_TASKS:
        if team in existing:
            continue
        task = mailing_store.mutate_append_task(
            {
                "ingestJobId": job["id"],
                "orderId": job.get("orderId"),
                "team": team,
                "title": f"{po_number} — {customer}",
                "body": what,
                "poNumber": po_number,
                "customer": customer,
                "orderValue": float(proposal.get("orderValue") or 0),
                "lineCount": len(_line_items(proposal)),
                "status": "OPEN",
            }
        )
        created.append(task)
        try:
            console_store.push_notification(
                {
                    "toRole": team,
                    "title": f"New task: {po_number or 'purchase order'}",
                    "body": f"{customer} — {what}",
                    "requestId": None,
                }
            )
        except Exception:  # noqa: BLE001 - a notification is not worth losing the task over
            pass
    return created


def _close_team_tasks(job_id: str, note: str) -> int:
    closed = 0
    for task in mailing_store.tasks(job_id):
        if task.get("status") == "OPEN":
            mailing_store.mutate_task_fields(task["id"], {"status": "DONE", "closedNote": note})
            closed += 1
    return closed


# --------------------------------------------------------------------------- #
# 5 - 8 — after Accounts release it                                            #
# --------------------------------------------------------------------------- #


async def run_after_accounts_approval(job_id: str, *, actor: str = PIPELINE_ACTOR) -> PipelineRun:
    """Fill one PACT draft, then close the order out with the customer and the team.

    Reachable only from `AWAITING_ACCOUNTS_APPROVAL`. Refuses from anywhere else, so
    nothing gets into PACT by another route.
    """
    job = _job_or_die(job_id)
    # PUSHED_TO_PACT and COMPLETED are here so a retry after a partial run resumes rather
    # than being refused - every step below is idempotent, so a re-run of a finished order
    # re-sends nothing and creates no second document.
    if job.get("status") not in ("AWAITING_ACCOUNTS_APPROVAL", "PUSHED_TO_PACT", "COMPLETED"):
        raise WriteServiceError(
            "Refusing to push an order Accounts have not released "
            f"(this one is {flow.label_for(job.get('status', ''))}).",
            409,
        )

    proposal = _proposal_of(job)
    run = PipelineRun(ok=True)

    # ---- 5. the PACT draft: ONE document, every line, ONE Save Draft ------
    saved = mailing_store.saved_pact_push(job_id)
    if saved:
        outcome = StepOutcome(
            "pact_push", "done", f"PACT draft {saved['documentNo']} already exists", True
        )
        result = pact_bridge.PactPushResult(
            status="SUCCEEDED", detail=outcome.detail, document_no=saved["documentNo"]
        )
    else:
        push = mailing_store.mutate_append_pact_push(
            {
                "ingestJobId": job_id,
                "orderId": job.get("orderId"),
                "status": "RUNNING",
                "profile": kpac_profile(),
                "lineCount": len(_line_items(proposal)),
                "startedAt": now_iso(),
            }
        )
        result = await pact_bridge.push_purchase_order(proposal)
        mailing_store.mutate_pact_push_fields(
            push["id"],
            {
                "status": result.status,
                "documentNo": result.document_no,
                "dryRun": result.dry_run,
                "entryId": result.entry_id,
                "priceNotes": result.price_notes,
                "mismatches": result.mismatches,
                "detail": result.detail,
                "finishedAt": now_iso(),
            },
        )
        status = {"SUCCEEDED": "done", "PAUSED": "paused", "FAILED": "failed"}[result.status]
        detail = result.detail
        if result.status == "SUCCEEDED" and not result.dry_run:
            detail += f" ({len(_line_items(proposal))} line item(s) in one document)"
        outcome = StepOutcome("pact_push", status, detail)

    run.steps.append(outcome)
    _record_step(job_id, outcome)

    if outcome.status == "paused":
        run.ok, run.paused = False, True
        return run
    if outcome.status != "done":
        run.ok = False
        return run

    if job.get("status") == "AWAITING_ACCOUNTS_APPROVAL" and result.document_no:
        mailing_store.mutate_transition(
            job_id, "PUSHED_TO_PACT", actor,
            f"PACT draft {result.document_no} saved (never posted).",
        )

    # ---- 6. the demo proforma --------------------------------------------
    if not result.document_no:
        detail = (
            "PACT ran in DRY RUN and produced no document, so no proforma was generated"
            if result.dry_run
            else "PACT returned no document number, so no proforma was generated"
        )
        outcome = StepOutcome("proforma", "failed", detail)
        run.steps.append(outcome)
        _record_step(job_id, outcome)
        run.ok = False
        return run

    proforma_key = f"proforma-{job_id.lower()}"
    if _already_sent(job_id, proforma_key):
        outcome = StepOutcome("proforma", "done", "already sent on an earlier run", True)
    else:
        try:
            html_doc = proforma_doc.render_proforma_html(
                document_no=result.document_no,
                proposal=proposal,
                seller_name=SELLER_NAME,
                pact_document_no=result.document_no,
                price_notes=result.price_notes,
            )
            totals = proforma_doc.proforma_totals(proposal)
            mailing_store.mutate_append_proforma(
                {
                    "ingestJobId": job_id,
                    "orderId": job.get("orderId"),
                    "documentNo": result.document_no,
                    "pactDocumentNo": result.document_no,
                    "html": html_doc,
                    "totals": totals,
                }
            )
            rendered = messages.render_proforma_email(
                po_number=str(proposal.get("poNumber") or ""),
                customer_name=str(proposal.get("customer") or ""),
                seller_name=SELLER_NAME,
                document_no=result.document_no,
                proforma_html=html_doc,
                total=totals["subtotal"],
            )
            row = _send(
                job=job,
                kind="PROFORMA",
                to_address=_customer_address(job),
                rendered=rendered,
                dedupe_key=proforma_key,
            )
            outcome = StepOutcome("proforma", "done", f"demo proforma {_describe(row)}")
        except Exception as error:  # noqa: BLE001
            outcome = StepOutcome("proforma", "failed", str(error))

    run.steps.append(outcome)
    _record_step(job_id, outcome)
    if outcome.status != "done":
        run.ok = False
        return run

    # ---- 7. the closing message ------------------------------------------
    dispatch_key = f"dispatch-{job_id.lower()}"
    if _already_sent(job_id, dispatch_key):
        outcome = StepOutcome("dispatch_notice", "done", "already sent on an earlier run", True)
    else:
        try:
            rendered = messages.render_final_dispatch(
                po_number=str(proposal.get("poNumber") or ""),
                customer_name=str(proposal.get("customer") or ""),
                seller_name=SELLER_NAME,
                document_no=result.document_no,
                dispatch_date=_demo_dispatch_date(),
                tracking_url=_demo_tracking_url(result.document_no),
                tracking_reference=_demo_tracking_reference(result.document_no),
                line_summary=_line_summary(proposal),
                order_value=float(proposal.get("orderValue") or 0),
            )
            row = _send(
                job=job,
                kind="DISPATCH_NOTICE",
                to_address=_customer_address(job),
                rendered=rendered,
                dedupe_key=dispatch_key,
            )
            outcome = StepOutcome("dispatch_notice", "done", _describe(row))
        except Exception as error:  # noqa: BLE001
            outcome = StepOutcome("dispatch_notice", "failed", str(error))

    run.steps.append(outcome)
    _record_step(job_id, outcome)
    if outcome.status != "done":
        run.ok = False
        return run

    # ---- 8. close the team's tasks ---------------------------------------
    closed = _close_team_tasks(job_id, f"PACT draft {result.document_no} saved; customer told.")
    try:
        console_store.push_notification(
            {
                "toRole": "ADMIN",
                "title": f"Order complete: {proposal.get('poNumber') or 'purchase order'}",
                "body": (
                    f"{proposal.get('customer') or 'Customer'} — PACT draft "
                    f"{result.document_no}, {len(_line_items(proposal))} line item(s). "
                    "The customer has been sent the dispatch notice."
                ),
                "requestId": None,
            }
        )
    except Exception:  # noqa: BLE001
        pass
    outcome = StepOutcome(
        "close_tasks", "done",
        f"closed {closed} team task(s) and posted the completion" if closed
        else "no open team tasks; posted the completion",
    )
    run.steps.append(outcome)
    _record_step(job_id, outcome)

    current = mailing_store.job(job_id) or {}
    if current.get("status") == "PUSHED_TO_PACT":
        mailing_store.mutate_transition(
            job_id, "COMPLETED", actor,
            f"Dispatch notice sent for PACT draft {result.document_no}. This order is complete.",
        )
    return run


def _demo_dispatch_date(now: Optional[datetime] = None) -> str:
    """A plausible dispatch date. Invented - see the module docstring."""
    moment = (now or datetime.now(timezone.utc)) + timedelta(days=DEMO_DISPATCH_DAYS)
    return moment.strftime("%d %b %Y")


def _demo_tracking_reference(document_no: str) -> str:
    digits = "".join(ch for ch in str(document_no) if ch.isdigit()) or "000000"
    return f"KCP-DEMO-{digits[-6:].rjust(6, '0')}"


def _demo_tracking_url(document_no: str) -> str:
    """A tracking link that points at this console, never at a carrier.

    A real carrier's URL in a demo message is a link somebody will click and be confused
    by. This one resolves inside the demo, where the fabricated consignment lives.
    """
    return f"{_app_url()}/track/{_demo_tracking_reference(document_no)}"


async def run_after_approval(job_id: str, *, actor: str = PIPELINE_ACTOR) -> PipelineRun:
    """The old name for `run_after_accounts_approval`, kept for existing callers."""
    return await run_after_accounts_approval(job_id, actor=actor)


def run_after_approval_sync(job_id: str, *, actor: str = PIPELINE_ACTOR) -> PipelineRun:
    """`run_after_accounts_approval` from a synchronous caller (a test, or a script)."""
    return asyncio.run(run_after_accounts_approval(job_id, actor=actor))


# --------------------------------------------------------------------------- #
# The timeline the console renders                                             #
# --------------------------------------------------------------------------- #


def summary() -> dict[str, Any]:
    """The figures the automation section is judged on.

    Counted from the records rather than from job status, because a status is one value
    and these are different questions: an order can be waiting at the Accounts gate *and*
    have a failed PACT attempt behind it. Counting the artefacts keeps the two apart.
    """
    jobs = mailing_store.jobs()
    by_status: dict[str, int] = {}
    for row in jobs:
        by_status[row.get("status", "")] = by_status.get(row.get("status", ""), 0) + 1

    pushes = mailing_store.pact_pushes()
    drafts = [p for p in pushes if p.get("status") == "SUCCEEDED" and p.get("documentNo")]
    paused = [p for p in pushes if p.get("status") == "PAUSED"]
    failed = [p for p in pushes if p.get("status") == "FAILED"]
    tasks = mailing_store.tasks()

    return {
        "awaitingAdmin": by_status.get("AWAITING_ADMIN_APPROVAL", 0),
        "awaitingAccounts": by_status.get("AWAITING_ACCOUNTS_APPROVAL", 0),
        "completed": by_status.get("COMPLETED", 0),
        "discarded": by_status.get("DISCARDED", 0),
        "pactDrafts": len(drafts),
        "pactPaused": len(paused),
        "pactFailed": len(failed),
        "proformas": len(mailing_store.proformas()),
        "tasksOpen": len([t for t in tasks if t.get("status") == "OPEN"]),
        "tasksDone": len([t for t in tasks if t.get("status") == "DONE"]),
        "kpacProfile": kpac_profile(),
        "pactAutoRelease": pact_auto_release(),
        # The robot's own liveness. The console's KPAC page reads this block; without it
        # the page could only ever say "offline", whatever KPAC was doing.
        "kpac": pact_bridge.kpac_status(),
        "demoCustomers": [
            {"name": c.name, "email": c.contact_email, "city": c.city} for c in DEMO_CUSTOMERS
        ],
        "mailRedirect": _redirect_to() or None,
        "internalRecipients": _internal_recipients(),
    }


def pipeline_view(job_id: str) -> dict[str, Any]:
    """Everything the PO pipeline knows about one job, in one read.

    The console renders this rather than assembling it from four endpoints, so what an
    operator sees is one consistent snapshot rather than four that raced.
    """
    job = _job_or_die(job_id)
    email = mailing_store.email(job["emailLogId"]) or {}
    pushes = mailing_store.pact_pushes(job_id)
    proforma = mailing_store.proforma_for_job(job_id)
    proposal = _proposal_of(job)

    outbound = [
        {
            "id": e["id"],
            "kind": e.get("kind") or "OUTBOUND",
            "to": e.get("toAddress"),
            "subject": e.get("subject"),
            "sent": bool(e.get("sent")),
            "reason": (e.get("delivery") or {}).get("reason"),
            "at": e.get("receivedAt") or e.get("createdAt"),
        }
        for e in mailing_store.emails()
        if e.get("ingestJobId") == job_id and e.get("direction") == "OUTBOUND"
    ]

    return {
        "jobId": job_id,
        "status": job.get("status"),
        "statusLabel": flow.label_for(job.get("status", "")),
        "tone": flow.tone_for(job.get("status", "")),
        "holdReason": job.get("holdReason"),
        "customer": proposal.get("customer"),
        "poNumber": proposal.get("poNumber"),
        "fromAddress": email.get("fromAddress"),
        "proposal": proposal,
        "inPactMaster": is_in_pact_master(proposal.get("customer")),
        "kpacProfile": kpac_profile(),
        "pactAutoRelease": pact_auto_release(),
        "steps": job.get("pipelineSteps") or [],
        "lineItems": _line_items(proposal),
        "tasks": mailing_store.tasks(job_id),
        "pactPushes": pushes,
        "proforma": proforma,
        "outbound": outbound,
        "timeline": job.get("timeline") or [],
    }
