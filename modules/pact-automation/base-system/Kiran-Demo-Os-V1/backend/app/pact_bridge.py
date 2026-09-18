"""From an approved order to a PACT draft, through KPAC.

KPAC is the pywinauto robot at ``C:\\Users\\prach\\pact-automation``. It types into the real
PACT RevenU window, and three things about it shape everything here:

  1. **It drives a human's desktop.** One window, one keyboard focus, rows one at a time.
     It is not something to call concurrently.
  2. **It can PAUSE rather than fail.** With the PACT window closed or sitting on a sign-in
     screen it stops and leaves the row runnable, deliberately, so one closed window does
     not burn the work. A pause is a first-class outcome here, not an error, and it must
     never be recorded as a rejection or trigger a proforma.
  3. **Save Draft only.** The robot's ``post`` action is not wired up at all. This module
     never asks for it, and there is no parameter that could.

The KPAC entry lifecycle this drives is:

    POST /api/entries        -> pending
    POST /api/entries/{id}/approve -> approved -> filling -> verifying -> saved | failed
                                                                       -> skipped (DRY RUN)

and the document number PACT gave the draft comes back at
``entry["result"]["confirmation"]["record_id"]``.

## The direction mismatch, stated plainly

KiranOS ingests a purchase order a *customer* sent *to* Kiran — Kiran is the seller. The
PACT screen this drives is Kiran's own **Purchase Order** screen, where the party lookup
resolves against the **vendor** master. For the demo the four customers are registered
there under identical names, which is why it works. It is a demo simplification, recorded
in docs/DEMO_RUNBOOK.md, not a claim about the accounting. `KPAC_PROFILE` is the one value
to change when the Sales Order screen is ready.
"""

from __future__ import annotations

import asyncio
import os
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import httpx

from . import pact_client
from .config import PACT_AUTOMATION_URL
from .demo_customers import (
    default_product_code,
    PactMasterError,
    kpac_profile,
    resolve_pact_party,
    resolve_product_code,
)

#: Terminal KPAC statuses. `skipped` is terminal too — it is what a DRY RUN row becomes.
TERMINAL_STATUSES = {"saved", "failed", "rejected", "skipped"}

DEFAULT_POLL_SECONDS = 1.0
DEFAULT_TIMEOUT_SECONDS = 300.0


@dataclass
class PactPushResult:
    #: "SUCCEEDED" | "PAUSED" | "FAILED"
    status: str
    detail: str
    document_no: Optional[str] = None
    dry_run: bool = False
    entry_id: Optional[int] = None
    price_notes: list[str] = field(default_factory=list)
    mismatches: list[dict] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.status == "SUCCEEDED"


def pact_date(moment: Optional[datetime] = None) -> str:
    """dd/MM/yyyy — the only format the PACT date fields accept."""
    return (moment or datetime.now()).strftime("%d/%m/%Y")


def build_record(
    proposal: dict,
    *,
    doc_date: Optional[str] = None,
    env: dict[str, str] | None = None,
) -> dict[str, Any]:
    """The row KPAC's ``pact_purchase_order`` profile fills.

    Raises `PactMasterError` when the customer is not in PACT's master. That is the hard
    stop: never a near-match, never a pass-through, never a silent skip.

    ``line_items`` carries **every** line of the order - see `build_line_items`. One PO
    becomes one record, one PACT document and one Save Draft, however many lines it has.
    """
    party = resolve_pact_party(proposal.get("customer"), env)
    # What the customer's own document said. Every default below is a fallback for a field
    # their order did not name, and the record shows which is which.
    terms = proposal.get("pactTerms") or {}
    po_number = str(proposal.get("poNumber") or "").strip()

    return {
        "doc_date": doc_date or pact_date(),
        "vendor_name": party,
        "narration": f"KiranOS {po_number}".strip(),
        "mode_of_transport": terms.get("mode_of_transport") or "BY ROAD",
        "transporter": terms.get("transporter") or "TO BE ADVISED",
        "delivery_terms": terms.get("delivery_terms") or "AS PER PO",
        "payment_terms": terms.get("payment_terms") or "AS PER PO",
        "supplier_validity": "",
        "po_validity": "",
        "party_ref_no": po_number,
        "party_ref_date": doc_date or pact_date(),
        "packing_instruction": terms.get("packing_instruction") or "",
        "shipping_instructions": terms.get("shipping_instructions") or "",
        "line_items": build_line_items(proposal, env),
    }


def build_line_items(proposal: dict, env: dict[str, str] | None = None) -> list[dict[str, str]]:
    """Every line of the order, as KPAC grid rows.

    One purchase order is one PACT document with one grid, and `robot.fill_grid` fills a
    row per entry here before the single Save Draft. So this returns the whole list -
    it used to collapse the order into a single row built from an aggregate quantity,
    which is exactly how a five-line PO became a one-line draft.

    A LIST OF DICTS, not the `CODE|QTY|PRICE` string. Those two shapes are both real and
    they belong to different doors into KPAC: `preflight.parse_line_items` turns the string
    into these dicts on the CSV upload path, while `POST /api/entries` passes through
    whatever it is given and the worker calls `.get()` on each item. Posting the string
    made every row raise `'str' object has no attribute 'get'` inside the worker's own
    try/except - so the rows sat at `approved` forever and the push simply never happened.

    The unit price is carried even though PACT will not accept it: on the Purchase Order
    screen the rate comes from the product master and the cell has no editor at all. KPAC
    reads back what PACT actually charged and reports the difference; dropping the price
    here would lose the only record of what the customer's document said it should be.
    """
    terms = proposal.get("pactTerms") or {}
    rows: list[dict[str, str]] = []

    for item in proposal.get("lineItems") or []:
        quantity = _as_int(item.get("quantity"))
        if quantity <= 0:
            continue
        code = (
            resolve_product_code(item.get("productCode"), env)
            or item.get("productCode")
            or default_product_code(env)
        )
        rate = _as_float(item.get("rate"))
        if not rate:
            rate = round(_as_float(item.get("value")) / quantity, 2) if quantity else 0.0
        rows.append(
            {"product_code": str(code), "qty": str(quantity), "unit_price": str(round(rate, 2))}
        )

    if rows:
        return rows

    # No table on the document: fall back to the headline quantity and the standing
    # product code, which is the single-line order this pipeline began with.
    quantity = max(1, _as_int(proposal.get("quantityMetres")))
    stated_rate = _as_float(terms.get("unit_rate"))
    if not stated_rate:
        stated_rate = round(_as_float(proposal.get("orderValue")) / quantity, 2) if quantity else 0.0
    code = (
        resolve_product_code(proposal.get("materialCode"), env)
        or resolve_product_code(terms.get("product_code"), env)
        or terms.get("product_code")
        or default_product_code(env)
    )
    return [
        {"product_code": str(code), "qty": str(quantity), "unit_price": str(round(stated_rate, 2))}
    ]


def _as_int(value) -> int:
    try:
        return int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return 0


def _as_float(value) -> float:
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def _document_no(entry: dict) -> Optional[str]:
    confirmation = ((entry or {}).get("result") or {}).get("confirmation") or {}
    value = confirmation.get("record_id")
    return str(value) if value not in (None, "") else None


def _is_paused(entry: dict) -> bool:
    """KPAC re-queues a row as `approved` with a window-gone reason when it pauses."""
    reason = str((entry or {}).get("error") or "").lower()
    return any(
        marker in reason
        for marker in ("window", "sign-in", "sign in", "not found", "paused", "log in")
    )


def _settle(entry: dict, dry_run_setting: bool) -> PactPushResult:
    """Read one finished KPAC entry as the outcome of one order.

    The DRY RUN case is the subtle one. KPAC marks a dry-run row ``skipped`` because
    nothing was saved — but it got there by filling the form and passing the verifier,
    which is a success for a rehearsal. Calling that a failure makes a dry run look broken;
    calling it a plain success hides that no document exists. So it is SUCCEEDED with
    ``dry_run=True`` and no document number, and the caller decides what that means.
    """
    status = str(entry.get("status") or "")
    error = str(entry.get("error") or "")
    result = entry.get("result") or {}
    price_notes = [str(n) for n in (result.get("price_notes") or [])]
    mismatches = list(result.get("mismatches") or [])
    entry_id = entry.get("id")

    if status == "saved":
        document = _document_no(entry)
        return PactPushResult(
            status="SUCCEEDED",
            detail=(
                f"PACT draft saved as document {document}"
                if document
                else "PACT saved the draft but reported no document number"
            ),
            document_no=document,
            dry_run=False,
            entry_id=entry_id,
            price_notes=price_notes,
        )

    if status == "skipped" and ("dry run" in error.lower() or dry_run_setting):
        return PactPushResult(
            status="SUCCEEDED",
            detail="DRY RUN - the form was filled and verified, nothing was saved",
            document_no=None,
            dry_run=True,
            entry_id=entry_id,
            price_notes=price_notes,
        )

    return PactPushResult(
        status="FAILED",
        detail=error or f"KPAC left the row as {status}",
        entry_id=entry_id,
        price_notes=price_notes,
        mismatches=mismatches,
    )


async def push_purchase_order(
    proposal: dict,
    *,
    doc_date: Optional[str] = None,
    source: str = "kiranos-po-pipeline",
    poll_seconds: float = DEFAULT_POLL_SECONDS,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    env: dict[str, str] | None = None,
) -> PactPushResult:
    """Create one PACT draft for one approved order, and wait for it to settle.

    Never raises for an operational reason: a KPAC that is down, a PACT window that is
    closed, a customer PACT does not know — all come back as a `PactPushResult` the caller
    records. The only thing that escapes is a programming error.
    """
    source_env = env if env is not None else os.environ

    try:
        record = build_record(proposal, doc_date=doc_date, env=env)
    except PactMasterError as error:
        # The hard stop. This order fails and nothing else happens to it.
        return PactPushResult(status="FAILED", detail=str(error))

    if not pact_client.configured():
        return PactPushResult(
            status="PAUSED",
            detail="PACT Automation is not configured (set PACT_AUTOMATION_URL).",
        )

    profile = kpac_profile(env)
    dry_run_setting = False
    try:
        status = await pact_client.status()
        settings = status.get("settings") or {}
        dry_run_setting = bool(settings.get("dry_run"))
        loaded = str(settings.get("profile") or "")
        if loaded and loaded != profile:
            return PactPushResult(
                status="FAILED",
                detail=(
                    f"KPAC has profile {loaded!r} loaded but this deployment expects "
                    f"{profile!r}. Filling the wrong PACT screen is not something to guess "
                    "at - set PROFILE in the KPAC .env and reload its settings."
                ),
            )
        if not status.get("worker_alive"):
            return PactPushResult(
                status="PAUSED",
                detail="KPAC's worker is not running. Start it, then retry this order.",
            )
    except pact_client.PactServiceError as error:
        return PactPushResult(status="PAUSED", detail=f"KPAC is not reachable: {error}")

    try:
        entry = await pact_client.create_entry(record, source=source)
        entry_id = int(entry["id"])
        # The single approval. Everything before this point is reversible; this is what
        # puts a row in front of the robot.
        await pact_client.approve_entry(entry_id)
    except pact_client.PactServiceError as error:
        return PactPushResult(status="FAILED", detail=f"KPAC refused the row: {error}")
    except (KeyError, TypeError, ValueError) as error:
        return PactPushResult(status="FAILED", detail=f"KPAC returned an unusable entry: {error}")

    deadline = asyncio.get_running_loop().time() + timeout_seconds
    last: dict[str, Any] = entry
    while True:
        await asyncio.sleep(poll_seconds)
        try:
            rows = await pact_client.entries()
        except pact_client.PactServiceError as error:
            return PactPushResult(
                status="PAUSED",
                detail=f"lost contact with KPAC while the row was running: {error}",
                entry_id=entry_id,
            )

        current = next((r for r in rows if r.get("id") == entry_id), None)
        if current is None:
            return PactPushResult(
                status="FAILED",
                detail=f"KPAC entry {entry_id} disappeared from the queue",
                entry_id=entry_id,
            )
        last = current
        status_now = str(current.get("status") or "")

        if status_now in TERMINAL_STATUSES:
            return _settle(current, dry_run_setting)

        # A row put back to `approved` with a window reason is KPAC pausing, not working.
        if status_now == "approved" and _is_paused(current):
            return PactPushResult(
                status="PAUSED",
                detail=(
                    f"KPAC paused: {current.get('error')}. Open PACT, log in, and retry "
                    "this order."
                ),
                entry_id=entry_id,
            )

        if asyncio.get_running_loop().time() > deadline:
            return PactPushResult(
                status="PAUSED",
                detail=(
                    f"KPAC entry {entry_id} was still {status_now!r} after "
                    f"{timeout_seconds:.0f}s. Nothing was lost - check the PACT window and "
                    "retry this order."
                ),
                entry_id=entry_id,
            )


# --------------------------------------------------------------------------- #
# KPAC's liveness, for the console                                             #
# --------------------------------------------------------------------------- #

#: How long one answer from KPAC is reused before it is asked again. The console
#: refreshes the automation summary on every SSE frame and on a 15s timer; asking
#: the robot on each of those would be dozens of HTTP calls during a single push.
KPAC_STATUS_TTL_SECONDS = 4.0
KPAC_STATUS_TIMEOUT_SECONDS = 2.0

_status_lock = threading.Lock()
_status_cache: tuple[float, dict[str, Any]] = (0.0, {})


def kpac_status(env: dict[str, str] | None = None) -> dict[str, Any]:
    """What the console's KPAC page shows: reachable, worker, mode, loaded profile.

    Synchronous and cheap on purpose - the summary endpoint is a plain function and
    a probe that could stall it would take the whole automation section with it. A
    KPAC that is down answers within the timeout and reads as `offline`, which is the
    honest state and the one the runbook's recovery table is written for.
    """
    global _status_cache
    now = time.monotonic()
    with _status_lock:
        stamp, cached = _status_cache
        if cached and now - stamp < KPAC_STATUS_TTL_SECONDS:
            return dict(cached)

    expected = kpac_profile(env)
    result: dict[str, Any]
    if not pact_client.configured():
        result = {"reachable": False, "detail": "PACT Automation is not configured (set PACT_AUTOMATION_URL)."}
    else:
        try:
            with httpx.Client(timeout=KPAC_STATUS_TIMEOUT_SECONDS) as client:
                response = client.get(
                    f"{PACT_AUTOMATION_URL.rstrip('/')}/api/status", headers=pact_client._headers()
                )
                response.raise_for_status()
                status = response.json()
        except Exception as error:  # noqa: BLE001 - any failure here is "offline"
            result = {
                "reachable": False,
                "detail": f"KPAC is not reachable at {PACT_AUTOMATION_URL}: {error.__class__.__name__}. "
                "Start it with scripts\start.ps1 in the pact-automation folder.",
            }
        else:
            settings = status.get("settings") or {}
            loaded = str(settings.get("profile") or "")
            alive = bool(status.get("worker_alive"))
            busy = bool(status.get("busy"))
            matches = (not loaded) or loaded == expected
            if not alive:
                detail = "KPAC answers but its worker thread is not running - restart it."
            elif not matches:
                detail = f"KPAC has profile {loaded!r} loaded; this console expects {expected!r}."
            elif busy:
                detail = f"KPAC is busy on entry #{status.get('current')} ({status.get('step') or 'working'})."
            else:
                detail = "KPAC is reachable and idle, ready for the next order."
            result = {
                "reachable": True,
                "detail": detail,
                "workerAlive": alive,
                "busy": busy,
                "profile": loaded,
                "dryRun": bool(settings.get("dry_run")),
                "mode": settings.get("mode") or ("DRY RUN" if settings.get("dry_run") else "LIVE"),
                "profileMatches": matches,
            }

    with _status_lock:
        _status_cache = (time.monotonic(), dict(result))
    return result
