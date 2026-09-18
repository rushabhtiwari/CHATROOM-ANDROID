"""The mailing intake state machine, server-side.

WORKING.md describes the pipeline as a lifecycle rather than a set of flags, so
this file owns the whole of it: which states exist, which transitions are legal
from each, what puts a message on hold, and what it takes to get it off again.
Nothing else in the backend is allowed to decide those questions.

The shape deliberately mirrors `workflow.py` (the reimbursement chain), because
an operator who has learned one lifecycle in this console should not have to
learn a second vocabulary for the other. Same idea: a table of legal successors,
one function that says *why* a move is refused, and messages written to be shown
to a human because the frontend surfaces whatever the server sends back.

    RECEIVED -> CLASSIFIED -> EXTRACTING -> VALIDATED -> AWAITING_ADMIN_APPROVAL
                    |             |                               |
                    v             v                        (gate 1: Admin)
              NOT_AN_ORDER    EXCEPTION                            |
                                                                   v
                                                              COMMITTED
                                                                   |
                                                                   v
                                                             ACKNOWLEDGED
                                                                   |
                                                                   v
                                                    AWAITING_ACCOUNTS_APPROVAL
                                                                   |
                                                        (gate 2: Accounts)
                                                                   v
                                                            PUSHED_TO_PACT
                                                                   |
                                                                   v
                                                              COMPLETED

`DISCARDED` is the soft-state sentinel the Zero-DELETE rule requires: a rejected
message is closed and annotated, never removed.

## The two gates

Both are internal, and both are human. There is no third gate and no automatic one.

`AWAITING_ADMIN_APPROVAL` is where **every** clean order rests. It is not a value
threshold any more: nothing at all starts work inside the company until an admin has
looked at the order. `APPROVAL_GATE_VALUE` survives only as the mark that says *this
one is large*, shown on the queue, deciding nothing.

`AWAITING_ACCOUNTS_APPROVAL` is the gate in front of PACT. Accounts sign off before
anything is typed into the accounting system, and `PUSHED_TO_PACT` is reachable from
nowhere else.

The customer is told twice and asked nothing. An automatic **receipt** goes out the
moment the order is read - it may say only that a document arrived, which
`mailing_messages.assert_receipt_wording` enforces at render time - and a fuller
**acknowledgement** follows the admin's approval. Neither is a question: the removed
`AWAITING_CLIENT_CONFIRMATION` states put a customer's mail client on the critical
path of an internal workflow.

There is no timeout into any state. Silence advances nothing.
"""

from __future__ import annotations

from typing import Optional

# --------------------------------------------------------------------------- #
# The states                                                                    #
# --------------------------------------------------------------------------- #

STATUS_LABEL: dict[str, str] = {
    "RECEIVED": "Received",
    "CLASSIFIED": "Classified",
    "EXTRACTING": "Extracting",
    "VALIDATED": "Validated",
    "AWAITING_ADMIN_APPROVAL": "Awaiting Admin Approval",
    "COMMITTED": "Committed",
    "ACKNOWLEDGED": "Acknowledged",
    "AWAITING_ACCOUNTS_APPROVAL": "Awaiting Accounts Approval",
    "PUSHED_TO_PACT": "PACT Draft Saved",
    "COMPLETED": "Completed",
    "NOT_AN_ORDER": "Not An Order",
    "EXCEPTION": "Exception",
    "DISCARDED": "Discarded",
}

# What the pipeline was doing when it landed in this state. Written into the
# lifecycle timeline the inspector renders, so the audit log reads as sentences.
STATUS_ACTION: dict[str, str] = {
    "RECEIVED": "Message accepted at the edge",
    "CLASSIFIED": "Classified as a purchase order",
    "EXTRACTING": "Extraction running against the attachment",
    "VALIDATED": "Extraction validated against reference data",
    "AWAITING_ADMIN_APPROVAL": "Receipt sent to the customer; held for an admin to approve",
    "COMMITTED": "Committed to the canonical order ledger",
    "ACKNOWLEDGED": "Acknowledgement sent and the team tasked",
    "AWAITING_ACCOUNTS_APPROVAL": "Held for Accounts to release into PACT",
    "PUSHED_TO_PACT": "Purchase Order draft saved in PACT (never posted)",
    "COMPLETED": "Customer told the order is on its way; the order desk is done",
    "NOT_AN_ORDER": "Filtered at intake - no order markers found",
    "EXCEPTION": "Raised an exception for human triage",
    "DISCARDED": "Closed by an operator without committing",
}

# The five console tones, so a status renders the same stamp everywhere.
STATUS_TONE: dict[str, str] = {
    "RECEIVED": "grey",
    "CLASSIFIED": "blue",
    "EXTRACTING": "blue",
    "VALIDATED": "blue",
    "AWAITING_ADMIN_APPROVAL": "amber",
    "COMMITTED": "green",
    "ACKNOWLEDGED": "green",
    "AWAITING_ACCOUNTS_APPROVAL": "amber",
    "PUSHED_TO_PACT": "green",
    "COMPLETED": "green",
    "NOT_AN_ORDER": "grey",
    "EXCEPTION": "red",
    "DISCARDED": "grey",
}

# Nothing moves out of these. `DISCARDED` is terminal by design - the Zero-DELETE
# rule means a closed message stays on the ledger forever, annotated. `COMPLETED` is
# the end of the happy path: the draft exists in PACT and the customer has been told.
TERMINAL = {"COMPLETED", "DISCARDED"}

# The ways a message ends up in front of a human (WORKING.md 3.3). Both approvals
# are queues an operator works; neither can be cleared by waiting.
HOLD_INTAKE_FILTERED = "INTAKE_FILTERED"
HOLD_EXCEPTION = "EXCEPTION"
HOLD_AWAITING_ADMIN = "AWAITING_ADMIN"
HOLD_AWAITING_ACCOUNTS = "AWAITING_ACCOUNTS"

HOLD_REASON_LABEL: dict[str, str] = {
    HOLD_INTAKE_FILTERED: "Intake Filtered",
    HOLD_EXCEPTION: "Extraction Exception",
    HOLD_AWAITING_ADMIN: "Admin Approval",
    HOLD_AWAITING_ACCOUNTS: "Accounts Approval",
}

# Which status puts a job in which queue. A job is on hold if, and only if, its
# status appears here - there is no separate boolean to drift out of step.
HOLD_FOR_STATUS: dict[str, str] = {
    "NOT_AN_ORDER": HOLD_INTAKE_FILTERED,
    "EXCEPTION": HOLD_EXCEPTION,
    "AWAITING_ADMIN_APPROVAL": HOLD_AWAITING_ADMIN,
    "AWAITING_ACCOUNTS_APPROVAL": HOLD_AWAITING_ACCOUNTS,
}

# Root causes, for the Pareto in 3.4. Every exception carries exactly one, so
# the analytics never has to infer a cause from free text.
CAUSE_LABEL: dict[str, str] = {
    "UNKNOWN_DOMAIN": "Unknown sender domain",
    "LOW_CONFIDENCE": "Low extraction confidence",
    "AMBIGUOUS_DATE": "Ambiguous PO date",
    "DUPLICATE_PO": "Duplicate PO number",
    "UNMAPPED_PRODUCT": "Unmapped product code",
    "OCR_FAILURE": "OCR failure",
    "NO_ATTACHMENT": "No machine-readable attachment",
    "NO_ORDER_MARKERS": "No order markers in the message",
}

# 1.4 - the confidence floor. Anything under this cannot be committed without a
# human looking at it, whatever the rest of the extraction says.
CONFIDENCE_FLOOR = 0.85

# ADR-0005 - orders at or above this value used to be the only ones held for a
# reviewer. Every order is held now, so this decides nothing; it is kept as the
# "large order" mark the admin queue shows, so the reviewer knows which is which.
APPROVAL_GATE_VALUE = 500_000.0

# The acknowledgement SLA from 3.4, in minutes.
ACK_SLA_MINUTES = 15


# --------------------------------------------------------------------------- #
# The transition table                                                          #
# --------------------------------------------------------------------------- #

ALLOWED_NEXT: dict[str, set[str]] = {
    "RECEIVED": {"CLASSIFIED", "NOT_AN_ORDER", "EXCEPTION"},
    "CLASSIFIED": {"EXTRACTING", "NOT_AN_ORDER", "EXCEPTION"},
    "EXTRACTING": {"VALIDATED", "EXCEPTION"},
    # Every clean order stops for an admin. There is no straight-through edge.
    "VALIDATED": {"AWAITING_ADMIN_APPROVAL", "EXCEPTION"},
    # Gate 1. The admin's approval is what COMMITTED means.
    "AWAITING_ADMIN_APPROVAL": {"COMMITTED", "EXCEPTION", "DISCARDED"},
    "COMMITTED": {"ACKNOWLEDGED", "EXCEPTION"},
    # The acknowledgement has gone out and the team has been tasked; Accounts are next.
    "ACKNOWLEDGED": {"AWAITING_ACCOUNTS_APPROVAL", "DISCARDED"},
    # Gate 2. The only edge into PACT, from anywhere.
    "AWAITING_ACCOUNTS_APPROVAL": {"PUSHED_TO_PACT", "EXCEPTION", "DISCARDED"},
    "PUSHED_TO_PACT": {"COMPLETED", "EXCEPTION"},
    "COMPLETED": set(),
    # The hold states are re-enterable: a re-extract sends the job back to the top
    # of the pipeline rather than mutating it in place.
    "NOT_AN_ORDER": {"CLASSIFIED", "EXTRACTING", "DISCARDED"},
    "EXCEPTION": {"EXTRACTING", "VALIDATED", "AWAITING_ADMIN_APPROVAL", "DISCARDED"},
    "DISCARDED": set(),
}


def label_for(status: str) -> str:
    return STATUS_LABEL.get(status, status)


def action_for(status: str) -> str:
    return STATUS_ACTION.get(status, status)


def tone_for(status: str) -> str:
    return STATUS_TONE.get(status, "grey")


def hold_reason_for(status: str) -> Optional[str]:
    """The queue a job in this status belongs to, or None when it is flowing."""
    return HOLD_FOR_STATUS.get(status)


def is_on_hold(status: str) -> bool:
    return status in HOLD_FOR_STATUS


def is_terminal(status: str) -> bool:
    return status in TERMINAL


def is_committed(status: str) -> bool:
    """Committed *or* past it. Everything downstream of the admin gate counts."""
    return status in (
        "COMMITTED",
        "ACKNOWLEDGED",
        "AWAITING_ACCOUNTS_APPROVAL",
        "PUSHED_TO_PACT",
        "COMPLETED",
    )


def transition_error(current: str, target: str) -> Optional[str]:
    """Why this move is refused, or None when it is allowed.

    Idempotent re-entry is permitted (a poll that re-reports the same state is
    harmless); everything else must appear in `ALLOWED_NEXT`.
    """
    if target not in STATUS_LABEL:
        return f"'{target}' is not a mailing status."

    if current == target:
        return None

    if is_terminal(current):
        return (
            f"This message is closed ({label_for(current)}) — no further "
            "transition is possible."
        )

    if target not in ALLOWED_NEXT.get(current, set()):
        return f"A message in {label_for(current)} cannot move to {label_for(target)}."

    return None


# --------------------------------------------------------------------------- #
# Triage decisions                                                              #
# --------------------------------------------------------------------------- #

# The four operator actions from §3.3, and the status each drives toward.
TRIAGE_ACTIONS = {
    # Gate 1, the admin's approval. Named for the triage vocabulary the console
    # already speaks; from `AWAITING_ADMIN_APPROVAL` it *is* the approval.
    "COMMIT_EDITED": "COMMITTED",
    # Gate 2, the Accounts release into PACT.
    "ACCOUNTS_APPROVE": "PUSHED_TO_PACT",
    "REJECT": "DISCARDED",
    "RETRY_EXTRACTION": "EXTRACTING",
    "WHITELIST": "CLASSIFIED",
}


def triage_error(status: str, action: str) -> Optional[str]:
    """Whether an operator may take this action on a job in this state."""
    if action not in TRIAGE_ACTIONS:
        return f"'{action}' is not a triage action."

    if not is_on_hold(status):
        if is_terminal(status):
            return f"This message is closed ({label_for(status)})."
        return (
            f"This message is not on hold — it is {label_for(status)} and still "
            "moving through the pipeline."
        )

    if action == "ACCOUNTS_APPROVE" and status != "AWAITING_ACCOUNTS_APPROVAL":
        return (
            "The Accounts release applies to an order waiting at the Accounts gate. "
            f"This one is {label_for(status)}."
        )

    if action == "COMMIT_EDITED" and status == "AWAITING_ACCOUNTS_APPROVAL":
        return (
            "This order already has admin approval and is waiting for Accounts. "
            "Release it from the Accounts queue instead."
        )

    if action == "WHITELIST" and status != "NOT_AN_ORDER":
        return (
            "Whitelisting applies to a message filtered at intake. This one is "
            f"{label_for(status)}; release or re-extract it instead."
        )

    return transition_error(status, TRIAGE_ACTIONS[action])
