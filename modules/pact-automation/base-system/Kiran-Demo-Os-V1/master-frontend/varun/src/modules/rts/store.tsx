// The reimbursement store, backed by the Python API.
//
// State is never mutated locally. Every action posts to the server, the server
// applies the business rules, and the new state arrives over a server-sent
// events stream that all open tabs share. That is why the employee, HR and
// Accounts views move together during a demo without anyone refreshing.
//
// Navigation is not defined here: KiranOS owns the rail, and these screens are
// mounted into it like any other module.
 
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Category,
  Employee,
  Extraction,
  Notification,
  Payout,
  ReceiptRequest,
  RequestStatus,
  Role,
} from './types';
import * as api from './api';
import type { Analytics, AppSnapshot, DisburseResult } from './api';

/** Shown until /api/state resolves, so the first paint has real shapes. */
const EMPTY_ANALYTICS: Analytics = {
  monthlySpend: [],
  departmentUtilisation: [],
  policyCaps: [],
  categorySpend: [],
};

export interface NewRequestInput {
  employeeId: string;
  title: string;
  category: Category;
  amount: number;
  justification: string;
  travelDates?: { from: string; to: string };
  files: { fileName: string; sizeKb: number }[];
  /** Ids returned by the upload step, so the claim keeps the real documents. */
  receiptIds?: string[];
  /** What the agent read, filed alongside what the employee confirmed. */
  extraction?: Extraction | null;
  /** DRAFT when saved, SUBMITTED when filed. */
  status: 'DRAFT' | 'SUBMITTED';
  actor: string;
}

export type AppContextValue = {
  /** The signed-in persona used by the Employee Portal. Never undefined. */
  currentEmployee: Employee;
  employees: Employee[];
  requests: ReceiptRequest[];
  payouts: Payout[];
  notifications: Notification[];
  /** Spend, budget and policy figures, computed server-side from live claims. */
  analytics: Analytics;

  updateRequestStatus: (
    id: string,
    status: RequestStatus,
    actor: string,
    actorRole: Role,
    comment?: string,
  ) => Promise<void>;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  /** Raises a notification. */
  pushNotification: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void;
  /** Restores every store to the seed data so the demo can be re-run. */
  resetDemoData: () => void;
  /** Marks an employee's bank record as verified. */
  verifyBankAccount: (employeeId: string) => void;
  /** Files a new claim and returns its generated id. */
  createRequest: (input: NewRequestInput) => Promise<string>;
  /** Sends selected ledger rows to the bank. */
  queuePayouts: (payoutIds: string[]) => Promise<void>;
  /** Puts a failed payout back in the queue. */
  retryPayout: (payoutId: string) => Promise<void>;
  /** Pays every payable claim for one employee under a single UTR. */
  disburseTo: (employeeId: string, method: Payout['method']) => Promise<DisburseResult>;

  employeeById: (id: string) => Employee | undefined;
  unreadCount: number;
  /** False while the live stream is down, so the UI can say so honestly. */
  connected: boolean;
  loading: boolean;
  /** Surfaces a server refusal to the user. */
  notifyError: (message: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

/** Stand-in used only for the first paint, before /api/state resolves. */
const PLACEHOLDER_EMPLOYEE: Employee = {
  id: '',
  name: '—',
  employeeCode: '',
  department: '',
  designation: '',
  managerName: '',
  email: '',
  monthlyAllowance: 0,
  usedThisMonth: 0,
  pendingAmount: 0,
  bankAccount: {
    bankName: '',
    accountHolder: '',
    accountNumberMasked: '',
    ifsc: '',
    verified: false,
  },
};

export function RtsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<number | null>(null);

  const notifyError = useCallback((message: string) => {
    setError(message);
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 6000);
  }, []);

  /** Wraps an action so a server refusal surfaces instead of failing silently. */
  const guard = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T> => {
      try {
        return await work();
      } catch (e) {
        notifyError(e instanceof Error ? e.message : 'Something went wrong.');
        throw e;
      }
    },
    [notifyError],
  );

  // Load once, then let the stream keep us current. The stream also delivers a
  // snapshot on connect, so a dropped connection self-heals on reconnect.
  useEffect(() => {
    let alive = true;

    api
      .getState()
      .then((state) => {
        if (alive) setSnapshot(state);
      })
      .catch((e) => {
        if (alive) notifyError(e instanceof Error ? e.message : 'Could not load data.');
      });

    const unsubscribe = api.subscribeToState(
      (state) => {
        if (!alive) return;
        // Frames can overlap on reconnect; never move the state backwards.
        setSnapshot((prev) => (prev && prev.version > state.version ? prev : state));
      },
      (isConnected) => {
        if (alive) setConnected(isConnected);
      },
    );

    return () => {
      alive = false;
      unsubscribe();
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, [notifyError]);

  const employees = snapshot?.employees ?? [];
  const requests = snapshot?.requests ?? [];
  const payouts = snapshot?.payouts ?? [];
  const notifications = snapshot?.notifications ?? [];
  const analytics = snapshot?.analytics ?? EMPTY_ANALYTICS;

  const currentEmployee = useMemo<Employee>(
    () =>
      employees.find((e) => e.id === snapshot?.currentEmployeeId) ??
      employees[0] ??
      PLACEHOLDER_EMPLOYEE,
    [employees, snapshot?.currentEmployeeId],
  );

  const employeeById = useCallback(
    (id: string): Employee | undefined => employees.find((e) => e.id === id),
    [employees],
  );

  const updateRequestStatus = useCallback(
    async (
      id: string,
      status: RequestStatus,
      actor: string,
      actorRole: Role,
      comment?: string,
    ) => {
      await guard(() => api.transitionRequest(id, status, actor, actorRole, comment));
    },
    [guard],
  );

  const createRequest = useCallback(
    async (input: NewRequestInput): Promise<string> => {
      const created = await guard(() =>
        api.createRequest({
          employeeId: input.employeeId,
          title: input.title,
          category: input.category,
          amount: input.amount,
          justification: input.justification,
          travelDates: input.travelDates,
          files: input.files,
          receiptIds: input.receiptIds ?? [],
          extraction: input.extraction ?? null,
          status: input.status,
          actor: input.actor,
        }),
      );
      return created.id;
    },
    [guard],
  );

  const pushNotification = useCallback(
    (n: Omit<Notification, 'id' | 'at' | 'read'>) => {
      void guard(() =>
        api.pushNotification({
          toRole: n.toRole,
          toEmployeeId: n.toEmployeeId,
          title: n.title,
          body: n.body,
          requestId: n.requestId,
        }),
      );
    },
    [guard],
  );

  const resetDemoData = useCallback(() => {
    void guard(() => api.resetDemo().then(setSnapshot));
  }, [guard]);

  const verifyBankAccount = useCallback(
    (employeeId: string) => {
      void guard(() => api.verifyBank(employeeId));
    },
    [guard],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      void guard(() => api.markNotificationRead(id));
    },
    [guard],
  );

  const markAllNotificationsRead = useCallback(() => {
    void guard(() => api.markAllNotificationsRead());
  }, [guard]);

  const queuePayouts = useCallback(
    async (payoutIds: string[]) => {
      await guard(() => api.queuePayouts(payoutIds, 'Kavya Reddy'));
    },
    [guard],
  );

  const retryPayout = useCallback(
    async (payoutId: string) => {
      await guard(() => api.retryPayout(payoutId));
    },
    [guard],
  );

  const disburseTo = useCallback(
    (employeeId: string, method: Payout['method']) =>
      guard(() => api.disburse(employeeId, method, 'Kavya Reddy')),
    [guard],
  );

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<AppContextValue>(
    () => ({
      currentEmployee,
      employees,
      requests,
      payouts,
      notifications,
      analytics,
      updateRequestStatus,
      markAllNotificationsRead,
      markNotificationRead,
      pushNotification,
      resetDemoData,
      verifyBankAccount,
      createRequest,
      queuePayouts,
      retryPayout,
      disburseTo,
      employeeById,
      unreadCount,
      connected,
      loading: snapshot === null,
      notifyError,
    }),
    [
      currentEmployee,
      employees,
      requests,
      payouts,
      notifications,
      analytics,
      updateRequestStatus,
      markAllNotificationsRead,
      markNotificationRead,
      pushNotification,
      resetDemoData,
      verifyBankAccount,
      createRequest,
      queuePayouts,
      retryPayout,
      disburseTo,
      employeeById,
      unreadCount,
      connected,
      snapshot,
      notifyError,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {error && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[100] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 border border-st-red-line bg-st-red-bg px-4 py-3 shadow-lg"
        >
          <p className="text-body-s font-semibold text-st-red-ink">{error}</p>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useRts(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error('useRts() must be used inside <RtsProvider>.');
  }
  return value;
}
