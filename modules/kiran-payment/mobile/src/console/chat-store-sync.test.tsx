import { useEffect, type ReactNode } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatProvider, useChat } from '@/lib/chat-store';
import type { AppendAck, LogHandlers, OpLog } from '@/lib/chat-log';
import type { OpEntry, Workspace } from '@/lib/chat-ops';
import { TransportError } from '@/lib/transport';
import { STORAGE_KEY } from '@/lib/chat-persistence';

/**
 * The store's side of the operation log: optimistic changes, confirmation,
 * retries, resets and the outbox. Driven through a log the test controls by
 * hand, so each step — accepted, echoed, refused — happens exactly when the
 * test says.
 */

class FakeLog implements OpLog {
  readonly shared = true;
  appended: OpEntry[] = [];
  handlers: LogHandlers | null = null;
  subscribedAs: string[] = [];
  private seq = 0;
  private replies: Array<(entry: OpEntry) => Promise<AppendAck>> = [];
  private online = true;

  /** How the next append answers. Default: accept, then echo. */
  next(reply: (entry: OpEntry) => Promise<AppendAck>) {
    this.replies.push(reply);
  }

  append(entry: OpEntry): Promise<AppendAck> {
    this.appended.push(entry);
    const reply = this.replies.shift();
    if (reply) return reply(entry);
    return this.accept(entry);
  }

  accept(entry: OpEntry, echo = true): Promise<AppendAck> {
    this.seq += 1;
    const ack = { seq: this.seq, ts: 5_000_000 + this.seq, duplicate: false };
    if (echo) this.echo({ ...entry, seq: ack.seq, ts: ack.ts });
    return Promise.resolve(ack);
  }

  echo(entry: OpEntry) {
    queueMicrotask(() => this.handlers?.onEntry(entry));
  }

  subscribe(user: string, handlers: LogHandlers) {
    this.subscribedAs.push(user);
    this.handlers = handlers;
    return () => {
      if (this.handlers === handlers) this.handlers = null;
    };
  }

  isOnline() {
    return this.online;
  }

  setOnline(online: boolean) {
    this.online = online;
  }
}

type Chat = ReturnType<typeof useChat>;

/** Mount the real store over `log`, and hand back its live context. */
function mount(log: OpLog) {
  const ref: { current: Chat | null } = { current: null };
  function Probe() {
    const chat = useChat();
    useEffect(() => {
      ref.current = chat;
    });
    return null;
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ChatProvider log={log}>{children}</ChatProvider>
  );
  const view = render(<Probe />, { wrapper });
  const chat = () => ref.current!;
  return { view, chat };
}

const lastMessage = (chat: Chat) => chat.messages.at(-1)!;

describe('the store over a log', () => {
  it('shows a message at once, then settles it with the log time', async () => {
    const log = new FakeLog();
    let release!: () => void;
    log.next((entry) => new Promise((resolve) => (release = () => resolve(log.accept(entry)))));
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));

    act(() => chat().sendMessage('r1', 'optimistic'));
    expect(lastMessage(chat())).toMatchObject({ content: 'optimistic', delivery: 'sending' });
    expect(log.appended).toHaveLength(1);

    await act(async () => release());
    await waitFor(() => expect(lastMessage(chat()).delivery).toBe('delivered'));
    // The log's receive time is the timestamp authority.
    expect(lastMessage(chat()).timestamp).toBe(5_000_001);
  });

  it('retries a failed send under the same opId, so it cannot land twice', async () => {
    const log = new FakeLog();
    log.next(() => Promise.reject(new TransportError('refused for now', false)));
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));

    act(() => chat().sendMessage('r1', 'try again'));
    await waitFor(() => expect(lastMessage(chat()).delivery).toBe('failed'));
    expect(lastMessage(chat()).failureReason).toBe('refused for now');

    act(() => chat().retryMessage(lastMessage(chat()).id));
    await waitFor(() => expect(lastMessage(chat()).delivery).toBe('delivered'));
    expect(log.appended).toHaveLength(2);
    expect(log.appended[1]!.opId).toBe(log.appended[0]!.opId);
  });

  it('discards a failed message from the outbox', async () => {
    const log = new FakeLog();
    log.next(() => Promise.reject(new TransportError('no', false)));
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));
    act(() => chat().sendMessage('r1', 'never mind'));
    await waitFor(() => expect(chat().outbox).toHaveLength(1));
    act(() => chat().discardMessage(chat().outbox[0]!.id));
    expect(chat().outbox).toHaveLength(0);
    expect(chat().messages.some((m) => m.content === 'never mind')).toBe(false);
  });

  it("takes the server's workspace on reset, keeping this device's unconfirmed changes", async () => {
    const log = new FakeLog();
    log.next(() => new Promise(() => {})); // never answers: stays pending
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));
    act(() => chat().sendMessage('r1', 'still mine'));

    const server = structuredClone({
      users: chat().users,
      groups: chat().userGroups,
      rooms: chat().rooms,
      messages: [],
      meetings: [],
      notifications: [],
      readState: {},
      saved: {},
      followedThreads: {},
    }) as Workspace;
    act(() => log.handlers!.onReset!(server, 10, new Set()));

    // The seeded history is gone (the server's has none); the pending
    // message is still shown on top.
    expect(chat().messages.map((m) => m.content)).toEqual(['still mine']);
  });

  it('drops a pending op from the outbox when a reset shows it already landed', async () => {
    const log = new FakeLog();
    log.next(() => new Promise(() => {}));
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));
    act(() => chat().sendMessage('r1', 'landed while offline'));
    const opId = log.appended[0]!.opId;
    act(() =>
      log.handlers!.onReset!(
        { ...structuredClone(emptyFrom(chat())), messages: [] },
        3,
        new Set([opId]),
      ),
    );
    expect(chat().outbox).toHaveLength(0);
  });

  it('ignores an entry it has already applied', async () => {
    const log = new FakeLog();
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));
    const echo: OpEntry = {
      opId: 'remote-1',
      actor: 'u2',
      ts: 42,
      seq: 7,
      op: { type: 'message.send', roomId: 'r1', message: { id: 'remote-msg', content: 'from u2' } },
    };
    act(() => log.handlers!.onEntry(echo));
    act(() =>
      log.handlers!.onEntry({
        ...echo,
        opId: 'remote-2',
        op: { ...echo.op, message: { id: 'other', content: 'replayed seq' } } as never,
      }),
    );
    expect(chat().messages.filter((m) => m.id === 'remote-msg')).toHaveLength(1);
    expect(chat().messages.some((m) => m.id === 'other')).toBe(false);
  });

  it('resubscribes as the new person when the viewer switches', async () => {
    const log = new FakeLog();
    const { chat } = mount(log);
    await waitFor(() => expect(log.subscribedAs).toEqual(['u1']));
    act(() => chat().setCurrentUserId('u2'));
    await waitFor(() => expect(log.subscribedAs).toEqual(['u1', 'u2']));
  });

  it('moves the read marker once, not on every render', async () => {
    const log = new FakeLog();
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));
    const before = log.appended.length;
    act(() => chat().markRoomRead('r1'));
    act(() => chat().markRoomRead('r1'));
    act(() => chat().markRoomRead('r1'));
    const reads = log.appended.slice(before).filter((e) => e.op.type === 'read.mark');
    expect(reads).toHaveLength(1);
  });
});

describe('attachments on a shared log', () => {
  it('uploads the file first and sends its URL, so everyone can load it', async () => {
    const log = new FakeLog();
    const upload = vi.fn(async () => ({ url: '/uploads/chat/abc.jpg' }));
    Object.assign(log, { uploadAttachment: upload });
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));
    const file = new File([new Uint8Array(300_000)], 'site.jpg', { type: 'image/jpeg' });
    await act(() => chat().sendAttachment('r1', file));
    expect(upload).toHaveBeenCalledWith(file);
    const sent = log.appended.find((entry) => entry.op.type === 'message.send')!;
    expect(sent.op).toMatchObject({
      message: { attachment: { name: 'site.jpg', dataUrl: '/uploads/chat/abc.jpg' } },
    });
    expect(JSON.stringify(sent.op)).not.toContain('blobId');
  });

  it('sends nothing when the upload fails', async () => {
    const log = new FakeLog();
    Object.assign(log, {
      uploadAttachment: async () => {
        throw new TransportError('server said no', false);
      },
    });
    const { chat } = mount(log);
    await waitFor(() => expect(chat().storageReady).toBe(true));
    const before = log.appended.length;
    await act(() => chat().sendAttachment('r1', new File(['x'], 'a.png', { type: 'image/png' })));
    expect(log.appended.length).toBe(before);
  });
});

describe('the outbox across restarts', () => {
  it('saves unsent ops and resends them, same opIds, when the app opens again', async () => {
    const first = new FakeLog();
    first.next(() => new Promise(() => {}));
    const a = mount(first);
    await waitFor(() => expect(a.chat().storageReady).toBe(true));
    act(() => a.chat().sendMessage('r1', 'across a restart'));
    const opId = first.appended[0]!.opId;
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).outbox).toHaveLength(1),
    );
    a.view.unmount();

    const second = new FakeLog();
    const b = mount(second);
    await waitFor(() => expect(second.appended.map((e) => e.opId)).toEqual([opId]));
    await waitFor(() =>
      expect(b.chat().messages.find((m) => m.content === 'across a restart')?.delivery).toBe(
        'delivered',
      ),
    );
  });

  it('upgrades an old snapshot: unsent messages become outbox ops, scheduled ones stay scheduled', async () => {
    // Written by the store before the log existed: everything in `messages`.
    const seedMount = mount(new FakeLog());
    await waitFor(() => expect(seedMount.chat().storageReady).toBe(true));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    seedMount.view.unmount();
    delete saved.outbox;
    delete saved.scheduled;
    saved.messages.push(
      {
        id: 'old-failed',
        clientId: 'old-failed-client',
        roomId: 'r1',
        senderId: 'u1',
        content: 'was failing',
        timestamp: 1,
        delivery: 'failed',
      },
      {
        id: 'old-scheduled',
        clientId: 'old-scheduled-client',
        roomId: 'r1',
        senderId: 'u1',
        content: 'later',
        timestamp: 1,
        delivery: 'sending',
        scheduledFor: Date.now() + 3_600_000,
      },
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const log = new FakeLog();
    const { chat } = mount(log);
    await waitFor(() => expect(log.appended.map((e) => e.opId)).toContain('old-failed-client'));
    expect(
      chat()
        .scheduledMessages('r1')
        .map((m) => m.id),
    ).toEqual(['old-scheduled']);
    expect(chat().messages.some((m) => m.id === 'old-scheduled')).toBe(false);
  });
});

function emptyFrom(chat: Chat): Workspace {
  return {
    users: chat.users,
    groups: chat.userGroups,
    rooms: chat.rooms,
    messages: [],
    meetings: [],
    notifications: [],
    readState: {},
    saved: {},
    followedThreads: {},
  };
}
