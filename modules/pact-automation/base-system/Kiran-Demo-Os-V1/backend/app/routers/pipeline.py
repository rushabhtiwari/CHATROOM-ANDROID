"""The PO pipeline's own view, for the console.

Replaces `routers/confirm.py`, which existed to carry a customer's confirmation link.
There is no customer-facing gate any more, so nothing here is public: every endpoint is
the console looking at, or driving, an internal workflow.

    GET  /api/po-pipeline               the board - one row per job that reached the pipeline
    GET  /api/po-pipeline/summary       the figures the automation section shows
    GET  /api/po-pipeline/{job_id}      everything known about one job, in one read
    POST /api/po-pipeline/{job_id}/run  gate 2: Accounts release it into PACT

The `run` endpoint is a second door onto the same write-service call the Accounts approval
uses, and it is gated by exactly the same check: `run_after_accounts_approval` refuses any
job that is not sitting at `AWAITING_ACCOUNTS_APPROVAL`. There is no way in here that the
state machine does not also allow.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import mailing_workflow as flow
from ..mailing_store import mailing_store
from ..write_service import po_pipeline
from ..write_service.errors import WriteServiceError

router = APIRouter(prefix="/po-pipeline", tags=["po-pipeline"])

#: Jobs that have reached the pipeline at all - i.e. past extraction.
ON_THE_BOARD = (
    "AWAITING_ADMIN_APPROVAL",
    "COMMITTED",
    "ACKNOWLEDGED",
    "AWAITING_ACCOUNTS_APPROVAL",
    "PUSHED_TO_PACT",
    "COMPLETED",
)


@router.get("")
def board() -> list[dict]:
    rows = []
    for job in mailing_store.jobs():
        status = job.get("status", "")
        # A seeded job has one of these statuses too, but no pipeline ever ran on it. The
        # step log is the honest test of "this job reached the pipeline".
        if status not in ON_THE_BOARD or not job.get("pipelineSteps"):
            continue
        proposal = po_pipeline._proposal_of(job)
        push = mailing_store.latest_pact_push(job["id"]) or {}
        tasks = mailing_store.tasks(job["id"])
        rows.append(
            {
                "jobId": job["id"],
                "status": status,
                "statusLabel": flow.label_for(status),
                "tone": flow.tone_for(status),
                "customer": proposal.get("customer"),
                "poNumber": proposal.get("poNumber"),
                "orderValue": proposal.get("orderValue"),
                "lineCount": len(proposal.get("lineItems") or []),
                "documentNo": push.get("documentNo"),
                "pactStatus": push.get("status"),
                "openTasks": len([t for t in tasks if t.get("status") == "OPEN"]),
                "updatedAt": job.get("updatedAt"),
            }
        )
    return rows


@router.get("/summary")
def summary() -> dict:
    return po_pipeline.summary()


@router.get("/{job_id}")
def view(job_id: str) -> dict:
    try:
        return po_pipeline.pipeline_view(job_id)
    except WriteServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


@router.post("/{job_id}/run")
def run(job_id: str, actor: str = "operator") -> dict:
    """Gate 2, from the pipeline view rather than the on-hold queue."""
    try:
        result = po_pipeline.run_after_approval_sync(job_id, actor=actor)
    except WriteServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    return {**result.as_dict(), "status": (mailing_store.job(job_id) or {}).get("status")}
