/**
 * `/projects` — the project grid.
 *
 * One card per project: name, key, lead, member avatars, a progress ring
 * computed from real state groups, and the active cycle. Every figure here is
 * derived at render time, which is the difference between this and the page it
 * replaces — that one showed a hand-written `progressPct` and the same cost
 * curve on all three projects.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  FolderKanban,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { formatINR } from '@/utils/formatters';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import {
  activeCycle,
  allProjects,
  isStale,
  modulesForProject,
  projectRollup,
  workItemsForProject,
} from '@/modules/projects/selectors';
import { AvatarStack, ProgressRing } from '@/components/projects/Glyphs';

export const ProjectsGrid: React.FC = () => {
  const navigate = useNavigate();
  const { state, resetDemoData } = useProjects();
  const rawProjects = allProjects(state);

  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'templates'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [leadFilter, setLeadFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'on-track' | 'at-risk' | 'stale'>('all');

  const totalOverdue = rawProjects.reduce(
    (sum, project) => sum + projectRollup(state, project.id).overdue,
    0,
  );

  // Filtered projects
  const projects = useMemo(() => {
    return rawProjects.filter((project) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          project.name.toLowerCase().includes(q) ||
          project.key.toLowerCase().includes(q) ||
          project.description.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (leadFilter !== 'all' && project.leadId !== leadFilter) return false;

      const rollup = projectRollup(state, project.id);
      const stale = isStale(state, project.id);
      if (healthFilter === 'stale' && !stale) return false;
      if (healthFilter === 'at-risk' && (rollup.overdue === 0 || stale)) return false;
      if (healthFilter === 'on-track' && (rollup.overdue > 0 || stale)) return false;

      return true;
    });
  }, [rawProjects, searchQuery, leadFilter, healthFilter, state]);

  return (
    <div className="flex min-h-full flex-col bg-surface-container-low/30 text-on-surface">
      {/* Sticky Top Control Bar */}
      <div className="sticky top-0 z-20 border-b border-outline-variant bg-surface-container-lowest px-6 py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              <h1 className="text-base font-semibold text-on-surface">Projects</h1>
              <span className="rounded-full bg-surface-container-low px-2 py-0.5 font-mono text-[12px] font-semibold text-primary">
                {rawProjects.length} active
              </span>
            </div>

            <div className="hidden h-4 w-px bg-outline-variant sm:block" />

            {/* Segmented status tabs */}
            <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-low p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                  activeTab === 'active'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>Active</span>
                <span className="font-mono text-[12px] opacity-70">{rawProjects.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('archived')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                  activeTab === 'archived'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>Archived</span>
                <span className="font-mono text-[12px] opacity-50">0</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                  activeTab === 'templates'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Templates
              </button>
            </div>
          </div>

          {/* Search and Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-outline" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-48 rounded-lg border border-outline-variant bg-surface-container-low pl-8 pr-8 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:bg-surface-container-lowest focus:outline-none"
              />
              <kbd className="absolute right-1.5 rounded border border-outline-variant bg-surface-container-lowest px-1 font-mono text-[12px] text-on-surface-variant">
                /
              </kbd>
            </div>

            <button
              type="button"
              onClick={() => {
                resetDemoData();
                toast.success('Demo data reset', {
                  description: 'Every project, work item and time entry is back to the seed.',
                });
              }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
              title="Reset project demo data"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset Seed</span>
            </button>
          </div>
        </div>

        {/* Quick Filters Strip */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant pt-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-outline text-[12px]">Quick filters:</span>

            {/* Health Filter */}
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value as typeof healthFilter)}
              className="h-6 rounded border border-outline-variant bg-surface-container-lowest px-2 text-[12px] font-medium text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="all">Health: All</option>
              <option value="on-track">Health: On Track</option>
              <option value="at-risk">Health: At Risk</option>
              <option value="stale">Health: Stale</option>
            </select>

            <span className="inline-flex h-6 items-center gap-1 rounded border border-outline-variant bg-surface-container-lowest px-2 text-[12px] font-medium text-on-surface-variant">
              <span>Plant:</span>
              <span className="font-semibold text-on-surface">Plant 2 (Pune/BLR)</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-[12px] text-outline">
            <SlidersHorizontal className="h-3 w-3" />
            <span>Sort:</span>
            <span className="font-medium text-on-surface">Target Date · Asc</span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] p-6 space-y-6">
        {/* Weekly Lock Warning (Kiran Rule) */}
        {totalOverdue > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 shadow-xs">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="font-bold">
                  Update task logs before Friday 12:00 PM — the operational week closes automatically
                </div>
                <p className="mt-0.5 text-[12px] text-amber-800">
                  Unlogged work orders and task hours affect plant performance and standing scorecards.
                </p>
              </div>
            </div>
            <span className="rounded border border-amber-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-amber-900">
              {totalOverdue} overdue
            </span>
          </div>
        )}

        {/* Project Cards Grid (3 Columns) */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const rollup = projectRollup(state, project.id);
            const cycle = activeCycle(state, project.id);
            const modules = modulesForProject(state, project.id);
            const lead = personById(project.leadId);
            const members = project.memberIds
              .map((id) => personById(id))
              .filter((person): person is NonNullable<typeof person> => Boolean(person));
            const stale = isStale(state, project.id);

            const isAtRisk = rollup.overdue > 0;

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/projects/${project.id}/items`)}
                className="group flex flex-col justify-between overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest text-left shadow-xs transition-all duration-200 hover:border-primary hover:shadow-md cursor-pointer"
              >
                <div className="p-4 space-y-3 flex-1">
                  {/* Card Header: Key and Health Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-xs font-bold text-primary">
                        {project.key}
                      </span>
                      <span className="font-mono text-[12px] text-outline">
                        PRJ-{project.id.slice(0, 4).toUpperCase()}
                      </span>
                    </div>

                    {stale ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[12px] font-bold text-strand-red">
                        <AlertTriangle className="h-3 w-3" />
                        Stale
                      </span>
                    ) : isAtRisk ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        At Risk
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[12px] font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-st-green-ink animate-pulse" />
                        On Track
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h2 className="text-[15px] font-semibold leading-snug text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                      {project.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">
                      {project.description}
                    </p>
                  </div>

                  {/* Progress Ring & Target Date & Lead */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0 flex items-center justify-center">
                        <ProgressRing value={rollup.progressPct} size={42} stroke={4} />
                        <span className="absolute font-mono text-[12px] font-bold text-on-surface">
                          {rollup.progressPct}%
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] text-outline">Target Date</span>
                        <span className="text-xs font-semibold text-on-surface">
                          {format(parseISO(project.targetDate), 'd MMM yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[12px] text-outline">Lead & Members</span>
                      <AvatarStack people={members} max={3} />
                    </div>
                  </div>
                </div>

                {/* Bottom Metric Strip */}
                <div className="grid grid-cols-3 gap-2 border-t border-outline-variant bg-surface-container-low px-4 py-2.5 text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] text-outline truncate">Open Tasks</span>
                    <span className="flex items-center gap-1 font-semibold text-on-surface truncate">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {rollup.total - rollup.done - rollup.cancelled}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] text-outline truncate">Modules</span>
                    <span className="font-semibold text-on-surface truncate">
                      {modules.length} active
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] text-outline truncate">Active Sprint</span>
                    <span className="font-semibold text-on-surface truncate text-primary">
                      {cycle ? cycle.name : 'Backlog'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
