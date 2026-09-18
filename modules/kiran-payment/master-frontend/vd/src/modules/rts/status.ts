// The single source of truth for status presentation. Import from here everywhere —
// never hard-code a status label or colour in a page or component.
import type { Category, PayoutStatus, RequestStatus, Role, Stage } from './types';

export type StatusTone = 'grey' | 'blue' | 'amber' | 'red' | 'green';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** Short description used in tooltips and the request stepper. */
  hint: string;
  terminal: boolean;
}

/** Tailwind class triplets per tone. Tints are tuned for >= 4.5:1 ink-on-tint. */
export const TONE_CLASSES: Record<StatusTone, { bg: string; text: string; border: string; dot: string; solid: string }> = {
  grey:  { bg: 'bg-st-grey-bg',  text: 'text-st-grey-ink',  border: 'border-st-grey-line',  dot: 'bg-st-grey-ink',  solid: 'bg-st-grey-ink' },
  blue:  { bg: 'bg-st-blue-bg',  text: 'text-st-blue-ink',  border: 'border-st-blue-line',  dot: 'bg-st-blue-ink',  solid: 'bg-st-blue-ink' },
  amber: { bg: 'bg-st-amber-bg', text: 'text-st-amber-ink', border: 'border-st-amber-line', dot: 'bg-st-amber-ink', solid: 'bg-st-amber-ink' },
  red:   { bg: 'bg-st-red-bg',   text: 'text-st-red-ink',   border: 'border-st-red-line',   dot: 'bg-st-red-ink',   solid: 'bg-st-red-ink' },
  green: { bg: 'bg-st-green-bg', text: 'text-st-green-ink', border: 'border-st-green-line', dot: 'bg-st-green-ink', solid: 'bg-st-green-ink' },
};

export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  DRAFT:              { label: 'Draft',              tone: 'grey',  hint: 'Not yet submitted by the employee',        terminal: false },
  SUBMITTED:          { label: 'Submitted',          tone: 'blue',  hint: 'Awaiting first-level HR review',           terminal: false },
  HR_INFO_REQUESTED:  { label: 'HR — Info Needed',   tone: 'amber', hint: 'HR asked the employee for more detail',    terminal: false },
  HR_REJECTED:        { label: 'HR Rejected',        tone: 'red',   hint: 'Declined by HR — business need not met',   terminal: true },
  HR_APPROVED:        { label: 'HR Approved',        tone: 'blue',  hint: 'Cleared by HR, awaiting Accounts review',  terminal: false },
  ACC_INFO_REQUESTED: { label: 'Acc — Info Needed',  tone: 'amber', hint: 'Accounts asked for clarification',         terminal: false },
  ACC_REJECTED:       { label: 'Accounts Rejected',  tone: 'red',   hint: 'Declined by Accounts — policy or budget',  terminal: true },
  ACC_APPROVED:       { label: 'Accounts Approved',  tone: 'green', hint: 'Financially cleared, queued for payment',  terminal: false },
  PAYMENT_QUEUED:     { label: 'Payment Queued',     tone: 'blue',  hint: 'In the disbursement batch',                terminal: false },
  PAID:               { label: 'Paid',               tone: 'green', hint: 'Disbursed to the employee bank account',   terminal: false },
  CREDITED:           { label: 'Credited',           tone: 'green', hint: 'Reflected in the monthly allowance',       terminal: true },
};

export const ALL_STATUSES = Object.keys(STATUS_META) as RequestStatus[];

export function statusMeta(status: RequestStatus): StatusMeta {
  return STATUS_META[status];
}

export function statusLabel(status: RequestStatus): string {
  return STATUS_META[status].label;
}

export function statusTone(status: RequestStatus): StatusTone {
  return STATUS_META[status].tone;
}

/** True when no further action is possible on the request. */
export function isTerminal(status: RequestStatus): boolean {
  return STATUS_META[status].terminal;
}

export const STAGE_LABEL: Record<Stage, string> = {
  HR: 'HR Review',
  ACCOUNTS: 'Accounts Review',
  PAYMENT: 'Payment',
  DONE: 'Completed',
};

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  PAYMENTS: 'Payments',
  ADMIN: 'Admin',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  TRAVEL: 'Travel',
  LODGING: 'Lodging',
  MEALS: 'Meals',
  FUEL: 'Fuel',
  OTHER: 'Other',
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export const PAYOUT_META: Record<PayoutStatus, { label: string; tone: StatusTone }> = {
  QUEUED:     { label: 'Queued',     tone: 'blue' },
  PROCESSING: { label: 'Processing', tone: 'amber' },
  PAID:       { label: 'Paid',       tone: 'green' },
  FAILED:     { label: 'Failed',     tone: 'red' },
};

/** Ordered pipeline used by the Overview funnel and the request stepper. */
export const PIPELINE_STAGES = [
  { key: 'SUBMITTED', label: 'Submitted',   statuses: ['SUBMITTED'] as RequestStatus[] },
  { key: 'HR',        label: 'With HR',     statuses: ['SUBMITTED', 'HR_INFO_REQUESTED'] as RequestStatus[] },
  { key: 'ACCOUNTS',  label: 'With Accounts', statuses: ['HR_APPROVED', 'ACC_INFO_REQUESTED'] as RequestStatus[] },
  { key: 'PAYMENT',   label: 'Queued for Payment', statuses: ['ACC_APPROVED', 'PAYMENT_QUEUED'] as RequestStatus[] },
  { key: 'CREDITED',  label: 'Credited',    statuses: ['PAID', 'CREDITED'] as RequestStatus[] },
] as const;

/**
 * Rank of a status along the happy path, used to derive stepper states.
 * Rejections and info-requests map to the step they stalled on.
 */
export const STATUS_RANK: Record<RequestStatus, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  HR_INFO_REQUESTED: 1,
  HR_REJECTED: 1,
  HR_APPROVED: 2,
  ACC_INFO_REQUESTED: 2,
  ACC_REJECTED: 2,
  ACC_APPROVED: 3,
  PAYMENT_QUEUED: 3,
  PAID: 4,
  CREDITED: 4,
};

/** Which role owns the next action for a request, or null when terminal. */
export function actionOwner(status: RequestStatus): Role | null {
  switch (status) {
    case 'DRAFT':
    case 'HR_INFO_REQUESTED':
    case 'ACC_INFO_REQUESTED':
      return 'EMPLOYEE';
    case 'SUBMITTED':
      return 'HR';
    case 'HR_APPROVED':
      return 'ACCOUNTS';
    case 'ACC_APPROVED':
    case 'PAYMENT_QUEUED':
      return 'PAYMENTS';
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Gate helpers — the business rules, in one place                             */
/* -------------------------------------------------------------------------- */

/** Statuses that mean HR has explicitly cleared the request. */
const HR_CLEARED: RequestStatus[] = [
  'HR_APPROVED',
  'ACC_INFO_REQUESTED',
  'ACC_REJECTED',
  'ACC_APPROVED',
  'PAYMENT_QUEUED',
  'PAID',
  'CREDITED',
];

/**
 * HARD RULE: Accounts cannot act on a request until HR has explicitly approved it.
 * A claim sitting in DRAFT / SUBMITTED / HR_INFO_REQUESTED / HR_REJECTED is not
 * theirs to touch, and must never reach the disbursement screen.
 */
export function isHrCleared(status: RequestStatus): boolean {
  return HR_CLEARED.includes(status);
}

/** Only an Accounts-approved claim may be paid. Implies isHrCleared(). */
export function isPayable(status: RequestStatus): boolean {
  return status === 'ACC_APPROVED' || status === 'PAYMENT_QUEUED';
}

/** Why an Accounts action is blocked, or null when it is allowed. */
export function accountsBlockedReason(status: RequestStatus): string | null {
  if (isHrCleared(status)) return null;
  if (status === 'DRAFT') return 'Not submitted by the employee yet.';
  if (status === 'HR_REJECTED') return 'Rejected by HR — this claim is closed.';
  return 'Awaiting HR approval. Accounts cannot act until HR clears it.';
}
