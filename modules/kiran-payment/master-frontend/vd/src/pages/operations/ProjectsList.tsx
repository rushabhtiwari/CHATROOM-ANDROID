import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockProjects } from '../../data/projects';
import { ProjectRecord } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Plus
} from 'lucide-react';

export const ProjectsList: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Cross-Functional Projects & ERP Modernization"
        actions={
          <button
            onClick={() => alert('New project initiative')}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Initiative
          </button>
        }
      />

      {/* Thursday Task Reminder Banner */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-strand-amber shrink-0" />
          <div>
            <div className="font-bold text-amber-950">
              Update your tasks before Friday 12:00 PM — the week closes automatically
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Unlogged task hours after Friday 12:00 PM result in automated negative compliance points on your team standing scorecard.
            </p>
          </div>
        </div>
        <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-white border border-amber-300 text-amber-900">
          2 Days Remaining
        </span>
      </div>

      {/* Projects Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProjects.map((prj) => (
          <div
            key={prj.id}
            onClick={() => navigate(`/projects/${prj.id}`)}
            className="bg-surface border border-line hover:border-kiran rounded-md p-5 shadow-card hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              {/* Header & Freshness Alert */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-kiran">
                  {prj.code}
                </span>
                {!prj.isFresh && (
                  <span className="px-2 py-0.5 rounded bg-red-100 border border-red-200 text-strand-red font-bold text-[10px] animate-pulse">
                    Stale (Not updated since Friday)
                  </span>
                )}
              </div>

              <div>
                <h3 className="font-display font-semibold text-base text-ink group-hover:text-kiran transition-colors leading-snug">
                  {prj.name}
                </h3>
                <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                  {prj.description}
                </p>
              </div>

              {/* Department Strand Badges */}
              <div className="flex flex-wrap gap-1 pt-1">
                {prj.departmentChips.map((dept, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-canvas border border-line text-slate-700"
                  >
                    {dept}
                  </span>
                ))}
              </div>

              {/* Progress & Financials */}
              <div className="space-y-2 pt-2 border-t border-line/60 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted font-sans">Progress:</span>
                  <span className="font-bold text-ink">{prj.progressPct}%</span>
                </div>
                <div className="w-full h-2 bg-line rounded-full overflow-hidden">
                  <div
                    style={{ width: `${prj.progressPct}%` }}
                    className="h-full bg-kiran rounded-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-muted font-sans">Hours Logged:</span>
                    <div className="font-semibold text-ink">{prj.hoursSpent} / {prj.hoursAllocated}h</div>
                  </div>
                  <div>
                    <span className="text-muted font-sans">Burn to Date:</span>
                    <div className="font-semibold text-ink">{formatINR(prj.costToDate)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="text-muted font-sans">Lead:</span>
                <strong>{prj.ownerName}</strong>
              </div>
              <span className="font-semibold text-kiran flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>View project</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
