import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, CheckSquare, ChevronRight, Search, WifiOff } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { actionOwner } from '@/modules/rts/status';
import { useWorkspace } from '@/lib/workspace';
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
}

/** Path segments whose prettified form would read wrong. */
const SEGMENT_LABEL: Record<string, string> = {
  rfq: 'RFQs',
  ai: 'AI',
  grn: 'GRN',
  mis: 'MIS',
  hr: 'Claims Review',
  people: 'People',
  reimbursements: 'Claims',
  pay: 'Disbursement',
};

export const TopBar: React.FC<TopBarProps> = ({ onOpenCommandPalette }) => {
  const location = useLocation();
  const { users, currentUser, setCurrentUserId } = useChat();
  const { requests, notifications, connected } = useRts();
  const { workspace, home } = useWorkspace();

  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Real counts, read from the same stores the screens read.
  const pendingApprovals = requests.filter((request) => {
    const owner = actionOwner(request.status);
    return owner === 'HR' || owner === 'ACCOUNTS';
  }).length;
  const unread = notifications.filter((notification) => !notification.read).length;
  const claimsPath =
    workspace?.key === 'hr'
      ? '/hr'
      : workspace?.key === 'accounts' || workspace?.key === 'finance'
        ? '/reimbursements'
        : null;

  return (
    <header className="h-16 bg-surface/85 backdrop-blur-xl border-b border-line px-6 flex items-center justify-between gap-4 select-none sticky top-0 z-20">
      {/* Left: breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-muted min-w-0">
        <Link to={home} className="hover:text-ink font-medium shrink-0">
          {workspace?.label ?? 'Kiran Connect'}
        </Link>
        {pathSegments.length === 0 ? null : (
          pathSegments.map((segment, idx) => {
            const isLast = idx === pathSegments.length - 1;
            const path = `/${pathSegments.slice(0, idx + 1).join('/')}`;
            const formatted =
              SEGMENT_LABEL[segment] ??
              segment.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

            return (
              <React.Fragment key={path}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                {isLast ? (
                  <span className="text-ink font-semibold truncate">{formatted}</span>
                ) : (
                  <Link to={path} className="hover:text-ink shrink-0">
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
          className="w-full bg-canvas hover:bg-white border border-line hover:border-kiran/30 rounded-md px-3 py-2 text-xs text-muted flex items-center justify-between transition-all duration-150 hover:shadow-card group"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-muted group-hover:text-kiran transition-colors shrink-0" />
            <span className="text-muted truncate">Search this workspace…</span>
          </span>
          <kbd className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-xs bg-white border border-line text-muted shrink-0">
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
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-canvas border border-line text-[11px] font-mono"
            title="Connected to the live event stream"
          >
            <span className="w-2 h-2 rounded-full bg-strand-green shrink-0" />
            <span className="font-medium text-slate-700">Live</span>
          </span>
        ) : (
          <span
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-strand-amber/10 border border-strand-amber/25 text-[11px] font-mono text-strand-amber"
            title="The live event stream is down; figures may be stale"
          >
            <WifiOff className="w-3 h-3" />
            <span className="font-medium">Offline</span>
          </span>
        )}

        {/* Only the departments that review claims carry the review counter. */}
        {claimsPath && (
          <Link
            to={claimsPath}
            className="relative p-1.5 rounded text-slate-600 hover:text-ink hover:bg-canvas transition-colors border border-transparent hover:border-line"
            title="Claims awaiting a reviewer"
          >
            <CheckSquare className="w-4 h-4 text-strand-amber" />
            {pendingApprovals > 0 && (
              <span className="absolute -top-1 -right-1 font-mono text-[9px] font-bold px-1 rounded-full bg-strand-amber text-white shadow-xs">
                {pendingApprovals}
              </span>
            )}
          </Link>
        )}

        <Link
          to="/activity"
          className="relative p-1.5 rounded text-slate-600 hover:text-ink hover:bg-canvas transition-colors"
          title="Activity across departments"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-strand-red" />
          )}
        </Link>

        {/*
          One identity for the whole console — the chat, the claim card in a
          thread and the reviewer buttons all read from it. During a
          demonstration this is what lets one presenter be the employee, then
          HR, then Accounts, without three browser windows.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 pl-2 border-l border-line rounded-r-md py-1 pr-1.5 hover:bg-canvas transition-colors">
            <UserAvatar user={currentUser} size={30} />
            <div className="hidden xl:flex flex-col leading-tight text-left">
              <span className="text-xs font-semibold text-ink">{currentUser.name}</span>
              <span className="text-[10px] text-muted">{currentUser.role}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="px-2 pb-2">
              <p className="text-[13px] font-semibold text-ink">{currentUser.name}</p>
              <p className="text-[11px] text-muted">
                {currentUser.role} · {currentUser.department}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>View the console as</DropdownMenuLabel>
            <div className="max-h-72 overflow-y-auto">
              {users.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setCurrentUserId(user.id)}
                  className="gap-2"
                >
                  <UserAvatar user={user} size={22} showStatus />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px]">{user.name}</span>
                    <span className="block truncate text-[10px] text-muted">{user.role}</span>
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
