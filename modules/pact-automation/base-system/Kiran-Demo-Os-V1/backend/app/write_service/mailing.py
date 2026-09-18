"""Mailing write service — the only module that mutates canonical mailing rows.

This is the port of `apps/web/src/lib/write-service/mailing.ts` (WORKING.md §4.1).
The signatures are the spec's, in Python spelling; the guarantees are the spec's
too, and they are properties of the code rather than of a database:

  * **Monopoly (§1.1).** `mailing_store.mutate_*` is called from here and nowhere
    else. A router that wants to change something calls a function in this file.
  * **Zero DELETE (§1.2).** Nothing here removes a record. `REJECT` writes the
    `DISCARDED` sentinel with a mandatory note; a superseded extraction is kept
    beside its correction; a corrected order appends an `OrderVersion` rather
    than editing the head.
  * **Idempotent ingestion (§1.3).** `inject_direct_email` returns the existing
    record when the Message-ID or an attachment SHA-256 has been seen before,
    and says so, instead of creating a twin.
  * **Provenance (§1.4).** Operator edits are not silently merged into the
    model's output: they land in `correctedJson` with `source = "HUMAN"`, and
    the original extraction stays readable underneath.

Every entry point writes an audit row before it returns, so "who released this
order, and what did they change" is answerable from the ledger alone.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .. import mailing_extraction, mailing_workflow as flow, pdf_text
from ..config import UPLOAD_DIR
from ..imap_source import ImapEmailSource, ImapError, InboundEmail, verify_mailbox
from ..mail_connection import (
    MailConnection,
    clear_connection,
    host_for,
    resolve_connection,
    save_connection,
)
from ..mailing_store import domain_of, mailing_store, now_iso, sha256_of
from ..smtp_sender import ACK_HEADER, send_acknowledgement
from . import po_pipeline
from .errors import WriteServiceError

# The pipeline runs as this actor; a human action carries the operator's name.
PIPELINE_ACTOR = "pipeline"


# --------------------------------------------------------------------------- #
# Inputs — the spec's interfaces, as dataclasses                               #
# --------------------------------------------------------------------------- #


@dataclass
class DirectMailAttachment:
    filename: str
    mime_type: str
    data: bytes


@dataclass
class DirectMailInput:
    from_address: str
    to_address: str
    subject: str
    body_text: str
    actor: str
    attachments: list[DirectMailAttachment] = field(default_factory=list)


@dataclass
class ResolveOnHoldInput:
    job_id: str
    action: str  # COMMIT_EDITED | ACCOUNTS_APPROVE | REJECT | RETRY_EXTRACTION | WHITELIST
    actor: str
    corrected_data: Optional[dict[str, Any]] = None
    reason: Optional[str] = None


@dataclass
class WhitelistDomainInput:
    domain: str
    company_name: str
    actor: str
    company_code: str = ""
    job_id: Optional[str] = None


# --------------------------------------------------------------------------- #
# injectDirectEmail                                                            #
# --------------------------------------------------------------------------- #


def inject_direct_email(payload: DirectMailInput) -> dict[str, Any]:
    """Ingest a manual dispatch and run it through the processing graph.

    This is the Direct Mailer from §3.1. It is a thin caller of `_ingest`, which
    is also what the IMAP watcher calls — the injector and the mailbox must not
    be able to drift apart, because the whole value of the injector is that it
    exercises the real path.
    """
    sender = (payload.from_address or "").strip().lower()
    if "@" not in sender:
        raise WriteServiceError(f"'{payload.from_address}' is not an email address.", 422)
    if not (payload.subject or "").strip():
        raise WriteServiceError("A subject is required.", 422)

    return _ingest(
        message_id=_message_id(sender, payload.subject),
        from_address=sender,
        to_address=payload.to_address or "orders@kirancable.com",
        subject=payload.subject,
        body_text=payload.body_text or "",
        attachments=payload.attachments,
        actor=payload.actor,
        origin="DIRECT",
        # A directly injected message is trusted by construction: it did not
        # cross the internet, so it has no real authentication result and must
        # not be shown one that implies it did.
        headers={
            "spf": "n/a (direct injection)",
            "dkim": "n/a (direct injection)",
            "dmarc": "n/a (direct injection)",
        },
        note="Injected from the mailing control deck",
        audit_action="INJECT_DIRECT_EMAIL",
    )


def ingest_inbound(message: InboundEmail, *, actor: str = "imap-watcher") -> dict[str, Any]:
    """Put a message fetched from a real mailbox through the same pipeline."""
    return _ingest(
        message_id=message.message_id,
        from_address=message.from_address,
        to_address=message.to_address,
        subject=message.subject or "(no subject)",
        body_text=message.body_text,
        attachments=[
            DirectMailAttachment(filename=item.filename, mime_type=item.mime_type, data=item.data)
            for item in message.attachments
        ],
        actor=actor,
        origin="IMAP",
        headers={
            "returnPath": message.headers.get("return-path", message.from_address),
            "spf": _auth_result(message.headers, "spf"),
            "dkim": _auth_result(message.headers, "dkim"),
            "dmarc": _auth_result(message.headers, "dmarc"),
        },
        note=f"Fetched from the mailbox at UID {message.uid}",
        audit_action="INGEST_INBOUND_EMAIL",
    )


def _ingest(
    *,
    message_id: str,
    from_address: str,
    to_address: str,
    subject: str,
    body_text: str,
    attachments: list[DirectMailAttachment],
    actor: str,
    origin: str,
    headers: dict[str, str],
    note: str,
    audit_action: str,
) -> dict[str, Any]:
    """The one path a message takes into this system, wherever it came from."""

    # ---- §1.3 idempotency, before anything is written --------------------
    existing = mailing_store.email_by_message_id(message_id)
    if existing:
        return {
            "emailLogId": existing["id"],
            "ingestJobId": existing.get("ingestJobId"),
            "status": (mailing_store.job(existing.get("ingestJobId") or "") or {}).get("status"),
            "deduplicated": True,
            "reason": "This Message-ID has already been ingested.",
        }

    stored_attachments = []
    for item in attachments:
        digest = sha256_of(item.data)
        seen = mailing_store.document_by_sha256(digest)
        if seen:
            return {
                "emailLogId": seen["email"]["id"],
                "ingestJobId": seen["email"].get("ingestJobId"),
                "status": (mailing_store.job(seen["email"].get("ingestJobId") or "") or {}).get("status"),
                "deduplicated": True,
                "reason": (
                    f"'{item.filename}' has the same SHA-256 as an attachment already "
                    f"on {seen['email']['id']} — the same document forwarded twice."
                ),
            }
        # The bytes go to disk under their own digest, and the ledger keeps the path.
        # Storing the file rather than only its size is what lets the extractor read the
        # PDF at all - and naming it by sha256 means the same document forwarded twice is
        # one file, which is the dedupe rule the ledger already applies to the record.
        stored_path = _store_attachment(digest, item.filename, item.data)
        readable = item.mime_type == "application/pdf" and pdf_text.has_text_layer(item.data)
        stored_attachments.append(
            {
                "id": f"DOC-{digest[:8].upper()}",
                "filename": item.filename,
                "mimeType": item.mime_type,
                "sizeBytes": len(item.data),
                "sha256": digest,
                # Honest about which it was: a text-layer PDF genuinely had no OCR run
                # against it, and saying DONE would claim work that never happened.
                "ocrStatus": (
                    "SKIPPED"
                    if item.mime_type != "application/pdf"
                    else ("NOT_NEEDED" if readable else "REQUIRED")
                ),
                "hasTextLayer": readable,
                "pages": _page_estimate(item.data),
                "storagePath": str(stored_path) if stored_path else None,
                "url": f"/uploads/mailing/{digest[:16]}-{item.filename}",
            }
        )

    email = mailing_store.mutate_append_email(
        {
            "messageId": message_id,
            "direction": "INBOUND",
            "source": origin,
            "fromAddress": from_address,
            "toAddress": to_address,
            "subject": subject,
            "bodyText": body_text,
            "headers": {"messageId": message_id, "returnPath": from_address, **headers},
            "attachments": stored_attachments,
        }
    )

    job = mailing_store.mutate_append_job(
        {
            "emailLogId": email["id"],
            "status": "RECEIVED",
            "holdReason": None,
            "cause": None,
            "confidence": 0.0,
            "extraction": {"fields": {}, "modelConfidence": 0.0},
            "correctedJson": None,
            "orderId": None,
            "timeline": [
                {
                    "at": now_iso(),
                    "status": "RECEIVED",
                    "action": flow.action_for("RECEIVED"),
                    "actor": actor,
                    "note": note,
                }
            ],
        }
    )
    # The two rows point at each other, so either one can be looked up from the
    # other without a scan.
    mailing_store.mutate_email_fields(email["id"], {"ingestJobId": job["id"]})

    _audit(actor, audit_action, "EmailLog", email["id"], f"'{subject}' from {from_address}.")

    job = _advance_pipeline(job["id"], actor=actor)

    return {
        "emailLogId": email["id"],
        "ingestJobId": job["id"],
        "status": job["status"],
        "deduplicated": False,
        "reason": None,
    }


def _auth_result(headers: dict[str, str], mechanism: str) -> str:
    """One verdict out of the Authentication-Results header.

    Reported as `unknown` when the server sent nothing — an authentication
    result the console invents is worse than one it admits it lacks.
    """
    raw = headers.get("authentication-results", "")
    match = re.search(rf"\b{mechanism}=(\w+)", raw, re.IGNORECASE)
    return match.group(1).lower() if match else "unknown"


# --------------------------------------------------------------------------- #
# resolveOnHoldItem                                                            #
# --------------------------------------------------------------------------- #


def resolve_on_hold_item(payload: ResolveOnHoldInput) -> dict[str, Any]:
    """Execute a triage decision with full audit logging (§3.3).

    The four actions are the spec's. Each one is refused up front by the state
    machine if it does not apply, so an operator cannot commit a message that is
    still mid-flight or discard one that is already closed.
    """
    job = mailing_store.job(payload.job_id)
    if not job:
        raise WriteServiceError(f"No ingest job matches '{payload.job_id}'.", 404)

    error = flow.triage_error(job["status"], payload.action)
    if error:
        raise WriteServiceError(error, 409)

    if payload.action == "COMMIT_EDITED":
        return _commit_edited(job, payload)
    if payload.action == "ACCOUNTS_APPROVE":
        return _accounts_approve(job, payload)
    if payload.action == "REJECT":
        return _reject(job, payload)
    if payload.action == "RETRY_EXTRACTION":
        return _retry_extraction(job, payload)
    if payload.action == "WHITELIST":
        email = mailing_store.email(job["emailLogId"]) or {}
        return whitelist_domain_and_reingest(
            WhitelistDomainInput(
                domain=domain_of(email.get("fromAddress", "")),
                company_name=payload.reason or domain_of(email.get("fromAddress", "")),
                actor=payload.actor,
                job_id=job["id"],
            )
        )

    raise WriteServiceError(f"'{payload.action}' is not a triage action.", 422)


def _commit_edited(job: dict, payload: ResolveOnHoldInput) -> dict[str, Any]:
    """Gate 1: the admin's approval, with any corrections they made.

    The operator's corrections are recorded as their own evidence rather than
    overwriting the model's: a human who types a value *is* the source, so the
    field is re-stamped `source = "HUMAN"` at full confidence, and the original
    stays underneath in `extraction` for anyone auditing the decision later.
    """
    corrections = payload.corrected_data or {}
    merged = _merge_corrections(job.get("extraction", {}), corrections, payload.actor)

    po_number = str(_value_of(merged, "poNumber") or "").strip()
    if not po_number:
        raise WriteServiceError(
            "A PO number is required before this can be committed. Add it in the "
            "resolver and try again.",
            422,
        )

    # The duplicate check runs again at commit time, because the ledger may have
    # moved since the exception was raised.
    clash = mailing_store.order_by_po(po_number)
    if clash and clash.get("sourceJobId") != job["id"]:
        raise WriteServiceError(
            f"PO {po_number} is already on the ledger as {clash['id']}. Reject this "
            "message as a duplicate, or correct the PO number.",
            409,
        )

    mailing_store.mutate_job_fields(
        job["id"],
        {
            "correctedJson": corrections or None,
            "extraction": merged,
            "touchedByHuman": True,
            "confidence": merged.get("modelConfidence", job.get("confidence", 0.0)),
        },
    )

    updated, error = mailing_store.mutate_transition(
        job["id"], "COMMITTED", payload.actor,
        payload.reason or "Released from triage with operator corrections.",
    )
    if error:
        raise WriteServiceError(error, 409)

    order = _commit_order(updated, merged, payload.actor)
    ack = _dispatch_acknowledgement(updated, order, payload.actor)

    released = _auto_release(job["id"], payload.actor)

    _audit(
        payload.actor, "RESOLVE_COMMIT_EDITED", "IngestJob", job["id"],
        f"Admin approved as {order['id']} ({po_number}); "
        f"{len(corrections)} field(s) corrected; acknowledgement {ack['id']}."
        + (" Released into PACT automatically (PACT_AUTO_RELEASE)." if released else ""),
    )

    return {
        "success": True,
        "orderId": order["id"],
        "acknowledgementId": ack["id"],
        "status": mailing_store.job(job["id"])["status"],
        "autoReleased": released,
    }


def _auto_release(job_id: str, actor: str) -> bool:
    """Pass the Accounts gate on the admin's behalf, when `PACT_AUTO_RELEASE` says so.

    The release runs on its own thread so the admin's click returns at once and the
    console watches PACT fill in real time over the event stream, instead of the request
    hanging for the length of the robot's work. `run_after_accounts_approval` is the
    same function the Accounts button calls: it refuses any job not at the gate, it is
    idempotent, and a PACT pause leaves the order retryable from the console exactly as
    before. Nothing new can reach PACT through here that could not already.
    """
    if not po_pipeline.pact_auto_release():
        return False
    current = mailing_store.job(job_id) or {}
    if current.get("status") != "AWAITING_ACCOUNTS_APPROVAL":
        return False
    mailing_store.mutate_job_fields(job_id, {"touchedByHuman": True})

    def release() -> None:
        try:
            po_pipeline.run_after_approval_sync(job_id, actor=actor)
        except Exception as error:  # noqa: BLE001 - a background failure must be on the ledger
            mailing_store.mutate_job_fields(job_id, {"lastPipelineError": str(error)})

    threading.Thread(target=release, name=f"pact-release-{job_id}", daemon=True).start()
    return True


def _accounts_approve(job: dict, payload: ResolveOnHoldInput) -> dict[str, Any]:
    """Gate 2: Accounts release the order into PACT.

    This is the only caller of the PACT half, and the state machine has already refused
    the action from any status but `AWAITING_ACCOUNTS_APPROVAL`. The transition into
    `PUSHED_TO_PACT` is made by the pipeline once a document number actually exists —
    never here, and never before.
    """
    mailing_store.mutate_job_fields(job["id"], {"touchedByHuman": True})
    run = po_pipeline.run_after_approval_sync(job["id"], actor=payload.actor)

    updated = mailing_store.job(job["id"]) or job
    push = mailing_store.latest_pact_push(job["id"]) or {}
    detail = next((s.detail for s in run.steps if s.status != "done"), "")

    if not run.ok:
        mailing_store.mutate_job_fields(job["id"], {"lastPipelineError": detail})
    _audit(
        payload.actor, "RESOLVE_ACCOUNTS_APPROVE", "IngestJob", job["id"],
        f"Accounts released to PACT; now {flow.label_for(updated['status'])}."
        + (f" {detail}" if detail else ""),
    )

    return {
        "success": run.ok,
        "paused": run.paused,
        "orderId": job.get("orderId"),
        "documentNo": push.get("documentNo"),
        "status": updated["status"],
        "steps": [s.as_dict() for s in run.steps],
    }


def _reject(job: dict, payload: ResolveOnHoldInput) -> dict[str, Any]:
    """Discard / Reject.

    §3.3 makes the note mandatory, and §1.2 forbids removing anything: the row
    stays on the ledger in `DISCARDED` with the reason attached. Canonical order
    tables are not touched at all.
    """
    note = (payload.reason or "").strip()
    if not note:
        raise WriteServiceError("A decision note is required to discard a message.", 422)

    updated, error = mailing_store.mutate_transition(job["id"], "DISCARDED", payload.actor, note)
    if error:
        raise WriteServiceError(error, 409)

    mailing_store.mutate_job_fields(job["id"], {"touchedByHuman": True, "decisionNote": note})
    _audit(payload.actor, "RESOLVE_REJECT", "IngestJob", job["id"], f"Discarded: {note}")

    return {"success": True, "orderId": None, "status": updated["status"]}


def _retry_extraction(job: dict, payload: ResolveOnHoldInput) -> dict[str, Any]:
    """Re-extract.

    Re-queues the existing document rather than re-ingesting the message, so the
    dedupe indices stay meaningful and the job keeps its history.
    """
    updated, error = mailing_store.mutate_transition(
        job["id"], "EXTRACTING", payload.actor,
        payload.reason or "Re-queued for extraction at higher OCR resolution.",
    )
    if error:
        raise WriteServiceError(error, 409)

    mailing_store.mutate_job_fields(job["id"], {"touchedByHuman": True, "retryCount": job.get("retryCount", 0) + 1})
    result = _advance_pipeline(job["id"], actor=payload.actor, from_extracting=True)

    _audit(payload.actor, "RESOLVE_RETRY_EXTRACTION", "IngestJob", job["id"],
           f"Re-extracted; now {flow.label_for(result['status'])}.")

    return {"success": True, "orderId": result.get("orderId"), "status": result["status"]}


# --------------------------------------------------------------------------- #
# whitelistDomainAndReingest                                                   #
# --------------------------------------------------------------------------- #


def whitelist_domain_and_reingest(payload: WhitelistDomainInput) -> dict[str, Any]:
    """Whitelist a sender domain and re-run everything it had quarantined.

    The spec's "optionally re-runs pending intake jobs" is not optional here:
    leaving five already-quarantined messages from a domain you just approved is
    exactly the state an operator would forget to clean up.
    """
    domain = (payload.domain or "").strip().lower().lstrip("@")
    if not domain or "." not in domain:
        raise WriteServiceError(f"'{payload.domain}' is not a domain.", 422)

    record = mailing_store.mutate_append_domain(
        {
            "domain": domain,
            "companyName": payload.company_name or domain,
            "companyCode": payload.company_code or "",
            "addedBy": payload.actor,
        }
    )

    # Every message still sitting in INTAKE_FILTERED from this domain goes back
    # through the pipeline, including the one the operator was looking at.
    reprocessed = 0
    for job in mailing_store.on_hold():
        if job["status"] != "NOT_AN_ORDER":
            continue
        email = mailing_store.email(job["emailLogId"]) or {}
        if domain_of(email.get("fromAddress", "")) != domain:
            continue

        moved, error = mailing_store.mutate_transition(
            job["id"], "CLASSIFIED", payload.actor,
            f"Domain {domain} whitelisted — returned to the pipeline.",
        )
        if error:
            continue
        mailing_store.mutate_job_fields(job["id"], {"touchedByHuman": True, "cause": None})
        _advance_pipeline(job["id"], actor=payload.actor, from_classified=True)
        reprocessed += 1

    _audit(payload.actor, "WHITELIST_DOMAIN", "CompanyDomain", record["id"],
           f"Whitelisted {domain} ({record['companyName']}); re-ingested {reprocessed} message(s).")

    return {
        "success": True,
        "companyDomainId": record["id"],
        "domain": domain,
        "reprocessedCount": reprocessed,
    }


# --------------------------------------------------------------------------- #
# Monitor controls (§3.1)                                                      #
# --------------------------------------------------------------------------- #


def connect_mailbox(
    *,
    address: str,
    password: str,
    actor: str,
    host: str = "",
    port: int = 993,
    mailbox: str = "INBOX",
) -> dict[str, Any]:
    """Connect a mailbox from the control deck.

    The credentials are proved against the server *before* anything is stored: a
    failed login returns the provider's own message and changes nothing. On
    success the mailbox is sealed to disk and the monitor is pointed at it, so
    "connected" always means "being watched right now".
    """
    address = (address or "").strip().lower()
    if "@" not in address:
        raise WriteServiceError(f"'{address}' is not an email address.", 422)
    if not password:
        raise WriteServiceError("An app password is required.", 422)

    candidate = MailConnection(
        address=address,
        host=(host or "").strip() or host_for(address),
        port=int(port or 993),
        secure=True,
        mailbox=(mailbox or "INBOX").strip() or "INBOX",
        password=password,
        connected_at=None,
        auto_start=True,
        source="connected",
    )

    try:
        status = verify_mailbox(candidate)
    except ImapError as error:
        # The provider's message reaches the operator verbatim — it is almost
        # always more useful than anything this layer could invent.
        raise WriteServiceError(str(error), 400) from error

    stored = save_connection(
        address=candidate.address,
        password=password,
        host=candidate.host,
        port=candidate.port,
        mailbox=candidate.mailbox,
    )

    # A newly connected mailbox baselines at its newest message, so pointing the
    # console at a real account never ingests years of history.
    monitor = mailing_store.mutate_monitor(
        {
            "connection": "IMAP",
            "host": stored.host,
            "mailbox": stored.address,
            "folder": stored.mailbox,
            "state": "RUNNING",
            "paused": False,
            "lastError": None,
            "connected": True,
            "source": stored.source,
            "connectedAt": stored.connected_at,
            "messageCount": status.message_count,
            "uidValidity": status.uid_validity,
            "lastSeenUid": status.uid_next - 1,
            "consecutiveFailures": 0,
        }
    )
    _audit(
        actor, "CONNECT_MAILBOX", "Monitor", stored.address,
        f"Connected {stored.address} on {stored.host}; baselined at UID {status.uid_next - 1}.",
    )

    return {"monitor": monitor, "mailbox": stored.redacted(), "messageCount": status.message_count}


def disconnect_mailbox(actor: str) -> dict[str, Any]:
    """Stop watching and forget the stored credentials.

    This drops a credential file, not a canonical record: every message the
    mailbox ever delivered stays on the ledger.
    """
    clear_connection()
    monitor = mailing_store.mutate_monitor(
        {"connected": False, "state": "DISCONNECTED", "source": None, "lastError": None}
    )
    _audit(actor, "DISCONNECT_MAILBOX", "Monitor", "-", "Mailbox disconnected.")
    return {"monitor": monitor}


def mailbox_status() -> dict[str, Any]:
    """What the control deck shows. Never includes the password."""
    connection = resolve_connection()
    return {
        "monitor": mailing_store.monitor(),
        "mailbox": connection.redacted() if connection else None,
        "connected": connection is not None,
    }


def run_poll_now(
    actor: str, *, manual: bool = True, source: Optional[ImapEmailSource] = None
) -> dict[str, Any]:
    """Poll the mailbox.

    With a mailbox connected this is a real IMAP fetch against a durable
    UIDVALIDITY/UID cursor. With none, it is honest about what it did: it stamps
    the heartbeat and reports zero new messages rather than inventing traffic,
    and injection remains how mail arrives.

    `manual` separates an operator pressing the button from the background
    loop's own ticks. Both poll identically; only the operator's action reaches
    the audit log, because a heartbeat every few seconds would bury the
    decisions that log exists to record.

    `source` is the watcher's own long-lived session. The loop keeps one IMAP
    connection open between ticks (and idles on it, so new mail is noticed the
    moment it lands) rather than logging in afresh every time; a caller that
    passes none gets a connection for this poll only.
    """
    monitor = mailing_store.monitor()
    if monitor.get("paused"):
        raise WriteServiceError("The watcher is paused. Resume it before polling.", 409)

    connection = resolve_connection()
    if connection is None:
        updated = mailing_store.mutate_monitor(
            {
                "lastCheckedAt": now_iso(),
                "pollCount": monitor.get("pollCount", 0) + 1,
                "lastError": None,
                "state": "RUNNING",
                "connected": False,
            }
        )
        if manual:
            _audit(actor, "RUN_POLL", "Monitor", "-", "Manual poll with no mailbox connected.")
        return {"monitor": updated, "newMessages": 0, "connected": False}

    return _poll_mailbox(connection, actor, manual=manual, source=source)


def _poll_mailbox(
    connection: MailConnection,
    actor: str,
    *,
    manual: bool = True,
    source: Optional[ImapEmailSource] = None,
) -> dict[str, Any]:
    """One tick against a live mailbox.

    The cursor advances *per message*, so a crash mid-batch resumes after the
    last message that was fully handled rather than replaying the batch — and
    the Message-ID dedupe absorbs the overlap if it does.
    """
    monitor = mailing_store.monitor()
    owned = source is None
    if source is None:
        source = ImapEmailSource(connection)
    ingested: list[str] = []

    try:
        source.connect()
        status = source.status()

        last_seen = int(monitor.get("lastSeenUid") or 0)
        if monitor.get("uidValidity") != status.uid_validity:
            # First run, or the server renumbered the mailbox: baseline at the
            # newest message so the account's history is never ingested.
            last_seen = status.uid_next - 1
            mailing_store.mutate_monitor(
                {"uidValidity": status.uid_validity, "lastSeenUid": last_seen}
            )

        for uid in source.list_new_uids(last_seen):
            message = source.get_message(uid)

            # Our own acknowledgements land back in the inbox when the console
            # watches the account it sends from. Skipped on the header, not the
            # sender, so a self-addressed demo still works. This is the one
            # message that is not recorded — it is our own outbound mail.
            if ACK_HEADER.lower() in message.headers:
                mailing_store.mutate_monitor({"lastSeenUid": uid})
                continue

            result = ingest_inbound(message)
            if not result["deduplicated"]:
                ingested.append(result["emailLogId"])

            # Durable advance, per message.
            mailing_store.mutate_monitor({"lastSeenUid": uid})

        updated = mailing_store.mutate_monitor(
            {
                "lastCheckedAt": now_iso(),
                "pollCount": monitor.get("pollCount", 0) + 1,
                "messageCount": status.message_count,
                "lastError": None,
                "state": "RUNNING",
                "connected": True,
                "consecutiveFailures": 0,
                **({"lastMessageAt": now_iso()} if ingested else {}),
            }
        )

    except ImapError as error:
        failures = int(monitor.get("consecutiveFailures") or 0) + 1
        mailing_store.mutate_monitor(
            {
                "lastCheckedAt": now_iso(),
                "lastError": str(error),
                "state": "ERROR",
                "consecutiveFailures": failures,
            }
        )
        # A session the watcher owns is disposed by the watcher, which reconnects on
        # its next tick; one made for this poll alone is torn down here either way.
        source.dispose()
        raise WriteServiceError(str(error), 502) from error
    finally:
        if owned:
            source.dispose()

    # An operator's poll is always recorded; the loop's ticks only when they
    # actually brought something in.
    if manual or ingested:
        _audit(
            actor, "RUN_POLL", "Monitor", connection.address,
            f"Polled {connection.address}; ingested {len(ingested)} message(s).",
        )

    return {"monitor": updated, "newMessages": len(ingested), "connected": True}


def set_monitor_paused(paused: bool, actor: str) -> dict[str, Any]:
    updated = mailing_store.mutate_monitor(
        {"paused": bool(paused), "state": "PAUSED" if paused else "RUNNING"}
    )
    _audit(actor, "PAUSE_MONITOR" if paused else "RESUME_MONITOR", "Monitor", "-",
           "Watcher paused." if paused else "Watcher resumed.")
    return {"monitor": updated}


# --------------------------------------------------------------------------- #
# The pipeline                                                                 #
# --------------------------------------------------------------------------- #


def _advance_pipeline(
    job_id: str,
    *,
    actor: str,
    from_classified: bool = False,
    from_extracting: bool = False,
) -> dict[str, Any]:
    """Drive one job as far through the graph as it can legally go.

    Every hop is a real state-machine transition rather than a jump to the end
    state, so the lifecycle timeline the inspector renders is the actual route
    the message took — including the steps it passed through in a second.
    """
    job = mailing_store.job(job_id)
    if not job:
        raise WriteServiceError(f"No ingest job matches '{job_id}'.", 404)
    email = mailing_store.email(job["emailLogId"])
    if not email:
        raise WriteServiceError(f"Ingest job '{job_id}' has no message behind it.", 404)

    sender = email.get("fromAddress", "")
    known = mailing_store.is_known_domain(sender) or mailing_extraction.is_trusted_sender(sender)
    domain_row = mailing_store.domain(domain_of(sender))

    # A PO that already sits on the ledger under a *different* job is a duplicate.
    attachments = _with_bytes(email.get("attachments", []))
    provisional_po = mailing_extraction.find_po_number(
        email.get("subject", ""), email.get("bodyText", ""), attachments
    )
    duplicate = None
    if provisional_po:
        clash = mailing_store.order_by_po(provisional_po)
        if clash and clash.get("sourceJobId") != job_id:
            duplicate = clash
        else:
            # An order row only exists once an admin has approved, so the same PO arriving
            # twice before anybody looked at it would otherwise slip through both times.
            # The job ledger is the earlier record of the same fact.
            duplicate = _job_with_same_po(job_id, provisional_po)

    verdict = mailing_extraction.extract(
        subject=email.get("subject", ""),
        body=email.get("bodyText", ""),
        from_address=sender,
        attachments=attachments,
        known_domain=known,
        company_name=(domain_row or {}).get("companyName"),
        duplicate_of=duplicate,
    )

    # Walk the graph: RECEIVED -> CLASSIFIED -> EXTRACTING -> verdict.
    if not from_classified and not from_extracting:
        if verdict["status"] == "NOT_AN_ORDER":
            mailing_store.mutate_transition(job_id, "NOT_AN_ORDER", PIPELINE_ACTOR,
                                            flow.CAUSE_LABEL.get(verdict["cause"] or "", ""))
            mailing_store.mutate_job_fields(job_id, {"cause": verdict["cause"], "confidence": 0.0})
            return mailing_store.job(job_id)
        mailing_store.mutate_transition(job_id, "CLASSIFIED", PIPELINE_ACTOR, "")

    if not from_extracting:
        mailing_store.mutate_transition(job_id, "EXTRACTING", PIPELINE_ACTOR, "")

    mailing_store.mutate_job_fields(
        job_id,
        {
            "extraction": verdict["extraction"],
            "confidence": verdict["confidence"],
            "cause": verdict["cause"],
        },
    )

    if verdict["status"] == "EXCEPTION":
        mailing_store.mutate_transition(
            job_id, "EXCEPTION", PIPELINE_ACTOR, flow.CAUSE_LABEL.get(verdict["cause"] or "", "")
        )
        return mailing_store.job(job_id)

    if verdict["status"] == "NOT_AN_ORDER":
        mailing_store.mutate_transition(job_id, "EXCEPTION", PIPELINE_ACTOR,
                                        "Re-extraction found no order markers.")
        mailing_store.mutate_job_fields(job_id, {"cause": "NO_ORDER_MARKERS"})
        return mailing_store.job(job_id)

    mailing_store.mutate_transition(job_id, "VALIDATED", PIPELINE_ACTOR, "")

    # Every clean order stops here. There is no straight-through path any more: the
    # receipt goes out automatically, and then an admin decides whether work starts.
    note = "Held for an admin to approve."
    if verdict.get("highValue"):
        note += (
            f" Order value Rs {verdict['orderValue']:,.0f} is at or above the "
            f"Rs {flow.APPROVAL_GATE_VALUE:,.0f} large-order mark (ADR-0005)."
        )
    _, error = mailing_store.mutate_transition(
        job_id, "AWAITING_ADMIN_APPROVAL", PIPELINE_ACTOR, note
    )
    if error:
        raise WriteServiceError(error, 409)

    # Ungated, and immediate: the customer hears that their document arrived, and Sales
    # sees the order, before anybody has looked at either.
    _run_intake(job_id, PIPELINE_ACTOR)
    return mailing_store.job(job_id)


def _run_intake(job_id: str, actor: str) -> None:
    """The receipt half. A failure here is recorded, never fatal to the order."""
    run = po_pipeline.run_on_intake(job_id, actor=actor)
    if not run.ok:
        failed = next((step for step in run.steps if step.status != "done"), None)
        mailing_store.mutate_job_fields(
            job_id, {"lastPipelineError": failed.detail if failed else "receipt failed"}
        )


#: Statuses that no longer claim a PO number - a closed or filtered job is not a clash.
_CLOSED_STATUSES = {"DISCARDED", "NOT_AN_ORDER", "EXCEPTION"}


def _job_with_same_po(job_id: str, po_number: str) -> Optional[dict]:
    """Another live job that already read this PO number, if there is one."""
    wanted = po_number.strip().lower()
    for other in mailing_store.jobs():
        if other["id"] == job_id or other.get("status") in _CLOSED_STATUSES:
            continue
        seen = str(_value_of(other.get("extraction") or {}, "poNumber") or "").strip().lower()
        if seen and seen == wanted:
            return other
    return None


def _commit_order(job: dict, extraction: dict, actor: str) -> dict:
    """Create the canonical order and its first version, or version an existing one."""
    po_number = str(_value_of(extraction, "poNumber") or "").strip()
    payload = {
        "poNumber": po_number,
        "customer": _value_of(extraction, "customer"),
        "quantityMetres": _value_of(extraction, "quantityMetres"),
        "orderValue": _value_of(extraction, "orderValue"),
        "deliveryDate": _value_of(extraction, "deliveryDate"),
    }

    existing_id = job.get("orderId")
    if existing_id and mailing_store.order(existing_id):
        # A re-release of the same job appends a version; the head moves, the
        # history stays. This is the §1.2 append-only rule in its strongest form.
        mailing_store.mutate_append_order_version(
            existing_id,
            {"reason": "OPERATOR_CORRECTION", "actor": actor, "payload": payload},
        )
        return mailing_store.order(existing_id)

    order = mailing_store.mutate_append_order(
        {
            "poNumber": po_number,
            "customer": payload["customer"],
            "customerCode": (mailing_store.domain(
                domain_of((mailing_store.email(job["emailLogId"]) or {}).get("fromAddress", ""))
            ) or {}).get("companyCode", ""),
            "orderValue": payload["orderValue"] or 0.0,
            "status": "OPEN",
            "sourceJobId": job["id"],
        },
        {"reason": "INITIAL_COMMIT", "actor": actor, "payload": payload},
    )
    mailing_store.mutate_job_fields(job["id"], {"orderId": order["id"]})
    return order


def _dispatch_acknowledgement(job: dict, order: dict, actor: str) -> dict:
    """What happens the moment an admin approves: tell the customer, task the team.

    ## What changed here, and why

    This once sent a single message, last, that read *"We confirm receipt of purchase
    order ..."* under the subject *"Acknowledged: ..."*. Three things were wrong with it:

      * **The wording promised something.** "Confirm" and "Acknowledged" describe a
        decision to supply. Sent automatically off a regex reading of a PDF they turn every
        inbound email into an apparent agreement to fulfil an order at whatever prices and
        dates the parser happened to find.
      * **It was in the wrong place.** It fired only after `COMMITTED`, at the end of a
        straight-through path. A customer should hear that their order arrived within
        seconds of it arriving.
      * **It was the only thing that happened.** Nobody inside the company was given any
        work to do.

    So there are two customer-facing messages now. The automatic receipt goes out at
    intake, before any of this, and may say only that a document arrived
    (`mailing_messages.assert_receipt_wording` refuses anything stronger). This one follows
    the admin's approval, is allowed to say the order is accepted because by then a person
    has decided that it is, and it comes with tasks for Sales, Accounts and Manufacturing.

    The commit that reaches here is a commit to *KiranOS's own* order ledger. Nothing has
    reached PACT and nothing has been billed: that needs the Accounts gate, and
    `po_pipeline.run_after_accounts_approval` is the only route to it.

    Returns the acknowledgement row, so callers that reported an `acknowledgementId` still
    can.
    """
    run = po_pipeline.run_on_admin_approval(job["id"], actor=actor)
    if not run.ok:
        # A message that could not be written is worth surfacing, but it must never unwind
        # an approved order - the approval is real whether or not the mail server was up.
        failed = next((step for step in run.steps if step.status != "done"), None)
        mailing_store.mutate_job_fields(
            job["id"], {"lastPipelineError": failed.detail if failed else "acknowledgement failed"}
        )

    ack = next(
        (
            e
            for e in mailing_store.emails()
            if e.get("ingestJobId") == job["id"] and e.get("kind") == "ACKNOWLEDGEMENT"
        ),
        None,
    )
    return ack or {"id": None, "direction": "OUTBOUND", "subject": ""}


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #


def _merge_corrections(extraction: dict, corrections: dict, actor: str) -> dict:
    """Fold operator edits into the extraction without losing the model's view.

    A corrected field is re-stamped with the operator as its source at full
    confidence — a human who types a value *is* the evidence — and the value the
    model proposed is kept beside it under `supersededValue`.
    """
    merged = {
        "fields": {name: dict(value) for name, value in (extraction.get("fields") or {}).items()},
        "modelConfidence": extraction.get("modelConfidence", 0.0),
        # Everything the extraction carries that is not a confidence-scored field. Listing
        # only `fields` here silently dropped the order's line items and the PACT terms on
        # every approval, so a three-line PO reached PACT as one aggregated row.
        "lineItems": list(extraction.get("lineItems") or []),
        "pactTerms": dict(extraction.get("pactTerms") or {}),
    }

    for name, value in (corrections or {}).items():
        previous = merged["fields"].get(name, {})
        merged["fields"][name] = {
            "value": value,
            "confidence": 1.0,
            "page": previous.get("page", 1),
            "bbox": previous.get("bbox", [0, 0, 0, 0]),
            "snippet": f"Entered by {actor}",
            "source": "HUMAN",
            "supersededValue": previous.get("value"),
            "supersededConfidence": previous.get("confidence"),
        }

    if corrections:
        merged["modelConfidence"] = 1.0
        merged["correctedBy"] = actor
        merged["correctedAt"] = now_iso()

    return merged


def _value_of(extraction: dict, name: str) -> Any:
    return ((extraction.get("fields") or {}).get(name) or {}).get("value")


def _store_attachment(digest: str, filename: str, data: bytes):
    """Write the attachment under its digest. Returns the path, or None if it could not.

    A failure here must not lose the message: the ledger row, the dedupe index and the
    whole pipeline work from metadata, and losing an order because a disk was full would
    be a far worse outcome than losing the ability to re-read one attachment.
    """
    try:
        folder = UPLOAD_DIR / "mailing"
        folder.mkdir(parents=True, exist_ok=True)
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", filename or "attachment")[-80:]
        path = folder / f"{digest[:16]}-{safe}"
        if not path.exists():
            path.write_bytes(data)
        return path
    except OSError:
        return None


def _with_bytes(attachments: list[dict]) -> list[dict]:
    """The stored attachments, each with its `data` read back from disk.

    The ledger holds metadata; the extractor needs the document. Anything unreadable comes
    back without `data` rather than raising, and the extractor then simply finds less -
    which is the same position it was in before the file existed.
    """
    out = []
    for attachment in attachments:
        item = dict(attachment)
        path = attachment.get("storagePath")
        if path:
            try:
                item["data"] = Path(path).read_bytes()
            except OSError:
                pass
        out.append(item)
    return out


def _page_estimate(data: bytes) -> int:
    """How many pages a PDF declares.

    Counted from the `/Type /Page` objects rather than guessed from the byte
    size, so the attachment tray shows a real number. A file that is not a PDF,
    or one whose structure this cannot read, reports a single page rather than
    zero — the viewer needs something to open.
    """
    if not data.startswith(b"%PDF"):
        return 1
    pages = len(re.findall(rb"/Type\s*/Page[^s]", data))
    return max(1, pages)


def _message_id(sender: str, subject: str) -> str:
    """A stable Message-ID for an injected message.

    Deterministic on purpose: re-injecting the same subject from the same sender
    is how an operator demonstrates the idempotency rule, and it should be
    reproducible rather than a matter of timing.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", subject.lower()).strip("-")[:48] or "message"
    return f"<{slug}.{sha256_of((sender + subject).encode('utf-8'))[:12]}@direct.kirancable.com>"


def _audit(actor: str, action: str, subject_type: str, subject_id: str, note: str) -> None:
    mailing_store.mutate_append_audit(
        {
            "actor": actor,
            "action": action,
            "subjectType": subject_type,
            "subjectId": subject_id,
            "note": note,
        }
    )
