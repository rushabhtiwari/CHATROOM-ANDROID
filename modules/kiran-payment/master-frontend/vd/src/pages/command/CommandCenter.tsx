import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { StrandBar } from '../../components/common/StrandBar';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { formatINR } from '../../utils/formatters';
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
    { day: 'Wed', target: 32, actual: 18 },
    { day: 'Thu', target: 30, actual: 0 },
    { day: 'Fri', target: 35, actual: 0 },
  ];

  const tooltipStyle = {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E6EB',
    color: '#1D1D1F',
    borderRadius: '8px',
    fontSize: '13px',
  };

  const kpis: { to: string; label: string; value: string; alert?: boolean }[] = [
    { to: '/rfq', label: 'Open RFQs', value: '28' },
    { to: '/quotations', label: 'Quotes pending', value: '₹48.2 L' },
    { to: '/dispatch', label: 'Late dispatches', value: '4', alert: true },
    { to: '/accounts/receivables', label: 'Overdue over 45 days', value: '₹13.62 L', alert: true },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Today */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-[26px] font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.02em' }}>
            Wednesday, 19 August
          </h1>
          <p className="mt-2 text-[14px] text-slate-700 leading-relaxed">{aiSummary}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="btn-secondary"
            title="Refresh summary"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRegenerating ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => navigate('/ask')} className="btn-primary">
            Ask Kiran
          </button>
        </div>
      </div>

      {/* 2. Key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Link key={kpi.to} to={kpi.to} className="kpi block transition-colors hover:bg-canvas">
            <div className="kpi-label">{kpi.label}</div>
            <div className={`kpi-value ${kpi.alert ? 'text-strand-red' : ''}`}>{kpi.value}</div>
          </Link>
        ))}
      </div>

      {/* 3. Order lifecycle */}
      <StrandBar />

      {/* 4. Approvals and AI activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-surface border border-line rounded-lg flex flex-col">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-ink">To approve</h2>
              <span className="text-[13px] text-muted tabular-nums">
                {approvals.filter(item => item.status === 'Pending').length}
              </span>
            </div>
            <Link to="/approvals" className="text-[13px] font-medium text-kiran hover:underline">
              View all
            </Link>
          </div>

          <div className="divide-y divide-line-2 flex-1 overflow-y-auto max-h-[460px]">
            {approvals.slice(0, 7).map((item) => (
              <div
                key={item.id}
                className="px-5 py-3.5 hover:bg-canvas transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <Link
                    to={item.referenceLink}
                    className="text-[14px] font-medium text-ink hover:text-kiran truncate block"
                  >
                    {item.subject}
                  </Link>
                  <div className="text-[13px] text-muted truncate mt-0.5">
                    {item.type} · {item.requesterName} · {item.value ? formatINR(item.value) : 'Policy'} · {item.ageHours}h
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => navigate(item.referenceLink)} className="btn-secondary">
                    Open
                  </button>
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={item.status !== 'Pending'}
                    className="btn-secondary text-kiran"
                  >
                    {item.status === 'Pending' ? 'Approve' : 'Approved'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-surface border border-line rounded-lg flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold text-ink">AI today</h2>
            <Link to="/ai/runs" className="text-[13px] font-medium text-kiran hover:underline">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line-2 border-b border-line">
            {[
              { label: 'Runs', value: '48' },
              { label: 'RFQs created', value: '11' },
              { label: 'Spend', value: '₹739' },
            ].map((figure) => (
              <div key={figure.label} className="px-5 py-3">
                <div className="text-[13px] font-medium text-muted">{figure.label}</div>
                <div className="text-[20px] font-semibold text-ink tabular-nums">{figure.value}</div>
              </div>
            ))}
          </div>

          <div className="px-5 divide-y divide-line-2 flex-1 overflow-y-auto max-h-[340px]">
            {mockAIRuns.map((run) => (
              <div key={run.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium text-ink truncate">{run.feature}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <ConfidenceChip confidence={run.confidencePct} />
                    <span className="text-[13px] text-muted whitespace-nowrap">{run.timestamp.split(',')[1]}</span>
                  </span>
                </div>
                <p className="text-[13px] text-muted truncate mt-0.5" title={run.output}>
                  {run.output}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Charts and escalations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-line rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold text-ink">Overdue by team</h2>
            <span className="text-[13px] text-muted tabular-nums">13</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overdueByDeptData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="department" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#5B5B63' }} />
                <Tooltip cursor={{ fill: '#F7F7F9' }} formatter={(val: any) => [val, 'Overdue']} contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12} fill="#0A63C9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold text-ink">Dispatch vs plan</h2>
            <span className="text-[13px] text-muted whitespace-nowrap">₹1.24 Cr</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dispatchPlanData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5B5B63' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5B5B63' }} />
                <Tooltip cursor={{ fill: '#F7F7F9' }} contentStyle={tooltipStyle} />
                <Bar dataKey="target" name="Plan (L m)" fill="#E6E6EB" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actual" name="Actual (L m)" fill="#0A63C9" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[16px] font-semibold text-ink">Escalations</h2>
            <Link to="/comms/escalations" className="text-[13px] font-medium text-kiran hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-line-2 flex-1">
            {mockEscalations.map((esc) => (
              <div key={esc.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-medium text-ink truncate">{esc.recordTitle}</span>
                  <StatusPill status={esc.severity} />
                </div>
                <div className="text-[13px] text-muted flex items-center justify-between gap-2 mt-0.5">
                  <span className="truncate">{esc.currentLevel} · {esc.currentRole}</span>
                  <span className="text-strand-red whitespace-nowrap">{esc.timeAtLevel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
