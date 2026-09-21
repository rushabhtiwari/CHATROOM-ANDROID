import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BellRing, CheckCheck } from 'lucide-react';
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
    { key: 'ALL', label: 'All', count: notifications.length },
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
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Activity"
        actions={
          <button
            onClick={markAllNotificationsRead}
            disabled={unread === 0}
            className="btn-secondary"
          >
            <CheckCheck className="w-4 h-4 text-slate-500" />
            Mark all read
          </button>
        }
      />

      {/* Order pipeline, read from the PACT console */}
      <a
        href={`${PACT_CONSOLE}/admin/automation/orders`}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-[16px] font-semibold text-ink group-hover:text-kiran transition-colors">
            Orders
          </h3>
          <ArrowUpRight className="w-4 h-4 text-slate-500 shrink-0" />
        </div>

        {pipeline === undefined ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : pipeline === null ? (
          <p className="text-[13px] text-muted">Order figures are unavailable.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'To approve', value: pipeline.awaitingAdmin },
              { label: 'With Accounts', value: pipeline.awaitingAccounts },
              { label: 'Drafts', value: pipeline.pactDrafts },
              { label: 'Completed', value: pipeline.completed },
            ].map((figure) => (
              <div key={figure.label} className="kpi">
                <div className="kpi-label">{figure.label}</div>
                <div className="kpi-value">{figure.value}</div>
              </div>
            ))}
            <div className="kpi col-span-2 lg:col-span-1" title={pipeline.kpac?.detail}>
              <div className="kpi-label">PACT</div>
              <div className={`kpi-value ${pipeline.kpac?.reachable ? '' : 'text-strand-red'}`}>
                {pipeline.kpac?.reachable ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        )}
      </a>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setFilter(entry.key)}
            className={`h-8 px-3 rounded-md text-[13px] font-medium transition-colors ${
              filter === entry.key
                ? 'bg-kiran-tint text-[#0B4F9C]'
                : 'text-muted hover:bg-black/5 hover:text-ink'
            }`}
          >
            {entry.label}
            {entry.count !== undefined && (
              <span className="text-[12px] ml-1.5 opacity-75 tabular-nums">{entry.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="bg-surface border border-line rounded-lg divide-y divide-line-2">
        {visible.length === 0 ? (
          <div className="p-12 text-center">
            <BellRing className="w-6 h-6 text-slate-500 mx-auto" />
            <p className="text-[14px] text-muted mt-3">Nothing here yet.</p>
          </div>
        ) : (
          visible.map((notification) => (
            <div
              key={notification.id}
              onClick={() => !notification.read && markNotificationRead(notification.id)}
              className={`px-5 py-4 flex items-start gap-3 ${notification.read ? '' : 'cursor-pointer hover:bg-canvas'}`}
            >
              <span
                aria-hidden
                className={`mt-2 w-2 h-2 rounded-full shrink-0 ${
                  notification.read ? 'bg-transparent' : 'bg-kiran'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className={`text-[14px] text-ink truncate ${notification.read ? 'font-medium' : 'font-semibold'}`}
                  >
                    {notification.title}
                  </span>
                  <span className="text-[13px] text-muted whitespace-nowrap shrink-0">
                    {formatDateTime(notification.at)}
                  </span>
                </div>
                <p className="text-[13px] text-muted mt-0.5 truncate" title={notification.body}>
                  {recipient(notification)}
                  {notification.requestId && (
                    <>
                      {' · '}
                      <Link
                        to={`/reimbursements/${notification.requestId}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-code text-kiran hover:underline"
                      >
                        {notification.requestId}
                      </Link>
                    </>
                  )}
                  {' · '}
                  {notification.body}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
