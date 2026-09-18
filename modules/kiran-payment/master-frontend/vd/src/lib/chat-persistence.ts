/**
 * Snapshot persistence and schema migration.
 *
 * Bumping the schema without a migration path silently throws away everyone's
 * existing workspace, so older snapshots are upgraded in place rather than
 * discarded: v1 (the original localStorage format) and v2 (a global, flat
 * notification feed) both load into the current shape.
 */

import type {
  Draft,
  MessageId,
  Notification,
  PrivateAIMessage,
  ReadState,
  Room,
  RoomId,
  ScheduledMeeting,
  SharedMessage,
  UserId,
} from "./chat-types";

/**
 * The workspace's namespace in local storage.
 *
 * Renamed when the chat moved into KiranOS and its seed became this company's
 * people and rooms. A snapshot written against the previous directory is still
 * structurally valid, so the schema version would not reject it — it would just
 * quietly restore a workspace full of the wrong names. A new key is the honest
 * way to say the content, not the shape, has changed.
 */
export const STORAGE_KEY = "kiranos-chat-v1";
export const SCHEMA_VERSION = 3;

export interface PersistedState {
  version: number;
  rooms: Room[];
  messages: SharedMessage[];
  meetings: ScheduledMeeting[];
  aiMessages: PrivateAIMessage[];
  currentUserId: UserId;
  activeRoomId: RoomId;
  notifications: Notification[];
  readState: ReadState;
  drafts: Record<string, Draft>;
  saved: Record<UserId, MessageId[]>;
  followedThreads: Record<UserId, MessageId[]>;
}

interface LegacyV1 {
  version: 1;
  rooms: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  aiMessages: Array<Record<string, unknown>>;
  currentUserId: string;
  activeRoomId: string;
  notifications: Array<{ id: string; text: string; timestamp: number }>;
  unread: Record<string, number>;
}

/** v2 notifications were a single global feed with an optional owner. */
interface LegacyV2Notification {
  id: string;
  text: string;
  timestamp: number;
  roomId?: string;
  messageId?: string;
  kind?: string;
  read?: boolean;
  ownerUserId?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** v1 rooms carried a bare `inviteCode`; v2 models an invite with limits. */
function migrateRoom(raw: Record<string, unknown>): Room {
  const inviteCode = raw["inviteCode"];
  const createdAt =
    typeof raw["createdAt"] === "number" ? (raw["createdAt"] as number) : Date.now();
  return {
    id: String(raw["id"]),
    type: (raw["type"] === "direct" ? "direct" : "group") as Room["type"],
    ...(typeof raw["name"] === "string" ? { name: raw["name"] } : {}),
    ...(typeof raw["description"] === "string" ? { description: raw["description"] } : {}),
    ...(typeof raw["createdBy"] === "string" ? { createdBy: raw["createdBy"] } : {}),
    createdAt,
    adminIds: Array.isArray(raw["adminIds"]) ? (raw["adminIds"] as string[]) : [],
    participantIds: Array.isArray(raw["participantIds"]) ? (raw["participantIds"] as string[]) : [],
    groupMuted: Boolean(raw["groupMuted"]),
    mutedUserIds: Array.isArray(raw["mutedUserIds"]) ? (raw["mutedUserIds"] as string[]) : [],
    invite:
      typeof inviteCode === "string"
        ? { code: inviteCode, createdAt, expiresAt: null, maxUses: null, uses: 0 }
        : null,
    ...(typeof raw["color"] === "string" ? { color: raw["color"] } : {}),
    ...(Array.isArray(raw["notificationsMutedBy"])
      ? { notificationsMutedBy: raw["notificationsMutedBy"] as string[] }
      : {}),
  };
}

function migrateMessage(raw: Record<string, unknown>): SharedMessage {
  const id = String(raw["id"]);
  const attachment = raw["attachment"];
  return {
    id,
    // v1 had no idempotency key; derive a stable one from the row id.
    clientId: typeof raw["clientId"] === "string" ? raw["clientId"] : `legacy-${id}`,
    roomId: String(raw["roomId"]),
    senderId: String(raw["senderId"]),
    content: typeof raw["content"] === "string" ? raw["content"] : "",
    timestamp: typeof raw["timestamp"] === "number" ? (raw["timestamp"] as number) : Date.now(),
    ...(raw["system"] ? { system: true } : {}),
    reactions: isObject(raw["reactions"]) ? (raw["reactions"] as Record<string, string[]>) : {},
    replyToId: typeof raw["replyToId"] === "string" ? raw["replyToId"] : null,
    ...(raw["sharedFromAi"] ? { sharedFromAi: true } : {}),
    ...(isObject(attachment)
      ? { attachment: attachment as unknown as SharedMessage["attachment"] }
      : {}),
    // Anything already stored was, by definition, delivered.
    delivery: "delivered",
  };
}

function migrateAi(raw: Record<string, unknown>): PrivateAIMessage {
  return {
    id: String(raw["id"]),
    roomId: String(raw["roomId"]),
    ownerUserId: String(raw["ownerUserId"]),
    prompt: typeof raw["prompt"] === "string" ? raw["prompt"] : "",
    response: typeof raw["response"] === "string" ? raw["response"] : "",
    timestamp: typeof raw["timestamp"] === "number" ? (raw["timestamp"] as number) : Date.now(),
    ...(raw["pending"] ? { pending: true } : {}),
    ...(raw["error"] ? { error: true } : {}),
    // Each legacy exchange becomes its own single-turn conversation.
    conversationId: `legacy-${String(raw["id"])}`,
    kind: "chat",
  };
}

/**
 * Rebuilds per-user read markers from v1's `unread` counters. The counts are
 * approximate by nature, so this places the marker N messages back from the
 * newest — close enough that nothing is wrongly marked read.
 */
function migrateReadState(legacy: LegacyV1, messages: SharedMessage[]): ReadState {
  const readState: ReadState = {};
  const byRoom = new Map<string, SharedMessage[]>();
  for (const message of messages) {
    const list = byRoom.get(message.roomId) ?? [];
    list.push(message);
    byRoom.set(message.roomId, list);
  }

  for (const [roomId, list] of byRoom) {
    const ordered = list.sort((a, b) => a.timestamp - b.timestamp);
    const unread = legacy.unread?.[roomId] ?? 0;
    const index = Math.max(0, ordered.length - unread - 1);
    const marker = ordered[index];
    readState[roomId] = {
      [legacy.currentUserId]: {
        lastReadTimestamp: marker ? marker.timestamp : 0,
        lastReadMessageId: marker ? marker.id : null,
        updatedAt: Date.now(),
      },
    };
  }
  return readState;
}

function migrateV1(legacy: LegacyV1): PersistedState {
  const messages = legacy.messages.filter(isObject).map(migrateMessage);
  return {
    version: SCHEMA_VERSION,
    rooms: legacy.rooms.filter(isObject).map(migrateRoom),
    messages,
    meetings: [],
    aiMessages: legacy.aiMessages.filter(isObject).map(migrateAi),
    currentUserId: legacy.currentUserId,
    activeRoomId: legacy.activeRoomId,
    // v1 notifications carried no room, and a notification that cannot name
    // its room has nowhere to be shown now. The rest of the snapshot is kept.
    notifications: [],
    readState: migrateReadState(legacy, messages),
    drafts: {},
    saved: {},
    followedThreads: {},
  };
}

/**
 * Upgrades a v2 notification to the room-scoped shape, dropping anything that
 * never named a room — under the new model such a row has no panel to live in.
 */
function migrateNotification(raw: LegacyV2Notification, viewerId: UserId): Notification | null {
  if (typeof raw?.roomId !== "string" || !raw.roomId) return null;
  const kind: Notification["kind"] =
    raw.kind === "mention"
      ? "mention"
      : raw.kind === "meeting"
        ? "agent"
        : raw.kind === "message"
          ? "room"
          : "system";
  // `ownerUserId` was v2's "only this account may see it", which is exactly a
  // single-member audience; everything else was shown to whoever was looking.
  const audience: Notification["audience"] = raw.ownerUserId ? [raw.ownerUserId] : "all";
  const reader = raw.ownerUserId ?? viewerId;
  return {
    id: raw.id,
    roomId: raw.roomId,
    kind,
    text: raw.text,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now(),
    audience,
    ...(raw.messageId ? { messageId: raw.messageId } : {}),
    readBy: raw.read ? [reader] : [],
  };
}

function migrateV2(value: Record<string, unknown>): PersistedState {
  const state = value as unknown as Omit<PersistedState, "notifications"> & {
    notifications?: LegacyV2Notification[];
  };
  const viewerId = String(value["currentUserId"]);
  return {
    ...state,
    version: SCHEMA_VERSION,
    meetings: Array.isArray(value["meetings"]) ? state.meetings : [],
    notifications: (state.notifications ?? [])
      .map((raw) => migrateNotification(raw, viewerId))
      .filter((notification): notification is Notification => notification !== null),
    readState: state.readState ?? {},
    drafts: state.drafts ?? {},
    saved: state.saved ?? {},
    followedThreads: state.followedThreads ?? {},
  };
}

/** Shape check shared by v2 and v3 — only `notifications` changed between them. */
function hasCoreShape(value: Record<string, unknown>): boolean {
  return (
    Array.isArray(value["rooms"]) &&
    Array.isArray(value["messages"]) &&
    Array.isArray(value["aiMessages"]) &&
    typeof value["currentUserId"] === "string" &&
    typeof value["activeRoomId"] === "string"
  );
}

export function parseSavedState(raw: string | null): PersistedState | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;

  if (value["version"] === 1 && Array.isArray(value["messages"])) {
    try {
      return migrateV1(value as unknown as LegacyV1);
    } catch {
      // A corrupt legacy snapshot should reset to seed data, not crash boot.
      return null;
    }
  }

  if (!hasCoreShape(value)) return null;

  if (value["version"] === 2) {
    try {
      return migrateV2(value);
    } catch {
      return null;
    }
  }

  if (value["version"] !== SCHEMA_VERSION) return null;
  const state = value as unknown as PersistedState;
  return {
    ...state,
    meetings: Array.isArray(value["meetings"]) ? state.meetings : [],
    // Defensive: a hand-edited or partially written row without an audience
    // would otherwise be invisible to every reader rather than to none.
    notifications: (state.notifications ?? []).filter(
      (notification) => typeof notification?.roomId === "string" && notification.audience,
    ),
    readState: state.readState ?? {},
    drafts: state.drafts ?? {},
    saved: state.saved ?? {},
    followedThreads: state.followedThreads ?? {},
  };
}

/* -------------------------------------------------------------------------- */
/* Snapshot writing                                                           */
/* -------------------------------------------------------------------------- */

export type StorageFailure = "quota" | "unavailable";

export interface SnapshotResult {
  ok: boolean;
  /** Only set when `ok` is false. */
  reason?: StorageFailure;
  /** Bytes written (or attempted), for the storage indicator. */
  bytes: number;
}

/**
 * Blob-backed attachments must never round-trip their bytes through
 * localStorage — that is the quota bug this layer exists to prevent. The
 * object URL is runtime state, so it is dropped and rebuilt from `blobId`.
 */
function stripBlobUrls(messages: SharedMessage[]): SharedMessage[] {
  let changed = false;
  const next = messages.map((message) => {
    const attachment = message.attachment;
    if (!attachment?.blobId || !attachment.dataUrl) return message;
    changed = true;
    return { ...message, attachment: { ...attachment, dataUrl: "" } };
  });
  return changed ? next : messages;
}

/** True for the DOMException browsers raise when localStorage is full. */
function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22
    );
  }
  return error instanceof Error && /quota/i.test(error.message);
}

export function writeSnapshot(state: PersistedState): SnapshotResult {
  const payload = JSON.stringify({ ...state, messages: stripBlobUrls(state.messages) });
  const bytes = payload.length * 2; // UTF-16 code units, which is what the quota counts.
  try {
    window.localStorage.setItem(STORAGE_KEY, payload);
    return { ok: true, bytes };
  } catch (error) {
    // The app stays fully usable in memory; only durability is lost — but the
    // user has to be told, which is why the reason is reported rather than
    // swallowed into a bare `false`.
    return { ok: false, reason: isQuotaError(error) ? "quota" : "unavailable", bytes };
  }
}

/** Every blob id still referenced by a live message. */
export function referencedBlobIds(messages: SharedMessage[]): string[] {
  const ids = new Set<string>();
  for (const message of messages) {
    if (message.attachment?.blobId) ids.add(message.attachment.blobId);
  }
  return [...ids];
}

export const draftKey = (userId: UserId, roomId: RoomId, threadRootId?: MessageId | null) =>
  `${userId}:${roomId}${threadRootId ? `:${threadRootId}` : ""}`;
