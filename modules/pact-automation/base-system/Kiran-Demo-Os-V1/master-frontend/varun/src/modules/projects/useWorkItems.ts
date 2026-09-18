/**
 * The one hook every layout renders from.
 *
 * Plane's identity is that the same filtered set of work items renders five
 * ways and you switch between them instantly. That only holds if there is
 * exactly one place the set is computed — so List, Board, Table, Calendar and
 * Timeline all take their data from here, and none of them filters or groups
 * anything itself.
 *
 * View state — layout, filters, grouping, ordering, which properties show — is
 * held here too and persisted per project, so switching projects and coming
 * back finds the view as you left it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DISPLAY_PROPERTIES,
  DEFAULT_GROUP_BY,
  DEFAULT_LAYOUT,
  DEFAULT_ORDER_BY,
  LAYOUT_STORAGE_KEY,
} from './constants';
import type { DisplayProperties } from './constants';
import {
  filterWorkItems,
  groupWorkItems,
  hasActiveFilters,
  subItemsOf,
  undatedCount,
  workItemsForProject,
} from './selectors';
import { useProjects } from './store';
import { EMPTY_FILTERS } from './types';
import type {
  GroupByField,
  LayoutKind,
  OrderByField,
  WorkItem,
  WorkItemFilters,
  WorkItemGroup,
} from './types';

/* ------------------------------------------------------------------ */
/* Persisted view state                                                */
/* ------------------------------------------------------------------ */

interface ProjectView {
  layout: LayoutKind;
  groupBy: GroupByField;
  orderBy: OrderByField;
  display: DisplayProperties;
}

const DEFAULT_VIEW: ProjectView = {
  layout: DEFAULT_LAYOUT,
  groupBy: DEFAULT_GROUP_BY,
  orderBy: DEFAULT_ORDER_BY,
  display: DEFAULT_DISPLAY_PROPERTIES,
};

type ViewMap = Record<string, ProjectView>;

function readViews(): ViewMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}') as ViewMap;
  } catch {
    return {};
  }
}

function writeViews(views: ViewMap): void {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(views));
  } catch {
    // Storage disabled or full. The view still works for this session; it just
    // will not be remembered, which is the right thing to lose first.
  }
}

/* ------------------------------------------------------------------ */
/* Scope                                                               */
/* ------------------------------------------------------------------ */

/**
 * Which slice of a project's work is in view.
 *
 * The cycle and module screens reuse the same five layouts over a narrower set,
 * so scoping happens here rather than in a second hook.
 */
export interface WorkItemScope {
  projectId: string;
  cycleId?: string;
  moduleId?: string;
}

export interface UseWorkItemsResult {
  /** Grouped and sorted, ready to render. */
  groups: WorkItemGroup[];
  /** The filtered flat set, before grouping. */
  items: WorkItem[];
  /** Every item in scope, before filtering — for "3 of 34 shown". */
  totalInScope: number;
  /** Items the calendar cannot place, so they are never silently dropped. */
  undated: number;
  /** Sub-items of a given parent, filtered by the same predicate. */
  childrenOf: (parentId: string) => WorkItem[];

  layout: LayoutKind;
  setLayout: (layout: LayoutKind) => void;
  groupBy: GroupByField;
  setGroupBy: (field: GroupByField) => void;
  orderBy: OrderByField;
  setOrderBy: (field: OrderByField) => void;
  display: DisplayProperties;
  toggleDisplay: (key: keyof DisplayProperties) => void;

  filters: WorkItemFilters;
  setFilters: React.Dispatch<React.SetStateAction<WorkItemFilters>>;
  /** Add or remove one value from a multi-select filter. */
  toggleFilter: <K extends keyof WorkItemFilters>(
    key: K,
    value: WorkItemFilters[K] extends (infer V)[] ? V : never,
  ) => void;
  clearFilters: () => void;
  filtersActive: boolean;
}

export function useWorkItems(scope: WorkItemScope): UseWorkItemsResult {
  const { state } = useProjects();
  const { projectId, cycleId, moduleId } = scope;

  const [views, setViews] = useState<ViewMap>(readViews);
  const [filters, setFilters] = useState<WorkItemFilters>(EMPTY_FILTERS);

  // Filters are intentionally *not* persisted. A layout you chose is a
  // preference; a filter you left on three days ago is a trap — you come back,
  // see nine items out of ninety, and think data has gone missing.
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
  }, [projectId, cycleId, moduleId]);

  const view = views[projectId] ?? DEFAULT_VIEW;

  const patchView = useCallback(
    (patch: Partial<ProjectView>) => {
      setViews((prev) => {
        const next = {
          ...prev,
          [projectId]: { ...(prev[projectId] ?? DEFAULT_VIEW), ...patch },
        };
        writeViews(next);
        return next;
      });
    },
    [projectId],
  );

  const setLayout = useCallback((layout: LayoutKind) => patchView({ layout }), [patchView]);
  const setGroupBy = useCallback((groupBy: GroupByField) => patchView({ groupBy }), [patchView]);
  const setOrderBy = useCallback((orderBy: OrderByField) => patchView({ orderBy }), [patchView]);

  const toggleDisplay = useCallback(
    (key: keyof DisplayProperties) =>
      patchView({ display: { ...view.display, [key]: !view.display[key] } }),
    [patchView, view.display],
  );

  const toggleFilter = useCallback(
    <K extends keyof WorkItemFilters>(
      key: K,
      value: WorkItemFilters[K] extends (infer V)[] ? V : never,
    ) => {
      setFilters((prev) => {
        const current = prev[key];
        if (!Array.isArray(current)) return prev;
        const list = current as unknown[];
        const next = list.includes(value)
          ? list.filter((existing) => existing !== value)
          : [...list, value];
        return { ...prev, [key]: next } as WorkItemFilters;
      });
    },
    [],
  );

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /* ---------------- the set ---------------- */

  // Only top-level items are placed into groups. Sub-items are reached through
  // `childrenOf` so they render nested under their parent rather than appearing
  // twice — once in place and once as a row of their own.
  const scoped = useMemo(() => {
    let items = workItemsForProject(state, projectId);
    if (cycleId) items = items.filter((item) => item.cycleId === cycleId);
    if (moduleId) items = items.filter((item) => item.moduleId === moduleId);
    return items;
  }, [state, projectId, cycleId, moduleId]);

  const filtered = useMemo(
    () => filterWorkItems(state, scoped, filters),
    [state, scoped, filters],
  );

  const roots = useMemo(
    () => filtered.filter((item) => item.parentId === null),
    [filtered],
  );

  const groups = useMemo(
    () => groupWorkItems(state, projectId, roots, view.groupBy, view.orderBy),
    [state, projectId, roots, view.groupBy, view.orderBy],
  );

  /*
   * Sub-items are shown whenever their parent is shown, whether or not they
   * match the filters themselves.
   *
   * The alternative — hiding children that fail the filter — makes a parent
   * silently lose rows and reads as data loss. Showing the whole sub-tree of a
   * matched parent is what a reader expects.
   */
  const childrenOf = useCallback(
    (parentId: string) => subItemsOf(state, parentId),
    [state],
  );

  return {
    groups,
    items: filtered,
    totalInScope: scoped.length,
    undated: undatedCount(filtered),
    childrenOf,

    layout: view.layout,
    setLayout,
    groupBy: view.groupBy,
    setGroupBy,
    orderBy: view.orderBy,
    setOrderBy,
    display: view.display,
    toggleDisplay,

    filters,
    setFilters,
    toggleFilter,
    clearFilters,
    filtersActive: hasActiveFilters(filters),
  };
}
