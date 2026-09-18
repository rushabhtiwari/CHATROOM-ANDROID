import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BellRing, CheckCheck, Workflow } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { employeeForName, reviewRoleFor } from '@/modules/rts/identity';
import { formatDateTime } from '@/modules/rts/format';
import type { Notification, Role } from '@/modules/rts/types';

/**
 * One feed for every department.
 *
 * Each entry is something one team did that another team needs to know: a
 * claim filed in a conversation reaches HR, HR's approval reaches Accounts,
 * and a disbursement by Accounts comes back to HR and to the employee. The
 * same feed is on every department's rail, so nobody is told by accident.
 */

const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  PAYMENTS: 'Payments',
  ADMIN: 'Admin',
};

const ROLE_CLASS: Record<Role, string> = {
  EMPLOYEE: 'bg-teal-50 text-teal-800 border-teal-200',
  HR: 'bg-blue-50 text-kiran border-blue-200',
  ACCOUNTS: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PAYMENTS: 'bg-amber-50 text-amber-800 border-amber-200',
  ADMIN: 'bg-slate-100 text-slate-700 border-slate-200',
};

type Filter = 'ALL' | 'MINE' | Role;

/** The order pipeline lives in the PACT console; this is its public summary. */
interface PipelineSummary {
  awaitingAdmin: number;
  awaitingAccounts: number;
  pactDrafts: number;
  completed: number;
  kpac?: { reachable: boolean; detail: string };
}

const PACT_CONSOLE: string = import.meta.env.VITE_PACT_CONSOLE ?? 'http://localhost:5173';

function usePipeline(): PipelineSummary | null | undefined {
  // undefined: still asking. null: the PACT console is not running.
  const [summary, setSummary] = useState<PipelineSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/pact-api/po-pipeline/summary')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => !cancelled && setSummary(data))
        .catch(() => !cancelled && setSummary(null));
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return summary;
}

export const ActivityFeed: React.FC = () => {
  const { notifications, employees, employeeById, markAllNotificationsRead, markNotificationRead } =
    useRts();
  const { currentUser } = useChat();
  const pipeline = usePipeline();
  const [filter, setFilter] = useState<Filter>('ALL');

  const me = employeeForName(employees, currentUser.name);
  const myRole = reviewRoleFor(me);

  const isMine = (notification: Notification) =>
    notification.toRole === 'EMPLOYEE'
      ? notification.toEmployeeId !== undefined && notification.toEmployeeId === me?.id
      : notification.toRole === myRole;

  const visible = useMemo(
    () =>
      notifications.filter((notification) =>
        filter === 'ALL' ? true : filter === 'MINE' ? isMine(notification) : notification.toRole === filter,
      ),
    // isMine closes over me and myRole, which are derived from the two below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifications, filter, me?.id, myRole],
  );

  const unread = notifications.filter((notification) => !notification.read).length;
  const mineCount = notifications.filter(isMine).length;

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'ALL', label: 'All departments', count: notifications.length },
    { key: 'MINE', label: `For ${currentUser.name.split(' ')[0]}`, count: mineCount },
    { key: 'HR', label: 'HR' },
    { key: 'ACCOUNTS', label: 'Accounts' },
    { key: 'PAYMENTS', label: 'Payments' },
    { key: 'EMPLOYEE', label: 'Employees' },
  ];

  const recipient = (notification: Notification) =>
    notification.toRole === 'EMPLOYEE' && notification.toEmployeeId
      ? (employeeById(notification.toEmployeeId)?.name ?? 'Employee')
      : ROLE_LABEL[notification.toRole];

  return (
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title="Activity"
        description="What each department has done that another department needs to know. Claims move from the conversation to HR, to Accounts, to the bank, and every hand-off lands here."
        actions={
          <button
            onClick={markAllNotificationsRead}
            disabled={unread === 0}
            className="px-3 py-1.5 bg-surface border border-line hover:border-kiran rounded text-xs font-semibold text-ink flex items-center gap-1.5 disabled:opacity-50 disabled:hover:border-line"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        }
      />

      {/* Order pipeline, read from the PACT console */}
      <a
        href={`${PACT_CONSOLE}/admin/automation/orders`}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-surface border border-line hover:border-kiran rounded-lg p-4 shadow-card transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Workflow className="w-4 h-4 text-kiran shrink-0" />
            <h3 className="font-display font-semibold text-sm text-ink">Order pipeline</h3>
            <span className="text-xs text-muted truncate">
              Customer POs from the monitored inbox, on their way into PACT
            </span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted shrink-0" />
        </div>

        {pipeline === undefined ? (
          <p className="text-xs text-muted mt-3">Checking the PACT console…</p>
        ) : pipeline === null ? (
          <p className="text-xs text-strand-amber mt-3">
            The PACT console is not running, so order figures are unavailable.
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-3 font-mono">
            {[
              { label: 'Awaiting approval', value: pipeline.awaitingAdmin },
              { label: 'With Accounts', value: pipeline.awaitingAccounts },
              { label: 'PACT drafts', value: pipeline.pactDrafts },
              { label: 'Completed', value: pipeline.completed },
            ].map((figure) => (
              <div key={figure.label} className="bg-canvas border border-line rounded-md px-3 py-2">
                <div className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted">
                  {figure.label}
                </div>
                <div className="text-xl font-display font-bold text-ink">{figure.value}</div>
              </div>
            ))}
            <div className="bg-canvas border border-line rounded-md px-3 py-2 col-span-2 lg:col-span-1">
              <div className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted">
                PACT robot
              </div>
              <div
                className={`text-xs font-sans font-semibold mt-1 ${
                  pipeline.kpac?.reachable ? 'text-strand-green' : 'text-strand-red'
                }`}
                title={pipeline.kpac?.detail}
              >
                {pipeline.kpac?.reachable ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        )}
      </a>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setFilter(entry.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              filter === entry.key
                ? 'bg-kiran text-white border-kiran'
                : 'bg-surface text-slate-700 border-line hover:border-kiran/40'
            }`}
          >
            {entry.label}
            {entry.count !== undefined && (
              <span className="font-mono text-[10px] ml-1.5 opacity-75">{entry.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="bg-surface border border-line rounded-lg shadow-card divide-y divide-line">
        {visible.length === 0 ? (
          <div className="p-10 text-center">
            <BellRing className="w-6 h-6 text-muted mx-auto" />
            <p className="text-sm font-semibold text-ink mt-2">Nothing here yet</p>
            <p className="text-xs text-muted mt-1">
              File a claim from a conversation, or approve one, and it will appear for the next team.
            </p>
          </div>
        ) : (
          visible.map((notification) => (
            <div
              key={notification.id}
              onClick={() => !notification.read && markNotificationRead(notification.id)}
              className={`p-4 flex items-start gap-3 ${notification.read ? '' : 'bg-kiran-tint/40 cursor-pointer'}`}
            >
              <span
                aria-hidden
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                  notification.read ? 'bg-transparent' : 'bg-strand-red'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${ROLE_CLASS[notification.toRole]}`}
                  >
                    To {recipient(notification)}
                  </span>
                  <span className="text-[13px] font-semibold text-ink">{notification.title}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notification.body}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted font-mono">
                  <span>{formatDateTime(notification.at)}</span>
                  {notification.requestId && (
                    <Link
                      to={`/reimbursements/${notification.requestId}`}
                      onClick={(event) => event.stopPropagation()}
                      className="text-kiran hover:underline font-semibold"
                    >
                      {notification.requestId}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
