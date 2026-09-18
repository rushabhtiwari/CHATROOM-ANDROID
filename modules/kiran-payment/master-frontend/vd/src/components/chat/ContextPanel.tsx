import { Clock, Crown, Link2, PanelRightClose, Pin, Settings, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupAvatar, UserAvatar } from "./UserAvatar";
import { NotificationsPanel } from "./NotificationsPanel";
import { useChat } from "@/lib/chat-store";
import { previewText, type Room, type UserId } from "@/lib/chat-types";
import { formatDate, localTimeFor } from "@/lib/time";
import { cn } from "@/lib/utils";

export function ContextPanel({
  onCreateGroup,
  onOpenSettings,
  onOpenProfile,
  onClose,
}: {
  onCreateGroup: (preselected: UserId[]) => void;
  onOpenSettings: (tab?: "about" | "members" | "invite" | "appearance") => void;
  onOpenProfile?: (userId: UserId) => void;
  onClose?: () => void;
}) {
  const { activeRoom, roomTitle, userById, currentUserId, rooms, isAdmin, pinnedMessages } =
    useChat();

  /* ----------------------------- Direct message ---------------------------- */

  if (activeRoom.type === "direct") {
    const otherId = activeRoom.participantIds.find((id) => id !== currentUserId) ?? currentUserId;
    const other = userById(otherId);
    const mutual = rooms.filter(
      (room) =>
        room.type === "group" &&
        room.participantIds.includes(otherId) &&
        room.participantIds.includes(currentUserId),
    );

    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto bg-background p-4">
        {onClose && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Info
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide panel"
              title="Hide panel (Slide out)"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* A direct message has no room-wide events, so mentions only. */}
        <NotificationsPanel roomId={activeRoom.id} showActivity={false} />

        <div className="glass flex flex-col items-center rounded-xl p-5 text-center">
          <UserAvatar user={other} size={64} showStatus />
          <h3 className="mt-3 text-lg font-semibold">{other.name}</h3>
          <p className="text-xs text-muted-foreground">
            {other.department ? `${other.role} · ${other.department}` : other.role}
          </p>
          <span
            className={cn(
              "mt-2 rounded-full px-2.5 py-0.5 text-[11px]",
              other.online ? "bg-online/15 text-online" : "bg-secondary text-muted-foreground",
            )}
          >
            {other.online ? "Online" : "Offline"}
          </span>
          <p
            suppressHydrationWarning
            className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            <Clock className="h-3 w-3" /> {localTimeFor(other.timeZone)} local time
          </p>
        </div>

        <Section title="Actions">
          <Button
            variant="secondary"
            className="w-full justify-start rounded-lg"
            onClick={() => onCreateGroup([otherId])}
          >
            <Users className="mr-2 h-4 w-4" /> Create group with {other.name.split(" ")[0]}
          </Button>
          <Button
            variant="secondary"
            className="mt-2 w-full justify-start rounded-lg"
            onClick={() => onOpenSettings("about")}
          >
            <Settings className="mr-2 h-4 w-4" /> Conversation settings
          </Button>
        </Section>

        <Section title={`Mutual groups · ${mutual.length}`}>
          <div className="space-y-2">
            {mutual.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No shared groups yet.</p>
            )}
            {mutual.map((room) => (
              <div key={room.id} className="flex items-center gap-2 text-sm">
                <GroupAvatar
                  name={room.name ?? "G"}
                  color={room.color}
                  photo={room.photo}
                  size={30}
                />
                {room.name}
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  /* --------------------------- Group / group DM ---------------------------- */

  const participants = activeRoom.participantIds.map(userById);
  const onlineCount = participants.filter((user) => user.online).length;
  const isGroup = activeRoom.type === "group";
  const pinned = pinnedMessages(activeRoom.id);
  // Online first, then admins, so the useful half of a large room is on top.
  const roster = [...participants]
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      const adminGap = Number(isAdmin(activeRoom, b.id)) - Number(isAdmin(activeRoom, a.id));
      if (adminGap !== 0) return adminGap;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 6);
  const hidden = participants.length - roster.length;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-background p-4">
      {onClose && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Group Info
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide panel"
            title="Hide panel (Slide out)"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      )}
      <NotificationsPanel roomId={activeRoom.id} />

      <div className="glass flex flex-col items-center rounded-xl p-5 text-center">
        <GroupAvatar
          name={roomTitle(activeRoom)}
          color={activeRoom.color}
          photo={activeRoom.photo}
          size={64}
        />
        <h3 className="mt-3 text-lg font-semibold">{roomTitle(activeRoom)}</h3>
        {isGroup && <CategoryBadge room={activeRoom} />}
        {activeRoom.topic && <p className="mt-0.5 text-[11px] text-primary">{activeRoom.topic}</p>}
        {activeRoom.description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {activeRoom.description}
          </p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          {participants.length} members • {onlineCount} online
        </p>
        <p suppressHydrationWarning className="text-[11px] text-muted-foreground">
          {activeRoom.createdBy
            ? `Created by ${userById(activeRoom.createdBy).name.split(" ")[0]} · `
            : ""}
          {formatDate(activeRoom.createdAt)}
        </p>
        <Button
          variant="secondary"
          className="mt-3 w-full rounded-lg"
          onClick={() => onOpenSettings("about")}
        >
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
      </div>

      <Section
        title={`Members · ${participants.length}`}
        action={
          <button
            type="button"
            onClick={() => onOpenSettings("members")}
            className="text-[11px] font-medium text-primary transition-colors hover:underline"
          >
            View all
          </button>
        }
      >
        <div className="space-y-0.5">
          {roster.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onOpenProfile?.(user.id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-secondary"
            >
              <UserAvatar user={user} size={28} showStatus />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium">
                    {user.id === currentUserId ? `${user.name} (you)` : user.name}
                  </span>
                  {isAdmin(activeRoom, user.id) && (
                    <Crown className="h-3 w-3 shrink-0 text-amber-500" aria-label="Administrator" />
                  )}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{user.role}</span>
              </span>
            </button>
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => onOpenSettings("members")}
              className="w-full rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {hidden} more {hidden === 1 ? "member" : "members"}
            </button>
          )}
        </div>
      </Section>

      <Section title="Quick actions">
        <div className="space-y-1.5">
          <PanelAction
            icon={UserPlus}
            label="Add members"
            onClick={() => onOpenSettings("members")}
          />
          <PanelAction icon={Link2} label="Invite link" onClick={() => onOpenSettings("invite")} />
          <PanelAction
            icon={Users}
            label="Start a group with these members"
            onClick={() =>
              onCreateGroup(activeRoom.participantIds.filter((id) => id !== currentUserId))
            }
          />
        </div>
      </Section>

      {pinned.length > 0 && (
        <Section title={`Pinned · ${pinned.length}`}>
          <div className="space-y-1.5">
            {pinned.slice(0, 3).map((message) => (
              <div
                key={message.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/60 px-2 py-1.5"
              >
                <Pin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium">
                    {userById(message.senderId).name.split(" ")[0]}
                  </span>
                  <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {previewText(message)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  department: "Department",
  project: "Project",
  social: "Team space",
};

function CategoryBadge({ room }: { room: Room }) {
  const label = room.category ? CATEGORY_LABEL[room.category] : "Group chat";
  return (
    <span className="mt-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  );
}

function PanelAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-left text-[12px] font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {label}
    </button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}
