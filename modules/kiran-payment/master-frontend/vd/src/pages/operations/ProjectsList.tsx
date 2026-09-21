import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mockProjects } from '../../data/projects';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';
import { Plus } from 'lucide-react';

export const ProjectsList: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Projects"
        actions={
          <button onClick={() => alert('New project initiative')} className="btn-primary">
            <Plus className="w-4 h-4" />
            New project
          </button>
        }
      />

      <div className="bg-surface border border-line rounded-lg px-5 py-4 flex flex-wrap items-center gap-3 text-[14px] text-ink">
        <span className="inline-flex items-center h-6 px-2 rounded-md bg-[#FBEFDC] text-[#8A4F00] text-[13px] font-medium whitespace-nowrap">
          2 days left
        </span>
        <span>Update your tasks by Friday 12:00 PM.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockProjects.map((prj) => (
          <div
            key={prj.id}
            onClick={() => navigate(`/projects/${prj.id}`)}
            className="bg-surface border border-line hover:border-slate-300 rounded-lg p-5 transition-colors cursor-pointer space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-code text-[13px] text-muted whitespace-nowrap">{prj.code}</span>
              {!prj.isFresh && (
                <span className="inline-flex items-center h-6 px-2 rounded-md bg-[#FBE9E7] text-[#B3302A] text-[13px] font-medium whitespace-nowrap">
                  Not updated
                </span>
              )}
            </div>

            <div>
              <h3 className="text-[16px] font-semibold text-ink leading-snug">{prj.name}</h3>
              <p className="text-[13px] text-muted mt-1 line-clamp-2">{prj.description}</p>
            </div>

            <div className="text-[13px] text-muted">{prj.departmentChips.join(' · ')}</div>

            <div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted">Progress</span>
                <span className="text-ink tabular-nums">{prj.progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#EBEBEF] rounded-full overflow-hidden mt-2">
                <div style={{ width: `${prj.progressPct}%` }} className="h-full bg-kiran rounded-full" />
              </div>
            </div>

            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-muted">Hours</span>
                <span className="text-ink tabular-nums">{prj.hoursSpent} / {prj.hoursAllocated}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Spent</span>
                <span className="text-ink tabular-nums">{formatINR(prj.costToDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Lead</span>
                <span className="text-ink">{prj.ownerName}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
