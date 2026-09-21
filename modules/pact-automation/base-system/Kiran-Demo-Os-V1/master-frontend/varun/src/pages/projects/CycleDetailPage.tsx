/**
 * `/projects/:id/cycles/:cycleId` — one cycle's work, in the same five layouts.
 *
 * Designed with Stitch Industrial Precision Engineering console:
 * - 4-Across KPI tiles: Total Workload, Completed, In Progress, Pending/Todo
 * - Dual-track progress bar (completed vs in progress)
 * - Collapsible Burndown Chart
 * - Filterable WorkItemsView below
 */

import React, { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Hourglass,
  LineChart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { cycleBurndown, cyclePhase, isOverdue, workItemsForProject } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import { WorkItemsView } from '@/components/projects/WorkItemsView';
import { Burndown } from '@/components/projects/Burndown';

export const CycleDetailPage: React.FC = () => {
  const { id = '', cycleId = '' } = useParams<{ id: string; cycleId: string }>();
  const { state } = useProjects();
  const [chartOpen, setChartOpen] = useState(true);

  const cycle = state.cycles.byId[cycleId];
  const project = state.projects.byId[id];

  if (!cycle || cycle.projectId !== id) {
    return <Navigate to={`/projects/${id}/cycles`} replace />;
  }

  const phase = cyclePhase(cycle);
  const remaining = differenceInCalendarDays(parseISO(cycle.endDate), new Date());

  // Derive metrics
  const cycleItems = useMemo(
    () => workItemsForProject(state, id).filter((item) => item.cycleId === cycleId),
    [state, id, cycleId],
  );

  const totalItems = cycleItems.length;
  const completedItems = cycleItems.filter(
    (item) => state.states.byId[item.stateId]?.group === 'completed',
  );
  const inProgressItems = cycleItems.filter(
    (item) => state.states.byId[item.stateId]?.group === 'started',
  );
  const pendingItems = cycleItems.filter((item) => {
    const grp = state.states.byId[item.stateId]?.group;
    return grp === 'backlog' || grp === 'unstarted';
  });

  const totalPts = cycleItems.reduce((sum, item) => sum + (item.estimate ?? 0), 0);
  const donePts = completedItems.reduce((sum, item) => sum + (item.estimate ?? 0), 0);
  const inProgressPts = inProgressItems.reduce((sum, item) => sum + (item.estimate ?? 0), 0);

  const completionPct = totalItems > 0 ? Math.round((completedItems.length / totalItems) * 100) : 0;
  const inProgressPct = totalItems > 0 ? Math.round((inProgressItems.length / totalItems) * 100) : 0;

  const overdueCount = cycleItems.filter((item) => isOverdue(state, item)).length;
  const uniqueAssignees = new Set(cycleItems.flatMap((item) => item.assigneeIds)).size;

  const banner = (
    <div className="shrink-0 border-b border-outline-variant bg-surface-container-lowest">
      {/* Top Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary bg-surface-container-high px-2 py-0.5 rounded">
              {project?.key} · {cycle.name}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
              phase === 'active'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-surface-container text-on-surface-variant border border-outline-variant'
            }`}
          >
            {phase === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-st-green-ink animate-pulse" />}
            {phase}
          </span>

          <span className="flex items-center gap-1 font-mono text-xs text-outline">
            <Calendar className="h-3.5 w-3.5" />
            {format(parseISO(cycle.startDate), 'd MMM')} – {format(parseISO(cycle.endDate), 'd MMM yyyy')}
            {phase === 'active' && remaining >= 0 && (
              <span className="font-semibold text-primary">· {remaining}d left</span>
            )}
          </span>
        </div>

        {/* Linear Progress Bar */}
        <div className="flex items-center gap-3 min-w-[280px]">
          <div className="flex flex-col flex-1 gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant font-medium">Cycle Completion</span>
              <span className="text-primary font-bold">
                {completionPct}%{' '}
                <span className="text-outline font-normal font-mono text-[12px]">
                  ({completedItems.length}/{totalItems} items)
                </span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden flex">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
              <div
                className="h-full bg-tertiary-fixed-dim transition-all duration-500"
                style={{ width: `${inProgressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Tiles Grid (4-Across) */}
      <div className="ku-ledger grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 px-6 py-4 bg-surface-container-low/40">
        {/* KPI 1: Total Workload */}
        <div className="bg-white p-3.5 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-outline text-[12px] font-mono">
              Total Workload
            </span>
            <CheckCircle2 className="h-4 w-4 text-outline" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-on-surface leading-none">{totalItems}</span>
            <span className="text-xs text-on-surface-variant">items</span>
            {totalPts > 0 && (
              <span className="font-mono text-xs text-outline ml-auto">{totalPts} pts</span>
            )}
          </div>
          <div className="mt-2.5 pt-2 flex items-center justify-between text-[12px] border-t border-outline-variant text-outline">
            <span className="text-primary font-medium">100% In Scope</span>
            <span className="font-mono">{uniqueAssignees} assignees</span>
          </div>
        </div>

        {/* KPI 2: Completed */}
        <div className="bg-white p-3.5 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-outline text-[12px] font-mono">
              Completed
            </span>
            <span className="h-2 w-2 rounded-full bg-st-green-ink" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 leading-none">
              {completedItems.length}
            </span>
            <span className="text-xs text-on-surface-variant">items</span>
            <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 ml-auto">
              {completionPct}%
            </span>
          </div>
          <div className="mt-2.5 pt-2 flex items-center justify-between text-[12px] border-t border-outline-variant text-outline">
            <span className="text-emerald-800 font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {donePts} pts finished
            </span>
            <span className="font-mono text-emerald-800">On Track</span>
          </div>
        </div>

        {/* KPI 3: In Progress */}
        <div className="bg-white p-3.5 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-outline text-[12px] font-mono">
              In Progress
            </span>
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary leading-none">
              {inProgressItems.length}
            </span>
            <span className="text-xs text-on-surface-variant">items</span>
            <span className="font-mono text-xs text-primary bg-surface-container px-1.5 py-0.5 rounded ml-auto">
              {inProgressPct}%
            </span>
          </div>
          <div className="mt-2.5 pt-2 flex items-center justify-between text-[12px] border-t border-outline-variant text-outline">
            <span className="text-primary font-medium flex items-center gap-1">
              <Hourglass className="h-3 w-3" /> {inProgressPts} pts active
            </span>
            <span className="font-mono">{inProgressItems.length} active</span>
          </div>
        </div>

        {/* KPI 4: Pending / Todo */}
        <div className="bg-white p-3.5 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-outline text-[12px] font-mono">
              Pending / Todo
            </span>
            <span className="h-2 w-2 rounded-full bg-outline" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-on-surface leading-none">
              {pendingItems.length}
            </span>
            <span className="text-xs text-on-surface-variant">items</span>
            {overdueCount > 0 && (
              <span className="font-mono text-xs text-strand-red bg-red-50 px-1.5 py-0.5 rounded border border-red-200 ml-auto flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {overdueCount} Overdue
              </span>
            )}
          </div>
          <div className="mt-2.5 pt-2 flex items-center justify-between text-[12px] border-t border-outline-variant text-outline">
            <span>{totalPts - donePts - inProgressPts} pts remaining</span>
            <span className="font-mono">{remaining >= 0 ? `${remaining} days` : 'Past due'}</span>
          </div>
        </div>
      </div>

      {/* Burndown Chart Collapsible Section */}
      <div className="border-t border-outline-variant px-6 py-2">
        <button
          type="button"
          onClick={() => setChartOpen((prev) => !prev)}
          className="flex w-full items-center justify-between py-1 text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
              Cycle Burndown Chart
            </span>
            <span className="font-mono text-[12px] text-outline">
              Ideal vs Actual completion model
            </span>
          </div>
          <div className="flex items-center gap-1 text-outline text-xs">
            <span>{chartOpen ? 'Collapse' : 'Expand'}</span>
            {chartOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        </button>

        {chartOpen && (
          <div className="py-3">
            <Burndown data={cycleBurndown(state, cycle.id)} height={160} />
          </div>
        )}
      </div>
    </div>
  );

  return <WorkItemsView scope={{ projectId: id, cycleId }} banner={banner} />;
};
