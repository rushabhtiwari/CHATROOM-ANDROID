import React from 'react';
import { Link } from 'react-router-dom';
import { mockAccountsKPI, mockCashTrend } from '../../data/accounts';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import { ChevronRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export const AccountsOverview: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Accounts"
        actions={
          <Link to="/accounts/reconciliation" className="btn-primary">
            Reconcile
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="kpi">
          <div className="kpi-label">Cash</div>
          <div className="kpi-value">{formatINRLakhCrore(mockAccountsKPI.cashPosition)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Receivables</div>
          <div className="kpi-value">{formatINRLakhCrore(mockAccountsKPI.totalReceivable)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Payables</div>
          <div className="kpi-value">{formatINRLakhCrore(mockAccountsKPI.totalPayable)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Overdue 45+ days</div>
          <div className="kpi-value text-strand-red">{formatINRLakhCrore(mockAccountsKPI.overdueReceivable)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Unreconciled ({mockAccountsKPI.unreconciledCount})</div>
          <div className="kpi-value">{formatINR(mockAccountsKPI.unreconciledAmount)}</div>
        </div>
      </div>

      <div className="panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-ink">Billed vs collected</h3>
          <span className="text-[13px] text-muted tabular-nums">94.2% collected</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockCashTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5B5B63' }} axisLine={{ stroke: '#E6E6EB' }} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${(v / 10000000).toFixed(1)}Cr`} tick={{ fontSize: 12, fill: '#5B5B63' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(val: any) => [formatINR(val), '']} contentStyle={{ backgroundColor: '#1D1D1F', borderColor: '#1D1D1F', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="billed" name="Billed" fill="#D8D8DE" radius={[2, 2, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#0A63C9" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel divide-y divide-line-2">
        {[
          { to: '/accounts/reconciliation', label: 'Bank reconciliation' },
          { to: '/accounts/receivables', label: 'Receivables' },
          { to: '/accounts/payables', label: 'Payables' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center justify-between h-[52px] px-5 text-[14px] font-medium text-ink hover:bg-canvas first:rounded-t-xl last:rounded-b-xl"
          >
            <span>{item.label}</span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </Link>
        ))}
      </div>
    </div>
  );
};
