// Domain types for the Receipt & Reimbursement Tracking System (RTS).
// These mirror the backend's Pydantic models in `backend/app/models.py`, which
// serialise to exactly this shape.

export type Role = 'EMPLOYEE' | 'HR' | 'ACCOUNTS' | 'PAYMENTS' | 'ADMIN';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'HR_INFO_REQUESTED'
  | 'HR_REJECTED'
  | 'HR_APPROVED'
  | 'ACC_INFO_REQUESTED'
  | 'ACC_REJECTED'
  | 'ACC_APPROVED'
  | 'PAYMENT_QUEUED'
  | 'PAID'
  | 'CREDITED';

export type Stage = 'HR' | 'ACCOUNTS' | 'PAYMENT' | 'DONE';

export type Category = 'TRAVEL' | 'LODGING' | 'MEALS' | 'FUEL' | 'OTHER';

export interface BankAccount {
  bankName: string;
  accountHolder: string;
  /** Always masked at rest — never store or render a full account number. */
  accountNumberMasked: string;
  ifsc: string;
  verified: boolean;
}

export interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  designation: string;
  managerName: string;
  email: string;
  avatarUrl?: string;
  monthlyAllowance: number;
  usedThisMonth: number;
  /** Value of in-flight (not yet credited) requests. */
  pendingAmount: number;
  bankAccount: BankAccount;
}

export interface ReceiptFile {
  id: string;
  fileName: string;
  sizeKb: number;
  uploadedOn: string;
  thumbnailUrl?: string;
  /** Served by the backend from /uploads once the file is stored. */
  url?: string;
  mimeType?: string;
}

export interface TimelineEvent {
  id: string;
  actor: string;
  role: Role;
  action: string;
  comment?: string;
  at: string;
}

export interface ReceiptRequest {
  id: string;
  employeeId: string;
  title: string;
  category: Category;
  amount: number;
  currency: 'INR';
  submittedOn: string;
  travelDates?: { from: string; to: string };
  justification: string;
  receipts: ReceiptFile[];
  status: RequestStatus;
  currentStage: Stage;
  timeline: TimelineEvent[];
  slaDueOn?: string;
  /** Accounts-portal signal: this claim looks like a duplicate of another request. */
  duplicateOf?: string;
  /**
   * What the extraction agent read off the receipt, kept alongside the values the
   * employee confirmed. The pair is what lets a reviewer see an edited amount.
   */
  extraction?: Extraction | null;
  extractedAmount?: number | null;
}

export type PayoutStatus = 'QUEUED' | 'PROCESSING' | 'PAID' | 'FAILED';

export interface Payout {
  id: string;
  requestId: string;
  employeeId: string;
  amount: number;
  method: 'NEFT' | 'IMPS' | 'UPI';
  status: PayoutStatus;
  utr?: string;
  initiatedOn: string;
  settledOn?: string;
  /** Populated only when status is FAILED. */
  failureReason?: string;
}

export interface Notification {
  id: string;
  toRole: Role;
  toEmployeeId?: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  requestId?: string;
}

/** Monthly spend series for the Overview trend chart. */
export interface MonthlySpend {
  month: string;
  disbursed: number;
  budget: number;
}

/** Per-department allowance utilisation for the Overview table. */
export interface DepartmentUtilisation {
  department: string;
  allocated: number;
  used: number;
  pending: number;
  headcount: number;
}

/** Per-category spend for the Overview donut. Derived from live requests. */
export interface CategorySpend {
  category: Category;
  amount: number;
  count: number;
}

/** Category policy caps surfaced in the Accounts review panel. */
export interface PolicyCap {
  category: Category;
  label: string;
  cap: number;
  unit: string;
}

/* -------------------------------------------------------------------------- */
/* Receipt extraction                                                          */
/* -------------------------------------------------------------------------- */

export interface PolicyFinding {
  severity: 'INFO' | 'WARN' | 'BREACH';
  code: string;
  message: string;
  cap?: number | null;
  observed?: number | null;
}

/**
 * A reading of an uploaded receipt. It is a proposal, never a claim: the employee
 * confirms or corrects it, and their submission is what creates the record.
 */
export interface Extraction {
  title?: string | null;
  category?: Category | null;
  amount?: number | null;
  currency: string;
  vendor?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  travelDates?: { from: string; to: string } | null;
  justification?: string | null;
  lineItems: { description: string; amount: number }[];
  /** Per-field 0-1 confidence, so a reviewer knows what to check. */
  confidence: Record<string, number>;
  overallConfidence: number;
  policyFindings: PolicyFinding[];
  notes?: string | null;
  /** 'sample' and 'heuristic' mean the model did not read the file. */
  source: 'claude' | 'sample' | 'heuristic';
  model?: string | null;
  receiptIds: string[];
}
