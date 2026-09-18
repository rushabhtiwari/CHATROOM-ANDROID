/**
 * `/projects/:id/modules` — modules with progress bars.
 *
 * A module is a slice of scope that outlives any one cycle: "Master Data",
 * "Interfaces", "Ramp-up". Progress is completed items over items that were not
 * cancelled, the same rule the project grid uses.
 */

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ArrowRight, Boxes } from 'lucide-react';
import {
  isOverdue,
  moduleRollup,
  modulesForProject,
  workItemsForProject,
} from '@/modules/projects/selectors';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import { Avatar } from '@/components/projects/Glyphs';

export const ModulesPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { state } = useProjects();

  const modules = modulesForProject(state, id);
  const allItems = workItemsForProject(state, id);

  if (modules.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <Boxes className="mx-auto h-7 w-7 text-slate-300" strokeWidth={1.6} />
          <p className="mt-2 text-[13px] text-muted">This project has no modules.</p>
        </div>
      </div>
    );
  }

  const unassigned = allItems.filter((item) => item.moduleId === null).length;

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mx-auto max-w-4xl space-y-3">
        {modules.map((module) => {
          const rollup = moduleRollup(state, module.id);
          const lead = personById(module.leadId);
          const overdue = allItems.filter(
            (item) => item.moduleId === module.id && isOverdue(state, item),
          ).length;

          return (
            <article
              key={module.id}
              className="rounded-lg border border-line bg-white p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/projects/${id}/modules/${module.id}`}
                    className="font-display text-[14.5px] font-semibold text-ink hover:text-kiran"
                  >
                    {module.name}
                  </Link>
                  <p className="mt-1 text-[12px] text-muted">{module.description}</p>
                </div>
                <Link
                  to={`/projects/${id}/modules/${module.id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-canvas"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">
                    {rollup.done} of {rollup.total} done
                    {overdue > 0 && (
                      <span className="ml-2 font-semibold text-strand-red">
                        {overdue} overdue
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-semibold text-ink">{rollup.progressPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    style={{ width: `${rollup.progressPct}%` }}
                    className="h-full rounded-full bg-kiran transition-[width]"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11.5px]">
                <span className="flex items-center gap-1.5 text-muted">
                  Lead
                  {lead ? (
                    <>
                      <Avatar
                        name={lead.name}
                        initials={lead.initials}
                        color={lead.color}
                        size="xs"
                      />
                      <span className="text-slate-700">{lead.name}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </span>
                {module.targetDate && (
                  <span className="font-mono text-slate-500">
                    target {format(parseISO(module.targetDate), 'd MMM yyyy')}
                  </span>
                )}
              </div>
            </article>
          );
        })}

        {/* Work outside every module is easy to lose, so it is stated. */}
        {unassigned > 0 && (
          <p className="px-1 text-[11.5px] text-muted">
            {unassigned} work item{unassigned === 1 ? '' : 's'} in this project belong to no module.
          </p>
        )}
      </div>
    </div>
  );
};
