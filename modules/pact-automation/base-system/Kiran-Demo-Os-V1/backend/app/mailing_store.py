"""The canonical mailing tables.

WORKING.md assumes Prisma 6 over PostgreSQL 16. This console has no database —
it runs off in-memory dictionaries with a JSON snapshot (see `store.py`), and
that is deliberate: nothing to install, nothing to migrate, and the state
survives a restart on a laptop the morning of a demo. So the *tables* are ported
rather than the engine, and the guarantees the spec actually cares about are
enforced here in Python instead of by the database:

  * **Zero DELETE (§1.2).** There is no method on this class that removes a
    record. Closing something writes the `DISCARDED` sentinel; hiding something
    sets `isArchived = True`. The word `del` does not appear against a canonical
    collection anywhere in this file.
  * **Idempotent ingestion (§1.3).** `email_by_message_id` and
    `document_by_sha256` are the dedupe indices. Re-injecting a message returns
    the record that already exists rather than making a second one.
  * **Append-only history.** An order is never edited in place; a correction
    appends an `OrderVersion` and repoints the order's head. The previous
    version stays readable forever.

Every mutator here is prefixed `mutate_` and is reserved for
`app/write_service/mailing.py`. Routers call the reads and the write service,
never these — `tests/test_mailing.py` enforces that statically, which is this
codebase's equivalent of the spec's "no `prisma.x.create` in a route handler"
rule.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from . import events, mailing_workflow as flow
from .config import DATA_DIR
from .mailing_seed import build_seed

MAILING_FILE = DATA_DIR / "mailing.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    """Tolerant ISO parse — seeded rows and runtime rows both land here."""
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class MailingStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        # The mtime of the snapshot this process last read or wrote. See `_sync`.
        self._mtime = 0.0
        self._load()

    # ------------------------------------------------------------------ #
    # Lifecycle                                                          #
    # ------------------------------------------------------------------ #

    def _blank(self) -> dict[str, Any]:
        return build_seed()

    #: How many times to retry reading the snapshot, and the wait between tries. Same
    #: shape as the write-side retry below, for the same reason.
    _READ_ATTEMPTS = 6
    _READ_BACKOFF = 0.04

    def _load(self) -> None:
        """Read the snapshot into memory. Never throws the ledger away to do it.

        This used to fall through to "start from seed and write that to disk" on any
        read error. On Windows a read that lands while another thread is mid-`os.replace`
        raises `PermissionError`, and a read of a file another process is still writing
        can return half a document - both transient, both a few milliseconds long, and
        both were enough to replace the live order ledger with the demo seed and persist
        it. That is what a 500 on an approval with `'NoneType' object is not
        subscriptable` was: the job had been on the ledger a moment earlier.

        So a read is retried, and if it still fails the state already in memory is kept.
        The only time seed data is written is when there is no file at all. A file that
        exists but cannot be read even after the retries is moved aside intact rather than
        overwritten - it is the only copy of the ledger, and somebody can look at it.
        """
        if not MAILING_FILE.exists():
            self._state = self._blank()
            self._persist()
            return

        error: Optional[Exception] = None
        for attempt in range(self._READ_ATTEMPTS):
            try:
                loaded = json.loads(MAILING_FILE.read_text(encoding="utf-8"))
                if not isinstance(loaded, dict):
                    raise json.JSONDecodeError("not an object", "", 0)
                for key, value in self._blank().items():
                    loaded.setdefault(key, value)
                self._state = loaded
                self._mtime = MAILING_FILE.stat().st_mtime
                return
            except (json.JSONDecodeError, OSError) as failure:
                error = failure
                time.sleep(self._READ_BACKOFF * (attempt + 1))

        if getattr(self, "_state", None):
            # A re-sync that could not read the file: carry on with what is in memory. The
            # next mutation writes it back, and the file is whole again.
            logging.getLogger("kiranos.mail").warning(
                "mailing ledger could not be re-read (%s); keeping the in-memory state", error
            )
            return

        # First load, and the file is unreadable. Preserve it, then start from seed.
        aside = MAILING_FILE.with_name(f"mailing.unreadable-{int(time.time())}.json")
        try:
            os.replace(MAILING_FILE, aside)
        except OSError:
            pass
        logging.getLogger("kiranos.mail").error(
            "mailing ledger unreadable at startup (%s); moved to %s and starting from seed",
            error, aside.name,
        )
        self._state = self._blank()
        self._persist()

    def _sync(self) -> None:
        """Re-read the snapshot if another process has written it.

        The ledger is one JSON file and more than one process legitimately holds it: the
        API server, and the command-line tools in `backend/tools/` that seed a demo or
        drive the pipeline end to end. Without this check the server would keep serving
        the state it started with and then overwrite the seed on its next mutation —
        which looks, from the browser, exactly like the seeding silently failing.

        A stat per read is the whole cost, and at this size that is nothing. It also means
        the running console picks up a re-seed on the next refresh rather than needing a
        restart, which is what somebody setting up ten minutes before a demo wants.
        """
        # Under the lock: a reload swaps `self._state` wholesale, and doing that while
        # another thread is inside a mutation is how a write lands on a dict nobody
        # persists any more.
        with self._lock:
            try:
                mtime = MAILING_FILE.stat().st_mtime
            except OSError:
                return
            if mtime > self._mtime:
                self._load()

    #: How many times to retry the atomic replace, and how long to wait between tries.
    #: Six attempts backing off 40ms at a time covers about half a second, which is far
    #: longer than any scanner holds a 200KB file.
    _REPLACE_ATTEMPTS = 6
    _REPLACE_BACKOFF = 0.04

    def _persist(self) -> None:
        """Atomic write, so a crash mid-save cannot truncate the ledger.

        `os.replace` is atomic on Windows but not always *permitted*: if anything else has
        the destination open even momentarily - a virus scanner, the search indexer, a
        backup agent, an editor watching the folder - it fails with
        `PermissionError: [WinError 5] Access is denied`. That is transient and clears in
        milliseconds, but an unretried failure propagates all the way out as a 500 and
        leaves the job half-moved: in one observed case the acknowledgement had been sent
        and the team tasks created, and then the transition that should have handed the
        order to Accounts never ran, so it sat at COMMITTED looking like the pipeline had
        silently stopped. Retrying is the whole fix.

        The temporary file is named per-write rather than a fixed `mailing.tmp`, so two
        processes saving at once cannot destroy each other's half-written file. Both are
        complete when they are renamed, so last-writer-wins is the correct outcome.
        """
        MAILING_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = MAILING_FILE.with_suffix(f".{os.getpid()}.{threading.get_ident():x}.tmp")
        tmp.write_text(json.dumps(self._state, indent=2), encoding="utf-8")

        for attempt in range(self._REPLACE_ATTEMPTS):
            try:
                os.replace(tmp, MAILING_FILE)
                break
            except PermissionError:
                if attempt == self._REPLACE_ATTEMPTS - 1:
                    # Out of retries. Leave the temporary file behind rather than deleting
                    # it - it holds the state that could not be written, and it is the only
                    # copy of it.
                    raise
                time.sleep(self._REPLACE_BACKOFF * (attempt + 1))
        else:                                        # pragma: no cover - the loop breaks
            return

        try:
            self._mtime = MAILING_FILE.stat().st_mtime
        except OSError:
            pass

    def _commit(self) -> None:
        self._state["version"] += 1
        self._persist()
        # Rides the console's existing SSE bus, so the hub updates across tabs
        # exactly like the claims ledger does.
        events.publish("mailing", self.summary())

    def reset(self) -> dict[str, Any]:
        with self._lock:
            self._state = self._blank()
            self._persist()
            events.publish("mailing", self.summary())
            return self.summary()

    def _next(self, key: str, prefix: str) -> str:
        seq = self._state["seq"]
        seq[key] = seq.get(key, 0) + 1
        return f"{prefix}-{datetime.now(timezone.utc):%Y}-{seq[key]:04d}"

    # ------------------------------------------------------------------ #
    # Reads — emails                                                     #
    # ------------------------------------------------------------------ #

    def emails(self) -> list[dict]:
        self._sync()
        with self._lock:
            return [e for e in self._state["emails"] if not e.get("isArchived")]

    def email(self, email_id: str) -> Optional[dict]:
        self._sync()
        with self._lock:
            return next((e for e in self._state["emails"] if e["id"] == email_id), None)

    def email_by_message_id(self, message_id: str) -> Optional[dict]:
        """§1.3 dedupe index. A repeated Message-ID is the same message."""
        self._sync()
        if not message_id:
            return None
        with self._lock:
            return next(
                (e for e in self._state["emails"] if e.get("messageId") == message_id),
                None,
            )

    def document_by_sha256(self, digest: str) -> Optional[dict]:
        """§1.3 dedupe index. A forwarded attachment is the same document."""
        self._sync()
        if not digest:
            return None
        with self._lock:
            for email in self._state["emails"]:
                for attachment in email.get("attachments", []):
                    if attachment.get("sha256") == digest:
                        return {"email": email, "attachment": attachment}
        return None

    # ------------------------------------------------------------------ #
    # Reads — jobs                                                       #
    # ------------------------------------------------------------------ #

    def jobs(self) -> list[dict]:
        self._sync()
        with self._lock:
            return [j for j in self._state["jobs"] if not j.get("isArchived")]

    def job(self, job_id: str) -> Optional[dict]:
        self._sync()
        with self._lock:
            return next((j for j in self._state["jobs"] if j["id"] == job_id), None)

    def job_for_email(self, email_id: str) -> Optional[dict]:
        self._sync()
        with self._lock:
            return next(
                (j for j in self._state["jobs"] if j.get("emailLogId") == email_id), None
            )

    def on_hold(self) -> list[dict]:
        """Everything waiting on a human, newest first."""
        self._sync()
        held = [j for j in self.jobs() if flow.is_on_hold(j["status"])]
        return sorted(held, key=lambda j: j.get("createdAt", ""), reverse=True)

    # ------------------------------------------------------------------ #
    # Reads — canonical orders and reference data                        #
    # ------------------------------------------------------------------ #

    def orders(self) -> list[dict]:
        self._sync()
        with self._lock:
            return [o for o in self._state["orders"] if not o.get("isArchived")]

    def order(self, order_id: str) -> Optional[dict]:
        self._sync()
        with self._lock:
            return next((o for o in self._state["orders"] if o["id"] == order_id), None)

    def order_versions(self, order_id: str) -> list[dict]:
        self._sync()
        with self._lock:
            return [v for v in self._state["orderVersions"] if v["orderId"] == order_id]

    def order_by_po(self, po_number: str) -> Optional[dict]:
        """Duplicate-PO detection reads through here."""
        self._sync()
        if not po_number:
            return None
        with self._lock:
            return next(
                (
                    o
                    for o in self._state["orders"]
                    if str(o.get("poNumber", "")).upper() == str(po_number).upper()
                ),
                None,
            )

    def domains(self) -> list[dict]:
        self._sync()
        with self._lock:
            return list(self._state["companyDomains"])

    def domain(self, domain: str) -> Optional[dict]:
        self._sync()
        needle = (domain or "").lower().lstrip("@")
        with self._lock:
            return next(
                (d for d in self._state["companyDomains"] if d["domain"] == needle), None
            )

    def is_known_domain(self, address: str) -> bool:
        self._sync()
        return self.domain(domain_of(address)) is not None

    def monitor(self) -> dict:
        self._sync()
        with self._lock:
            return dict(self._state["monitor"])

    def audit(self, limit: int = 100) -> list[dict]:
        self._sync()
        with self._lock:
            return list(reversed(self._state["audit"][-limit:]))

    # ------------------------------------------------------------------ #
    # Reads — aggregates                                                 #
    # ------------------------------------------------------------------ #

    def summary(self) -> dict[str, Any]:
        """The badge counters behind `/api/mailing/summary`."""
        self._sync()
        with self._lock:
            jobs = self.jobs()
            emails = self.emails()
            held = [j for j in jobs if flow.is_on_hold(j["status"])]
            committed = [j for j in jobs if flow.is_committed(j["status"])]
            # STP is the share of *decided* orders that never needed a human —
            # jobs still mid-flight would otherwise depress the rate all day.
            decided = [j for j in jobs if j["status"] not in ("RECEIVED", "CLASSIFIED", "EXTRACTING")]
            straight_through = [j for j in committed if not j.get("touchedByHuman")]
            return {
                "version": self._state["version"],
                "totalMails": len(emails),
                "inboundCount": sum(1 for e in emails if e["direction"] == "INBOUND"),
                "outboundCount": sum(1 for e in emails if e["direction"] == "OUTBOUND"),
                "onHoldCount": len(held),
                "onHoldByReason": {
                    reason: sum(1 for j in held if j.get("holdReason") == reason)
                    for reason in flow.HOLD_REASON_LABEL
                },
                "committedCount": len(committed),
                "stpRate": round(len(straight_through) / len(decided), 4) if decided else 0.0,
                "monitor": self.monitor(),
            }

    def analytics(self, days: int = 14) -> dict[str, Any]:
        """Everything §3.4 asks for, computed from the ledger on every read.

        The dataset is tens of rows, so there is no cache to invalidate and no
        way for a chart to disagree with the table it sits above.
        """
        self._sync()
        with self._lock:
            jobs = self.jobs()
            emails = self.emails()

            # --- Intake velocity, bucketed by day -------------------------
            today = datetime.now(timezone.utc).date()
            buckets = {
                (today - timedelta(days=offset)).isoformat(): {
                    "date": (today - timedelta(days=offset)).isoformat(),
                    "orders": 0,
                    "notOrders": 0,
                    "exceptions": 0,
                }
                for offset in range(days - 1, -1, -1)
            }
            for job in jobs:
                day = parse_iso(job.get("createdAt", "")).date().isoformat()
                bucket = buckets.get(day)
                if not bucket:
                    continue
                if job["status"] == "NOT_AN_ORDER":
                    bucket["notOrders"] += 1
                elif job["status"] == "EXCEPTION":
                    bucket["exceptions"] += 1
                else:
                    bucket["orders"] += 1

            # --- Exception Pareto ----------------------------------------
            causes: dict[str, int] = {}
            for job in jobs:
                cause = job.get("cause")
                if cause:
                    causes[cause] = causes.get(cause, 0) + 1
            total_causes = sum(causes.values())
            running = 0
            pareto = []
            for cause, count in sorted(causes.items(), key=lambda kv: kv[1], reverse=True):
                running += count
                pareto.append(
                    {
                        "cause": cause,
                        "label": flow.CAUSE_LABEL.get(cause, cause),
                        "count": count,
                        "share": round(count / total_causes, 4) if total_causes else 0.0,
                        "cumulativeShare": round(running / total_causes, 4) if total_causes else 0.0,
                    }
                )

            # --- Turnaround latency, receipt to ACK ----------------------
            latencies: list[float] = []
            for job in jobs:
                if not job.get("acknowledgedAt"):
                    continue
                started = parse_iso(job.get("createdAt", ""))
                finished = parse_iso(job["acknowledgedAt"])
                latencies.append(max(0.0, (finished - started).total_seconds() / 60))
            latencies.sort()

            # --- Sender volume leaders -----------------------------------
            by_domain: dict[str, dict] = {}
            for job in jobs:
                email = self.email(job.get("emailLogId", "")) or {}
                domain = domain_of(email.get("fromAddress", ""))
                if not domain:
                    continue
                row = by_domain.setdefault(
                    domain,
                    {"domain": domain, "total": 0, "held": 0, "committed": 0, "known": self.domain(domain) is not None},
                )
                row["total"] += 1
                if flow.is_on_hold(job["status"]):
                    row["held"] += 1
                if flow.is_committed(job["status"]):
                    row["committed"] += 1
            for row in by_domain.values():
                row["errorRate"] = round(row["held"] / row["total"], 4) if row["total"] else 0.0

            within_sla = [value for value in latencies if value <= flow.ACK_SLA_MINUTES]

            decided = [j for j in jobs if j["status"] not in ("RECEIVED", "CLASSIFIED", "EXTRACTING")]
            committed = [j for j in jobs if flow.is_committed(j["status"])]
            straight_through = [j for j in committed if not j.get("touchedByHuman")]

            return {
                "generatedAt": now_iso(),
                "windowDays": days,
                "intake": {
                    "totalEmails": len(emails),
                    "totalJobs": len(jobs),
                    "orders": sum(1 for j in jobs if j["status"] not in ("NOT_AN_ORDER", "DISCARDED")),
                    "notOrders": sum(1 for j in jobs if j["status"] == "NOT_AN_ORDER"),
                    "exceptions": sum(1 for j in jobs if j["status"] == "EXCEPTION"),
                },
                "stp": {
                    "rate": round(len(straight_through) / len(decided), 4) if decided else 0.0,
                    "straightThrough": len(straight_through),
                    "touched": len(committed) - len(straight_through),
                    "decided": len(decided),
                },
                "timeseries": list(buckets.values()),
                "errorBreakdown": pareto,
                "domainStats": sorted(by_domain.values(), key=lambda r: r["total"], reverse=True),
                "latency": {
                    "p50": _percentile(latencies, 0.50),
                    "p90": _percentile(latencies, 0.90),
                    "p99": _percentile(latencies, 0.99),
                    "sampleSize": len(latencies),
                },
                "sla": {
                    "targetMinutes": flow.ACK_SLA_MINUTES,
                    "withinTarget": len(within_sla),
                    "breached": len(latencies) - len(within_sla),
                    "compliance": round(len(within_sla) / len(latencies), 4) if latencies else 0.0,
                },
            }

    # ------------------------------------------------------------------ #
    # Mutations — WRITE SERVICE ONLY                                     #
    #                                                                    #
    # Everything below is the porcelain the write service composes. None #
    # of it removes a record: the Zero-DELETE rule is a property of this #
    # surface, not a convention the callers have to remember.            #
    # ------------------------------------------------------------------ #

    def mutate_append_email(self, record: dict) -> dict:
        with self._lock:
            record.setdefault("id", self._next("email", "MAIL"))
            record.setdefault("receivedAt", now_iso())
            record.setdefault("isArchived", False)
            self._state["emails"].append(record)
            self._commit()
            return record

    def mutate_email_fields(self, email_id: str, changes: dict) -> Optional[dict]:
        with self._lock:
            email = self.email(email_id)
            if not email:
                return None
            email.update(changes)
            self._commit()
            return email

    def mutate_append_job(self, record: dict) -> dict:
        with self._lock:
            record.setdefault("id", self._next("job", "JOB"))
            record.setdefault("createdAt", now_iso())
            record.setdefault("updatedAt", now_iso())
            record.setdefault("isArchived", False)
            record.setdefault("touchedByHuman", False)
            record.setdefault("timeline", [])
            self._state["jobs"].append(record)
            self._commit()
            return record

    def mutate_job_fields(self, job_id: str, changes: dict) -> Optional[dict]:
        """Patch non-status fields. Status moves go through `mutate_transition`."""
        with self._lock:
            job = self.job(job_id)
            if not job:
                return None
            job.update(changes)
            job["updatedAt"] = now_iso()
            self._commit()
            return job

    def mutate_transition(
        self,
        job_id: str,
        status: str,
        actor: str,
        note: str = "",
    ) -> tuple[Optional[dict], Optional[str]]:
        """Move a job, or explain why it cannot move.

        The refusal is returned rather than raised so the write service can
        decide whether it is a 409 to the operator or a no-op in a batch.
        """
        with self._lock:
            job = self.job(job_id)
            if not job:
                return None, f"No ingest job matches '{job_id}'."

            error = flow.transition_error(job["status"], status)
            if error:
                return None, error

            job["status"] = status
            job["holdReason"] = flow.hold_reason_for(status)
            job["updatedAt"] = now_iso()
            job["timeline"].append(
                {
                    "at": now_iso(),
                    "status": status,
                    "action": flow.action_for(status),
                    "actor": actor,
                    "note": note,
                }
            )
            if status == "COMMITTED":
                job.setdefault("committedAt", now_iso())
            if status == "ACKNOWLEDGED":
                job.setdefault("acknowledgedAt", now_iso())

            self._commit()
            return job, None

    def mutate_append_order(self, record: dict, version: dict) -> dict:
        """Create a canonical order and its first version, atomically."""
        with self._lock:
            record.setdefault("id", self._next("order", "ORD"))
            record.setdefault("createdAt", now_iso())
            record.setdefault("isArchived", False)
            version["orderId"] = record["id"]
            version.setdefault("id", self._next("orderVersion", "OV"))
            version.setdefault("versionNo", 1)
            version.setdefault("createdAt", now_iso())
            record["headVersionId"] = version["id"]
            record["versionNo"] = version["versionNo"]
            self._state["orders"].append(record)
            self._state["orderVersions"].append(version)
            self._commit()
            return record

    def mutate_append_order_version(self, order_id: str, version: dict) -> Optional[dict]:
        """Append a correction. The prior version stays readable forever."""
        with self._lock:
            order = self.order(order_id)
            if not order:
                return None
            existing = self.order_versions(order_id)
            version["orderId"] = order_id
            version.setdefault("id", self._next("orderVersion", "OV"))
            version["versionNo"] = len(existing) + 1
            version.setdefault("createdAt", now_iso())
            self._state["orderVersions"].append(version)
            order["headVersionId"] = version["id"]
            order["versionNo"] = version["versionNo"]
            self._commit()
            return version


    # ------------------------------------------------------------------ #
    # Reads - PACT drafts and proformas                                   #
    # ------------------------------------------------------------------ #

    def pact_pushes(self, job_id: Optional[str] = None) -> list[dict]:
        self._sync()
        with self._lock:
            rows = list(self._state.get("pactPushes", []))
        return [r for r in rows if r["ingestJobId"] == job_id] if job_id else rows

    def pact_push(self, push_id: str) -> Optional[dict]:
        self._sync()
        with self._lock:
            return next((p for p in self._state.get("pactPushes", []) if p["id"] == push_id), None)

    def latest_pact_push(self, job_id: str) -> Optional[dict]:
        self._sync()
        rows = self.pact_pushes(job_id)
        return rows[-1] if rows else None

    def saved_pact_push(self, job_id: str) -> Optional[dict]:
        """The attempt that actually produced a document. The idempotency check for a
        PACT push: a paused or failed attempt must stay retryable."""
        self._sync()
        for row in reversed(self.pact_pushes(job_id)):
            if row.get("status") == "SUCCEEDED" and row.get("documentNo"):
                return row
        return None

    def proformas(self, job_id: Optional[str] = None) -> list[dict]:
        self._sync()
        with self._lock:
            rows = list(self._state.get("proformas", []))
        return [r for r in rows if r["ingestJobId"] == job_id] if job_id else rows

    def proforma_for_job(self, job_id: str) -> Optional[dict]:
        self._sync()
        rows = self.proformas(job_id)
        return rows[-1] if rows else None

    # ------------------------------------------------------------------ #
    # Mutators - PACT drafts and proformas                                #
    # ------------------------------------------------------------------ #

    def mutate_append_pact_push(self, record: dict) -> dict:
        """Attempts are rows, never a mutable counter: KPAC can pause, and resuming is a
        new attempt with its own outcome."""
        with self._lock:
            record.setdefault("id", self._next("pactPush", "PSH"))
            record.setdefault("createdAt", now_iso())
            record.setdefault("updatedAt", now_iso())
            record.setdefault("attempt", len(self.pact_pushes(record.get("ingestJobId", ""))) + 1)
            self._state.setdefault("pactPushes", []).append(record)
            self._commit()
            return record

    def mutate_pact_push_fields(self, push_id: str, changes: dict) -> Optional[dict]:
        with self._lock:
            row = next((p for p in self._state.get("pactPushes", []) if p["id"] == push_id), None)
            if not row:
                return None
            row.update(changes)
            row["updatedAt"] = now_iso()
            self._commit()
            return row

    def mutate_append_proforma(self, record: dict) -> dict:
        with self._lock:
            record.setdefault("id", self._next("proforma", "PRF"))
            record.setdefault("createdAt", now_iso())
            # Not a parameter anywhere: there is no other kind of proforma in this system.
            record["isDemo"] = True
            self._state.setdefault("proformas", []).append(record)
            self._commit()
            return record

    # ------------------------------------------------------------------ #
    # Team tasks                                                         #
    # ------------------------------------------------------------------ #

    def tasks(self, job_id: Optional[str] = None) -> list[dict]:
        self._sync()
        with self._lock:
            rows = list(self._state.get("teamTasks", []))
        return [t for t in rows if not job_id or t.get("ingestJobId") == job_id]

    def task(self, task_id: str) -> Optional[dict]:
        return next((t for t in self.tasks() if t["id"] == task_id), None)

    def mutate_append_task(self, record: dict) -> dict:
        """One unit of work for one team, on the ledger like everything else.

        Not a new notification system: `po_pipeline` mirrors each of these into the
        console's existing notification store as it creates them. This row is the task
        itself - who owns it, which order it belongs to, whether it is still open - and
        the notification is how somebody finds out about it.
        """
        with self._lock:
            record.setdefault("id", self._next("teamTask", "TSK"))
            record.setdefault("createdAt", now_iso())
            record.setdefault("updatedAt", now_iso())
            record.setdefault("status", "OPEN")
            self._state.setdefault("teamTasks", []).append(record)
            self._commit()
            return record

    def mutate_task_fields(self, task_id: str, changes: dict) -> Optional[dict]:
        with self._lock:
            row = next((t for t in self._state.get("teamTasks", []) if t["id"] == task_id), None)
            if not row:
                return None
            row.update(changes)
            row["updatedAt"] = now_iso()
            self._commit()
            return row

    def mutate_append_domain(self, record: dict) -> dict:
        with self._lock:
            existing = self.domain(record["domain"])
            if existing:
                return existing
            record.setdefault("id", self._next("companyDomain", "DOM"))
            record.setdefault("addedAt", now_iso())
            self._state["companyDomains"].append(record)
            self._commit()
            return record

    def mutate_monitor(self, changes: dict) -> dict:
        with self._lock:
            self._state["monitor"].update(changes)
            self._commit()
            return dict(self._state["monitor"])

    def mutate_append_audit(self, entry: dict) -> dict:
        """The decision log. Append-only, and never trimmed on write."""
        with self._lock:
            entry.setdefault("id", self._next("audit", "AUD"))
            entry.setdefault("at", now_iso())
            self._state["audit"].append(entry)
            self._commit()
            return entry


def domain_of(address: str) -> str:
    return (address or "").split("@")[-1].strip().lower() if "@" in (address or "") else ""


def _percentile(sorted_values: list[float], fraction: float) -> Optional[float]:
    """Nearest-rank percentile. None on an empty sample, never a fake zero."""
    if not sorted_values:
        return None
    index = max(0, min(len(sorted_values) - 1, int(round(fraction * (len(sorted_values) - 1)))))
    return round(sorted_values[index], 2)


mailing_store = MailingStore()
