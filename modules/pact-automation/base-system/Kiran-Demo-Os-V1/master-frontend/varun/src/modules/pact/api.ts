import type { PactStatus, PactEntry } from './types';

export * from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/pact${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) throw new Error(data.detail ?? "PACT Automation request failed");
  return data as T;
}

export const pactApi = {
  status: () => request<PactStatus>("/status"),
  entries: () => request<PactEntry[]>("/entries"),
  add: (record: Record<string, unknown>, source: string = "kiranos-chat") =>
    request<PactEntry>("/entries", {
      method: "POST",
      body: JSON.stringify({ record, source }),
    }),
  approve: (id: number) => request<PactEntry>(`/entries/${id}/approve`, { method: "POST" }),
  reject: (id: number) => request<PactEntry>(`/entries/${id}/reject`, { method: "POST" }),
  log: (id: number) => request<{ id: number; log: string }>(`/entries/${id}/log`),
};