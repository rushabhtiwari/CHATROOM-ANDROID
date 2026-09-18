import React from 'react';
import { Link } from 'react-router-dom';
import { mockAccountsKPI, mockCashTrend } from '../../data/accounts';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Users,
  Building2,
  TrendingUp,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export const AccountsOverview: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Finance & Accounts Overview"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/accounts/reconciliation"
              className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Calculator className="w-3.5 h-3.5" />
              Daily Reconciliation
            </Link>
          </div>
        }
      />

      {/* 5 KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 font-mono">
        <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Net Cash Position
          </div>
          <div className="text-xl font-display font-bold text-ink mt-1">
            {formatINRLakhCrore(mockAccountsKPI.cashPosition)}
          </div>
          <div className="text-[10px] text-strand-green mt-1 flex items-center gap-1 font-sans">
            <TrendingUp className="w-3 h-3" /> HDFC + Axis Corporate
          </div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Total Receivables
          </div>
          <div className="text-xl font-display font-bold text-ink mt-1">
            {formatINRLakhCrore(mockAccountsKPI.totalReceivable)}
          </div>
          <div className="text-[10px] text-muted mt-1 font-sans">
            15 Enterprise accounts
          </div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Total Payables
          </div>
          <div className="text-xl font-display font-bold text-slate-800 mt-1">
            {formatINRLakhCrore(mockAccountsKPI.totalPayable)}
          </div>
          <div className="text-[10px] text-muted mt-1 font-sans">
            18 Raw material vendors
          </div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-strand-red">
            Overdue &gt;45 Days
          </div>
          <div className="text-xl font-display font-bold text-strand-red mt-1">
            {formatINRLakhCrore(mockAccountsKPI.overdueReceivable)}
          </div>
          <div className="text-[10px] text-strand-red mt-1 font-sans flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3" /> 3 Accounts flagged
          </div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-strand-amber">
            Unreconciled Difference
          </div>
          <div className="text-xl font-display font-bold text-strand-amber mt-1">
            {formatINR(mockAccountsKPI.unreconciledAmount)}
          </div>
          <div className="text-[10px] text-muted mt-1 font-sans">
            {mockAccountsKPI.unreconciledCount} unmatched entries
          </div>
        </div>
      </div>

      {/* 6-Month Billed vs Collected Trend */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">
              6-Month Billed Sales vs Cash Collections
            </h3>
            <p className="text-xs text-muted">Tracking monthly billing against realized bank credits (₹ Cr)</p>
          </div>
          <span className="font-mono text-xs text-strand-green font-semibold">
            94.2% Overall Collection Efficiency
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockCashTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A5A70' }} />
              <YAxis tickFormatter={(v) => `₹${(v / 10000000).toFixed(1)}Cr`} tick={{ fontSize: 11, fill: '#4A5A70' }} />
              <Tooltip formatter={(val: any) => [formatINR(val), '']} contentStyle={{ backgroundColor: '#0E2340', borderColor: '#1B3A63', color: '#fff', borderRadius: '4px', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="billed" name="Billed Sales (INR)" fill="#E2E7EE" radius={[2, 2, 0, 0]} />
              <Bar dataKey="collected" name="Realized Collections (INR)" fill="#018F3D" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Access Modules Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/accounts/reconciliation"
          className="p-5 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-kiran-tint text-kiran flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <h4 className="font-display font-semibold text-sm text-ink group-hover:text-kiran">
              Bank-vs-Books Reconciliation
            </h4>
            <p className="text-xs text-muted">
              Auto-matches MT940 statement lines with PACT journal vouchers using AI discrepancy analysis.
            </p>
          </div>
          <div className="pt-3 text-xs font-semibold text-kiran flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Open reconciliation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/accounts/receivables"
          className="p-5 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-emerald-50 text-strand-green border border-emerald-200 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h4 className="font-display font-semibold text-sm text-ink group-hover:text-kiran">
              Customer Ageing & Receivables
            </h4>
            <p className="text-xs text-muted">
              Slab-wise analysis (0-30 to 90+) and automated payment reminder cadence enforcement.
            </p>
          </div>
          <div className="pt-3 text-xs font-semibold text-kiran flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Manage receivables</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/accounts/payables"
          className="p-5 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-amber-50 text-strand-amber border border-amber-200 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h4 className="font-display font-semibold text-sm text-ink group-hover:text-kiran">
              Vendor Outstanding & UTR Tracker
            </h4>
            <p className="text-xs text-muted">
              40-day credit warning window, bi-weekly payment runs, and automated UTR advice emails.
            </p>
          </div>
          <div className="pt-3 text-xs font-semibold text-kiran flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Manage payables</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>
    </div>
  );
};
