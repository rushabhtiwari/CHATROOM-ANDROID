"""The approval chain's business rules, server-side.

This is a deliberate mirror of the frontend's `src/lib/status.ts`. The UI already
hides actions a team is not allowed to take; this file makes the server refuse
them as well, so the rules hold even if a request arrives from somewhere else.
"""

from __future__ import annotations

from typing import Optional

STATUS_STAGE: dict[str, str] = {
    "DRAFT": "HR",
    "SUBMITTED": "HR",
    "HR_INFO_REQUESTED": "HR",
    "HR_REJECTED": "HR",
    "HR_APPROVED": "ACCOUNTS",
    "ACC_INFO_REQUESTED": "ACCOUNTS",
    "ACC_REJECTED": "ACCOUNTS",
    "ACC_APPROVED": "PAYMENT",
    "PAYMENT_QUEUED": "PAYMENT",
    "PAID": "DONE",
    "CREDITED": "DONE",
}

STATUS_ACTION: dict[str, str] = {
    "DRAFT": "Saved as draft",
    "SUBMITTED": "Submitted for approval",
    "HR_INFO_REQUESTED": "More information requested by HR",
    "HR_REJECTED": "Rejected by HR",
    "HR_APPROVED": "Approved by HR",
    "ACC_INFO_REQUESTED": "More information requested by Accounts",
    "ACC_REJECTED": "Rejected by Accounts",
    "ACC_APPROVED": "Approved by Accounts",
    "PAYMENT_QUEUED": "Queued for payment",
    "PAID": "Payment disbursed",
    "CREDITED": "Credited to allowance",
}

STATUS_LABEL: dict[str, str] = {
    "DRAFT": "Draft",
    "SUBMITTED": "Submitted",
    "HR_INFO_REQUESTED": "HR — Info Needed",
    "HR_REJECTED": "HR Rejected",
    "HR_APPROVED": "HR Approved",
    "ACC_INFO_REQUESTED": "Acc — Info Needed",
    "ACC_REJECTED": "Accounts Rejected",
    "ACC_APPROVED": "Accounts Approved",
    "PAYMENT_QUEUED": "Payment Queued",
    "PAID": "Paid",
    "CREDITED": "Credited",
}

TERMINAL = {"HR_REJECTED", "ACC_REJECTED", "CREDITED"}

# Statuses that mean HR has explicitly cleared the request.
HR_CLEARED = {
    "HR_APPROVED",
    "ACC_INFO_REQUESTED",
    "ACC_REJECTED",
    "ACC_APPROVED",
    "PAYMENT_QUEUED",
    "PAID",
    "CREDITED",
}

# Which statuses each team is allowed to move a claim into.
ROLE_TRANSITIONS: dict[str, set[str]] = {
    "EMPLOYEE": {"DRAFT", "SUBMITTED", "HR_APPROVED"},
    "HR": {"HR_APPROVED", "HR_REJECTED", "HR_INFO_REQUESTED"},
    "ACCOUNTS": {"ACC_APPROVED", "ACC_REJECTED", "ACC_INFO_REQUESTED"},
    "PAYMENTS": {"PAYMENT_QUEUED", "PAID", "CREDITED"},
    "ADMIN": set(STATUS_STAGE),
}

# The statuses a claim may legally move to, given where it is now.
ALLOWED_NEXT: dict[str, set[str]] = {
    "DRAFT": {"SUBMITTED", "DRAFT"},
    "SUBMITTED": {"HR_APPROVED", "HR_REJECTED", "HR_INFO_REQUESTED"},
    "HR_INFO_REQUESTED": {"SUBMITTED", "HR_APPROVED", "HR_REJECTED"},
    "HR_REJECTED": set(),
    "HR_APPROVED": {"ACC_APPROVED", "ACC_REJECTED", "ACC_INFO_REQUESTED"},
    "ACC_INFO_REQUESTED": {"HR_APPROVED", "ACC_APPROVED", "ACC_REJECTED"},
    "ACC_REJECTED": set(),
    "ACC_APPROVED": {"PAYMENT_QUEUED", "PAID"},
    "PAYMENT_QUEUED": {"PAID", "ACC_APPROVED"},
    "PAID": {"CREDITED"},
    "CREDITED": set(),
}


def stage_for(status: str) -> str:
    return STATUS_STAGE[status]


def action_for(status: str) -> str:
    return STATUS_ACTION[status]


def is_hr_cleared(status: str) -> bool:
    return status in HR_CLEARED


def is_payable(status: str) -> bool:
    return status in ("ACC_APPROVED", "PAYMENT_QUEUED")


def is_terminal(status: str) -> bool:
    return status in TERMINAL


def transition_error(current: str, target: str, role: str) -> Optional[str]:
    """Returns why a transition is refused, or None when it is allowed.

    The messages are written to be shown to a user, because the frontend
    surfaces whatever the server sends back.
    """
    if target not in STATUS_STAGE:
        return f"'{target}' is not a valid status."

    if role != "ADMIN" and target not in ROLE_TRANSITIONS.get(role, set()):
        return f"{role} is not allowed to move a claim to {STATUS_LABEL[target]}."

    if is_terminal(current):
        return f"This claim is closed ({STATUS_LABEL[current]}) — no further action is possible."

    # The hard rule the frontend leads with: Accounts cannot act before HR.
    if role == "ACCOUNTS" and not is_hr_cleared(current):
        if current == "DRAFT":
            return "Not submitted by the employee yet."
        return "Awaiting HR approval. Accounts cannot act until HR clears it."

    if current == target:
        return None  # idempotent, harmless

    if target not in ALLOWED_NEXT.get(current, set()):
        return (
            f"A claim in {STATUS_LABEL[current]} cannot move to "
            f"{STATUS_LABEL[target]}."
        )

    return None
