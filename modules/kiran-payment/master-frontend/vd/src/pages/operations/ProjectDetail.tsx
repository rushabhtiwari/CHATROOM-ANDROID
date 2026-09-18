import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockProjects } from '../../data/projects';
import { ProjectRecord } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { PageTabs } from '../../components/common/PageTabs';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  ArrowLeft,
  Clock,
  Layers,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  ShieldAlert,
  Users
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams();
  const project = mockProjects.find(p => p.id === id) || mockProjects[0];
  const [activeTab, setActiveTab] = useState<string>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks by Dept', count: project.tasks.length },
    { id: 'time', label: 'Time Allocation Grid' },
    { id: 'costs', label: 'Cost Burn & Budget' },
    { id: 'reports', label: 'Weekly Archive', count: project.weeklyReports.length }
  ];

  const burnData = [
    { week: 'W29', budget: 500000, actual: 420000 },
    { week: 'W30', budget: 1000000, actual: 880000 },
    { week: 'W31', budget: 1500000, actual: 1250000 },
    { week: 'W32', budget: 2000000, actual: 1600000 },
    { week: 'W33 (Current)', budget: 2500000, actual: 1850000 },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-kiran"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects List</span>
        </Link>
        <span className="font-mono text-xs text-muted">
          Last Updated: {project.lastUpdatedAt}
        </span>
      </div>

      {/* Thursday Compliance Banner */}
      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-strand-amber shrink-0" />
          <span>
            <strong>Weekly Task Lock:</strong> Update your progress before Friday 12:00 PM. Week closes automatically.
          </span>
        </div>
        <span className="font-mono text-[11px] font-semibold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">
          Auto-Close in 2d 14h
        </span>
      </div>

      {/* Main Header Card */}
      <div className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-xs text-kiran bg-canvas px-2 py-0.5 rounded border border-line">
                {project.code}
              </span>
              <h1 className="font-display font-semibold text-2xl text-ink">
                {project.name}
              </h1>
            </div>
            <p className="text-xs text-muted mt-1 max-w-3xl">{project.description}</p>
          </div>

          <div className="text-right font-mono">
            <div className="text-[10px] text-muted uppercase font-sans">Project Budget</div>
            <div className="text-xl font-bold text-ink">{formatINR(project.budget)}</div>
            <div className="text-xs text-strand-green font-semibold">
              {project.progressPct}% Delivered
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <PageTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab)}
          departmentColor="#00AEEF"
        />

        {/* Tab 1: Overview & Standings */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-12 gap-6 pt-2">
            {/* Left: Summary Metrics (7 cols) */}
            <div className="col-span-12 lg:col-span-7 space-y-4">
              <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                <div className="p-3 bg-canvas rounded border border-line">
                  <div className="text-[10px] text-muted uppercase font-sans">Hours Spent</div>
                  <div className="text-lg font-bold text-ink mt-0.5">{project.hoursSpent}h</div>
                  <div className="text-[10px] text-muted font-sans">of {project.hoursAllocated}h limit</div>
                </div>
                <div className="p-3 bg-canvas rounded border border-line">
                  <div className="text-[10px] text-muted uppercase font-sans">Cost to Date</div>
                  <div className="text-lg font-bold text-ink mt-0.5">{formatINR(project.costToDate)}</div>
                  <div className="text-[10px] text-muted font-sans">74% of budget</div>
                </div>
                <div className="p-3 bg-canvas rounded border border-line">
                  <div className="text-[10px] text-muted uppercase font-sans">Tasks Overdue</div>
                  <div className={`text-lg font-bold mt-0.5 ${project.tasksOverdue > 0 ? 'text-strand-red' : 'text-strand-green'}`}>
                    {project.tasksOverdue}
                  </div>
                  <div className="text-[10px] text-muted font-sans">Needs attention</div>
                </div>
              </div>

              <div className="p-4 bg-canvas/40 rounded border border-line space-y-2 text-xs">
                <h4 className="font-semibold text-ink font-mono uppercase tracking-wider text-[11px]">
                  Assigned Project Scope
                </h4>
                <p className="text-slate-700 leading-relaxed font-sans">
                  {project.description} Lead coordinator: <strong>{project.ownerName}</strong>.
                </p>
              </div>
            </div>

            {/* Right: Points & Warnings Compliance Panel (5 cols) */}
            <div className="col-span-12 lg:col-span-5 bg-canvas/30 p-4 rounded border border-line space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-line pb-2 font-sans">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-kiran" />
                  <h4 className="font-semibold text-xs text-ink uppercase tracking-wider">
                    Member Standings & Scorecard
                  </h4>
                </div>
                <span className="text-[10px] text-muted font-mono">Friday Close Rule</span>
              </div>

              <div className="space-y-2">
                {project.members.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-2.5 bg-white border border-line rounded flex items-center justify-between shadow-2xs"
                  >
                    <div>
                      <div className="font-semibold text-ink font-sans">{mem.name}</div>
                      <div className="text-[10px] text-muted">{mem.department}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-strand-green">{mem.complianceScore} pts</div>
                      {mem.negativePoints > 0 && (
                        <div className="text-[10px] text-strand-red font-semibold">
                          -{mem.negativePoints} pts ({mem.warningsIssued} warnings)
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Tasks by Department */}
        {activeTab === 'tasks' && (
          <div className="space-y-3 pt-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
                  <tr>
                    <th className="p-2.5 font-sans">Task Title</th>
                    <th className="p-2.5 font-sans">Department</th>
                    <th className="p-2.5 font-sans">Assignee</th>
                    <th className="p-2.5 text-right">Hours (Actual / Alloc)</th>
                    <th className="p-2.5">Due Date</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {project.tasks.map((tsk) => (
                    <tr key={tsk.id} className="hover:bg-canvas/50">
                      <td className="p-2.5 font-sans font-semibold text-ink">{tsk.title}</td>
                      <td className="p-2.5 font-sans">{tsk.department}</td>
                      <td className="p-2.5 font-sans text-slate-700">{tsk.assignee}</td>
                      <td className="p-2.5 text-right">{tsk.hoursActual}h / {tsk.hoursAllocated}h</td>
                      <td className="p-2.5">{tsk.dueDate}</td>
                      <td className="p-2.5 text-center">
                        <StatusPill status={tsk.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Time Allocation Grid */}
        {activeTab === 'time' && (
          <div className="space-y-4 pt-2 font-mono text-xs">
            <h4 className="font-display font-semibold text-xs text-ink uppercase tracking-wider">
              Weekly Resource Allocation vs Actual Hours Logged
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border border-line">
                <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
                  <tr>
                    <th className="p-2.5 font-sans">Team Member</th>
                    <th className="p-2.5 text-right">Week 31</th>
                    <th className="p-2.5 text-right">Week 32</th>
                    <th className="p-2.5 text-right">Week 33 (Current)</th>
                    <th className="p-2.5 text-right">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {project.members.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2.5 font-sans font-semibold text-ink">{m.name} ({m.department})</td>
                      <td className="p-2.5 text-right">38h</td>
                      <td className="p-2.5 text-right">42h</td>
                      <td className="p-2.5 text-right font-bold text-kiran">26h</td>
                      <td className="p-2.5 text-right font-bold text-ink">106h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Cost Burn Chart */}
        {activeTab === 'costs' && (
          <div className="space-y-4 pt-2">
            <h4 className="font-display font-semibold text-xs text-ink uppercase tracking-wider font-mono">
              Cumulative Cost Burn vs Budget Ceiling (INR)
            </h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burnData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#4A5A70' }} />
                  <YAxis tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`} tick={{ fontSize: 11, fill: '#4A5A70' }} />
                  <Tooltip formatter={(val: any) => [formatINR(val), '']} contentStyle={{ backgroundColor: '#0E2340', borderColor: '#1B3A63', color: '#fff', borderRadius: '4px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="actual" name="Actual Expenditure" stroke="#06477F" fill="#E8F1FA" strokeWidth={2} />
                  <Area type="monotone" dataKey="budget" name="Approved Budget Baseline" stroke="#7A8798" strokeDasharray="3 3" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tab 5: Weekly Reports Archive */}
        {activeTab === 'reports' && (
          <div className="space-y-3 pt-2">
            <h4 className="font-display font-semibold text-xs text-ink uppercase tracking-wider font-mono">
              Automated Friday Archive Snapshots
            </h4>
            <div className="space-y-2 font-mono text-xs">
              {project.weeklyReports.map((rep, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-canvas rounded border border-line flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-strand-green" />
                    <span className="font-semibold text-ink font-sans">{rep.week}</span>
                    <span className="text-muted text-[10px]">· Generated {rep.generatedAt}</span>
                  </div>
                  <button
                    onClick={() => alert(`Downloading ${rep.week} audit summary`)}
                    className="px-2.5 py-1 bg-white hover:bg-canvas border border-line rounded text-xs font-semibold text-slate-800 shadow-2xs"
                  >
                    Download Archive
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
