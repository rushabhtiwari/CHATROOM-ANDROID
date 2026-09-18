import React from 'react';
import { Link } from 'react-router-dom';
import {
  mockAIRoutingMap,
  mockAIModels,
  mockAIRuns,
  mockAIGuardrails
} from '../../data/aiControl';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { formatINR } from '../../utils/formatters';
import {
  Cpu,
  ShieldCheck,
  TrendingUp,
  Layers,
  Sparkles,
  ArrowRight,
  Activity,
  DollarSign,
  FileCode2
} from 'lucide-react';

export const AIOverview: React.FC = () => {
  const totalSpend = mockAIRoutingMap.reduce((acc, r) => acc + r.monthlySpendINR, 0);
  const totalRuns = mockAIRoutingMap.reduce((acc, r) => acc + r.runsMonth, 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        category="INTELLIGENCE & AUTOMATION"
        title="AI Control Plane & Model Supervision"
        description="Unified oversight of LLM routing policies, inference token unit economics, real-time safety guardrails, and agent run observability."
      />

      {/* 4 KPI Cards */}
      <LedgerBand cols={4}>
        <KPICard
          title="Monthly AI Spend"
          value={formatINR(totalSpend)}
          to="/ai/costs"
          status="on_track"
          icon={DollarSign}
          footerLeft="61.4% of ₹30k budget cap"
        />

        <KPICard
          title="Total Agent Runs (MTD)"
          value={totalRuns.toLocaleString('en-IN')}
          to="/ai/runs"
          icon={Activity}
          footerLeft="Avg Latency: 1,420ms"
        />

        <KPICard
          title="Active Guardrail Policies"
          value={mockAIGuardrails.filter(g => g.isEnabled).length}
          to="/ai/guardrails"
          status="on_track"
          icon={ShieldCheck}
          footerLeft="100% human-in-the-loop"
        />

        <KPICard
          title="Registered LLM Engines"
          value={mockAIModels.length}
          to="/ai/models"
          status="neutral"
          icon={Cpu}
          footerLeft="Claude 4.6, Haiku, Opus"
        />
      </LedgerBand>

      {/* Feature Routing Topology Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div>
            <h3 className="font-semibold text-sm text-on-surface">
              Feature-to-Model Routing Map
            </h3>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              Intelligent multi-model dispatching based on latency requirements and reasoning complexity
            </p>
          </div>
          <Link
            to="/ai/models"
            className="text-xs font-semibold font-mono text-ai hover:underline flex items-center gap-1"
          >
            <span>Manage Model Registry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase tracking-wider text-outline select-none">
              <tr className="h-9">
                <th className="px-3.5 py-0 align-middle font-mono font-semibold">Operational Feature</th>
                <th className="px-3.5 py-0 align-middle font-mono font-semibold">Model Engine</th>
                <th className="px-3.5 py-0 align-middle font-mono font-semibold">Reasoning Complexity</th>
                <th className="px-3.5 py-0 align-middle text-right font-mono font-semibold">Runs / Month</th>
                <th className="px-3.5 py-0 align-middle text-right font-mono font-semibold">Monthly Spend</th>
                <th className="px-3.5 py-0 align-middle text-center font-mono font-semibold">Avg Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {mockAIRoutingMap.map((route, idx) => (
                <tr key={idx} className="h-9 hover:bg-surface-container-low/60 transition-colors">
                  <td className="px-3.5 py-0 align-middle font-semibold text-on-surface truncate">{route.feature}</td>
                  <td className="px-3.5 py-0 align-middle text-ai font-semibold">{route.model}</td>
                  <td className="px-3.5 py-0 align-middle text-on-surface-variant">{route.taskType}</td>
                  <td className="px-3.5 py-0 align-middle text-right tabular-nums text-on-surface-variant">{route.runsMonth.toLocaleString('en-IN')}</td>
                  <td className="px-3.5 py-0 align-middle text-right font-bold text-on-surface tabular-nums">{formatINR(route.monthlySpendINR)}</td>
                  <td className="px-3.5 py-0 align-middle text-center">
                    <ConfidenceChip confidence={route.avgConfidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-Module Navigation Cards */}
      <div className="ku-ledger border-t-3 border-t-structure grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/ai/runs"
          className="p-4.5 bg-white hover:border-ai rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-surface-container text-ai flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-xs text-on-surface group-hover:text-ai transition-colors">Observability Run Logs</h4>
            <p className="text-[11px] text-on-surface-variant leading-tight">Inspect live execution traces, tool calls, and prompt tokens.</p>
          </div>
          <span className="text-xs font-semibold font-mono text-ai mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>View traces</span> &rarr;
          </span>
        </Link>

        <Link
          to="/ai/costs"
          className="p-4.5 bg-white hover:border-ai rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-strand-green border border-emerald-200 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-xs text-on-surface group-hover:text-ai transition-colors">Inference Economics</h4>
            <p className="text-[11px] text-on-surface-variant leading-tight">90-day spend trajectories, token breakdowns, and budget caps.</p>
          </div>
          <span className="text-xs font-semibold font-mono text-ai mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Cost analytics</span> &rarr;
          </span>
        </Link>

        <Link
          to="/ai/guardrails"
          className="p-4.5 bg-white hover:border-ai rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-strand-amber border border-amber-200 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-xs text-on-surface group-hover:text-ai transition-colors">Guardrail Policies</h4>
            <p className="text-[11px] text-on-surface-variant leading-tight">Confidence threshold gates, PII scrubbers, and blocked actions.</p>
          </div>
          <span className="text-xs font-semibold font-mono text-ai mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Safety gates</span> &rarr;
          </span>
        </Link>

        <Link
          to="/ai/prompts"
          className="p-4.5 bg-white hover:border-ai rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary border border-blue-200 flex items-center justify-center">
              <FileCode2 className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-xs text-on-surface group-hover:text-ai transition-colors">Prompt Registry & Diffs</h4>
            <p className="text-[11px] text-on-surface-variant leading-tight">Version-controlled prompt templates with side-by-side diffs.</p>
          </div>
          <span className="text-xs font-semibold font-mono text-ai mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Prompt studio</span> &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
};
