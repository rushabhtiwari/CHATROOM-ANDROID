import React from 'react';
import {
  mockAICostTrend,
  mockAIDepartmentSpend,
  mockAIOverviewKPI
} from '../../data/aiControl';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard } from '../../components/common/KPICard';
import { LinearProgressBar } from '../../components/common/LinearProgressBar';
import { HealthPill } from '../../components/common/HealthPill';
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
        category="INTELLIGENCE & AUTOMATION"
        title="AI Inference Unit Economics & Budget"
        description="Token consumption expenditure, monthly budget burn runway, USD parity conversion, and departmental cost attribution."
      />

      {/* Budget Gauges & Currency Parity Strip */}
      <div className="ku-ledger grid-cols-1 sm:grid-cols-3">
        {/* Card 1: Budget Utilization with LinearProgressBar */}
        <div className="bg-white p-3.5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-outline text-[12px] font-mono truncate pr-2">
                Monthly Budget Utilization
              </span>
              <HealthPill status="on_track" label="61.4% Spent" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-on-surface leading-none tabular-nums">
                {formatINR(mockAIOverviewKPI.totalSpendINR)}
              </span>
              <span className="text-xs text-on-surface-variant font-mono">
                / {formatINR(30000)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <LinearProgressBar
              value={(mockAIOverviewKPI.totalSpendINR / 30000) * 100}
              variant="primary"
              showLabels={false}
              heightClass="h-2"
            />
            <div className="pt-2 flex items-center justify-between text-[12px] border-t border-outline-variant text-outline font-mono">
              <span>38.6% remaining for August</span>
              <span className="text-primary font-medium">₹11,580 available</span>
            </div>
          </div>
        </div>

        {/* Card 2: Exchange Rate Parity */}
        <KPICard
          title="Exchange Rate Parity"
          value="₹84.10"
          unit="per USD"
          icon={DollarSign}
          status="neutral"
          footerLeft="Real-time daily RBI reference"
        />

        {/* Card 3: Avg Cost / Extraction Ticket */}
        <KPICard
          title="Avg Cost / Ticket"
          value="₹4.40"
          status="on_track"
          trend={{ value: "-64.8%", positive: true }}
          icon={TrendingUp}
          footerLeft="Down from ₹12.50 (Haiku routing)"
        />
      </div>

      {/* 90-Day Stacked Cost Trajectory Area Chart */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div>
            <h3 className="font-semibold text-sm text-on-surface">
              90-Day Cumulative AI Spend by Foundation Model (INR)
            </h3>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              Tracking inference burn across Claude Sonnet, Haiku, and Opus
            </p>
          </div>
          <span className="font-mono text-xs text-ai font-semibold px-2 py-0.5 rounded bg-ai-tint/50 border border-ai/20">
            90-Day View
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockAICostTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }}
                stroke="#c2c6d1"
              />
              <YAxis
                tickFormatter={(v) => `₹${v}`}
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
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="sonnet" name="Claude Sonnet 4.6" stackId="1" stroke="#5B46C8" fill="#EAE5FB" />
              <Area type="monotone" dataKey="haiku" name="Claude Haiku 4.5" stackId="1" stroke="#00AEEF" fill="#E7F7F9" />
              <Area type="monotone" dataKey="opus" name="Claude Opus 5" stackId="1" stroke="#B5070E" fill="#FAECEB" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Cost Attribution Bar Chart */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs space-y-4">
        <div className="border-b border-outline-variant pb-3">
          <h3 className="font-semibold text-sm text-on-surface">
            Cost Attribution by Business Department
          </h3>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">
            Internal charging based on agent task origins
          </p>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RBarChart data={mockAIDepartmentSpend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis
                dataKey="dept"
                tick={{ fontSize: 11, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }}
                stroke="#c2c6d1"
              />
              <YAxis
                tickFormatter={(v) => `₹${v}`}
                tick={{ fontSize: 11, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }}
                stroke="#c2c6d1"
              />
              <Tooltip
                formatter={(val: any) => [formatINR(val), 'Monthly Spend']}
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
              <Bar dataKey="spend" fill="#5B46C8" radius={[4, 4, 0, 0]} />
            </RBarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
