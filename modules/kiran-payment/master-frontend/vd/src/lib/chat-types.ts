/**
 * Domain model for the Nexus chat workspace.
 *
 * These shapes are deliberately written as if a server owned them: every entity
 * has a stable id, mutations carry an idempotency key, and read state is stored
 * per-user rather than as a single client-side counter. The current runtime
 * persists them to localStorage, but the contracts are the ones a real API
 * would expose, so the storage layer can be swapped without touching the UI.
 */

export type UserId = string;
export type RoomId = string;
export type MessageId = string;
export type GroupHandle = string;

/* -------------------------------------------------------------------------- */
/* Users & groups                                                             */
/* -------------------------------------------------------------------------- */

export interface User {
  id: UserId;
  name: string;
  /** Job title, e.g. "Backend Engineer". */
  role: string;
  /** Org unit the person belongs to, e.g. "Engineering". Drives the directory. */
  department?: string;
  /** Calendar invitation address. Production directories should always provide this. */
  email?: string;
  online: boolean;
  color: string;
  /** IANA zone, used to render "their local time" and to format timestamps. */
  timeZone: string;
  /** Profile picture the person chose, cropped the way they framed it. */
  photo?:
    | {
        dataUrl: string;
        zoom: number;
        x: number;
        y: number;
      }
    | undefined;
}

/** A mentionable set of users, e.g. `@engineering`. */
export interface UserGroup {
  id: string;
  handle: GroupHandle;
  name: string;
  memberIds: UserId[];
}

/* -------------------------------------------------------------------------- */
/* Rooms                                                                       */
/* -------------------------------------------------------------------------- */

export type RoomType = "group" | "direct" | "groupdm";

/**
 * How a group room is filed in the conversation rail. A workspace of any size
 * needs standing department channels to read differently from time-boxed
 * project rooms and from the ad-hoc groups people spin up themselves — which
 * is what the absence of a category means.
 */
export type RoomCategory = "department" | "project" | "social";

export interface Invite {
  code: string;
  createdAt: number;
  /** Epoch ms; null means the link never expires. */
  expiresAt: number | null;
  /** null means unlimited redemptions. */
  maxUses: number | null;
  uses: number;
}

export interface Room {
  id: RoomId;
  type: RoomType;
  name?: string;
  /** Short "what are we doing right now" line, shown in the header. */
  topic?: string;
  /** Long-lived "why this room exists" text, shown in the info panel. */
  description?: string;
  createdBy?: UserId;
  createdAt: number;
  /** Absent on user-created groups, which are filed under "Group chats". */
  category?: RoomCategory;
  adminIds: UserId[];
  participantIds: UserId[];
  groupMuted?: boolean;
  mutedUserIds: UserId[];
  invite?: Invite | null | undefined;
  color?: string;
  /** Cropped group image selected by any current member. */
  photo?:
    | {
        dataUrl: string;
        zoom: number;
        x: number;
        y: number;
      }
    | undefined;
  notificationsMutedBy?: UserId[];
  /** Per-user notification level; absent entries fall back to "all". */
  notificationLevels?: Record<UserId, NotificationLevel>;
  archived?: boolean | undefined;
  archivedAt?: number | undefined;
}

export type NotificationLevel = "all" | "mentions" | "none";

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle of an outbound message. `sending` and `failed` messages live in the
 * outbox and are retried; everything else has been acknowledged by the transport.
 */
export type DeliveryState = "sending" | "sent" | "delivered" | "read" | "failed";

export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  siteName?: string;
  image?: string;
}

export interface MessageMentions {
  users: UserId[];
  groups: GroupHandle[];
  /** `@channel` notifies every member, `@here` only those currently online. */
  broadcast: "channel" | "here" | null;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  /**
   * Renderable URL. Either a `data:` URL (small files, stored inline in the
   * snapshot) or a runtime-only `blob:` URL resolved from `blobId` on boot —
   * which is why it can be briefly empty for a persisted attachment.
   */
  dataUrl: string;
  /**
   * Key into the IndexedDB blob store. Present for anything too large to live
   * inline; the snapshot never carries the bytes for these.
   */
  blobId?: string;
  /** Set when the blob could not be recovered, so the UI can say so. */
  unavailable?: boolean;
}

export interface ForwardedFrom {
  roomId: RoomId;
  messageId: MessageId;
  senderId: UserId;
}

export interface SharedMessage {
  id: MessageId;
  /**
   * Client-generated idempotency key. The transport dedupes on this, so a retry
   * after an ambiguous failure can never produce a duplicate message.
   */
  clientId: string;
  roomId: RoomId;
  senderId: UserId;
  content: string;
  timestamp: number;

  /** Set when the author edits; the UI renders an "edited" marker. */
  editedAt?: number | undefined;
  /**
   * Tombstone. The row survives deletion so replies, thread roots and
   * pagination cursors stay valid; `content` is cleared at the same time.
   */
  deletedAt?: number;
  deletedBy?: UserId;

  system?: boolean;
  reactions?: Record<string, UserId[]> | undefined;
  /** Inline quote-reply within the main channel view. */
  replyToId?: MessageId | null;
  /** Root of a real thread. Messages with this set are hidden from the channel. */
  threadRootId?: MessageId | null;
  sharedFromAi?: boolean;
  /** An internal directory contact shared into a conversation. */
  sharedProfileUserId?: UserId;
  attachment?: Attachment | undefined;
  delivery: DeliveryState;
  pinnedBy?: UserId | undefined;
  pinnedAt?: number | undefined;
  linkPreviews?: LinkPreview[] | undefined;
  mentions?: MessageMentions;
  /**
   * Users this message personally notified, resolved once at send time. The
   * renderer and the notification panel read this instead of re-parsing the
   * body against a directory that may have changed since.
   */
  mentionIds?: UserId[];
  forwardedFrom?: ForwardedFrom;
  /** Links a chat message to the richer scheduled-meeting record. */
  meetingId?: string;
  /**
   * Links a chat message to a reimbursement claim in the finance module.
   *
   * The claim itself lives server-side; the message only holds its id, so the
   * card in the thread always renders the claim's current state rather than a
   * snapshot of how it looked when it was filed.
   */
  claimId?: string;
  /** Distinguishes the original invite from the automatic start-time reminder. */
  meetingNotice?: "scheduled" | "starting";
  /** Set while a message waits in the scheduled queue. */
  scheduledFor?: number | undefined;
  /** Incremented every time the transport retries this message. */
  attempts?: number;
  failureReason?: string | undefined;
}

export interface PrivateAIMessage {
  id: string;
  roomId: RoomId;
  ownerUserId: UserId;
  prompt: string;
  response: string;
  timestamp: number;
  pending?: boolean;
  /** True while tokens are still arriving from the stream. */
  streaming?: boolean;
  error?: boolean;
  /** Groups a multi-turn exchange with the assistant. */
  conversationId: string;
  /** Rough token accounting, used for the per-user budget. */
  tokensUsed?: number;
  kind?: "chat" | "summary";
}

/* -------------------------------------------------------------------------- */
/* Meetings                                                                   */
/* -------------------------------------------------------------------------- */

export interface ScheduledMeeting {
  id: string;
  roomId: RoomId;
  organizerId: UserId;
  attendeeIds: UserId[];
  title: string;
  description?: string;
  startAt: number;
  endAt: number;
  timeZone: string;
  meetingUri: string;
  calendarEventUrl?: string;
  calendarEventId?: string;
  /** True when the no-credentials adapter returned a local/demo calendar event. */
  demo: boolean;
  createdAt: number;
  reminderSentAt?: number;
}

export interface ScheduleMeetingInput {
  roomId: RoomId;
  attendeeIds: UserId[];
  title: string;
  description?: string;
  startAt: number;
  durationMinutes: number;
  timeZone: string;
}

/* -------------------------------------------------------------------------- */
/* Per-user state                                                              */
/* -------------------------------------------------------------------------- */

export interface Draft {
  text: string;
  replyToId?: MessageId | null;
  threadRootId?: MessageId | null;
  updatedAt: number;
}

export interface ReadMarker {
  lastReadTimestamp: number;
  lastReadMessageId: MessageId | null;
  updatedAt: number;
}

/** roomId -> userId -> marker. Server-shaped so receipts work for every member. */
export type ReadState = Record<RoomId, Record<UserId, ReadMarker>>;

export interface UnreadSummary {
  total: number;
  mentions: number;
  firstUnreadId: MessageId | null;
}

/**
 * `mention` is personal ("For you"); everything else is room-wide activity.
 * `system` covers membership/admin/settings changes, `agent` covers anything
 * the assistant or the scheduler produced on the room's behalf.
 */
export type NotificationKind = "mention" | "room" | "system" | "agent";

/**
 * A room-scoped notification.
 *
 * There is no global feed: every notification names the room it belongs to and
 * the audience allowed to see it, so a notification can never surface in a
 * conversation it did not come from. `readBy` is a set rather than a boolean
 * because a single browser session can switch between accounts.
 */
export interface Notification {
  id: string;
  /** Required — notifications are always scoped to one conversation. */
  roomId: RoomId;
  kind: NotificationKind;
  text: string;
  timestamp: number;
  /** Who caused it, used for the avatar. */
  actorId?: UserId;
  /** `"all"` = every participant of the room; an array = only those users. */
  audience: "all" | UserId[];
  /** Target for the jump-to-message action. */
  messageId?: MessageId;
  readBy: UserId[];
}

/** True when `userId` is in the notification's audience. */
export function notificationTargets(notification: Notification, userId: UserId): boolean {
  return notification.audience === "all" || notification.audience.includes(userId);
}

export function notificationIsRead(notification: Notification, userId: UserId): boolean {
  return notification.readBy.includes(userId);
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Opaque cursor. Encoded as `${timestamp}:${id}` so it stays stable across
 * inserts and survives deleted rows — the same scheme a keyset-paginated SQL
 * endpoint would use.
 */
export type Cursor = string;

export interface Page<T> {
  items: T[];
  nextCursor: Cursor | null;
  hasMore: boolean;
}

export function encodeCursor(message: Pick<SharedMessage, "timestamp" | "id">): Cursor {
  return `${message.timestamp}:${message.id}`;
}

export function decodeCursor(cursor: Cursor): { timestamp: number; id: string } | null {
  const index = cursor.indexOf(":");
  if (index === -1) return null;
  const timestamp = Number(cursor.slice(0, index));
  if (!Number.isFinite(timestamp)) return null;
  return { timestamp, id: cursor.slice(index + 1) };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function isVisibleInChannel(message: SharedMessage) {
  return !message.threadRootId;
}

export function isTombstoned(message: SharedMessage) {
  return typeof message.deletedAt === "number";
}

/** Text to show in previews and search results for any message state. */
export function previewText(message: SharedMessage): string {
  if (isTombstoned(message)) return "This message was deleted";
  if (message.sharedProfileUserId) return "Shared a contact";
  if (message.attachment && !message.content) return `📎 ${message.attachment.name}`;
  return message.content;
}
