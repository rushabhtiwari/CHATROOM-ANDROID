"""The Mailing Hub API (WORKING.md §5).

Seven endpoints, mounted at the spec's own paths under `/api/admin/mailing`.

This module is deliberately thin. It reads through `mailing_store`, projects
records into the shape the console renders, and hands every mutation to
`write_service.mailing`. There is not a single `mutate_` call in this file —
that is the §1.1 write-service monopoly, and `tests/test_mailing.py` asserts it
by reading this source rather than trusting the convention.
"""

from __future__ import annotations

import asyncio
from typing import Any, Literal, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from .. import mailing_workflow as flow
from ..config import MAX_UPLOAD_BYTES
from ..mailing_store import domain_of, mailing_store, parse_iso
from ..models import Base
from ..write_service import WriteServiceError
from ..write_service import mailing as write_service

router = APIRouter(prefix="/admin/mailing", tags=["mailing"])


# --------------------------------------------------------------------------- #
# Request bodies                                                               #
# --------------------------------------------------------------------------- #


class ResolveBody(Base):
    action: Literal[
        # Gate 1 - the admin approves, with any corrections they made.
        "COMMIT_EDITED",
        # Gate 2 - Accounts release the order into PACT.
        "ACCOUNTS_APPROVE",
        "REJECT",
        "RETRY_EXTRACTION",
        "WHITELIST",
    ]
    actor: str = "operator"
    corrected_data: Optional[dict[str, Any]] = None
    reason: Optional[str] = None


class ApproveBody(Base):
    """Either gate. `correctedData` is only meaningful at the admin gate."""

    actor: str = "operator"
    corrected_data: Optional[dict[str, Any]] = None
    reason: Optional[str] = None


class WhitelistBody(Base):
    domain: str
    company_name: str
    company_code: str = ""
    actor: str = "operator"
    job_id: Optional[str] = None


class MonitorBody(Base):
    paused: bool
    actor: str = "operator"


class ConnectBody(Base):
    """What the operator types to connect a mailbox.

    Only an address and an app password are required — `host` is inferred from
    the domain, exactly as the OrderOps admin screen does it, so nobody has to
    know that Gmail lives at imap.gmail.com:993.
    """

    address: str
    password: str
    host: str = ""
    port: int = 993
    mailbox: str = "INBOX"
    actor: str = "operator"


class PollBody(Base):
    actor: str = "operator"


# --------------------------------------------------------------------------- #
# Projections — the read model the console renders                             #
# --------------------------------------------------------------------------- #


def _status_of(email: dict) -> tuple[str, Optional[dict]]:
    job = mailing_store.job(email.get("ingestJobId") or "") if email.get("ingestJobId") else None
    if not job:
        return ("ACKNOWLEDGED" if email["direction"] == "OUTBOUND" else "RECEIVED"), None
    return job["status"], job


def _mail_row(email: dict) -> dict:
    """One line of the ledger in §3.2's columns."""
    status, job = _status_of(email)
    order = mailing_store.order(job["orderId"]) if job and job.get("orderId") else None
    return {
        "id": email["id"],
        "messageId": email.get("messageId"),
        "direction": email["direction"],
        "source": email.get("source"),
        "fromAddress": email.get("fromAddress"),
        "toAddress": email.get("toAddress"),
        "domain": domain_of(email.get("fromAddress", "")),
        "subject": email.get("subject"),
        "receivedAt": email.get("receivedAt"),
        "attachmentCount": len(email.get("attachments", [])),
        "status": status,
        "statusLabel": flow.label_for(status),
        "tone": flow.tone_for(status),
        "holdReason": job.get("holdReason") if job else None,
        "cause": job.get("cause") if job else None,
        "causeLabel": flow.CAUSE_LABEL.get((job or {}).get("cause") or "", ""),
        "confidence": job.get("confidence") if job else None,
        "ingestJobId": email.get("ingestJobId"),
        "orderId": order["id"] if order else None,
        "poNumber": order.get("poNumber") if order else None,
        "acknowledged": bool(job and job.get("acknowledgedAt")),
    }


def _mail_detail(email: dict) -> dict:
    """§3.2's split inspector: headers, body, attachment tray, lifecycle."""
    status, job = _status_of(email)
    order = mailing_store.order(job["orderId"]) if job and job.get("orderId") else None
    return {
        "email": {
            **_mail_row(email),
            "bodyText": email.get("bodyText", ""),
            "headers": email.get("headers", {}),
            "attachments": email.get("attachments", []),
        },
        "job": _job_row(job) if job else None,
        "order": (
            {
                **order,
                "versions": mailing_store.order_versions(order["id"]),
            }
            if order
            else None
        ),
        # Every message the same job produced, so an inbound PO and the ACK it
        # generated read as one conversation rather than two unrelated rows.
        "thread": [
            _mail_row(other)
            for other in mailing_store.emails()
            if other.get("ingestJobId") and other["ingestJobId"] == email.get("ingestJobId")
        ],
    }


def _job_row(job: dict) -> dict:
    email = mailing_store.email(job.get("emailLogId") or "") or {}
    order = mailing_store.order(job["orderId"]) if job.get("orderId") else None

    # Fields whose evidence is weak enough to be worth a reviewer's eye. The
    # resolver leads with these rather than making the operator hunt.
    fields = (job.get("extraction") or {}).get("fields") or {}
    suspect = [
        name
        for name, value in fields.items()
        if (value or {}).get("confidence", 0) < flow.CONFIDENCE_FLOOR
    ]

    return {
        "id": job["id"],
        "emailLogId": job.get("emailLogId"),
        "status": job["status"],
        "statusLabel": flow.label_for(job["status"]),
        "tone": flow.tone_for(job["status"]),
        "holdReason": job.get("holdReason"),
        "holdReasonLabel": flow.HOLD_REASON_LABEL.get(job.get("holdReason") or "", ""),
        "cause": job.get("cause"),
        "causeLabel": flow.CAUSE_LABEL.get(job.get("cause") or "", ""),
        "confidence": job.get("confidence"),
        "extraction": job.get("extraction"),
        "correctedJson": job.get("correctedJson"),
        "suspectFields": suspect,
        "touchedByHuman": job.get("touchedByHuman", False),
        "decisionNote": job.get("decisionNote"),
        "retryCount": job.get("retryCount", 0),
        "orderId": order["id"] if order else None,
        "poNumber": order.get("poNumber") if order else None,
        "createdAt": job.get("createdAt"),
        "updatedAt": job.get("updatedAt"),
        "committedAt": job.get("committedAt"),
        "acknowledgedAt": job.get("acknowledgedAt"),
        "timeline": job.get("timeline", []),
        "subject": email.get("subject"),
        "fromAddress": email.get("fromAddress"),
        "domain": domain_of(email.get("fromAddress", "")),
        "receivedAt": email.get("receivedAt"),
        "attachments": email.get("attachments", []),
        "availableActions": [
            action
            for action in flow.TRIAGE_ACTIONS
            if flow.triage_error(job["status"], action) is None
        ],
    }


# --------------------------------------------------------------------------- #
# §5 — the seven endpoints                                                     #
# --------------------------------------------------------------------------- #


@router.get("/summary")
def summary() -> dict:
    """Badge counters for the tab strip and the control deck."""
    return mailing_store.summary()


@router.get("/mails")
def list_mails(
    status: Optional[str] = Query(None, description="Comma-separated lifecycle statuses"),
    direction: Optional[Literal["INBOUND", "OUTBOUND"]] = None,
    domain: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = Query(None, alias="dateFrom"),
    date_to: Optional[str] = Query(None, alias="dateTo"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200, alias="pageSize"),
) -> dict:
    rows = [_mail_row(email) for email in mailing_store.emails()]

    if status:
        wanted = {value.strip().upper() for value in status.split(",") if value.strip()}
        rows = [row for row in rows if row["status"] in wanted]
    if direction:
        rows = [row for row in rows if row["direction"] == direction]
    if domain:
        needle = domain.lower().lstrip("@")
        rows = [row for row in rows if row["domain"] == needle]
    if date_from:
        floor = parse_iso(date_from)
        rows = [row for row in rows if parse_iso(row["receivedAt"]) >= floor]
    if date_to:
        ceiling = parse_iso(date_to)
        rows = [row for row in rows if parse_iso(row["receivedAt"]) <= ceiling]
    if q:
        needle = q.lower()
        rows = [
            row
            for row in rows
            if needle in (row["subject"] or "").lower()
            or needle in (row["fromAddress"] or "").lower()
            or needle in (row["poNumber"] or "").lower()
            or needle in (row["id"] or "").lower()
        ]

    rows.sort(key=lambda row: row["receivedAt"] or "", reverse=True)
    total = len(rows)
    start = (page - 1) * page_size

    return {
        "items": rows[start : start + page_size],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "statuses": [
            {"value": value, "label": flow.label_for(value), "tone": flow.tone_for(value)}
            for value in flow.STATUS_LABEL
        ],
    }


@router.get("/mails/{email_id}")
def get_mail(email_id: str) -> dict:
    email = mailing_store.email(email_id)
    if not email:
        raise HTTPException(status_code=404, detail=f"No message matches '{email_id}'.")
    return _mail_detail(email)


@router.get("/on-hold")
def list_on_hold(
    reason: Optional[str] = Query(None, description="INTAKE_FILTERED | EXCEPTION | AWAITING_ADMIN | AWAITING_ACCOUNTS"),
    q: Optional[str] = None,
) -> dict:
    rows = [_job_row(job) for job in mailing_store.on_hold()]

    if reason:
        wanted = {value.strip().upper() for value in reason.split(",") if value.strip()}
        rows = [row for row in rows if row["holdReason"] in wanted]
    if q:
        needle = q.lower()
        rows = [
            row
            for row in rows
            if needle in (row["subject"] or "").lower()
            or needle in (row["fromAddress"] or "").lower()
            or needle in (row["id"] or "").lower()
        ]

    everything = [_job_row(job) for job in mailing_store.on_hold()]
    return {
        "items": rows,
        "total": len(rows),
        "groups": [
            {
                "reason": key,
                "label": label,
                "count": sum(1 for row in everything if row["holdReason"] == key),
            }
            for key, label in flow.HOLD_REASON_LABEL.items()
        ],
        "domains": mailing_store.domains(),
    }


@router.get("/on-hold/{job_id}")
def get_on_hold(job_id: str) -> dict:
    """The side-by-side resolver's payload (§3.3)."""
    job = mailing_store.job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"No ingest job matches '{job_id}'.")
    email = mailing_store.email(job.get("emailLogId") or "")
    return {
        "job": _job_row(job),
        "email": _mail_detail(email)["email"] if email else None,
        "domains": mailing_store.domains(),
    }


@router.post("/on-hold/{job_id}/resolve")
def resolve(job_id: str, body: ResolveBody) -> dict:
    return _resolve(job_id, body.action, body.actor, body.corrected_data, body.reason)


def _resolve(job_id, action, actor, corrected_data, reason) -> dict:
    try:
        return write_service.resolve_on_hold_item(
            write_service.ResolveOnHoldInput(
                job_id=job_id,
                action=action,
                actor=actor,
                corrected_data=corrected_data,
                reason=reason,
            )
        )
    except WriteServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


@router.post("/jobs/{job_id}/approve")
def admin_approve(job_id: str, body: ApproveBody) -> dict:
    """Gate 1. The admin approves; the customer is acknowledged and the team tasked."""
    return _resolve(job_id, "COMMIT_EDITED", body.actor, body.corrected_data, body.reason)


@router.post("/jobs/{job_id}/accounts-approve")
def accounts_approve(job_id: str, body: ApproveBody) -> dict:
    """Gate 2. Accounts release the order: one PACT draft, then the closing message."""
    return _resolve(job_id, "ACCOUNTS_APPROVE", body.actor, None, body.reason)


@router.get("/tasks")
def list_tasks(job_id: Optional[str] = Query(None, alias="jobId")) -> list[dict]:
    """The team tasks an approved order created."""
    return mailing_store.tasks(job_id)


@router.post("/demo/reset")
def reset_demo(keep_mailbox: bool = Query(True, alias="keepMailbox")) -> dict:
    """Clear what test runs left behind and put the seeded demo ledger back.

    A purchase order that has already been through the pipeline is refused the second
    time as a duplicate, which is correct in production and unhelpful when rehearsing.
    This forgets those runs so the same PDF can be sent again. The mailbox stays
    connected unless `keepMailbox=false`.
    """
    return mailing_store.reset(keep_mailbox=keep_mailbox)


@router.post("/direct-send", status_code=201)
async def direct_send(
    from_address: str = Form(..., alias="fromAddress"),
    subject: str = Form(...),
    to_address: str = Form("orders@kirancable.com", alias="toAddress"),
    body_text: str = Form("", alias="bodyText"),
    actor: str = Form("operator"),
    attachments: list[UploadFile] = File(default=[]),
) -> dict:
    """Inject a message straight into the pipeline (§3.1).

    Multipart rather than JSON because the point of the injector is the
    attachment: a PO with no document behind it exercises none of the path that
    matters.
    """
    payloads: list[write_service.DirectMailAttachment] = []
    for upload in attachments or []:
        data = await upload.read()
        if not data:
            continue
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"'{upload.filename}' is {len(data) / 1_048_576:.1f} MB; the limit "
                    f"is {MAX_UPLOAD_BYTES // 1_048_576} MB."
                ),
            )
        payloads.append(
            write_service.DirectMailAttachment(
                filename=upload.filename or "attachment",
                mime_type=upload.content_type or "application/octet-stream",
                data=data,
            )
        )

    # The ingest runs extraction and then the intake messages, which means SMTP
    # round-trips. This handler is `async` for the upload, so that work has to leave
    # the event loop: run inline it froze the SSE stream and every other request in
    # the console for the whole of the injection, which read as the pipeline lagging.
    try:
        return await asyncio.to_thread(
            write_service.inject_direct_email,
            write_service.DirectMailInput(
                from_address=from_address,
                to_address=to_address,
                subject=subject,
                body_text=body_text,
                actor=actor,
                attachments=payloads,
            ),
        )
    except WriteServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


@router.get("/analytics")
def analytics(days: int = Query(14, ge=1, le=90)) -> dict:
    """§3.4 — intake velocity, STP, latency, Pareto, sender leaders, SLA."""
    return mailing_store.analytics(days=days)


# --------------------------------------------------------------------------- #
# Control deck extras (§3.1)                                                   #
# --------------------------------------------------------------------------- #


@router.get("/monitor")
def monitor() -> dict:
    return {**write_service.mailbox_status(), "audit": mailing_store.audit(25)}


@router.post("/connection", status_code=201)
def connect(body: ConnectBody) -> dict:
    """Connect a mailbox.

    The password is proved against the server and then sealed to disk; it is
    never returned, logged, or sent back to the browser.
    """
    try:
        return write_service.connect_mailbox(
            address=body.address,
            password=body.password,
            host=body.host,
            port=body.port,
            mailbox=body.mailbox,
            actor=body.actor,
        )
    except WriteServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


@router.delete("/connection")
def disconnect(actor: str = Query("operator")) -> dict:
    """Stop watching and forget the credentials. The ledger is untouched."""
    return write_service.disconnect_mailbox(actor)


@router.post("/monitor/poll")
def poll(body: PollBody) -> dict:
    try:
        return write_service.run_poll_now(body.actor)
    except WriteServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


@router.post("/monitor/pause")
def pause(body: MonitorBody) -> dict:
    try:
        return write_service.set_monitor_paused(body.paused, body.actor)
    except WriteServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


@router.post("/domains", status_code=201)
def whitelist(body: WhitelistBody) -> dict:
    try:
        return write_service.whitelist_domain_and_reingest(
            write_service.WhitelistDomainInput(
                domain=body.domain,
                company_name=body.company_name,
                company_code=body.company_code,
                actor=body.actor,
                job_id=body.job_id,
            )
        )
    except WriteServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
