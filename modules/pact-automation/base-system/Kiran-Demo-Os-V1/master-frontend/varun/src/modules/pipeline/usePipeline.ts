import { useCallback, useEffect, useRef, useState } from 'react';
import { pipelineApi } from './api';
import type { PipelineBoardRow, PipelineSummary, PipelineView } from './types';

/**
 * The automation section's data.
 *
 * It rides the console's existing SSE stream rather than opening one of its own: every
 * mutation in the backend publishes a `mailing` frame, and the pipeline's records change
 * on exactly those mutations. So one subscription keeps the board, the detail view and
 * the sidebar badge in step, and three browser windows update together during a demo —
 * which is the whole reason the stream exists.
 *
 * The frame carries no pipeline data. It is a signal to re-read, so the client can never
 * drift from the server: it can only be current or briefly stale.
 */

type Listener = () => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;

function ensureStream(): void {
  if (source) return;
  source = new EventSource('/api/events');
  const wake = () => listeners.forEach((listener) => listener());
  source.addEventListener('mailing', wake);
  source.addEventListener('message', wake);
  source.onerror = () => {
    // EventSource reconnects on its own. Tearing it down here would turn a blip into a
    // dead stream for the rest of the session.
  };
}

function subscribe(listener: Listener): () => void {
  ensureStream();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      source?.close();
      source = null;
    }
  };
}

/** The headline figures and KPAC's own state. */
export function usePipelineSummary() {
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await pipelineApi.summary());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);

  // KPAC's own liveness is not a database record, so no SSE frame announces it changing.
  // A slow poll is the honest way to notice the robot going away mid-demo.
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { summary, error, refresh };
}

/** Every order that has reached the pipeline. */
export function usePipelineBoard() {
  const [rows, setRows] = useState<PipelineBoardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setRows(await pipelineApi.board());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);

  return { rows, error, loading, refresh };
}

/** One order, in full. */
export function usePipelineView(jobId: string | null) {
  const [view, setView] = useState<PipelineView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The id the in-flight request was for, so a fast click-through cannot land an older
  // response on top of a newer one.
  const wanted = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) {
      setView(null);
      return;
    }
    wanted.current = jobId;
    setLoading(true);
    try {
      const result = await pipelineApi.view(jobId);
      if (wanted.current === jobId) {
        setView(result);
        setError(null);
      }
    } catch (cause) {
      if (wanted.current === jobId) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (wanted.current === jobId) setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);

  return { view, error, loading, refresh };
}
