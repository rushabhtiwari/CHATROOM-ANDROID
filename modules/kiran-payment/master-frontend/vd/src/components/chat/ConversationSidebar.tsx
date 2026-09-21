import { useMemo, useState } from "react";
import {
  Archive,
  AtSign,
  BellOff,
  Building2,
  ChevronDown,
  FolderKanban,
  Hash,
  MessageSquarePlus,
  PanelLeftClose,
  Pencil,
  Search,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupAvatar, UserAvatar } from "./UserAvatar";
import { useChat } from "@/lib/chat-store";
import { previewText, type Room, type RoomCategory } from "@/lib/chat-types";
import { formatTime } from "@/lib/time";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ConversationSidebar({
  onCreateGroup,
  onClose,
  onSelect,
}: {
  onCreateGroup: () => void;
  onClose?: () => void;
  onSelect?: () => void;
}) {
  const {
    visibleRooms,
    archivedRooms,
    activeRoom,
    setActiveRoom,
    roomTitle,
    lastMessage,
    userById,
    unreadFor,
    currentUser,
    users,
    openDirect,
    unreadMentionCount,
    currentUserId,
    getDraft,
    notificationLevel,
    plainText,
  } = useChat();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const filtered = useMemo(
    () =>
      visibleRooms.filter((room) => roomTitle(room).toLowerCase().includes(query.toLowerCase())),
    [visibleRooms, roomTitle, query],
  );
  const directs = filtered.filter((room) => room.type !== "group");
  /**
   * Standing department channels, time-boxed project rooms and the ad-hoc
   * groups people create read very differently, so the rail files them apart
   * rather than pouring every group into one list. Anything a user created
   * carries no category and lands in "Group chats".
   */
  const sections: Array<{
    key: RoomCategory | "other";
    label: string;
    icon: typeof Hash;
    rooms: Room[];
  }> = [
    { key: "department", label: "Departments", icon: Building2, rooms: [] },
    { key: "project", label: "Projects", icon: FolderKanban, rooms: [] },
    { key: "social", label: "Team spaces", icon: Hash, rooms: [] },
    { key: "other", label: "Group chats", icon: Users, rooms: [] },
  ];
  for (const room of filtered) {
    if (room.type !== "group") continue;
    const section = sections.find((entry) => entry.key === (room.category ?? "other"));
    (section ?? sections[3]!).rooms.push(room);
  }
  const people = query
    ? users.filter(
        (user) =>
          user.id !== currentUserId && user.name.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  const renderRoom = (room: Room) => {
    const last = lastMessage(room.id);
    const other = room.participantIds.find((id) => id !== currentUserId);
    const active = room.id === activeRoom?.id;
    const unread = unreadFor(room.id);
    // Mentions come from the notification store, not the message scan: only
    // items whose audience names the viewer count towards this pill.
    const mentions = unreadMentionCount(room.id);
    const draft = getDraft(room.id);
    const level = notificationLevel(room.id);
    const memberCount = room.participantIds.length;
    const onlineCount = room.participantIds.map(userById).filter((user) => user.online).length;

    const roomButton = (
      <button
        key={room.id}
        onClick={() => {
          setActiveRoom(room.id);
          onSelect?.();
        }}
        aria-current={active ? "true" : undefined}
        className={cn(
          "group flex w-full items-center gap-3 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors duration-150",
          active ? "bg-[#DCE6F4]" : "hover:bg-black/[0.05]",
        )}
      >
        {room.type === "direct" ? (
          <UserAvatar user={userById(other ?? currentUserId)} size={38} showStatus />
        ) : (
          <GroupAvatar name={roomTitle(room)} color={room.color} photo={room.photo} size={38} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span
              className={cn("truncate text-[14px] text-ink", unread.total > 0 ? "font-semibold" : "font-medium")}
            >
              {roomTitle(room)}
            </span>
            {room.groupMuted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {level === "none" && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
            <span
              suppressHydrationWarning
              className="ml-auto shrink-0 text-[12px] text-muted-foreground"
            >
              {last ? formatTime(last.timestamp, { timeZone: currentUser.timeZone }) : ""}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
              {draft ? (
                <span className="flex items-center gap-1 text-[#8A4F00]">
                  <Pencil className="h-3 w-3 shrink-0" />
                  <span className="truncate">{draft.text}</span>
                </span>
              ) : last ? (
                `${room.type !== "direct" ? `${userById(last.senderId).name.split(" ")[0]}: ` : ""}${plainText(previewText(last))}`
              ) : (
                "No messages yet"
              )}
            </span>
            {mentions > 0 && (
              <span
                aria-label={`${mentions} unread mentions`}
                className="flex h-[18px] shrink-0 items-center gap-0.5 rounded-full bg-[#D93A2F] px-1.5 text-[11px] font-semibold leading-none text-white"
              >
                <AtSign className="h-2.5 w-2.5" />
                {mentions}
              </span>
            )}
            {unread.total > 0 && (
              <span
                aria-label={`${unread.total} unread messages`}
                className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none tabular-nums text-primary-foreground"
              >
                {unread.total}
              </span>
            )}
          </span>
        </span>
      </button>
    );

    if (room.type !== "group") return roomButton;

    return (
      <Tooltip key={room.id}>
        <TooltipTrigger asChild>{roomButton}</TooltipTrigger>
        <TooltipContent side="top" align="start" sideOffset={8} className="w-64 p-3">
          <div className="flex items-center gap-2.5">
            <GroupAvatar name={roomTitle(room)} color={room.color} photo={room.photo} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{roomTitle(room)}</p>
              {room.topic && (
                <p className="truncate text-[12px] text-primary-foreground/85">{room.topic}</p>
              )}
            </div>
          </div>
          {room.description && (
            <p className="mt-2 text-xs leading-relaxed text-primary-foreground/90">
              {room.description}
            </p>
          )}
          <p className="mt-2 text-[12px] text-primary-foreground/80">
            {memberCount} members · {onlineCount} online
          </p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        aria-label="Conversations"
        className="conversation-rail flex h-full w-full flex-col border-r border-border"
      >
        <div className="flex h-14 items-center gap-2 pl-5 pr-3">
          <h1 className="min-w-0 flex-1 truncate text-[18px] font-semibold text-ink">Chat</h1>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close conversation sidebar"
              title="Close conversations"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#6E6E76] transition-colors hover:bg-black/[0.05] hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative px-4">
          <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E6E76]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="h-10 border-input bg-white pl-9 text-sm shadow-none"
          />
        </div>

        <div className="flex gap-2 px-4 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-white text-[14px] font-medium text-ink transition-colors hover:bg-[#F4F4F6]">
              <MessageSquarePlus className="h-4 w-4 text-[#6E6E76]" /> New chat
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Message</DropdownMenuLabel>
              {users
                .filter((user) => user.id !== currentUserId)
                .map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => openDirect(user.id)}
                    className="gap-2"
                  >
                    <UserAvatar user={user} size={22} showStatus /> {user.name}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCreateGroup}>
                <Users className="mr-2 h-4 w-4" /> New group…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={onCreateGroup}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-white text-[14px] font-medium text-ink transition-colors hover:bg-[#F4F4F6]"
          >
            <Users className="h-4 w-4 text-[#6E6E76]" /> New group
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-6 pt-1">
          {sections.map((section) =>
            section.rooms.length === 0 ? null : (
              <RailSection
                key={section.key}
                label={section.label}
                icon={section.icon}
                count={section.rooms.length}
                collapsed={collapsed.has(section.key)}
                onToggle={() => toggleSection(section.key)}
              >
                {section.rooms.map(renderRoom)}
              </RailSection>
            ),
          )}

          {directs.length > 0 && (
            <RailSection
              label="Direct messages"
              icon={MessageSquarePlus}
              count={directs.length}
              collapsed={collapsed.has("direct")}
              onToggle={() => toggleSection("direct")}
            >
              {directs.map(renderRoom)}
            </RailSection>
          )}

          {people.length > 0 && (
            <section>
              <p className="px-4 pb-1.5 text-[12px] font-semibold text-muted-foreground">
                People
              </p>
              <div className="space-y-1 px-2">
                {people.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => openDirect(user.id)}
                    className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-black/[0.05]"
                  >
                    <UserAvatar user={user} size={34} showStatus />
                    <span className="text-sm font-medium">{user.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {archivedRooms.length > 0 && (
            <section>
              <button
                onClick={() => setShowArchived((open) => !open)}
                aria-expanded={showArchived}
                className="flex w-full items-center gap-1.5 px-4 pb-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <Archive className="h-3 w-3" /> Archived · {archivedRooms.length}
              </button>
              {showArchived && (
                <div className="space-y-1 px-2">{archivedRooms.map(renderRoom)}</div>
              )}
            </section>
          )}

          {filtered.length === 0 && people.length === 0 && query && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No chats or people found.
            </p>
          )}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

/** A collapsible group of rooms in the conversation rail. */
function RailSection({
  label,
  icon: Icon,
  count,
  collapsed,
  onToggle,
  children,
}: {
  label: string;
  icon: typeof Hash;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 px-4 pb-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={cn("h-3 w-3 shrink-0 transition-transform", collapsed && "-rotate-90")}
        />
        <span>{label}</span>
              </button>
      {!collapsed && <div className="space-y-0.5 px-2">{children}</div>}
    </section>
  );
}
