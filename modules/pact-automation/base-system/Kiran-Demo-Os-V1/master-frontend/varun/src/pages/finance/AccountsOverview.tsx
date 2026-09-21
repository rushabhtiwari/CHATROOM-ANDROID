import React from 'react';
import { Link } from 'react-router-dom';
import { mockAccountsKPI, mockCashTrend } from '../../data/accounts';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { LinearProgressBar } from '../../components/common/LinearProgressBar';
import { HealthPill } from '../../components/common/HealthPill';
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
        category="FINANCE & OPERATIONS"
        title="Finance & Accounts Overview"
        description="Consolidated cash position, trade receivables ageing, vendor liabilities, and bank statement reconciliation."
        actions={
          <div className="flex items-center gap-3">
            {/* 5th Metric Companion Pill in Action Toolbar */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant shadow-xs text-xs font-mono">
              <span className="text-outline text-[12px] font-semibold">Unreconciled:</span>
              <span className="font-bold text-strand-amber tabular-nums">
                {formatINR(mockAccountsKPI.unreconciledAmount)}
              </span>
              <HealthPill
                status="at_risk"
                label={`${mockAccountsKPI.unreconciledCount} unmatched`}
                size="sm"
              />
            </div>
            <Link
              to="/accounts/reconciliation"
              className="px-3.5 py-1.5 bg-primary hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Daily Reconciliation</span>
            </Link>
          </div>
        }
      />

      {/* 5th Metric Operational Alert / Highlight Bar */}
      <div className="bg-surface-container-lowest border border-amber-300/60 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-strand-amber">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-strand-amber shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-strand-amber">
                Bank-vs-Books Variance Alert
              </span>
              <HealthPill status="at_risk" label={`${mockAccountsKPI.unreconciledCount} Unmatched Entries`} size="sm" />
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              MT940 statement balance deviates by <span className="font-mono font-bold text-on-surface tabular-nums">{formatINR(mockAccountsKPI.unreconciledAmount)}</span> against PACT ERP general ledger.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right hidden sm:block">
            <div className="text-[12px] font-mono text-outline">Unreconciled Delta</div>
            <div className="font-mono font-bold text-base text-strand-amber tabular-nums leading-tight">
              {formatINR(mockAccountsKPI.unreconciledAmount)}
            </div>
          </div>
          <Link
            to="/accounts/reconciliation"
            className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>Resolve Entries</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4-Across Primary KPI Cards Grid */}
      <LedgerBand cols={4}>
        {/* KPI 1: Net Cash Position */}
        <KPICard
          title="Net Cash Position"
          value={formatINRLakhCrore(mockAccountsKPI.cashPosition)}
          icon={<Wallet className="h-4 w-4 text-outline" />}
          status="on_track"
          footerLeft={
            <div className="flex items-center gap-1 text-strand-green font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>HDFC + Axis Corporate</span>
            </div>
          }
          footerRight="Verified 09:30"
        />

        {/* KPI 2: Total Receivables */}
        <KPICard
          title="Total Receivables"
          value={formatINRLakhCrore(mockAccountsKPI.totalReceivable)}
          icon={<ArrowUpRight className="h-4 w-4 text-outline" />}
          status="on_track"
          footerLeft="15 Enterprise accounts"
          footerRight="DSO: 38 days"
          to="/accounts/receivables"
        />

        {/* KPI 3: Total Payables */}
        <KPICard
          title="Total Payables"
          value={formatINRLakhCrore(mockAccountsKPI.totalPayable)}
          icon={<ArrowDownRight className="h-4 w-4 text-outline" />}
          status="neutral"
          footerLeft="18 Raw material vendors"
          footerRight="MSME Priority"
          to="/accounts/payables"
        />

        {/* KPI 4: Overdue >45 Days */}
        <KPICard
          title="Overdue >45 Days"
          value={formatINRLakhCrore(mockAccountsKPI.overdueReceivable)}
          icon={<AlertTriangle className="h-4 w-4 text-strand-red" />}
          status="overdue"
          footerLeft={
            <div className="flex items-center gap-1 text-strand-red font-semibold">
              <AlertTriangle className="w-3 h-3" />
              <span>3 Accounts flagged</span>
            </div>
          }
          footerRight="Stop-Dispatch"
          to="/accounts/receivables"
          className="border-strand-red/30"
        />
      </LedgerBand>

      {/* 6-Month Billed vs Collected Trend with LinearProgressBar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-outline-variant">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-sm text-on-surface">
                6-Month Billed Sales vs Cash Collections
              </h3>
              <HealthPill status="on_track" label="Target >90%" size="sm" />
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Tracking monthly billing against realized bank credits (₹ Cr)
            </p>
          </div>
          <div className="w-full sm:w-80 shrink-0">
            <LinearProgressBar
              value={mockAccountsKPI.collectionEfficiencyPct}
              label="Overall Collection Efficiency"
              valueLabel={`${mockAccountsKPI.collectionEfficiencyPct}%`}
              fractionLabel="₹30.95 Cr / ₹32.40 Cr"
              variant="success"
              heightClass="h-2"
            />
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockCashTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }}
                stroke="#c2c6d1"
              />
              <YAxis
                tickFormatter={(v) => `₹${(v / 10000000).toFixed(1)}Cr`}
                tick={{ fontSize: 11, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }}
                stroke="#c2c6d1"
              />
              <Tooltip
                formatter={(val: any) => [formatINR(val), '']}
                contentStyle={{
                  backgroundColor: '#0b1c30',
                  borderColor: 'rgba(194, 198, 209, 0.4)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px -2px rgba(11, 28, 48, 0.2)',
                  fontSize: '11px',
                  fontFamily: '"IBM Plex Mono", monospace',
                  color: '#ffffff'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px', fontFamily: '"Inter Tight", sans-serif' }} />
              <Bar dataKey="billed" name="Billed Sales (INR)" fill="#c2c6d1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="collected" name="Realized Collections (INR)" fill="#018F3D" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Access Modules Navigation */}
      <div className="ku-ledger grid-cols-1 md:grid-cols-3">
        <Link
          to="/accounts/reconciliation"
          className="p-4.5 bg-white hover:border-primary/60 rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
              <HealthPill status="at_risk" label={`${formatINR(mockAccountsKPI.unreconciledAmount)} delta`} size="sm" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Bank-vs-Books Reconciliation
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Auto-matches MT940 statement lines with PACT journal vouchers using AI discrepancy analysis.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>Open reconciliation</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/accounts/receivables"
          className="p-4.5 bg-white hover:border-primary/60 rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-strand-green border border-emerald-200 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <HealthPill status="on_track" label="15 Accounts" size="sm" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Customer Ageing & Receivables
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Slab-wise analysis (0-30 to 90+) and automated payment reminder cadence enforcement.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>Manage receivables</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/accounts/payables"
          className="p-4.5 bg-white hover:border-primary/60 rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-strand-amber border border-amber-200 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <HealthPill status="at_risk" label="40d Warning" size="sm" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Vendor Outstanding & UTR Tracker
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              40-day credit warning window, bi-weekly payment runs, and automated UTR advice emails.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>Manage payables</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
};
