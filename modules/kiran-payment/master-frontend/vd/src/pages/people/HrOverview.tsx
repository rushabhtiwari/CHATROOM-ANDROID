import React from 'react';
import { Link } from 'react-router-dom';
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
    { to: '/people/employees', label: 'Headcount', value: employees.length },
    { to: '/people/attendance', label: 'On leave today', value: awayToday.length },
    { to: '/people/leave', label: 'Leave to decide', value: pendingLeave.length },
    { to: '/hr', label: 'Claims with HR', value: withHr.length },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="HR" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.label} to={card.to} className="kpi block hover:border-slate-300 transition-colors">
            <div className="kpi-label">{card.label}</div>
            <div className="kpi-value">{card.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-surface border border-line rounded-lg p-5">
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-[16px] font-semibold text-ink">Paid claims</h3>
            <Link to="/reimbursements" className="text-[13px] font-medium text-kiran hover:underline">
              All claims
            </Link>
          </div>
          {settled.length === 0 ? (
            <p className="text-[14px] text-muted py-4">Nothing paid yet.</p>
          ) : (
            <table className="w-full text-left text-[14px]">
              <thead className="text-[13px] text-muted">
                <tr className="border-b border-line-2">
                  <th className="py-2.5 pr-4 font-medium">Employee</th>
                  <th className="py-2.5 px-4 font-medium">Claim</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                  <th className="py-2.5 pl-4 font-medium text-right">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {settled.slice(0, 7).map((payout) => (
                  <tr key={payout.id} className="h-[52px]">
                    <td className="pr-4 font-medium text-ink">
                      {employeeById(payout.employeeId)?.name ?? payout.employeeId}
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      <Link
                        to={`/reimbursements/${payout.requestId}`}
                        className="font-code text-[13px] text-kiran hover:underline"
                      >
                        {payout.requestId}
                      </Link>
                    </td>
                    <td className="px-4 text-right tabular-nums whitespace-nowrap">{formatCurrency(payout.amount)}</td>
                    <td className="pl-4 text-right text-muted whitespace-nowrap">
                      {payout.settledOn ? formatDateTime(payout.settledOn) : payout.method}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-surface border border-line rounded-lg p-5">
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-[16px] font-semibold text-ink">Updates</h3>
            <Link to="/activity" className="text-[13px] font-medium text-kiran hover:underline">
              All activity
            </Link>
          </div>
          {forHr.length === 0 ? (
            <p className="text-[14px] text-muted py-4">Nothing new.</p>
          ) : (
            <ul className="divide-y divide-line-2">
              {forHr.map((notification) => (
                <li key={notification.id} className="py-3 flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                      notification.read ? 'bg-line' : 'bg-strand-red'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink">{notification.title}</p>
                    <p className="text-[13px] text-muted">{notification.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[16px] font-semibold text-ink">Departments</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {headcount.map(([department, count]) => (
            <div key={department} className="kpi">
              <div className="kpi-label truncate">{department}</div>
              <div className="kpi-value">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
