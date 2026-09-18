/**
 * UI state for the floating agent dock.
 *
 * Deliberately separate from `chat-store`: nothing here is workspace data. The
 * conversation itself already lives in `aiMessages` and is persisted with the
 * rest of the snapshot — this only remembers whether the window is open and
 * how big the user made it, under its own storage key so a chat-schema
 * migration can never take the panel's geometry with it.
 *
 * It also carries the two hand-offs between sibling components that would
 * otherwise need prop-drilling through the whole workspace: the thread's
 * "Ask AI" selection into the dock, and a reply from the dock back into the
 * main composer.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RoomId } from "./chat-types";

const STORAGE_KEY = "nexus-agent-dock-v1";

export const DOCK_MIN_WIDTH = 320;
export const DOCK_MAX_WIDTH = 720;
export const DOCK_MIN_HEIGHT = 360;

export interface DockSize {
  width: number;
  height: number;
}

/** The spec'd default: roughly 380×540, anchored bottom-right. */
const DEFAULT_SIZE: DockSize = { width: 380, height: 540 };

/** One-shot text handed to the main composer. `nonce` makes repeats distinct. */
export interface ComposerHandoff {
  roomId: RoomId;
  text: string;
  nonce: number;
}

interface AgentDockValue {
  open: boolean;
  /**
   * The request that started a scheduling conversation, or null.
   *
   * It lives here rather than in the dock so that the composer's
   * `@agent schedule a meeting` and the dock's own input reach the same
   * conversation. There is one assistant; there should be one place it
   * schedules from.
   */
  meetingPrompt: string | null;
  startMeeting: (prompt: string) => void;
  clearMeeting: () => void;
  /** Opens the dock, optionally seeding the input (selection → ask). */
  openDock: (prefill?: string) => void;
  /** Collapses to the bubble. `clear` also drops the unsent input. */
  closeDock: (clear?: boolean) => void;
  toggleDock: () => void;
  size: DockSize;
  setSize: (size: DockSize) => void;
  /** Text to seed the dock input with, consumed once by the dock. */
  prefill: string | null;
  clearPrefill: () => void;
  composerHandoff: ComposerHandoff | null;
  sendToComposer: (roomId: RoomId, text: string) => void;
  clearComposerHandoff: () => void;
}

interface PersistedDock {
  open: boolean;
  size: DockSize;
}

const AgentDockContext = createContext<AgentDockValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseSaved(raw: string | null): PersistedDock | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    const size = record["size"] as Record<string, unknown> | undefined;
    const width = Number(size?.["width"]);
    const height = Number(size?.["height"]);
    return {
      open: record["open"] === true,
      size: {
        width: Number.isFinite(width)
          ? clamp(width, DOCK_MIN_WIDTH, DOCK_MAX_WIDTH)
          : DEFAULT_SIZE.width,
        height: Number.isFinite(height) ? Math.max(height, DOCK_MIN_HEIGHT) : DEFAULT_SIZE.height,
      },
    };
  } catch {
    return null;
  }
}

export function AgentDockProvider({ children }: { children: ReactNode }) {
  // Collapsed and default-sized until the saved value is read: this renders on
  // the server too, and guessing would mean a visible jump on hydration.
  const [open, setOpen] = useState(false);
  const [size, setSizeState] = useState<DockSize>(DEFAULT_SIZE);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [composerHandoff, setComposerHandoff] = useState<ComposerHandoff | null>(null);
  const [meetingPrompt, setMeetingPrompt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = parseSaved(window.localStorage.getItem(STORAGE_KEY));
    if (saved) {
      setOpen(saved.open);
      setSizeState(saved.size);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, size }));
    } catch {
      // Geometry is a convenience; a full or blocked store must not break the
      // dock, and the storage banner already reports the real problem.
    }
  }, [ready, open, size]);

  const openDock = useCallback((seed?: string) => {
    if (seed !== undefined) setPrefill(seed);
    setOpen(true);
  }, []);

  const closeDock = useCallback((clear = false) => {
    setOpen(false);
    if (clear) setPrefill("");
  }, []);

  const toggleDock = useCallback(() => setOpen((current) => !current), []);
  const clearPrefill = useCallback(() => setPrefill(null), []);

  const setSize = useCallback((next: DockSize) => {
    setSizeState({
      width: clamp(next.width, DOCK_MIN_WIDTH, DOCK_MAX_WIDTH),
      height: Math.max(next.height, DOCK_MIN_HEIGHT),
    });
  }, []);

  const startMeeting = useCallback((prompt: string) => {
    setMeetingPrompt(prompt);
    setOpen(true);
  }, []);

  const clearMeeting = useCallback(() => setMeetingPrompt(null), []);

  const sendToComposer = useCallback((roomId: RoomId, text: string) => {
    setComposerHandoff({ roomId, text, nonce: Date.now() });
  }, []);

  const clearComposerHandoff = useCallback(() => setComposerHandoff(null), []);

  const value = useMemo<AgentDockValue>(
    () => ({
      open,
      meetingPrompt,
      startMeeting,
      clearMeeting,
      openDock,
      closeDock,
      toggleDock,
      size,
      setSize,
      prefill,
      clearPrefill,
      composerHandoff,
      sendToComposer,
      clearComposerHandoff,
    }),
    [
      open,
      meetingPrompt,
      startMeeting,
      clearMeeting,
      openDock,
      closeDock,
      toggleDock,
      size,
      setSize,
      prefill,
      clearPrefill,
      composerHandoff,
      sendToComposer,
      clearComposerHandoff,
    ],
  );

  return <AgentDockContext.Provider value={value}>{children}</AgentDockContext.Provider>;
}

export function useAgentDock() {
  const ctx = useContext(AgentDockContext);
  if (!ctx) throw new Error("useAgentDock must be used inside AgentDockProvider");
  return ctx;
}
