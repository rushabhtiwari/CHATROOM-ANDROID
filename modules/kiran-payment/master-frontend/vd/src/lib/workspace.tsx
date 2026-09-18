/**
 * Workspaces: which part of the console a browser tab is for.
 *
 * The Central Platform launcher opens this console once per tile (Sales, HR,
 * Accounts and so on) at `/d/<workspace>`. A workspace decides three things:
 * the tools on the rail, the page the tab lands on, and the person the console
 * is viewed as, so that the HR tab can approve as HR without anyone having to
 * find the identity switcher first.
 *
 * The choice is kept in sessionStorage, which is per tab. Two tiles opened side
 * by side stay what their tile said they were, and a tab opened on `/chat`
 * alone is just the chat. Everything every department shares (the chat, the
 * calendar and the activity feed) is on every rail.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Activity,
  Banknote,
  BarChart3,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Factory,
  FileCheck2,
  FileText,
  Flag,
  Handshake,
  HandCoins,
  Kanban,
  Landmark,
  LayoutDashboard,
  Mail,
  MailSearch,
  MessageSquareText,
  PackageCheck,
  PieChart,
  ReceiptText,
  Scale,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sliders,
  Truck,
  Users2,
  Wallet,
  Workflow,
} from 'lucide-react';

/** The PACT console (mail monitoring and PACT entry) and KCMS run as their own apps. */
const PACT_CONSOLE: string = import.meta.env.VITE_PACT_CONSOLE ?? 'http://localhost:5173';
const KCMS: string = import.meta.env.VITE_KCMS ?? 'http://localhost:3020';

/** Live counts a rail entry can carry. The sidebar resolves them from the stores. */
export type BadgeKey = 'unread' | 'withHr' | 'awaitingReview' | 'awaitingPayment' | 'activity';

export interface WorkspaceNavItem {
  name: string;
  icon: React.ElementType;
  /** A route inside this console, or... */
  path?: string;
  /** ...another application, opened in its own tab. */
  href?: string;
  badge?: BadgeKey;
}

export interface WorkspaceNavGroup {
  label: string;
  items: WorkspaceNavItem[];
}

export interface Workspace {
  key: string;
  label: string;
  /** One line under the brand. */
  tagline: string;
  /** Strand colour of the active rail marker. */
  color: string;
  /** Where `/d/<key>` lands. */
  home: string;
  /** Chat user the console is viewed as on entry. Absent: keep whoever it was. */
  personaId?: string;
  groups: WorkspaceNavGroup[];
}

const RED = '#B5070E';
const AMBER = '#E9991B';
const GREEN = '#018F3D';
const BLUE = '#06477F';

const poMail: WorkspaceNavItem = {
  name: 'PO Mail Monitoring',
  icon: MailSearch,
  href: `${PACT_CONSOLE}/admin/mailing/inbox`,
};
const pactEntry: WorkspaceNavItem = {
  name: 'PACT Entry',
  icon: Workflow,
  href: `${PACT_CONSOLE}/admin/automation/orders`,
};

export const WORKSPACES: Workspace[] = [
  {
    key: 'sales',
    label: 'Sales',
    tagline: 'Orders, quotations and credit',
    color: RED,
    home: '/orders',
    personaId: 'u1',
    groups: [
      {
        label: 'Sales',
        items: [
          { name: 'Sales Orders', path: '/orders', icon: ShoppingCart },
          { name: 'RFQs & Tickets', path: '/rfq', icon: FileText },
          { name: 'Quotations', path: '/quotations', icon: FileCheck2 },
          { name: 'Samples', path: '/samples', icon: PackageCheck },
          { name: 'Receivables & Credit', path: '/accounts/receivables', icon: Scale },
          { name: 'Reports & MIS', path: '/reports', icon: BarChart3 },
        ],
      },
      { label: 'Order automation', items: [poMail, pactEntry] },
    ],
  },
  {
    key: 'dispatch',
    label: 'Dispatch',
    tagline: 'Dispatch plans, POD and GRN',
    color: RED,
    home: '/dispatch',
    personaId: 'u9',
    groups: [
      {
        label: 'Dispatch',
        items: [
          { name: 'Dispatch Board', path: '/dispatch', icon: Truck },
          { name: 'Sales Orders', path: '/orders', icon: ShoppingCart },
          { name: 'GRN Follow-up', path: '/purchase/grn', icon: ClipboardCheck },
        ],
      },
    ],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    tagline: 'Reconciliation, payables, payouts',
    color: GREEN,
    home: '/accounts',
    personaId: 'u10',
    groups: [
      {
        label: 'Accounts',
        items: [
          { name: 'Accounts Overview', path: '/accounts', icon: Wallet },
          { name: 'Bank Reconciliation', path: '/accounts/reconciliation', icon: Landmark },
          { name: 'Payables', path: '/accounts/payables', icon: HandCoins },
        ],
      },
      {
        label: 'Expense claims',
        items: [
          { name: 'Claims', path: '/reimbursements', icon: ReceiptText, badge: 'awaitingReview' },
          { name: 'Disbursement', path: '/reimbursements/pay', icon: Banknote, badge: 'awaitingPayment' },
        ],
      },
      { label: 'Order automation', items: [pactEntry] },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    tagline: 'Receivables, budgets and MIS',
    color: GREEN,
    home: '/accounts/receivables',
    personaId: 'u13',
    groups: [
      {
        label: 'Finance',
        items: [
          { name: 'Receivables', path: '/accounts/receivables', icon: Scale },
          { name: 'Reports & MIS', path: '/reports', icon: BarChart3 },
          { name: 'Budget Allocation', path: '/requisitions/budget', icon: PieChart },
          { name: 'Claims Ledger', path: '/reimbursements', icon: ReceiptText },
        ],
      },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing & RFQ',
    tagline: 'Enquiries, RFQs and quotations',
    color: RED,
    home: '/rfq',
    personaId: 'u11',
    groups: [
      {
        label: 'Marketing & RFQ',
        items: [
          { name: 'Enquiries', path: '/email', icon: Mail },
          { name: 'RFQs & Tickets', path: '/rfq', icon: FileText },
          { name: 'Quotations', path: '/quotations', icon: FileCheck2 },
          { name: 'Samples', path: '/samples', icon: PackageCheck },
        ],
      },
    ],
  },
  {
    key: 'purchase',
    label: 'Purchase',
    tagline: 'Requests, vendors, POs and GRN',
    color: AMBER,
    home: '/purchase',
    personaId: 'u9',
    groups: [
      {
        label: 'Purchase',
        items: [
          { name: 'Purchase Overview', path: '/purchase', icon: ShoppingBag },
          { name: 'Purchase Requests', path: '/purchase/requests', icon: ClipboardList },
          { name: 'Vendor Comparison', path: '/purchase/rfq', icon: Handshake },
          { name: 'Purchase Orders', path: '/purchase/orders', icon: FileCheck2 },
          { name: 'GRN & 3-Way Match', path: '/purchase/grn', icon: ClipboardCheck },
          { name: 'Requisitions', path: '/requisitions', icon: CreditCard },
        ],
      },
      { label: 'Order automation', items: [poMail, pactEntry] },
    ],
  },
  {
    key: 'hr',
    label: 'HR',
    tagline: 'People, leave, attendance, claims',
    color: BLUE,
    home: '/people',
    personaId: 'u7',
    groups: [
      {
        label: 'People',
        items: [
          { name: 'HR Overview', path: '/people', icon: LayoutDashboard },
          { name: 'Employees', path: '/people/employees', icon: Users2 },
          { name: 'Leave', path: '/people/leave', icon: CalendarCheck },
          { name: 'Attendance', path: '/people/attendance', icon: CheckSquare },
        ],
      },
      {
        label: 'Expense claims',
        items: [
          { name: 'Claims Review', path: '/hr', icon: ClipboardCheck, badge: 'withHr' },
          { name: 'Claims Ledger', path: '/reimbursements', icon: ReceiptText },
        ],
      },
    ],
  },
  {
    key: 'production',
    label: 'Production',
    tagline: 'Production planning and tracking',
    color: AMBER,
    home: '/production',
    personaId: 'u12',
    groups: [
      {
        label: 'Production',
        items: [
          { name: 'Production Plan', path: '/production', icon: Factory },
          { name: 'Projects', path: '/projects', icon: Briefcase },
          { name: 'Requisitions', path: '/requisitions', icon: CreditCard },
          { name: 'Project Management', href: KCMS, icon: Kanban },
        ],
      },
    ],
  },
  {
    key: 'quality',
    label: 'Quality',
    tagline: 'Inspections and quality records',
    color: AMBER,
    home: '/quality',
    personaId: 'u5',
    groups: [
      {
        label: 'Quality',
        items: [
          { name: 'Inspections', path: '/quality', icon: ShieldCheck },
          { name: 'Samples', path: '/samples', icon: PackageCheck },
          { name: 'Incoming GRN', path: '/purchase/grn', icon: ClipboardCheck },
        ],
      },
    ],
  },
  {
    key: 'requisitions',
    label: 'Requisitions',
    tagline: 'Requisitions and monthly budgets',
    color: AMBER,
    home: '/requisitions',
    groups: [
      {
        label: 'Requisitions & Budget',
        items: [
          { name: 'Requisitions', path: '/requisitions', icon: CreditCard },
          { name: 'Budget Allocation', path: '/requisitions/budget', icon: PieChart },
        ],
      },
    ],
  },
  {
    key: 'automation',
    label: 'Automation',
    tagline: 'Your to-do list and escalations',
    color: BLUE,
    home: '/approvals',
    groups: [
      {
        label: 'Automation',
        items: [
          { name: 'Approvals', path: '/approvals', icon: CheckSquare },
          { name: 'Escalations', path: '/comms/escalations', icon: Flag },
          { name: 'Commitments', path: '/comms/commitments', icon: ClipboardList },
          { name: 'Automations', path: '/automations', icon: Sliders },
        ],
      },
    ],
  },
];

/** On every rail, in every department: this is what makes it one system. */
export const CONNECT_GROUP: WorkspaceNavGroup = {
  label: 'Connect',
  items: [
    { name: 'Chat', path: '/chat', icon: MessageSquareText, badge: 'unread' },
    { name: 'Calendar', path: '/calendar', icon: CalendarDays },
    { name: 'Activity', path: '/activity', icon: Activity, badge: 'activity' },
  ],
};

/** Where a tab with no workspace lands, and where unknown URLs fall back to. */
export const SHARED_HOME = '/chat';

export const workspaceByKey = (key: string | null | undefined): Workspace | undefined =>
  WORKSPACES.find((workspace) => workspace.key === key);

const STORAGE_KEY = 'kiran_workspace';

const readStored = (): string | null => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage can be blocked; the tab then behaves as chat-only
  }
};

interface WorkspaceContextValue {
  workspace: Workspace | undefined;
  enterWorkspace: (key: string) => void;
  /** Rail groups for this tab: the workspace's own, then the shared ones. */
  navGroups: WorkspaceNavGroup[];
  home: string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [key, setKey] = useState<string | null>(readStored);

  const enterWorkspace = useCallback((next: string) => {
    if (!workspaceByKey(next)) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the tab still works, it just will not survive a reload */
    }
    setKey(next);
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => {
    const workspace = workspaceByKey(key);
    return {
      workspace,
      enterWorkspace,
      navGroups: [...(workspace?.groups ?? []), CONNECT_GROUP],
      home: workspace?.home ?? SHARED_HOME,
    };
  }, [key, enterWorkspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
