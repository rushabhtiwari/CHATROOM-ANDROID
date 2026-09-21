/**
 * `/projects/:id/modules/:moduleId` — one module's work, in the five layouts.
 */

import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { moduleRollup } from '@/modules/projects/selectors';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import { WorkItemsView } from '@/components/projects/WorkItemsView';
import { Avatar } from '@/components/projects/Glyphs';

export const ModuleDetailPage: React.FC = () => {
  const { id = '', moduleId = '' } = useParams<{ id: string; moduleId: string }>();
  const { state } = useProjects();

  const module = state.modules.byId[moduleId];
  if (!module || module.projectId !== id) {
    return <Navigate to={`/projects/${id}/modules`} replace />;
  }

  const rollup = moduleRollup(state, moduleId);
  const lead = personById(module.leadId);

  const banner = (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-4 py-2">
      <span className="text-[13px] font-semibold text-ink">{module.name}</span>

      <div className="flex min-w-[10rem] max-w-[16rem] flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div
            style={{ width: `${rollup.progressPct}%` }}
            className="h-full rounded-full bg-kiran"
          />
        </div>
        <span className="font-mono text-[12px] text-muted">
          {rollup.done}/{rollup.total}
        </span>
      </div>

      {lead && (
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <Avatar name={lead.name} initials={lead.initials} color={lead.color} size="xs" />
          {lead.name}
        </span>
      )}

      {module.targetDate && (
        <span className="font-mono text-[12px] text-muted">
          target {format(parseISO(module.targetDate), 'd MMM yyyy')}
        </span>
      )}
    </div>
  );

  return <WorkItemsView scope={{ projectId: id, moduleId }} banner={banner} />;
};
