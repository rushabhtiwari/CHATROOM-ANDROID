/**
 * The PO pipeline client.
 *
 * Every call here is the console's. There is no customer-facing surface any more: the
 * removed `confirmApi` carried a one-use token to a page outside the company, and the two
 * gates that replaced it are both internal.
 *
 *   `approveAsAdmin`     gate 1 - acknowledges the customer and tasks the three teams.
 *   `releaseAsAccounts`  gate 2 - one PACT draft, every line item, one Save Draft, then
 *                        the proforma and the closing message.
 *
 * Neither can skip the other: the server refuses gate 2 for a job that has not been
 * through gate 1, and the state machine refuses both from anywhere else.
 *
 * The server's own `detail` string is what surfaces on failure. The backend writes its
 * refusals to be read, so replacing them with a friendlier message on this side would only
 * lose information.
 */

import type {
  PipelineBoardRow,
  PipelineSummary,
  PipelineView,
  RunResult,
} from './types';

export * from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const data = (await response.json().catch(() => ({}))) as { detail?: unknown };
  if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => (d as { msg?: string })?.msg ?? String(d)).join('; ')
          : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const pipelineApi = {
  summary: () => request<PipelineSummary>('/po-pipeline/summary'),
  board: () => request<PipelineBoardRow[]>('/po-pipeline'),
  view: (jobId: string) => request<PipelineView>(`/po-pipeline/${encodeURIComponent(jobId)}`),
  /** Gate 1. Acknowledges the customer and creates the three team tasks. */
  approveAsAdmin: (jobId: string, correctedData?: Record<string, unknown>) =>
    request<{ status: string; orderId?: string; autoReleased?: boolean }>(
      `/admin/mailing/jobs/${encodeURIComponent(jobId)}/approve`,
      { method: 'POST', body: JSON.stringify({ correctedData: correctedData ?? null }) },
    ),
  /** Gate 2. One PACT draft with every line item, then the proforma and closing message. */
  releaseAsAccounts: (jobId: string) =>
    request<{ status: string; documentNo?: string }>(
      `/admin/mailing/jobs/${encodeURIComponent(jobId)}/accounts-approve`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  /** The same as `releaseAsAccounts`, from the pipeline view. Idempotent: this is the
   *  retry after a PACT pause, and re-running a finished order sends nothing twice. */
  run: (jobId: string) =>
    request<RunResult>(`/po-pipeline/${encodeURIComponent(jobId)}/run`, { method: 'POST' }),
  tasks: (jobId: string) =>
    request<Array<{ id: string; team: string; status: string; body: string }>>(
      `/admin/mailing/tasks?jobId=${encodeURIComponent(jobId)}`,
    ),
};
