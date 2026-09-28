import { describe, expect, it } from 'vitest';
import { applyOp, foldOps, type ChatOp, type OpEntry, type Workspace } from '@/lib/chat-ops';
import { SEED_GROUPS, SEED_MESSAGES, SEED_ROOMS, SEED_USERS } from '@/lib/chat-seed';
import { parseMentions } from '@/lib/mentions';

/**
 * The chat's one reducer. Every client folds the server's log with it, so it
 * must be pure and deterministic: the same log, folded anywhere, has to give
 * the same workspace — down to the ids of the notifications it raises.
 */

const seed = (): Workspace => ({
  users: SEED_USERS,
  groups: SEED_GROUPS,
  rooms: SEED_ROOMS,
  messages: SEED_MESSAGES,
  meetings: [],
  notifications: [],
  readState: {},
  saved: {},
  followedThreads: {},
});

const ROOM = 'r1';
const room = (ws: Workspace, id = ROOM) => ws.rooms.find((r) => r.id === id)!;
const message = (ws: Workspace, id: string) => ws.messages.find((m) => m.id === id);
const members = seed().rooms.find((r) => r.id === ROOM)!.participantIds;
const [ALICE, BOB, CAROL] = members as [string, string, string];
const outsider = SEED_USERS.find((u) => !members.includes(u.id))!.id;

let n = 0;
const entry = (actor: string, op: ChatOp, ts = 1_000_000 + ++n): OpEntry => ({
  opId: `op-${n}`,
  actor,
  ts,
  op,
});
const send = (actor: string, id: string, content: string, extra: Partial<ChatOp> = {}) =>
  entry(actor, {
    type: 'message.send',
    roomId: ROOM,
    // Parsed by the sender, as the store does when it builds a message.
    message: { id, content, mentions: parseMentions(content, SEED_GROUPS) },
    ...extra,
  } as ChatOp);

describe('message.send', () => {
  it('adds the message with the server time, the actor as sender, and delivered', () => {
    const ws = applyOp(seed(), send(ALICE, 'm-new', 'hello'));
    expect(message(ws, 'm-new')).toMatchObject({
      roomId: ROOM,
      senderId: ALICE,
      content: 'hello',
      timestamp: 1_000_000 + n,
      delivery: 'delivered',
      reactions: {},
    });
  });

  it('is a no-op for a message id that already exists', () => {
    const once = applyOp(seed(), send(ALICE, 'm-dup', 'first'));
    const twice = applyOp(once, send(BOB, 'm-dup', 'second'));
    expect(twice).toBe(once);
  });

  it('notifies the person mentioned — and not the sender who mentions themself', () => {
    const ws = applyOp(
      seed(),
      send(ALICE, 'm-mention', `ping <@${BOB}> and <@${ALICE}>`, { announce: true } as never),
    );
    const mentions = ws.notifications.filter((x) => x.kind === 'mention');
    expect(mentions.map((x) => x.audience)).toEqual([[BOB]]);
    expect(mentions[0]!.messageId).toBe('m-mention');
  });

  it('raises nothing for mentions unless asked to announce', () => {
    const ws = applyOp(seed(), send(ALICE, 'm-quiet', `ping <@${BOB}>`));
    expect(ws.notifications).toEqual([]);
  });

  it('marks a meeting reminded when its starting notice is posted', () => {
    const meeting = {
      id: 'mt-1',
      roomId: ROOM,
      organizerId: ALICE,
      attendeeIds: [BOB],
      title: 'Review',
      startAt: 1,
      endAt: 2,
      timeZone: 'Asia/Kolkata',
      meetingUri: 'https://meet',
      demo: true,
      createdAt: 0,
    };
    let ws = applyOp(seed(), entry(ALICE, { type: 'meeting.add', roomId: ROOM, meeting }));
    ws = applyOp(
      ws,
      send(ALICE, 'meeting-mt-1-starting', 'starting', {
        message: {
          id: 'meeting-mt-1-starting',
          content: 'starting',
          meetingId: 'mt-1',
          meetingNotice: 'starting',
        },
      } as never),
    );
    expect(ws.meetings[0]!.reminderSentAt).toBe(ws.messages.at(-1)!.timestamp);
  });
});

describe('editing, deleting, reacting, pinning', () => {
  const base = () => applyOp(seed(), send(ALICE, 'm1', 'original'));

  it('lets only the sender edit, and stamps the server time', () => {
    const edited = applyOp(
      base(),
      entry(ALICE, {
        type: 'message.edit',
        roomId: ROOM,
        messageId: 'm1',
        content: 'fixed',
        linkPreviews: [],
      }),
    );
    expect(message(edited, 'm1')).toMatchObject({ content: 'fixed', editedAt: 1_000_000 + n });
    const hijack = applyOp(
      base(),
      entry(BOB, {
        type: 'message.edit',
        roomId: ROOM,
        messageId: 'm1',
        content: 'mine now',
        linkPreviews: [],
      }),
    );
    expect(message(hijack, 'm1')!.content).toBe('original');
  });

  it('tombstones on delete by the sender or an admin, and ignores anyone else', () => {
    const admin = room(seed()).adminIds[0]!;
    const deleted = applyOp(
      base(),
      entry(ALICE, { type: 'message.delete', roomId: ROOM, messageId: 'm1' }),
    );
    expect(message(deleted, 'm1')).toMatchObject({ content: '', deletedBy: ALICE });
    const byAdmin = applyOp(
      base(),
      entry(admin, { type: 'message.delete', roomId: ROOM, messageId: 'm1' }),
    );
    expect(message(byAdmin, 'm1')!.deletedBy).toBe(admin);
    const stranger = members.find((id) => id !== ALICE && !room(seed()).adminIds.includes(id))!;
    const refused = applyOp(
      base(),
      entry(stranger, { type: 'message.delete', roomId: ROOM, messageId: 'm1' }),
    );
    expect(message(refused, 'm1')!.content).toBe('original');
  });

  it('treats reactions as intents: repeating one changes nothing', () => {
    const on = {
      type: 'message.reaction',
      roomId: ROOM,
      messageId: 'm1',
      emoji: '👍',
      on: true,
    } as const;
    const once = applyOp(base(), entry(BOB, on));
    const twice = applyOp(once, entry(BOB, on));
    expect(message(twice, 'm1')!.reactions).toEqual({ '👍': [BOB] });
    const off = applyOp(twice, entry(BOB, { ...on, on: false }));
    expect(message(off, 'm1')!.reactions).toEqual({});
  });

  it('pins with who and when, and unpins', () => {
    const pinned = applyOp(
      base(),
      entry(BOB, { type: 'message.pin', roomId: ROOM, messageId: 'm1', on: true }),
    );
    expect(message(pinned, 'm1')).toMatchObject({ pinnedBy: BOB, pinnedAt: 1_000_000 + n });
    const unpinned = applyOp(
      pinned,
      entry(BOB, { type: 'message.pin', roomId: ROOM, messageId: 'm1', on: false }),
    );
    expect(message(unpinned, 'm1')!.pinnedBy).toBeUndefined();
  });
});

describe('rooms', () => {
  it('creates a group with a system message and a notification', () => {
    const ws = applyOp(
      seed(),
      entry(ALICE, {
        type: 'room.create',
        roomId: 'g-new',
        room: {
          id: 'g-new',
          type: 'group',
          name: 'Launch',
          createdAt: 0,
          adminIds: [ALICE],
          participantIds: [ALICE, BOB],
          mutedUserIds: [],
        },
      }),
    );
    expect(room(ws, 'g-new').createdAt).toBe(1_000_000 + n);
    expect(ws.messages.at(-1)).toMatchObject({ system: true, roomId: 'g-new' });
    expect(ws.notifications[0]).toMatchObject({ roomId: 'g-new', kind: 'system' });
  });

  it('renames with a system message, and ignores a blank name', () => {
    const renamed = applyOp(
      seed(),
      entry(ALICE, { type: 'room.update', roomId: ROOM, patch: { name: 'Unit 3' } }),
    );
    expect(room(renamed).name).toBe('Unit 3');
    expect(renamed.messages.at(-1)!.content).toContain('renamed the conversation to “Unit 3”');
    const blank = applyOp(
      seed(),
      entry(ALICE, { type: 'room.update', roomId: ROOM, patch: { name: '  ' } }),
    );
    expect(room(blank).name).toBe(room(seed()).name);
  });

  it('adds members and tells them, including the new member', () => {
    const ws = applyOp(
      seed(),
      entry(ALICE, { type: 'room.members', roomId: ROOM, add: [outsider] }),
    );
    expect(room(ws).participantIds).toContain(outsider);
    const note = ws.notifications[0]!;
    // "all" is the whole room *after* the change, so the new member is in it.
    expect(note.audience).toBe('all');
  });

  it('never removes the last admin', () => {
    const only = room(seed()).adminIds;
    const ws = applyOp(
      seed(),
      entry(only[0]!, { type: 'room.admin', roomId: ROOM, userId: only[0]!, on: false }),
    );
    expect(room(ws).adminIds).toEqual(only);
  });

  it('keeps the sole admin in a room that still has members', () => {
    const admin = room(seed()).adminIds[0]!;
    const ws = applyOp(
      seed(),
      entry(admin, { type: 'room.members', roomId: ROOM, remove: [admin] }),
    );
    expect(room(ws).participantIds).toContain(admin);
  });

  it('judges an invite by the server time of the join, not the device clock', () => {
    const invite = { code: 'JOIN1', createdAt: 0, expiresAt: 5_000, maxUses: 10, uses: 0 };
    const ws = applyOp(seed(), entry(ALICE, { type: 'room.invite', roomId: ROOM, invite }));
    const inTime = applyOp(
      ws,
      entry(outsider, { type: 'room.join', roomId: ROOM, code: 'JOIN1' }, 4_000),
    );
    expect(room(inTime).participantIds).toContain(outsider);
    expect(room(inTime).invite!.uses).toBe(1);
    const late = applyOp(
      ws,
      entry(outsider, { type: 'room.join', roomId: ROOM, code: 'JOIN1' }, 6_000),
    );
    expect(room(late).participantIds).not.toContain(outsider);
  });
});

describe('per-person state', () => {
  it('moves a read marker forward only', () => {
    const later = applyOp(
      seed(),
      entry(BOB, { type: 'read.mark', roomId: ROOM, timestamp: 500, messageId: 'x' }),
    );
    const earlier = applyOp(
      later,
      entry(BOB, { type: 'read.mark', roomId: ROOM, timestamp: 100, messageId: 'y' }),
    );
    expect(earlier.readState[ROOM]![BOB]!.lastReadTimestamp).toBe(500);
  });

  it('marks notifications read for the actor only', () => {
    let ws = applyOp(
      seed(),
      send(ALICE, 'm-at', `<@${BOB}> <@${CAROL}>`, { announce: true } as never),
    );
    ws = applyOp(ws, entry(BOB, { type: 'notification.read', roomId: ROOM, scope: 'mentions' }));
    const byAudience = Object.fromEntries(
      ws.notifications.map((x) => [(x.audience as string[])[0], x.readBy]),
    );
    expect(byAudience[BOB]).toEqual([BOB]);
    expect(byAudience[CAROL]).toEqual([]);
  });

  it('keeps saved messages and followed threads per person', () => {
    let ws = applyOp(seed(), entry(ALICE, { type: 'saved.set', messageId: 'm1', on: true }));
    ws = applyOp(ws, entry(ALICE, { type: 'saved.set', messageId: 'm1', on: true }));
    ws = applyOp(ws, entry(BOB, { type: 'thread.follow', rootId: 'm1', on: true }));
    expect(ws.saved).toEqual({ [ALICE]: ['m1'] });
    expect(ws.followedThreads).toEqual({ [BOB]: ['m1'] });
  });

  it("respects a person's notification level when raising room activity", () => {
    let ws = applyOp(seed(), entry(BOB, { type: 'room.notify', roomId: ROOM, level: 'none' }));
    ws = applyOp(ws, entry(ALICE, { type: 'room.update', roomId: ROOM, patch: { name: 'Quiet' } }));
    const audience = ws.notifications[0]!.audience;
    expect(audience).not.toBe('all');
    expect(audience).not.toContain(BOB);
  });
});

describe('profile.update', () => {
  const photo = { dataUrl: 'data:image/webp;base64,AAAA', zoom: 1.2, x: 40, y: 60 };
  const person = (ws: Workspace, id: string) => ws.users.find((u) => u.id === id)!;

  it("sets the author's own photo, and nobody else's", () => {
    const ws = applyOp(seed(), entry(ALICE, { type: 'profile.update', patch: { photo } }));
    expect(person(ws, ALICE).photo).toEqual(photo);
    expect(person(ws, BOB).photo).toBeUndefined();
  });

  it('removes it with null', () => {
    const ws = foldOps(seed(), [
      entry(ALICE, { type: 'profile.update', patch: { photo } }),
      entry(ALICE, { type: 'profile.update', patch: { photo: null } }),
    ]);
    expect(person(ws, ALICE)).not.toHaveProperty('photo');
  });

  it('leaves the workspace alone when the patch says nothing', () => {
    const before = seed();
    expect(applyOp(before, entry(ALICE, { type: 'profile.update', patch: {} }))).toBe(before);
  });
});

describe('convergence', () => {
  it('gives every client the same workspace from the same log', () => {
    const log: OpEntry[] = [
      send(ALICE, 'c1', `hi <@${BOB}> @channel`, { announce: true } as never),
      entry(BOB, {
        type: 'message.reaction',
        roomId: ROOM,
        messageId: 'c1',
        emoji: '🎉',
        on: true,
      }),
      entry(ALICE, { type: 'room.update', roomId: ROOM, patch: { name: 'Converged' } }),
      entry(ALICE, { type: 'room.members', roomId: ROOM, add: [outsider] }),
      entry(BOB, { type: 'notification.read', roomId: ROOM }),
    ];
    // Two separate clients: separate objects, same entries.
    const phone = foldOps(seed(), structuredClone(log));
    const console_ = foldOps(seed(), structuredClone(log));
    expect(phone).toEqual(console_);
    // Including the notification ids that "mark as read" refers to.
    expect(phone.notifications.map((x) => x.id)).toEqual(console_.notifications.map((x) => x.id));
  });

  it('does not mutate the workspace it is given', () => {
    const before = seed();
    const snapshot = structuredClone(before);
    applyOp(before, send(ALICE, 'pure', 'x'));
    expect(before).toEqual(snapshot);
  });
});
