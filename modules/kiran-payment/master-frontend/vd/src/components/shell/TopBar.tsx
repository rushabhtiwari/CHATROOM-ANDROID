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
    <header className="h-14 shrink-0 bg-surface border-b border-line px-6 flex items-center justify-between gap-4 select-none sticky top-0 z-20">
      {/* Left: breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[14px] text-muted min-w-0">
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
                  <span className="text-ink font-medium truncate">{formatted}</span>
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
          className="w-full h-9 bg-[#F4F4F6] hover:bg-[#EEEEF1] rounded-md px-3 text-[14px] text-[#6E6E76] flex items-center gap-2 transition-colors"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="truncate">Search</span>
        </button>
      </div>

      {/* Right: live state, approvals, identity */}
      <div className="flex items-center gap-3">
        {/* Say nothing while connected; only an outage is worth a word. */}
        {!connected && (
          <span
            className="hidden sm:flex items-center gap-1.5 h-6 px-2 rounded-sm bg-[#FBEFDC] text-[12px] font-medium text-[#8A4F00]"
            title="The live event stream is down; figures may be stale"
          >
            <WifiOff className="w-3 h-3" />
            Offline
          </span>
        )}

        {/* Only the departments that review claims carry the review counter. */}
        {claimsPath && (
          <Link
            to={claimsPath}
            className="relative w-9 h-9 inline-flex items-center justify-center rounded-md text-[#6E6E76] hover:text-ink hover:bg-black/[0.05] transition-colors"
            title="Claims awaiting a reviewer"
          >
            <CheckSquare className="w-[18px] h-[18px]" />
            {pendingApprovals > 0 && (
              <span className="absolute top-0.5 right-0.5 text-[10px] font-semibold leading-none min-w-[15px] h-[15px] px-1 inline-flex items-center justify-center rounded-full bg-[#D93A2F] text-white tabular-nums">
                {pendingApprovals}
              </span>
            )}
          </Link>
        )}

        <Link
          to="/activity"
          className="relative w-9 h-9 inline-flex items-center justify-center rounded-md text-[#6E6E76] hover:text-ink hover:bg-black/[0.05] transition-colors"
          title="Activity across departments"
        >
          <Bell className="w-[18px] h-[18px]" />
          {unread > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#D93A2F] ring-2 ring-white" />
          )}
        </Link>

        {/*
          One identity for the whole console — the chat, the claim card in a
          thread and the reviewer buttons all read from it. During a
          demonstration this is what lets one presenter be the employee, then
          HR, then Accounts, without three browser windows.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md py-1 pl-1.5 pr-2 hover:bg-black/[0.05] transition-colors">
            <UserAvatar user={currentUser} size={30} />
            <span className="hidden xl:block text-[14px] font-medium text-ink">{currentUser.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="px-2 pb-2">
              <p className="text-[14px] font-semibold text-ink">{currentUser.name}</p>
              <p className="text-[13px] text-muted">
                {currentUser.role} · {currentUser.department}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Switch person</DropdownMenuLabel>
            <div className="max-h-72 overflow-y-auto">
              {users.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setCurrentUserId(user.id)}
                  className="gap-2"
                >
                  <UserAvatar user={user} size={22} showStatus />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{user.name}</span>
                    <span className="block truncate text-[12px] text-muted">{user.role}</span>
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
