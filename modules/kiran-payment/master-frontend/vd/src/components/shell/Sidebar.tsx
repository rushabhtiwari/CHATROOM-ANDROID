import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { actionOwner } from '@/modules/rts/status';
import { useWorkspace, type BadgeKey, type WorkspaceNavItem } from '@/lib/workspace';

/** Only unread / late counts earn the red pill; the rest are quiet numbers. */
const ALERT_BADGES: ReadonlySet<BadgeKey> = new Set<BadgeKey>(['unread', 'activity']);

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('kiran_sidebar_collapsed') === 'true';
  });

  const location = useLocation();
  const { workspace, navGroups, home } = useWorkspace();

  /*
   * Badges are counts, not decoration. A rail that says "6" when there are
   * three is worse than a rail that says nothing, so these read from the same
   * stores the screens do and disappear when they reach zero.
   */
  const { visibleRooms, unreadFor } = useChat();
  const { requests, notifications } = useRts();

  const owners = requests.map((request) => actionOwner(request.status));
  const badges: Record<BadgeKey, number> = {
    unread: visibleRooms.reduce((total, room) => total + unreadFor(room.id).total, 0),
    activity: notifications.filter((notification) => !notification.read).length,
    withHr: owners.filter((owner) => owner === 'HR').length,
    awaitingReview: owners.filter((owner) => owner === 'HR' || owner === 'ACCOUNTS').length,
    awaitingPayment: owners.filter((owner) => owner === 'PAYMENTS').length,
  };

  useEffect(() => {
    localStorage.setItem('kiran_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  // The rail highlights exactly one row: the deepest entry whose path the
  // current URL sits under. A plain prefix test would light up a parent and
  // its child at the same time.
  const activePath = navGroups
    .flatMap((group) => group.items.map((item) => item.path))
    .filter((path): path is string => Boolean(path))
    .filter((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];

  const rowClass = (isActive: boolean) =>
    `group relative flex items-center gap-2.5 h-9 rounded-md text-[14px] font-medium transition-colors duration-150 ${
      collapsed ? 'justify-center px-0' : 'px-2.5'
    } ${
      isActive
        ? 'bg-[#DCE6F4] text-[#0B4F9C]'
        : 'text-ink-3 hover:bg-black/[0.05] hover:text-ink'
    }`;

  const renderItem = (item: WorkspaceNavItem) => {
    const Icon = item.icon;
    const isActive = item.path !== undefined && item.path === activePath;
    const count = item.badge ? badges[item.badge] : 0;

    const content = (
      <>
        <Icon
          className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0B4F9C]' : 'text-[#6E6E76]'}`}
          strokeWidth={1.8}
        />
        {!collapsed && <span className="truncate flex-1">{item.name}</span>}
        {!collapsed && item.href && (
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-[#9A9AA2]" />
        )}
        {!collapsed && item.badge && count > 0 && (
          ALERT_BADGES.has(item.badge) ? (
            <span className="text-[11px] font-semibold leading-none px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full text-white bg-[#D93A2F] shrink-0 tabular-nums">
              {count}
            </span>
          ) : (
            <span className="text-[12px] font-medium text-[#6E6E76] shrink-0 tabular-nums pr-0.5">
              {count}
            </span>
          )
        )}
      </>
    );

    // Another application (the PACT console, KCMS) opens beside this one
    // rather than replacing it, so the department tab is still there after.
    if (item.href) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? item.name : `${item.name} (opens in a new tab)`}
          className={rowClass(false)}
        >
          {content}
        </a>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path ?? home}
        title={collapsed ? item.name : undefined}
        className={rowClass(isActive)}
      >
        {content}
      </NavLink>
    );
  };

  return (
    <aside
      className={`bg-[#F2F2F5] border-r border-[#E1E1E6] text-ink transition-[width] duration-200 ease-out-refined flex flex-col select-none relative z-30 shrink-0 ${
        collapsed ? 'w-[68px]' : 'w-[248px]'
      }`}
    >
      {/* Brand mark + workspace name */}
      <div
        className={`h-14 flex items-center shrink-0 ${
          collapsed ? 'justify-center px-0' : 'justify-between pl-4 pr-2.5'
        }`}
      >
        <NavLink to={home} className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <div className="w-8 h-8 rounded-md bg-white border border-line flex items-center justify-center shrink-0">
            <img
              src="/kiran-mark.png"
              alt="Kiran Cable Protection"
              className="w-5 h-5 object-contain"
            />
          </div>
          {!collapsed && (
            <span className="font-semibold text-ink text-[16px] tracking-[-0.01em] leading-none truncate">
              {workspace?.label ?? 'Connect'}
            </span>
          )}
        </NavLink>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6E76] hover:text-ink hover:bg-black/[0.05] transition-colors shrink-0"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-1 w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6E76] hover:text-ink hover:bg-black/[0.05] transition-colors"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-4 px-3 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {!collapsed ? (
              <div className="px-2.5 pb-1 text-[12px] font-semibold text-[#6E6E76]">
                {group.label}
              </div>
            ) : (
              <div className="mx-2 border-t border-[#E1E1E6] my-2.5" />
            )}
            {group.items.map((item) => renderItem(item))}
          </div>
        ))}
      </nav>

      {/* Way back to the portal */}
      <div className={`py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        <a
          href="http://localhost:3000"
          title="All apps"
          className={`flex items-center gap-2.5 h-9 rounded-md text-[14px] font-medium text-[#5B5B63] hover:bg-black/[0.05] hover:text-ink transition-colors ${
            collapsed ? 'justify-center' : 'px-2.5'
          }`}
        >
          <ArrowLeft className="w-4 h-4 shrink-0 text-[#6E6E76]" strokeWidth={1.8} />
          {!collapsed && <span>All apps</span>}
        </a>
      </div>
    </aside>
  );
};
