"""Pydantic mirrors of the frontend's `src/lib/types.ts`.

Field names are snake_case in Python and camelCase on the wire. Every model
inherits `Base`, which sets the alias generator, so a response serialised with
`by_alias=True` is exactly the shape the React app already expects. Nothing in
the frontend's type file had to change to accommodate this.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# The reimbursement chain's five roles, plus the two order-desk teams the PO pipeline
# tasks. SALES and MANUFACTURING appear only as notification recipients - they have no
# stage in `workflow.py` and are not approvers of anything.
Role = Literal[
    "EMPLOYEE", "HR", "ACCOUNTS", "PAYMENTS", "ADMIN", "SALES", "MANUFACTURING",
]

RequestStatus = Literal[
    "DRAFT",
    "SUBMITTED",
    "HR_INFO_REQUESTED",
    "HR_REJECTED",
    "HR_APPROVED",
    "ACC_INFO_REQUESTED",
    "ACC_REJECTED",
    "ACC_APPROVED",
    "PAYMENT_QUEUED",
    "PAID",
    "CREDITED",
]

Stage = Literal["HR", "ACCOUNTS", "PAYMENT", "DONE"]
Category = Literal["TRAVEL", "LODGING", "MEALS", "FUEL", "OTHER"]
PayoutStatus = Literal["QUEUED", "PROCESSING", "PAID", "FAILED"]
PayoutMethod = Literal["NEFT", "IMPS", "UPI"]


class Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


class BankAccount(Base):
    bank_name: str
    account_holder: str
    account_number_masked: str
    ifsc: str
    verified: bool


class Employee(Base):
    id: str
    name: str
    employee_code: str
    department: str
    designation: str
    manager_name: str
    email: str
    avatar_url: Optional[str] = None
    monthly_allowance: int
    used_this_month: int
    pending_amount: int
    bank_account: BankAccount


class ReceiptFile(Base):
    id: str
    file_name: str
    size_kb: int
    uploaded_on: str
    thumbnail_url: Optional[str] = None
    # Added by the backend: where the stored file can actually be fetched.
    url: Optional[str] = None
    mime_type: Optional[str] = None


class TimelineEvent(Base):
    id: str
    actor: str
    role: Role
    action: str
    comment: Optional[str] = None
    at: str


class LineItem(Base):
    description: str
    amount: float


class PolicyFinding(Base):
    severity: Literal["INFO", "WARN", "BREACH"]
    code: str
    message: str
    cap: Optional[float] = None
    observed: Optional[float] = None


class Extraction(Base):
    """What the model read off the receipt, before the employee confirmed it."""

    title: Optional[str] = None
    category: Optional[Category] = None
    amount: Optional[float] = None
    currency: str = "INR"
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    travel_dates: Optional[dict] = None
    justification: Optional[str] = None
    line_items: list[LineItem] = []
    confidence: dict[str, float] = {}
    overall_confidence: float = 0.0
    policy_findings: list[PolicyFinding] = []
    notes: Optional[str] = None
    # "claude" when the model read it, "sample" for the offline demo path,
    # "heuristic" when the API was unreachable and the filename was all we had.
    source: str = "claude"
    model: Optional[str] = None
    receipt_ids: list[str] = []


class ReceiptRequest(Base):
    id: str
    employee_id: str
    title: str
    category: Category
    amount: float
    currency: Literal["INR"] = "INR"
    submitted_on: str
    travel_dates: Optional[dict] = None
    justification: str
    receipts: list[ReceiptFile] = []
    status: RequestStatus
    current_stage: Stage
    timeline: list[TimelineEvent] = []
    sla_due_on: Optional[str] = None
    duplicate_of: Optional[str] = None
    # Additive, optional: what the agent read vs what the employee filed.
    extraction: Optional[Extraction] = None
    extracted_amount: Optional[float] = None


class Payout(Base):
    id: str
    request_id: str
    employee_id: str
    amount: float
    method: PayoutMethod
    status: PayoutStatus
    utr: Optional[str] = None
    initiated_on: str
    settled_on: Optional[str] = None
    failure_reason: Optional[str] = None


class Notification(Base):
    id: str
    to_role: Role
    to_employee_id: Optional[str] = None
    title: str
    body: str
    at: str
    read: bool = False
    request_id: Optional[str] = None


class MonthlySpend(Base):
    month: str
    disbursed: float
    budget: float


class DepartmentUtilisation(Base):
    department: str
    allocated: float
    used: float
    pending: float
    headcount: int


class PolicyCap(Base):
    category: Category
    label: str
    cap: float
    unit: str


class CategorySpend(Base):
    category: Category
    amount: float
    count: int


class Analytics(Base):
    monthly_spend: list[MonthlySpend]
    department_utilisation: list[DepartmentUtilisation]
    policy_caps: list[PolicyCap]
    category_spend: list[CategorySpend]


class AppState(Base):
    """The whole world, in one envelope. Pushed over SSE on every mutation."""

    version: int
    current_employee_id: str
    employees: list[Employee]
    requests: list[ReceiptRequest]
    payouts: list[Payout]
    notifications: list[Notification]
    analytics: Analytics


# --------------------------------------------------------------------------- #
# Request bodies                                                               #
# --------------------------------------------------------------------------- #


class NewRequestFile(Base):
    id: Optional[str] = None
    file_name: str
    size_kb: int


class NewRequestBody(Base):
    employee_id: str
    title: str
    category: Category
    amount: float
    justification: str
    travel_dates: Optional[dict] = None
    files: list[NewRequestFile] = []
    receipt_ids: list[str] = []
    status: Literal["DRAFT", "SUBMITTED"]
    actor: str
    extraction: Optional[Extraction] = None


class TransitionBody(Base):
    status: RequestStatus
    actor: str
    role: Role
    comment: Optional[str] = None


class DisburseBody(Base):
    employee_id: str
    method: PayoutMethod
    actor: str = "Kavya Reddy"


class QueuePayoutsBody(Base):
    payout_ids: list[str]
    actor: str = "Kavya Reddy"


class NotificationBody(Base):
    to_role: Role
    to_employee_id: Optional[str] = None
    title: str
    body: str
    request_id: Optional[str] = None
