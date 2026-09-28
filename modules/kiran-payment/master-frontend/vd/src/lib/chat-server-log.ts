/**
 * The operation log, on the chat server.
 *
 * Every device that uses this sees the same workspace: ops are appended with
 * POST /api/chat/ops and everyone's arrive, in the server's order, over the
 * event stream at /api/chat/events. See `backend/app/routers/chat.py`.
 *
 * Paths are relative, like every other call the console makes. In a browser
 * the dev server proxies them; on a phone the app's startup redirects them to
 * the configured server (mobile/src/api/install.ts).
 */

import { foldOps, type OpEntry, type Workspace } from "./chat-ops";
import type { AppendAck, OpLog } from "./chat-log";
import { backoffDelay, TransportError } from "./transport";

interface WireEntry {
  seq: number;
  opId: string;
  actor: string;
  ts: number;
  op: OpEntry["op"];
}

const toEntry = (wire: WireEntry): OpEntry => ({
  opId: wire.opId,
  actor: wire.actor,
  ts: wire.ts,
  seq: wire.seq,
  op: wire.op,
});

/** The server's base holds the seed; everything else starts empty and is built by ops. */
function workspaceFrom(base: Pick<Workspace, "users" | "groups" | "rooms" | "messages">): Workspace {
  return {
    users: base.users,
    groups: base.groups,
    rooms: base.rooms,
    messages: base.messages,
    meetings: [],
    notifications: [],
    readState: {},
    saved: {},
    followedThreads: {},
  };
}

/**
 * Silence after which a stream is treated as dead: a little over two of the
 * server's 20-second heartbeats (backend/app/routers/chat.py).
 */
const STALE_AFTER_MS = 45_000;

export function createServerLog(): OpLog {
  let online = true;

  return {
    shared: true,
    isOnline: () => online,
    setOnline: (next) => {
      online = next;
    },

    async append(entry): Promise<AppendAck> {
      if (!online) {
        throw new TransportError("You are offline. It will be sent automatically.", true);
      }
      let response: Response;
      try {
        response = await fetch("/api/chat/ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The server stamps its own time; the entry's is only this device's guess.
          body: JSON.stringify({ opId: entry.opId, actor: entry.actor, op: entry.op }),
        });
      } catch {
        throw new TransportError("Could not reach the chat server.", true);
      }
      if (response.ok) return (await response.json()) as AppendAck;

      const detail = await response
        .json()
        .then((body: { detail?: unknown }) => (typeof body.detail === "string" ? body.detail : null))
        .catch(() => null);
      // A refusal (400, 403, 409) will be refused again: retrying cannot help.
      // A server error or a throttle might pass on a later attempt.
      const retriable = response.status >= 500 || response.status === 429;
      throw new TransportError(
        detail ?? `The chat server did not accept this (${response.status}).`,
        retriable,
      );
    },

    subscribe(user, handlers) {
      let closed = false;
      let source: EventSource | null = null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let watchdog: ReturnType<typeof setInterval> | undefined;
      let attempt = 0;
      const query = (since: number) => `since=${since}&user=${encodeURIComponent(user)}`;

      /**
       * After any failure, start over: reload the log from the beginning and
       * reset. Resuming the stream from the last seq would be cheaper, but a
       * full reload is also correct when the server itself was reset while
       * this device was away — and at this log's size it costs little.
       */
      const retry = () => {
        if (closed) return;
        handlers.onStatus?.(false);
        attempt += 1;
        timer = setTimeout(connect, backoffDelay(attempt, 1_000, 30_000));
      };

      /** Close the stream and its watchdog, then start over. */
      const drop = () => {
        if (watchdog) clearInterval(watchdog);
        watchdog = undefined;
        source?.close();
        source = null;
        retry();
      };

      const follow = (head: number) => {
        source = new EventSource(`/api/chat/events?${query(head)}`);
        let lastHeard = Date.now();
        const heard = () => {
          lastHeard = Date.now();
        };
        source.addEventListener("op", (event) => {
          heard();
          handlers.onEntry(toEntry(JSON.parse((event as MessageEvent).data) as WireEntry));
        });
        source.addEventListener("ready", () => {
          heard();
          attempt = 0;
          handlers.onStatus?.(true);
        });
        source.addEventListener("ping", heard);
        source.onerror = drop;

        // A connection can die without an error ever reaching this page: the
        // dev proxy, for one, keeps the browser's side open after the server
        // has gone, and a phone changing networks can strand a socket the
        // same way. The server heartbeats every 20s, so silence well past
        // that means the stream is dead even though it still looks open.
        watchdog = setInterval(() => {
          if (Date.now() - lastHeard > STALE_AFTER_MS) drop();
        }, 5_000);
      };

      async function connect() {
        if (closed) return;
        try {
          const response = await fetch(`/api/chat/log?${query(0)}`);
          if (!response.ok) throw new Error(`log: ${response.status}`);
          const body = (await response.json()) as {
            base: Pick<Workspace, "users" | "groups" | "rooms" | "messages">;
            ops: WireEntry[];
            head: number;
          };
          if (closed) return;
          const entries = body.ops.map(toEntry);
          handlers.onReset?.(
            foldOps(workspaceFrom(body.base), entries),
            body.head,
            new Set(entries.map((entry) => entry.opId)),
          );
          follow(body.head);
        } catch {
          retry();
        }
      }

      void connect();
      return () => {
        closed = true;
        if (timer) clearTimeout(timer);
        if (watchdog) clearInterval(watchdog);
        source?.close();
      };
    },
  };
}
