import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, CheckSquare, ChevronRight, Menu, Search, WifiOff } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { actionOwner } from '@/modules/rts/status';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/chat/UserAvatar';

interface TopBarProps {
  onOpenCommandPalette: () => void;
  onOpenSidebar: () => void;
}

/** Path segments whose prettified form would read wrong. */
const SEGMENT_LABEL: Record<string, string> = {
  rfq: 'RFQs',
  ai: 'AI',
  grn: 'GRN',
  mis: 'MIS',
  hr: 'HR Review',
  pay: 'Disbursement',
  mailing: 'Mail',
  pact: 'PACT automation',
  kpac: 'KPAC & PACT',
};

export const TopBar: React.FC<TopBarProps> = ({ onOpenCommandPalette, onOpenSidebar }) => {
  const location = useLocation();
  const { users, currentUser, setCurrentUserId } = useChat();
  const { requests, notifications, connected } = useRts();

  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Real counts, read from the same stores the screens read.
  const pendingApprovals = requests.filter((request) => {
    const owner = actionOwner(request.status);
    return owner === 'HR' || owner === 'ACCOUNTS';
  }).length;
  const unread = notifications.filter((notification) => !notification.read).length;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 select-none items-center justify-between gap-4 border-b border-hairline bg-white px-4 text-ink sm:px-8">
      {/* Left: breadcrumbs */}
      <div className="flex min-w-0 items-center gap-1.5 text-caption text-meta">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-black/5 hover:text-ink md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        {pathSegments.length === 0 ? (
          <span className="font-medium text-ink">Home</span>
        ) : (
          pathSegments
            .map((segment, idx) => ({ segment, idx }))
            .filter(({ segment }) => segment !== 'admin')
            .map(({ segment, idx }, position) => {
              const isLast = idx === pathSegments.length - 1;
              const path = `/${pathSegments.slice(0, idx + 1).join('/')}`;
              const pretty = segment.replace(/-/g, ' ');
              const formatted =
                SEGMENT_LABEL[segment] ??
                (/\d/.test(segment)
                  ? segment.toUpperCase()
                  : pretty.charAt(0).toUpperCase() + pretty.slice(1));

              return (
                <React.Fragment key={path}>
                  {position > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                  {isLast ? (
                    <span className="truncate font-medium text-ink">{formatted}</span>
                  ) : (
                    <Link to={path} className="shrink-0 transition-colors hover:text-ink">
                      {formatted}
                    </Link>
                  )}
                </React.Fragment>
              );
            })
        )}
      </div>

      {/* Right: search, connection, identity */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          className="hidden h-9 w-64 items-center gap-2 rounded-md border border-hairline bg-canvas px-3 text-body-s text-faint transition-colors hover:border-hairline-strong md:flex"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Search</span>
        </button>

        {/* Only an outage is worth saying out loud. */}
        {!connected && (
          <span
            role="status"
            aria-label="Offline connection"
            className="ku-stamp hidden text-st-amber-ink sm:inline-flex"
            title="The live event stream is down; figures may be stale"
          >
            <WifiOff className="h-3 w-3" />
            Offline
          </span>
        )}

        <button
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          title="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-faint transition-colors hover:bg-black/5 hover:text-ink"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#D93A2F] ring-2 ring-white" />
          )}
        </button>

        {/*
          One identity for the whole console: the chat, the claim card in a
          thread and the reviewer buttons all read from it.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Account menu for ${currentUser.name}`}
            className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-black/5 xl:rounded-md xl:py-1 xl:pl-1 xl:pr-2.5"
          >
            <UserAvatar user={currentUser} size={30} />
            <span className="hidden text-body-s font-medium text-ink xl:block">{currentUser.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 border-hairline bg-white">
            <div className="px-2 py-2">
              <p className="text-body-s font-semibold text-ink">{currentUser.name}</p>
              <p className="text-caption text-meta">
                {currentUser.role} · {currentUser.department}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-hairline" />
            <DropdownMenuLabel className="text-caption font-medium text-meta">Switch user</DropdownMenuLabel>
            <div className="max-h-72 overflow-y-auto">
              {users.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setCurrentUserId(user.id)}
                  className="cursor-pointer gap-2 hover:bg-canvas"
                >
                  <UserAvatar user={user} size={22} showStatus />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-s text-ink">{user.name}</span>
                    <span className="block truncate text-micro text-meta">{user.role}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
