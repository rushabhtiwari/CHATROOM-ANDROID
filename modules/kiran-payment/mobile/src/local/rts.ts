/**
 * Reimbursement claims (RTS), served in process.
 *
 * A port of backend/app/store.py, workflow.py and the state, requests, payouts,
 * notifications and receipts routers. Paths, status codes, ids, timestamps and
 * response shapes are the Python's, so the console's rts/api.ts works against
 * this unchanged. The one state lives in memory and is written to durable
 * storage after every mutation, as the backend wrote data/state.json.
 *
 * Deliberate differences:
 * - An uploaded receipt is kept as a data: URL in `url` rather than written to
 *   /uploads, so it renders with no file server. It is also stored twice, in
 *   the upload registry and on the claim that files it, as the backend did.
 * - A validation failure answers 422 with one string `detail` (the first
 *   error's message) instead of FastAPI's list; that string is what the
 *   client displayed from the list anyway.
 * - Timestamps carry microseconds like Python's, but only to the millisecond.
 */
import {
  HttpError,
  load,
  publish,
  readFiles,
  save,
  subscribe,
  type LocalFile,
  type Route,
  type Stream,
} from './core';
import { ENFORCE_BUDGET } from './config';
import { describeBackend, extract, sampleExtraction, type PolicyCap } from './extraction';
import seed from './rts-seed.json';

/* -------------------------------------------------------------------------- */
/* Shapes                                                                      */
/* -------------------------------------------------------------------------- */

type Json = Record<string, unknown>;

interface Employee {
  id: string;
  name: string;
  department: string;
  pendingAmount: number;
  bankAccount: { bankName: string; accountNumberMasked: string; verified: boolean } & Json;
  [key: string]: unknown;
}

interface TimelineEvent {
  id: string;
  actor: string;
  role: string;
  action: string;
  comment: string | null;
  at: string;
}

interface ClaimReceipt {
  id: string;
  fileName: string;
  sizeKb: number;
  uploadedOn: string;
  url?: string | null;
  mimeType?: string | null;
  [key: string]: unknown;
}

interface Claim {
  id: string;
  employeeId: string;
  title: string;
  category: string;
  amount: number;
  status: string;
  currentStage: string;
  receipts: ClaimReceipt[];
  timeline: TimelineEvent[];
  [key: string]: unknown;
}

interface Payout {
  id: string;
  requestId: string;
  employeeId: string;
  amount: number;
  method: string;
  status: string;
  utr: string | null;
  initiatedOn: string;
  settledOn: string | null;
  failureReason: string | null;
}

interface Notification {
  id: string;
  toRole: string;
  toEmployeeId: string | null;
  title: string;
  body: string;
  at: string;
  read: boolean;
  requestId: string | null;
}

interface DepartmentRow {
  department: string;
  allocated: number;
  used: number;
  pending: number;
  headcount: number;
}

interface UploadedReceipt {
  id: string;
  fileName: string;
  sizeKb: number;
  uploadedOn: string;
  url: string;
  mimeType: string;
  storedName: string;
}

interface State {
  version: number;
  currentEmployeeId: string;
  employees: Employee[];
  requests: Claim[];
  payouts: Payout[];
  notifications: Notification[];
  monthlySpend: Json[];
  departmentUtilisation: DepartmentRow[];
  policyCaps: PolicyCap[];
  /** Runtime movement on top of the seeded ledger, so the historical figures stay intact. */
  deptDelta: Record<string, { used: number; pending: number }>;
  /** Uploaded but not yet filed against a claim. */
  receipts: Record<string, UploadedReceipt>;
  seq: { request: number; notification: number; payout: number; receipt: number };
}

/* -------------------------------------------------------------------------- */
/* Workflow (workflow.py)                                                      */
/* -------------------------------------------------------------------------- */

const STATUS_STAGE: Record<string, string> = {
  DRAFT: 'HR',
  SUBMITTED: 'HR',
  HR_INFO_REQUESTED: 'HR',
  HR_REJECTED: 'HR',
  HR_APPROVED: 'ACCOUNTS',
  ACC_INFO_REQUESTED: 'ACCOUNTS',
  ACC_REJECTED: 'ACCOUNTS',
  ACC_APPROVED: 'PAYMENT',
  PAYMENT_QUEUED: 'PAYMENT',
  PAID: 'DONE',
  CREDITED: 'DONE',
};

const STATUS_ACTION: Record<string, string> = {
  DRAFT: 'Saved as draft',
  SUBMITTED: 'Submitted for approval',
  HR_INFO_REQUESTED: 'More information requested by HR',
  HR_REJECTED: 'Rejected by HR',
  HR_APPROVED: 'Approved by HR',
  ACC_INFO_REQUESTED: 'More information requested by Accounts',
  ACC_REJECTED: 'Rejected by Accounts',
  ACC_APPROVED: 'Approved by Accounts',
  PAYMENT_QUEUED: 'Queued for payment',
  PAID: 'Payment disbursed',
  CREDITED: 'Credited to allowance',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  HR_INFO_REQUESTED: 'HR — Info Needed',
  HR_REJECTED: 'HR Rejected',
  HR_APPROVED: 'HR Approved',
  ACC_INFO_REQUESTED: 'Acc — Info Needed',
  ACC_REJECTED: 'Accounts Rejected',
  ACC_APPROVED: 'Accounts Approved',
  PAYMENT_QUEUED: 'Payment Queued',
  PAID: 'Paid',
  CREDITED: 'Credited',
};

const STATUSES = Object.keys(STATUS_STAGE);
const ROLES = ['EMPLOYEE', 'HR', 'ACCOUNTS', 'PAYMENTS', 'ADMIN'];
const CATEGORIES = ['TRAVEL', 'LODGING', 'MEALS', 'FUEL', 'OTHER'];
const PAYOUT_METHODS = ['NEFT', 'IMPS', 'UPI'];

const TERMINAL = new Set(['HR_REJECTED', 'ACC_REJECTED', 'CREDITED']);

/** Statuses that mean HR has explicitly cleared the request. */
const HR_CLEARED = new Set([
  'HR_APPROVED',
  'ACC_INFO_REQUESTED',
  'ACC_REJECTED',
  'ACC_APPROVED',
  'PAYMENT_QUEUED',
  'PAID',
  'CREDITED',
]);

/** Which statuses each team is allowed to move a claim into. */
const ROLE_TRANSITIONS: Record<string, Set<string>> = {
  EMPLOYEE: new Set(['DRAFT', 'SUBMITTED', 'HR_APPROVED']),
  HR: new Set(['HR_APPROVED', 'HR_REJECTED', 'HR_INFO_REQUESTED']),
  ACCOUNTS: new Set(['ACC_APPROVED', 'ACC_REJECTED', 'ACC_INFO_REQUESTED']),
  PAYMENTS: new Set(['PAYMENT_QUEUED', 'PAID', 'CREDITED']),
  ADMIN: new Set(STATUSES),
};

/** The statuses a claim may legally move to, given where it is now. */
const ALLOWED_NEXT: Record<string, Set<string>> = {
  DRAFT: new Set(['SUBMITTED', 'DRAFT']),
  SUBMITTED: new Set(['HR_APPROVED', 'HR_REJECTED', 'HR_INFO_REQUESTED']),
  HR_INFO_REQUESTED: new Set(['SUBMITTED', 'HR_APPROVED', 'HR_REJECTED']),
  HR_REJECTED: new Set(),
  HR_APPROVED: new Set(['ACC_APPROVED', 'ACC_REJECTED', 'ACC_INFO_REQUESTED']),
  ACC_INFO_REQUESTED: new Set(['HR_APPROVED', 'ACC_APPROVED', 'ACC_REJECTED']),
  ACC_REJECTED: new Set(),
  ACC_APPROVED: new Set(['PAYMENT_QUEUED', 'PAID']),
  PAYMENT_QUEUED: new Set(['PAID', 'ACC_APPROVED']),
  PAID: new Set(['CREDITED']),
  CREDITED: new Set(),
};

const stageFor = (status: string) => STATUS_STAGE[status]!;
const actionFor = (status: string) => STATUS_ACTION[status]!;
export const isPayable = (status: string) =>
  status === 'ACC_APPROVED' || status === 'PAYMENT_QUEUED';

/**
 * Why a transition is refused, or null when it is allowed. The messages are
 * shown to the user as they are, because the client surfaces what comes back.
 */
export function transitionError(current: string, target: string, role: string): string | null {
  if (!(target in STATUS_STAGE)) return `'${target}' is not a valid status.`;

  if (role !== 'ADMIN' && !ROLE_TRANSITIONS[role]?.has(target)) {
    return `${role} is not allowed to move a claim to ${STATUS_LABEL[target]}.`;
  }

  if (TERMINAL.has(current)) {
    return `This claim is closed (${STATUS_LABEL[current]}) — no further action is possible.`;
  }

  // The hard rule the frontend leads with: Accounts cannot act before HR.
  if (role === 'ACCOUNTS' && !HR_CLEARED.has(current)) {
    if (current === 'DRAFT') return 'Not submitted by the employee yet.';
    return 'Awaiting HR approval. Accounts cannot act until HR clears it.';
  }

  if (current === target) return null; // idempotent, harmless

  if (!ALLOWED_NEXT[current]?.has(target)) {
    return `A claim in ${STATUS_LABEL[current]} cannot move to ${STATUS_LABEL[target]}.`;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Python's formats                                                            */
/* -------------------------------------------------------------------------- */

/** `datetime.now(timezone.utc).isoformat()` with `Z`: six fractional digits. */
function nowIso(date = new Date()): string {
  return date.toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
}

/** Python's round(): halves go to the even neighbour. */
function pyRound(value: number): number {
  if (Math.abs(value % 1) === 0.5) return 2 * Math.round(value / 2);
  return Math.round(value);
}

/** `f"{value:,.0f}"`. */
function money(value: number): string {
  const rounded = pyRound(value);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rounded < 0 ? `-${digits}` : digits;
}

const pad = (value: number, width: number) => String(value).padStart(width, '0');

/* -------------------------------------------------------------------------- */
/* Store (store.py)                                                            */
/* -------------------------------------------------------------------------- */

const KEY = 'rts';
const CHANNEL = 'rts:state';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function blank(): State {
  const copy = clone(seed) as unknown as Omit<State, 'version' | 'deptDelta' | 'receipts' | 'seq'>;
  return {
    version: 1,
    currentEmployeeId: copy.currentEmployeeId,
    employees: copy.employees,
    requests: copy.requests,
    payouts: copy.payouts,
    notifications: copy.notifications,
    monthlySpend: copy.monthlySpend,
    departmentUtilisation: copy.departmentUtilisation,
    policyCaps: copy.policyCaps,
    deptDelta: {},
    receipts: {},
    seq: { request: 0, notification: 0, payout: 0, receipt: 0 },
  };
}

let current: State | null = null;
let listeners = 0;

/** The live state, read from storage on first use. */
function state(): State {
  if (current) return current;
  const loaded = load<State>(KEY, blank);
  // Tolerate a snapshot written by an older build.
  const defaults = blank();
  for (const key of Object.keys(defaults) as (keyof State)[]) {
    if (!(key in loaded)) (loaded as unknown as Json)[key] = defaults[key];
  }
  current = loaded;
  return current;
}

const persist = () => save(KEY, state());

function commit(): void {
  state().version += 1;
  persist();
  publish(CHANNEL, snapshot());
}

function reset(): Json {
  current = blank();
  persist();
  publish(CHANNEL, snapshot());
  return snapshot();
}

function analytics(): Json {
  const s = state();
  const totals = new Map(CATEGORIES.map((c) => [c, { amount: 0, count: 0 }]));
  for (const r of s.requests) {
    const entry = totals.get(r.category);
    if (entry) {
      entry.amount += r.amount;
      entry.count += 1;
    }
  }

  const departments = s.departmentUtilisation.map((row) => {
    const d = s.deptDelta[row.department];
    return {
      ...row,
      used: Math.max(0, row.used + (d?.used ?? 0)),
      pending: Math.max(0, row.pending + (d?.pending ?? 0)),
    };
  });

  return {
    monthlySpend: s.monthlySpend,
    departmentUtilisation: departments,
    policyCaps: s.policyCaps,
    categorySpend: CATEGORIES.map((category) => ({ category, ...totals.get(category)! })),
  };
}

/** The whole world in one envelope: what /api/state returns and the stream pushes. */
function snapshot() {
  const s = state();
  return {
    version: s.version,
    currentEmployeeId: s.currentEmployeeId,
    employees: s.employees,
    requests: s.requests,
    payouts: s.payouts,
    notifications: s.notifications,
    analytics: analytics(),
  };
}

const findEmployee = (id: string) => state().employees.find((e) => e.id === id);
const findRequest = (id: string) => state().requests.find((r) => r.id === id);

function departmentHeadroom(department: string) {
  const rows = analytics().departmentUtilisation as DepartmentRow[];
  const row = rows.find((d) => d.department === department);
  if (!row) return null;
  return { ...row, headroom: Math.max(0, row.allocated - row.used - row.pending) };
}

function bumpDept(employeeId: string, change: { used?: number; pending?: number }): void {
  const employee = findEmployee(employeeId);
  if (!employee) return;
  const deltas = state().deptDelta;
  const entry = (deltas[employee.department] ??= { used: 0, pending: 0 });
  entry.used += change.used ?? 0;
  entry.pending += change.pending ?? 0;
}

function next(key: keyof State['seq']): number {
  state().seq[key] += 1;
  return state().seq[key];
}

function raiseNotification(n: {
  toRole: string;
  title: string;
  body: string;
  toEmployeeId?: string | null;
  requestId?: string | null;
}): Notification {
  const notification: Notification = {
    id: `NTF-RUN-${next('notification')}`,
    toRole: n.toRole,
    toEmployeeId: n.toEmployeeId ?? null,
    title: n.title,
    body: n.body,
    at: nowIso(),
    read: false,
    requestId: n.requestId ?? null,
  };
  state().notifications.unshift(notification);
  return notification;
}

function registerReceipt(record: Omit<UploadedReceipt, 'id'>): UploadedReceipt {
  const stored = { ...record, id: `RCP-UP-${next('receipt')}` };
  state().receipts[stored.id] = stored;
  // Not a visible change until a claim files it: saved, but no version bump.
  persist();
  return stored;
}

function createRequest(body: NewRequestBody): Claim {
  const s = state();
  const requestId = `REQ-2026-9${pad(next('request'), 3)}`;
  const now = nowIso();

  const employee = findEmployee(body.employeeId);
  const actor = body.actor || (employee ? employee.name : 'Employee');

  // Prefer real uploaded files; fall back to the name and size the dropzone
  // reported, so a claim can still be filed with no stored upload.
  const receipts: ClaimReceipt[] = body.receiptIds
    .filter((id) => id in s.receipts)
    .map((id, i) => {
      const stored = s.receipts[id]!;
      return {
        id: `RCP-${requestId}-${i + 1}`,
        fileName: stored.fileName,
        sizeKb: stored.sizeKb,
        uploadedOn: stored.uploadedOn ?? now,
        url: stored.url ?? null,
        mimeType: stored.mimeType ?? null,
      };
    });
  if (receipts.length === 0) {
    body.files.forEach((f, i) =>
      receipts.push({
        id: `RCP-${requestId}-${i + 1}`,
        fileName: f.fileName,
        sizeKb: f.sizeKb,
        uploadedOn: now,
      }),
    );
  }

  const status = body.status;
  const timeline: TimelineEvent[] = [];
  let slaDueOn: string | null = null;
  if (status === 'SUBMITTED') {
    timeline.push({
      id: `EVT-${requestId}-0`,
      actor,
      role: 'EMPLOYEE',
      action: actionFor('SUBMITTED'),
      // Python slices code points, not UTF-16 units.
      comment: Array.from(body.justification || '')
        .slice(0, 90)
        .join(''),
      at: now,
    });
    slaDueOn = nowIso(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  }

  const extraction = body.extraction;
  const request: Claim = {
    id: requestId,
    employeeId: body.employeeId,
    title: body.title,
    category: body.category,
    amount: body.amount,
    currency: 'INR',
    submittedOn: now,
    travelDates: body.travelDates,
    justification: body.justification,
    receipts,
    status,
    currentStage: stageFor(status),
    timeline,
    slaDueOn,
    duplicateOf: null,
    extraction,
    extractedAmount: extraction?.amount ?? null,
  };

  s.requests.unshift(request);

  if (status === 'SUBMITTED') {
    raiseNotification({
      toRole: 'HR',
      title: 'New request awaiting HR review',
      body: `${actor} raised ${requestId} for ${request.title}. Amount Rs ${money(request.amount)}.`,
      requestId,
    });
  }

  commit();
  return request;
}

function applyLedger(request: Claim, previous: string, status: string): void {
  const amount = request.amount;
  if (previous === 'DRAFT' && status === 'SUBMITTED') {
    bumpDept(request.employeeId, { pending: amount });
  } else if (status === 'HR_REJECTED' || status === 'ACC_REJECTED') {
    bumpDept(request.employeeId, { pending: -amount });
  } else if (status === 'PAID') {
    bumpDept(request.employeeId, { pending: -amount, used: amount });
  }
}

function notifyTransition(
  request: Claim,
  status: string,
  actor: string,
  comment: string | null,
): void {
  const rid = request.id;
  const employeeId = request.employeeId;
  const tail = comment ? ` Note: ${comment}` : '';
  const title = request.title;

  if (status === 'HR_APPROVED') {
    raiseNotification({
      toRole: 'ACCOUNTS',
      title: `${rid} cleared by HR`,
      body: `${title} is awaiting financial review.${tail}`,
      requestId: rid,
    });
    raiseNotification({
      toRole: 'EMPLOYEE',
      toEmployeeId: employeeId,
      title: `${rid} approved by HR`,
      body: `Your claim has moved to the Accounts queue.${tail}`,
      requestId: rid,
    });
  } else if (
    ['HR_REJECTED', 'ACC_REJECTED', 'HR_INFO_REQUESTED', 'ACC_INFO_REQUESTED'].includes(status)
  ) {
    raiseNotification({
      toRole: 'EMPLOYEE',
      toEmployeeId: employeeId,
      title: `${rid} — ${actionFor(status)}`,
      body: `${title}.${tail}`,
      requestId: rid,
    });
    if (status === 'ACC_REJECTED' || status === 'ACC_INFO_REQUESTED') {
      // HR had already cleared this one; it should not learn of the reversal
      // from the employee.
      raiseNotification({
        toRole: 'HR',
        title: `${rid} — ${actionFor(status)}`,
        body: `${title}, which HR had approved.${tail}`,
        requestId: rid,
      });
    }
  } else if (status === 'ACC_APPROVED') {
    const amountText = money(request.amount);
    raiseNotification({
      toRole: 'PAYMENTS',
      title: `${rid} cleared for disbursement`,
      body: `${title} — Rs ${amountText} is ready to pay.${tail}`,
      requestId: rid,
    });
    raiseNotification({
      toRole: 'HR',
      title: `${rid} approved by Accounts`,
      body: `${title} — Rs ${amountText} passed financial review and is queued to pay.${tail}`,
      requestId: rid,
    });
  } else if (status === 'SUBMITTED') {
    raiseNotification({
      toRole: 'HR',
      title: 'New request awaiting HR review',
      body: `${actor} submitted ${rid} — ${title}.${tail}`,
      requestId: rid,
    });
  }
}

const openPayoutFor = (requestId: string) =>
  state().payouts.find(
    (p) => p.requestId === requestId && (p.status === 'QUEUED' || p.status === 'PROCESSING'),
  );

function ensurePayout(request: Claim): Payout {
  const existing = openPayoutFor(request.id);
  if (existing) return existing;
  const payout: Payout = {
    id: `PAY-RUN-${pad(next('payout'), 4)}`,
    requestId: request.id,
    employeeId: request.employeeId,
    amount: request.amount,
    method: 'NEFT',
    status: 'QUEUED',
    utr: null,
    initiatedOn: nowIso(),
    settledOn: null,
    failureReason: null,
  };
  state().payouts.unshift(payout);
  return payout;
}

/** Moves a claim along the chain. Returns the claim, or why it was refused. */
function transition(
  requestId: string,
  status: string,
  actor: string,
  role: string,
  comment: string | null,
): { request: Claim } | { error: string } {
  const request = findRequest(requestId);
  if (!request) return { error: `No request matches the id '${requestId}'.` };

  const error = transitionError(request.status, status, role);
  if (error) return { error };

  const previous = request.status;
  request.status = status;
  request.currentStage = stageFor(status);
  request.timeline.push({
    id: `EVT-${requestId}-${request.timeline.length}`,
    actor,
    role,
    action: actionFor(status),
    comment,
    at: nowIso(),
  });

  applyLedger(request, previous, status);
  notifyTransition(request, status, actor, comment);

  // Accounts clearing a claim puts it in the disbursement queue.
  if (status === 'ACC_APPROVED') ensurePayout(request);

  commit();
  return { request };
}

/** Marks selected payouts PROCESSING and moves their claims along. */
function queuePayouts(payoutIds: string[], actor: string): Payout[] {
  const touched: Payout[] = [];
  for (const payout of state().payouts) {
    if (!payoutIds.includes(payout.id)) continue;
    payout.status = 'PROCESSING';
    touched.push(payout);

    const linked = findRequest(payout.requestId);
    if (linked && linked.status === 'ACC_APPROVED') {
      linked.status = 'PAYMENT_QUEUED';
      linked.currentStage = stageFor('PAYMENT_QUEUED');
      linked.timeline.push({
        id: `EVT-${linked.id}-${linked.timeline.length}`,
        actor,
        role: 'PAYMENTS',
        action: actionFor('PAYMENT_QUEUED'),
        comment: null,
        at: nowIso(),
      });
    }
  }
  // Committed even when nothing matched, as the backend does.
  commit();
  return touched;
}

function retryPayout(payoutId: string): Payout | null {
  const payout = state().payouts.find((p) => p.id === payoutId);
  if (!payout) return null;
  payout.status = 'QUEUED';
  payout.failureReason = null;
  commit();
  return payout;
}

function verifyBank(employeeId: string): Employee | null {
  const employee = findEmployee(employeeId);
  if (!employee) return null;
  employee.bankAccount.verified = true;
  const bank = employee.bankAccount;
  raiseNotification({
    toRole: 'EMPLOYEE',
    toEmployeeId: employeeId,
    title: 'Bank account verified',
    body:
      `${bank.bankName} ${bank.accountNumberMasked} has been ` +
      'verified. Payouts to this account can now be released.',
  });
  commit();
  return employee;
}

/** `datetime.now(utc).strftime("%y%m%d%H%M%S%f")[:14]`: to the hundredth of a second. */
function utrStamp(date: Date): string {
  return (
    pad(date.getUTCFullYear() % 100, 2) +
    pad(date.getUTCMonth() + 1, 2) +
    pad(date.getUTCDate(), 2) +
    pad(date.getUTCHours(), 2) +
    pad(date.getUTCMinutes(), 2) +
    pad(date.getUTCSeconds(), 2) +
    pad(date.getUTCMilliseconds(), 3).slice(0, 2)
  );
}

/**
 * Pays every payable claim for one employee under a single UTR: each claim
 * goes PAID then CREDITED, leaves the pending balance, and its open payout row
 * is settled rather than duplicated.
 */
function disburse(
  employeeId: string,
  method: string,
  actor: string,
): { result: Json } | { error: string } {
  const s = state();
  const employee = findEmployee(employeeId);
  if (!employee) return { error: `No employee matches '${employeeId}'.` };

  const claims = s.requests.filter((r) => r.employeeId === employeeId && isPayable(r.status));
  if (claims.length === 0) return { error: 'There is nothing payable for this employee.' };

  const now = nowIso();
  const utr = `UTR${utrStamp(new Date())}`;
  const total = claims.reduce((sum, c) => sum + c.amount, 0);

  for (const claim of claims) {
    for (const [status, comment] of [
      ['PAID', `Disbursed via ${method}.`],
      ['CREDITED', 'Monthly allowance balance restored.'],
    ] as const) {
      claim.status = status;
      claim.currentStage = stageFor(status);
      claim.timeline.push({
        id: `EVT-${claim.id}-${claim.timeline.length}`,
        actor,
        role: 'PAYMENTS',
        action: actionFor(status),
        comment,
        at: nowIso(),
      });
    }

    // The claim leaves pendingAmount, so remaining rises by what was paid.
    employee.pendingAmount = Math.max(0, employee.pendingAmount - claim.amount);
    bumpDept(employeeId, { pending: -claim.amount, used: claim.amount });

    const open = openPayoutFor(claim.id);
    if (open) {
      Object.assign(open, { method, status: 'PAID', utr, settledOn: now, failureReason: null });
    } else {
      s.payouts.unshift({
        id: `PAY-RUN-${pad(next('payout'), 4)}`,
        requestId: claim.id,
        employeeId,
        amount: claim.amount,
        method,
        status: 'PAID',
        utr,
        initiatedOn: now,
        settledOn: now,
        failureReason: null,
      });
    }
  }

  const masked = employee.bankAccount.accountNumberMasked;
  const totalText = money(total);
  raiseNotification({
    toRole: 'EMPLOYEE',
    toEmployeeId: employeeId,
    title: `Payment successful — Rs ${totalText} received`,
    body:
      `Your reimbursement of Rs ${totalText} has been disbursed via ` +
      `${method} to ${masked} and credited to your monthly allowance. ` +
      `UTR ${utr}.`,
    requestId: claims[0]!.id,
  });
  // HR opened the file on every one of these claims, so HR hears how it
  // closed rather than finding out from the employee.
  const claimIds = claims.map((c) => c.id).join(', ');
  const claimsText = claims.length === 1 ? '1 approved claim' : `${claims.length} approved claims`;
  raiseNotification({
    toRole: 'HR',
    title: `Accounts disbursed Rs ${totalText} to ${employee.name}`,
    body:
      `${actor} paid ${claimsText} (${claimIds}) for ` +
      `${employee.name}, ${employee.department}, via ${method}. UTR ${utr}.`,
    requestId: claims[0]!.id,
  });

  commit();
  return {
    result: {
      utr,
      method,
      employeeId,
      total,
      requestIds: claims.map((c) => c.id),
      payoutId: `PAY-${utr.slice(-6)}`,
      at: now,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Request bodies (models.py)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Pydantic's checks, as far as these bodies need them. Fields are read by
 * their camelCase alias or their snake_case name (`populate_by_name`), checked
 * in the model's field order, and the first failure answers 422 with
 * pydantic's own message.
 */
const invalid = (message: string) => new HttpError(422, message);

function object(value: unknown): Json {
  if (value === undefined) throw invalid('Field required');
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid('Input should be a valid dictionary or object to extract fields from');
  }
  return value as Json;
}

const snake = (name: string) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function get(body: Json, name: string): unknown {
  if (name in body) return body[name];
  return body[snake(name)];
}

const MISSING = Symbol('missing');

/** The field, or MISSING / the default when absent. */
function field(body: Json, name: string, fallback: unknown = MISSING): unknown {
  const value = get(body, name);
  if (value === undefined) {
    if (fallback === MISSING) throw invalid('Field required');
    return fallback;
  }
  return value;
}

function str(value: unknown): string;
function str(value: unknown, nullable: true): string | null;
function str(value: unknown, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string') throw invalid('Input should be a valid string');
  return value;
}

function num(value: unknown): number;
function num(value: unknown, nullable: true): number | null;
function num(value: unknown, nullable = false): number | null {
  if (value === null && nullable) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw invalid('Input should be a valid number, unable to parse string as a number');
}

function int(value: unknown): number {
  if (typeof value === 'string' && /^\s*[-+]?\d+\s*$/.test(value)) return Number(value);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid('Input should be a valid integer');
  }
  if (!Number.isInteger(value)) {
    throw invalid('Input should be a valid integer, got a number with a fractional part');
  }
  return value;
}

function literal<T extends string>(value: unknown, allowed: readonly T[]): T;
function literal<T extends string>(value: unknown, allowed: readonly T[], nullable: true): T | null;
function literal<T extends string>(value: unknown, allowed: readonly T[], nullable = false) {
  if (value === null && nullable) return null;
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value))
    return value as T;
  const quoted = allowed.map((a) => `'${a}'`);
  const last = quoted.pop();
  const list = quoted.length ? `${quoted.join(', ')} or ${last}` : last;
  throw invalid(`Input should be ${list}`);
}

function list<T>(value: unknown, item: (entry: unknown) => T): T[] {
  if (!Array.isArray(value)) throw invalid('Input should be a valid list');
  return value.map(item);
}

function dict(value: unknown): Json;
function dict(value: unknown, nullable: true): Json | null;
function dict(value: unknown, nullable = false): Json | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid('Input should be a valid dictionary');
  }
  return value as Json;
}

interface Extraction extends Json {
  amount: number | null;
}

/** An Extraction as `model_dump(by_alias=True)` writes it: every field, defaults filled. */
function parseExtraction(value: unknown): Extraction | null {
  if (value === null || value === undefined) return null;
  const body = object(value);
  return {
    title: str(field(body, 'title', null), true),
    category: literal(field(body, 'category', null), CATEGORIES, true),
    amount: num(field(body, 'amount', null), true),
    currency: str(field(body, 'currency', 'INR')),
    vendor: str(field(body, 'vendor', null), true),
    invoiceNumber: str(field(body, 'invoiceNumber', null), true),
    invoiceDate: str(field(body, 'invoiceDate', null), true),
    travelDates: dict(field(body, 'travelDates', null), true),
    justification: str(field(body, 'justification', null), true),
    lineItems: list(field(body, 'lineItems', []), (entry) => {
      const item = object(entry);
      return {
        description: str(field(item, 'description')),
        amount: num(field(item, 'amount')),
      };
    }),
    confidence: Object.fromEntries(
      Object.entries(dict(field(body, 'confidence', {}))).map(([k, v]) => [k, num(v)]),
    ),
    overallConfidence: num(field(body, 'overallConfidence', 0)),
    policyFindings: list(field(body, 'policyFindings', []), (entry) => {
      const finding = object(entry);
      return {
        severity: literal(field(finding, 'severity'), ['INFO', 'WARN', 'BREACH'] as const),
        code: str(field(finding, 'code')),
        message: str(field(finding, 'message')),
        cap: num(field(finding, 'cap', null), true),
        observed: num(field(finding, 'observed', null), true),
      };
    }),
    notes: str(field(body, 'notes', null), true),
    source: str(field(body, 'source', 'claude')),
    model: str(field(body, 'model', null), true),
    receiptIds: list(field(body, 'receiptIds', []), (id) => str(id)),
  };
}

interface NewRequestBody {
  employeeId: string;
  title: string;
  category: string;
  amount: number;
  justification: string;
  travelDates: Json | null;
  files: { id: string | null; fileName: string; sizeKb: number }[];
  receiptIds: string[];
  status: 'DRAFT' | 'SUBMITTED';
  actor: string;
  extraction: Extraction | null;
}

function parseNewRequest(value: unknown): NewRequestBody {
  const body = object(value);
  return {
    employeeId: str(field(body, 'employeeId')),
    title: str(field(body, 'title')),
    category: literal(field(body, 'category'), CATEGORIES),
    amount: num(field(body, 'amount')),
    justification: str(field(body, 'justification')),
    travelDates: dict(field(body, 'travelDates', null), true),
    files: list(field(body, 'files', []), (entry) => {
      const file = object(entry);
      return {
        id: str(field(file, 'id', null), true),
        fileName: str(field(file, 'fileName')),
        sizeKb: int(field(file, 'sizeKb')),
      };
    }),
    receiptIds: list(field(body, 'receiptIds', []), (id) => str(id)),
    status: literal(field(body, 'status'), ['DRAFT', 'SUBMITTED'] as const),
    actor: str(field(body, 'actor')),
    extraction: parseExtraction(field(body, 'extraction', null)),
  };
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

const DEFAULT_PAYMENTS_ACTOR = 'Kavya Reddy';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB, matching the dropzone's own hint

function requestOr404(id: string): Claim {
  const request = findRequest(id);
  if (!request) throw new HttpError(404, `No request matches '${id}'.`);
  return request;
}

/** Keeps the original name readable but strips anything path-like. */
function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'receipt';
  return cleaned.slice(0, 120);
}

/** `uuid.uuid4().hex[:12]`. */
function shortId(): string {
  const bytes = new Uint8Array(6);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Stores the uploaded receipts and returns a claim proposal, never a filed claim. */
async function uploadAndExtract(form: unknown): Promise<Json> {
  const caps = state().policyCaps;
  const useSample = form instanceof FormData ? form.get('use_sample') : null;
  const wantsSample = ['1', 'true', 'yes'].includes(String(useSample ?? 'false').toLowerCase());
  const files = await readFiles(form, 'files');

  if (wantsSample && files.length === 0) {
    return { receipts: [], extraction: { ...sampleExtraction(caps), receiptIds: [] } };
  }
  if (files.length === 0) throw new HttpError(400, 'No files were uploaded.');

  const stored: UploadedReceipt[] = [];
  const read: LocalFile[] = [];
  for (const upload of files) {
    if (upload.size === 0) continue;
    if (upload.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(413, `${upload.name} is larger than 10 MB.`);
    }
    const original = safeName(upload.name || 'receipt');
    stored.push(
      registerReceipt({
        fileName: original,
        sizeKb: Math.max(1, pyRound(upload.size / 1024)),
        uploadedOn: nowIso(),
        // The bytes themselves, so the image renders with no file server.
        url: upload.dataUrl,
        mimeType: upload.type,
        storedName: `${shortId()}-${original}`,
      }),
    );
    read.push(upload);
  }
  if (stored.length === 0) throw new HttpError(400, 'Every uploaded file was empty.');

  const extraction = wantsSample
    ? sampleExtraction(caps)
    : await extract(
        read,
        caps,
        stored.map((r) => r.fileName),
      );
  return { receipts: stored, extraction: { ...extraction, receiptIds: stored.map((r) => r.id) } };
}

export const rtsRoutes: Route[] = [
  /* state.py */
  { method: 'GET', pattern: '/api/state', handle: () => snapshot() },
  {
    method: 'GET',
    pattern: '/api/health',
    handle: () => {
      const s = snapshot();
      return {
        ok: true,
        version: s.version,
        requests: s.requests.length,
        listeners,
        extraction: describeBackend(),
      };
    },
  },
  { method: 'POST', pattern: '/api/demo/reset', handle: () => reset() },

  /* requests.py */
  { method: 'GET', pattern: '/api/requests', handle: () => snapshot().requests },
  { method: 'GET', pattern: '/api/requests/:id', handle: ({ params }) => requestOr404(params.id!) },
  {
    method: 'POST',
    pattern: '/api/requests',
    status: 201,
    handle: ({ body }) => createRequest(parseNewRequest(body)),
  },
  {
    method: 'POST',
    pattern: '/api/requests/:id/transition',
    handle: ({ params, body }) => {
      const input = object(body);
      const status = literal(field(input, 'status'), STATUSES);
      const actor = str(field(input, 'actor'));
      const role = literal(field(input, 'role'), ROLES);
      const comment = str(field(input, 'comment', null), true);

      const request = requestOr404(params.id!);

      // Financial feasibility at the Accounts step. Advisory unless enforced,
      // so a long demo can never dead-end on it.
      if (status === 'ACC_APPROVED' && ENFORCE_BUDGET) {
        const employee = findEmployee(request.employeeId);
        const position = employee ? departmentHeadroom(employee.department) : null;
        if (employee && position && request.amount > position.headroom) {
          const shortfall = request.amount - position.headroom;
          throw new HttpError(
            409,
            `${employee.department} has Rs ${money(position.headroom)} of headroom, ` +
              `short by Rs ${money(shortfall)} for this claim.`,
          );
        }
      }

      const outcome = transition(params.id!, status, actor, role, comment);
      if ('error' in outcome) throw new HttpError(409, outcome.error);
      return outcome.request;
    },
  },
  {
    method: 'GET',
    pattern: '/api/requests/:id/headroom',
    handle: ({ params }) => {
      const request = requestOr404(params.id!);
      const employee = findEmployee(request.employeeId);
      if (!employee) throw new HttpError(404, 'Employee not found for this claim.');
      const position = departmentHeadroom(employee.department);
      if (!position) throw new HttpError(404, 'No budget row for this department.');
      return {
        ...position,
        amount: request.amount,
        sufficient: request.amount <= position.headroom,
        shortfall: Math.max(0, request.amount - position.headroom),
        enforced: ENFORCE_BUDGET,
      };
    },
  },

  /* payouts.py */
  { method: 'GET', pattern: '/api/payouts', handle: () => snapshot().payouts },
  {
    method: 'POST',
    pattern: '/api/payouts/queue',
    handle: ({ body }) => {
      const input = object(body);
      const ids = list(field(input, 'payoutIds'), (id) => str(id));
      const actor = str(field(input, 'actor', DEFAULT_PAYMENTS_ACTOR));
      const touched = queuePayouts(ids, actor);
      if (touched.length === 0) throw new HttpError(404, 'None of those payouts exist.');
      return touched;
    },
  },
  {
    method: 'POST',
    pattern: '/api/payouts/:id/retry',
    handle: ({ params }) => {
      const payout = retryPayout(params.id!);
      if (!payout) throw new HttpError(404, `No payout matches '${params.id}'.`);
      return payout;
    },
  },
  {
    method: 'GET',
    pattern: '/api/payees',
    handle: () => {
      // Only Accounts-approved claims appear, which by the chain's rules implies
      // HR approval: an unapproved claim can never reach this screen.
      const s = snapshot();
      const employees = new Map(s.employees.map((e) => [e.id, e]));
      const grouped = new Map<string, Claim[]>();
      for (const request of s.requests) {
        if (!isPayable(request.status)) continue;
        const claims = grouped.get(request.employeeId) ?? [];
        claims.push(request);
        grouped.set(request.employeeId, claims);
      }
      const rows = [];
      for (const [employeeId, claims] of grouped) {
        const employee = employees.get(employeeId);
        if (!employee) continue;
        rows.push({
          employee,
          claims,
          total: claims.reduce((sum, c) => sum + c.amount, 0),
          receiptCount: claims.reduce((sum, c) => sum + c.receipts.length, 0),
        });
      }
      return rows.sort((a, b) => b.total - a.total);
    },
  },
  {
    method: 'POST',
    pattern: '/api/disburse',
    handle: ({ body }) => {
      const input = object(body);
      const employeeId = str(field(input, 'employeeId'));
      const method = literal(field(input, 'method'), PAYOUT_METHODS);
      const actor = str(field(input, 'actor', DEFAULT_PAYMENTS_ACTOR));
      const outcome = disburse(employeeId, method, actor);
      if ('error' in outcome) throw new HttpError(409, outcome.error);
      return outcome.result;
    },
  },
  {
    method: 'POST',
    pattern: '/api/employees/:id/verify-bank',
    handle: ({ params }) => {
      const employee = verifyBank(params.id!);
      if (!employee) throw new HttpError(404, `No employee matches '${params.id}'.`);
      return employee;
    },
  },
  { method: 'GET', pattern: '/api/employees', handle: () => snapshot().employees },
  {
    method: 'GET',
    pattern: '/api/receipt-context/:utr',
    handle: ({ params }) => {
      // The receipt page opens with no app state, so it resolves itself by UTR.
      const utr = params.utr!;
      const s = snapshot();
      const payouts = s.payouts.filter((p) => p.utr === utr);
      if (payouts.length === 0) throw new HttpError(404, `No payout matches UTR '${utr}'.`);
      const requestIds = new Set(payouts.map((p) => p.requestId));
      const employeeId = payouts[0]!.employeeId;
      return {
        utr,
        payouts,
        employee: s.employees.find((e) => e.id === employeeId) ?? null,
        requests: s.requests.filter((r) => requestIds.has(r.id)),
        total: payouts.reduce((sum, p) => sum + p.amount, 0),
        method: payouts[0]!.method,
        settledOn: payouts[0]!.settledOn ?? null,
      };
    },
  },

  /* notifications.py */
  { method: 'GET', pattern: '/api/notifications', handle: () => snapshot().notifications },
  {
    method: 'POST',
    pattern: '/api/notifications',
    status: 201,
    handle: ({ body }) => {
      const input = object(body);
      const toRole = literal(field(input, 'toRole'), ROLES);
      const toEmployeeId = str(field(input, 'toEmployeeId', null), true);
      const title = str(field(input, 'title'));
      const text = str(field(input, 'body'));
      const requestId = str(field(input, 'requestId', null), true);
      const notification = raiseNotification({
        toRole,
        toEmployeeId,
        title,
        body: text,
        requestId,
      });
      commit();
      return notification;
    },
  },
  {
    method: 'POST',
    pattern: '/api/notifications/read-all',
    handle: () => {
      for (const n of state().notifications) n.read = true;
      commit();
      return { ok: true };
    },
  },
  {
    method: 'POST',
    pattern: '/api/notifications/:id/read',
    handle: ({ params }) => {
      for (const n of state().notifications) if (n.id === params.id) n.read = true;
      commit();
      return { ok: true };
    },
  },

  /* receipts.py */
  { method: 'GET', pattern: '/api/receipts/status', handle: () => describeBackend() },
  {
    method: 'POST',
    pattern: '/api/receipts/extract',
    handle: ({ body }) => uploadAndExtract(body),
  },
];

/** Server-sent state: the current snapshot on open, then one per mutation. */
export const rtsStreams: Record<string, Stream> = {
  '/api/events': (emit) => {
    listeners += 1;
    // Current state first, so a reconnecting view is right before the next mutation.
    emit('state', snapshot());
    const unsubscribe = subscribe(CHANNEL, (data) => emit('state', data));
    return () => {
      unsubscribe();
      listeners -= 1;
    };
  },
};

/** The state as GET /api/state returns it. */
export const rtsSnapshot = () => snapshot();

/** Drop the in-memory copy so the next call reads storage again (tests; a restart). */
export function rtsReload(): void {
  current = null;
}
