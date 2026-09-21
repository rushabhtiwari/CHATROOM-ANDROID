import React from 'react';
import {
  mockAICostTrend,
  mockAIDepartmentSpend,
  mockAIOverviewKPI
} from '../../data/aiControl';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Layers,
  Sparkles,
  PieChart,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

export const AICosts: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <PageHeader
        title="AI Inference Unit Economics & Budget"
      />

      {/* Budget Gauges & Currency Parity Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-[13px]">
        <div className="bg-surface border border-line rounded-lg p-4 space-y-2">
          <div className="text-[12px] font-sans font-semibold text-muted">
            Monthly Budget Utilization
          </div>
          <div className="text-2xl font-semibold text-ink">
            {formatINR(mockAIOverviewKPI.totalSpendINR)} / {formatINR(30000)}
          </div>
          <div className="w-full h-2 bg-line rounded-full overflow-hidden">
            <div
              style={{ width: `${(mockAIOverviewKPI.totalSpendINR / 30000) * 100}%` }}
              className="h-full bg-ai rounded-full"
            />
          </div>
          <div className="text-[12px] text-muted font-sans">38.6% remaining for August</div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-4 space-y-1">
          <div className="text-[12px] font-sans font-semibold text-muted">
            Exchange Rate Parity
          </div>
          <div className="text-2xl font-semibold text-ink">
            1 USD = ₹84.10 INR
          </div>
          <div className="text-[12px] text-muted font-sans">Real-time daily conversion via RBI reference</div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-4 space-y-1">
          <div className="text-[12px] font-sans font-semibold text-muted">
            Avg Cost / Extraction Ticket
          </div>
          <div className="text-2xl font-semibold text-strand-green">
            ₹4.40
          </div>
          <div className="text-[12px] text-muted font-sans">Down from ₹12.50 prior to Haiku routing</div>
        </div>
      </div>

      {/* 90-Day Stacked Cost Trajectory Area Chart */}
      <div className="bg-surface border border-line rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-ink">
              90-Day Cumulative AI Spend by Foundation Model (INR)
            </h3>
            <p className="text-[13px] text-muted">Tracking inference burn across Claude Sonnet, Haiku, and Opus</p>
          </div>
          <span className="font-mono text-[13px] text-ai font-semibold">90-Day View</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockAICostTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#4A5A70' }} />
              <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11, fill: '#4A5A70' }} />
              <Tooltip formatter={(val: any) => [formatINR(val), '']} contentStyle={{ backgroundColor: '#0E2340', borderColor: '#1B3A63', color: '#fff', borderRadius: '4px', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="sonnet" name="Claude Sonnet 4.6" stackId="1" stroke="#5B46C8" fill="#EAE5FB" />
              <Area type="monotone" dataKey="haiku" name="Claude Haiku 4.5" stackId="1" stroke="#00AEEF" fill="#E7F7F9" />
              <Area type="monotone" dataKey="opus" name="Claude Opus 5" stackId="1" stroke="#B5070E" fill="#FAECEB" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Cost Attribution Bar Chart */}
      <div className="bg-surface border border-line rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-ink">
              Cost Attribution by Business Department
            </h3>
            <p className="text-[13px] text-muted">Internal charging based on agent task origins</p>
          </div>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RBarChart data={mockAIDepartmentSpend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis dataKey="dept" tick={{ fontSize: 11, fill: '#4A5A70' }} />
              <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11, fill: '#4A5A70' }} />
              <Tooltip formatter={(val: any) => [formatINR(val), 'Monthly Spend']} contentStyle={{ backgroundColor: '#0E2340', borderColor: '#1B3A63', color: '#fff', borderRadius: '4px', fontSize: '11px' }} />
              <Bar dataKey="spend" fill="#5B46C8" radius={[4, 4, 0, 0]} />
            </RBarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
