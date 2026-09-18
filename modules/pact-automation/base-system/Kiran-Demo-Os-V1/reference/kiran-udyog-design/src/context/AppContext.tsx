// The in-memory stores every screen reads from. There is no network layer and no
// persistence: every mutation lives in React state for the lifetime of the tab.
//
// There is no "view as" role switching. Each team has its own section in the
// navigation, and every section is always reachable.

import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  Banknote,
  Calculator,
  ClipboardCheck,
  Landmark,
  LayoutDashboard,
  ReceiptText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  Category,
  Employee,
  Notification,
  Payout,
  ReceiptRequest,
  RequestStatus,
  Role,
  Stage,
  TimelineEvent,
} from '@/lib/types';
import { api } from '@/lib/api';

const CURRENT_EMPLOYEE_ID = 'EMP001';

const STATUS_STAGE: Record<RequestStatus, Stage> = {
  DRAFT: 'HR',
  SUBMITTED: 'HR',
  HR_INFO_REQUESTED: 'HR',
  HR_REJECTED: 'HR',
  HR_APPROVED: 'ACCOUNTS',
  ACC_INFO_REQUESTED: 'ACCOUNTS',
  ACC_REJECTED: 'ACCOUNTS',
  ACC_APPROVED: 'PAYMENT',
  PAYMENT_QUEUED: 'PAYMENT',
  PAID: 'DONE',
  CREDITED: 'DONE',
};

const STATUS_ACTION: Record<RequestStatus, string> = {
  DRAFT: 'Saved as draft',
  SUBMITTED: 'Submitted for approval',
  HR_INFO_REQUESTED: 'More information requested by HR',
  HR_REJECTED: 'Rejected by HR',
  HR_APPROVED: 'Approved by HR',
  ACC_INFO_REQUESTED: 'More information requested by Accounts',
  ACC_REJECTED: 'Rejected by Accounts',
  ACC_APPROVED: 'Approved by Accounts',
  PAYMENT_QUEUED: 'Queued for payment',
  PAID: 'Payment disbursed',
  CREDITED: 'Credited to allowance',
};

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rendered indented beneath the parent — e.g. Accounts owns Disbursement + Ledger. */
  children?: NavItem[];
}

export interface NavSection {
  /** Undefined for the ungrouped lead item. */
  label?: string;
  items: NavItem[];
}

/**
 * The navigation, grouped so each team owns a labelled section of the rail.
 * HR and Accounts are deliberately separate sections: they are different jobs
 * (business need vs financial feasibility) run by different teams.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ to: '/overview', label: 'Admin Overview', icon: LayoutDashboard }],
  },
  {
    // The approval chain leads the rail — it is the work the system exists to do.
    // Disbursement and the ledger nest under Accounts because they are the tail of
    // the Accounts review, not a separate department.
    label: 'Approvals',
    items: [
      { to: '/hr', label: 'HR Portal', icon: ClipboardCheck },
      {
        to: '/accounts',
        label: 'Accounts Portal',
        icon: Calculator,
        children: [
          { to: '/pay', label: 'Disbursement', icon: Banknote },
          { to: '/payments', label: 'Payout Ledger', icon: Landmark },
        ],
      },
    ],
  },
  {
    // Personal surface sits last: it is scoped to whoever is signed in.
    label: 'My workspace',
    items: [{ to: '/my-requests', label: 'Requests', icon: ReceiptText }],
  },
];

export type AppContextValue = {
  /** The signed-in persona used by the Employee Portal. Never undefined. */
  currentEmployee: Employee;
  employees: Employee[];
  requests: ReceiptRequest[];
  setRequests: Dispatch<SetStateAction<ReceiptRequest[]>>;
  payouts: Payout[];
  setPayouts: Dispatch<SetStateAction<Payout[]>>;
  notifications: Notification[];
  setNotifications: Dispatch<SetStateAction<Notification[]>>;
  updateRequestStatus: (
    id: string,
    status: RequestStatus,
    actor: string,
    actorRole: Role,
    comment?: string,
  ) => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  /** Restores a paid claim to the employee's monthly allowance. */
  creditEmployeeAllowance: (employeeId: string, amount: number) => void;
  /** Raises a notification. Used when a payout settles. */
  pushNotification: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void;
  /** Restores every store to the seed data so the demo can be re-run. */
  resetDemoData: () => void;
  /** Marks an employee's bank record as verified. */
  verifyBankAccount: (employeeId: string) => void;
  /** Files a new claim and returns its generated id. */
  createRequest: (input: NewRequestInput) => string;
  employeeById: (id: string) => Employee | undefined;
  unreadCount: number;
};

export interface NewRequestInput {
  employeeId: string;
  title: string;
  category: Category;
  amount: number;
  justification: string;
  travelDates?: { from: string; to: string };
  files: { fileName: string; sizeKb: number }[];
  /** DRAFT when saved, SUBMITTED when filed. */
  status: 'DRAFT' | 'SUBMITTED';
  actor: string;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Monotonic counters so runtime-created records can never collide on key. */
let requestSeq = 0;

/** Monotonic counter so runtime-raised notifications can never collide on key. */
let notificationSeq = 0;

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<ReceiptRequest[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [emp, req, pay, notif] = await Promise.all([
          api.getEmployees(),
          api.getRequests(),
          api.getPayouts(),
          api.getNotifications(),
        ]);
        if (mounted) {
          setEmployees(emp);
          setRequests(req);
          setPayouts(pay);
          setNotifications(notif);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to load initial data:', e);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  const currentEmployee = useMemo<Employee>(
    () => employees.find((e) => e.id === CURRENT_EMPLOYEE_ID) ?? employees[0],
    [employees],
  );

  if (loading || !currentEmployee) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const employeeById = useCallback(
    (id: string): Employee | undefined => employees.find((e) => e.id === id),
    [employees],
  );

  const updateRequestStatus = useCallback(
    (id: string, status: RequestStatus, actor: string, actorRole: Role, comment?: string) => {
      setRequests((prev) =>
        prev.map((request) => {
          if (request.id !== id) return request;
          const event: TimelineEvent = {
            id: `EVT-${request.id}-${request.timeline.length}`,
            actor,
            role: actorRole,
            action: STATUS_ACTION[status],
            comment,
            at: new Date().toISOString(),
          };
          return {
            ...request,
            status,
            currentStage: STATUS_STAGE[status],
            timeline: [...request.timeline, event],
          };
        }),
      );
    },
    [],
  );

  /**
   * A settled payout returns the claimed amount to the employee's balance: the
   * claim leaves `pendingAmount`, so `remaining` rises by exactly the amount paid.
   */
  const creditEmployeeAllowance = useCallback((employeeId: string, amount: number) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employeeId
          ? { ...e, pendingAmount: Math.max(0, e.pendingAmount - amount) }
          : e,
      ),
    );
  }, []);

  const pushNotification = useCallback((n: Omit<Notification, 'id' | 'at' | 'read'>) => {
    setNotifications((prev) => [
      {
        ...n,
        id: `NTF-RUN-${(notificationSeq += 1)}`,
        at: new Date().toISOString(),
        read: false,
      },
      ...prev,
    ]);
  }, []);

  /** Puts the payee queue, balances, payouts and notifications back to seed. */
  const resetDemoData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getEmployees(),
      api.getRequests(),
      api.getPayouts(),
      api.getNotifications(),
    ]).then(([emp, req, pay, notif]) => {
      setEmployees(emp);
      setRequests(req);
      setPayouts(pay);
      setNotifications(notif);
      setLoading(false);
    }).catch(e => {
      console.error('Failed to reset data:', e);
      setLoading(false);
    });
  }, []);

  const verifyBankAccount = useCallback((employeeId: string) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employeeId ? { ...e, bankAccount: { ...e.bankAccount, verified: true } } : e,
      ),
    );
  }, []);

  const createRequest = useCallback((input: NewRequestInput): string => {
    requestSeq += 1;
    const id = `REQ-2026-9${String(requestSeq).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const request: ReceiptRequest = {
      id,
      employeeId: input.employeeId,
      title: input.title,
      category: input.category,
      amount: input.amount,
      currency: 'INR',
      submittedOn: now,
      travelDates: input.travelDates,
      justification: input.justification,
      receipts: input.files.map((f, i) => ({
        id: `RCP-${id}-${i + 1}`,
        fileName: f.fileName,
        sizeKb: f.sizeKb,
        uploadedOn: now,
      })),
      status: input.status,
      currentStage: STATUS_STAGE[input.status],
      timeline:
        input.status === 'SUBMITTED'
          ? [
              {
                id: `EVT-${id}-0`,
                actor: input.actor,
                role: 'EMPLOYEE',
                action: STATUS_ACTION.SUBMITTED,
                comment: input.justification.slice(0, 90),
                at: now,
              },
            ]
          : [],
      // Three working days to clear HR, matching the seeded claims.
      slaDueOn:
        input.status === 'SUBMITTED'
          ? new Date(Date.now() + 3 * 86400000).toISOString()
          : undefined,
    };

    setRequests((prev) => [request, ...prev]);
    return id;
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<AppContextValue>(
    () => ({
      currentEmployee,
      employees,
      requests,
      setRequests,
      payouts,
      setPayouts,
      notifications,
      setNotifications,
      updateRequestStatus,
      markAllNotificationsRead,
      markNotificationRead,
      creditEmployeeAllowance,
      pushNotification,
      resetDemoData,
      verifyBankAccount,
      createRequest,
      employeeById,
      unreadCount,
    }),
    [
      currentEmployee,
      employees,
      requests,
      payouts,
      notifications,
      updateRequestStatus,
      markAllNotificationsRead,
      markNotificationRead,
      creditEmployeeAllowance,
      pushNotification,
      resetDemoData,
      verifyBankAccount,
      createRequest,
      employeeById,
      unreadCount,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error('useApp() must be used inside an <AppProvider>. Wrap your tree in App.tsx.');
  }
  return value;
}
