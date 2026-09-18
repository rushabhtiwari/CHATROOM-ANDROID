/**
 * Every derived figure in the module.
 *
 * Nothing here is stored. Progress, overdue counts, hours, cost, cycle burndown
 * and the "not updated since Friday" freshness flag are all computed from work
 * items on demand — which is the whole reason the old project pages could show
 * the same hardcoded cost curve on every project without anyone noticing.
 *
 * All functions are pure and take state as their first argument, so they can be
 * called from a component, a hook or a test without a provider.
 */

import {
  differenceInCalendarDays,
  eachDayOfInterval,
  isAfter,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns';
import {
  BLENDED_HOURLY_RATE_INR,
  PRIORITY_META,
  UNGROUPED_ID,
  isDoneGroup,
  priorityWeight,
  stateGroupOrder,
} from './constants';
import { personById } from './people';
import type {
  Activity,
  Comment,
  Cycle,
  GroupByField,
  Label,
  Module,
  OrderByField,
  Project,
  ProjectsState,
  State,
  TimeEntry,
  WorkItem,
  WorkItemFilters,
  WorkItemGroup,
} from './types';

/* ------------------------------------------------------------------ */
/* Collection access                                                   */
/* ------------------------------------------------------------------ */

const listOf = <T,>(collection: { byId: Record<string, T>; allIds: string[] }): T[] =>
  collection.allIds.map((id) => collection.byId[id]).filter(Boolean);

export const allProjects = (state: ProjectsState): Project[] => listOf(state.projects);

export const projectById = (state: ProjectsState, id: string): Project | undefined =>
  state.projects.byId[id];

export const workItemById = (state: ProjectsState, id: string): WorkItem | undefined =>
  state.workItems.byId[id];

export const stateById = (state: ProjectsState, id: string): State | undefined =>
  state.states.byId[id];

export const labelById = (state: ProjectsState, id: string): Label | undefined =>
  state.labels.byId[id];

export const cycleById = (state: ProjectsState, id: string): Cycle | undefined =>
  state.cycles.byId[id];

export const moduleById = (state: ProjectsState, id: string): Module | undefined =>
  state.modules.byId[id];

/** A project's states, ordered by group then by their own order field. */
export function statesForProject(state: ProjectsState, projectId: string): State[] {
  return listOf(state.states)
    .filter((s) => s.projectId === projectId)
    .sort((a, b) =>
      stateGroupOrder(a.group) === stateGroupOrder(b.group)
        ? a.order - b.order
        : stateGroupOrder(a.group) - stateGroupOrder(b.group),
    );
}

export function labelsForProject(state: ProjectsState, projectId: string): Label[] {
  return listOf(state.labels)
    .filter((l) => l.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A project's cycles, earliest first. */
export function cyclesForProject(state: ProjectsState, projectId: string): Cycle[] {
  return listOf(state.cycles)
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function modulesForProject(state: ProjectsState, projectId: string): Module[] {
  return listOf(state.modules)
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function workItemsForProject(state: ProjectsState, projectId: string): WorkItem[] {
  return listOf(state.workItems).filter((item) => item.projectId === projectId);
}

/** Top-level items only — sub-items render nested under their parent. */
export function rootWorkItems(state: ProjectsState, projectId: string): WorkItem[] {
  return workItemsForProject(state, projectId).filter((item) => item.parentId === null);
}

export function subItemsOf(state: ProjectsState, parentId: string): WorkItem[] {
  return listOf(state.workItems)
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

export function commentsFor(state: ProjectsState, workItemId: string): Comment[] {
  return listOf(state.comments)
    .filter((c) => c.workItemId === workItemId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** An item's history, newest first — the order the detail panel reads it in. */
export function activityFor(state: ProjectsState, workItemId: string): Activity[] {
  return listOf(state.activity)
    .filter((a) => a.workItemId === workItemId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function timeEntriesFor(state: ProjectsState, workItemId: string): TimeEntry[] {
  return listOf(state.timeEntries)
    .filter((t) => t.workItemId === workItemId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function timeEntriesForProject(
  state: ProjectsState,
  projectId: string,
): TimeEntry[] {
  const itemIds = new Set(workItemsForProject(state, projectId).map((item) => item.id));
  return listOf(state.timeEntries).filter((entry) => itemIds.has(entry.workItemId));
}

/* ------------------------------------------------------------------ */
/* Item helpers                                                        */
/* ------------------------------------------------------------------ */

/** "SAP-42". The only place item ids are composed for display. */
export function displayId(state: ProjectsState, item: WorkItem): string {
  const project = state.projects.byId[item.projectId];
  return `${project?.key ?? '??'}-${item.sequence}`;
}

export function groupOfItem(state: ProjectsState, item: WorkItem) {
  return state.states.byId[item.stateId]?.group ?? 'backlog';
}

export const isDone = (state: ProjectsState, item: WorkItem): boolean =>
  isDoneGroup(groupOfItem(state, item));

/**
 * Whether an item is past its due date and not yet finished.
 *
 * Cancelled items are not overdue — nobody is waiting on them.
 */
export function isOverdue(state: ProjectsState, item: WorkItem, today = new Date()): boolean {
  if (!item.dueDate) return false;
  const group = groupOfItem(state, item);
  if (group === 'completed' || group === 'cancelled') return false;
  return isBefore(parseISO(item.dueDate), startOfDay(today));
}

/** Days until due — negative when overdue, null when there is no due date. */
export function daysUntilDue(item: WorkItem, today = new Date()): number | null {
  if (!item.dueDate) return null;
  return differenceInCalendarDays(parseISO(item.dueDate), startOfDay(today));
}

/* ------------------------------------------------------------------ */
/* Rollups                                                             */
/* ------------------------------------------------------------------ */

export interface ProjectRollup {
  total: number;
  done: number;
  started: number;
  /** Not yet picked up but scheduled. */
  unstarted: number;
  /** Not yet scheduled at all. */
  backlog: number;
  cancelled: number;
  overdue: number;
  /** 0–100, completed items over items that were not cancelled. */
  progressPct: number;
  hoursSpent: number;
  costToDate: number;
  estimatePoints: number;
  donePoints: number;
  /** ISO timestamp of the most recent change to any item, or null. */
  lastActivityAt: string | null;
}

/**
 * Every headline figure for one project, in a single pass over its items.
 *
 * Progress excludes cancelled work from the denominator: a project that
 * cancelled half its scope has not thereby become 50% complete.
 */
export function projectRollup(
  state: ProjectsState,
  projectId: string,
  today = new Date(),
): ProjectRollup {
  const items = workItemsForProject(state, projectId);

  let done = 0;
  let started = 0;
  let unstarted = 0;
  let backlog = 0;
  let cancelled = 0;
  let overdue = 0;
  let estimatePoints = 0;
  let donePoints = 0;
  let lastActivityAt: string | null = null;

  for (const item of items) {
    const group = groupOfItem(state, item);
    if (group === 'completed') done += 1;
    else if (group === 'started') started += 1;
    else if (group === 'cancelled') cancelled += 1;
    else if (group === 'unstarted') unstarted += 1;
    else backlog += 1;

    if (isOverdue(state, item, today)) overdue += 1;

    if (item.estimate !== null && group !== 'cancelled') {
      estimatePoints += item.estimate;
      if (group === 'completed') donePoints += item.estimate;
    }

    if (!lastActivityAt || item.updatedAt > lastActivityAt) {
      lastActivityAt = item.updatedAt;
    }
  }

  const hoursSpent = timeEntriesForProject(state, projectId).reduce(
    (sum, entry) => sum + entry.hours,
    0,
  );

  const counted = items.length - cancelled;

  return {
    total: items.length,
    done,
    started,
    unstarted,
    backlog,
    cancelled,
    overdue,
    progressPct: counted === 0 ? 0 : Math.round((done / counted) * 100),
    hoursSpent,
    costToDate: Math.round(hoursSpent * BLENDED_HOURLY_RATE_INR),
    estimatePoints,
    donePoints,
    lastActivityAt,
  };
}

/**
 * The "not updated since Friday" flag the old project pages carried.
 *
 * Kiran's week closes Friday noon, so a project nobody has touched since the
 * previous close is stale. Derived from real item timestamps rather than the
 * hand-set `isFresh` boolean the old mock used.
 */
export function isStale(
  state: ProjectsState,
  projectId: string,
  today = new Date(),
): boolean {
  const { lastActivityAt } = projectRollup(state, projectId, today);
  if (!lastActivityAt) return true;
  return differenceInCalendarDays(startOfDay(today), parseISO(lastActivityAt)) >= 7;
}

export interface ModuleRollup {
  total: number;
  done: number;
  progressPct: number;
}

export function moduleRollup(state: ProjectsState, moduleId: string): ModuleRollup {
  const items = listOf(state.workItems).filter((item) => item.moduleId === moduleId);
  const cancelled = items.filter((item) => groupOfItem(state, item) === 'cancelled').length;
  const done = items.filter((item) => groupOfItem(state, item) === 'completed').length;
  const counted = items.length - cancelled;
  return {
    total: items.length,
    done,
    progressPct: counted === 0 ? 0 : Math.round((done / counted) * 100),
  };
}

/* ------------------------------------------------------------------ */
/* Cycles                                                              */
/* ------------------------------------------------------------------ */

export type CyclePhase = 'completed' | 'active' | 'upcoming';

export function cyclePhase(cycle: Cycle, today = new Date()): CyclePhase {
  const now = startOfDay(today);
  if (isBefore(parseISO(cycle.endDate), now)) return 'completed';
  if (isAfter(parseISO(cycle.startDate), now)) return 'upcoming';
  return 'active';
}

/** The one cycle in progress on a project, if there is one. */
export function activeCycle(
  state: ProjectsState,
  projectId: string,
  today = new Date(),
): Cycle | undefined {
  return cyclesForProject(state, projectId).find(
    (cycle) => cyclePhase(cycle, today) === 'active',
  );
}

export interface BurndownPoint {
  /** ISO day. */
  date: string;
  /** Points that would remain if the cycle burned down evenly. */
  ideal: number;
  /** Points actually remaining, or null for days after today. */
  actual: number | null;
}

/**
 * A cycle's burndown, one point per day from start to end.
 *
 * "Remaining" is total scope minus the points completed on or before that day,
 * read from each item's `updatedAt`. That is a demo-grade approximation: it uses
 * the item's last change rather than the moment it entered a completed state,
 * so re-editing a finished item would move its completion day. Recording a
 * `completedAt` on the state transition is the correct fix and is not worth the
 * reducer complexity here.
 *
 * The line stops at today rather than running flat to the cycle's end, so an
 * active sprint does not read as though it stalled.
 */
export function cycleBurndown(
  state: ProjectsState,
  cycleId: string,
  today = new Date(),
): BurndownPoint[] {
  const cycle = state.cycles.byId[cycleId];
  if (!cycle) return [];

  const items = listOf(state.workItems).filter(
    (item) => item.cycleId === cycleId && groupOfItem(state, item) !== 'cancelled',
  );

  const totalPoints = items.reduce((sum, item) => sum + (item.estimate ?? 0), 0);

  const days = eachDayOfInterval({
    start: parseISO(cycle.startDate),
    end: parseISO(cycle.endDate),
  });
  const lastIndex = days.length - 1;
  const now = startOfDay(today);

  return days.map((day, index) => {
    const iso = day.toISOString().slice(0, 10);
    const ideal =
      lastIndex === 0 ? 0 : Math.round(totalPoints * (1 - index / lastIndex) * 10) / 10;

    if (isAfter(day, now)) {
      return { date: iso, ideal, actual: null };
    }

    const burned = items
      .filter(
        (item) =>
          groupOfItem(state, item) === 'completed' && item.updatedAt.slice(0, 10) <= iso,
      )
      .reduce((sum, item) => sum + (item.estimate ?? 0), 0);

    return { date: iso, ideal, actual: totalPoints - burned };
  });
}

/* ------------------------------------------------------------------ */
/* Time and cost                                                       */
/* ------------------------------------------------------------------ */

export interface WeeklyHours {
  /** ISO day — the Monday the week opens on. */
  weekStart: string;
  hours: number;
  cost: number;
}

/** Logged hours and derived cost per week, oldest first. */
export function weeklyHoursForProject(
  state: ProjectsState,
  projectId: string,
): WeeklyHours[] {
  const buckets = new Map<string, number>();

  for (const entry of timeEntriesForProject(state, projectId)) {
    const date = parseISO(entry.date);
    // Monday-anchored week key. getDay() is 0 on Sunday, which belongs to the
    // week that opened six days earlier.
    const dayOfWeek = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - dayOfWeek);
    const key = monday.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + entry.hours);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, hours]) => ({
      weekStart,
      hours: Math.round(hours * 10) / 10,
      cost: Math.round(hours * BLENDED_HOURLY_RATE_INR),
    }));
}

export interface MemberLoad {
  personId: string;
  assigned: number;
  done: number;
  overdue: number;
  hours: number;
}

/** Per-member workload for a project, for the members table. */
export function memberLoad(
  state: ProjectsState,
  projectId: string,
  today = new Date(),
): MemberLoad[] {
  const project = state.projects.byId[projectId];
  if (!project) return [];

  const items = workItemsForProject(state, projectId);
  const entries = timeEntriesForProject(state, projectId);

  return project.memberIds.map((personId) => {
    const assignedItems = items.filter((item) => item.assigneeIds.includes(personId));
    return {
      personId,
      assigned: assignedItems.length,
      done: assignedItems.filter((item) => groupOfItem(state, item) === 'completed').length,
      overdue: assignedItems.filter((item) => isOverdue(state, item, today)).length,
      hours:
        Math.round(
          entries
            .filter((entry) => entry.userId === personId)
            .reduce((sum, entry) => sum + entry.hours, 0) * 10,
        ) / 10,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

/**
 * Apply the active filters.
 *
 * Each field is AND-ed against the others and OR-ed within itself, which is
 * what a multi-select filter strip reads as: "state is Todo or In Progress, and
 * assignee is Anjali".
 */
export function filterWorkItems(
  state: ProjectsState,
  items: WorkItem[],
  filters: WorkItemFilters,
): WorkItem[] {
  const search = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.stateIds.length && !filters.stateIds.includes(item.stateId)) return false;
    if (filters.priorities.length && !filters.priorities.includes(item.priority)) return false;

    if (
      filters.assigneeIds.length &&
      !item.assigneeIds.some((id) => filters.assigneeIds.includes(id))
    ) {
      return false;
    }

    if (filters.labelIds.length && !item.labelIds.some((id) => filters.labelIds.includes(id))) {
      return false;
    }

    if (filters.cycleIds.length && (!item.cycleId || !filters.cycleIds.includes(item.cycleId))) {
      return false;
    }

    if (
      filters.moduleIds.length &&
      (!item.moduleId || !filters.moduleIds.includes(item.moduleId))
    ) {
      return false;
    }

    if (filters.dueFrom || filters.dueTo) {
      if (!item.dueDate) return false;
      if (filters.dueFrom && item.dueDate < filters.dueFrom) return false;
      if (filters.dueTo && item.dueDate > filters.dueTo) return false;
    }

    if (search) {
      const haystack = `${displayId(state, item)} ${item.title}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

/** Whether any filter is active — drives the "Clear all" chip. */
export function hasActiveFilters(filters: WorkItemFilters): boolean {
  return (
    filters.stateIds.length > 0 ||
    filters.priorities.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.cycleIds.length > 0 ||
    filters.moduleIds.length > 0 ||
    filters.dueFrom !== null ||
    filters.dueTo !== null ||
    filters.search.trim().length > 0
  );
}

/* ------------------------------------------------------------------ */
/* Ordering                                                            */
/* ------------------------------------------------------------------ */

/**
 * Sort within a group.
 *
 * Items with no value for the sort field sink to the bottom rather than
 * clustering at the top, which is what "no due date" should read as in a list
 * ordered by urgency.
 */
export function sortWorkItems(items: WorkItem[], orderBy: OrderByField): WorkItem[] {
  const sorted = [...items];

  switch (orderBy) {
    case 'priority':
      sorted.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
      break;
    case 'dueDate':
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      break;
    case 'createdAt':
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'updatedAt':
      sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      break;
    case 'estimate':
      sorted.sort((a, b) => {
        if (a.estimate === null && b.estimate === null) return 0;
        if (a.estimate === null) return 1;
        if (b.estimate === null) return -1;
        return b.estimate - a.estimate;
      });
      break;
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'manual':
    default:
      sorted.sort((a, b) => a.order - b.order);
      break;
  }

  return sorted;
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

/**
 * Split items into the groups the current `groupBy` produces.
 *
 * Every layout renders from this: list group headers, board columns, timeline
 * row bands. Empty groups are kept for state, priority and module so a board
 * shows its empty columns — you cannot drag a card into a column that is not
 * drawn.
 */
export function groupWorkItems(
  state: ProjectsState,
  projectId: string,
  items: WorkItem[],
  groupBy: GroupByField,
  orderBy: OrderByField,
): WorkItemGroup[] {
  const sorted = sortWorkItems(items, orderBy);

  if (groupBy === 'none') {
    return [{ id: UNGROUPED_ID, label: 'All work items', color: null, items: sorted }];
  }

  const groups = new Map<string, WorkItemGroup>();
  const push = (id: string, label: string, color: string | null, item?: WorkItem) => {
    if (!groups.has(id)) groups.set(id, { id, label, color, items: [] });
    if (item) groups.get(id)!.items.push(item);
  };

  // Seed the empty groups first so board columns exist before any card lands.
  if (groupBy === 'state') {
    for (const s of statesForProject(state, projectId)) push(s.id, s.name, s.color);
  } else if (groupBy === 'priority') {
    for (const p of Object.values(PRIORITY_META)) push(p.id, p.label, p.color);
  } else if (groupBy === 'module') {
    for (const m of modulesForProject(state, projectId)) push(m.id, m.name, null);
    push(UNGROUPED_ID, 'No module', null);
  } else if (groupBy === 'cycle') {
    for (const c of cyclesForProject(state, projectId)) push(c.id, c.name, null);
    push(UNGROUPED_ID, 'No cycle', null);
  } else if (groupBy === 'label') {
    for (const l of labelsForProject(state, projectId)) push(l.id, l.name, l.color);
    push(UNGROUPED_ID, 'No label', null);
  } else if (groupBy === 'assignee') {
    const project = state.projects.byId[projectId];
    for (const id of project?.memberIds ?? []) {
      const person = personById(id);
      if (person) push(id, person.name, person.color);
    }
    push(UNGROUPED_ID, 'Unassigned', null);
  }

  for (const item of sorted) {
    switch (groupBy) {
      case 'state': {
        const s = state.states.byId[item.stateId];
        push(item.stateId, s?.name ?? 'Unknown', s?.color ?? null, item);
        break;
      }
      case 'priority':
        push(item.priority, PRIORITY_META[item.priority].label, PRIORITY_META[item.priority].color, item);
        break;
      case 'assignee': {
        if (item.assigneeIds.length === 0) {
          push(UNGROUPED_ID, 'Unassigned', null, item);
        } else {
          // An item with two assignees appears under both, the way a shared
          // task actually sits on two people's plates.
          for (const id of item.assigneeIds) {
            const person = personById(id);
            push(id, person?.name ?? 'Unknown', person?.color ?? null, item);
          }
        }
        break;
      }
      case 'label': {
        if (item.labelIds.length === 0) {
          push(UNGROUPED_ID, 'No label', null, item);
        } else {
          for (const id of item.labelIds) {
            const label = state.labels.byId[id];
            push(id, label?.name ?? 'Unknown', label?.color ?? null, item);
          }
        }
        break;
      }
      case 'cycle': {
        const cycle = item.cycleId ? state.cycles.byId[item.cycleId] : undefined;
        push(cycle?.id ?? UNGROUPED_ID, cycle?.name ?? 'No cycle', null, item);
        break;
      }
      case 'module': {
        const mod = item.moduleId ? state.modules.byId[item.moduleId] : undefined;
        push(mod?.id ?? UNGROUPED_ID, mod?.name ?? 'No module', null, item);
        break;
      }
      case 'createdBy': {
        const person = personById(item.createdById);
        push(item.createdById, person?.name ?? 'Unknown', person?.color ?? null, item);
        break;
      }
      default:
        push(UNGROUPED_ID, 'All work items', null, item);
    }
  }

  const result = [...groups.values()];

  // Groups with no seeded order (assignee, created by) read best alphabetically,
  // with the "none" bucket pinned last wherever it appears.
  if (groupBy === 'assignee' || groupBy === 'createdBy') {
    result.sort((a, b) => {
      if (a.id === UNGROUPED_ID) return 1;
      if (b.id === UNGROUPED_ID) return -1;
      return a.label.localeCompare(b.label);
    });
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

/** Items due on a given ISO day. */
export function itemsOnDay(items: WorkItem[], iso: string): WorkItem[] {
  return items.filter((item) => item.dueDate === iso);
}

/**
 * Items the calendar cannot place.
 *
 * The calendar drops anything without a due date, so the count is surfaced in
 * the toolbar — silently hiding a third of the backlog is how a demo starts
 * lying.
 */
export const undatedCount = (items: WorkItem[]): number =>
  items.filter((item) => item.dueDate === null).length;

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export interface TimelineBar {
  item: WorkItem;
  /** ISO day. */
  start: string;
  /** ISO day. */
  end: string;
}

/**
 * Items that can be drawn as a Gantt bar.
 *
 * An item needs both ends of a range. One with only a due date is given a
 * single-day bar on that date rather than being dropped, so the timeline shows
 * deadlines as well as spans.
 */
export function timelineBars(items: WorkItem[]): TimelineBar[] {
  return items
    .map((item) => {
      if (item.startDate && item.dueDate) {
        return { item, start: item.startDate, end: item.dueDate };
      }
      if (item.dueDate) return { item, start: item.dueDate, end: item.dueDate };
      if (item.startDate) return { item, start: item.startDate, end: item.startDate };
      return null;
    })
    .filter((bar): bar is TimelineBar => bar !== null)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Whether an ISO day falls inside a cycle, for the cycle date axis. */
export function dayIsInCycle(cycle: Cycle, iso: string): boolean {
  return isWithinInterval(parseISO(iso), {
    start: parseISO(cycle.startDate),
    end: parseISO(cycle.endDate),
  });
}
