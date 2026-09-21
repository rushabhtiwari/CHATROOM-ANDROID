import React from 'react';
import { Link } from 'react-router-dom';
import {
  mockAIRoutingMap,
  mockAIModels,
  mockAIRuns,
  mockAIGuardrails
} from '../../data/aiControl';
import { PageHeader } from '../../components/shell/PageHeader';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { IndianRupee } from '../../components/common/IndianRupee';
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
        title="AI Control Plane & Model Supervision"
      />

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <Link
          to="/ai/costs"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md transition-all"
        >
          <div className="text-[12px] font-sans font-semibold text-muted">
            Monthly AI Spend
          </div>
          <div className="text-2xl font-semibold text-ink mt-1">
            {formatINR(totalSpend)}
          </div>
          <div className="text-[12px] text-strand-green mt-1 font-sans">
            61.4% of ₹30,000 monthly budget cap
          </div>
        </Link>

        <Link
          to="/ai/runs"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md transition-all"
        >
          <div className="text-[12px] font-sans font-semibold text-muted">
            Total Agent Runs (MTD)
          </div>
          <div className="text-2xl font-semibold text-ai mt-1">
            {totalRuns.toLocaleString('en-IN')}
          </div>
          <div className="text-[12px] text-muted mt-1 font-sans">
            Avg Latency: 1,420ms
          </div>
        </Link>

        <Link
          to="/ai/guardrails"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md transition-all"
        >
          <div className="text-[12px] font-sans font-semibold text-muted">
            Active Guardrail Policies
          </div>
          <div className="text-2xl font-semibold text-strand-green mt-1">
            {mockAIGuardrails.filter(g => g.isEnabled).length}
          </div>
          <div className="text-[12px] text-muted mt-1 font-sans">
            100% human-in-the-loop enforcement
          </div>
        </Link>

        <Link
          to="/ai/models"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md transition-all"
        >
          <div className="text-[12px] font-sans font-semibold text-muted">
            Registered LLM Engines
          </div>
          <div className="text-2xl font-semibold text-ink mt-1">
            {mockAIModels.length}
          </div>
          <div className="text-[12px] text-muted mt-1 font-sans">
            Claude 4.6, Haiku 4.5, Opus 5
          </div>
        </Link>
      </div>

      {/* Feature Routing Topology Table */}
      <div className="bg-surface border border-line rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="font-semibold text-sm text-ink">
              Feature-to-Model Routing Map
            </h3>
            <p className="text-[13px] text-muted">Intelligent multi-model dispatching based on latency requirements and reasoning complexity</p>
          </div>
          <Link
            to="/ai/models"
            className="text-[13px] font-semibold text-kiran hover:underline flex items-center gap-1"
          >
            <span>Manage Model Registry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] font-mono">
            <thead className="bg-canvas text-muted text-[12px] border-b border-line">
              <tr>
                <th className="p-2.5 font-sans">Operational Feature</th>
                <th className="p-2.5">Model Engine</th>
                <th className="p-2.5 font-sans">Reasoning Complexity</th>
                <th className="p-2.5 text-right">Runs / Month</th>
                <th className="p-2.5 text-right">Monthly Spend</th>
                <th className="p-2.5 text-center">Avg Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mockAIRoutingMap.map((route, idx) => (
                <tr key={idx} className="hover:bg-canvas/50">
                  <td className="p-2.5 font-sans font-semibold text-ink">{route.feature}</td>
                  <td className="p-2.5 text-ai font-semibold">{route.model}</td>
                  <td className="p-2.5 font-sans text-slate-700">{route.taskType}</td>
                  <td className="p-2.5 text-right">{route.runsMonth.toLocaleString('en-IN')}</td>
                  <td className="p-2.5 text-right font-semibold text-ink">{formatINR(route.monthlySpendINR)}</td>
                  <td className="p-2.5 text-center">
                    <ConfidenceChip confidence={route.avgConfidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-Module Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/ai/runs"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-1.5">
            <Activity className="w-4 h-4 text-ai" />
            <h4 className="font-semibold text-[13px] text-ink group-hover:text-ai">Observability Run Logs</h4>
            <p className="text-[12px] text-muted leading-tight">Inspect live execution traces, tool calls, and prompt tokens.</p>
          </div>
          <span className="text-[13px] font-semibold text-ai mt-3 flex items-center gap-1">
            <span>View traces</span> &rarr;
          </span>
        </Link>

        <Link
          to="/ai/costs"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-1.5">
            <DollarSign className="w-4 h-4 text-strand-green" />
            <h4 className="font-semibold text-[13px] text-ink group-hover:text-ai">Inference Economics</h4>
            <p className="text-[12px] text-muted leading-tight">90-day spend trajectories, token breakdowns, and budget caps.</p>
          </div>
          <span className="text-[13px] font-semibold text-ai mt-3 flex items-center gap-1">
            <span>Cost analytics</span> &rarr;
          </span>
        </Link>

        <Link
          to="/ai/guardrails"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-1.5">
            <ShieldCheck className="w-4 h-4 text-strand-amber" />
            <h4 className="font-semibold text-[13px] text-ink group-hover:text-ai">Guardrail Policies</h4>
            <p className="text-[12px] text-muted leading-tight">Confidence threshold gates, PII scrubbers, and blocked actions.</p>
          </div>
          <span className="text-[13px] font-semibold text-ai mt-3 flex items-center gap-1">
            <span>Safety gates</span> &rarr;
          </span>
        </Link>

        <Link
          to="/ai/prompts"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-1.5">
            <FileCode2 className="w-4 h-4 text-kiran" />
            <h4 className="font-semibold text-[13px] text-ink group-hover:text-ai">Prompt Registry & Diffs</h4>
            <p className="text-[12px] text-muted leading-tight">Version-controlled prompt templates with side-by-side diffs.</p>
          </div>
          <span className="text-[13px] font-semibold text-ai mt-3 flex items-center gap-1">
            <span>Prompt studio</span> &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
};
