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
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { PageHeader } from '../../components/shell/PageHeader';
import { LinearProgressBar } from '../../components/common/LinearProgressBar';
import { HealthPill } from '../../components/common/HealthPill';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import { mockApprovals } from '../../data/approvals';
import { mockEscalations } from '../../data/comms';
import { mockAIRuns } from '../../data/aiControl';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const CommandCenter: React.FC = () => {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState(mockApprovals);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
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
    <div className="space-y-8 animate-fadeIn">
      {/*
        The console's front page opens on the same rhythm as every other page
        (LEDGERDESIGNSYSTEM.md §5.1): mono eyebrow, wide title, the 3px spine
        drawn across the full width, standfirst below it. The dark hero this
        replaced carried a decorative dot grid and a rounded tint block — the
        two things the system exists to remove. Presence comes from the width
        of the title and the weight of the rule, not from an inverted panel.
      */}
      <PageHeader
        title="Command Center"
        eyebrow={`Operations control / ${todayLabel} · Secunderabad HQ`}
        actions={
          <>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              title="Regenerate morning AI briefing"
              className="inline-flex h-10 items-center gap-2 border-2 border-hairline-strong bg-white px-4 text-body-s font-semibold leading-none text-ink transition-all duration-150 hover:border-ink hover:bg-canvas active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0"
            >
              <RefreshCw aria-hidden className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Briefing</span>
            </button>
            <button
              onClick={() => navigate('/ask')}
              className="inline-flex h-10 items-center gap-2 border-2 border-ink bg-accent px-4 text-body-s font-semibold leading-none text-accent-ink transition-all duration-150 hover:brightness-95 active:translate-y-px active:brightness-90"
            >
              <Bot aria-hidden className="h-4 w-4" />
              <span>Ask Kiran</span>
            </button>
          </>
        }
      >
        {/* The overnight read is a pulled-out note, not a tinted card: §4's
            6px accent rule down its leading edge, and nothing else. */}
        <div aria-live="polite" className="ku-rule-accent flex items-start gap-2.5">
          <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-meta" />
          <p className="max-w-4xl text-body-s leading-6 text-ink">{aiSummary}</p>
        </div>
      </PageHeader>

      {/* 2. Four Standardized Industrial KPI Cards */}
      <LedgerBand cols={4}>
        {/* Card 1: Open RFQs */}
        <KPICard
          to="/rfq"
          title="Open RFQs"
          value={28}
          trend={{ value: '+14% (7d)', positive: true }}
          status="on_track"
          footerLeft={
            <div className="w-full">
              <LinearProgressBar
                value={Math.round((11 / 28) * 100)}
                label="Auto-created"
                fractionLabel="11/28"
                variant="primary"
                heightClass="h-1.5"
              />
            </div>
          }
        />

        {/* Card 2: Quotations Pending */}
        <KPICard
          to="/quotations"
          title="Quotations Pending"
          value="₹48.2 L"
          badge={<HealthPill status="at_risk" label="19 Active" />}
          trend={{ value: '22.4% margin', neutral: true }}
          footerLeft={
            <div className="w-full">
              <LinearProgressBar
                value={76}
                label="Active Pipeline"
                fractionLabel="19 quotes"
                variant="warning"
                heightClass="h-1.5"
              />
            </div>
          }
        />

        {/* Card 3: Overdue Dispatches */}
        <KPICard
          to="/dispatch"
          title="Overdue Dispatches"
          value={4}
          badge={<HealthPill status="overdue" label="3 Critical" showPulse />}
          trend={{ value: '1 on hold', positive: false }}
          footerLeft={
            <div className="w-full">
              <LinearProgressBar
                value={75}
                label="Critical hold"
                fractionLabel="3/4"
                variant="danger"
                heightClass="h-1.5"
              />
            </div>
          }
        />

        {/* Card 4: Receivables Overdue >45d */}
        <KPICard
          to="/accounts/receivables"
          title="Receivables Overdue >45d"
          value="₹13.62 L"
          badge={<HealthPill status="neutral" label="3 Accounts" />}
          trend={{ value: '2.0% of total', neutral: true }}
          footerLeft={
            <div className="w-full">
              <LinearProgressBar
                value={Math.round((13.62 / 684) * 100)}
                label="Total Rec: ₹6.84 Cr"
                fractionLabel="₹13.62L"
                variant="success"
                heightClass="h-1.5"
              />
            </div>
          }
        />
      </LedgerBand>

      {/* 3. Order Lifecycle StrandBar */}
      <StrandBar />

      {/* 4. Two-Column Zone: Needs your decision (60%) vs AI activity today (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (60%): Needs your decision */}
        <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-none flex flex-col">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface font-mono">
                Needs Your Decision
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-50 text-strand-amber font-semibold border border-amber-200">
                {approvals.filter(item => item.status === 'Pending').length} Pending
              </span>
            </div>
            <Link
              to="/approvals"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>View all in inbox</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-outline-variant flex-1 overflow-y-auto max-h-[460px]">
            {approvals.slice(0, 7).map((item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-surface-container-low/60 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <StatusPill status={item.type} />
                  <div className="min-w-0">
                    <Link
                      to={item.referenceLink}
                      className="font-semibold text-on-surface hover:text-primary truncate block"
                    >
                      {item.subject}
                    </Link>
                    <div className="text-[11px] text-outline flex items-center gap-2 mt-0.5">
                      <span>By <strong className="text-on-surface">{item.requesterName}</strong></span>
                      <span>·</span>
                      <span className="font-mono text-on-surface-variant font-medium">
                        {item.value ? formatINR(item.value) : 'Policy Update'}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-outline">{item.ageHours}h ago</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(item.referenceLink)}
                    className="px-2.5 py-1 rounded-none bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant text-xs font-medium text-on-surface-variant"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={item.status !== 'Pending'}
                      className="px-2.5 py-1 rounded-none border-2 border-ink bg-accent active:translate-y-px hover:brightness-95 disabled:opacity-50 disabled:text-slate-400 disabled:cursor-default text-xs font-semibold text-accent-ink transition-colors"
                  >
                    {item.status === 'Pending' ? 'Approve' : 'Approved'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-outline-variant text-center bg-surface-container-low/30 rounded-none">
            <Link to="/approvals" className="text-xs font-semibold text-primary hover:underline">
              Open Full Approval Inbox ({approvals.length} records) →
            </Link>
          </div>
        </div>

        {/* Right Column (40%): AI Activity Today */}
        <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-none flex flex-col relative overflow-hidden">
          {/* Violet Accent Bar */}
          <div className="h-1 w-full bg-ai" />

          <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-ai-tint/20">
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

          {/* Three related figures are one ruled band, welded to the panel
              above them — not three bordered tiles inside a tinted tray. */}
          <div className="ku-ledger grid-cols-3 border-x-0 border-t-0 border-b border-b-hairline">
            <div className="px-3 py-2.5">
              <p className="ku-eyebrow">Runs today</p>
              <p className="ku-total mt-1 text-lead leading-none">48</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="ku-eyebrow">Auto-created</p>
              <p className="ku-total mt-1 text-lead leading-none">11 RFQs</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="ku-eyebrow">Spend today</p>
              <p className="ku-total mt-1 text-lead leading-none">₹739</p>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="p-3 divide-y divide-outline-variant flex-1 overflow-y-auto max-h-[340px]">
            {mockAIRuns.map((run) => (
              <div key={run.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ai" />
                    {run.feature}
                  </span>
                  <ConfidenceChip confidence={run.confidencePct} />
                </div>
                <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">
                  {run.output}
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono text-outline">
                  <span>{run.model} · {run.durationSec}s · {run.tokensUsed} tokens</span>
                  <span>{run.timestamp.split(',')[1]}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-outline-variant text-center bg-surface-container-low/30 rounded-none">
            <Link to="/ai" className="text-xs font-semibold text-ai hover:underline">
              Explore AI Control Plane & Model Registry →
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Bottom Row: 3 Visual Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Overdue tickets by department */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-none p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface font-mono">
              Overdue Tickets by Dept
            </span>
            <span className="text-xs font-mono text-outline">Total: 13</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overdueByDeptData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="department" type="category" width={75} tick={{ fontSize: 11, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }} stroke="#c2c6d1" />
                <Tooltip
                  formatter={(val: any) => [`${val} overdue tickets`, 'Count']}
                  contentStyle={{ backgroundColor: '#0b1c30', borderColor: 'rgba(194, 198, 209, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontFamily: '"IBM Plex Mono", monospace' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12} fill="#B5070E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Dispatch Plan vs Target */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-none p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface font-mono">
              Weekly Dispatches vs Plan (L Metres)
            </span>
            <span className="text-xs font-mono text-strand-green font-semibold">₹1.24 Cr done</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dispatchPlanData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }} stroke="#c2c6d1" />
                <YAxis tick={{ fontSize: 10, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }} stroke="#c2c6d1" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0b1c30', borderColor: 'rgba(194, 198, 209, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontFamily: '"IBM Plex Mono", monospace' }}
                />
                <Bar dataKey="target" name="Target (L Metres)" fill="#c2c6d1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actual" name="Actual (L Metres)" fill="#06477F" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 3: Escalations Open */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-none p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface font-mono">
              Open Escalations
            </span>
            <Link to="/comms/escalations" className="text-xs text-primary hover:underline font-mono">
              View matrix
            </Link>
          </div>
          <div className="divide-y divide-outline-variant flex-1 space-y-2">
            {mockEscalations.map((esc) => (
              <div key={esc.id} className="pt-2 first:pt-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-semibold text-on-surface truncate pr-2">
                    {esc.recordTitle}
                  </span>
                  <StatusPill status={esc.severity} />
                </div>
                <div className="text-[11px] text-outline flex items-center justify-between font-mono">
                  <span>Level: <strong className="text-on-surface">{esc.currentLevel}</strong> ({esc.currentRole})</span>
                  <span className="text-strand-red font-semibold">{esc.timeAtLevel}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2.5 border-t border-outline-variant text-[11px] text-outline flex items-center justify-between font-mono">
            <span>Next escalation in 4h</span>
            <span className="text-strand-amber font-semibold">2 require immediate action</span>
          </div>
        </div>
      </div>
    </div>
  );
};
