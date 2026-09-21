import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockProjects } from '../../data/projects';
import { PageTabs } from '../../components/common/PageTabs';
import { StatusPill } from '../../components/common/StatusPill';
import { formatINR } from '../../utils/formatters';
import { ArrowLeft } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const TH = 'px-4 py-3 font-medium';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams();
  const project = mockProjects.find(p => p.id === id) || mockProjects[0];
  const [activeTab, setActiveTab] = useState<string>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks', count: project.tasks.length },
    { id: 'time', label: 'Hours' },
    { id: 'costs', label: 'Costs' },
    { id: 'reports', label: 'Reports', count: project.weeklyReports.length }
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
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Projects</span>
        </Link>
        <span className="text-[13px] text-muted whitespace-nowrap">Updated {project.lastUpdatedAt}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-code text-[13px] text-muted">{project.code}</div>
          <h1 className="text-[26px] font-semibold text-ink tracking-[-0.02em] leading-tight">{project.name}</h1>
          <p className="text-[14px] text-muted mt-1 max-w-3xl">{project.description}</p>
          <div className="text-[14px] text-muted mt-1">
            Lead <span className="text-ink">{project.ownerName}</span>
          </div>
        </div>

        <span className="inline-flex items-center h-6 px-2 rounded-md bg-[#FBEFDC] text-[#8A4F00] text-[13px] font-medium whitespace-nowrap">
          Week closes in 2d 14h
        </span>
      </div>

      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab)}
        departmentColor="#00AEEF"
      />

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="kpi">
              <div className="kpi-label">Budget</div>
              <div className="kpi-value">{formatINR(project.budget)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Spent</div>
              <div className="kpi-value">{formatINR(project.costToDate)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Progress</div>
              <div className="kpi-value">{project.progressPct}%</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Hours</div>
              <div className="kpi-value">
                {project.hoursSpent} / {project.hoursAllocated}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Overdue tasks</div>
              <div className={`kpi-value ${project.tasksOverdue > 0 ? 'text-strand-red' : ''}`}>
                {project.tasksOverdue}
              </div>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="px-5 py-4">
              <h4 className="text-[16px] font-semibold text-ink">Team</h4>
            </div>
            <table className="w-full text-left text-[14px]">
              <thead className="bg-surface-2 text-[13px] font-medium text-muted border-y border-line">
                <tr>
                  <th className={TH}>Name</th>
                  <th className={TH}>Department</th>
                  <th className={`${TH} text-right`}>Points</th>
                  <th className={`${TH} text-right`}>Penalty</th>
                  <th className={`${TH} text-right`}>Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {project.members.map((mem) => (
                  <tr key={mem.id} className="h-[52px]">
                    <td className="px-4 font-medium text-ink">{mem.name}</td>
                    <td className="px-4 text-slate-700">{mem.department}</td>
                    <td className="px-4 text-right tabular-nums">{mem.complianceScore}</td>
                    <td className={`px-4 text-right tabular-nums ${mem.negativePoints > 0 ? 'text-strand-red' : 'text-muted'}`}>
                      {mem.negativePoints > 0 ? `-${mem.negativePoints}` : '–'}
                    </td>
                    <td className={`px-4 text-right tabular-nums ${mem.negativePoints > 0 ? 'text-strand-red' : 'text-muted'}`}>
                      {mem.negativePoints > 0 ? mem.warningsIssued : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-surface border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] font-medium text-muted border-b border-line">
              <tr>
                <th className={TH}>Task</th>
                <th className={TH}>Department</th>
                <th className={TH}>Assignee</th>
                <th className={`${TH} text-right`}>Hours</th>
                <th className={TH}>Due</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {project.tasks.map((tsk) => (
                <tr key={tsk.id} className="h-[52px] hover:bg-canvas">
                  <td className="px-4 py-3 font-medium text-ink">{tsk.title}</td>
                  <td className="px-4 py-3 text-slate-700">{tsk.department}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{tsk.assignee}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{tsk.hoursActual}h / {tsk.hoursAllocated}h</td>
                  <td className="px-4 py-3 whitespace-nowrap">{tsk.dueDate}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusPill status={tsk.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'time' && (
        <div className="bg-surface border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] font-medium text-muted border-b border-line">
              <tr>
                <th className={TH}>Name</th>
                <th className={`${TH} text-right`}>Week 31</th>
                <th className={`${TH} text-right`}>Week 32</th>
                <th className={`${TH} text-right`}>Week 33</th>
                <th className={`${TH} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {project.members.map((m) => (
                <tr key={m.id} className="h-[52px]">
                  <td className="px-4">
                    <span className="font-medium text-ink">{m.name}</span>{' '}
                    <span className="text-[13px] text-muted">{m.department}</span>
                  </td>
                  <td className="px-4 text-right tabular-nums">38h</td>
                  <td className="px-4 text-right tabular-nums">42h</td>
                  <td className="px-4 text-right tabular-nums">26h</td>
                  <td className="px-4 text-right tabular-nums font-medium text-ink">106h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="bg-surface border border-line rounded-lg p-5 space-y-4">
          <h4 className="text-[16px] font-semibold text-ink">Spend vs budget</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burnData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#5B5B63' }} />
                <YAxis tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`} tick={{ fontSize: 12, fill: '#5B5B63' }} />
                <Tooltip formatter={(val: any) => [formatINR(val), '']} contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E6E6EB', color: '#1D1D1F', borderRadius: '8px', fontSize: '13px' }} />
                <Area type="monotone" dataKey="actual" name="Spent" stroke="#0A63C9" fill="#E7EFFA" strokeWidth={2} />
                <Area type="monotone" dataKey="budget" name="Budget" stroke="#6E6E76" strokeDasharray="3 3" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-surface border border-line rounded-lg divide-y divide-line-2">
          {project.weeklyReports.map((rep, idx) => (
            <div key={idx} className="px-5 min-h-[52px] py-2 flex items-center justify-between gap-3">
              <div className="text-[14px]">
                <span className="font-medium text-ink">{rep.week}</span>{' '}
                <span className="text-[13px] text-muted whitespace-nowrap">{rep.generatedAt}</span>
              </div>
              <button onClick={() => alert(`Downloading ${rep.week} audit summary`)} className="btn-secondary">
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
