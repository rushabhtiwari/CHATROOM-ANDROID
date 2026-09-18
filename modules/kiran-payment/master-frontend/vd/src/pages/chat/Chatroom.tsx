/**
 * The conversation workspace, mounted inside the KiranOS shell.
 *
 * This is the chat module's original workspace with one structural change: it
 * no longer paints its own application chrome. KiranOS already supplies the
 * rail, the breadcrumb bar and the identity menu, so a second set of those
 * would announce to the client that they are looking at two products stitched
 * together. What remains is the part only this module can provide — the
 * conversation list, the thread, the composer and the detail panel.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  BellOff,
  ImagePlus,
  Info,
  Menu,
  MoreVertical,
  PanelLeftOpen,
  Pin,
  Search,
  Settings,
  Sparkles,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { MessageThread } from '@/components/chat/MessageThread';
import { Composer } from '@/components/chat/Composer';
import { ContextPanel } from '@/components/chat/ContextPanel';
import { AgentDock } from '@/components/chat/AgentDock';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { ThreadPanel } from '@/components/chat/ThreadPanel';
import { CommandPalette } from '@/components/chat/CommandPalette';
import { ForwardDialog } from '@/components/chat/ForwardDialog';
import { RoomSettingsDialog } from '@/components/chat/RoomSettingsDialog';
import { SavedPinnedDialog, type SavedPinnedMode } from '@/components/chat/SavedPinnedDialog';
import { ShortcutsDialog } from '@/components/chat/ShortcutsDialog';
import { GroupAvatar, UserAvatar } from '@/components/chat/UserAvatar';
import { UserProfileDialog } from '@/components/chat/UserProfileDialog';
import { GroupProfileDialog } from '@/components/chat/GroupProfileDialog';
import { PinnedMessageBanner } from '@/components/chat/PinnedMessageBanner';
import { StorageBanner } from '@/components/chat/StorageBanner';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { useChat } from '@/lib/chat-store';
import { previewText, type SharedMessage, type User, type UserId } from '@/lib/chat-types';
import { formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SettingsTab = 'about' | 'members' | 'invite' | 'appearance';

export const Chatroom: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [groupOpen, setGroupOpen] = useState(false);
  const [preselected, setPreselected] = useState<UserId[]>([]);
  const [replyTo, setReplyTo] = useState<SharedMessage | null>(null);
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState<SharedMessage | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [msgQuery, setMsgQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('about');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedMode, setSavedMode] = useState<SavedPinnedMode>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [headerProfile, setHeaderProfile] = useState<User | null>(null);
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);

  const {
    activeRoom,
    roomTitle,
    userById,
    currentUser,
    currentUserId,
    visibleRooms,
    setActiveRoom,
    searchMessages,
    jumpToMessage,
    summarizeRoom,
    online,
    setOnline,
    outbox,
    plainText,
    unreadFor,
    isAdmin,
    toggleGroupMute,
    notificationLevel,
    setNotificationLevel,
  } = useChat();

  const openCreateGroup = useCallback((ids: UserId[] = []) => {
    setPreselected(ids);
    setGroupOpen(true);
  }, []);

  const openSettings = useCallback((tab: SettingsTab = 'about') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  /* -------------------------- permalink handling -------------------------- */

  const linkRoom = searchParams.get('room');
  const linkMsg = searchParams.get('msg');

  useEffect(() => {
    if (!linkRoom || !linkMsg) return;
    jumpToMessage(linkRoom, linkMsg);
    // Clear the params so a refresh doesn't re-trigger the jump.
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkRoom, linkMsg]);

  /* ------------------------ global keyboard shortcuts --------------------- */

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return (
        element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setSavedMode('saved');
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setSavedMode('pinned');
        return;
      }
      if (meta && event.key.toLowerCase() === 'f' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        const index = visibleRooms.findIndex((room) => room.id === activeRoom.id);
        const next =
          event.key === 'ArrowUp'
            ? (index - 1 + visibleRooms.length) % visibleRooms.length
            : (index + 1) % visibleRooms.length;
        const target = visibleRooms[next];
        if (target) setActiveRoom(target.id);
        return;
      }
      if (event.key === 'Escape') {
        // The dock minimizes itself on Escape; closing search or the thread
        // behind it at the same time would be two actions for one keypress.
        const target = event.target as HTMLElement | null;
        if (target?.closest?.('[data-agent-dock]')) return;
        if (searchOpen) setSearchOpen(false);
        else if (threadRootId) setThreadRootId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visibleRooms, activeRoom.id, setActiveRoom, searchOpen, threadRootId]);

  /* -------------------------------- derived ------------------------------- */

  const participants = activeRoom.participantIds.map(userById);
  const onlineCount = participants.filter((user) => user.online).length;
  const otherId = activeRoom.participantIds.find((id) => id !== currentUserId);
  const results = useMemo(
    () => (msgQuery.trim() ? searchMessages(msgQuery, activeRoom.id) : []),
    [msgQuery, searchMessages, activeRoom.id],
  );
  const unread = unreadFor(activeRoom.id);

  return (
    <div className="workspace-shell flex h-full min-h-0 flex-col overflow-hidden text-sm">
      <a
        href="#composer"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to message composer
      </a>

      <StorageBanner />

      <div className="flex min-h-0 flex-1">
        {/* Conversation rail */}
        <div
          className={cn(
            'hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-out-refined lg:block',
            sidebarOpen ? 'w-[290px]' : 'w-0',
          )}
        >
          <PanelErrorBoundary label="The conversation list">
            <ConversationSidebar
              onCreateGroup={() => openCreateGroup([])}
              onClose={() => setSidebarOpen(false)}
            />
          </PanelErrorBoundary>
        </div>

        {mobileNav && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="w-[85%] max-w-sm animate-msg-in bg-surface">
              <PanelErrorBoundary label="The conversation list">
                <ConversationSidebar
                  onCreateGroup={() => {
                    setMobileNav(false);
                    openCreateGroup([]);
                  }}
                  onSelect={() => setMobileNav(false)}
                />
              </PanelErrorBoundary>
            </div>
            <div
              className="flex-1 bg-ink/25"
              role="button"
              tabIndex={0}
              aria-label="Close conversation list"
              onClick={() => setMobileNav(false)}
              onKeyDown={(event) => event.key === 'Enter' && setMobileNav(false)}
            />
          </div>
        )}

        {/* Conversation */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="chat-header flex h-[60px] shrink-0 items-center gap-3 border-b border-line px-4 md:px-5">
            <button
              aria-label="Open conversation list"
              className="rounded-md border border-line p-2 text-muted hover:bg-line-2 hover:text-ink lg:hidden"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="h-4 w-4" />
            </button>

            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open conversation sidebar"
                title="Show conversations"
                className="hidden h-8 w-8 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-line-2 hover:text-ink lg:inline-flex"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            {activeRoom.type === 'direct' ? (
              <button
                type="button"
                onClick={() => setHeaderProfile(userById(otherId ?? currentUserId))}
                aria-label={`View ${userById(otherId ?? currentUserId).name} profile`}
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-kiran"
              >
                <UserAvatar user={userById(otherId ?? currentUserId)} size={36} showStatus />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGroupProfileOpen(true)}
                aria-label={`View ${roomTitle(activeRoom)} group information`}
                className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-kiran"
              >
                <GroupAvatar
                  name={roomTitle(activeRoom)}
                  color={activeRoom.color}
                  photo={activeRoom.photo}
                  size={36}
                />
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                activeRoom.type === 'direct'
                  ? setHeaderProfile(userById(otherId ?? currentUserId))
                  : setGroupProfileOpen(true)
              }
              className="min-w-0 rounded-md text-left transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kiran"
            >
              <span className="flex items-center gap-2 truncate text-[13.5px] font-semibold text-ink">
                {roomTitle(activeRoom)}
                {activeRoom.archived && (
                  <span className="rounded-badge bg-line-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
                    Archived
                  </span>
                )}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {activeRoom.topic
                  ? activeRoom.topic
                  : activeRoom.type === 'direct'
                    ? userById(otherId ?? currentUserId).online
                      ? 'Online'
                      : 'Offline'
                    : `${participants.length} members · ${onlineCount} online`}
              </span>
            </button>

            <div className="ml-auto flex items-center gap-1">
              {outbox.length > 0 && (
                <span className="hidden rounded-badge bg-strand-amber/12 px-2 py-1 font-mono text-[10px] font-medium text-strand-amber sm:inline">
                  {outbox.length} queued
                </span>
              )}
              {!online && (
                <button
                  onClick={() => setOnline(true)}
                  title="Offline — click to reconnect"
                  className="flex items-center gap-1.5 rounded-badge bg-strand-red/10 px-2 py-1 text-[10px] font-medium text-strand-red"
                >
                  <WifiOff className="h-3 w-3" /> Offline
                </button>
              )}

              {unread.total > 0 && (
                <button
                  onClick={() => void summarizeRoom(activeRoom.id)}
                  className="hidden items-center gap-1.5 rounded-md border border-ai/20 bg-ai-tint px-2.5 py-1.5 text-[11px] font-medium text-ai transition-colors hover:border-ai/35 sm:flex"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Catch me up
                </button>
              )}

              <button
                onClick={() => setSavedMode('pinned')}
                aria-label="Pinned messages"
                className="rounded-md p-2 text-muted transition-colors hover:bg-line-2 hover:text-ink"
              >
                <Pin className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSearchOpen((open) => !open)}
                aria-label="Search in conversation"
                aria-expanded={searchOpen}
                className="rounded-md p-2 text-muted transition-colors hover:bg-line-2 hover:text-ink"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1280) {
                    setMobilePanel(true);
                  } else {
                    setContextPanelOpen((open) => !open);
                  }
                }}
                aria-label={
                  contextPanelOpen ? 'Hide conversation details' : 'Show conversation details'
                }
                aria-expanded={contextPanelOpen}
                className={cn(
                  'rounded-md p-2 transition-colors hover:bg-line-2',
                  contextPanelOpen ? 'bg-line-2 text-ink' : 'text-muted hover:text-ink',
                )}
              >
                <Info className="h-4 w-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Conversation actions"
                  className="rounded-md p-2 text-muted transition-colors hover:bg-line-2 hover:text-ink"
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={notificationLevel(activeRoom.id) === 'all'}
                    onSelect={() => setNotificationLevel(activeRoom.id, 'all')}
                  >
                    <Bell className="mr-2 h-4 w-4" /> All messages
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={notificationLevel(activeRoom.id) === 'mentions'}
                    onSelect={() => setNotificationLevel(activeRoom.id, 'mentions')}
                  >
                    <Bell className="mr-2 h-4 w-4" /> Mentions only
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={notificationLevel(activeRoom.id) === 'none'}
                    onSelect={() => setNotificationLevel(activeRoom.id, 'none')}
                  >
                    <BellOff className="mr-2 h-4 w-4" /> Nothing
                  </DropdownMenuCheckboxItem>
                  {activeRoom.type === 'group' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={Boolean(activeRoom.groupMuted)}
                        disabled={!isAdmin(activeRoom, currentUserId)}
                        onSelect={() => toggleGroupMute(activeRoom.id)}
                      >
                        <BellOff className="mr-2 h-4 w-4" /> Mute group
                      </DropdownMenuCheckboxItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openSettings('about')}>
                    <Settings className="mr-2 h-4 w-4" /> Conversation settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openSettings('members')}>
                    <Users className="mr-2 h-4 w-4" /> Manage members
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openSettings('appearance')}>
                    <ImagePlus className="mr-2 h-4 w-4" /> Chat wallpaper
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openCreateGroup(activeRoom.participantIds)}>
                    <Users className="mr-2 h-4 w-4" /> Create group with members
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void summarizeRoom(activeRoom.id)}>
                    <Sparkles className="mr-2 h-4 w-4 text-ai" /> Catch me up
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <PinnedMessageBanner onViewAll={() => setSavedMode('pinned')} />

          {searchOpen && (
            <div className="animate-msg-in border-b border-line bg-surface px-4 py-3 md:px-6">
              <Input
                autoFocus
                value={msgQuery}
                onChange={(event) => setMsgQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && setSearchOpen(false)}
                placeholder="Search in this conversation…"
                aria-label="Search in this conversation"
                className="h-9 border-line bg-surface text-sm"
              />
              {msgQuery && (
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto text-xs">
                  {results.length === 0 && <p className="text-muted">No matches</p>}
                  {results.map((message) => (
                    <button
                      key={message.id}
                      onClick={() => {
                        jumpToMessage(message.roomId, message.id);
                        setSearchOpen(false);
                        setMsgQuery('');
                      }}
                      className="flex w-full items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-left transition-colors hover:bg-line-2"
                    >
                      <b className="shrink-0">{userById(message.senderId).name.split(' ')[0]}:</b>
                      <span className="min-w-0 flex-1 truncate">
                        {plainText(previewText(message))}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted">
                        {formatRelative(message.timestamp)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Keyed on the room: a message that cannot render is escaped by
              switching conversation, rather than stranding the user. */}
          <PanelErrorBoundary label="This conversation" resetKey={activeRoom.id}>
            <MessageThread
              onReply={setReplyTo}
              onOpenThread={setThreadRootId}
              onForward={setForwarding}
            />
          </PanelErrorBoundary>

          <div id="composer">
            <PanelErrorBoundary label="The message composer" resetKey={activeRoom.id}>
              <Composer
                replyTo={replyTo}
                clearReply={() => setReplyTo(null)}
                onOpenInvite={() => openSettings('invite')}
                onOpenShortcuts={() => setShortcutsOpen(true)}
              />
            </PanelErrorBoundary>
          </div>
        </main>

        {/* The thread panel takes the detail column while it is open */}
        {threadRootId ? (
          <div className="hidden w-[320px] shrink-0 border-l border-line xl:block">
            <PanelErrorBoundary label="This thread" resetKey={threadRootId}>
              <ThreadPanel
                rootId={threadRootId}
                onClose={() => setThreadRootId(null)}
                onForward={setForwarding}
              />
            </PanelErrorBoundary>
          </div>
        ) : (
          <aside
            className={cn(
              'hidden shrink-0 overflow-hidden border-l border-line bg-surface transition-[width] duration-300 ease-out-refined xl:block',
              contextPanelOpen ? 'w-[320px]' : 'w-0 border-l-0',
            )}
          >
            <div className="h-full w-[320px]">
              <PanelErrorBoundary label="Conversation info" resetKey={activeRoom.id}>
                <ContextPanel
                  onCreateGroup={(ids) => openCreateGroup(ids)}
                  onOpenSettings={(tab) => openSettings(tab)}
                  onOpenProfile={(id) => setHeaderProfile(userById(id))}
                  onClose={() => setContextPanelOpen(false)}
                />
              </PanelErrorBoundary>
            </div>
          </aside>
        )}

        {threadRootId && (
          <div className="fixed inset-0 z-50 flex justify-end xl:hidden">
            <div
              className="flex-1 bg-ink/25"
              role="button"
              tabIndex={0}
              aria-label="Close thread"
              onClick={() => setThreadRootId(null)}
              onKeyDown={(event) => event.key === 'Enter' && setThreadRootId(null)}
            />
            <div className="w-[92%] max-w-md animate-msg-in bg-surface">
              <PanelErrorBoundary label="This thread" resetKey={threadRootId}>
                <ThreadPanel
                  rootId={threadRootId}
                  onClose={() => setThreadRootId(null)}
                  onForward={setForwarding}
                />
              </PanelErrorBoundary>
            </div>
          </div>
        )}

        {mobilePanel && (
          <div className="fixed inset-0 z-50 flex justify-end xl:hidden">
            <div
              className="flex-1 bg-ink/25"
              role="button"
              tabIndex={0}
              aria-label="Close panel"
              onClick={() => setMobilePanel(false)}
              onKeyDown={(event) => event.key === 'Enter' && setMobilePanel(false)}
            />
            <div className="relative w-[90%] max-w-sm animate-msg-in overflow-y-auto border-l border-line bg-surface">
              <button
                onClick={() => setMobilePanel(false)}
                aria-label="Close panel"
                className="absolute right-3 top-3 rounded-md border border-line bg-surface p-2 hover:bg-line-2"
              >
                <X className="h-4 w-4" />
              </button>
              <PanelErrorBoundary label="Conversation info" resetKey={activeRoom.id}>
                <ContextPanel
                  onCreateGroup={(ids) => {
                    setMobilePanel(false);
                    openCreateGroup(ids);
                  }}
                  onOpenSettings={(tab) => {
                    setMobilePanel(false);
                    openSettings(tab);
                  }}
                  onOpenProfile={(id) => {
                    setMobilePanel(false);
                    setHeaderProfile(userById(id));
                  }}
                />
              </PanelErrorBoundary>
            </div>
          </div>
        )}
      </div>

      <CreateGroupDialog open={groupOpen} onOpenChange={setGroupOpen} preselected={preselected} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenSaved={() => setSavedMode('saved')}
        onOpenPinned={() => setSavedMode('pinned')}
        onOpenInvite={() => openSettings('invite')}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onCreateGroup={() => openCreateGroup([])}
      />
      <ForwardDialog message={forwarding} onClose={() => setForwarding(null)} />
      <RoomSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsTab}
      />
      <SavedPinnedDialog mode={savedMode} onClose={() => setSavedMode(null)} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <UserProfileDialog
        user={headerProfile ?? currentUser}
        open={Boolean(headerProfile)}
        onOpenChange={(open) => !open && setHeaderProfile(null)}
      />
      <GroupProfileDialog
        open={groupProfileOpen}
        onOpenChange={setGroupProfileOpen}
        onOpenSettings={() => openSettings('about')}
      />

      <PanelErrorBoundary label="The assistant" resetKey={activeRoom.id}>
        <AgentDock suppressed={mobileNav || mobilePanel} />
      </PanelErrorBoundary>
    </div>
  );
};

export default Chatroom;
