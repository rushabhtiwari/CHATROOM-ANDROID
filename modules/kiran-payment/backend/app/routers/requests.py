"""Claims: filing them, and moving them along the approval chain."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..config import ENFORCE_BUDGET
from ..models import NewRequestBody, TransitionBody
from ..store import store

router = APIRouter(prefix="/requests", tags=["requests"])


@router.get("")
def list_requests() -> list[dict]:
    return store.snapshot()["requests"]


@router.get("/{request_id}")
def get_request(request_id: str) -> dict:
    request = store.request(request_id)
    if not request:
        raise HTTPException(status_code=404, detail=f"No request matches '{request_id}'.")
    return request


@router.post("", status_code=201)
def create_request(body: NewRequestBody) -> dict:
    payload = body.model_dump(by_alias=True, exclude_none=False)
    return store.create_request(payload)


@router.post("/{request_id}/transition")
def transition(request_id: str, body: TransitionBody) -> dict:
    """Approve, reject, or ask for more information.

    The server applies the same gates the UI shows, so an out-of-order call is
    refused with the reason rather than silently corrupting the chain.
    """
    request = store.request(request_id)
    if not request:
        raise HTTPException(status_code=404, detail=f"No request matches '{request_id}'.")

    # Financial feasibility check at the Accounts step. Advisory by default:
    # the shortfall is reported, but a long demo can never dead-end on it.
    if body.status == "ACC_APPROVED":
        employee = store.employee(request["employeeId"])
        if employee:
            position = store.department_headroom(employee["department"])
            if position and request["amount"] > position["headroom"]:
                shortfall = request["amount"] - position["headroom"]
                if ENFORCE_BUDGET:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"{employee['department']} has Rs "
                            f"{position['headroom']:,.0f} of headroom, short by Rs "
                            f"{shortfall:,.0f} for this claim."
                        ),
                    )

    updated, error = store.transition(
        request_id, body.status, body.actor, body.role, body.comment
    )
    if error:
        raise HTTPException(status_code=409, detail=error)
    return updated


@router.get("/{request_id}/headroom")
def headroom(request_id: str) -> dict:
    """The department's budget position for this claim, for the Accounts panel."""
    request = store.request(request_id)
    if not request:
        raise HTTPException(status_code=404, detail=f"No request matches '{request_id}'.")

    employee = store.employee(request["employeeId"])
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found for this claim.")

    position = store.department_headroom(employee["department"])
    if not position:
        raise HTTPException(status_code=404, detail="No budget row for this department.")

    return {
        **position,
        "amount": request["amount"],
        "sufficient": request["amount"] <= position["headroom"],
        "shortfall": max(0.0, request["amount"] - position["headroom"]),
        "enforced": ENFORCE_BUDGET,
    }
