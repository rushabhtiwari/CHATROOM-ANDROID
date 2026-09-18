import React from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CalendarCheck, ClipboardCheck, Users2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { useRts } from '@/modules/rts/store';
import { actionOwner } from '@/modules/rts/status';
import { formatCurrency, formatDateTime } from '@/modules/rts/format';
import { onLeaveOn, todayIso, useLeave } from '@/modules/hr/leave';

/**
 * The HR desk: who is here, what is waiting on HR, and what other departments
 * have done with the claims HR approved.
 */
export const HrOverview: React.FC = () => {
  const { employees, requests, payouts, notifications, employeeById } = useRts();
  const { requests: leave } = useLeave();

  const today = todayIso();
  const withHr = requests.filter((request) => actionOwner(request.status) === 'HR');
  const pendingLeave = leave.filter((request) => request.status === 'Pending');
  const awayToday = employees.filter((employee) => onLeaveOn(leave, employee.id, today));

  const settled = payouts
    .filter((payout) => payout.status === 'PAID')
    .sort((a, b) => (b.settledOn ?? '').localeCompare(a.settledOn ?? ''));
  const forHr = notifications.filter((notification) => notification.toRole === 'HR').slice(0, 6);

  const headcount = Object.entries(
    employees.reduce<Record<string, number>>((counts, employee) => {
      counts[employee.department] = (counts[employee.department] ?? 0) + 1;
      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const cards = [
    { to: '/people/employees', label: 'Headcount', value: employees.length, note: `${headcount.length} departments`, icon: Users2, tone: 'text-ink' },
    { to: '/people/attendance', label: 'On leave today', value: awayToday.length, note: awayToday.map((e) => e.name.split(' ')[0]).join(', ') || 'Everyone is in', icon: CalendarCheck, tone: 'text-strand-amber' },
    { to: '/people/leave', label: 'Leave to decide', value: pendingLeave.length, note: 'Awaiting HR', icon: CalendarCheck, tone: 'text-ai' },
    { to: '/hr', label: 'Claims with HR', value: withHr.length, note: formatCurrency(withHr.reduce((sum, r) => sum + r.amount, 0)), icon: ClipboardCheck, tone: 'text-kiran' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="HR Overview"
        description="People, leave and attendance, and the expense claims HR reviews before Accounts pays them."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {card.label}
              </span>
              <card.icon className="w-4 h-4 text-muted" />
            </div>
            <div className={`text-2xl font-display font-bold mt-1 ${card.tone}`}>{card.value}</div>
            <div className="text-[11px] text-muted mt-1 truncate">{card.note}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* What Accounts did with HR-approved claims */}
        <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-display font-semibold text-sm text-ink flex items-center gap-2">
                <Banknote className="w-4 h-4 text-strand-green" />
                Disbursed by Accounts
              </h3>
              <p className="text-xs text-muted">Claims HR approved that have now been paid</p>
            </div>
            <Link to="/reimbursements" className="text-xs font-semibold text-kiran hover:underline">
              Claims ledger
            </Link>
          </div>
          {settled.length === 0 ? (
            <p className="text-xs text-muted py-4">Nothing has been paid out yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-muted">
                <tr>
                  <th className="py-1.5 font-semibold">Employee</th>
                  <th className="py-1.5 font-semibold">Claim</th>
                  <th className="py-1.5 font-semibold text-right">Amount</th>
                  <th className="py-1.5 font-semibold text-right">Settled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {settled.slice(0, 7).map((payout) => (
                  <tr key={payout.id}>
                    <td className="py-2 font-semibold text-ink">
                      {employeeById(payout.employeeId)?.name ?? payout.employeeId}
                    </td>
                    <td className="py-2">
                      <Link
                        to={`/reimbursements/${payout.requestId}`}
                        className="font-mono text-kiran hover:underline"
                      >
                        {payout.requestId}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono">{formatCurrency(payout.amount)}</td>
                    <td className="py-2 text-right font-mono text-muted">
                      {payout.settledOn ? formatDateTime(payout.settledOn) : payout.method}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sent to HR by other departments */}
        <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-display font-semibold text-sm text-ink">From other departments</h3>
              <p className="text-xs text-muted">Employees filing claims, Accounts deciding and paying them</p>
            </div>
            <Link to="/activity" className="text-xs font-semibold text-kiran hover:underline">
              All activity
            </Link>
          </div>
          {forHr.length === 0 ? (
            <p className="text-xs text-muted py-4">Nothing addressed to HR yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {forHr.map((notification) => (
                <li key={notification.id} className="py-2.5 flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      notification.read ? 'bg-line' : 'bg-strand-red'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">{notification.title}</p>
                    <p className="text-[11px] text-muted leading-relaxed">{notification.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Headcount by department */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-card">
        <h3 className="font-display font-semibold text-sm text-ink border-b border-line pb-3">
          Headcount by department
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-4">
          {headcount.map(([department, count]) => (
            <div key={department} className="bg-canvas border border-line rounded-md px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">
                {department}
              </div>
              <div className="text-xl font-display font-bold text-ink">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
