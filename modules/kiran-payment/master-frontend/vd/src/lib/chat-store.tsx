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
import { backoffDelay, newId, TransportError } from "./transport";
import {
  applyOp,
  foldOps,
  type ChatOp,
  type Notice,
  type OpEntry,
  type Workspace,
} from "./chat-ops";
import { createLocalLog, type OpLog } from "./chat-log";
import { inviteIsUsable } from "./invite-rules";

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

/** One of this device's ops that the log has not yet confirmed. */
interface PendingOp {
  entry: OpEntry;
  /** `acked`: the log accepted it; its echo has not arrived yet. */
  status: "sending" | "acked" | "failed";
  attempts: number;
  failureReason?: string;
}

const SEED_WORKSPACE: Workspace = {
  users: SEED_USERS,
  groups: SEED_GROUPS,
  rooms: SEED_ROOMS,
  messages: SEED_MESSAGES,
  meetings: [],
  notifications: [],
  readState: {},
  saved: {},
  followedThreads: {},
};

/**
 * A saved snapshot as the store runs now: the confirmed workspace, the
 * outbox, and the scheduled messages.
 *
 * Snapshots written before the operation log kept all three in `messages`:
 * scheduled messages carried `scheduledFor`, and a send still in flight or
 * failed carried its delivery state. Those are separated out here — scheduled
 * into their own list, unsent into outbox entries — so a device upgrading
 * keeps both.
 */
function fromSnapshot(snapshot: PersistedState) {
  const scheduled = [...(snapshot.scheduled ?? [])];
  const outbox = [...(snapshot.outbox ?? [])];
  const messages: SharedMessage[] = [];
  for (const message of snapshot.messages) {
    if (message.scheduledFor) {
      scheduled.push(message);
    } else if (
      !snapshot.outbox &&
      !message.system &&
      (message.delivery === "sending" || message.delivery === "failed")
    ) {
      const {
        roomId,
        senderId,
        timestamp,
        delivery: _delivery,
        attempts: _attempts,
        failureReason: _reason,
        ...draft
      } = message;
      outbox.push({
        opId: message.clientId,
        actor: senderId,
        ts: timestamp,
        op: { type: "message.send", roomId, message: draft },
      });
    } else {
      messages.push(message);
    }
  }
  const workspace: Workspace = {
    ...SEED_WORKSPACE,
    rooms: snapshot.rooms,
    messages,
    meetings: snapshot.meetings,
    notifications: snapshot.notifications,
    readState: snapshot.readState,
    saved: snapshot.saved,
    followedThreads: snapshot.followedThreads,
  };
  return { workspace, outbox, scheduled };
}

export function ChatProvider({ children, log: providedLog }: { children: ReactNode; log?: OpLog }) {
  /**
   * The workspace as the log has confirmed it. Every change reaches it the
   * same way: an entry from the log, folded with `applyOp`.
   */
  const [confirmed, setConfirmed] = useState<Workspace>(SEED_WORKSPACE);
  /** This device's ops the log has not confirmed yet, in the order they were made. */
  const [pending, setPending] = useState<PendingOp[]>([]);
  /** Messages waiting for their send time. Device-only until then. */
  const [scheduled, setScheduled] = useState<SharedMessage[]>([]);
  /** Object URLs for attachments whose bytes are on this device; null when they are gone. */
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string | null>>({});
  const [aiMessages, setAiMessages] = useState<PrivateAIMessage[]>(SEED_AI);
  const [currentUserId, setCurrentUserIdState] = useState<UserId>("u1");
  const [activeRoomId, setActiveRoomId] = useState<RoomId>("r1");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
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

  const [log] = useState<OpLog>(() => providedLog ?? createLocalLog());
  /** The seq of the last confirmed entry; anything at or below it is a repeat. */
  const headRef = useRef(0);

  /**
   * What everyone sees: the confirmed workspace with this device's pending
   * ops folded on top. A change therefore appears the moment it is made, and
   * settles into place — same content, the server's timestamp — when the log
   * confirms it.
   */
  const visible = useMemo(
    () => foldOps(confirmed, pending.map((item) => item.entry)),
    [confirmed, pending],
  );

  const userGroups = visible.groups;
  // Presence stand-in: the viewer is online. A real client would take this
  // from the connection.
  const users = useMemo(
    () =>
      visible.users.map((user) =>
        user.id === currentUserId && !user.online ? { ...user, online: true } : user,
      ),
    [visible.users, currentUserId],
  );
  const rooms = visible.rooms;
  const meetings = visible.meetings;
  const notifications = visible.notifications;
  const readState = visible.readState;
  const saved = visible.saved;
  const followedThreads = visible.followedThreads;

  /**
   * A message's delivery state is a fact about this device's outbox, not
   * about the workspace: confirmed means delivered, and anything still
   * pending shows how its send is going.
   */
  const pendingSends = useMemo(() => {
    const byMessage = new Map<MessageId, PendingOp>();
    for (const item of pending) {
      if (item.entry.op.type === "message.send") byMessage.set(item.entry.op.message.id, item);
    }
    return byMessage;
  }, [pending]);

  const messages = useMemo(
    () =>
      visible.messages.map((message) => {
        let next = message;
        const send = pendingSends.get(message.id);
        if (send) {
          next = {
            ...next,
            delivery:
              send.status === "failed" ? "failed" : send.status === "acked" ? "sent" : "sending",
            attempts: send.attempts,
            ...(send.failureReason ? { failureReason: send.failureReason } : {}),
          };
        }
        const blobId = next.attachment?.blobId;
        if (blobId && next.attachment && blobId in attachmentUrls) {
          const url = attachmentUrls[blobId];
          next = {
            ...next,
            attachment: url
              ? { ...next.attachment, dataUrl: url }
              : { ...next.attachment, dataUrl: "", unavailable: true },
          };
        }
        return next;
      }),
    [visible.messages, pendingSends, attachmentUrls],
  );

  /**
   * Render-time mirrors of state that stable callbacks need to read. Assigning
   * during render (rather than in an effect) keeps them correct for callbacks
   * fired later in the same commit.
   */
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const readStateRef = useRef(readState);
  readStateRef.current = readState;
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  /** Timers for in-flight retries, by opId, cleared on unmount so tests don't leak. */
  const retryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /* ---------------------------------------------------------------------- */
  /* The log                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Send one entry to the log, retrying with backoff while that could help.
   * Its confirmation arrives separately, as an entry from `subscribe`.
   */
  const deliver = useCallback(
    async (entry: OpEntry, attempt: number) => {
      setPending((current) =>
        current.map((item) =>
          item.entry.opId === entry.opId ? { ...item, status: "sending", attempts: attempt } : item,
        ),
      );
      try {
        await log.append(entry);
        setPending((current) =>
          current.map((item) =>
            item.entry.opId === entry.opId && item.status !== "failed"
              ? { ...item, status: "acked", failureReason: undefined }
              : item,
          ),
        );
      } catch (error) {
        const retriable = error instanceof TransportError ? error.retriable : true;
        const reason = error instanceof Error ? error.message : "Send failed";
        setPending((current) =>
          current.map((item) =>
            item.entry.opId === entry.opId
              ? { ...item, status: "failed", failureReason: reason }
              : item,
          ),
        );
        if (retriable && attempt < MAX_RETRY_ATTEMPTS && log.isOnline()) {
          const timer = setTimeout(() => {
            retryTimers.current.delete(entry.opId);
            void deliver(entry, attempt + 1);
          }, backoffDelay(attempt));
          retryTimers.current.set(entry.opId, timer);
        }
      }
    },
    [log],
  );

  /**
   * Make a change: queue it, show it, and send it to the log.
   *
   * `opId` is the idempotency key. A retry reuses it, so the log cannot store
   * the change twice; ops several clients race to make — a meeting's starting
   * notice — share one, so exactly one lands.
   */
  const dispatch = useCallback(
    (op: ChatOp, opId: string = newId("op")) => {
      if (pendingRef.current.some((item) => item.entry.opId === opId)) return;
      const entry: OpEntry = { opId, actor: currentUserIdRef.current, ts: Date.now(), op };
      pendingRef.current = [...pendingRef.current, { entry, status: "sending", attempts: 1 }];
      setPending((current) =>
        current.some((item) => item.entry.opId === opId)
          ? current
          : [...current, { entry, status: "sending", attempts: 1 }],
      );
      void deliver(entry, 1);
    },
    [deliver],
  );

  /**
   * Follow the log as the current person. It replaces the workspace when it
   * has one of its own (the server's), then delivers each entry after that.
   * Switching person resubscribes: private entries are theirs alone.
   */
  useEffect(() => {
    if (!storageReady) return;
    return log.subscribe(currentUserId, {
      onReset: (workspace, head, opIds) => {
        headRef.current = head;
        setConfirmed(workspace);
        setPending((current) => current.filter((item) => !opIds.has(item.entry.opId)));
      },
      onEntry: (entry) => {
        if (entry.seq !== undefined) {
          if (entry.seq <= headRef.current) return;
          headRef.current = entry.seq;
        }
        setConfirmed((workspace) => applyOp(workspace, entry));
        setPending((current) => current.filter((item) => item.entry.opId !== entry.opId));
      },
      onStatus: (connected) => {
        if (log.shared) setOnlineState(connected);
      },
    });
  }, [storageReady, currentUserId, log]);

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const restoreLocal = (snapshot: PersistedState, recover: boolean) => {
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
      setDrafts(snapshot.drafts);
    };

    const snapshot = parseSavedState(window.localStorage.getItem(STORAGE_KEY));
    if (snapshot) {
      const { workspace, outbox, scheduled: waiting } = fromSnapshot(snapshot);
      setConfirmed(workspace);
      setScheduled(waiting);
      restoreLocal(snapshot, true);
      // What was unsent when the app closed goes out again. Each keeps its
      // opId, so an op that did land before the app closed is not stored twice.
      const resumed = outbox.map((entry) => ({ entry, status: "sending" as const, attempts: 1 }));
      pendingRef.current = resumed;
      setPending(resumed);
      for (const entry of outbox) void deliver(entry, 1);
    }
    setStorageReady(true);

    // Another tab of this browser saved: take its workspace and its view of
    // this device, but not its outbox — that tab is sending those itself.
    const syncTabs = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = parseSavedState(event.newValue);
      if (!next) return;
      setConfirmed(fromSnapshot(next).workspace);
      restoreLocal(next, false);
    };
    window.addEventListener("storage", syncTabs);
    return () => window.removeEventListener("storage", syncTabs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const result = writeSnapshot({
      version: SCHEMA_VERSION,
      rooms: confirmed.rooms,
      messages: confirmed.messages,
      meetings: confirmed.meetings,
      aiMessages,
      currentUserId,
      activeRoomId,
      notifications: confirmed.notifications,
      readState: confirmed.readState,
      drafts,
      saved: confirmed.saved,
      followedThreads: confirmed.followedThreads,
      outbox: pending.map((item) => item.entry),
      scheduled,
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
  }, [storageReady, confirmed, pending, scheduled, aiMessages, currentUserId, activeRoomId, drafts]);

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
   * A message whose attachment bytes live on this device carries `blobId`
   * but no usable URL — the bytes deliberately never travel in the log. Mint
   * object URLs for them. A blob that has gone missing (cleared site data, a
   * different device) is flagged rather than left as a broken image.
   */
  useEffect(() => {
    if (!storageReady) return;
    const missing = [
      ...new Set(
        visible.messages
          .map((message) => message.attachment?.blobId)
          .filter((blobId): blobId is string => Boolean(blobId) && !(blobId! in attachmentUrls)),
      ),
    ];
    if (missing.length === 0) return;

    let cancelled = false;
    void (async () => {
      const resolved: Record<string, string | null> = {};
      for (const blobId of missing) resolved[blobId] = await attachmentUrl(blobId);
      if (cancelled) return;
      setAttachmentUrls((current) => ({ ...current, ...resolved }));
    })();
    return () => {
      cancelled = true;
    };
  }, [storageReady, visible.messages, attachmentUrls]);

  /**
   * Blobs outlive their message when a send is discarded or a message deleted.
   * Sweeping once per session keeps the store from growing without bound.
   */
  useEffect(() => {
    if (!storageReady) return;
    const timer = setTimeout(() => {
      void collectOrphanBlobs(referencedBlobIds(messagesRef.current));
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

  /**
   * Move the viewer's read marker to the newest message in the room. Called
   * often — on opening a room, on every new message — so it only makes an op
   * when the marker would actually move; the pending op itself counts, since
   * the visible read state already includes it.
   */
  const markRoomRead = useCallback(
    (roomId: RoomId) => {
      const me = currentUserIdRef.current;
      const newest = messagesRef.current
        .filter((message) => message.roomId === roomId)
        .sort(compareMessages)
        .at(-1);
      if (!newest) return;
      const marker = readStateRef.current[roomId]?.[me];
      if (marker && marker.lastReadTimestamp >= newest.timestamp) return;
      dispatch({ type: "read.mark", roomId, timestamp: newest.timestamp, messageId: newest.id });
    },
    [dispatch],
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
   * Works out who a message addresses, once, as it is sent — so the renderer
   * never has to re-parse the body against a directory that may have changed.
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
   * Send a built message as a `message.send` op. Its `clientId` is the op's
   * id, so a retry — or a device resuming its outbox — cannot post it twice.
   */
  const postMessage = useCallback(
    (
      message: SharedMessage,
      options: { announce?: boolean; notices?: Notice[] } = {},
    ) => {
      const {
        roomId,
        senderId: _senderId,
        timestamp: _timestamp,
        delivery: _delivery,
        attempts: _attempts,
        failureReason: _reason,
        ...draft
      } = message;
      dispatch(
        {
          type: "message.send",
          roomId,
          message: draft,
          ...(options.announce ? { announce: true } : {}),
          ...(options.notices?.length ? { notices: options.notices } : {}),
        },
        message.clientId,
      );
    },
    [dispatch],
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
      const audience = mentionAudienceOf(draft);
      const message: SharedMessage =
        audience.personal.length > 0 ? { ...draft, mentionIds: audience.personal } : draft;
      postMessage(message, { announce: true });
    },
    [buildMessage, mentionAudienceOf, postMessage],
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
        // Small enough that base64 in the message costs less than a second
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
        setAttachmentUrls((current) => ({ ...current, [blobId]: url }));
        // The object URL is meaningful on this page only, so it stays out of
        // the log: the message carries the blob id and each device resolves it.
        attachment = { ...meta, dataUrl: "", blobId };
      }

      const draft = buildMessage(roomId, caption.trim(), {
        replyToId: options?.replyToId ?? null,
        threadRootId: options?.threadRootId ?? null,
        attachment,
      });
      const audience = mentionAudienceOf(draft);
      const message: SharedMessage =
        audience.personal.length > 0 ? { ...draft, mentionIds: audience.personal } : draft;
      postMessage(message, { announce: true });
    },
    [buildMessage, mentionAudienceOf, postMessage],
  );

  const pendingSendOf = (messageId: MessageId) =>
    pendingRef.current.find(
      (item) => item.entry.op.type === "message.send" && item.entry.op.message.id === messageId,
    );

  const clearRetry = (opId: string) => {
    const timer = retryTimers.current.get(opId);
    if (timer) {
      clearTimeout(timer);
      retryTimers.current.delete(opId);
    }
  };

  const retryMessage = useCallback(
    (id: MessageId) => {
      const item = pendingSendOf(id);
      if (!item) return;
      clearRetry(item.entry.opId);
      // Same opId: the log's idempotency guarantees this cannot duplicate.
      void deliver(item.entry, 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deliver],
  );

  const discardMessage = useCallback((id: MessageId) => {
    const item = pendingSendOf(id);
    if (!item) return;
    clearRetry(item.entry.opId);
    setPending((current) => current.filter((candidate) => candidate !== item));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Anything still unsent goes back out when connectivity returns. */
  const setOnline = useCallback(
    (next: boolean) => {
      log.setOnline(next);
      setOnlineState(next);
      if (!next) return;
      for (const item of pendingRef.current) {
        if (item.status === "failed") {
          clearRetry(item.entry.opId);
          void deliver(item.entry, 1);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [log, deliver],
  );

  /* ---------------------------------------------------------------------- */
  /* Editing, deleting, pinning, saving                                     */
  /* ---------------------------------------------------------------------- */

  const editMessage = useCallback(
    (id: MessageId, content: string) => {
      const text = content.trim();
      const target = messagesRef.current.find((message) => message.id === id);
      if (!target || target.senderId !== currentUserId || isTombstoned(target)) return;
      dispatch({
        type: "message.edit",
        roomId: target.roomId,
        messageId: id,
        content: text,
        mentions: parseMentions(text, userGroups),
        linkPreviews: derivePreviews(text),
      });
    },
    [currentUserId, userGroups, dispatch],
  );

  /**
   * Soft delete. The row stays so replies, thread roots and cursors remain
   * valid; only the body and attachment are cleared.
   */
  const deleteMessage = useCallback(
    (id: MessageId) => {
      const target = messagesRef.current.find((message) => message.id === id);
      if (!target) return;
      const room = rooms.find((r) => r.id === target.roomId);
      const allowed =
        target.senderId === currentUserId || (room ? isAdmin(room, currentUserId) : false);
      if (!allowed) return;
      dispatch({ type: "message.delete", roomId: target.roomId, messageId: id });
      toast.success("Message deleted");
    },
    [currentUserId, rooms, isAdmin, dispatch],
  );

  const toggleReaction = useCallback(
    (id: MessageId, emoji: string) => {
      const target = messagesRef.current.find((message) => message.id === id);
      if (!target || isTombstoned(target)) return;
      // Sent as an intent, on or off, so a retried op cannot flip it back.
      const on = !(target.reactions?.[emoji] ?? []).includes(currentUserId);
      dispatch({ type: "message.reaction", roomId: target.roomId, messageId: id, emoji, on });
    },
    [currentUserId, dispatch],
  );

  const togglePin = useCallback(
    (id: MessageId) => {
      const target = messagesRef.current.find((message) => message.id === id);
      if (!target) return;
      const on = !target.pinnedBy;
      dispatch({ type: "message.pin", roomId: target.roomId, messageId: id, on });
      toast.success(on ? "Pinned to this conversation" : "Unpinned");
    },
    [dispatch],
  );

  const toggleSave = useCallback(
    (id: MessageId) => {
      const on = !(saved[currentUserId] ?? []).includes(id);
      dispatch({ type: "saved.set", messageId: id, on });
      toast.success(on ? "Saved for later" : "Removed from saved");
    },
    [saved, currentUserId, dispatch],
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
      for (const roomId of targetRoomIds) {
        postMessage(
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
      }
      toast.success(
        targetRoomIds.length === 1
          ? "Forwarded"
          : `Forwarded to ${targetRoomIds.length} conversations`,
      );
    },
    [messages, buildMessage, postMessage],
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
      setScheduled((current) => [...current, message]);
      toast.success("Message scheduled");
    },
    [buildMessage],
  );

  const scheduledMessages = useCallback(
    (roomId?: RoomId) =>
      scheduled
        .filter(
          (message) =>
            message.senderId === currentUserId && (!roomId || message.roomId === roomId),
        )
        .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0)),
    [scheduled, currentUserId],
  );

  const cancelScheduled = useCallback((id: MessageId) => {
    setScheduled((current) => current.filter((message) => message.id !== id));
    toast.success("Scheduled message cancelled");
  }, []);

  const scheduledRef = useRef(scheduled);
  scheduledRef.current = scheduled;

  const releaseScheduled = useCallback(
    (id: MessageId) => {
      const target = scheduledRef.current.find((message) => message.id === id);
      if (!target) return;
      setScheduled((current) => current.filter((message) => message.id !== id));
      postMessage(
        { ...target, scheduledFor: undefined, timestamp: Date.now(), delivery: "sending" },
        {
          notices: [
            {
              id: `scheduled-${target.id}`,
              kind: "agent",
              text: `A scheduled message from ${userById(target.senderId).name} was posted`,
            },
          ],
        },
      );
    },
    [postMessage, userById],
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
      const recipients = [...new Set([meeting.organizerId, ...meeting.attendeeIds])];
      const reminder: SharedMessage = {
        id: `meeting-${meeting.id}-starting`,
        // Every open client runs this ticker. They all post under this one
        // id, so the log keeps exactly one reminder however many race.
        clientId: `meeting-${meeting.id}-starting`,
        roomId: meeting.roomId,
        senderId: meeting.organizerId,
        content: `**${meeting.title}** is starting now. [Join the meeting](${meeting.meetingUri})`,
        timestamp: Date.now(),
        reactions: {},
        delivery: "sending",
        sharedFromAi: true,
        meetingId: meeting.id,
        meetingNotice: "starting",
      };
      postMessage(reminder, {
        notices: [
          {
            id: `meeting-${meeting.id}`,
            kind: "agent",
            audience: recipients,
            text: `${meeting.title} is starting now — join the meeting`,
          },
        ],
      });

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
    [postMessage],
  );

  // Due-message/meeting ticker. A server would run this as a durable queue worker.
  useEffect(() => {
    const releaseDue = () => {
      const now = Date.now();
      const due = scheduled.filter((message) => message.scheduledFor && message.scheduledFor <= now);
      for (const message of due) releaseScheduled(message.id);
      const dueMeetings = meetings.filter(
        (meeting) => !meeting.reminderSentAt && meeting.startAt <= now && meeting.endAt > now,
      );
      for (const meeting of dueMeetings) announceMeeting(meeting);
    };
    releaseDue();
    const interval = setInterval(releaseDue, 5_000);
    return () => clearInterval(interval);
  }, [scheduled, meetings, releaseScheduled, announceMeeting]);

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
      const following = (followedThreads[currentUserId] ?? []).includes(rootId);
      dispatch({ type: "thread.follow", rootId, on: !following });
      toast.success(following ? "Unfollowed thread" : "Following thread");
    },
    [followedThreads, currentUserId, dispatch],
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
      dispatch({
        type: "room.create",
        roomId: id,
        room: {
          id,
          type: "direct",
          createdAt: Date.now(),
          adminIds: [],
          participantIds: [currentUserId, otherUserId],
          mutedUserIds: [],
        },
      });
      setActiveRoom(id);
      return id;
    },
    [rooms, currentUserId, setActiveRoom, dispatch],
  );

  const createGroup = useCallback<ChatContextValue["createGroup"]>(
    ({ name, description, participantIds }) => {
      const id = `g-${newId()}`;
      const members = Array.from(new Set([currentUserId, ...participantIds]));
      dispatch({
        type: "room.create",
        roomId: id,
        room: {
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
        },
      });
      setActiveRoom(id);
      toast.success(`Group “${name}” created`);
      return id;
    },
    [currentUserId, setActiveRoom, dispatch],
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
      dispatch({
        type: "room.create",
        roomId: id,
        room: {
          id,
          type: "groupdm",
          createdAt: Date.now(),
          createdBy: currentUserId,
          adminIds: [],
          participantIds: members,
          mutedUserIds: [],
          color: "#f59e0b",
        },
      });
      setActiveRoom(id);
      toast.success(`Group message with ${members.length - 1} people`);
      return id;
    },
    [rooms, currentUserId, setActiveRoom, dispatch],
  );

  const renameRoom = useCallback(
    (roomId: RoomId, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      dispatch({ type: "room.update", roomId, patch: { name: trimmed } });
      toast.success("Conversation renamed");
    },
    [dispatch],
  );

  const setRoomTopic = useCallback(
    (roomId: RoomId, topic: string) => {
      dispatch({ type: "room.update", roomId, patch: { topic: topic.trim() } });
    },
    [dispatch],
  );

  const setRoomDescription = useCallback(
    (roomId: RoomId, description: string) => {
      dispatch({ type: "room.update", roomId, patch: { description: description.trim() } });
      toast.success("Description updated");
    },
    [dispatch],
  );

  const updateGroupPhoto = useCallback(
    (roomId: RoomId, photo: Room["photo"] | null) => {
      const room = rooms.find((candidate) => candidate.id === roomId);
      if (!room || room.type === "direct" || !room.participantIds.includes(currentUserId)) {
        toast.error("Only group members can change the group photo.");
        return false;
      }
      dispatch({ type: "room.update", roomId, patch: { photo: photo ?? null } });
      toast.success(photo ? "Group photo updated" : "Group photo removed");
      return true;
    },
    [rooms, currentUserId, dispatch],
  );

  const addMembers = useCallback(
    (roomId: RoomId, userIds: UserId[]) => {
      if (userIds.length === 0) return;
      dispatch({ type: "room.members", roomId, add: userIds });
      toast.success(userIds.length === 1 ? "Member added" : `${userIds.length} members added`);
    },
    [dispatch],
  );

  const removeMember = useCallback(
    (roomId: RoomId, userId: UserId) => {
      dispatch({ type: "room.members", roomId, remove: [userId] });
      toast.success("Member removed");
    },
    [dispatch],
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
      dispatch({ type: "room.admin", roomId, userId, on: !isCurrentlyAdmin });
      toast.success(isCurrentlyAdmin ? "Admin removed" : "Admin added");
    },
    [dispatch],
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
      dispatch({ type: "room.members", roomId, remove: [currentUserId] });
      const fallback = rooms.find(
        (r) => r.id !== roomId && r.participantIds.includes(currentUserId) && !r.archived,
      );
      if (fallback) setActiveRoomId(fallback.id);
      toast.success("You left the conversation");
    },
    [rooms, currentUserId, dispatch],
  );

  const setArchived = useCallback(
    (roomId: RoomId, archived: boolean) => {
      dispatch({ type: "room.update", roomId, patch: { archived } });
      if (archived) {
        const fallback = rooms.find(
          (r) => r.id !== roomId && r.participantIds.includes(currentUserId) && !r.archived,
        );
        if (fallback) setActiveRoomId(fallback.id);
      }
      toast.success(archived ? "Conversation archived" : "Conversation restored");
    },
    [rooms, currentUserId, dispatch],
  );

  const toggleGroupMute = useCallback(
    (roomId: RoomId) => {
      const room = roomsRef.current.find((candidate) => candidate.id === roomId);
      if (!room) return;
      const groupMuted = !room.groupMuted;
      dispatch({ type: "room.update", roomId, patch: { groupMuted } });
      toast[groupMuted ? "warning" : "success"](
        groupMuted ? "Group messaging muted by admin" : "Group messaging enabled",
      );
    },
    [dispatch],
  );

  const toggleUserMute = useCallback(
    (roomId: RoomId, userId: UserId) => {
      const room = roomsRef.current.find((candidate) => candidate.id === roomId);
      if (!room) return;
      const muted = room.mutedUserIds.includes(userId);
      dispatch({ type: "room.mute_user", roomId, userId, on: !muted });
      toast[muted ? "success" : "warning"](
        `${userById(userId).name} ${muted ? "unmuted" : "muted"}`,
      );
    },
    [userById, dispatch],
  );

  const notificationLevel = useCallback(
    (roomId: RoomId): NotificationLevel =>
      rooms.find((room) => room.id === roomId)?.notificationLevels?.[currentUserId] ?? "all",
    [rooms, currentUserId],
  );

  const setNotificationLevel = useCallback(
    (roomId: RoomId, level: NotificationLevel) => {
      dispatch({ type: "room.notify", roomId, level });
      toast.success(
        level === "all"
          ? "Notifying for all messages"
          : level === "mentions"
            ? "Notifying for mentions only"
            : "Notifications off for this conversation",
      );
    },
    [dispatch],
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
      dispatch({
        type: "room.invite",
        roomId,
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
      toast.success("New invite link generated");
    },
    [dispatch],
  );

  const revokeInvite = useCallback(
    (roomId: RoomId) => {
      dispatch({ type: "room.invite", roomId, invite: null });
      toast.warning("Invite link revoked");
    },
    [dispatch],
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

      // Judged again by the log at its own receive time, which is what every
      // client agrees on; this check only gives immediate feedback.
      if (!room.participantIds.includes(currentUserId)) {
        dispatch({ type: "room.join", roomId: room.id, code });
      }
      setActiveRoomId(room.id);
      return { room };
    },
    [rooms, currentUserId, inviteStatus, dispatch],
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
      postMessage(buildMessage(target.roomId, target.response, { sharedFromAi: true }));
      toast.success("AI response shared with the room");
    },
    [aiMessages, buildMessage, postMessage],
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
      const me = currentUserIdRef.current;
      const target = notificationsRef.current.find((notification) => notification.id === id);
      if (!target || !notificationTargets(target, me) || notificationIsRead(target, me)) return;
      dispatch({ type: "notification.read", roomId: target.roomId, ids: [id] });
    },
    [dispatch],
  );

  /**
   * Marks a room's notifications read for the viewer. `scope` lets the panel
   * clear just the section the user actually opened.
   */
  const markRoomNotificationsRead = useCallback(
    (roomId: RoomId, scope?: "mentions" | "activity") => {
      const me = currentUserIdRef.current;
      // Called whenever a panel opens; only an op when something would change.
      const unread = notificationsRef.current.some(
        (notification) =>
          notification.roomId === roomId &&
          !(scope === "mentions" && notification.kind !== "mention") &&
          !(scope === "activity" && notification.kind === "mention") &&
          notificationTargets(notification, me) &&
          !notificationIsRead(notification, me),
      );
      if (!unread) return;
      dispatch({ type: "notification.read", roomId, ...(scope ? { scope } : {}) });
    },
    [dispatch],
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
    setAttachmentUrls((current) => {
      const next = { ...current };
      for (const message of targets) next[message.attachment!.blobId!] = null;
      return next;
    });
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

      dispatch({ type: "meeting.add", roomId: meeting.roomId, meeting }, `meeting-${meeting.id}-add`);

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
      postMessage(notice, {
        notices: [
          {
            id: `meeting-${meeting.id}-scheduled-note`,
            kind: "agent",
            audience: [...new Set([currentUserId, ...attendeeIds])],
            text: `${userById(currentUserId).name} scheduled “${meeting.title}” for ${formatDateTime(meeting.startAt, { timeZone: meeting.timeZone })}`,
          },
        ],
      });

      toast.success("Meeting scheduled and Calendar invitations sent");
      if (meeting.demo) {
        toast.info("Google Calendar isn't configured, so this is a demo event.");
      }
      return meeting;
    },
    [rooms, currentUserId, users, userById, buildMessage, postMessage, dispatch],
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

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}

export { encodeCursor };
