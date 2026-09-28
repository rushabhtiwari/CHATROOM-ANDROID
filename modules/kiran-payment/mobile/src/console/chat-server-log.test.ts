import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServerLog } from '@/lib/chat-server-log';
import { TransportError } from '@/lib/transport';
import type { LogHandlers } from '@/lib/chat-log';
import { SEED_GROUPS, SEED_MESSAGES, SEED_ROOMS, SEED_USERS } from '@/lib/chat-seed';

/**
 * The client for the chat server's log, against stand-ins for `fetch` and
 * `EventSource` that answer as the real server does (backend/app/routers/chat.py).
 */

class FakeEventSource {
  static opened: FakeEventSource[] = [];
  listeners = new Map<string, (event: MessageEvent) => void>();
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.opened.push(this);
  }
  addEventListener(kind: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(kind, listener);
  }
  emit(kind: string, data: unknown) {
    this.listeners.get(kind)?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  close() {
    this.closed = true;
  }
}

const base = { users: SEED_USERS, groups: SEED_GROUPS, rooms: SEED_ROOMS, messages: SEED_MESSAGES };
const wire = (seq: number, id: string) => ({
  seq,
  opId: `op-${seq}`,
  actor: 'u2',
  ts: 9_000 + seq,
  op: { type: 'message.send', roomId: 'r1', message: { id, content: `server ${seq}` } },
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeEventSource.opened = [];
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  vi.useRealTimers();
});

const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));

function handlers() {
  const calls = { resets: [] as unknown[], entries: [] as unknown[], status: [] as boolean[] };
  const h: LogHandlers = {
    onReset: (workspace, head, opIds) => calls.resets.push({ workspace, head, opIds }),
    onEntry: (entry) => calls.entries.push(entry),
    onStatus: (connected) => calls.status.push(connected),
  };
  return { h, calls };
}

describe('subscribe', () => {
  it("resets to the server's workspace, then follows the stream from its head", async () => {
    fetchMock.mockReturnValueOnce(json({ base, ops: [wire(1, 'a'), wire(2, 'b')], head: 2 }));
    const { h, calls } = handlers();
    createServerLog().subscribe('u1', h);

    await vi.waitFor(() => expect(calls.resets).toHaveLength(1));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/chat/log?since=0&user=u1');
    const reset = calls.resets[0] as {
      workspace: { messages: { id: string }[] };
      head: number;
      opIds: Set<string>;
    };
    // The ops are folded onto the base before the store sees it.
    expect(reset.workspace.messages.map((m) => m.id).slice(-2)).toEqual(['a', 'b']);
    expect(reset.head).toBe(2);
    expect([...reset.opIds]).toEqual(['op-1', 'op-2']);
    expect(FakeEventSource.opened[0]!.url).toBe('/api/chat/events?since=2&user=u1');
  });

  it('passes on each live op and says when it is caught up', async () => {
    fetchMock.mockReturnValueOnce(json({ base, ops: [], head: 0 }));
    const { h, calls } = handlers();
    createServerLog().subscribe('u1', h);
    await vi.waitFor(() => expect(FakeEventSource.opened).toHaveLength(1));

    const stream = FakeEventSource.opened[0]!;
    stream.emit('ready', { head: 0 });
    stream.emit('op', wire(1, 'live'));
    expect(calls.status).toEqual([true]);
    expect(calls.entries).toEqual([
      { opId: 'op-1', actor: 'u2', ts: 9_001, seq: 1, op: wire(1, 'live').op },
    ]);
  });

  it('after a drop, reports offline and starts over from a fresh reset', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fetchMock
      .mockReturnValueOnce(json({ base, ops: [], head: 0 }))
      .mockReturnValueOnce(json({ base, ops: [wire(1, 'missed')], head: 1 }));
    const { h, calls } = handlers();
    createServerLog().subscribe('u1', h);
    await vi.waitFor(() => expect(FakeEventSource.opened).toHaveLength(1));

    FakeEventSource.opened[0]!.onerror!();
    expect(FakeEventSource.opened[0]!.closed).toBe(true);
    expect(calls.status).toEqual([false]);

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(calls.resets).toHaveLength(2));
    expect(FakeEventSource.opened[1]!.url).toBe('/api/chat/events?since=1&user=u1');
  });

  it('keeps trying when the server is not there at all', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fetchMock
      .mockReturnValueOnce(Promise.reject(new TypeError('connection refused')))
      .mockReturnValueOnce(json({ base, ops: [], head: 0 }));
    const { h, calls } = handlers();
    createServerLog().subscribe('u1', h);
    await vi.waitFor(() => expect(calls.status).toEqual([false]));
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(calls.resets).toHaveLength(1));
  });

  it('treats a silent stream as dead: drops it and starts over', async () => {
    // The server heartbeats every 20s. A connection can die without an error
    // reaching the page — a proxy keeping the browser's side open after the
    // server has gone — so silence is the only signal there will be.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    fetchMock.mockImplementation(() => json({ base, ops: [], head: 0 }));
    const { h, calls } = handlers();
    createServerLog().subscribe('u1', h);
    await vi.waitFor(() => expect(FakeEventSource.opened).toHaveLength(1));
    FakeEventSource.opened[0]!.emit('ready', { head: 0 });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.opened[0]!.closed).toBe(true);
    expect(calls.status).toContain(false);
    await vi.waitFor(() => expect(calls.resets.length).toBeGreaterThanOrEqual(2));
  });

  it('leaves a quiet stream alone while its heartbeats arrive', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    fetchMock.mockImplementation(() => json({ base, ops: [], head: 0 }));
    const { h } = handlers();
    createServerLog().subscribe('u1', h);
    await vi.waitFor(() => expect(FakeEventSource.opened).toHaveLength(1));
    const stream = FakeEventSource.opened[0]!;
    stream.emit('ready', { head: 0 });
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
      stream.emit('ping', {});
    }
    expect(stream.closed).toBe(false);
    expect(FakeEventSource.opened).toHaveLength(1);
  });

  it('stops everything when unsubscribed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fetchMock.mockImplementation(() => json({ base, ops: [], head: 0 }));
    const { h } = handlers();
    const stop = createServerLog().subscribe('u1', h);
    await vi.waitFor(() => expect(FakeEventSource.opened).toHaveLength(1));
    FakeEventSource.opened[0]!.onerror!();
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('append', () => {
  const entry = { opId: 'op-x', actor: 'u1', ts: 1, op: wire(1, 'x').op as never };

  it("posts the op and returns the server's ack", async () => {
    fetchMock.mockReturnValueOnce(json({ seq: 5, ts: 777, duplicate: false }));
    expect(await createServerLog().append(entry)).toEqual({ seq: 5, ts: 777, duplicate: false });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/chat/ops');
    // The device's own time does not travel: the server stamps its own.
    expect(JSON.parse(init.body)).toEqual({ opId: 'op-x', actor: 'u1', op: entry.op });
  });

  it.each([
    [400, false],
    [403, false],
    [409, false],
    [429, true],
    [500, true],
    [503, true],
  ])('treats a %i as retriable: %s', async (status, retriable) => {
    fetchMock.mockReturnValueOnce(json({ detail: `said ${status}` }, status));
    const error = await createServerLog()
      .append(entry)
      .catch((e) => e);
    expect(error).toBeInstanceOf(TransportError);
    expect(error.retriable).toBe(retriable);
    expect(error.message).toBe(`said ${status}`);
  });

  it('treats an unreachable server as retriable', async () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
    const error = await createServerLog()
      .append(entry)
      .catch((e) => e);
    expect(error.retriable).toBe(true);
  });

  it('does not touch the network while offline', async () => {
    const log = createServerLog();
    log.setOnline(false);
    const error = await log.append(entry).catch((e) => e);
    expect(error.retriable).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
