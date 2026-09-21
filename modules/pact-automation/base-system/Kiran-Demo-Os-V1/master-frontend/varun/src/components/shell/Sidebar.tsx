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
      label: 'Intake',
      groupColor: '#B5070E',
      items: [
        {
          name: 'Mail',
          path: '/admin/mailing',
          landing: '/admin/mailing/inbox',
          icon: Inbox,
          ...(mailingOnHold ? { badge: mailingOnHold, badgeColor: 'bg-strand-amber' } : {}),
          children: [
            { name: 'Emails', path: '/admin/mailing/inbox' },
            {
              name: 'On hold',
              path: '/admin/mailing/on-hold',
              ...(mailingOnHold ? { badge: mailingOnHold } : {}),
            },
            { name: 'Analytics', path: '/admin/mailing/analytics' },
          ],
        },
      ]
    },
    {
      label: 'PACT',
      groupColor: '#E9991B',
      items: [
        {
          name: 'Order automation',
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
        { name: 'PACT automation', path: '/pact', icon: Bot },
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

  const ROW =
    'group relative flex h-9 items-center rounded-md text-[14px] font-medium transition-colors duration-150';
  const ROW_ACTIVE = 'bg-[#DCE6F4] text-[#0B4F9C]';
  const ROW_IDLE = 'text-ink-soft hover:bg-black/5';
  const BADGE =
    'tnum shrink-0 rounded-full bg-[#D93A2F] px-1.5 py-[3px] text-[12px] font-semibold leading-none text-white';

  return (
    <aside
      className={`flex shrink-0 select-none flex-col border-r border-[#E1E1E6] bg-sidebar text-ink-soft transition-[width] duration-200 ease-out-refined relative z-30 ${
        collapsed ? 'w-[68px]' : 'w-[248px]'
      } ${mobileOpen ? 'fixed inset-y-0 left-0 flex shadow-modal' : 'hidden md:flex'} md:relative md:inset-auto md:shadow-none`}
    >
      {/* Brand */}
      <div
        className={`flex h-14 shrink-0 items-center ${
          collapsed ? 'justify-center px-0' : 'justify-between pl-4 pr-2'
        }`}
      >
        <NavLink to="/" className="flex min-w-0 items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy">
            <img
              src="/kiran-mark.png"
              alt="Kiran Cable Protection"
              className="h-5 w-5 rounded-[3px] bg-white object-contain p-px"
            />
          </div>
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold text-ink">Kiran PACT</span>
          )}
        </NavLink>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-black/5 hover:text-ink"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-black/5 hover:text-ink"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* Navigation */}
      <nav
        aria-label="Primary navigation"
        className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-3"
      >
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {!collapsed ? (
              <div className="px-2.5 pb-1 text-[12px] font-semibold text-faint">{group.label}</div>
            ) : (
              <div className="mx-2 my-2 border-t border-[#E1E1E6]" />
            )}

            {group.items.map((item) => {
              const isActive = item.path === activePath;
              const Icon = item.icon;

              // A section with sub-pages: the row still navigates, but it also
              // carries a chevron that opens its children in place.
              const hasChildren = !collapsed && (item.children?.length ?? 0) > 0;
              const inThisSubtree = ownsRoute(item);
              const isOpen = hasChildren && (expanded.has(item.path) || inThisSubtree);

              if (hasChildren) {
                return (
                  <div key={item.path}>
                    <div className={`${ROW} gap-1 pr-2 ${ROW_IDLE}`}>
                      <NavLink
                        to={item.landing ?? item.children?.[0]?.path ?? item.path}
                        onClick={onMobileClose}
                        title={item.name}
                        className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-2.5"
                      >
                        <Icon className="h-[17px] w-[17px] shrink-0 text-faint" strokeWidth={1.8} />
                        <span className="truncate">{item.name}</span>
                      </NavLink>

                      {item.badge !== undefined && !isOpen && (
                        <span className={BADGE}>{item.badge}</span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.path)}
                        aria-label={isOpen ? `Collapse ${item.name}` : `Expand ${item.name}`}
                        aria-expanded={isOpen}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-faint transition-colors hover:bg-black/5 hover:text-ink"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-0.5 space-y-0.5">
                        {item.children!.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            end
                            onClick={onMobileClose}
                            className={({ isActive: childActive }) =>
                              `${ROW} gap-2 pl-[37px] pr-2.5 ${childActive ? ROW_ACTIVE : ROW_IDLE}`
                            }
                          >
                            <span className="flex-1 truncate">{child.name}</span>
                            {child.badge !== undefined && (
                              <span className={BADGE}>{child.badge}</span>
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
                  className={`${ROW} gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-2.5'} ${
                    isActive ? ROW_ACTIVE : ROW_IDLE
                  }`}
                >
                  <Icon
                    className={`h-[17px] w-[17px] shrink-0 ${isActive ? '' : 'text-faint'}`}
                    strokeWidth={1.8}
                  />
                  {!collapsed && <span className="flex-1 truncate">{item.name}</span>}
                  {!collapsed && item.badge !== undefined && (
                    <span className={BADGE}>{item.badge}</span>
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
      <div className="px-3 pb-3">
        <a
          href={`${WORKSPACE_CONSOLE}/chat`}
          target="_blank"
          rel="noopener noreferrer"
          title="Team Chat (opens the department workspace)"
          className={`${ROW} gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-2.5'} ${ROW_IDLE}`}
        >
          <MessageSquareText className="h-[17px] w-[17px] shrink-0 text-faint" strokeWidth={1.8} />
          {!collapsed && <span className="flex-1 truncate">Team chat</span>}
        </a>
      </div>
    </aside>
  );
};
