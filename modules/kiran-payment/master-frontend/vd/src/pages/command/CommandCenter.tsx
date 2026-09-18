import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Bot,
  RefreshCw,
  FileText,
  Truck,
  CheckCircle2,
  DollarSign,
  PackageCheck
} from 'lucide-react';
import { StrandBar } from '../../components/common/StrandBar';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import { mockApprovals } from '../../data/approvals';
import { mockEscalations } from '../../data/comms';
import { mockAIRuns } from '../../data/aiControl';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const CommandCenter: React.FC = () => {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState(mockApprovals);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState(
    "14 RFQs came in overnight, 11 auto-created. 3 need a customer match. Motherson's September schedule is 2 days late."
  );

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setAiSummary(
        "14 RFQs parsed from 3 mailboxes (96% avg confidence). 2 quotations pending HOD review for price adjustments. Stop-dispatch active on Motherson."
      );
      setIsRegenerating(false);
    }, 600);
  };

  const handleApprove = (id: string) => {
    setApprovals(prev => prev.map(item => item.id === id ? { ...item, status: 'Approved' } : item));
  };

  const overdueByDeptData = [
    { department: 'Sales', count: 5, fill: '#B5070E' },
    { department: 'Production', count: 3, fill: '#E9991B' },
    { department: 'Purchase', count: 2, fill: '#E9991B' },
    { department: 'Accounts', count: 1, fill: '#018F3D' },
    { department: 'Projects', count: 2, fill: '#00AEEF' }
  ];

  const dispatchPlanData = [
    { day: 'Mon', target: 24, actual: 26 },
    { day: 'Tue', target: 28, actual: 25 },
    { day: 'Wed (Today)', target: 32, actual: 18 },
    { day: 'Thu', target: 30, actual: 0 },
    { day: 'Fri', target: 35, actual: 0 },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Greeting Strip & AI Situation Summary */}
      <div className="bg-surface border border-line rounded-lg p-4 shadow-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
            Wednesday, 19 August 2026 · Secunderabad HQ
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-medium text-ai bg-ai-tint/40 px-3 py-1.5 rounded border border-ai/20">
            <Sparkles className="w-4 h-4 text-ai shrink-0" />
            <span>{aiSummary}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="px-2.5 py-1.5 rounded bg-white hover:bg-canvas border border-line text-xs font-medium text-slate flex items-center gap-1.5 shadow-xs transition-colors"
            title="Regenerate morning AI briefing"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-ai' : 'text-muted'}`} />
            <span>Briefing</span>
          </button>
          <button
            onClick={() => navigate('/ask')}
            className="px-3 py-1.5 rounded bg-ink hover:bg-ink-2 text-xs font-semibold text-white flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-ai-tint" />
            <span>Ask Kiran</span>
          </button>
        </div>
      </div>

      {/* 2. Four KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Open RFQs */}
        <Link
          to="/rfq"
          className="bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted font-mono">
              Open RFQs
            </span>
            <span className="text-xs font-mono font-medium text-strand-green bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +14% (7d)
            </span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span className="font-display font-bold text-3xl text-ink">
              28
            </span>
            <span className="text-xs text-muted font-mono">11 auto-created</span>
          </div>
          <div className="h-6 w-full flex items-end gap-1">
            {[18, 22, 19, 25, 24, 26, 28].map((val, i) => (
              <div
                key={i}
                style={{ height: `${(val / 30) * 100}%` }}
                className="flex-1 bg-kiran/20 group-hover:bg-kiran rounded-2xs transition-colors"
              />
            ))}
          </div>
        </Link>

        {/* Card 2: Quotations Pending Customer Response */}
        <Link
          to="/quotations"
          className="bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted font-mono">
              Quotations Pending
            </span>
            <span className="text-xs font-mono font-medium text-strand-amber bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
              19 Active
            </span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span className="font-display font-bold text-3xl text-ink">
              ₹48.2 L
            </span>
            <span className="text-xs text-muted font-mono">Avg margin: 22.4%</span>
          </div>
          <div className="h-6 w-full flex items-end gap-1">
            {[32, 36, 40, 42, 45, 46, 48].map((val, i) => (
              <div
                key={i}
                style={{ height: `${(val / 50) * 100}%` }}
                className="flex-1 bg-strand-amber/30 group-hover:bg-strand-amber rounded-2xs transition-colors"
              />
            ))}
          </div>
        </Link>

        {/* Card 3: Overdue Dispatches */}
        <Link
          to="/dispatch"
          className="bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted font-mono">
              Overdue Dispatches
            </span>
            <span className="text-xs font-mono font-medium text-strand-red bg-red-50 px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" /> 3 Critical
            </span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span className="font-display font-bold text-3xl text-strand-red">
              4
            </span>
            <span className="text-xs text-muted font-mono">1 stop-dispatch hold</span>
          </div>
          <div className="h-6 w-full flex items-end gap-1">
            {[2, 1, 3, 2, 4, 3, 4].map((val, i) => (
              <div
                key={i}
                style={{ height: `${(val / 6) * 100}%` }}
                className="flex-1 bg-strand-red/30 group-hover:bg-strand-red rounded-2xs transition-colors"
              />
            ))}
          </div>
        </Link>

        {/* Card 4: Receivables Overdue >45 Days */}
        <Link
          to="/accounts/receivables"
          className="bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted font-mono">
              Receivables Overdue &gt;45d
            </span>
            <span className="text-xs font-mono font-medium text-slate bg-slate-100 px-1.5 py-0.5 rounded border border-line flex items-center gap-0.5">
              3 Accounts
            </span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span className="font-display font-bold text-3xl text-strand-red">
              ₹13.62 L
            </span>
            <span className="text-xs text-muted font-mono">Total Rec: ₹6.84 Cr</span>
          </div>
          <div className="h-6 w-full flex items-end gap-1">
            {[18, 16, 15, 14, 14, 13.8, 13.6].map((val, i) => (
              <div
                key={i}
                style={{ height: `${(val / 20) * 100}%` }}
                className="flex-1 bg-strand-green/30 group-hover:bg-strand-green rounded-2xs transition-colors"
              />
            ))}
          </div>
        </Link>
      </div>

      {/* 3. Order Lifecycle StrandBar */}
      <StrandBar />

      {/* 4. Two-Column Zone: Needs your decision (60%) vs AI activity today (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (60%): Needs your decision */}
        <div className="lg:col-span-7 bg-surface border border-line rounded-lg shadow-card flex flex-col">
          <div className="p-4 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
                Needs Your Decision
              </span>
              <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-strand-amber/20 text-strand-amber font-semibold border border-strand-amber/30">
                {approvals.filter(item => item.status === 'Pending').length} Pending
              </span>
            </div>
            <Link
              to="/approvals"
              className="text-xs font-semibold text-kiran hover:underline flex items-center gap-1"
            >
              <span>View all in inbox</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-line flex-1 overflow-y-auto max-h-[460px]">
              {approvals.slice(0, 7).map((item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-canvas transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <StatusPill status={item.type} />
                  <div className="min-w-0">
                    <Link
                      to={item.referenceLink}
                      className="font-semibold text-ink hover:text-kiran truncate block"
                    >
                      {item.subject}
                    </Link>
                    <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                      <span>By <strong>{item.requesterName}</strong></span>
                      <span>·</span>
                      <span className="font-mono text-slate-700 font-medium">
                        {item.value ? formatINR(item.value) : 'Policy Update'}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-muted">{item.ageHours}h ago</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(item.referenceLink)}
                    className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-line text-xs font-medium text-slate"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={item.status !== 'Pending'}
                    className="px-2.5 py-1 rounded bg-strand-green hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-default text-xs font-semibold text-white shadow-xs"
                  >
                    {item.status === 'Pending' ? 'Approve' : 'Approved'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-line text-center bg-canvas/30">
            <Link to="/approvals" className="text-xs font-semibold text-kiran hover:underline">
              Open Full Approval Inbox ({approvals.length} records) →
            </Link>
          </div>
        </div>

        {/* Right Column (40%): AI Activity Today */}
        <div className="lg:col-span-5 bg-surface border border-ai/30 rounded-md shadow-card flex flex-col relative overflow-hidden">
          {/* Violet Accent Bar */}
          <div className="h-1 w-full bg-ai" />

          <div className="p-4 border-b border-line flex items-center justify-between bg-ai-tint/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-ai" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ai font-mono">
                AI Activity Today
              </span>
            </div>
            <Link
              to="/ai/runs"
              className="text-xs font-semibold text-ai hover:underline flex items-center gap-1"
            >
              <span>View trace logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* AI Metrics Summary Grid */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-ai-tint/10 border-b border-line text-center font-mono">
            <div className="p-2 rounded bg-white border border-ai/20">
              <div className="text-[10px] text-muted uppercase">Runs Today</div>
              <div className="text-base font-bold text-ink">48</div>
            </div>
            <div className="p-2 rounded bg-white border border-ai/20">
              <div className="text-[10px] text-muted uppercase">Auto-created</div>
              <div className="text-base font-bold text-strand-green">11 RFQs</div>
            </div>
            <div className="p-2 rounded bg-white border border-ai/20">
              <div className="text-[10px] text-muted uppercase">Spend Today</div>
              <div className="text-base font-bold text-ai">₹739</div>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="p-3 divide-y divide-line flex-1 overflow-y-auto max-h-[340px]">
            {mockAIRuns.map((run) => (
              <div key={run.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ai" />
                    {run.feature}
                  </span>
                  <ConfidenceChip confidence={run.confidencePct} />
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                  {run.output}
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                  <span>{run.model} · {run.durationSec}s · {run.tokensUsed} tokens</span>
                  <span>{run.timestamp.split(',')[1]}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-line text-center bg-canvas/30">
            <Link to="/ai" className="text-xs font-semibold text-ai hover:underline">
              Explore AI Control Plane & Model Registry →
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Bottom Row: 3 Visual Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Overdue tickets by department */}
        <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
              Overdue Tickets by Dept
            </span>
            <span className="text-xs font-mono text-muted">Total: 13</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overdueByDeptData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="department" type="category" width={75} tick={{ fontSize: 11, fill: '#4A5A70' }} />
                <Tooltip
                  formatter={(val: any) => [`${val} overdue tickets`, 'Count']}
                  contentStyle={{ backgroundColor: '#0E2340', borderColor: '#1B3A63', color: '#fff', borderRadius: '4px', fontSize: '11px' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12} fill="#B5070E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Dispatch Plan vs Target */}
        <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
              Weekly Dispatches vs Plan (L Metres)
            </span>
            <span className="text-xs font-mono text-strand-green">₹1.24 Cr done</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dispatchPlanData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4A5A70' }} />
                <YAxis tick={{ fontSize: 10, fill: '#4A5A70' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0E2340', borderColor: '#1B3A63', color: '#fff', borderRadius: '4px', fontSize: '11px' }}
                />
                <Bar dataKey="target" name="Target (L Metres)" fill="#E2E7EE" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actual" name="Actual (L Metres)" fill="#06477F" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 3: Escalations Open */}
        <div className="bg-surface border border-line rounded-lg p-4 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
              Open Escalations
            </span>
            <Link to="/comms/escalations" className="text-xs text-kiran hover:underline">
              View matrix
            </Link>
          </div>
          <div className="divide-y divide-line flex-1 space-y-2">
            {mockEscalations.map((esc) => (
              <div key={esc.id} className="pt-2 first:pt-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-semibold text-ink truncate pr-2">
                    {esc.recordTitle}
                  </span>
                  <StatusPill status={esc.severity} />
                </div>
                <div className="text-[11px] text-muted flex items-center justify-between font-mono">
                  <span>Level: <strong>{esc.currentLevel}</strong> ({esc.currentRole})</span>
                  <span className="text-strand-red font-semibold">{esc.timeAtLevel}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-line text-[11px] text-muted flex items-center justify-between">
            <span>Next escalation in 4h</span>
            <span className="text-strand-amber">2 require immediate action</span>
          </div>
        </div>
      </div>
    </div>
  );
};
