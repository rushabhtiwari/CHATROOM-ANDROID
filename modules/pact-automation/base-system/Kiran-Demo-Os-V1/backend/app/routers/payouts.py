"""Disbursement: the payout ledger and the money-out step."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import DisburseBody, QueuePayoutsBody
from ..store import store
from ..workflow import is_payable

router = APIRouter(tags=["payouts"])


@router.get("/payouts")
def list_payouts() -> list[dict]:
    return store.snapshot()["payouts"]


@router.post("/payouts/queue")
def queue_payouts(body: QueuePayoutsBody) -> list[dict]:
    """Sends selected ledger rows to the bank — they become PROCESSING."""
    touched = store.queue_payouts(body.payout_ids, body.actor)
    if not touched:
        raise HTTPException(status_code=404, detail="None of those payouts exist.")
    return touched


@router.post("/payouts/{payout_id}/retry")
def retry_payout(payout_id: str) -> dict:
    payout = store.retry_payout(payout_id)
    if not payout:
        raise HTTPException(status_code=404, detail=f"No payout matches '{payout_id}'.")
    return payout


@router.get("/payees")
def payees() -> list[dict]:
    """The disbursement queue, grouped by employee.

    Only Accounts-approved claims appear, which by the chain's rules implies HR
    approval — an unapproved claim can never reach this screen.
    """
    snapshot = store.snapshot()
    employees = {e["id"]: e for e in snapshot["employees"]}

    grouped: dict[str, list[dict]] = {}
    for request in snapshot["requests"]:
        if not is_payable(request["status"]):
            continue
        grouped.setdefault(request["employeeId"], []).append(request)

    rows = []
    for employee_id, claims in grouped.items():
        employee = employees.get(employee_id)
        if not employee:
            continue
        rows.append(
            {
                "employee": employee,
                "claims": claims,
                "total": sum(c["amount"] for c in claims),
                "receiptCount": sum(len(c["receipts"]) for c in claims),
            }
        )

    return sorted(rows, key=lambda r: r["total"], reverse=True)


@router.post("/disburse")
def disburse(body: DisburseBody) -> dict:
    """Pays every payable claim for one employee under a single UTR."""
    result, error = store.disburse(body.employee_id, body.method, body.actor)
    if error:
        raise HTTPException(status_code=409, detail=error)
    return result


@router.post("/employees/{employee_id}/verify-bank")
def verify_bank(employee_id: str) -> dict:
    employee = store.verify_bank(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail=f"No employee matches '{employee_id}'.")
    return employee


@router.get("/employees")
def list_employees() -> list[dict]:
    return store.snapshot()["employees"]


@router.get("/receipt-context/{utr}")
def receipt_context(utr: str) -> dict:
    """Everything the standalone payment receipt page needs, by UTR.

    The receipt opens in its own tab with no app state, so it resolves itself
    from the server rather than from whatever the opener happened to hold.
    """
    snapshot = store.snapshot()
    payouts = [p for p in snapshot["payouts"] if p.get("utr") == utr]
    if not payouts:
        raise HTTPException(status_code=404, detail=f"No payout matches UTR '{utr}'.")

    request_ids = {p["requestId"] for p in payouts}
    employee_id = payouts[0]["employeeId"]

    return {
        "utr": utr,
        "payouts": payouts,
        "employee": next(
            (e for e in snapshot["employees"] if e["id"] == employee_id), None
        ),
        "requests": [r for r in snapshot["requests"] if r["id"] in request_ids],
        "total": sum(p["amount"] for p in payouts),
        "method": payouts[0]["method"],
        "settledOn": payouts[0].get("settledOn"),
    }
