/**
 * Workspace state.
 *
 * The store is written against the contracts in `chat-types.ts` rather than
 * against localStorage: sends go through a transport that can fail and be
 * retried, reads are tracked per-user, and history is paginated with cursors.
 * Replacing `createLocalTransport` with a real API client and the snapshot
 * effect with server queries is the whole of the backend migration on this side.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  encodeCursor,
  isTombstoned,
  previewText,
  type Cursor,
  type Draft,
  type Invite,
  type LinkPreview,
  type MessageId,
  notificationIsRead,
  notificationTargets,
  type Notification,
  type NotificationKind,
  type NotificationLevel,
  type PrivateAIMessage,
  type ReadState,
  type Room,
  type RoomId,
  type ScheduledMeeting,
  type ScheduleMeetingInput,
  type SharedMessage,
  type UnreadSummary,
  type User,
  type UserGroup,
  type UserId,
} from "./chat-types";
import { SEED_AI, SEED_GROUPS, SEED_MESSAGES, SEED_ROOMS, SEED_USERS } from "./chat-seed";
import {
  draftKey,
  parseSavedState,
  referencedBlobIds,
  SCHEMA_VERSION,
  STORAGE_KEY,
  writeSnapshot,
  type PersistedState,
  type StorageFailure,
} from "./chat-persistence";
import {
  attachmentUrl,
  blobStoreAvailable,
  collectOrphanBlobs,
  INLINE_ATTACHMENT_LIMIT,
  MAX_ATTACHMENT_BYTES,
  putAttachmentBlob,
  rememberAttachmentUrl,
} from "./attachment-store";
import { compareMessages, pageBefore, PAGE_SIZE } from "./paginate";
import {
  mentionsUser,
  parseMentions,
  resolveMentionAudience,
  toPlainText,
  type MentionAudience,
} from "./mentions";
import { derivePreviews } from "./link-preview";
import { formatDateTime } from "./time";
import { backoffDelay, createLocalTransport, newId, TransportError } from "./transport";
import { inviteIsUsable } from "./invite-rules";

/** Per-room, not global: a busy room must never evict a quiet room's history. */
const MAX_NOTIFICATIONS_PER_ROOM = 50;
/** How much of a message body a notification quotes. */
const NOTIFICATION_SNIPPET = 90;

const AI_TOKEN_BUDGET = 60_000;
const AI_BUDGET_WINDOW = 24 * 60 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 5;

/**
 * What the last snapshot write did. `saved: false` means everything still
 * works in memory but nothing survives a reload — the UI has to say so out
 * loud rather than let the user lose a session's worth of conversation.
 */
export interface StorageStatus {
  saved: boolean;
  reason?: StorageFailure;
  /** Approximate snapshot size, so the banner can show how close to full it is. */
  bytes: number;
}

/**
 * Narrows a requested audience to the members who have actually asked to hear
 * about this, returning null when nobody is left.
 *
 * Personal mentions deliberately survive `groupMuted`: that flag silences the
 * room's chatter, not somebody calling your name.
 */
function deliverableAudience(
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

function snippetOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > NOTIFICATION_SNIPPET ? `${flat.slice(0, NOTIFICATION_SNIPPET - 1)}…` : flat;
}

export interface NotifyOptions {
  kind?: NotificationKind;
  actorId?: UserId;
  audience?: "all" | UserId[];
  messageId?: MessageId;
  /** Stable id for events that can be replayed, e.g. the meeting reminder. */
  id?: string;
}

export interface AiBudget {
  used: number;
  limit: number;
  resetAt: number;
}

interface ChatContextValue {
  /* directory */
  users: User[];
  userGroups: UserGroup[];
  currentUser: User;
  currentUserId: UserId;
  setCurrentUserId: (id: UserId) => void;
  userById: (id: UserId) => User;

  /* rooms */
  rooms: Room[];
  visibleRooms: Room[];
  archivedRooms: Room[];
  activeRoom: Room;
  activeRoomId: RoomId;
  setActiveRoom: (id: RoomId) => void;
  roomTitle: (room: Room) => string;
  canSend: (room: Room, userId: UserId) => { allowed: boolean; reason?: string };
  isAdmin: (room: Room, userId?: UserId) => boolean;

  /* messages */
  messages: SharedMessage[];
  channelMessages: SharedMessage[];
  hasMoreHistory: boolean;
  loadOlder: () => void;
  messageById: (id: MessageId) => SharedMessage | undefined;
  lastMessage: (roomId: RoomId) => SharedMessage | undefined;

  sendMessage: (
    roomId: RoomId,
    content: string,
    options?: {
      replyToId?: MessageId | null;
      threadRootId?: MessageId | null;
      sharedProfileUserId?: UserId;
      /** Renders the message as a live reimbursement claim card. */
      claimId?: string;
    },
  ) => void;
  sendAttachment: (
    roomId: RoomId,
    file: File,
    caption?: string,
    options?: { replyToId?: MessageId | null; threadRootId?: MessageId | null },
  ) => Promise<void>;
  /** Creates a Google Meet space server-side and posts the link to the room. */
  createMeeting: (roomId: RoomId) => Promise<void>;
  /** Creates a Calendar event with Meet conferencing for selected room members. */
  scheduleMeeting: (input: ScheduleMeetingInput) => Promise<ScheduledMeeting | null>;
  meetings: ScheduledMeeting[];
  meetingById: (id: string) => ScheduledMeeting | undefined;
  editMessage: (id: MessageId, content: string) => void;
  deleteMessage: (id: MessageId) => void;
  retryMessage: (id: MessageId) => void;
  discardMessage: (id: MessageId) => void;
  forwardMessage: (id: MessageId, targetRoomIds: RoomId[]) => void;
  toggleReaction: (id: MessageId, emoji: string) => void;
  togglePin: (id: MessageId) => void;
  toggleSave: (id: MessageId) => void;
  isSaved: (id: MessageId) => boolean;
  savedMessages: () => SharedMessage[];
  pinnedMessages: (roomId: RoomId) => SharedMessage[];
  permalinkFor: (message: SharedMessage) => string;

  /* scheduled */
  scheduleMessage: (roomId: RoomId, content: string, sendAt: number) => void;
  scheduledMessages: (roomId?: RoomId) => SharedMessage[];
  cancelScheduled: (id: MessageId) => void;
  sendScheduledNow: (id: MessageId) => void;

  /* threads */
  threadReplies: (rootId: MessageId) => SharedMessage[];
  threadCount: (rootId: MessageId) => number;
  threadParticipants: (rootId: MessageId) => User[];
  isFollowingThread: (rootId: MessageId) => boolean;
  toggleFollowThread: (rootId: MessageId) => void;

  /* read state */
  readState: ReadState;
  markRoomRead: (roomId: RoomId) => void;
  unreadFor: (roomId: RoomId) => UnreadSummary;
  readersOf: (message: SharedMessage) => User[];

  /* drafts */
  getDraft: (roomId: RoomId, threadRootId?: MessageId | null) => Draft | undefined;
  saveDraft: (
    roomId: RoomId,
    draft: Omit<Draft, "updatedAt">,
    threadRootId?: MessageId | null,
  ) => void;
  clearDraft: (roomId: RoomId, threadRootId?: MessageId | null) => void;
  draftRoomIds: () => RoomId[];

  /* rooms management */
  openDirect: (otherUserId: UserId) => RoomId;
  createGroup: (input: { name: string; description: string; participantIds: UserId[] }) => RoomId;
  createGroupDm: (participantIds: UserId[]) => RoomId;
  renameRoom: (roomId: RoomId, name: string) => void;
  setRoomTopic: (roomId: RoomId, topic: string) => void;
  setRoomDescription: (roomId: RoomId, description: string) => void;
  updateGroupPhoto: (roomId: RoomId, photo: Room["photo"] | null) => boolean;
  addMembers: (roomId: RoomId, userIds: UserId[]) => void;
  removeMember: (roomId: RoomId, userId: UserId) => void;
  toggleAdmin: (roomId: RoomId, userId: UserId) => void;
  leaveRoom: (roomId: RoomId) => void;
  setArchived: (roomId: RoomId, archived: boolean) => void;
  toggleGroupMute: (roomId: RoomId) => void;
  toggleUserMute: (roomId: RoomId, userId: UserId) => void;
  setNotificationLevel: (roomId: RoomId, level: NotificationLevel) => void;
  notificationLevel: (roomId: RoomId) => NotificationLevel;
  toggleRoomNotifications: (roomId: RoomId) => void;

  /* invites */
  createInvite: (
    roomId: RoomId,
    options: { expiresInMs: number | null; maxUses: number | null },
  ) => void;
  revokeInvite: (roomId: RoomId) => void;
  inviteStatus: (invite: Invite | null | undefined) => "active" | "expired" | "exhausted" | "none";
  roomByCode: (code: string) => Room | null;
  joinByCode: (code: string) => { room: Room | null; error?: string };

  /* AI */
  aiMessages: PrivateAIMessage[];
  askAgent: (roomId: RoomId, prompt: string) => Promise<void>;
  regenerateAgent: (aiId: string) => Promise<void>;
  shareAiToChat: (aiId: string) => void;
  summarizeRoom: (roomId: RoomId) => Promise<void>;
  aiBudget: AiBudget;
  aiConversation: (roomId: RoomId) => PrivateAIMessage[];

  /* notifications — always room-scoped, never a global feed */
  /** Newest-first notifications in `roomId` that `userId` is allowed to see. */
  notificationsFor: (roomId: RoomId, userId?: UserId) => Notification[];
  unreadMentionCount: (roomId: RoomId, userId?: UserId) => number;
  unreadActivityCount: (roomId: RoomId, userId?: UserId) => number;
  markNotificationRead: (id: string) => void;
  markRoomNotificationsRead: (roomId: RoomId, scope?: "mentions" | "activity") => void;
  /** First message in the room that mentions the viewer and is still unread. */
  firstUnreadMentionId: (roomId: RoomId) => MessageId | null;

  /* transport */
  online: boolean;
  setOnline: (online: boolean) => void;
  outbox: SharedMessage[];

  /* storage */
  /**
   * False until the saved snapshot has been read. Everything before that is
   * seed data, so restoring a draft or painting real content earlier would be
   * wrong — this is what the skeletons and the draft restore wait on.
   */
  storageReady: boolean;
  storageStatus: StorageStatus;
  /** True while the workspace is failing to persist and the user has not dismissed it. */
  showStorageWarning: boolean;
  /** Frees space by dropping the oldest attachments from this device. */
  reclaimAttachmentSpace: () => Promise<number>;
  dismissStorageWarning: () => void;

  /* navigation */
  pendingJump: MessageId | null;
  jumpToMessage: (roomId: RoomId, messageId: MessageId) => void;
  clearJump: () => void;
  searchMessages: (query: string, roomId?: RoomId) => SharedMessage[];
  plainText: (text: string) => string;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(SEED_USERS);
  const [userGroups] = useState<UserGroup[]>(SEED_GROUPS);
  const [rooms, setRooms] = useState<Room[]>(SEED_ROOMS);
  const [messages, setMessages] = useState<SharedMessage[]>(SEED_MESSAGES);
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [aiMessages, setAiMessages] = useState<PrivateAIMessage[]>(SEED_AI);
  const [currentUserId, setCurrentUserIdState] = useState<UserId>("u1");
  const [activeRoomId, setActiveRoomId] = useState<RoomId>("r1");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readState, setReadState] = useState<ReadState>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saved, setSaved] = useState<Record<UserId, MessageId[]>>({});
  const [followedThreads, setFollowedThreads] = useState<Record<UserId, MessageId[]>>({});
  const [storageReady, setStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({ saved: true, bytes: 0 });
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false);
  const [online, setOnlineState] = useState(true);
  const [pendingJump, setPendingJump] = useState<MessageId | null>(null);
  /** How many messages of history are materialised for the active room. */
  const [windowSize, setWindowSize] = useState(PAGE_SIZE);
  const [aiBudget, setAiBudget] = useState<AiBudget>({
    used: 0,
    limit: AI_TOKEN_BUDGET,
    resetAt: Date.now() + AI_BUDGET_WINDOW,
  });

  /**
   * Render-time mirrors of state that stable callbacks need to read. Assigning
   * during render (rather than in an effect) keeps them correct for callbacks
   * fired later in the same commit.
   */
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  const transport = useRef(createLocalTransport());
  /** Timers for in-flight retries, cleared on unmount so tests don't leak. */
  const retryTimers = useRef(new Map<MessageId, ReturnType<typeof setTimeout>>());

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const apply = (snapshot: PersistedState, recover = false) => {
      setRooms(snapshot.rooms);
      setMessages(
        recover
          ? snapshot.messages.map((message) =>
              // A send that was in flight when the tab closed has an unknown
              // outcome. Park it in the outbox as failed rather than claiming
              // it was delivered.
              message.delivery === "sending" && !message.scheduledFor
                ? { ...message, delivery: "failed", failureReason: "Interrupted before delivery" }
                : message,
            )
          : snapshot.messages,
      );
      setMeetings(snapshot.meetings);
      setAiMessages(
        snapshot.aiMessages.map((message) =>
          recover && (message.pending || message.streaming)
            ? {
                ...message,
                pending: false,
                streaming: false,
                error: true,
                response: "The previous AI request was interrupted. Regenerate to try again.",
              }
            : message,
        ),
      );
      setCurrentUserIdState(snapshot.currentUserId);
      setActiveRoomId(snapshot.activeRoomId);
      setNotifications(snapshot.notifications);
      setReadState(snapshot.readState);
      setDrafts(snapshot.drafts);
      setSaved(snapshot.saved);
      setFollowedThreads(snapshot.followedThreads);
    };

    const snapshot = parseSavedState(window.localStorage.getItem(STORAGE_KEY));
    if (snapshot) apply(snapshot, true);
    setStorageReady(true);

    const syncTabs = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = parseSavedState(event.newValue);
      if (next) apply(next);
    };
    window.addEventListener("storage", syncTabs);
    return () => window.removeEventListener("storage", syncTabs);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const result = writeSnapshot({
      version: SCHEMA_VERSION,
      rooms,
      messages,
      meetings,
      aiMessages,
      currentUserId,
      activeRoomId,
      notifications,
      readState,
      drafts,
      saved,
      followedThreads,
    });
    setStorageStatus((current) => {
      const next: StorageStatus = {
        saved: result.ok,
        bytes: result.bytes,
        ...(result.reason ? { reason: result.reason } : {}),
      };
      // Avoid a state churn loop: this effect depends on nothing it sets, but
      // an identical object would still re-render every consumer.
      if (
        current.saved === next.saved &&
        current.reason === next.reason &&
        current.bytes === next.bytes
      ) {
        return current;
      }
      return next;
    });
    // A write that starts succeeding again clears a dismissal, so a second
    // overflow later is surfaced rather than silently suppressed.
    if (result.ok) setStorageWarningDismissed(false);
  }, [
    storageReady,
    rooms,
    messages,
    meetings,
    aiMessages,
    currentUserId,
    activeRoomId,
    notifications,
    readState,
    drafts,
    saved,
    followedThreads,
  ]);

  useEffect(() => {
    const timers = retryTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Attachment rehydration                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * A restored snapshot carries `blobId` but no URL — the bytes deliberately
   * never went through localStorage. Mint object URLs for whatever is on
   * screen. A blob that has gone missing (cleared site data, a different
   * device) is flagged rather than left as a broken image.
   */
  useEffect(() => {
    if (!storageReady) return;
    const pending = messages.filter(
      (message) =>
        message.attachment?.blobId &&
        !message.attachment.dataUrl &&
        !message.attachment.unavailable,
    );
    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      const resolved = new Map<MessageId, string | null>();
      for (const message of pending) {
        resolved.set(message.id, await attachmentUrl(message.attachment!.blobId!));
      }
      if (cancelled) return;
      setMessages((current) =>
        current.map((message) => {
          if (!resolved.has(message.id) || !message.attachment) return message;
          const url = resolved.get(message.id);
          return url
            ? { ...message, attachment: { ...message.attachment, dataUrl: url } }
            : { ...message, attachment: { ...message.attachment, unavailable: true } };
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [storageReady, messages]);

  /**
   * Blobs outlive their message when a send is discarded or a message deleted.
   * Sweeping once per session keeps the store from growing without bound.
   */
  useEffect(() => {
    if (!storageReady) return;
    const timer = setTimeout(() => {
      void collectOrphanBlobs(referencedBlobIds(messages));
    }, 5_000);
    return () => clearTimeout(timer);
    // Deliberately keyed on boot only: a sweep on every message change would
    // race with an upload whose message has not been committed yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageReady]);

  /* ---------------------------------------------------------------------- */
  /* Directory helpers                                                      */
  /* ---------------------------------------------------------------------- */

  const userById = useCallback(
    (id: UserId) => users.find((user) => user.id === id) ?? users[0]!,
    [users],
  );

  const plainText = useCallback(
    (text: string) => toPlainText(text, users, userGroups),
    [users, userGroups],
  );

  /**
   * Records a room-scoped notification for everyone in `options.audience`
   * (the whole room by default), after mute state has had its say.
   *
   * Reading rooms through a ref keeps this callback stable: it is called from
   * a dozen room mutations, several of which run in the same tick that changed
   * `rooms`, and a stale closure there would notify the wrong membership.
   */
  const notify = useCallback((roomId: RoomId, text: string, options: NotifyOptions = {}) => {
    const room = roomsRef.current.find((candidate) => candidate.id === roomId);
    if (!room) return;
    const kind = options.kind ?? "room";
    const audience = deliverableAudience(room, kind, options.audience ?? "all");
    if (!audience) return;

    const notification: Notification = {
      id: options.id ?? newId("n"),
      roomId,
      kind,
      text,
      timestamp: Date.now(),
      audience,
      readBy: [],
      ...(options.actorId ? { actorId: options.actorId } : {}),
      ...(options.messageId ? { messageId: options.messageId } : {}),
    };

    setNotifications((current) => {
      if (current.some((existing) => existing.id === notification.id)) return current;
      const perRoom = new Map<RoomId, number>();
      const kept: Notification[] = [];
      for (const item of [notification, ...current]) {
        const count = (perRoom.get(item.roomId) ?? 0) + 1;
        perRoom.set(item.roomId, count);
        if (count <= MAX_NOTIFICATIONS_PER_ROOM) kept.push(item);
      }
      return kept;
    });
  }, []);

  const visibleRooms = useMemo(
    () => rooms.filter((room) => room.participantIds.includes(currentUserId) && !room.archived),
    [rooms, currentUserId],
  );

  const archivedRooms = useMemo(
    () => rooms.filter((room) => room.participantIds.includes(currentUserId) && room.archived),
    [rooms, currentUserId],
  );

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? visibleRooms[0] ?? rooms[0]!,
    [rooms, activeRoomId, visibleRooms],
  );

  const roomTitle = useCallback(
    (room: Room) => {
      if (room.type === "group") return room.name ?? "Group";
      const others = room.participantIds.filter((id) => id !== currentUserId);
      if (room.type === "groupdm") {
        if (room.name) return room.name;
        const names = others.map((id) => userById(id).name.split(" ")[0]);
        return names.length > 3
          ? `${names.slice(0, 3).join(", ")} +${names.length - 3}`
          : names.join(", ") || "Group message";
      }
      const other = others[0];
      return other ? userById(other).name : "Direct message";
    },
    [currentUserId, userById],
  );

  const isAdmin = useCallback(
    (room: Room, userId: UserId = currentUserId) => room.adminIds.includes(userId),
    [currentUserId],
  );

  const canSend = useCallback((room: Room, userId: UserId) => {
    if (room.archived) return { allowed: false, reason: "archived" };
    if (room.type !== "group") return { allowed: true };
    if (room.groupMuted && !room.adminIds.includes(userId))
      return { allowed: false, reason: "group" };
    if (room.mutedUserIds.includes(userId)) return { allowed: false, reason: "user" };
    return { allowed: true };
  }, []);

  const messageById = useCallback(
    (id: MessageId) => messages.find((message) => message.id === id),
    [messages],
  );

  const meetingById = useCallback(
    (id: string) => meetings.find((meeting) => meeting.id === id),
    [meetings],
  );

  /* ---------------------------------------------------------------------- */
  /* Read state                                                             */
  /* ---------------------------------------------------------------------- */

  const markRoomRead = useCallback(
    (roomId: RoomId) => {
      setMessages((current) => {
        const roomMessages = current
          .filter((message) => message.roomId === roomId && !message.scheduledFor)
          .sort(compareMessages);
        const newest = roomMessages[roomMessages.length - 1];
        setReadState((state) => {
          const room = state[roomId] ?? {};
          const existing = room[currentUserId];
          const nextTimestamp = newest?.timestamp ?? existing?.lastReadTimestamp ?? 0;
          if (existing && existing.lastReadTimestamp >= nextTimestamp) return state;
          return {
            ...state,
            [roomId]: {
              ...room,
              [currentUserId]: {
                lastReadTimestamp: nextTimestamp,
                lastReadMessageId: newest?.id ?? existing?.lastReadMessageId ?? null,
                updatedAt: Date.now(),
              },
            },
          };
        });
        return current;
      });
    },
    [currentUserId],
  );

  const unreadFor = useCallback(
    (roomId: RoomId): UnreadSummary => {
      const room = rooms.find((r) => r.id === roomId);
      const marker = readState[roomId]?.[currentUserId];
      const since = marker?.lastReadTimestamp ?? 0;
      let total = 0;
      let mentions = 0;
      let firstUnreadId: MessageId | null = null;

      for (const message of messages) {
        if (message.roomId !== roomId) continue;
        if (message.scheduledFor) continue;
        if (message.threadRootId) continue;
        if (message.senderId === currentUserId) continue;
        if (message.timestamp <= since) continue;
        total += 1;
        if (!firstUnreadId) firstUnreadId = message.id;
        if (room && mentionsUser(message.mentions, currentUserId, room, users, userGroups)) {
          mentions += 1;
        }
      }
      return { total, mentions, firstUnreadId };
    },
    [messages, readState, currentUserId, rooms, users, userGroups],
  );

  /** Other members whose read marker has passed this message. */
  const readersOf = useCallback(
    (message: SharedMessage) => {
      const room = readState[message.roomId] ?? {};
      return Object.entries(room)
        .filter(
          ([userId, marker]) =>
            userId !== message.senderId && marker.lastReadTimestamp >= message.timestamp,
        )
        .map(([userId]) => userById(userId));
    },
    [readState, userById],
  );

  /* ---------------------------------------------------------------------- */
  /* Sending                                                                */
  /* ---------------------------------------------------------------------- */

  const dispatchSend = useCallback(async (message: SharedMessage) => {
    const attempt = (message.attempts ?? 0) + 1;
    setMessages((current) =>
      current.map((m) =>
        m.id === message.id ? { ...m, delivery: "sending", attempts: attempt } : m,
      ),
    );

    try {
      const ack = await transport.current.send({
        clientId: message.clientId,
        roomId: message.roomId,
        senderId: message.senderId,
      });
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id
            ? {
                ...m,
                delivery: "sent",
                // The server's receive time is the ordering authority.
                timestamp: ack.duplicate ? m.timestamp : ack.timestamp,
                ...(m.failureReason !== undefined ? { failureReason: undefined } : {}),
              }
            : m,
        ),
      );
      // A short hop to "delivered" stands in for the server's fan-out ack.
      setTimeout(() => {
        setMessages((current) =>
          current.map((m) =>
            m.id === message.id && m.delivery === "sent" ? { ...m, delivery: "delivered" } : m,
          ),
        );
      }, 260);
    } catch (error) {
      const retriable = error instanceof TransportError ? error.retriable : true;
      const reason = error instanceof Error ? error.message : "Send failed";
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id ? { ...m, delivery: "failed", failureReason: reason } : m,
        ),
      );

      if (retriable && attempt < MAX_RETRY_ATTEMPTS && transport.current.isOnline()) {
        const timer = setTimeout(() => {
          retryTimers.current.delete(message.id);
          void dispatchSend({ ...message, attempts: attempt });
        }, backoffDelay(attempt));
        retryTimers.current.set(message.id, timer);
      }
    }
  }, []);

  const buildMessage = useCallback(
    (roomId: RoomId, content: string, extras: Partial<SharedMessage> = {}): SharedMessage => {
      const previews: LinkPreview[] = derivePreviews(content);
      return {
        id: newId("m"),
        clientId: newId("c"),
        roomId,
        senderId: currentUserId,
        content,
        timestamp: Date.now(),
        reactions: {},
        delivery: "sending",
        mentions: parseMentions(content, userGroups),
        ...(previews.length ? { linkPreviews: previews } : {}),
        ...extras,
      };
    },
    [currentUserId, userGroups],
  );

  /**
   * Works out who a message addresses. Personal mentions and room-wide
   * broadcasts are kept apart because they have different audiences: a
   * mention is only ever for the person named, a broadcast is for the room.
   */
  const mentionAudienceOf = useCallback(
    (message: SharedMessage): MentionAudience => {
      const room = roomsRef.current.find((candidate) => candidate.id === message.roomId);
      if (!room) return { personal: [], broadcast: null };
      const audience = resolveMentionAudience(message, room, users, userGroups);
      return {
        // Mentioning yourself is not a notification.
        personal: audience.personal.filter((id) => id !== message.senderId),
        broadcast: audience.broadcast,
      };
    },
    [users, userGroups],
  );

  /**
   * Fans a sent message out into notifications: one personal "For you" item
   * per named user, and at most one room-wide item for a broadcast.
   */
  const announceMessage = useCallback(
    (message: SharedMessage, audience: MentionAudience) => {
      const room = roomsRef.current.find((candidate) => candidate.id === message.roomId);
      if (!room) return;
      const actor = userById(message.senderId).name;
      const snippet = snippetOf(toPlainText(message.content, users, userGroups));

      for (const userId of audience.personal) {
        notify(message.roomId, `${actor} mentioned you: “${snippet}”`, {
          kind: "mention",
          actorId: message.senderId,
          audience: [userId],
          messageId: message.id,
        });
      }

      if (!audience.broadcast) return;
      // `@here` narrows to whoever is online — that is the whole point of it
      // existing next to `@channel`.
      const reach: "all" | UserId[] =
        audience.broadcast === "here"
          ? room.participantIds.filter((id) => users.find((user) => user.id === id)?.online)
          : "all";
      notify(
        message.roomId,
        `${actor} messaged @${audience.broadcast === "here" ? "here" : "everyone"}: “${snippet}”`,
        {
          kind: "room",
          actorId: message.senderId,
          audience: reach,
          messageId: message.id,
        },
      );
    },
    [users, userGroups, userById, notify],
  );

  const sendMessage = useCallback<ChatContextValue["sendMessage"]>(
    (roomId, content, options) => {
      const text = content.trim();
      if (!text) return;
      const draft = buildMessage(roomId, text, {
        replyToId: options?.replyToId ?? null,
        threadRootId: options?.threadRootId ?? null,
        ...(options?.sharedProfileUserId
          ? { sharedProfileUserId: options.sharedProfileUserId }
          : {}),
        ...(options?.claimId ? { claimId: options.claimId } : {}),
      });
      // Resolved once, here, so the renderer never has to re-parse the body
      // against a directory that may have changed since the message was sent.
      const audience = mentionAudienceOf(draft);
      const message: SharedMessage =
        audience.personal.length > 0 ? { ...draft, mentionIds: audience.personal } : draft;

      setMessages((current) => [...current, message]);
      void dispatchSend(message);
      announceMessage(message, audience);
    },
    [buildMessage, dispatchSend, mentionAudienceOf, announceMessage],
  );

  const sendAttachment = useCallback<ChatContextValue["sendAttachment"]>(
    async (roomId, file, caption = "", options) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error("Attachments are limited to 15 MB.");
        return;
      }

      const meta = { name: file.name, type: file.type, size: file.size };
      let attachment: SharedMessage["attachment"];

      if (file.size <= INLINE_ATTACHMENT_LIMIT) {
        // Small enough that base64 in the snapshot costs less than a second
        // store, and it survives even where IndexedDB is blocked.
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => resolve("");
          reader.readAsDataURL(file);
        });
        if (!dataUrl) {
          toast.error("That file could not be read.");
          return;
        }
        attachment = { ...meta, dataUrl };
      } else {
        if (!(await blobStoreAvailable())) {
          toast.error(
            "Large attachments need local storage, which this browser has blocked. Try a file under 256 KB.",
          );
          return;
        }
        const blobId = newId("blob");
        if (!(await putAttachmentBlob(blobId, file))) {
          toast.error("Not enough space on this device to store that attachment.");
          return;
        }
        const url = URL.createObjectURL(file);
        rememberAttachmentUrl(blobId, url);
        attachment = { ...meta, dataUrl: url, blobId };
      }

      const draft = buildMessage(roomId, caption.trim(), {
        replyToId: options?.replyToId ?? null,
        threadRootId: options?.threadRootId ?? null,
        attachment,
      });
      const audience = mentionAudienceOf(draft);
      const message: SharedMessage =
        audience.personal.length > 0 ? { ...draft, mentionIds: audience.personal } : draft;

      setMessages((current) => [...current, message]);
      void dispatchSend(message);
      announceMessage(message, audience);
    },
    [buildMessage, dispatchSend, mentionAudienceOf, announceMessage],
  );

  const retryMessage = useCallback(
    (id: MessageId) => {
      const message = messages.find((m) => m.id === id);
      if (!message) return;
      const timer = retryTimers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        retryTimers.current.delete(id);
      }
      // Same clientId: the transport's ledger guarantees this cannot duplicate.
      void dispatchSend({ ...message, attempts: 0 });
    },
    [messages, dispatchSend],
  );

  const discardMessage = useCallback((id: MessageId) => {
    const timer = retryTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      retryTimers.current.delete(id);
    }
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  /** Anything still unsent goes back out when connectivity returns. */
  const setOnline = useCallback(
    (next: boolean) => {
      transport.current.setOnline(next);
      setOnlineState(next);
      if (!next) return;
      setMessages((current) => {
        for (const message of current) {
          if (message.delivery === "failed" && message.senderId === currentUserId) {
            void dispatchSend({ ...message, attempts: 0 });
          }
        }
        return current;
      });
    },
    [currentUserId, dispatchSend],
  );

  /* ---------------------------------------------------------------------- */
  /* Editing, deleting, pinning, saving                                     */
  /* ---------------------------------------------------------------------- */

  const editMessage = useCallback(
    (id: MessageId, content: string) => {
      const text = content.trim();
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== id) return message;
          if (message.senderId !== currentUserId) return message;
          if (isTombstoned(message)) return message;
          const previews = derivePreviews(text);
          return {
            ...message,
            content: text,
            editedAt: Date.now(),
            mentions: parseMentions(text, userGroups),
            ...(previews.length ? { linkPreviews: previews } : { linkPreviews: [] }),
          };
        }),
      );
    },
    [currentUserId, userGroups],
  );

  /**
   * Soft delete. The row stays so replies, thread roots and cursors remain
   * valid; only the body and attachment are cleared.
   */
  const deleteMessage = useCallback(
    (id: MessageId) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== id) return message;
          const room = rooms.find((r) => r.id === message.roomId);
          const allowed =
            message.senderId === currentUserId || (room ? isAdmin(room, currentUserId) : false);
          if (!allowed) return message;
          return {
            ...message,
            content: "",
            deletedAt: Date.now(),
            deletedBy: currentUserId,
            reactions: {},
            linkPreviews: [],
            ...(message.attachment !== undefined ? { attachment: undefined } : {}),
          };
        }),
      );
      toast.success("Message deleted");
    },
    [currentUserId, rooms, isAdmin],
  );

  const toggleReaction = useCallback(
    (id: MessageId, emoji: string) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== id || isTombstoned(message)) return message;
          const reactions = { ...(message.reactions ?? {}) };
          const list = reactions[emoji] ?? [];
          const next = list.includes(currentUserId)
            ? list.filter((userId) => userId !== currentUserId)
            : [...list, currentUserId];
          if (next.length === 0) delete reactions[emoji];
          else reactions[emoji] = next;
          return { ...message, reactions };
        }),
      );
    },
    [currentUserId],
  );

  const togglePin = useCallback(
    (id: MessageId) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== id) return message;
          if (message.pinnedBy) {
            toast.success("Unpinned");
            return { ...message, pinnedBy: undefined, pinnedAt: undefined };
          }
          toast.success("Pinned to this conversation");
          return { ...message, pinnedBy: currentUserId, pinnedAt: Date.now() };
        }),
      );
    },
    [currentUserId],
  );

  const toggleSave = useCallback(
    (id: MessageId) => {
      setSaved((current) => {
        const list = current[currentUserId] ?? [];
        const next = list.includes(id) ? list.filter((item) => item !== id) : [id, ...list];
        toast.success(list.includes(id) ? "Removed from saved" : "Saved for later");
        return { ...current, [currentUserId]: next };
      });
    },
    [currentUserId],
  );

  const isSaved = useCallback(
    (id: MessageId) => (saved[currentUserId] ?? []).includes(id),
    [saved, currentUserId],
  );

  const savedMessages = useCallback(() => {
    const ids = saved[currentUserId] ?? [];
    return ids
      .map((id) => messages.find((message) => message.id === id))
      .filter((message): message is SharedMessage => Boolean(message));
  }, [saved, currentUserId, messages]);

  const pinnedMessages = useCallback(
    (roomId: RoomId) =>
      messages
        .filter(
          (message) => message.roomId === roomId && message.pinnedBy && !isTombstoned(message),
        )
        .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)),
    [messages],
  );

  const forwardMessage = useCallback(
    (id: MessageId, targetRoomIds: RoomId[]) => {
      const source = messages.find((message) => message.id === id);
      if (!source || targetRoomIds.length === 0) return;
      const created = targetRoomIds.map((roomId) =>
        buildMessage(roomId, source.content, {
          forwardedFrom: {
            roomId: source.roomId,
            messageId: source.id,
            senderId: source.senderId,
          },
          ...(source.attachment ? { attachment: source.attachment } : {}),
          ...(source.sharedProfileUserId
            ? { sharedProfileUserId: source.sharedProfileUserId }
            : {}),
        }),
      );
      setMessages((current) => [...current, ...created]);
      for (const message of created) void dispatchSend(message);
      toast.success(
        targetRoomIds.length === 1
          ? "Forwarded"
          : `Forwarded to ${targetRoomIds.length} conversations`,
      );
    },
    [messages, buildMessage, dispatchSend],
  );

  const permalinkFor = useCallback((message: SharedMessage) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?room=${encodeURIComponent(message.roomId)}&msg=${encodeURIComponent(message.id)}`;
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Scheduled messages                                                     */
  /* ---------------------------------------------------------------------- */

  const scheduleMessage = useCallback(
    (roomId: RoomId, content: string, sendAt: number) => {
      const text = content.trim();
      if (!text) return;
      const message = buildMessage(roomId, text, { scheduledFor: sendAt, delivery: "sending" });
      setMessages((current) => [...current, message]);
      toast.success("Message scheduled");
    },
    [buildMessage],
  );

  const scheduledMessages = useCallback(
    (roomId?: RoomId) =>
      messages
        .filter(
          (message) =>
            message.scheduledFor &&
            message.senderId === currentUserId &&
            (!roomId || message.roomId === roomId),
        )
        .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0)),
    [messages, currentUserId],
  );

  const cancelScheduled = useCallback((id: MessageId) => {
    setMessages((current) => current.filter((message) => message.id !== id));
    toast.success("Scheduled message cancelled");
  }, []);

  const releaseScheduled = useCallback(
    (id: MessageId) => {
      setMessages((current) => {
        const target = current.find((message) => message.id === id);
        if (!target) return current;
        const released: SharedMessage = {
          ...target,
          scheduledFor: undefined,
          timestamp: Date.now(),
          delivery: "sending",
        };
        void dispatchSend(released);
        notify(
          released.roomId,
          `A scheduled message from ${userById(released.senderId).name} was posted`,
          {
            id: `scheduled-${released.id}`,
            kind: "agent",
            actorId: released.senderId,
            messageId: released.id,
          },
        );
        return current.map((message) => (message.id === id ? released : message));
      });
    },
    [dispatchSend, notify, userById],
  );

  const sendScheduledNow = useCallback(
    (id: MessageId) => {
      releaseScheduled(id);
      toast.success("Sent");
    },
    [releaseScheduled],
  );

  const announceMeeting = useCallback(
    (meeting: ScheduledMeeting) => {
      const now = Date.now();
      const messageId = `meeting-${meeting.id}-starting`;
      const clientId = `meeting-${meeting.id}-starting-client`;
      const recipients = [...new Set([meeting.organizerId, ...meeting.attendeeIds])];

      const reminder: SharedMessage = {
        id: messageId,
        clientId,
        roomId: meeting.roomId,
        senderId: meeting.organizerId,
        content: `**${meeting.title}** is starting now. [Join the meeting](${meeting.meetingUri})`,
        timestamp: now,
        reactions: {},
        delivery: "delivered",
        sharedFromAi: true,
        meetingId: meeting.id,
        meetingNotice: "starting",
      };

      // Stable ids make the local worker safe across effect restarts, tab sync,
      // and a reload that happened just as the reminder was being persisted —
      // for the message and for the notification alike.
      setMessages((current) =>
        current.some((message) => message.id === messageId) ? current : [...current, reminder],
      );
      notify(meeting.roomId, `${meeting.title} is starting now — join the meeting`, {
        id: `meeting-${meeting.id}`,
        kind: "agent",
        actorId: meeting.organizerId,
        audience: recipients,
        messageId,
      });
      setMeetings((current) =>
        current.map((candidate) =>
          candidate.id === meeting.id && !candidate.reminderSentAt
            ? { ...candidate, reminderSentAt: now }
            : candidate,
        ),
      );

      if (recipients.includes(currentUserIdRef.current)) {
        toast.info(`${meeting.title} is starting now`, {
          duration: 60_000,
          action: {
            label: "Join",
            onClick: () => window.open(meeting.meetingUri, "_blank", "noopener,noreferrer"),
          },
        });
      }
    },
    [notify],
  );

  // Due-message/meeting ticker. A server would run this as a durable queue worker.
  useEffect(() => {
    const releaseDue = () => {
      const now = Date.now();
      const due = messages.filter((message) => message.scheduledFor && message.scheduledFor <= now);
      for (const message of due) releaseScheduled(message.id);
      const dueMeetings = meetings.filter(
        (meeting) => !meeting.reminderSentAt && meeting.startAt <= now && meeting.endAt > now,
      );
      for (const meeting of dueMeetings) announceMeeting(meeting);
    };
    releaseDue();
    const interval = setInterval(releaseDue, 5_000);
    return () => clearInterval(interval);
  }, [messages, meetings, releaseScheduled, announceMeeting]);

  /* ---------------------------------------------------------------------- */
  /* Threads                                                                */
  /* ---------------------------------------------------------------------- */

  const threadReplies = useCallback(
    (rootId: MessageId) =>
      messages.filter((message) => message.threadRootId === rootId).sort(compareMessages),
    [messages],
  );

  const threadCount = useCallback(
    (rootId: MessageId) =>
      messages.filter((message) => message.threadRootId === rootId && !isTombstoned(message))
        .length,
    [messages],
  );

  const threadParticipants = useCallback(
    (rootId: MessageId) => {
      const ids = new Set<UserId>();
      const root = messages.find((message) => message.id === rootId);
      if (root) ids.add(root.senderId);
      for (const message of messages) {
        if (message.threadRootId === rootId) ids.add(message.senderId);
      }
      return [...ids].map(userById);
    },
    [messages, userById],
  );

  const isFollowingThread = useCallback(
    (rootId: MessageId) => (followedThreads[currentUserId] ?? []).includes(rootId),
    [followedThreads, currentUserId],
  );

  const toggleFollowThread = useCallback(
    (rootId: MessageId) => {
      setFollowedThreads((current) => {
        const list = current[currentUserId] ?? [];
        const following = list.includes(rootId);
        toast.success(following ? "Unfollowed thread" : "Following thread");
        return {
          ...current,
          [currentUserId]: following ? list.filter((id) => id !== rootId) : [rootId, ...list],
        };
      });
    },
    [currentUserId],
  );

  /* ---------------------------------------------------------------------- */
  /* Pagination                                                             */
  /* ---------------------------------------------------------------------- */

  const roomLog = useMemo(
    () =>
      messages
        .filter(
          (message) =>
            message.roomId === activeRoomId && !message.threadRootId && !message.scheduledFor,
        )
        .sort(compareMessages),
    [messages, activeRoomId],
  );

  const channelMessages = useMemo(
    () => roomLog.slice(Math.max(0, roomLog.length - windowSize)),
    [roomLog, windowSize],
  );

  const hasMoreHistory = roomLog.length > channelMessages.length;

  const loadOlder = useCallback(() => {
    setWindowSize((size) => size + PAGE_SIZE);
  }, []);

  // Reset the window when the conversation changes, so switching rooms doesn't
  // inherit a huge materialised window from the previous one.
  useEffect(() => {
    setWindowSize(PAGE_SIZE);
  }, [activeRoomId]);

  /** Exposed for tests and for a future server-backed history endpoint. */
  const historyPage = useCallback(
    (roomId: RoomId, cursor: Cursor | null) =>
      pageBefore(
        messages.filter((m) => m.roomId === roomId && !m.threadRootId && !m.scheduledFor),
        cursor,
      ),
    [messages],
  );
  void historyPage;

  /* ---------------------------------------------------------------------- */
  /* Navigation                                                             */
  /* ---------------------------------------------------------------------- */

  const setActiveRoom = useCallback(
    (id: RoomId) => {
      setActiveRoomId(id);
      markRoomRead(id);
    },
    [markRoomRead],
  );

  const jumpToMessage = useCallback(
    (roomId: RoomId, messageId: MessageId) => {
      const index = messages
        .filter((m) => m.roomId === roomId && !m.threadRootId && !m.scheduledFor)
        .sort(compareMessages)
        .findIndex((m) => m.id === messageId);
      setActiveRoomId(roomId);
      // Widen the window far enough back that the target is materialised.
      if (index !== -1) {
        const fromEnd = roomLog.length - index;
        setWindowSize(Math.max(PAGE_SIZE, fromEnd + 10));
      }
      setPendingJump(messageId);
    },
    [messages, roomLog.length],
  );

  const clearJump = useCallback(() => setPendingJump(null), []);

  const setCurrentUserId = useCallback(
    (id: UserId) => {
      setCurrentUserIdState(id);
      // Stay where you are if the account you switch to is also in this room.
      // Jumping to the top of the list on every switch loses the reader's
      // place for no reason, and makes comparing two people's view of the
      // same conversation needlessly fiddly.
      const current = rooms.find((room) => room.id === activeRoomId);
      if (current && !current.archived && current.participantIds.includes(id)) {
        return;
      }
      const first = rooms.find((room) => room.participantIds.includes(id) && !room.archived);
      if (first) setActiveRoomId(first.id);
    },
    [rooms, activeRoomId, userById],
  );

  const searchMessages = useCallback(
    (query: string, roomId?: RoomId) => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return messages
        .filter((message) => {
          if (roomId && message.roomId !== roomId) return false;
          if (isTombstoned(message)) return false;
          if (message.scheduledFor) return false;
          const room = rooms.find((r) => r.id === message.roomId);
          if (!room?.participantIds.includes(currentUserId)) return false;
          const haystack = `${plainText(message.content)} ${message.attachment?.name ?? ""}`;
          return haystack.toLowerCase().includes(q);
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
    },
    [messages, rooms, currentUserId, plainText],
  );

  /* ---------------------------------------------------------------------- */
  /* Drafts                                                                 */
  /* ---------------------------------------------------------------------- */

  const getDraft = useCallback(
    (roomId: RoomId, threadRootId?: MessageId | null) =>
      drafts[draftKey(currentUserId, roomId, threadRootId)],
    [drafts, currentUserId],
  );

  const saveDraft = useCallback(
    (roomId: RoomId, draft: Omit<Draft, "updatedAt">, threadRootId?: MessageId | null) => {
      const key = draftKey(currentUserId, roomId, threadRootId);
      setDrafts((current) => {
        if (!draft.text.trim()) {
          if (!(key in current)) return current;
          const next = { ...current };
          delete next[key];
          return next;
        }
        return { ...current, [key]: { ...draft, updatedAt: Date.now() } };
      });
    },
    [currentUserId],
  );

  const clearDraft = useCallback(
    (roomId: RoomId, threadRootId?: MessageId | null) => {
      const key = draftKey(currentUserId, roomId, threadRootId);
      setDrafts((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [currentUserId],
  );

  const draftRoomIds = useCallback(() => {
    const prefix = `${currentUserId}:`;
    return Object.keys(drafts)
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length).split(":")[0]!)
      .filter((roomId, index, list) => list.indexOf(roomId) === index);
  }, [drafts, currentUserId]);

  /* ---------------------------------------------------------------------- */
  /* Room management                                                        */
  /* ---------------------------------------------------------------------- */

  const systemMessage = useCallback((roomId: RoomId, content: string): SharedMessage => {
    const id = newId("m");
    return {
      id,
      clientId: newId("c"),
      roomId,
      senderId: "system",
      content,
      timestamp: Date.now(),
      system: true,
      delivery: "delivered",
    };
  }, []);

  const openDirect = useCallback(
    (otherUserId: UserId) => {
      const existing = rooms.find(
        (room) =>
          room.type === "direct" &&
          room.participantIds.length === 2 &&
          room.participantIds.includes(currentUserId) &&
          room.participantIds.includes(otherUserId),
      );
      if (existing) {
        setActiveRoom(existing.id);
        return existing.id;
      }
      const id = `d-${newId()}`;
      setRooms((current) => [
        ...current,
        {
          id,
          type: "direct",
          createdAt: Date.now(),
          adminIds: [],
          participantIds: [currentUserId, otherUserId],
          mutedUserIds: [],
        },
      ]);
      setActiveRoom(id);
      return id;
    },
    [rooms, currentUserId, setActiveRoom],
  );

  const createGroup = useCallback<ChatContextValue["createGroup"]>(
    ({ name, description, participantIds }) => {
      const id = `g-${newId()}`;
      const members = Array.from(new Set([currentUserId, ...participantIds]));
      const room: Room = {
        id,
        type: "group",
        name,
        description,
        createdBy: currentUserId,
        createdAt: Date.now(),
        adminIds: [currentUserId],
        participantIds: members,
        groupMuted: false,
        mutedUserIds: [],
        invite: {
          code: newId().toUpperCase().slice(0, 6),
          createdAt: Date.now(),
          expiresAt: Date.now() + 7 * 86400000,
          maxUses: 50,
          uses: 0,
        },
        color: "#7dd3fc",
      };
      setRooms((current) => [...current, room]);
      setMessages((current) => [
        ...current,
        systemMessage(
          id,
          `${userById(currentUserId).name} created “${name}” with ${members.length} members.`,
        ),
      ]);
      setActiveRoom(id);
      notify(id, `${userById(currentUserId).name} created “${name}”`, {
        kind: "system",
        actorId: currentUserId,
      });
      toast.success(`Group “${name}” created`);
      return id;
    },
    [currentUserId, userById, setActiveRoom, notify, systemMessage],
  );

  const createGroupDm = useCallback(
    (participantIds: UserId[]) => {
      const members = Array.from(new Set([currentUserId, ...participantIds]));
      const existing = rooms.find(
        (room) =>
          room.type === "groupdm" &&
          room.participantIds.length === members.length &&
          members.every((id) => room.participantIds.includes(id)),
      );
      if (existing) {
        setActiveRoom(existing.id);
        return existing.id;
      }
      const id = `gd-${newId()}`;
      setRooms((current) => [
        ...current,
        {
          id,
          type: "groupdm",
          createdAt: Date.now(),
          createdBy: currentUserId,
          adminIds: [],
          participantIds: members,
          mutedUserIds: [],
          color: "#f59e0b",
        },
      ]);
      setActiveRoom(id);
      toast.success(`Group message with ${members.length - 1} people`);
      return id;
    },
    [rooms, currentUserId, setActiveRoom],
  );

  const patchRoom = useCallback((roomId: RoomId, patch: Partial<Room>) => {
    setRooms((current) =>
      current.map((room) => (room.id === roomId ? { ...room, ...patch } : room)),
    );
  }, []);

  const renameRoom = useCallback(
    (roomId: RoomId, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      patchRoom(roomId, { name: trimmed });
      const update = systemMessage(
        roomId,
        `${userById(currentUserId).name} renamed the conversation to “${trimmed}”.`,
      );
      setMessages((current) => [...current, update]);
      notify(roomId, `${userById(currentUserId).name} renamed the group to “${trimmed}”`, {
        kind: "system",
        actorId: currentUserId,
        messageId: update.id,
      });
      toast.success("Conversation renamed");
    },
    [patchRoom, systemMessage, userById, currentUserId, notify],
  );

  const setRoomTopic = useCallback(
    (roomId: RoomId, topic: string) => {
      patchRoom(roomId, { topic: topic.trim() });
      setMessages((current) => [
        ...current,
        systemMessage(
          roomId,
          topic.trim()
            ? `${userById(currentUserId).name} set the topic to “${topic.trim()}”.`
            : `${userById(currentUserId).name} cleared the topic.`,
        ),
      ]);
    },
    [patchRoom, systemMessage, userById, currentUserId],
  );

  const setRoomDescription = useCallback(
    (roomId: RoomId, description: string) => {
      patchRoom(roomId, { description: description.trim() });
      toast.success("Description updated");
    },
    [patchRoom],
  );

  const updateGroupPhoto = useCallback(
    (roomId: RoomId, photo: Room["photo"] | null) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      if (!room || room.type === "direct" || !room.participantIds.includes(currentUserId)) {
        toast.error("Only group members can change the group photo.");
        return false;
      }

      patchRoom(roomId, { photo: photo ?? undefined });
      const actor = userById(currentUserId).name;
      const action = photo ? "changed" : "removed";
      const update = systemMessage(roomId, `${actor} ${action} the group photo.`);
      setMessages((current) => [...current, update]);

      notify(roomId, `${actor} ${action} the group photo`, {
        kind: "system",
        actorId: currentUserId,
        messageId: update.id,
      });
      toast.success(photo ? "Group photo updated" : "Group photo removed");
      return true;
    },
    [rooms, currentUserId, patchRoom, userById, systemMessage, notify],
  );

  const addMembers = useCallback(
    (roomId: RoomId, userIds: UserId[]) => {
      if (userIds.length === 0) return;
      setRooms((current) =>
        current.map((room) =>
          room.id === roomId
            ? {
                ...room,
                participantIds: Array.from(new Set([...room.participantIds, ...userIds])),
              }
            : room,
        ),
      );
      const names = userIds.map((id) => userById(id).name).join(", ");
      const update = systemMessage(roomId, `${userById(currentUserId).name} added ${names}.`);
      setMessages((current) => [...current, update]);
      // Fired after the membership change so the new members are in the room's
      // audience and see the event that added them.
      notify(roomId, `${userById(currentUserId).name} added ${names}`, {
        kind: "system",
        actorId: currentUserId,
        messageId: update.id,
      });
      toast.success(userIds.length === 1 ? "Member added" : `${userIds.length} members added`);
    },
    [systemMessage, userById, currentUserId, notify],
  );

  const removeMember = useCallback(
    (roomId: RoomId, userId: UserId) => {
      setRooms((current) =>
        current.map((room) =>
          room.id === roomId
            ? {
                ...room,
                participantIds: room.participantIds.filter((id) => id !== userId),
                adminIds: room.adminIds.filter((id) => id !== userId),
                mutedUserIds: room.mutedUserIds.filter((id) => id !== userId),
              }
            : room,
        ),
      );
      const update = systemMessage(
        roomId,
        `${userById(userId).name} was removed from the conversation.`,
      );
      setMessages((current) => [...current, update]);
      notify(
        roomId,
        `${userById(currentUserId).name} removed ${userById(userId).name} from the group`,
        { kind: "system", actorId: currentUserId, messageId: update.id },
      );
      toast.success("Member removed");
    },
    [systemMessage, userById, notify, currentUserId],
  );

  const toggleAdmin = useCallback(
    (roomId: RoomId, userId: UserId) => {
      const room = roomsRef.current.find((candidate) => candidate.id === roomId);
      if (!room) return;
      const isCurrentlyAdmin = room.adminIds.includes(userId);
      // Never strip the last admin — the room would become unmanageable.
      if (isCurrentlyAdmin && room.adminIds.length === 1) {
        toast.error("A conversation needs at least one admin.");
        return;
      }
      setRooms((current) =>
        current.map((candidate) =>
          candidate.id === roomId
            ? {
                ...candidate,
                adminIds: isCurrentlyAdmin
                  ? candidate.adminIds.filter((id) => id !== userId)
                  : [...candidate.adminIds, userId],
              }
            : candidate,
        ),
      );
      notify(
        roomId,
        isCurrentlyAdmin
          ? `${userById(currentUserId).name} removed ${userById(userId).name} as an admin`
          : `${userById(currentUserId).name} made ${userById(userId).name} an admin`,
        { kind: "system", actorId: currentUserId },
      );
      toast.success(isCurrentlyAdmin ? "Admin removed" : "Admin added");
    },
    [notify, userById, currentUserId],
  );

  const leaveRoom = useCallback(
    (roomId: RoomId) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      if (
        room.adminIds.length === 1 &&
        room.adminIds[0] === currentUserId &&
        room.participantIds.length > 1
      ) {
        toast.error("Promote another admin before leaving.");
        return;
      }
      setRooms((current) =>
        current.map((r) =>
          r.id === roomId
            ? {
                ...r,
                participantIds: r.participantIds.filter((id) => id !== currentUserId),
                adminIds: r.adminIds.filter((id) => id !== currentUserId),
              }
            : r,
        ),
      );
      const update = systemMessage(
        roomId,
        `${userById(currentUserId).name} left the conversation.`,
      );
      setMessages((current) => [...current, update]);
      notify(roomId, `${userById(currentUserId).name} left the group`, {
        kind: "system",
        actorId: currentUserId,
        // The leaver is no longer a participant, so name the audience explicitly.
        audience: room.participantIds.filter((id) => id !== currentUserId),
        messageId: update.id,
      });
      const fallback = rooms.find(
        (r) => r.id !== roomId && r.participantIds.includes(currentUserId) && !r.archived,
      );
      if (fallback) setActiveRoomId(fallback.id);
      toast.success("You left the conversation");
    },
    [rooms, currentUserId, systemMessage, userById, notify],
  );

  const setArchived = useCallback(
    (roomId: RoomId, archived: boolean) => {
      patchRoom(
        roomId,
        archived ? { archived: true, archivedAt: Date.now() } : { archived: false },
      );
      if (archived) {
        const fallback = rooms.find(
          (r) => r.id !== roomId && r.participantIds.includes(currentUserId) && !r.archived,
        );
        if (fallback) setActiveRoomId(fallback.id);
      }
      toast.success(archived ? "Conversation archived" : "Conversation restored");
    },
    [patchRoom, rooms, currentUserId],
  );

  const toggleGroupMute = useCallback(
    (roomId: RoomId) => {
      const room = roomsRef.current.find((candidate) => candidate.id === roomId);
      if (!room) return;
      const groupMuted = !room.groupMuted;
      setRooms((current) =>
        current.map((candidate) =>
          candidate.id === roomId ? { ...candidate, groupMuted } : candidate,
        ),
      );
      // Recorded as `system`, not `room`: a mute change is exactly the event
      // that must still reach everyone once the room has been muted.
      notify(
        roomId,
        groupMuted
          ? `${userById(currentUserId).name} muted messaging for everyone`
          : `${userById(currentUserId).name} re-enabled messaging for everyone`,
        { kind: "system", actorId: currentUserId },
      );
      toast[groupMuted ? "warning" : "success"](
        groupMuted ? "Group messaging muted by admin" : "Group messaging enabled",
      );
    },
    [notify, userById, currentUserId],
  );

  const toggleUserMute = useCallback(
    (roomId: RoomId, userId: UserId) => {
      const room = roomsRef.current.find((candidate) => candidate.id === roomId);
      if (!room) return;
      const muted = room.mutedUserIds.includes(userId);
      setRooms((current) =>
        current.map((candidate) =>
          candidate.id === roomId
            ? {
                ...candidate,
                mutedUserIds: muted
                  ? candidate.mutedUserIds.filter((id) => id !== userId)
                  : [...candidate.mutedUserIds, userId],
              }
            : candidate,
        ),
      );
      notify(
        roomId,
        `${userById(currentUserId).name} ${muted ? "unmuted" : "muted"} ${userById(userId).name}`,
        { kind: "system", actorId: currentUserId },
      );
      toast[muted ? "success" : "warning"](
        `${userById(userId).name} ${muted ? "unmuted" : "muted"}`,
      );
    },
    [userById, notify, currentUserId],
  );

  const notificationLevel = useCallback(
    (roomId: RoomId): NotificationLevel =>
      rooms.find((room) => room.id === roomId)?.notificationLevels?.[currentUserId] ?? "all",
    [rooms, currentUserId],
  );

  const setNotificationLevel = useCallback(
    (roomId: RoomId, level: NotificationLevel) => {
      setRooms((current) =>
        current.map((room) =>
          room.id === roomId
            ? {
                ...room,
                notificationLevels: { ...(room.notificationLevels ?? {}), [currentUserId]: level },
              }
            : room,
        ),
      );
      toast.success(
        level === "all"
          ? "Notifying for all messages"
          : level === "mentions"
            ? "Notifying for mentions only"
            : "Notifications off for this conversation",
      );
    },
    [currentUserId],
  );

  const toggleRoomNotifications = useCallback(
    (roomId: RoomId) => {
      const level = notificationLevel(roomId);
      setNotificationLevel(roomId, level === "none" ? "all" : "none");
    },
    [notificationLevel, setNotificationLevel],
  );

  /* ---------------------------------------------------------------------- */
  /* Invites                                                                */
  /* ---------------------------------------------------------------------- */

  const inviteStatus = useCallback(
    (invite: Invite | null | undefined) => inviteIsUsable(invite),
    [],
  );

  const createInvite = useCallback<ChatContextValue["createInvite"]>(
    (roomId, { expiresInMs, maxUses }) => {
      patchRoom(roomId, {
        invite: {
          // 10 chars from a CSPRNG, not 6 from Math.random: a 6-char code over
          // 36 symbols is ~2 billion, which is brute-forceable without a
          // server-side attempt limiter (which this deployment does not have).
          code: newId().toUpperCase().slice(0, 10),
          createdAt: Date.now(),
          expiresAt: expiresInMs === null ? null : Date.now() + expiresInMs,
          maxUses,
          uses: 0,
        },
      });
      notify(roomId, `${userById(currentUserId).name} generated a new invite link`, {
        kind: "system",
        actorId: currentUserId,
      });
      toast.success("New invite link generated");
    },
    [patchRoom, notify, userById, currentUserId],
  );

  const revokeInvite = useCallback(
    (roomId: RoomId) => {
      patchRoom(roomId, { invite: null });
      notify(roomId, `${userById(currentUserId).name} revoked the invite link`, {
        kind: "system",
        actorId: currentUserId,
      });
      toast.warning("Invite link revoked");
    },
    [patchRoom, notify, userById, currentUserId],
  );

  const roomByCode = useCallback(
    (code: string) => rooms.find((room) => room.invite?.code === code) ?? null,
    [rooms],
  );

  const joinByCode = useCallback(
    (code: string): { room: Room | null; error?: string } => {
      const room = rooms.find((r) => r.invite?.code === code);
      if (!room) return { room: null, error: "This invite link is not valid." };

      const status = inviteStatus(room.invite);
      if (status === "expired") return { room: null, error: "This invite link has expired." };
      if (status === "exhausted")
        return { room: null, error: "This invite link has reached its usage limit." };

      const alreadyIn = room.participantIds.includes(currentUserId);
      setRooms((current) =>
        current.map((r) => {
          if (r.id !== room.id) return r;
          return {
            ...r,
            participantIds: alreadyIn ? r.participantIds : [...r.participantIds, currentUserId],
            invite: r.invite && !alreadyIn ? { ...r.invite, uses: r.invite.uses + 1 } : r.invite,
          };
        }),
      );
      if (!alreadyIn) {
        const update = systemMessage(
          room.id,
          `${userById(currentUserId).name} joined via invite link.`,
        );
        setMessages((current) => [...current, update]);
        notify(room.id, `${userById(currentUserId).name} joined via invite link`, {
          kind: "system",
          actorId: currentUserId,
          // `roomsRef` still holds the pre-join membership in this tick, so the
          // joiner has to be named explicitly to see their own arrival.
          audience: [...room.participantIds, currentUserId],
          messageId: update.id,
        });
      }
      setActiveRoomId(room.id);
      return { room };
    },
    [rooms, currentUserId, inviteStatus, systemMessage, userById, notify],
  );

  /* ---------------------------------------------------------------------- */
  /* AI assistant                                                           */
  /* ---------------------------------------------------------------------- */

  const aiConversation = useCallback(
    (roomId: RoomId) =>
      aiMessages
        .filter((message) => message.roomId === roomId && message.ownerUserId === currentUserId)
        .sort((a, b) => a.timestamp - b.timestamp),
    [aiMessages, currentUserId],
  );

  const chargeBudget = useCallback((tokens: number) => {
    setAiBudget((current) => {
      const now = Date.now();
      if (now >= current.resetAt) {
        return { used: tokens, limit: AI_TOKEN_BUDGET, resetAt: now + AI_BUDGET_WINDOW };
      }
      return { ...current, used: current.used + tokens };
    });
  }, []);

  const runAgent = useCallback(
    async (
      roomId: RoomId,
      prompt: string,
      aiId: string,
      owner: UserId,
      conversationId: string,
      mode: "chat" | "summary" = "chat",
    ) => {
      // Prior turns in this conversation, so follow-ups actually have context.
      const history = aiMessages
        .filter(
          (message) =>
            message.conversationId === conversationId && message.id !== aiId && !message.error,
        )
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-6)
        .flatMap((message) => [
          { role: "user" as const, content: message.prompt },
          { role: "assistant" as const, content: message.response },
        ])
        .filter((turn) => turn.content.trim().length > 0);

      const context = messages
        .filter(
          (message) => message.roomId === roomId && !isTombstoned(message) && !message.scheduledFor,
        )
        .sort(compareMessages)
        .slice(mode === "summary" ? -60 : -14)
        .map((message) => `${userById(message.senderId).name}: ${plainText(previewText(message))}`)
        .join("\n");

      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            context,
            history,
            mode,
            userName: userById(owner).name,
            stream: true,
          }),
        });

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "AI request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let text = "";

        setAiMessages((current) =>
          current.map((message) =>
            message.id === aiId ? { ...message, pending: false, streaming: true } : message,
          ),
        );

        // Server-sent events: one JSON payload per `data:` line.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let event: { delta?: string; error?: string };
            try {
              event = JSON.parse(payload) as { delta?: string; error?: string };
            } catch {
              continue;
            }
            if (event.error) throw new Error(event.error);
            if (event.delta) {
              text += event.delta;
              const snapshot = text;
              setAiMessages((current) =>
                current.map((message) =>
                  message.id === aiId ? { ...message, response: snapshot } : message,
                ),
              );
            }
          }
        }

        const tokens = Math.ceil((prompt.length + text.length) / 3.6);
        chargeBudget(tokens);
        setAiMessages((current) =>
          current.map((message) =>
            message.id === aiId
              ? { ...message, response: text, pending: false, streaming: false, tokensUsed: tokens }
              : message,
          ),
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : "AI request failed";
        toast.error(reason);
        setAiMessages((current) =>
          current.map((message) =>
            message.id === aiId
              ? { ...message, response: reason, pending: false, streaming: false, error: true }
              : message,
          ),
        );
      }
    },
    [aiMessages, messages, userById, plainText, chargeBudget],
  );

  const askAgent = useCallback(
    async (roomId: RoomId, prompt: string) => {
      if (aiBudget.used >= aiBudget.limit && Date.now() < aiBudget.resetAt) {
        toast.error("You've used your AI allowance for today.");
        return;
      }
      // One conversation per room per user, so follow-ups thread naturally.
      const existing = aiConversation(roomId)[0];
      const conversationId = existing?.conversationId ?? newId("conv");
      const aiId = newId("ai");
      setAiMessages((current) => [
        ...current,
        {
          id: aiId,
          roomId,
          ownerUserId: currentUserId,
          prompt,
          response: "",
          timestamp: Date.now(),
          pending: true,
          conversationId,
          kind: "chat",
        },
      ]);
      await runAgent(roomId, prompt, aiId, currentUserId, conversationId, "chat");
    },
    [aiBudget, aiConversation, currentUserId, runAgent],
  );

  const summarizeRoom = useCallback(
    async (roomId: RoomId) => {
      const marker = readState[roomId]?.[currentUserId];
      const missed = messages.filter(
        (message) =>
          message.roomId === roomId &&
          !message.scheduledFor &&
          message.timestamp > (marker?.lastReadTimestamp ?? 0),
      ).length;
      const aiId = newId("ai");
      const conversationId = newId("conv");
      const prompt = missed
        ? `Catch me up on the ${missed} messages I haven't read in this conversation. Lead with anything addressed to me or needing a decision.`
        : "Summarise this conversation and list any open action items.";

      setAiMessages((current) => [
        ...current,
        {
          id: aiId,
          roomId,
          ownerUserId: currentUserId,
          prompt: missed ? `Catch me up (${missed} unread)` : "Summarise this conversation",
          response: "",
          timestamp: Date.now(),
          pending: true,
          conversationId,
          kind: "summary",
        },
      ]);
      await runAgent(roomId, prompt, aiId, currentUserId, conversationId, "summary");
    },
    [readState, currentUserId, messages, runAgent],
  );

  const regenerateAgent = useCallback(
    async (aiId: string) => {
      const target = aiMessages.find((message) => message.id === aiId);
      if (!target) return;
      setAiMessages((current) =>
        current.map((message) =>
          message.id === aiId
            ? { ...message, pending: true, streaming: false, error: false, response: "" }
            : message,
        ),
      );
      await runAgent(
        target.roomId,
        target.prompt,
        aiId,
        target.ownerUserId,
        target.conversationId,
        target.kind ?? "chat",
      );
    },
    [aiMessages, runAgent],
  );

  const shareAiToChat = useCallback(
    (aiId: string) => {
      const target = aiMessages.find((message) => message.id === aiId);
      if (!target || target.pending || target.streaming) return;
      const message = buildMessage(target.roomId, target.response, { sharedFromAi: true });
      setMessages((current) => [...current, message]);
      void dispatchSend(message);
      toast.success("AI response shared with the room");
    },
    [aiMessages, buildMessage, dispatchSend],
  );

  /* ---------------------------------------------------------------------- */
  /* Notifications                                                          */
  /* ---------------------------------------------------------------------- */

  const notificationsFor = useCallback(
    (roomId: RoomId, userId: UserId = currentUserId) =>
      notifications
        .filter(
          (notification) =>
            notification.roomId === roomId && notificationTargets(notification, userId),
        )
        .sort((a, b) => b.timestamp - a.timestamp),
    [notifications, currentUserId],
  );

  const countUnread = useCallback(
    (roomId: RoomId, userId: UserId, mentions: boolean) =>
      notifications.filter(
        (notification) =>
          notification.roomId === roomId &&
          (notification.kind === "mention") === mentions &&
          notificationTargets(notification, userId) &&
          !notificationIsRead(notification, userId),
      ).length,
    [notifications],
  );

  const unreadMentionCount = useCallback(
    (roomId: RoomId, userId: UserId = currentUserId) => countUnread(roomId, userId, true),
    [countUnread, currentUserId],
  );

  const unreadActivityCount = useCallback(
    (roomId: RoomId, userId: UserId = currentUserId) => countUnread(roomId, userId, false),
    [countUnread, currentUserId],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((current) => {
        let changed = false;
        const next = current.map((notification) => {
          if (notification.id !== id) return notification;
          if (notification.readBy.includes(currentUserId)) return notification;
          changed = true;
          return { ...notification, readBy: [...notification.readBy, currentUserId] };
        });
        return changed ? next : current;
      });
    },
    [currentUserId],
  );

  /**
   * Marks a room's notifications read for the viewer. `scope` lets the panel
   * clear just the section the user actually opened.
   */
  const markRoomNotificationsRead = useCallback(
    (roomId: RoomId, scope?: "mentions" | "activity") => {
      setNotifications((current) => {
        let changed = false;
        const next = current.map((notification) => {
          if (notification.roomId !== roomId) return notification;
          if (scope === "mentions" && notification.kind !== "mention") return notification;
          if (scope === "activity" && notification.kind === "mention") return notification;
          if (!notificationTargets(notification, currentUserId)) return notification;
          if (notification.readBy.includes(currentUserId)) return notification;
          changed = true;
          return { ...notification, readBy: [...notification.readBy, currentUserId] };
        });
        return changed ? next : current;
      });
    },
    [currentUserId],
  );

  /**
   * The oldest message in the room that names the viewer and sits past their
   * read marker — what the "new mentions" divider anchors to.
   */
  const firstUnreadMentionId = useCallback(
    (roomId: RoomId): MessageId | null => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      if (!room) return null;
      const since = readState[roomId]?.[currentUserId]?.lastReadTimestamp ?? 0;
      const unread = messages
        .filter(
          (message) =>
            message.roomId === roomId &&
            !message.scheduledFor &&
            !message.threadRootId &&
            message.senderId !== currentUserId &&
            message.timestamp > since &&
            (message.mentionIds?.includes(currentUserId) ||
              mentionsUser(message.mentions, currentUserId, room, users, userGroups)),
        )
        .sort(compareMessages);
      return unread[0]?.id ?? null;
    },
    [messages, readState, currentUserId, rooms, users, userGroups],
  );

  /**
   * Live pulse: a mention that lands while the viewer is reading somewhere
   * else gets one toast, with a way straight to it. Whatever is already on
   * screen when the session starts is seeded as seen, so a reload does not
   * replay a backlog.
   */
  const toastedMentions = useRef<Set<string> | null>(null);
  useEffect(() => {
    const fresh = notifications.filter(
      (notification) =>
        notification.kind === "mention" &&
        notificationTargets(notification, currentUserId) &&
        !notificationIsRead(notification, currentUserId),
    );

    if (toastedMentions.current === null) {
      toastedMentions.current = new Set(fresh.map((notification) => notification.id));
      return;
    }

    const seen = toastedMentions.current;
    for (const notification of fresh) {
      if (seen.has(notification.id)) continue;
      seen.add(notification.id);
      if (notification.roomId === activeRoomId) continue;
      const room = rooms.find((candidate) => candidate.id === notification.roomId);
      if (!room) continue;
      const actor = notification.actorId ? userById(notification.actorId).name : "Someone";
      toast.info(`${actor} mentioned you in ${roomTitle(room)}`, {
        action: {
          label: "View",
          onClick: () => {
            if (notification.messageId) jumpToMessage(notification.roomId, notification.messageId);
            else setActiveRoomId(notification.roomId);
          },
        },
      });
    }
  }, [notifications, currentUserId, activeRoomId, rooms, userById, roomTitle, jumpToMessage]);

  const outbox = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.senderId === currentUserId &&
          !message.scheduledFor &&
          (message.delivery === "failed" || message.delivery === "sending"),
      ),
    [messages, currentUserId],
  );

  const lastMessage = useCallback(
    (roomId: RoomId) => {
      const list = messages
        .filter(
          (message) => message.roomId === roomId && !message.threadRootId && !message.scheduledFor,
        )
        .sort(compareMessages);
      return list[list.length - 1];
    },
    [messages],
  );

  /**
   * The recovery path for a full device: drop the stored bytes of the oldest
   * attachments, keeping the messages themselves. Placeholders replace the
   * media so the history still reads correctly.
   */
  const reclaimAttachmentSpace = useCallback(async () => {
    const withBlobs = messages
      .filter((message) => message.attachment?.blobId && !message.attachment.unavailable)
      .sort(compareMessages);
    // Half the oldest is enough to get writing again without gutting recent
    // conversation, and the user can run it twice.
    const targets = withBlobs.slice(0, Math.ceil(withBlobs.length / 2));
    if (targets.length === 0) {
      toast.info("There are no stored attachments to clear.");
      return 0;
    }
    const ids = new Set(targets.map((message) => message.id));
    setMessages((current) =>
      current.map((message) =>
        ids.has(message.id) && message.attachment
          ? { ...message, attachment: { ...message.attachment, dataUrl: "", unavailable: true } }
          : message,
      ),
    );
    const keep = referencedBlobIds(messages.filter((message) => !ids.has(message.id)));
    await collectOrphanBlobs(keep);
    toast.success(`Cleared ${targets.length} stored attachment${targets.length === 1 ? "" : "s"}.`);
    return targets.length;
  }, [messages]);

  /* ---------------------------------------------------------------------- */
  /* Meetings                                                               */
  /* ---------------------------------------------------------------------- */

  const createMeeting = useCallback<ChatContextValue["createMeeting"]>(
    async (roomId) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      if (!room) return;
      if (room.type !== "direct" || !room.participantIds.includes(currentUserId)) {
        toast.info("Instant meeting links are available in personal messages only.");
        return;
      }
      const permission = canSend(room, currentUserId);
      if (!permission.allowed) {
        toast.error(
          permission.reason === "archived"
            ? "This conversation is archived."
            : "You can't post in this group right now.",
        );
        return;
      }

      let payload: { meetingUri?: string; demo?: boolean; error?: string };
      try {
        const response = await fetch("/api/meet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        });
        payload = (await response.json().catch(() => ({}))) as typeof payload;
        if (!response.ok) {
          toast.error(payload.error ?? "Could not create a meeting link.");
          return;
        }
      } catch {
        toast.error("Could not reach the meeting service. Check your network.");
        return;
      }

      if (!payload.meetingUri) {
        toast.error("Could not create a meeting link.");
        return;
      }

      sendMessage(roomId, `Started a Google Meet — join here: ${payload.meetingUri}`);
      if (payload.demo) {
        toast.info("Google credentials aren't configured, so that link is a placeholder.");
      }
    },
    [rooms, canSend, currentUserId, sendMessage],
  );

  const scheduleMeeting = useCallback<ChatContextValue["scheduleMeeting"]>(
    async (input) => {
      const room = rooms.find((candidate) => candidate.id === input.roomId);
      if (!room || !room.participantIds.includes(currentUserId)) {
        toast.error("That conversation is not available.");
        return null;
      }

      if (room.archived) {
        toast.error("This conversation is archived.");
        return null;
      }

      const title = input.title.trim();
      const description = input.description?.trim();
      const attendeeIds = [...new Set(input.attendeeIds)].filter((id) => id !== currentUserId);
      const durationMinutes = Number(input.durationMinutes);
      const endAt = input.startAt + durationMinutes * 60_000;
      if (
        !title ||
        !Number.isFinite(input.startAt) ||
        input.startAt <= Date.now() ||
        !Number.isFinite(durationMinutes) ||
        durationMinutes <= 0 ||
        !Number.isFinite(endAt)
      ) {
        toast.error("Choose a valid future time and duration.");
        return null;
      }
      if (attendeeIds.length === 0 || attendeeIds.some((id) => !room.participantIds.includes(id))) {
        toast.error("Choose at least one member from this conversation.");
        return null;
      }

      const attendeeUsers = attendeeIds.map((id) => users.find((user) => user.id === id));
      if (attendeeUsers.some((user) => !user?.email)) {
        toast.error("Every selected member needs a Calendar email address.");
        return null;
      }

      const requestId = newId("meeting");
      type ScheduledPayload = {
        meetingUri?: string;
        eventId?: string;
        calendarUri?: string;
        calendarEventId?: string;
        calendarEventUrl?: string;
        demo?: boolean;
        error?: string;
      };
      let payload: ScheduledPayload;
      try {
        const response = await fetch("/api/meet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "scheduled",
            requestId,
            roomId: input.roomId,
            title,
            ...(description ? { description } : {}),
            startAt: input.startAt,
            endAt,
            timeZone: input.timeZone,
            organizer: {
              id: currentUserId,
              name: userById(currentUserId).name,
              email: userById(currentUserId).email,
            },
            attendees: attendeeUsers.map((user) => ({
              id: user!.id,
              name: user!.name,
              email: user!.email!,
            })),
          }),
        });
        payload = (await response.json().catch(() => ({}))) as ScheduledPayload;
        if (!response.ok) {
          toast.error(payload.error ?? "Could not schedule the meeting.");
          return null;
        }
      } catch {
        toast.error("Could not reach the meeting service. Check your network.");
        return null;
      }

      if (!payload.meetingUri) {
        toast.error("The meeting service returned no Google Meet link.");
        return null;
      }

      const calendarEventId = payload.calendarEventId ?? payload.eventId;
      const calendarEventUrl = payload.calendarEventUrl ?? payload.calendarUri;
      const meeting: ScheduledMeeting = {
        id: requestId,
        roomId: input.roomId,
        organizerId: currentUserId,
        attendeeIds,
        title,
        ...(description ? { description } : {}),
        startAt: input.startAt,
        endAt,
        timeZone: input.timeZone,
        meetingUri: payload.meetingUri,
        ...(calendarEventId ? { calendarEventId } : {}),
        ...(calendarEventUrl ? { calendarEventUrl } : {}),
        demo: Boolean(payload.demo),
        createdAt: Date.now(),
      };

      setMeetings((current) =>
        current.some((candidate) => candidate.id === meeting.id) ? current : [...current, meeting],
      );

      const calendarLink = meeting.calendarEventUrl
        ? ` [Open in Google Calendar](${meeting.calendarEventUrl})`
        : "";
      const notice = buildMessage(
        meeting.roomId,
        `@agent scheduled **${meeting.title}** for ${formatDateTime(meeting.startAt, { timeZone: meeting.timeZone })}.${calendarLink}`,
        {
          id: `meeting-${meeting.id}-scheduled`,
          clientId: `meeting-${meeting.id}-scheduled-client`,
          sharedFromAi: true,
          meetingId: meeting.id,
          meetingNotice: "scheduled",
        },
      );
      setMessages((current) =>
        current.some((message) => message.id === notice.id) ? current : [...current, notice],
      );
      void dispatchSend(notice);
      notify(
        meeting.roomId,
        `${userById(currentUserId).name} scheduled “${meeting.title}” for ${formatDateTime(meeting.startAt, { timeZone: meeting.timeZone })}`,
        {
          id: `meeting-${meeting.id}-scheduled-note`,
          kind: "agent",
          actorId: currentUserId,
          audience: [...new Set([currentUserId, ...attendeeIds])],
          messageId: notice.id,
        },
      );

      toast.success("Meeting scheduled and Calendar invitations sent");
      if (meeting.demo) {
        toast.info("Google Calendar isn't configured, so this is a demo event.");
      }
      return meeting;
    },
    [rooms, currentUserId, users, userById, buildMessage, dispatchSend, notify],
  );

  const dismissStorageWarning = useCallback(() => setStorageWarningDismissed(true), []);

  const value: ChatContextValue = {
    users,
    userGroups,
    currentUser: userById(currentUserId),
    currentUserId,
    setCurrentUserId,
    userById,

    rooms,
    visibleRooms,
    archivedRooms,
    activeRoom,
    activeRoomId,
    setActiveRoom,
    roomTitle,
    canSend,
    isAdmin,

    messages,
    channelMessages,
    hasMoreHistory,
    loadOlder,
    messageById,
    lastMessage,

    sendMessage,
    sendAttachment,
    createMeeting,
    scheduleMeeting,
    meetings,
    meetingById,
    editMessage,
    deleteMessage,
    retryMessage,
    discardMessage,
    forwardMessage,
    toggleReaction,
    togglePin,
    toggleSave,
    isSaved,
    savedMessages,
    pinnedMessages,
    permalinkFor,

    scheduleMessage,
    scheduledMessages,
    cancelScheduled,
    sendScheduledNow,

    threadReplies,
    threadCount,
    threadParticipants,
    isFollowingThread,
    toggleFollowThread,

    readState,
    markRoomRead,
    unreadFor,
    readersOf,

    getDraft,
    saveDraft,
    clearDraft,
    draftRoomIds,

    openDirect,
    createGroup,
    createGroupDm,
    renameRoom,
    setRoomTopic,
    setRoomDescription,
    updateGroupPhoto,
    addMembers,
    removeMember,
    toggleAdmin,
    leaveRoom,
    setArchived,
    toggleGroupMute,
    toggleUserMute,
    setNotificationLevel,
    notificationLevel,
    toggleRoomNotifications,

    createInvite,
    revokeInvite,
    inviteStatus,
    roomByCode,
    joinByCode,

    aiMessages,
    askAgent,
    regenerateAgent,
    shareAiToChat,
    summarizeRoom,
    aiBudget,
    aiConversation,

    notificationsFor,
    unreadMentionCount,
    unreadActivityCount,
    markNotificationRead,
    markRoomNotificationsRead,
    firstUnreadMentionId,

    online,
    setOnline,
    outbox,

    storageReady,
    storageStatus,
    showStorageWarning: !storageStatus.saved && !storageWarningDismissed,
    reclaimAttachmentSpace,
    dismissStorageWarning,

    pendingJump,
    jumpToMessage,
    clearJump,
    searchMessages,
    plainText,
  };

  // Presence heartbeat stand-in: keeps the seeded directory honest about the
  // viewer being online. A real client would drive this from the socket.
  useEffect(() => {
    setUsers((current) =>
      current.map((user) => (user.id === currentUserId ? { ...user, online: true } : user)),
    );
  }, [currentUserId]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}

export { encodeCursor };
