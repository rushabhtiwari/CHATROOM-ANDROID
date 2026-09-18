import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { actionOwner } from '@/modules/rts/status';
import { useProjects } from '@/modules/projects/store';
import { subscribeToMailing } from '@/modules/mailing/useMailing';
import { allProjects, projectRollup } from '@/modules/projects/selectors';
import {
  LayoutDashboard,
  Mail,
  FileText,
  FileCheck2,
  PackageCheck,
  ShoppingCart,
  Truck,
  ShoppingBag,
  CreditCard,
  Briefcase,
  Wallet,
  BarChart3,
  MessagesSquare,
  MessageSquareText,
  CalendarDays,
  ReceiptText,
  ClipboardCheck,
  Banknote,
  Sparkles,
  Bot,
  Workflow,
  Sliders,
  Network,
  Users2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Inbox
} from 'lucide-react';

/** Where the shared chat lives: the department workspace console. */
const WORKSPACE_CONSOLE: string = import.meta.env.VITE_WORKSPACE_CONSOLE ?? 'http://localhost:5174';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeColor?: string;
  /**
   * Sub-pages revealed when the row is expanded.
   *
   * A section with children behaves like a section rather than a link: the row
   * carries a chevron that opens its sub-sections in place, and the rail
   * highlights the parent for anything inside its subtree. Projects, the
   * Mailing Hub and the HR Portal all use this.
   */
  children?: { name: string; path: string; badge?: number | string }[];
  /**
   * Where the parent row itself navigates. Defaults to the first child, which
   * is right for a project (its Issues board); a section with a real landing
   * route names it here instead.
   */
  landing?: string;
}

interface NavGroup {
  label: string;
  groupColor: string; // Strand color for the active rail
  items: NavItem[];
}

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const STRAND_GRADIENT =
  'linear-gradient(to bottom, #B5070E, #E9991B, #018F3D, #00AEEF)';

/**
 * The rail's own accent, when a group has no strand of its own.
 *
 * Command Center is the one entry whose group is the whole four-strand mark,
 * and a gradient cannot tint a 15px glyph — so it lights in the console accent
 * instead.
 */
const RAIL_ACCENT = '#E99741';

/**
 * The colour a group lights its active row in, and the glow that goes with it.
 *
 * The strand is already the group's identity — it is the 3px spine on the left
 * of an active row. Carrying it into the icon as well means the section you are
 * in is legible from the glyph alone, which is what the badge colours have
 * always implied but never delivered.
 */
const groupInk = (groupColor: string) =>
  groupColor === 'gradient' ? RAIL_ACCENT : groupColor;

const groupGlow = (groupColor: string) =>
  `drop-shadow(0 0 5px ${groupInk(groupColor)}) drop-shadow(0 0 12px ${groupInk(groupColor)}55)`;

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onMobileClose }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('kiran_sidebar_collapsed') === 'true';
  });

  const location = useLocation();

  /*
   * Badges are counts, not decoration. A rail that says "6" when there are
   * three is worse than a rail that says nothing, so these read from the same
   * stores the screens do and disappear when they reach zero.
   */
  const { visibleRooms, unreadFor } = useChat();
  const { requests } = useRts();
  const { state: projectState } = useProjects();

  const totalUnread = visibleRooms.reduce(
    (total, room) => total + unreadFor(room.id).total,
    0,
  );

  const withHr = requests.filter((request) => actionOwner(request.status) === 'HR').length;
  const awaitingReview = requests.filter((request) => {
    const owner = actionOwner(request.status);
    return owner === 'HR' || owner === 'ACCOUNTS';
  }).length;
  const awaitingPayment = requests.filter(
    (request) => actionOwner(request.status) === 'PAYMENTS',
  ).length;

  useEffect(() => {
    localStorage.setItem('kiran_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  /*
   * The Mailing Hub's on-hold count. Fetched once and then kept current from
   * the `mailing` SSE frame, so triaging an item in one tab updates the rail in
   * every other one without a poll.
   */
  const [mailingOnHold, setMailingOnHold] = useState(0);

  /**
   * How many orders are waiting on a customer to answer.
   *
   * Read from the automation summary and refreshed on the same `mailing` SSE frame
   * the on-hold count uses, because every mutation that changes one can change the
   * other - a customer approving an order clears this and moves the job at once.
   */
  const [awaitingCustomer, setAwaitingCustomer] = useState(0);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/mailing/summary')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (live && data) setMailingOnHold(data.onHoldCount ?? 0);
      })
      .catch(() => {
        /* the rail simply shows no badge if the service is down */
      });

    // Shares the hub's single EventSource rather than opening a fifth one.
    const readAutomation = () =>
      fetch('/api/po-pipeline/summary')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data) setAwaitingCustomer(data.awaitingCustomer ?? 0);
        })
        .catch(() => {});
    void readAutomation();

    const unsubscribe = subscribeToMailing((summary) => {
      setMailingOnHold(summary.onHoldCount);
      void readAutomation();
    });

    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  // Which project rows are open. The project the URL is inside opens itself, so
  // deep-linking into a cycle does not land you on a rail that shows no context.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  /*
   * One rail entry per project, each opening to its four sub-pages.
   *
   * The badge is the project's overdue count, read from the same selector the
   * project grid uses — a rail that says "3" when there are none is worse than
   * a rail that says nothing, so it disappears at zero.
   */
  const projectItems: NavItem[] = allProjects(projectState).map((project) => {
    const overdue = projectRollup(projectState, project.id).overdue;
    return {
      name: project.name,
      path: `/projects/${project.id}`,
      icon: Briefcase,
      ...(overdue ? { badge: overdue, badgeColor: 'bg-strand-red' } : {}),
      children: [
        { name: 'Issues', path: `/projects/${project.id}/items` },
        { name: 'Cycles', path: `/projects/${project.id}/cycles` },
        { name: 'Modules', path: `/projects/${project.id}/modules` },
        { name: 'Reports', path: `/projects/${project.id}/reports` },
        { name: 'Settings', path: `/projects/${project.id}/settings` },
      ],
    };
  });

  /*
   * Kiran PACT Automation System: the rail carries only the two working halves of
   * the pipeline - the mailbox being watched, and the orders on their way into PACT.
   */
  const navGroups: NavGroup[] = [
    {
      label: 'Mail Monitoring',
      groupColor: '#B5070E',
      items: [
        {
          name: 'Mailing',
          path: '/admin/mailing',
          landing: '/admin/mailing/inbox',
          icon: Inbox,
          ...(mailingOnHold ? { badge: mailingOnHold, badgeColor: 'bg-strand-amber' } : {}),
          children: [
            { name: 'Emails', path: '/admin/mailing/inbox' },
            {
              name: 'On Hold',
              path: '/admin/mailing/on-hold',
              ...(mailingOnHold ? { badge: mailingOnHold } : {}),
            },
            { name: 'Analytics', path: '/admin/mailing/analytics' },
          ],
        },
      ]
    },
    {
      label: 'PACT Entry',
      groupColor: '#E9991B',
      items: [
        {
          name: 'Order Automation',
          path: '/admin/automation',
          landing: '/admin/automation/orders',
          icon: Workflow,
          ...(awaitingCustomer ? { badge: awaitingCustomer, badgeColor: 'bg-strand-amber' } : {}),
          children: [
            {
              name: 'Orders',
              path: '/admin/automation/orders',
              ...(awaitingCustomer ? { badge: awaitingCustomer } : {}),
            },
            { name: 'KPAC & PACT', path: '/admin/automation/kpac' },
            { name: 'Rules', path: '/admin/automation/rules' },
          ],
        },
        { name: 'PACT Automation', path: '/pact', icon: Bot },
      ]
    }
  ];

  // The rail highlights exactly one row: the deepest entry whose path the
  // current URL sits under. A plain prefix test would light up a parent and
  // its child at the same time.
  const covers = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  /**
   * Whether the URL is anywhere inside a section — its own path, or any of its
   * sub-sections. HR's desks live under /reimbursements rather than /hr, so a
   * prefix test alone would leave the rail showing nothing selected.
   */
  const ownsRoute = (item: NavItem) =>
    covers(item.path) || (item.children ?? []).some((child) => covers(child.path));

  const activePath = navGroups
    .flatMap((group) => group.items)
    .filter(ownsRoute)
    .map((item) => item.path)
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside
      style={{
        backgroundImage:
          'linear-gradient(168deg, #0A2547 0%, #072F58 55%, #04305A 100%)'
      }}
      className={`text-slate-300 transition-[width] duration-200 ease-out-refined flex flex-col select-none relative z-30 shrink-0 border-r border-outline-variant ${
        collapsed ? 'w-[68px]' : 'w-[264px]'
      } ${mobileOpen ? 'fixed inset-y-0 left-0 flex shadow-modal' : 'hidden md:flex'} md:relative md:inset-auto md:shadow-none`}
    >
      {/* Hairline separating the rail from the workspace */}
      <div className="absolute inset-y-0 right-0 w-px bg-white/10" />

      {/* Brand lockup */}
      <div
        className={`h-16 flex items-center border-b border-white/[0.08] shrink-0 ${
          collapsed ? 'justify-center px-0' : 'justify-between pl-4 pr-3'
        }`}
      >
        <NavLink to="/" className="flex items-center gap-3 overflow-hidden min-w-0">
          <div className="w-9 h-9 rounded-none bg-white flex items-center justify-center shrink-0 shadow-none ring-1 ring-white/20">
            <img
              src="/kiran-mark.png"
              alt="Kiran Cable Protection"
              className="w-6 h-6 object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              {/*
                The wordmark is the one place the width axis is pushed to its
                limit (LEDGERDESIGNSYSTEM.md §3.1): same face as everything
                else, set expanded, so it reads as signage rather than as a
                second typeface. The negative tracking the old lockup carried
                fought that width — at this size the letters want air, not
                compression.
              */}
              <span className="ku-xwide font-display text-[18px] font-bold uppercase leading-none tracking-[0.02em] text-white">
                Kiran<span className="text-white/55"> PACT</span>
              </span>
              {/* The standfirst is a stamped label, like every group heading
                  below it — mono, uppercase, widely tracked. */}
              <span className="mt-1.5 truncate font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-white/45">
                Automation System
              </span>
            </div>
          )}
        </NavLink>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="p-1.5 rounded-none text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="mx-auto mt-3 p-1.5 rounded-none text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Navigation */}
      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2.5 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-px">
            {!collapsed ? (
              <div className="px-2.5 pb-1.5 font-mono tracking-widest text-[9px] uppercase text-white/40">
                {group.label}
              </div>
            ) : (
              <div className="mx-2 border-t border-white/[0.08] my-2.5" />
            )}

            {group.items.map((item) => {
              const isActive = item.path === activePath;
              const Icon = item.icon;

              // A project row with sub-pages: the row still navigates, but it
              // also carries a chevron that opens its children in place.
              const hasChildren = !collapsed && (item.children?.length ?? 0) > 0;
              // The URL is somewhere inside this section — its own subtree, or
              // one of its sub-sections. Drives both the highlight and whether
              // the section opens itself.
              const inThisSubtree = ownsRoute(item);
              const isOpen = hasChildren && (expanded.has(item.path) || inThisSubtree);

              if (hasChildren) {
                return (
                  <div key={item.path}>
                    <div
                      className={`group relative flex items-center gap-1 rounded-none pr-1 text-[12.5px] font-medium transition-colors duration-150 ${
                        isActive || inThisSubtree
                          ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]'
                          : 'text-white/65 hover:bg-white/[0.055] hover:text-white'
                      }`}
                    >
                      {(isActive || inThisSubtree) && (
                        <span
                          aria-hidden
                          style={{
                            background:
                              group.groupColor === 'gradient'
                                ? STRAND_GRADIENT
                                : group.groupColor
                          }}
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.path)}
                        aria-label={isOpen ? `Collapse ${item.name}` : `Expand ${item.name}`}
                        aria-expanded={isOpen}
                        className="ml-1.5 rounded-none p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <ChevronRight
                          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                      </button>

                        <NavLink
                        to={item.landing ?? item.children?.[0]?.path ?? item.path}
                          onClick={onMobileClose}
                        title={item.name}
                        className="flex min-w-0 flex-1 items-center gap-2 py-[7px]"
                      >
                        <Icon
                          className={`h-[15px] w-[15px] shrink-0 transition-colors ${
                            isActive || inThisSubtree ? '' : 'text-white/45'
                          }`}
                          style={
                            isActive || inThisSubtree
                              ? { color: groupInk(group.groupColor), filter: groupGlow(group.groupColor) }
                              : undefined
                          }
                          strokeWidth={isActive || inThisSubtree ? 2.1 : 1.9}
                        />
                        <span className="truncate">{item.name}</span>
                      </NavLink>

                      {item.badge !== undefined && (
                        <span
                          className={`shrink-0 rounded-badge px-1.5 py-[3px] font-mono text-[9.5px] font-semibold leading-none text-white ${
                            item.badgeColor || 'bg-white/15'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {isOpen && (
                      <div className="ml-[22px] mt-px space-y-px border-l border-white/[0.10] pl-2">
                        {item.children!.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            end
                            onClick={onMobileClose}
                            className={({ isActive: childActive }) =>
                              `flex items-center gap-2 rounded-none px-2 py-[5px] text-[12px] transition-colors ${
                                childActive
                                  ? 'bg-white/[0.10] font-medium text-white'
                                  : 'text-white/55 hover:bg-white/[0.05] hover:text-white/90'
                              }`
                            }
                          >
                            <span className="truncate flex-1">{child.name}</span>
                            {child.badge !== undefined && (
                              <span className="shrink-0 bg-white/15 px-1.5 py-[2px] font-mono text-[9.5px] font-semibold leading-none text-white">
                                {child.badge}
                              </span>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onMobileClose}
                  title={collapsed ? item.name : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-none text-[12.5px] font-medium transition-colors duration-150 ${
                    collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-[7px]'
                  } ${
                    isActive
                      ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]'
                      : 'text-white/65 hover:bg-white/[0.055] hover:text-white'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      style={{
                        background:
                          group.groupColor === 'gradient'
                            ? STRAND_GRADIENT
                            : group.groupColor
                      }}
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                    />
                  )}

                  {/* The glyph lights in its own section's strand and glows:
                      Dispatch's truck goes Revenue red, Purchase's bag goes
                      Operations amber. Colour is not the only carrier — the
                      3px spine and the filled row still mark the position. */}
                  <Icon
                    className={`w-[15px] h-[15px] shrink-0 transition-colors ${
                      isActive ? '' : 'text-white/45 group-hover:text-white/85'
                    }`}
                    style={
                      isActive
                        ? { color: groupInk(group.groupColor), filter: groupGlow(group.groupColor) }
                        : undefined
                    }
                    strokeWidth={isActive ? 2.1 : 1.9}
                  />

                  {!collapsed && <span className="truncate flex-1">{item.name}</span>}

                  {!collapsed && item.badge !== undefined && (
                    <span
                      className={`font-mono text-[9.5px] font-semibold leading-none px-1.5 py-[3px] rounded-badge text-white shrink-0 ${
                        item.badgeColor || 'bg-white/15'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/*
        The chat is shared by every department and runs in the workspace
        console, so it is a link out rather than a route of this one.
      */}
      <a
        href={`${WORKSPACE_CONSOLE}/chat`}
        target="_blank"
        rel="noopener noreferrer"
        title="Team Chat (opens the department workspace)"
        className={`mx-2.5 mb-3 flex items-center gap-2.5 rounded-md text-[12.5px] font-medium text-white/65 hover:bg-white/[0.055] hover:text-white transition-colors duration-150 ${
          collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-[7px]'
        }`}
      >
        <MessageSquareText className="w-[15px] h-[15px] shrink-0 text-white/45" strokeWidth={1.9} />
        {!collapsed && <span className="truncate flex-1">Team Chat</span>}
      </a>

      {/* Footer — build stamp + the four strands */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-[10px] text-white/35 font-mono tracking-tight">
            v2.4 · Enterprise
          </span>
          <span className="flex items-center gap-[3px]" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-strand-red" />
            <span className="w-1.5 h-1.5 rounded-full bg-strand-amber" />
            <span className="w-1.5 h-1.5 rounded-full bg-st-green-ink" />
            <span className="w-1.5 h-1.5 rounded-full bg-strand-teal" />
          </span>
        </div>
      )}
    </aside>
  );
};
