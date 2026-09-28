// The one place the app talks to the server.
//
// Vite proxies /api and /uploads to the Python backend on :3001, so these are
// same-origin paths in development and in a built bundle served behind the API.

import type {
  Category,
  Employee,
  Notification,
  Payout,
  ReceiptRequest,
  RequestStatus,
  Role,
} from './types';
import type { CategorySpend, DepartmentUtilisation, MonthlySpend, PolicyCap } from './types';

const BASE = '/api';

export interface Analytics {
  monthlySpend: MonthlySpend[];
  departmentUtilisation: DepartmentUtilisation[];
  policyCaps: PolicyCap[];
  categorySpend: CategorySpend[];
}

/** The whole world in one envelope — what /api/state returns and SSE pushes. */
export interface AppSnapshot {
  version: number;
  currentEmployeeId: string;
  employees: Employee[];
  requests: ReceiptRequest[];
  payouts: Payout[];
  notifications: Notification[];
  analytics: Analytics;
}

/** Thrown with the server's own message, which is written to be shown to a user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers:
        init?.body instanceof FormData
          ? init?.headers
          : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running on :3001?', 0);
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail[0]?.msg ?? detail;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export const getState = () => request<AppSnapshot>('/state');

export interface ReceiptContext {
  utr: string;
  payouts: Payout[];
  employee: Employee | null;
  requests: ReceiptRequest[];
  total: number;
  method: Payout['method'];
  settledOn?: string;
}

export const getReceiptContext = (utr: string) =>
  request<ReceiptContext>(`/receipt-context/${encodeURIComponent(utr)}`);

/* -------------------------------------------------------------------------- */
/* Claims                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateRequestInput {
  employeeId: string;
  title: string;
  category: Category;
  amount: number;
  justification: string;
  travelDates?: { from: string; to: string };
  files: { fileName: string; sizeKb: number }[];
  receiptIds?: string[];
  status: 'DRAFT' | 'SUBMITTED';
  actor: string;
  extraction?: Extraction | null;
}

export const createRequest = (input: CreateRequestInput) =>
  request<ReceiptRequest>('/requests', { method: 'POST', body: JSON.stringify(input) });

export const transitionRequest = (
  id: string,
  status: RequestStatus,
  actor: string,
  role: Role,
  comment?: string,
) =>
  request<ReceiptRequest>(`/requests/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify({ status, actor, role, comment }),
  });

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

export interface DisburseResult {
  utr: string;
  method: Payout['method'];
  employeeId: string;
  total: number;
  requestIds: string[];
  payoutId: string;
  at: string;
}

export const disburse = (employeeId: string, method: Payout['method'], actor: string) =>
  request<DisburseResult>('/disburse', {
    method: 'POST',
    body: JSON.stringify({ employeeId, method, actor }),
  });

export const queuePayouts = (payoutIds: string[], actor: string) =>
  request<Payout[]>('/payouts/queue', {
    method: 'POST',
    body: JSON.stringify({ payoutIds, actor }),
  });

export const retryPayout = (payoutId: string) =>
  request<Payout>(`/payouts/${payoutId}/retry`, { method: 'POST' });

export const verifyBank = (employeeId: string) =>
  request<Employee>(`/employees/${employeeId}/verify-bank`, { method: 'POST' });

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export const markNotificationRead = (id: string) =>
  request<void>(`/notifications/${id}/read`, { method: 'POST' });

export const markAllNotificationsRead = () =>
  request<void>('/notifications/read-all', { method: 'POST' });

export const pushNotification = (n: {
  toRole: Role;
  toEmployeeId?: string;
  title: string;
  body: string;
  requestId?: string;
}) => request<Notification>('/notifications', { method: 'POST', body: JSON.stringify(n) });

export const resetDemo = () => request<AppSnapshot>('/demo/reset', { method: 'POST' });

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

/** What the agent read off the receipt, before the employee confirmed it. */
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
  confidence: Record<string, number>;
  overallConfidence: number;
  policyFindings: PolicyFinding[];
  notes?: string | null;
  source: 'claude' | 'openai' | 'sample' | 'heuristic';
  model?: string | null;
  receiptIds: string[];
}

export interface UploadedReceipt {
  id: string;
  fileName: string;
  sizeKb: number;
  uploadedOn: string;
  url?: string;
  mimeType?: string;
}

export interface ExtractResult {
  receipts: UploadedReceipt[];
  extraction: Extraction;
}

/** Uploads receipts and returns what the model read. One round trip by design. */
export async function extractReceipts(
  files: File[],
  options: { useSample?: boolean } = {},
): Promise<ExtractResult> {
  const form = new FormData();
  for (const file of files) form.append('files', file, file.name);
  if (options.useSample) form.append('use_sample', 'true');

  return request<ExtractResult>('/receipts/extract', { method: 'POST', body: form });
}

export const extractionStatus = () =>
  request<{ configured: boolean; model: string | null }>('/receipts/status');

/* -------------------------------------------------------------------------- */
/* Live sync                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Subscribes to server-sent state. The server pushes a full snapshot on every
 * mutation, so a tab can never drift out of sync — it can only be current.
 * This is what makes the employee, HR and Accounts windows move together.
 */
export function subscribeToState(
  onState: (snapshot: AppSnapshot) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  const source = new EventSource(`${BASE}/events`);

  source.addEventListener('state', (event) => {
    try {
      onState(JSON.parse((event as MessageEvent).data) as AppSnapshot);
      onStatus?.(true);
    } catch {
      /* a malformed frame is dropped; the next one supersedes it anyway */
    }
  });

  source.onopen = () => onStatus?.(true);
  // EventSource reconnects on its own; report the gap so the UI can say so.
  source.onerror = () => onStatus?.(false);

  return () => source.close();
}
