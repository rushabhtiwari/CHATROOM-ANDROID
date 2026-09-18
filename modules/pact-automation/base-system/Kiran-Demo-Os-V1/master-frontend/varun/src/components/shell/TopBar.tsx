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
    <header className="h-[68px] bg-surface-container-lowest border-b border-outline-variant px-4 sm:px-6 flex items-center justify-between gap-4 select-none sticky top-0 z-20 text-on-surface">
      {/* Left: breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-outline min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
          className="md:hidden shrink-0 rounded-none p-1.5 text-outline hover:bg-surface-container-low hover:text-on-surface"
        >
          <Menu className="h-4 w-4" />
        </button>
          <Link to="/" aria-label="Kiran PACT Automation home" className="hover:text-primary font-medium shrink-0 transition-colors">
          Kiran PACT
        </Link>
        {pathSegments.length === 0 ? (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant shrink-0" />
            <span className="text-on-surface font-semibold">Command Center</span>
          </>
        ) : (
          pathSegments.map((segment, idx) => {
            const isLast = idx === pathSegments.length - 1;
            const path = `/${pathSegments.slice(0, idx + 1).join('/')}`;
            const formatted =
              SEGMENT_LABEL[segment] ??
              segment.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

            return (
              <React.Fragment key={path}>
                <ChevronRight className="w-3.5 h-3.5 text-outline-variant shrink-0" />
                {isLast ? (
                  <span className="text-on-surface font-semibold truncate">{formatted}</span>
                ) : (
                  <Link to={path} className="text-outline hover:text-primary shrink-0 transition-colors">
                    {formatted}
                  </Link>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Middle: command palette */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          className="w-full bg-surface-container-low hover:bg-surface-container-lowest border border-outline-variant hover:border-[#E99741] rounded-none px-3 py-2.5 text-xs text-on-surface-variant flex items-center justify-between transition-colors duration-150 shadow-none group"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-outline group-hover:text-primary transition-colors shrink-0" />
            <span className="text-outline group-hover:text-on-surface-variant transition-colors truncate">Jump to mail or PACT…</span>
          </span>
          <kbd className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-none bg-surface-container-lowest border border-outline-variant text-outline shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: live state, approvals, identity */}
      <div className="flex items-center gap-3">
        {/* Honest about the server connection: the finance screens are live or
            they are not, and a stale figure is worse than a stated outage. */}
        {connected ? (
          <span
            role="status"
            aria-label="Live connection"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-none bg-surface-container-low border border-outline-variant text-[11px] font-mono"
            title="Connected to the live event stream"
          >
            <span className="w-2 h-2 rounded-full bg-st-green-ink shrink-0" />
            <span className="font-medium text-on-surface">Live</span>
          </span>
        ) : (
          <span
            role="status"
            aria-label="Offline connection"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-none bg-strand-amber/10 border border-strand-amber/30 text-[11px] font-mono text-strand-amber"
            title="The live event stream is down; figures may be stale"
          >
            <WifiOff className="w-3 h-3" />
            <span className="font-medium">Offline</span>
          </span>
        )}


        <button
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          title="Open command palette"
          className="relative p-1.5 rounded-none text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-strand-red" />
          )}
        </button>

        {/*
          One identity for the whole console — the chat, the claim card in a
          thread and the reviewer buttons all read from it. During a
          demonstration this is what lets one presenter be the employee, then
          HR, then Accounts, without three browser windows.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Account menu for ${currentUser.name}`} className="flex items-center gap-2 pl-2 border-l border-outline-variant rounded-none py-1 pr-1.5 hover:bg-surface-container-low transition-colors">
            <UserAvatar user={currentUser} size={30} />
            <div className="hidden xl:flex flex-col leading-tight text-left">
              <span className="text-xs font-semibold text-on-surface">{currentUser.name}</span>
              <span className="text-[10px] text-outline">{currentUser.role}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-surface-container-lowest border-outline-variant">
            <DropdownMenuLabel className="text-outline text-xs">Signed in as</DropdownMenuLabel>
            <div className="px-2 pb-2">
              <p className="text-[13px] font-semibold text-on-surface">{currentUser.name}</p>
              <p className="text-[11px] text-outline">
                {currentUser.role} · {currentUser.department}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-outline-variant" />
            <DropdownMenuLabel className="text-outline text-xs">View the console as</DropdownMenuLabel>
            <div className="max-h-72 overflow-y-auto">
              {users.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setCurrentUserId(user.id)}
                  className="gap-2 cursor-pointer hover:bg-surface-container-low"
                >
                  <UserAvatar user={user} size={22} showStatus />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-on-surface">{user.name}</span>
                    <span className="block truncate text-[10px] text-outline">{user.role}</span>
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
