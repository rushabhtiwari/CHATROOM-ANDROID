import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { actionOwner } from '@/modules/rts/status';
import { useWorkspace, type BadgeKey, type WorkspaceNavItem } from '@/lib/workspace';

const TEAL = '#00AEEF';

const BADGE_COLOR: Record<BadgeKey, string> = {
  unread: 'bg-strand-teal',
  activity: 'bg-strand-red',
  withHr: 'bg-strand-amber',
  awaitingReview: 'bg-strand-green',
  awaitingPayment: 'bg-kiran-600',
};

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
    `group relative flex items-center gap-2.5 rounded-md text-[12.5px] font-medium transition-colors duration-150 ${
      collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-[7px]'
    } ${
      isActive
        ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]'
        : 'text-white/65 hover:bg-white/[0.055] hover:text-white'
    }`;

  const renderItem = (item: WorkspaceNavItem, railColor: string) => {
    const Icon = item.icon;
    const isActive = item.path !== undefined && item.path === activePath;
    const count = item.badge ? badges[item.badge] : 0;

    const content = (
      <>
        {isActive && (
          <span
            aria-hidden
            style={{ background: railColor }}
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
          />
        )}
        <Icon
          className={`w-[15px] h-[15px] shrink-0 transition-colors ${
            isActive ? 'text-white' : 'text-white/45 group-hover:text-white/85'
          }`}
          strokeWidth={isActive ? 2.1 : 1.9}
        />
        {!collapsed && <span className="truncate flex-1">{item.name}</span>}
        {!collapsed && item.href && (
          <ArrowUpRight className="w-3 h-3 shrink-0 text-white/35 group-hover:text-white/70" />
        )}
        {!collapsed && item.badge && count > 0 && (
          <span
            className={`font-mono text-[9.5px] font-semibold leading-none px-1.5 py-[3px] rounded-badge text-white shrink-0 ${BADGE_COLOR[item.badge]}`}
          >
            {count}
          </span>
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
      style={{
        backgroundImage:
          'linear-gradient(168deg, #0A2547 0%, #072F58 55%, #04305A 100%)'
      }}
      className={`text-slate-300 transition-[width] duration-200 ease-out-refined flex flex-col select-none relative z-30 shrink-0 ${
        collapsed ? 'w-[68px]' : 'w-[252px]'
      }`}
    >
      {/* Hairline separating the rail from the workspace */}
      <div className="absolute inset-y-0 right-0 w-px bg-white/10" />

      {/* Brand lockup */}
      <div
        className={`h-16 flex items-center border-b border-white/[0.08] shrink-0 ${
          collapsed ? 'justify-center px-0' : 'justify-between pl-4 pr-3'
        }`}
      >
        <NavLink to={home} className="flex items-center gap-3 overflow-hidden min-w-0">
          <div className="w-9 h-9 rounded-md bg-white flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.35)] ring-1 ring-white/20">
            <img
              src="/kiran-mark.png"
              alt="Kiran Cable Protection"
              className="w-6 h-6 object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-display font-bold text-white text-[17px] tracking-[-0.02em] leading-none truncate">
                Kiran<span className="text-white/55"> {workspace?.label ?? 'Connect'}</span>
              </span>
              <span className="text-[9.5px] text-white/45 tracking-[0.14em] uppercase font-medium mt-1 truncate">
                {workspace?.tagline ?? 'Chat, calendar and activity'}
              </span>
            </div>
          )}
        </NavLink>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-sm text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-3 p-1.5 rounded-sm text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2.5 space-y-5">
        {navGroups.map((group, index) => {
          // The shared group is always last and always teal; a department's
          // own groups carry the department's strand.
          const isShared = index === navGroups.length - 1;
          const railColor = isShared ? TEAL : (workspace?.color ?? TEAL);

          return (
            <div key={group.label} className="space-y-px">
              {!collapsed ? (
                <div className="px-2.5 pb-1.5 text-[9.5px] font-semibold tracking-[0.14em] text-white/35 uppercase">
                  {group.label}
                </div>
              ) : (
                <div className="mx-2 border-t border-white/[0.08] my-2.5" />
              )}
              {group.items.map((item) => renderItem(item, railColor))}
            </div>
          );
        })}
      </nav>

      {/* Footer: the four strands */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-[10px] text-white/35 font-mono tracking-tight">
            Kiran Central Platform
          </span>
          <span className="flex items-center gap-[3px]" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-strand-red" />
            <span className="w-1.5 h-1.5 rounded-full bg-strand-amber" />
            <span className="w-1.5 h-1.5 rounded-full bg-strand-green" />
            <span className="w-1.5 h-1.5 rounded-full bg-strand-teal" />
          </span>
        </div>
      )}
    </aside>
  );
};
