/**
 * The call server, from the phone's side: one stream in, one endpoint out,
 * and the call list. See `backend/app/routers/calls.py`.
 *
 * Paths are relative, like every other request the app makes. In a browser the
 * dev server proxies them; on a phone the app's startup sends them to the
 * configured server (src/api/install.ts).
 */
import { backoffDelay, newId } from '@/lib/transport';
import { SignalError } from '~/calls/engine';
import type { CallRecord, IncomingSignal } from '~/calls/types';

/** This app session, as the server tells one of a person's phones from another. */
export const DEVICE_ID = newId('dev-');

/**
 * Silence after which the stream is treated as dead: a little over two of the
 * server's 20-second heartbeats, as for the chat stream.
 */
const STALE_AFTER_MS = 45_000;

async function detailOf(response: Response): Promise<string | null> {
  return response
    .json()
    .then((body: { detail?: unknown }) => (typeof body.detail === 'string' ? body.detail : null))
    .catch(() => null);
}

export async function sendSignal(signal: IncomingSignal): Promise<{ delivered: number }> {
  let response: Response;
  try {
    response = await fetch('/api/calls/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signal),
    });
  } catch {
    throw new SignalError('Could not reach the call server.', null);
  }
  if (!response.ok) {
    const detail = await detailOf(response);
    throw new SignalError(
      detail ?? `The call server refused this (${response.status}).`,
      response.status,
    );
  }
  const body = (await response.json().catch(() => ({}))) as { delivered?: unknown };
  return { delivered: typeof body.delivered === 'number' ? body.delivered : 0 };
}

export async function fetchHistory(user: string): Promise<CallRecord[]> {
  const response = await fetch(`/api/calls/history?user=${encodeURIComponent(user)}`);
  if (!response.ok) throw new Error(`The call list did not load (${response.status}).`);
  const body = (await response.json()) as { calls?: unknown };
  return Array.isArray(body.calls) ? (body.calls as CallRecord[]) : [];
}

export interface StreamHandlers {
  /** Connected, with the servers a call should use to find the other phone. */
  onReady(iceServers: RTCIceServer[]): void;
  onSignal(signal: IncomingSignal): void;
  /** A call in this person's list started, was answered or ended. */
  onRecord(record: CallRecord): void;
  onStatus(connected: boolean): void;
}

function parse(event: Event): unknown {
  try {
    return JSON.parse((event as MessageEvent<string>).data);
  } catch {
    return null;
  }
}

/**
 * Listen for `user`'s calls on this device until the returned function is
 * called. A dropped or silent stream is reopened with backoff, and the server
 * re-sends any invitation still ringing when it comes back.
 */
export function openCallStream(user: string, handlers: StreamHandlers): () => void {
  const url = `/api/calls/events?user=${encodeURIComponent(user)}&device=${encodeURIComponent(DEVICE_ID)}`;
  let closed = false;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let attempt = 0;

  const retry = () => {
    if (closed) return;
    handlers.onStatus(false);
    attempt += 1;
    timer = setTimeout(connect, backoffDelay(attempt, 1_000, 15_000));
  };

  const drop = () => {
    if (watchdog) clearInterval(watchdog);
    watchdog = undefined;
    source?.close();
    source = null;
    retry();
  };

  function connect() {
    if (closed) return;
    const stream = new EventSource(url);
    source = stream;
    let lastHeard = Date.now();
    const heard = () => {
      lastHeard = Date.now();
    };

    stream.addEventListener('ready', (event) => {
      heard();
      attempt = 0;
      const body = parse(event) as { iceServers?: unknown } | null;
      handlers.onReady(Array.isArray(body?.iceServers) ? (body.iceServers as RTCIceServer[]) : []);
      handlers.onStatus(true);
    });
    stream.addEventListener('signal', (event) => {
      heard();
      const signal = parse(event);
      if (signal) handlers.onSignal(signal as IncomingSignal);
    });
    stream.addEventListener('call', (event) => {
      heard();
      const record = parse(event);
      if (record) handlers.onRecord(record as CallRecord);
    });
    stream.addEventListener('ping', heard);
    stream.onerror = drop;

    // A phone changing networks can strand a stream that still looks open.
    // The server heartbeats every 20 seconds; silence well past that is death.
    watchdog = setInterval(() => {
      if (Date.now() - lastHeard > STALE_AFTER_MS) drop();
    }, 5_000);
  }

  connect();
  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    if (watchdog) clearInterval(watchdog);
    source?.close();
    source = null;
  };
}
