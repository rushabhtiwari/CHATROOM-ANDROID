/**
 * Live mailing state.
 *
 * The backend publishes a `mailing` frame on the console's existing SSE bus
 * after every mutation, so the hub behaves like the rest of the console: three
 * browser windows watching the same queue move together, and a triage decision
 * taken in one is visible in the others without a refresh.
 *
 * The frame carries the summary only. Anything larger (a page of mails, the
 * analytics) is refetched when it arrives — the dataset is tens of rows, and
 * refetching removes an entire class of client-side merge bugs.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { mailingApi } from './api';
import type { MailingSummary } from './types';

/*
 * One EventSource for the whole tab.
 *
 * Browsers cap concurrent connections per origin at around six on HTTP/1.1, and
 * the console already holds one for the claims ledger. Giving every hook its own
 * stream would spend that budget on duplicates of the same frames and starve
 * ordinary fetches, so subscribers share a single connection that is opened on
 * the first listener and closed when the last one goes away.
 */
type Listener = (summary: MailingSummary) => void;
type StatusListener = (connected: boolean) => void;

const listeners = new Set<Listener>();
const statusListeners = new Set<StatusListener>();
let shared: EventSource | null = null;
let lastSummary: MailingSummary | null = null;
// Replayed to late subscribers: `onopen` fires once per connection, so a hook
// that mounts after the stream is already up would otherwise sit on its initial
// `false` and report "reconnecting" forever.
let connected = false;

function open(): void {
  if (shared) return;

  shared = new EventSource('/api/events');

  shared.addEventListener('mailing', (event) => {
    try {
      lastSummary = JSON.parse((event as MessageEvent).data) as MailingSummary;
      connected = true;
      listeners.forEach((listener) => listener(lastSummary as MailingSummary));
      statusListeners.forEach((listener) => listener(true));
    } catch {
      /* a malformed frame is dropped; the next one supersedes it anyway */
    }
  });

  shared.onopen = () => {
    connected = true;
    statusListeners.forEach((listener) => listener(true));
  };
  // EventSource reconnects on its own; report the gap so the UI can say so.
  shared.onerror = () => {
    connected = false;
    statusListeners.forEach((listener) => listener(false));
  };
}

function close(): void {
  if (shared && listeners.size === 0 && statusListeners.size === 0) {
    shared.close();
    shared = null;
    connected = false;
  }
}

/** Subscribes to the `mailing` event and calls back on every push. */
export function subscribeToMailing(
  onSummary: Listener,
  onStatus?: StatusListener,
): () => void {
  listeners.add(onSummary);
  if (onStatus) statusListeners.add(onStatus);
  open();

  // A late subscriber should not have to wait for the next mutation to learn
  // what the others already know.
  if (lastSummary) onSummary(lastSummary);
  if (connected) onStatus?.(true);

  return () => {
    listeners.delete(onSummary);
    if (onStatus) statusListeners.delete(onStatus);
    close();
  };
}

export function useMailingSummary() {
  const [summary, setSummary] = useState<MailingSummary | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await mailingApi.summary());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the mailing service.');
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeToMailing(setSummary, setConnected);
  }, [refresh]);

  return { summary, connected, error, refresh };
}

/**
 * Refetches whenever the server says something changed.
 *
 * `version` on the summary increments on every mutation, so a page can depend
 * on "something moved" without knowing what — and without polling.
 */
export function useMailingVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => subscribeToMailing((summary) => setVersion(summary.version)), []);

  return version;
}

/**
 * A small async-data hook with the two properties these pages need: the first
 * load shows a skeleton, and a refetch triggered by an SSE push does not blank
 * the screen the operator is reading.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const seen = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!seen.current) setLoading(true);

    load()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        seen.current = true;
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Request failed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload: () => setNonce((value) => value + 1) };
}
