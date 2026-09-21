/**
 * Room-scoped notifications, rendered inside the conversation side panel.
 *
 * There is deliberately no global feed: this component only ever asks the
 * store for `roomId`, so an item raised in one room can never appear in
 * another's panel. Within a room the split is by audience — "For you" is the
 * mentions addressed to the viewer personally, "Activity" is what the whole
 * room is told about.
 */

import { Fragment, useEffect, useState } from "react";
import { AtSign, Bell, ChevronDown, CornerUpRight } from "lucide-react";
import { useChat } from "@/lib/chat-store";
import { notificationIsRead, type Notification, type RoomId } from "@/lib/chat-types";
import { formatRelative } from "@/lib/time";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";

/** How many items render before the "Show all" expander. */
const COLLAPSED_LIMIT = 10;

export function NotificationsPanel({
  roomId,
  showActivity = true,
}: {
  roomId: RoomId;
  /** Direct messages have no room-wide events, so they get "For you" only. */
  showActivity?: boolean;
}) {
  const { notificationsFor, markRoomNotificationsRead, currentUserId } = useChat();

  const [mentionsOpen, setMentionsOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);

  const all = notificationsFor(roomId);
  const mentions = all.filter((notification) => notification.kind === "mention");
  const activity = showActivity
    ? all.filter((notification) => notification.kind !== "mention")
    : [];

  const unreadMentions = mentions.filter(
    (notification) => !notificationIsRead(notification, currentUserId),
  ).length;
  const unreadActivity = activity.filter(
    (notification) => !notificationIsRead(notification, currentUserId),
  ).length;

  // Seeing a section is what marks it read — both when the user expands it and
  // when they switch into a room with it already expanded.
  useEffect(() => {
    if (mentionsOpen) markRoomNotificationsRead(roomId, "mentions");
  }, [roomId, mentionsOpen, markRoomNotificationsRead]);

  useEffect(() => {
    if (showActivity && activityOpen) markRoomNotificationsRead(roomId, "activity");
  }, [roomId, activityOpen, showActivity, markRoomNotificationsRead]);

  return (
    <section className="shrink-0 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <Bell className="h-3 w-3 text-muted-foreground" />
        <p className="text-[12px] font-semibold text-muted-foreground">
          Notifications
        </p>
      </div>

      {/* Its own scroll box: a busy room must not push the group info off-screen. */}
      <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-0.5">
        <NotificationGroup
          title="For you"
          icon={AtSign}
          tone="accent"
          items={mentions}
          unread={unreadMentions}
          open={mentionsOpen}
          onOpenChange={setMentionsOpen}
          empty="No mentions yet — you'll see them here when someone @s you."
        />
        {showActivity && (
          <NotificationGroup
            title="Activity"
            icon={Bell}
            tone="muted"
            items={activity}
            unread={unreadActivity}
            open={activityOpen}
            onOpenChange={setActivityOpen}
            empty="No recent activity."
          />
        )}
      </div>
    </section>
  );
}

function NotificationGroup({
  title,
  icon: Icon,
  tone,
  items,
  unread,
  open,
  onOpenChange,
  empty,
}: {
  title: string;
  icon: typeof AtSign;
  tone: "accent" | "muted";
  items: Notification[];
  unread: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empty: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED_LIMIT);
  const hidden = items.length - visible.length;

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-secondary"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
        <Icon
          className={cn(
            "h-3 w-3 shrink-0",
            tone === "accent" ? "text-ai" : "text-muted-foreground",
          )}
        />
        <span className="text-[12px] font-semibold text-muted-foreground">
          {title}
        </span>
        {unread > 0 && (
          <span
            aria-label={`${unread} unread`}
            className={cn(
              "ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[12px] font-semibold",
              tone === "accent"
                ? "bg-ai text-ai-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-1">
          {items.length === 0 && (
            <p className="px-2 py-2 text-[12px] leading-relaxed text-muted-foreground">{empty}</p>
          )}
          {visible.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} tone={tone} />
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full rounded-lg px-2 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Show all {items.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  tone,
}: {
  notification: Notification;
  tone: "accent" | "muted";
}) {
  const { userById, currentUser, currentUserId, jumpToMessage, markNotificationRead } = useChat();
  const unread = !notificationIsRead(notification, currentUserId);
  const actor = notification.actorId ? userById(notification.actorId) : null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-2 py-1.5",
        tone === "accent" ? "border-primary/25 bg-primary/8" : "border-transparent bg-surface-2/60",
      )}
    >
      {actor ? (
        <UserAvatar user={actor} size={24} />
      ) : (
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Bell className="h-3 w-3 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[12px] leading-snug",
            tone === "accent" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <HighlightedText text={notification.text} name={currentUser.name} />
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span suppressHydrationWarning className="text-[12px] text-muted-foreground">
            {formatRelative(notification.timestamp)}
          </span>
          {notification.messageId && (
            <button
              type="button"
              onClick={() => {
                markNotificationRead(notification.id);
                jumpToMessage(notification.roomId, notification.messageId!);
              }}
              className="flex items-center gap-0.5 text-[12px] font-medium text-primary transition-colors hover:underline"
            >
              <CornerUpRight className="h-2.5 w-2.5" /> Jump
            </button>
          )}
        </div>
      </div>
      {unread && (
        <span
          aria-label="Unread"
          className={cn(
            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
            tone === "accent" ? "bg-ai" : "bg-muted-foreground/60",
          )}
        />
      )}
    </div>
  );
}

/**
 * Picks the viewer out of a notification's text — their own `@Name` and the
 * word "you" — so a wall of similar-looking lines still reads at a glance.
 */
function HighlightedText({ text, name }: { text: string; name: string }) {
  const first = name.split(" ")[0] ?? name;
  const tokens = [`@${name}`, `@${first}`, "@everyone", "@here", "you"].filter(Boolean);
  const pattern = new RegExp(
    `(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  // `split` with one capture group puts every match at an odd index, so the
  // matches are identified positionally rather than by re-testing a stateful
  // global regex.
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span
            key={`${part}-${index}`}
            className="rounded bg-primary/15 px-1 font-semibold text-primary"
          >
            {part}
          </span>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        ),
      )}
    </>
  );
}
