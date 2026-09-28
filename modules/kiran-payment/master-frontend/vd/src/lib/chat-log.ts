/**
 * Where the chat's operations go, and where they come back from.
 *
 * The store never changes the workspace directly. It appends an operation to
 * a log; the log gives it a place in one order and hands every entry — the
 * store's own and everyone else's — back through `subscribe`, and the store
 * folds them with `applyOp`. This interface is that log. There are two:
 *
 * - `createServerLog` (chat-server-log.ts) talks to the chat server, so every
 *   device sees the same workspace.
 * - `createLocalLog` below keeps everything on this device. It stands in for
 *   the server when there is none — in tests, and in a browser with no
 *   backend — and simulates one honestly: latency, occasional failure and an
 *   offline switch, so the outbox and its retries are real mechanics rather
 *   than labels.
 */

import type { OpEntry, Workspace } from "./chat-ops";
import type { UserId } from "./chat-types";
import { TransportError, type TransportConfig } from "./transport";

export interface AppendAck {
  seq: number;
  /** The log's receive time — the entry's authoritative timestamp. */
  ts: number;
  /** True when this opId was already in the log: a retry, not a new op. */
  duplicate: boolean;
}

export interface LogHandlers {
  /**
   * Replace the workspace outright: the log's base state folded with every
   * entry so far, up to `head`. A shared log calls this on connecting, so a
   * device's cached copy is superseded by the server's. The local log never
   * does — it has no state but what this device saved.
   */
  onReset?(workspace: Workspace, head: number, opIds: ReadonlySet<string>): void;
  /** One entry after the last reset, in order. May repeat after a reconnect; `seq` tells. */
  onEntry(entry: OpEntry): void;
  /** The backlog has been delivered; what the store holds is current. */
  onReady?(head: number): void;
  /** Whether the live connection is up. */
  onStatus?(connected: boolean): void;
}

export interface OpLog {
  /** True when this log is shared with other devices through a server. */
  readonly shared: boolean;
  /**
   * Append one entry. Rejects with a `TransportError` — `retriable` when a
   * later attempt might succeed (offline, a network error), not when the log
   * refused the op itself.
   */
  append(entry: OpEntry): Promise<AppendAck>;
  /**
   * Start syncing as `user`: private entries are theirs alone. The log owns
   * the connection — the initial reset, the live stream, and reconnecting
   * after a drop — and reports what it learns through `handlers`.
   */
  subscribe(user: UserId, handlers: LogHandlers): () => void;
  isOnline(): boolean;
  setOnline(online: boolean): void;
}

const DEFAULTS: TransportConfig = {
  latency: 220,
  // Low but non-zero: enough that the failed/retry path is exercised in normal
  // use instead of being dead code nobody ever sees.
  failureRate: 0.04,
  online: true,
};

/**
 * A log that lives on this device only.
 *
 * It keeps no entries itself: the store saves the folded workspace and its
 * outbox, which is everything a single device needs to resume, so it never
 * resets the store — the store carries on from what it restored.
 */
export function createLocalLog(overrides: Partial<TransportConfig> = {}): OpLog & {
  configure(patch: Partial<TransportConfig>): void;
} {
  const config: TransportConfig = { ...DEFAULTS, ...overrides };
  const ledger = new Map<string, AppendAck>();
  const listeners = new Set<LogHandlers>();
  let seq = 0;

  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  return {
    shared: false,
    configure: (patch) => Object.assign(config, patch),
    isOnline: () => config.online,
    setOnline: (online) => {
      config.online = online;
      for (const listener of listeners) listener.onStatus?.(online);
    },

    async append(entry) {
      const existing = ledger.get(entry.opId);
      if (existing) {
        await delay(config.latency / 4);
        return { ...existing, duplicate: true };
      }
      await delay(config.latency);
      if (!config.online) {
        throw new TransportError("You are offline. It will be sent automatically.", true);
      }
      if (Math.random() < config.failureRate) {
        throw new TransportError("Network hiccup while sending.", true);
      }
      seq += 1;
      const ack: AppendAck = { seq, ts: Date.now(), duplicate: false };
      ledger.set(entry.opId, ack);
      // The echo a server would send to every subscriber, this device included.
      const confirmed: OpEntry = { ...entry, seq, ts: ack.ts };
      queueMicrotask(() => {
        for (const listener of listeners) listener.onEntry(confirmed);
      });
      return ack;
    },

    subscribe(_user, handlers) {
      listeners.add(handlers);
      queueMicrotask(() => {
        handlers.onReady?.(seq);
        handlers.onStatus?.(config.online);
      });
      return () => listeners.delete(handlers);
    },
  };
}
