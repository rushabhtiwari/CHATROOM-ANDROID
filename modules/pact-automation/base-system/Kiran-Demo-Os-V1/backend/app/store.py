"""The single source of truth.

In-memory dictionaries with a JSON snapshot written after every mutation. No
native dependencies, so there is nothing to compile on a laptop the morning of
a demo, and the state survives a server restart.

Everything the API can change goes through a method here, and every method
publishes the new state, which is what keeps three browser windows in step.
"""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from . import events
from .config import SEED_FILE, SNAPSHOT_FILE
from .workflow import action_for, is_payable, stage_for, transition_error


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class Store:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._seed: dict[str, Any] = json.loads(SEED_FILE.read_text(encoding="utf-8"))
        self._load()

    # ------------------------------------------------------------------ #
    # Lifecycle                                                          #
    # ------------------------------------------------------------------ #

    def _blank(self) -> dict[str, Any]:
        seed = json.loads(json.dumps(self._seed))  # deep copy
        return {
            "version": 1,
            "currentEmployeeId": seed["currentEmployeeId"],
            "employees": seed["employees"],
            "requests": seed["requests"],
            "payouts": seed["payouts"],
            "notifications": seed["notifications"],
            "monthlySpend": seed["monthlySpend"],
            "departmentUtilisation": seed["departmentUtilisation"],
            "policyCaps": seed["policyCaps"],
            # Runtime movement applied on top of the seeded ledger baseline, so
            # the historical figures stay intact while today's activity shows.
            "deptDelta": {},
            "receipts": {},  # uploaded but not yet filed against a claim
            "seq": {"request": 0, "notification": 0, "payout": 0, "receipt": 0},
        }

    def _load(self) -> None:
        if SNAPSHOT_FILE.exists():
            try:
                self._state = json.loads(SNAPSHOT_FILE.read_text(encoding="utf-8"))
                # Tolerate a snapshot written by an older build.
                for key, value in self._blank().items():
                    self._state.setdefault(key, value)
                return
            except (json.JSONDecodeError, OSError):
                pass
        self._state = self._blank()
        self._persist()

    def _persist(self) -> None:
        """Atomic write, so a crash mid-save cannot leave a truncated file.

        Retried for the same reason `mailing_store._persist` is: `os.replace` is atomic on
        Windows but fails with `PermissionError: [WinError 5]` whenever anything else has
        the destination open for an instant - a scanner, the indexer, a backup agent. It
        clears in milliseconds, and an unretried failure surfaces as a 500 in the middle of
        whatever was being written. This file is touched on every notification, so the PO
        pipeline hits it three times on a single approval.
        """
        tmp = SNAPSHOT_FILE.with_suffix(f".{os.getpid()}.{threading.get_ident():x}.tmp")
        tmp.write_text(json.dumps(self._state, indent=2), encoding="utf-8")
        for attempt in range(6):
            try:
                os.replace(tmp, SNAPSHOT_FILE)
                return
            except PermissionError:
                if attempt == 5:
                    raise
                time.sleep(0.04 * (attempt + 1))

    def _commit(self) -> None:
        self._state["version"] += 1
        self._persist()
        events.publish("state", self.snapshot())

    def reset(self) -> dict[str, Any]:
        with self._lock:
            self._state = self._blank()
            self._persist()
            events.publish("state", self.snapshot())
            return self.snapshot()

    # ------------------------------------------------------------------ #
    # Reads                                                              #
    # ------------------------------------------------------------------ #

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            s = self._state
            return {
                "version": s["version"],
                "currentEmployeeId": s["currentEmployeeId"],
                "employees": s["employees"],
                "requests": s["requests"],
                "payouts": s["payouts"],
                "notifications": s["notifications"],
                "analytics": self._analytics(),
            }

    def employee(self, employee_id: str) -> Optional[dict]:
        with self._lock:
            return next(
                (e for e in self._state["employees"] if e["id"] == employee_id), None
            )

    def request(self, request_id: str) -> Optional[dict]:
        with self._lock:
            return next(
                (r for r in self._state["requests"] if r["id"] == request_id), None
            )

    def policy_caps(self) -> list[dict]:
        with self._lock:
            return list(self._state["policyCaps"])

    def _analytics(self) -> dict[str, Any]:
        s = self._state
        order = ["TRAVEL", "LODGING", "MEALS", "FUEL", "OTHER"]
        totals = {c: {"amount": 0.0, "count": 0} for c in order}
        for r in s["requests"]:
            entry = totals.get(r["category"])
            if entry:
                entry["amount"] += r["amount"]
                entry["count"] += 1

        delta = s["deptDelta"]
        departments = []
        for row in s["departmentUtilisation"]:
            d = delta.get(row["department"], {})
            departments.append(
                {
                    **row,
                    "used": max(0, row["used"] + d.get("used", 0)),
                    "pending": max(0, row["pending"] + d.get("pending", 0)),
                }
            )

        return {
            "monthlySpend": s["monthlySpend"],
            "departmentUtilisation": departments,
            "policyCaps": s["policyCaps"],
            "categorySpend": [
                {
                    "category": c,
                    "amount": totals[c]["amount"],
                    "count": totals[c]["count"],
                }
                for c in order
            ],
        }

    def department_headroom(self, department: str) -> Optional[dict]:
        with self._lock:
            row = next(
                (
                    d
                    for d in self._analytics()["departmentUtilisation"]
                    if d["department"] == department
                ),
                None,
            )
            if not row:
                return None
            return {
                **row,
                "headroom": max(0.0, row["allocated"] - row["used"] - row["pending"]),
            }

    # ------------------------------------------------------------------ #
    # Ledger helpers                                                     #
    # ------------------------------------------------------------------ #

    def _bump_dept(
        self, employee_id: str, *, used: float = 0, pending: float = 0
    ) -> None:
        employee = next(
            (e for e in self._state["employees"] if e["id"] == employee_id), None
        )
        if not employee:
            return
        entry = self._state["deptDelta"].setdefault(
            employee["department"], {"used": 0, "pending": 0}
        )
        entry["used"] += used
        entry["pending"] += pending

    def _next(self, key: str) -> int:
        self._state["seq"][key] += 1
        return self._state["seq"][key]

    # ------------------------------------------------------------------ #
    # Notifications                                                      #
    # ------------------------------------------------------------------ #

    def _raise_notification(
        self,
        *,
        to_role: str,
        title: str,
        body: str,
        to_employee_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> dict:
        notification = {
            "id": f"NTF-RUN-{self._next('notification')}",
            "toRole": to_role,
            "toEmployeeId": to_employee_id,
            "title": title,
            "body": body,
            "at": now_iso(),
            "read": False,
            "requestId": request_id,
        }
        self._state["notifications"].insert(0, notification)
        return notification

    def push_notification(self, payload: dict) -> dict:
        with self._lock:
            notification = self._raise_notification(
                to_role=payload["toRole"],
                title=payload["title"],
                body=payload["body"],
                to_employee_id=payload.get("toEmployeeId"),
                request_id=payload.get("requestId"),
            )
            self._commit()
            return notification

    def mark_notification_read(self, notification_id: str) -> None:
        with self._lock:
            for n in self._state["notifications"]:
                if n["id"] == notification_id:
                    n["read"] = True
            self._commit()

    def mark_all_notifications_read(self) -> None:
        with self._lock:
            for n in self._state["notifications"]:
                n["read"] = True
            self._commit()

    # ------------------------------------------------------------------ #
    # Receipts                                                           #
    # ------------------------------------------------------------------ #

    def register_receipt(self, record: dict) -> dict:
        with self._lock:
            record = {
                **record,
                "id": record.get("id") or f"RCP-UP-{self._next('receipt')}",
            }
            self._state["receipts"][record["id"]] = record
            self._persist()
            return record

    def receipts_by_ids(self, ids: list[str]) -> list[dict]:
        with self._lock:
            return [
                self._state["receipts"][i] for i in ids if i in self._state["receipts"]
            ]

    # ------------------------------------------------------------------ #
    # Requests                                                           #
    # ------------------------------------------------------------------ #

    def create_request(self, body: dict) -> dict:
        with self._lock:
            seq = self._next("request")
            request_id = f"REQ-2026-9{seq:03d}"
            now = now_iso()

            employee = next(
                (e for e in self._state["employees"] if e["id"] == body["employeeId"]),
                None,
            )
            actor = body.get("actor") or (employee["name"] if employee else "Employee")

            # Prefer real uploaded files; fall back to the name and size the
            # dropzone reported, so a claim can still be filed with no backend
            # storage involved.
            receipts: list[dict] = []
            stored_receipts = self.receipts_by_ids(body.get("receiptIds") or [])
            for i, stored in enumerate(stored_receipts):
                receipts.append(
                    {
                        "id": f"RCP-{request_id}-{i + 1}",
                        "fileName": stored["fileName"],
                        "sizeKb": stored["sizeKb"],
                        "uploadedOn": stored.get("uploadedOn", now),
                        "url": stored.get("url"),
                        "mimeType": stored.get("mimeType"),
                    }
                )
            if not receipts:
                for i, f in enumerate(body.get("files") or []):
                    receipts.append(
                        {
                            "id": f"RCP-{request_id}-{i + 1}",
                            "fileName": f["fileName"],
                            "sizeKb": f["sizeKb"],
                            "uploadedOn": now,
                        }
                    )

            status = body["status"]
            timeline = []
            if status == "SUBMITTED":
                timeline.append(
                    {
                        "id": f"EVT-{request_id}-0",
                        "actor": actor,
                        "role": "EMPLOYEE",
                        "action": action_for("SUBMITTED"),
                        "comment": (body.get("justification") or "")[:90],
                        "at": now,
                    }
                )

            sla_due_on = None
            if status == "SUBMITTED":
                due = datetime.now(timezone.utc) + timedelta(days=3)
                sla_due_on = due.isoformat().replace("+00:00", "Z")

            extraction = body.get("extraction")
            request = {
                "id": request_id,
                "employeeId": body["employeeId"],
                "title": body["title"],
                "category": body["category"],
                "amount": body["amount"],
                "currency": "INR",
                "submittedOn": now,
                "travelDates": body.get("travelDates"),
                "justification": body["justification"],
                "receipts": receipts,
                "status": status,
                "currentStage": stage_for(status),
                "timeline": timeline,
                "slaDueOn": sla_due_on,
                "duplicateOf": None,
                "extraction": extraction,
                "extractedAmount": (extraction or {}).get("amount"),
            }

            self._state["requests"].insert(0, request)

            if status == "SUBMITTED":
                amount_text = f"{request['amount']:,.0f}"
                self._raise_notification(
                    to_role="HR",
                    title="New request awaiting HR review",
                    body=(
                        f"{actor} raised {request_id} for {request['title']}. "
                        f"Amount Rs {amount_text}."
                    ),
                    request_id=request_id,
                )

            self._commit()
            return request

    def transition(
        self,
        request_id: str,
        status: str,
        actor: str,
        role: str,
        comment: Optional[str] = None,
    ) -> tuple[Optional[dict], Optional[str]]:
        """Moves a claim along the chain. Returns (request, error_message)."""
        with self._lock:
            request = next(
                (r for r in self._state["requests"] if r["id"] == request_id), None
            )
            if not request:
                return None, f"No request matches the id '{request_id}'."

            error = transition_error(request["status"], status, role)
            if error:
                return None, error

            previous = request["status"]
            request["status"] = status
            request["currentStage"] = stage_for(status)
            request["timeline"].append(
                {
                    "id": f"EVT-{request_id}-{len(request['timeline'])}",
                    "actor": actor,
                    "role": role,
                    "action": action_for(status),
                    "comment": comment,
                    "at": now_iso(),
                }
            )

            self._apply_ledger(request, previous, status)
            self._notify_transition(request, status, actor, comment)

            # Accounts clearing a claim puts it in the disbursement queue.
            if status == "ACC_APPROVED":
                self._ensure_payout(request)

            self._commit()
            return request, None

    def _apply_ledger(self, request: dict, previous: str, status: str) -> None:
        amount = request["amount"]
        if previous == "DRAFT" and status == "SUBMITTED":
            self._bump_dept(request["employeeId"], pending=amount)
        elif status in ("HR_REJECTED", "ACC_REJECTED"):
            self._bump_dept(request["employeeId"], pending=-amount)
        elif status == "PAID":
            self._bump_dept(request["employeeId"], pending=-amount, used=amount)

    def _notify_transition(
        self, request: dict, status: str, actor: str, comment: Optional[str]
    ) -> None:
        rid = request["id"]
        employee_id = request["employeeId"]
        tail = f" Note: {comment}" if comment else ""
        title = request["title"]

        if status == "HR_APPROVED":
            self._raise_notification(
                to_role="ACCOUNTS",
                title=f"{rid} cleared by HR",
                body=f"{title} is awaiting financial review.{tail}",
                request_id=rid,
            )
            self._raise_notification(
                to_role="EMPLOYEE",
                to_employee_id=employee_id,
                title=f"{rid} approved by HR",
                body=f"Your claim has moved to the Accounts queue.{tail}",
                request_id=rid,
            )
        elif status in (
            "HR_REJECTED",
            "ACC_REJECTED",
            "HR_INFO_REQUESTED",
            "ACC_INFO_REQUESTED",
        ):
            self._raise_notification(
                to_role="EMPLOYEE",
                to_employee_id=employee_id,
                title=f"{rid} — {action_for(status)}",
                body=f"{title}.{tail}",
                request_id=rid,
            )
        elif status == "ACC_APPROVED":
            amount_text = f"{request['amount']:,.0f}"
            self._raise_notification(
                to_role="PAYMENTS",
                title=f"{rid} cleared for disbursement",
                body=f"{title} — Rs {amount_text} is ready to pay.{tail}",
                request_id=rid,
            )
        elif status == "SUBMITTED":
            self._raise_notification(
                to_role="HR",
                title="New request awaiting HR review",
                body=f"{actor} submitted {rid} — {title}.{tail}",
                request_id=rid,
            )

    # ------------------------------------------------------------------ #
    # Payouts                                                            #
    # ------------------------------------------------------------------ #

    def _ensure_payout(self, request: dict) -> dict:
        existing = next(
            (
                p
                for p in self._state["payouts"]
                if p["requestId"] == request["id"]
                and p["status"] in ("QUEUED", "PROCESSING")
            ),
            None,
        )
        if existing:
            return existing

        payout = {
            "id": f"PAY-RUN-{self._next('payout'):04d}",
            "requestId": request["id"],
            "employeeId": request["employeeId"],
            "amount": request["amount"],
            "method": "NEFT",
            "status": "QUEUED",
            "utr": None,
            "initiatedOn": now_iso(),
            "settledOn": None,
            "failureReason": None,
        }
        self._state["payouts"].insert(0, payout)
        return payout

    def queue_payouts(self, payout_ids: list[str], actor: str) -> list[dict]:
        """Marks selected payouts PROCESSING and moves their claims along."""
        with self._lock:
            touched = []
            for payout in self._state["payouts"]:
                if payout["id"] not in payout_ids:
                    continue
                payout["status"] = "PROCESSING"
                touched.append(payout)

                linked = next(
                    (
                        r
                        for r in self._state["requests"]
                        if r["id"] == payout["requestId"]
                    ),
                    None,
                )
                if linked and linked["status"] == "ACC_APPROVED":
                    linked["status"] = "PAYMENT_QUEUED"
                    linked["currentStage"] = stage_for("PAYMENT_QUEUED")
                    linked["timeline"].append(
                        {
                            "id": f"EVT-{linked['id']}-{len(linked['timeline'])}",
                            "actor": actor,
                            "role": "PAYMENTS",
                            "action": action_for("PAYMENT_QUEUED"),
                            "comment": None,
                            "at": now_iso(),
                        }
                    )
            self._commit()
            return touched

    def retry_payout(self, payout_id: str) -> Optional[dict]:
        with self._lock:
            for payout in self._state["payouts"]:
                if payout["id"] == payout_id:
                    payout["status"] = "QUEUED"
                    payout["failureReason"] = None
                    self._commit()
                    return payout
            return None

    def verify_bank(self, employee_id: str) -> Optional[dict]:
        with self._lock:
            employee = next(
                (e for e in self._state["employees"] if e["id"] == employee_id), None
            )
            if not employee:
                return None
            employee["bankAccount"]["verified"] = True
            bank = employee["bankAccount"]
            self._raise_notification(
                to_role="EMPLOYEE",
                to_employee_id=employee_id,
                title="Bank account verified",
                body=(
                    f"{bank['bankName']} {bank['accountNumberMasked']} has been "
                    "verified. Payouts to this account can now be released."
                ),
            )
            self._commit()
            return employee

    def disburse(
        self, employee_id: str, method: str, actor: str
    ) -> tuple[Optional[dict], Optional[str]]:
        """Pays every payable claim for one employee under a single UTR.

        Mirrors the disbursement screen exactly: each claim goes PAID then
        CREDITED, the amount leaves the employee's pending balance, and the
        claim's open payout row is settled rather than duplicated.
        """
        with self._lock:
            employee = next(
                (e for e in self._state["employees"] if e["id"] == employee_id), None
            )
            if not employee:
                return None, f"No employee matches '{employee_id}'."

            claims = [
                r
                for r in self._state["requests"]
                if r["employeeId"] == employee_id and is_payable(r["status"])
            ]
            if not claims:
                return None, "There is nothing payable for this employee."

            now = now_iso()
            stamp = datetime.now(timezone.utc).strftime("%y%m%d%H%M%S%f")[:14]
            utr = f"UTR{stamp}"
            total = sum(c["amount"] for c in claims)

            for claim in claims:
                for status, comment in (
                    ("PAID", f"Disbursed via {method}."),
                    ("CREDITED", "Monthly allowance balance restored."),
                ):
                    claim["status"] = status
                    claim["currentStage"] = stage_for(status)
                    claim["timeline"].append(
                        {
                            "id": f"EVT-{claim['id']}-{len(claim['timeline'])}",
                            "actor": actor,
                            "role": "PAYMENTS",
                            "action": action_for(status),
                            "comment": comment,
                            "at": now_iso(),
                        }
                    )

                # The claim leaves pendingAmount, so remaining rises by what was paid.
                employee["pendingAmount"] = max(
                    0, employee["pendingAmount"] - claim["amount"]
                )
                self._bump_dept(
                    employee_id, pending=-claim["amount"], used=claim["amount"]
                )

                open_payout = next(
                    (
                        p
                        for p in self._state["payouts"]
                        if p["requestId"] == claim["id"]
                        and p["status"] in ("QUEUED", "PROCESSING")
                    ),
                    None,
                )
                if open_payout:
                    open_payout.update(
                        {
                            "method": method,
                            "status": "PAID",
                            "utr": utr,
                            "settledOn": now,
                            "failureReason": None,
                        }
                    )
                else:
                    self._state["payouts"].insert(
                        0,
                        {
                            "id": f"PAY-RUN-{self._next('payout'):04d}",
                            "requestId": claim["id"],
                            "employeeId": employee_id,
                            "amount": claim["amount"],
                            "method": method,
                            "status": "PAID",
                            "utr": utr,
                            "initiatedOn": now,
                            "settledOn": now,
                            "failureReason": None,
                        },
                    )

            masked = employee["bankAccount"]["accountNumberMasked"]
            total_text = f"{total:,.0f}"
            self._raise_notification(
                to_role="EMPLOYEE",
                to_employee_id=employee_id,
                title=f"Payment successful — Rs {total_text} received",
                body=(
                    f"Your reimbursement of Rs {total_text} has been disbursed via "
                    f"{method} to {masked} and credited to your monthly allowance. "
                    f"UTR {utr}."
                ),
                request_id=claims[0]["id"],
            )

            self._commit()
            return (
                {
                    "utr": utr,
                    "method": method,
                    "employeeId": employee_id,
                    "total": total,
                    "requestIds": [c["id"] for c in claims],
                    "payoutId": f"PAY-{utr[-6:]}",
                    "at": now,
                },
                None,
            )


store = Store()
