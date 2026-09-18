/**
 * The Mailing Hub client.
 *
 * Every path here is one of WORKING.md §5's, and the server's own `detail`
 * string is what surfaces on failure — the backend writes its refusals to be
 * read by an operator ("A decision note is required to discard a message"), so
 * inventing a friendlier message on this side would only lose information.
 */

import type {
  Analytics,
  Mailbox,
  DirectSendResult,
  JobRow,
  MailDetail,
  MailingSummary,
  MailsPage,
  OnHoldPage,
  ResolveResult,
  TriageAction,
} from './types';

export * from './types';

const BASE = '/api/admin/mailing';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? (init?.headers ?? {})
        : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const data = (await response.json().catch(() => ({}))) as { detail?: unknown };
  if (!response.ok) {
    // FastAPI sends a string for our own refusals and an array for validation
    // errors; both should reach the operator as a sentence.
    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((item: { msg?: string }) => item?.msg ?? String(item)).join('; ')
          : 'The mailing service refused that request.';
    throw new Error(message);
  }
  return data as T;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export interface MailFilters {
  status?: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  domain?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface DirectSendInput {
  fromAddress: string;
  toAddress: string;
  subject: string;
  bodyText: string;
  actor: string;
  attachments: File[];
}

export const mailingApi = {
  summary: () => request<MailingSummary>('/summary'),

  mails: (filters: MailFilters = {}) => request<MailsPage>(`/mails${query({ ...filters })}`),

  mail: (id: string) => request<MailDetail>(`/mails/${encodeURIComponent(id)}`),

  onHold: (filters: { reason?: string; q?: string } = {}) =>
    request<OnHoldPage>(`/on-hold${query({ ...filters })}`),

  onHoldItem: (jobId: string) =>
    request<{ job: JobRow; email: MailDetail['email'] | null; domains: OnHoldPage['domains'] }>(
      `/on-hold/${encodeURIComponent(jobId)}`,
    ),

  resolve: (
    jobId: string,
    action: TriageAction,
    payload: { actor: string; correctedData?: Record<string, unknown>; reason?: string } = {
      actor: 'operator',
    },
  ) =>
    request<ResolveResult>(`/on-hold/${encodeURIComponent(jobId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
    }),

  /**
   * Multipart rather than JSON: the attachment is the point of the injector, so
   * the payload has to be able to carry a real PDF.
   */
  directSend: (input: DirectSendInput) => {
    const form = new FormData();
    form.set('fromAddress', input.fromAddress);
    form.set('toAddress', input.toAddress);
    form.set('subject', input.subject);
    form.set('bodyText', input.bodyText);
    form.set('actor', input.actor);
    input.attachments.forEach((file) => form.append('attachments', file, file.name));
    return request<DirectSendResult>('/direct-send', { method: 'POST', body: form });
  },

  analytics: (days = 14) => request<Analytics>(`/analytics${query({ days })}`),

  monitor: () =>
    request<{
      monitor: MailingSummary['monitor'];
      mailbox: Mailbox | null;
      connected: boolean;
      audit: unknown[];
    }>('/monitor'),

  /**
   * Connect a mailbox. The password travels once, on this request, and is
   * never returned by anything the client can read afterwards.
   */
  connect: (input: {
    address: string;
    password: string;
    host?: string;
    port?: number;
    mailbox?: string;
    actor?: string;
  }) =>
    request<{ monitor: MailingSummary['monitor']; mailbox: Mailbox; messageCount: number }>(
      '/connection',
      { method: 'POST', body: JSON.stringify({ actor: 'operator', ...input }) },
    ),

  disconnect: (actor = 'operator') =>
    request<{ monitor: MailingSummary['monitor'] }>(`/connection${query({ actor })}`, {
      method: 'DELETE',
    }),

  poll: (actor = 'operator') =>
    request<{ monitor: MailingSummary['monitor']; newMessages: number }>('/monitor/poll', {
      method: 'POST',
      body: JSON.stringify({ actor }),
    }),

  setPaused: (paused: boolean, actor = 'operator') =>
    request<{ monitor: MailingSummary['monitor'] }>('/monitor/pause', {
      method: 'POST',
      body: JSON.stringify({ paused, actor }),
    }),

  whitelist: (input: { domain: string; companyName: string; companyCode?: string; actor?: string }) =>
    request<ResolveResult>('/domains', {
      method: 'POST',
      body: JSON.stringify({ actor: 'operator', companyCode: '', ...input }),
    }),
};
