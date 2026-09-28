/**
 * The chat's operations, and the one reducer that applies them.
 *
 * Every change to the workspace is an operation. Clients append operations to
 * a shared log on the server, the server gives each a place in one total
 * order, and every client folds the log with `applyOp` below. The server holds
 * no chat rules of its own: what a reaction, a rename or a join *means* is
 * decided here, once, for the console and the phone app alike.
 *
 * The catalogue at the top is the single definition of which operations exist.
 * The backend's whitelist is generated from it (`backend/tools/export-chat-seed.mjs`
 * writes `backend/chat_protocol.json`), so the two cannot disagree.
 *
 * Three rules make the fold safe to run on every client:
 *
 * - **Deterministic.** Times come from the entry (`ts`, the server's), never
 *   from the clock. Ids for what an op creates — system messages,
 *   notifications — are derived from its `opId`. Two clients folding the same
 *   log therefore produce the same workspace, down to the notification ids
 *   that "mark as read" refers to.
 * - **Intents, not toggles.** `on: true` / `on: false`, never "toggle". A
 *   retried or reordered toggle would flip state back; an intent applied twice
 *   lands where it was meant to.
 * - **Idempotent where it matters.** Sending a message whose id already exists
 *   is a no-op, so a notice several clients race to post (a meeting starting)
 *   appears once.
 *
 * The reducer is permissive about what the sending client already checked —
 * who may delete, who may rename — and enforces only the invariants the whole
 * room depends on, such as never removing a room's last admin.
 */

import type {
  Invite,
  LinkPreview,
  MessageId,
  MessageMentions,
  Notification,
  NotificationKind,
  NotificationLevel,
  ReadState,
  Room,
  RoomId,
  ScheduledMeeting,
  SharedMessage,
  User,
  UserGroup,
  UserId,
} from "./chat-types";
import { isTombstoned, notificationIsRead, notificationTargets } from "./chat-types";
import { resolveMentionAudience, toPlainText } from "./mentions";
import { inviteIsUsable } from "./invite-rules";

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/** Operations every member of a room sees. */
export const SHARED_OP_TYPES = [
  "message.send",
  "message.edit",
  "message.delete",
  "message.reaction",
  "message.pin",
  "meeting.add",
  "room.create",
  "room.update",
  "room.members",
  "room.admin",
  "room.mute_user",
  "room.invite",
  "room.join",
  "read.mark",
  "notification.read",
] as const;

/**
 * Operations only their author sees. The server streams these to the one
 * user who made them: what someone saved or follows is theirs.
 */
export const PRIVATE_OP_TYPES = ["saved.set", "thread.follow", "room.notify"] as const;

export const OP_TYPES = [...SHARED_OP_TYPES, ...PRIVATE_OP_TYPES] as const;

export type OpType = (typeof OP_TYPES)[number];

/**
 * Operations that must name an existing room. `room.create` names one that
 * does not exist yet; the private ones that are not about a room say nothing
 * about one.
 */
export const ROOM_SCOPED_OP_TYPES: readonly OpType[] = OP_TYPES.filter(
  (type) => type !== "room.create" && type !== "saved.set" && type !== "thread.follow",
);

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/** Everything the log determines. Device-only state (drafts, the open room) is not here. */
export interface Workspace {
  users: User[];
  groups: UserGroup[];
  rooms: Room[];
  messages: SharedMessage[];
  meetings: ScheduledMeeting[];
  notifications: Notification[];
  readState: ReadState;
  saved: Record<UserId, MessageId[]>;
  followedThreads: Record<UserId, MessageId[]>;
}

/** A notification an op asks for beyond the ones the reducer derives itself. */
export interface Notice {
  id: string;
  text: string;
  kind: NotificationKind;
  audience?: "all" | UserId[];
}

/** What a sender supplies for a new message; the rest comes from the entry. */
export type MessageDraft = Omit<
  SharedMessage,
  "roomId" | "senderId" | "timestamp" | "delivery" | "attempts" | "failureReason" | "clientId"
> & { clientId?: string };

export type RoomPatch = Partial<
  Pick<Room, "name" | "topic" | "description" | "archived" | "groupMuted">
> & {
  /** null removes the photo. */
  photo?: Room["photo"] | null;
};

export type ChatOp =
  | {
      type: "message.send";
      roomId: RoomId;
      message: MessageDraft;
      /** Raise mention and broadcast notifications, as a typed message does. */
      announce?: boolean;
      notices?: Notice[];
    }
  | {
      type: "message.edit";
      roomId: RoomId;
      messageId: MessageId;
      content: string;
      mentions?: MessageMentions;
      linkPreviews: LinkPreview[];
    }
  | { type: "message.delete"; roomId: RoomId; messageId: MessageId }
  | { type: "message.reaction"; roomId: RoomId; messageId: MessageId; emoji: string; on: boolean }
  | { type: "message.pin"; roomId: RoomId; messageId: MessageId; on: boolean }
  | { type: "meeting.add"; roomId: RoomId; meeting: ScheduledMeeting; notices?: Notice[] }
  | { type: "room.create"; roomId: RoomId; room: Room }
  | { type: "room.update"; roomId: RoomId; patch: RoomPatch }
  | { type: "room.members"; roomId: RoomId; add?: UserId[]; remove?: UserId[] }
  | { type: "room.admin"; roomId: RoomId; userId: UserId; on: boolean }
  | { type: "room.mute_user"; roomId: RoomId; userId: UserId; on: boolean }
  | { type: "room.invite"; roomId: RoomId; invite: Invite | null }
  | { type: "room.join"; roomId: RoomId; code: string }
  | { type: "read.mark"; roomId: RoomId; timestamp: number; messageId: MessageId | null }
  | {
      type: "notification.read";
      roomId: RoomId;
      /** Specific notifications; omitted means every one in the room for `scope`. */
      ids?: string[];
      scope?: "mentions" | "activity";
    }
  | { type: "saved.set"; messageId: MessageId; on: boolean }
  | { type: "thread.follow"; rootId: MessageId; on: boolean }
  | { type: "room.notify"; roomId: RoomId; level: NotificationLevel };

/** One op in the log, with who made it and when the server received it. */
export interface OpEntry {
  opId: string;
  actor: UserId;
  /** Server receive time: the ordering and timestamp authority. */
  ts: number;
  op: ChatOp;
  /** The server's position for it; absent while it is still pending locally. */
  seq?: number;
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

/** Per-room, not global: a busy room must never evict a quiet room's history. */
export const MAX_NOTIFICATIONS_PER_ROOM = 50;
/** How much of a message body a notification quotes. */
export const NOTIFICATION_SNIPPET = 90;

/**
 * Narrows a requested audience to the members who have actually asked to hear
 * about this, returning null when nobody is left.
 *
 * Personal mentions deliberately survive `groupMuted`: that flag silences the
 * room's chatter, not somebody calling your name.
 */
export function deliverableAudience(
  room: Room,
  kind: NotificationKind,
  requested: "all" | UserId[],
): "all" | UserId[] | null {
  if (kind === "room" && room.groupMuted) return null;

  const muted = room.notificationsMutedBy ?? [];
  const levels = room.notificationLevels ?? {};
  const blocked = (id: UserId) => {
    if (muted.includes(id)) return true;
    const level = levels[id];
    if (level === "none") return true;
    return level === "mentions" && kind !== "mention";
  };

  const requestedIds = requested === "all" ? room.participantIds : requested;
  const allowed = requestedIds.filter((id) => room.participantIds.includes(id) && !blocked(id));
  if (allowed.length === 0) return null;
  // Keep "all" as "all" so a member who joins later still sees room history.
  if (requested === "all" && allowed.length === room.participantIds.length) return "all";
  return allowed;
}

export function snippetOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > NOTIFICATION_SNIPPET ? `${flat.slice(0, NOTIFICATION_SNIPPET - 1)}…` : flat;
}

/* -------------------------------------------------------------------------- */
/* The reducer                                                                */
/* -------------------------------------------------------------------------- */

const nameOf = (ws: Workspace, id: UserId) =>
  (ws.users.find((user) => user.id === id) ?? ws.users[0])?.name ?? "Someone";

const roomOf = (ws: Workspace, id: RoomId) => ws.rooms.find((room) => room.id === id);

function withRoom(ws: Workspace, roomId: RoomId, change: (room: Room) => Room): Workspace {
  let changed = false;
  const rooms = ws.rooms.map((room) => {
    if (room.id !== roomId) return room;
    const next = change(room);
    if (next !== room) changed = true;
    return next;
  });
  return changed ? { ...ws, rooms } : ws;
}

function withMessage(
  ws: Workspace,
  messageId: MessageId,
  change: (message: SharedMessage) => SharedMessage,
): Workspace {
  let changed = false;
  const messages = ws.messages.map((message) => {
    if (message.id !== messageId) return message;
    const next = change(message);
    if (next !== message) changed = true;
    return next;
  });
  return changed ? { ...ws, messages } : ws;
}

function addSystemMessage(ws: Workspace, entry: OpEntry, roomId: RoomId, content: string) {
  const id = `sys-${entry.opId}`;
  const message: SharedMessage = {
    id,
    clientId: id,
    roomId,
    senderId: "system",
    content,
    timestamp: entry.ts,
    system: true,
    delivery: "delivered",
  };
  return { ws: { ...ws, messages: [...ws.messages, message] }, messageId: id };
}

/**
 * Records a room-scoped notification for everyone in `audience` (the whole
 * room by default), after mute state has had its say. Reads the room from the
 * workspace as it stands at this point in the fold — so a notification raised
 * after a membership change reaches the new membership.
 */
function addNotification(
  ws: Workspace,
  entry: OpEntry,
  roomId: RoomId,
  text: string,
  options: {
    id: string;
    kind?: NotificationKind;
    audience?: "all" | UserId[];
    messageId?: MessageId;
  },
): Workspace {
  const room = roomOf(ws, roomId);
  if (!room) return ws;
  if (ws.notifications.some((existing) => existing.id === options.id)) return ws;
  const kind = options.kind ?? "room";
  const audience = deliverableAudience(room, kind, options.audience ?? "all");
  if (!audience) return ws;

  const notification: Notification = {
    id: options.id,
    roomId,
    kind,
    text,
    timestamp: entry.ts,
    audience,
    readBy: [],
    actorId: entry.actor,
    ...(options.messageId ? { messageId: options.messageId } : {}),
  };
  const perRoom = new Map<RoomId, number>();
  const kept: Notification[] = [];
  for (const item of [notification, ...ws.notifications]) {
    const count = (perRoom.get(item.roomId) ?? 0) + 1;
    perRoom.set(item.roomId, count);
    if (count <= MAX_NOTIFICATIONS_PER_ROOM) kept.push(item);
  }
  return { ...ws, notifications: kept };
}

/** A system message in the room and a notification pointing at it. */
function announceChange(
  ws: Workspace,
  entry: OpEntry,
  roomId: RoomId,
  message: string | null,
  notification: string | null,
  audience?: "all" | UserId[],
): Workspace {
  let next = ws;
  let messageId: MessageId | undefined;
  if (message) {
    const added = addSystemMessage(next, entry, roomId, message);
    next = added.ws;
    messageId = added.messageId;
  }
  if (notification) {
    next = addNotification(next, entry, roomId, notification, {
      id: `n-${entry.opId}`,
      kind: "system",
      audience,
      messageId,
    });
  }
  return next;
}

function setMembership(list: MessageId[] | undefined, id: MessageId, on: boolean) {
  const current = list ?? [];
  const has = current.includes(id);
  if (on === has) return current;
  return on ? [id, ...current] : current.filter((item) => item !== id);
}

/** Apply one op. Pure: the same workspace and entry always give the same result. */
export function applyOp(ws: Workspace, entry: OpEntry): Workspace {
  const { op, actor, ts } = entry;
  const actorName = nameOf(ws, actor);

  switch (op.type) {
    case "message.send": {
      if (ws.messages.some((message) => message.id === op.message.id)) return ws;
      const room = roomOf(ws, op.roomId);
      if (!room) return ws;
      const message: SharedMessage = {
        reactions: {},
        ...op.message,
        clientId: op.message.clientId ?? entry.opId,
        roomId: op.roomId,
        senderId: actor,
        timestamp: ts,
        delivery: "delivered",
      };
      let next: Workspace = { ...ws, messages: [...ws.messages, message] };

      // A meeting's "starting now" notice marks the meeting reminded, so no
      // client posts it a second time.
      if (message.meetingId && message.meetingNotice === "starting") {
        next = {
          ...next,
          meetings: next.meetings.map((meeting) =>
            meeting.id === message.meetingId && !meeting.reminderSentAt
              ? { ...meeting, reminderSentAt: ts }
              : meeting,
          ),
        };
      }

      if (op.announce) {
        // Personal mentions and room-wide broadcasts have different
        // audiences: a mention is only for the person named, a broadcast is
        // for the room.
        const audience = resolveMentionAudience(message, room, next.users, next.groups);
        const snippet = snippetOf(toPlainText(message.content, next.users, next.groups));
        for (const userId of audience.personal) {
          if (userId === actor) continue; // Mentioning yourself is not a notification.
          next = addNotification(next, entry, op.roomId, `${actorName} mentioned you: “${snippet}”`, {
            id: `n-${entry.opId}-mention-${userId}`,
            kind: "mention",
            audience: [userId],
            messageId: message.id,
          });
        }
        if (audience.broadcast) {
          // `@here` narrows to whoever is online — that is the whole point
          // of it existing next to `@channel`.
          const reach: "all" | UserId[] =
            audience.broadcast === "here"
              ? room.participantIds.filter((id) => next.users.find((user) => user.id === id)?.online)
              : "all";
          next = addNotification(
            next,
            entry,
            op.roomId,
            `${actorName} messaged @${audience.broadcast === "here" ? "here" : "everyone"}: “${snippet}”`,
            { id: `n-${entry.opId}-broadcast`, kind: "room", audience: reach, messageId: message.id },
          );
        }
      }

      for (const notice of op.notices ?? []) {
        next = addNotification(next, entry, op.roomId, notice.text, {
          id: notice.id,
          kind: notice.kind,
          audience: notice.audience,
          messageId: message.id,
        });
      }
      return next;
    }

    case "message.edit":
      return withMessage(ws, op.messageId, (message) => {
        if (message.senderId !== actor || isTombstoned(message)) return message;
        return {
          ...message,
          content: op.content,
          editedAt: ts,
          mentions: op.mentions,
          linkPreviews: op.linkPreviews,
        };
      });

    case "message.delete": {
      const room = roomOf(ws, op.roomId);
      return withMessage(ws, op.messageId, (message) => {
        const allowed = message.senderId === actor || Boolean(room?.adminIds.includes(actor));
        if (!allowed || isTombstoned(message)) return message;
        const { attachment: _dropped, ...rest } = message;
        return {
          ...rest,
          content: "",
          deletedAt: ts,
          deletedBy: actor,
          reactions: {},
          linkPreviews: [],
        };
      });
    }

    case "message.reaction":
      return withMessage(ws, op.messageId, (message) => {
        if (isTombstoned(message)) return message;
        const reactions = { ...(message.reactions ?? {}) };
        const list = reactions[op.emoji] ?? [];
        const has = list.includes(actor);
        if (has === op.on) return message;
        const next = op.on ? [...list, actor] : list.filter((id) => id !== actor);
        if (next.length === 0) delete reactions[op.emoji];
        else reactions[op.emoji] = next;
        return { ...message, reactions };
      });

    case "message.pin":
      return withMessage(ws, op.messageId, (message) => {
        if (op.on) {
          if (message.pinnedBy) return message;
          return { ...message, pinnedBy: actor, pinnedAt: ts };
        }
        if (!message.pinnedBy) return message;
        return { ...message, pinnedBy: undefined, pinnedAt: undefined };
      });

    case "meeting.add": {
      if (ws.meetings.some((meeting) => meeting.id === op.meeting.id)) return ws;
      let next: Workspace = { ...ws, meetings: [...ws.meetings, op.meeting] };
      for (const notice of op.notices ?? []) {
        next = addNotification(next, entry, op.roomId, notice.text, {
          id: notice.id,
          kind: notice.kind,
          audience: notice.audience,
        });
      }
      return next;
    }

    case "room.create": {
      if (roomOf(ws, op.roomId)) return ws;
      const room: Room = { ...op.room, id: op.roomId, createdAt: ts };
      const next: Workspace = { ...ws, rooms: [...ws.rooms, room] };
      if (room.type !== "group") return next;
      return announceChange(
        next,
        entry,
        room.id,
        `${actorName} created “${room.name}” with ${room.participantIds.length} members.`,
        `${actorName} created “${room.name}”`,
      );
    }

    case "room.update": {
      const room = roomOf(ws, op.roomId);
      if (!room) return ws;
      const { patch } = op;
      let next = ws;

      if (patch.name !== undefined) {
        const name = patch.name.trim();
        if (name) {
          next = withRoom(next, op.roomId, (r) => ({ ...r, name }));
          next = announceChange(
            next,
            entry,
            op.roomId,
            `${actorName} renamed the conversation to “${name}”.`,
            `${actorName} renamed the group to “${name}”`,
          );
        }
      }
      if (patch.topic !== undefined) {
        const topic = patch.topic.trim();
        next = withRoom(next, op.roomId, (r) => ({ ...r, topic }));
        next = announceChange(
          next,
          entry,
          op.roomId,
          topic ? `${actorName} set the topic to “${topic}”.` : `${actorName} cleared the topic.`,
          null,
        );
      }
      if (patch.description !== undefined) {
        const description = patch.description.trim();
        next = withRoom(next, op.roomId, (r) => ({ ...r, description }));
      }
      if (patch.photo !== undefined) {
        // Only members of a group or group message may change its picture.
        if (room.type !== "direct" && room.participantIds.includes(actor)) {
          const photo = patch.photo ?? undefined;
          next = withRoom(next, op.roomId, (r) => ({ ...r, photo }));
          const action = patch.photo ? "changed" : "removed";
          next = announceChange(
            next,
            entry,
            op.roomId,
            `${actorName} ${action} the group photo.`,
            `${actorName} ${action} the group photo`,
          );
        }
      }
      if (patch.archived !== undefined) {
        next = withRoom(next, op.roomId, (r) =>
          patch.archived ? { ...r, archived: true, archivedAt: ts } : { ...r, archived: false },
        );
      }
      if (patch.groupMuted !== undefined) {
        next = withRoom(next, op.roomId, (r) => ({ ...r, groupMuted: patch.groupMuted }));
        // Recorded as `system`, not `room`: a mute change is exactly the event
        // that must still reach everyone once the room has been muted.
        next = announceChange(
          next,
          entry,
          op.roomId,
          null,
          patch.groupMuted
            ? `${actorName} muted messaging for everyone`
            : `${actorName} re-enabled messaging for everyone`,
        );
      }
      return next;
    }

    case "room.members": {
      const room = roomOf(ws, op.roomId);
      if (!room) return ws;
      let next = ws;

      const adding = (op.add ?? []).filter((id) => !room.participantIds.includes(id));
      if (adding.length > 0) {
        next = withRoom(next, op.roomId, (r) => ({
          ...r,
          participantIds: [...r.participantIds, ...adding],
        }));
        const names = adding.map((id) => nameOf(next, id)).join(", ");
        // After the membership change, so the new members are in the room's
        // audience and see the event that added them.
        next = announceChange(
          next,
          entry,
          op.roomId,
          `${actorName} added ${names}.`,
          `${actorName} added ${names}`,
        );
      }

      for (const userId of op.remove ?? []) {
        const current = roomOf(next, op.roomId);
        if (!current?.participantIds.includes(userId)) continue;
        if (userId === actor) {
          // Leaving. The room must keep an admin while it has other members.
          const soleAdmin =
            current.adminIds.length === 1 &&
            current.adminIds[0] === actor &&
            current.participantIds.length > 1;
          if (soleAdmin) continue;
          const before = current.participantIds;
          next = withRoom(next, op.roomId, (r) => ({
            ...r,
            participantIds: r.participantIds.filter((id) => id !== actor),
            adminIds: r.adminIds.filter((id) => id !== actor),
          }));
          next = announceChange(
            next,
            entry,
            op.roomId,
            `${actorName} left the conversation.`,
            `${actorName} left the group`,
            // The leaver is no longer a participant, so name the audience.
            before.filter((id) => id !== actor),
          );
        } else {
          next = withRoom(next, op.roomId, (r) => ({
            ...r,
            participantIds: r.participantIds.filter((id) => id !== userId),
            adminIds: r.adminIds.filter((id) => id !== userId),
            mutedUserIds: r.mutedUserIds.filter((id) => id !== userId),
          }));
          next = announceChange(
            next,
            entry,
            op.roomId,
            `${nameOf(next, userId)} was removed from the conversation.`,
            `${actorName} removed ${nameOf(next, userId)} from the group`,
          );
        }
      }
      return next;
    }

    case "room.admin": {
      const room = roomOf(ws, op.roomId);
      if (!room) return ws;
      const isAdmin = room.adminIds.includes(op.userId);
      if (isAdmin === op.on) return ws;
      // Never strip the last admin — the room would become unmanageable.
      if (!op.on && room.adminIds.length === 1) return ws;
      const next = withRoom(ws, op.roomId, (r) => ({
        ...r,
        adminIds: op.on ? [...r.adminIds, op.userId] : r.adminIds.filter((id) => id !== op.userId),
      }));
      return announceChange(
        next,
        entry,
        op.roomId,
        null,
        op.on
          ? `${actorName} made ${nameOf(next, op.userId)} an admin`
          : `${actorName} removed ${nameOf(next, op.userId)} as an admin`,
      );
    }

    case "room.mute_user": {
      const room = roomOf(ws, op.roomId);
      if (!room) return ws;
      const muted = room.mutedUserIds.includes(op.userId);
      if (muted === op.on) return ws;
      const next = withRoom(ws, op.roomId, (r) => ({
        ...r,
        mutedUserIds: op.on
          ? [...r.mutedUserIds, op.userId]
          : r.mutedUserIds.filter((id) => id !== op.userId),
      }));
      return announceChange(
        next,
        entry,
        op.roomId,
        null,
        `${actorName} ${op.on ? "muted" : "unmuted"} ${nameOf(next, op.userId)}`,
      );
    }

    case "room.invite": {
      if (!roomOf(ws, op.roomId)) return ws;
      const next = withRoom(ws, op.roomId, (r) => ({ ...r, invite: op.invite }));
      return announceChange(
        next,
        entry,
        op.roomId,
        null,
        op.invite
          ? `${actorName} generated a new invite link`
          : `${actorName} revoked the invite link`,
      );
    }

    case "room.join": {
      const room = roomOf(ws, op.roomId);
      if (!room || room.invite?.code !== op.code) return ws;
      if (room.participantIds.includes(actor)) return ws;
      // Judged at the server's receive time, so every client agrees whether
      // the link was still good when this person used it.
      if (inviteIsUsable(room.invite, ts) !== "active") return ws;
      const next = withRoom(ws, op.roomId, (r) => ({
        ...r,
        participantIds: [...r.participantIds, actor],
        invite: r.invite ? { ...r.invite, uses: r.invite.uses + 1 } : r.invite,
      }));
      return announceChange(
        next,
        entry,
        op.roomId,
        `${actorName} joined via invite link.`,
        `${actorName} joined via invite link`,
      );
    }

    case "read.mark": {
      const room = ws.readState[op.roomId] ?? {};
      const existing = room[actor];
      if (existing && existing.lastReadTimestamp >= op.timestamp) return ws;
      return {
        ...ws,
        readState: {
          ...ws.readState,
          [op.roomId]: {
            ...room,
            [actor]: {
              lastReadTimestamp: op.timestamp,
              lastReadMessageId: op.messageId ?? existing?.lastReadMessageId ?? null,
              updatedAt: ts,
            },
          },
        },
      };
    }

    case "notification.read": {
      let changed = false;
      const ids = op.ids ? new Set(op.ids) : null;
      const notifications = ws.notifications.map((notification) => {
        if (notification.roomId !== op.roomId) return notification;
        if (ids && !ids.has(notification.id)) return notification;
        if (op.scope === "mentions" && notification.kind !== "mention") return notification;
        if (op.scope === "activity" && notification.kind === "mention") return notification;
        if (!notificationTargets(notification, actor)) return notification;
        if (notificationIsRead(notification, actor)) return notification;
        changed = true;
        return { ...notification, readBy: [...notification.readBy, actor] };
      });
      return changed ? { ...ws, notifications } : ws;
    }

    case "saved.set": {
      const list = setMembership(ws.saved[actor], op.messageId, op.on);
      if (list === ws.saved[actor]) return ws;
      return { ...ws, saved: { ...ws.saved, [actor]: list } };
    }

    case "thread.follow": {
      const list = setMembership(ws.followedThreads[actor], op.rootId, op.on);
      if (list === ws.followedThreads[actor]) return ws;
      return { ...ws, followedThreads: { ...ws.followedThreads, [actor]: list } };
    }

    case "room.notify":
      return withRoom(ws, op.roomId, (room) =>
        room.notificationLevels?.[actor] === op.level
          ? room
          : { ...room, notificationLevels: { ...(room.notificationLevels ?? {}), [actor]: op.level } },
      );
  }
}

/** Fold entries, in order, over a workspace. */
export function foldOps(ws: Workspace, entries: readonly OpEntry[]): Workspace {
  return entries.reduce(applyOp, ws);
}
