/**
 * `/projects/:id/cycles` — the cycle list.
 *
 * Active first, then upcoming, then completed. The active cycle carries a
 * burndown, because that is the one anybody actually looks at; the completed
 * ones carry their final numbers instead, which is what you want when you are
 * looking back rather than steering.
 */

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ArrowRight, CalendarRange } from 'lucide-react';
import {
  cycleBurndown,
  cyclePhase,
  cyclesForProject,
  groupOfItem,
  workItemsForProject,
} from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import type { Cycle } from '@/modules/projects/types';
import { Burndown } from '@/components/projects/Burndown';

/** Points and counts for one cycle, computed the same way everywhere. */
function cycleStats(
  state: ReturnType<typeof useProjects>['state'],
  cycle: Cycle,
) {
  const items = workItemsForProject(state, cycle.projectId).filter(
    (item) => item.cycleId === cycle.id,
  );
  const live = items.filter((item) => groupOfItem(state, item) !== 'cancelled');
  const done = live.filter((item) => groupOfItem(state, item) === 'completed');

  const points = live.reduce((sum, item) => sum + (item.estimate ?? 0), 0);
  const donePoints = done.reduce((sum, item) => sum + (item.estimate ?? 0), 0);

  return {
    total: live.length,
    done: done.length,
    points,
    donePoints,
    pct: points === 0 ? 0 : Math.round((donePoints / points) * 100),
  };
}

const PHASE_STYLE = {
  active: 'border-strand-green/40 bg-emerald-50 text-strand-green',
  upcoming: 'border-line bg-canvas text-slate-600',
  completed: 'border-line bg-white text-muted',
} as const;

export const CyclesPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { state } = useProjects();

  const cycles = cyclesForProject(state, id);
  const order = { active: 0, upcoming: 1, completed: 2 };
  const sorted = [...cycles].sort(
    (a, b) => order[cyclePhase(a)] - order[cyclePhase(b)] || b.startDate.localeCompare(a.startDate),
  );

  if (cycles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <CalendarRange className="mx-auto h-7 w-7 text-slate-300" strokeWidth={1.6} />
          <p className="mt-2 text-[13px] text-muted">This project has no cycles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mx-auto max-w-4xl space-y-3">
        {sorted.map((cycle) => {
          const phase = cyclePhase(cycle);
          const stats = cycleStats(state, cycle);
          const remaining = differenceInCalendarDays(parseISO(cycle.endDate), new Date());

          return (
            <article
              key={cycle.id}
              className="rounded-lg border border-line bg-white p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/projects/${id}/cycles/${cycle.id}`}
                      className="font-display text-[14.5px] font-semibold text-ink hover:text-kiran"
                    >
                      {cycle.name}
                    </Link>
                    <span
                      className={`rounded-full border px-2 py-[1px] text-[12px] font-semibold ${PHASE_STYLE[phase]}`}
                    >
                      {phase}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">{cycle.description}</p>
                  <p className="mt-1 font-mono text-[12px] text-slate-500">
                    {format(parseISO(cycle.startDate), 'd MMM')} –{' '}
                    {format(parseISO(cycle.endDate), 'd MMM yyyy')}
                    {phase === 'active' && remaining >= 0 && (
                      <span className="ml-2 text-strand-green">
                        {remaining === 0 ? 'ends today' : `${remaining}d left`}
                      </span>
                    )}
                  </p>
                </div>

                <Link
                  to={`/projects/${id}/cycles/${cycle.id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-canvas"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <dl className="mt-3 grid grid-cols-4 gap-3 border-t border-line pt-3 text-[12px]">
                <div>
                  <dt className="text-muted">Items</dt>
                  <dd className="font-mono font-semibold text-ink">
                    {stats.done}/{stats.total}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Points</dt>
                  <dd className="font-mono font-semibold text-ink">
                    {stats.donePoints}/{stats.points}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Complete</dt>
                  <dd className="font-mono font-semibold text-ink">{stats.pct}%</dd>
                </div>
                <div>
                  <dt className="text-muted">Duration</dt>
                  <dd className="font-mono font-semibold text-ink">
                    {differenceInCalendarDays(parseISO(cycle.endDate), parseISO(cycle.startDate)) + 1}d
                  </dd>
                </div>
              </dl>

              {/* Only the active cycle gets a chart — a finished sprint's
                  burndown is history, and its final numbers say more. */}
              {phase === 'active' && (
                <div className="mt-3 border-t border-line pt-3">
                  <Burndown data={cycleBurndown(state, cycle.id)} height={148} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
