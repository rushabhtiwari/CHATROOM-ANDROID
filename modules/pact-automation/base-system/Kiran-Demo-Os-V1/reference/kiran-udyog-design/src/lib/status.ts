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

/**
 * Tailwind classes per tone.
 *
 * `stamp` is the default status treatment (art direction §4): an outline on a
 * transparent ground — pair it with `.ku-stamp`, never with a `bg` wash. Outline
 * and letters are both the tone's *ink*, which is how a rubber stamp actually
 * prints, and it is what keeps the component legible: the 2px frame is the whole
 * form of the stamp, so it has to clear the 3:1 non-text floor (WCAG 1.4.11) on
 * white *and* on canvas. The `-line` hues sit at 1.9-2.3:1 and cannot carry it.
 * `rule` is the 3px tone rule that runs along the top of a ledger cell (§5); it is
 * a complete `border-t` declaration, so it drops straight onto the cell element.
 *
 * `bg` / `border` / `dot` / `solid` are kept for the places that legitimately
 * need a surface — the notification icon plate, a status spine on a list row —
 * but a `bg-st-*-bg` wash is no longer how a status is announced. `border` keeps
 * the softer `-line` hue: it draws tint washes and row spines, never the boundary
 * of a control.
 */
export const TONE_CLASSES: Record<
  StatusTone,
  { bg: string; text: string; border: string; dot: string; solid: string; stamp: string; rule: string }
> = {
  grey:  { bg: 'bg-st-grey-bg',  text: 'text-st-grey-ink',  border: 'border-st-grey-line',  dot: 'bg-st-grey-ink',  solid: 'bg-st-grey-ink',  stamp: 'border-st-grey-ink text-st-grey-ink',   rule: 'border-t-3 border-t-st-grey-ink' },
  blue:  { bg: 'bg-st-blue-bg',  text: 'text-st-blue-ink',  border: 'border-st-blue-line',  dot: 'bg-st-blue-ink',  solid: 'bg-st-blue-ink',  stamp: 'border-st-blue-ink text-st-blue-ink',   rule: 'border-t-3 border-t-st-blue-ink' },
  amber: { bg: 'bg-st-amber-bg', text: 'text-st-amber-ink', border: 'border-st-amber-line', dot: 'bg-st-amber-ink', solid: 'bg-st-amber-ink', stamp: 'border-st-amber-ink text-st-amber-ink', rule: 'border-t-3 border-t-st-amber-ink' },
  red:   { bg: 'bg-st-red-bg',   text: 'text-st-red-ink',   border: 'border-st-red-line',   dot: 'bg-st-red-ink',   solid: 'bg-st-red-ink',   stamp: 'border-st-red-ink text-st-red-ink',     rule: 'border-t-3 border-t-st-red-ink' },
  green: { bg: 'bg-st-green-bg', text: 'text-st-green-ink', border: 'border-st-green-line', dot: 'bg-st-green-ink', solid: 'bg-st-green-ink', stamp: 'border-st-green-ink text-st-green-ink', rule: 'border-t-3 border-t-st-green-ink' },
};

/*
  Labels are stamp copy: short, domain-true, and legible uppercase at 11px. They use
  the words the accounts office actually uses — a bill is *passed for payment*, a
  claim is *cleared* by HR, a query is *raised*, money is *disbursed* then *credited*
  against the allowance. The hint carries the longer explanation.
*/
export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  DRAFT:              { label: 'Draft',           tone: 'grey',  hint: 'Not filed yet — only the employee can see it',        terminal: false },
  SUBMITTED:          { label: 'Submitted',       tone: 'blue',  hint: 'Filed and waiting on first-level HR review',          terminal: false },
  HR_INFO_REQUESTED:  { label: 'HR Query',        tone: 'amber', hint: 'HR raised a query — the employee must respond',       terminal: false },
  HR_REJECTED:        { label: 'HR Rejected',     tone: 'red',   hint: 'Declined by HR — business need not established',      terminal: true },
  HR_APPROVED:        { label: 'HR Cleared',      tone: 'blue',  hint: 'Cleared by HR, now sitting with Accounts',            terminal: false },
  ACC_INFO_REQUESTED: { label: 'Accounts Query',  tone: 'amber', hint: 'Accounts raised a query on the receipt or the amount', terminal: false },
  ACC_REJECTED:       { label: 'Accounts Rejected', tone: 'red', hint: 'Declined by Accounts — outside policy or over budget', terminal: true },
  ACC_APPROVED:       { label: 'Passed',          tone: 'green', hint: 'Passed for payment by Accounts — awaiting disbursement', terminal: false },
  PAYMENT_QUEUED:     { label: 'In Batch',        tone: 'blue',  hint: 'Sitting in the next disbursement batch',              terminal: false },
  PAID:               { label: 'Disbursed',       tone: 'green', hint: 'Released to the employee bank account against a UTR', terminal: false },
  CREDITED:           { label: 'Credited',        tone: 'green', hint: 'Posted against this month’s allowance pool',          terminal: true },
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

/**
 * The route a claim travels, as four desks: HR, Accounts, Payments, settled.
 *
 * The stages are **mutually exclusive** — a claim is counted, and its rupee value
 * summed, in exactly one node. That is not a nicety: the Overview funnel adds these
 * counts up in front of an accounts office, and a total that does not reconcile is
 * the one error this app cannot make. A status therefore appears in at most one
 * `statuses` list, and any change here must keep it that way.
 *
 * DRAFT and the two rejections are deliberately absent: nothing about them is in
 * flight, so they belong to no desk.
 *
 * `route` is the queue that node opens — it lives with the stage rather than in a
 * positional array beside the funnel, so a node can never point at the wrong desk.
 * Credited claims are read off the Payments register, against their UTR.
 */
export const PIPELINE_STAGES = [
  { key: 'HR',       label: 'With HR',           statuses: ['SUBMITTED', 'HR_INFO_REQUESTED'] as RequestStatus[],  route: '/hr' },
  { key: 'ACCOUNTS', label: 'With Accounts',     statuses: ['HR_APPROVED', 'ACC_INFO_REQUESTED'] as RequestStatus[], route: '/accounts' },
  { key: 'PAYMENT',  label: 'Queued for Payment', statuses: ['ACC_APPROVED', 'PAYMENT_QUEUED'] as RequestStatus[],  route: '/payments' },
  { key: 'CREDITED', label: 'Credited',          statuses: ['PAID', 'CREDITED'] as RequestStatus[],                route: '/payments' },
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
