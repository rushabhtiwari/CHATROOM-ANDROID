/**
 * The frame every project screen sits in.
 *
 * One header row: breadcrumb on the left (Projects ▸ SAP ▸ Issues 42) and a
 * slot on the right that the work-item toolbar portals its controls into —
 * layout switcher, Filters, Display, Analytics, Add Issue. Keeping the crumb
 * and the controls on one row is what the reference screenshots do, and it is
 * what makes the module read as dense rather than stacked.
 *
 * The screen below is full-bleed: it owns its own scroll region and puts a peek
 * panel over itself, which a padded, page-scrolling container would break.
 */

import React, { createContext, useContext, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useProjects } from '@/modules/projects/store';
import { workItemsForProject } from '@/modules/projects/selectors';

/** The sub-pages a project offers, in rail order. */
const SECTIONS = [
  { segment: 'items', label: 'Issues' },
  { segment: 'cycles', label: 'Cycles' },
  { segment: 'modules', label: 'Modules' },
  { segment: 'reports', label: 'Reports' },
  { segment: 'settings', label: 'Settings' },
] as const;

/**
 * The header's right-hand slot. A screen that has toolbar controls renders
 * them into this element with a portal, so the controls keep their own state
 * while sitting in the shell's header row.
 */
const HeaderSlotContext = createContext<HTMLElement | null>(null);

export const useHeaderSlot = (): HTMLElement | null => useContext(HeaderSlotContext);

export const ProjectShell: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { state } = useProjects();
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  const project = id ? state.projects.byId[id] : undefined;

  // A stale bookmark or a project deleted mid-demo lands here. Redirecting to
  // the grid is better than an empty frame that looks broken.
  if (!project) return <Navigate to="/projects" replace />;

  const segments = location.pathname.split('/');
  const segment = segments[3] ?? 'items';
  const detailId = segments[4];
  const active = SECTIONS.find((section) => section.segment === segment);

  // The third crumb, for a cycle, module or item opened as a page.
  const detail =
    segment === 'cycles' && detailId
      ? state.cycles.byId[detailId]?.name
      : segment === 'modules' && detailId
        ? state.modules.byId[detailId]?.name
        : segment === 'items' && detailId
          ? `${project.key}-${state.workItems.byId[detailId]?.sequence ?? '?'}`
          : undefined;

  const itemCount = workItemsForProject(state, project.id).length;

  const crumb = 'text-[12.5px] font-medium text-slate-600 transition-colors hover:text-ink';

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line pl-4 pr-3">
        <Link to="/projects" className={crumb}>
          Projects
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
        <Link
          to={`/projects/${project.id}/items`}
          className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-kiran"
        >
          <span className="shrink-0 rounded border border-line bg-canvas px-1.5 font-mono text-[10.5px] font-bold text-kiran">
            {project.key}
          </span>
          <span className="max-w-[22rem] truncate text-[12.5px] font-semibold text-ink">
            {project.name}
          </span>
        </Link>
        {active && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            {detail ? (
              <Link to={`/projects/${project.id}/${segment}`} className={crumb}>
                {active.label}
              </Link>
            ) : (
              <span className="text-[12.5px] font-semibold text-ink">{active.label}</span>
            )}
            {segment === 'items' && !detail && (
              <span className="rounded-full bg-kiran-tint px-1.5 py-[1px] font-mono text-[10.5px] font-semibold text-kiran">
                {itemCount}
              </span>
            )}
          </>
        )}
        {detail && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            <span className="max-w-[18rem] truncate text-[12.5px] font-semibold text-ink">
              {detail}
            </span>
          </>
        )}

        {/* The toolbar portals into this. */}
        <div ref={setSlot} className="ml-auto flex shrink-0 items-center gap-2" />
      </div>

      <HeaderSlotContext.Provider value={slot}>
        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </HeaderSlotContext.Provider>
    </div>
  );
};
