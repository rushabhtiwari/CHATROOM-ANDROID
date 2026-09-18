/**
 * The project management data model.
 *
 * This module is deliberately isolated from the rest of the console. The
 * reimbursement backend broadcasts its entire state to every open tab on each
 * mutation, which is a sound trade at a few dozen records and a bad one at the
 * thousands a project manager produces. So projects never reach the server:
 * everything here lives in one reducer and is persisted to localStorage.
 *
 * Dates are stored as ISO strings — '2026-09-18' for calendar days, full ISO
 * timestamps for moments — and formatted only at render time with date-fns.
 * Nothing in this file holds a display string.
 */

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/**
 * The five buckets every workflow state belongs to.
 *
 * States themselves are per-project *data* rather than a TypeScript enum — a
 * project can rename "In Review" or add one — but each maps to one of these
 * groups, which is what the board ordering, progress rollups and burndown are
 * computed from.
 */
export type StateGroup =
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'cancelled';

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

/** The five ways the same filtered set of work items can be rendered. */
export type LayoutKind = 'list' | 'board' | 'table' | 'calendar' | 'timeline';

/** Fields a set of work items can be grouped by in any layout. */
export type GroupByField =
  | 'state'
  | 'priority'
  | 'assignee'
  | 'label'
  | 'cycle'
  | 'module'
  | 'createdBy'
  | 'none';

/** Fields a set of work items can be ordered by within its group. */
export type OrderByField =
  | 'manual'
  | 'priority'
  | 'dueDate'
  | 'createdAt'
  | 'updatedAt'
  | 'estimate'
  | 'title';

export type ProjectStatus = 'planned' | 'active' | 'paused' | 'completed';

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

/**
 * The module's view of a person.
 *
 * Adapted in `people.ts` from `src/data/people.ts`, which is the directory the
 * old project pages were already built on and the only one that carries the
 * compliance figures Kiran cares about. Keeping the shape local means swapping
 * the source later is a one-file change.
 */
export interface ProjectPerson {
  id: string;
  name: string;
  /** Two letters, for avatars. */
  initials: string;
  department: string;
  role: string;
  /** Deterministic avatar colour, derived once so it never flickers. */
  color: string;
  /** Kiran's per-member standing score, carried through from the directory. */
  complianceScore: number;
  warningsCount: number;
}

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export interface Project {
  id: string;
  name: string;
  /** Short uppercase key. Work items read as `${key}-${sequence}` — "SAP-42". */
  key: string;
  description: string;
  leadId: string;
  memberIds: string[];
  departments: string[];
  /** ISO day. */
  startDate: string;
  /** ISO day. */
  targetDate: string;
  status: ProjectStatus;
  /** ISO timestamp. */
  createdAt: string;
  /** Next value for `WorkItem.sequence`; incremented on every create. */
  nextSequence: number;
}

export interface State {
  id: string;
  projectId: string;
  name: string;
  group: StateGroup;
  color: string;
  /** Position within the group. Board column order is group, then this. */
  order: number;
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface Cycle {
  id: string;
  projectId: string;
  name: string;
  description: string;
  /** ISO day. */
  startDate: string;
  /** ISO day. */
  endDate: string;
}

export interface Module {
  id: string;
  projectId: string;
  name: string;
  description: string;
  leadId: string | null;
  /** ISO day. */
  targetDate: string | null;
}

export interface WorkItem {
  id: string;
  projectId: string;
  /** Displayed as `${project.key}-${sequence}`. */
  sequence: number;
  title: string;
  /** Markdown. */
  description: string;
  stateId: string;
  priority: Priority;
  assigneeIds: string[];
  labelIds: string[];
  /** ISO day, or null. */
  startDate: string | null;
  /** ISO day, or null. */
  dueDate: string | null;
  /** Story points on the scale in `constants.ts`. Null means unestimated. */
  estimate: number | null;
  /**
   * Parent work item, or null.
   *
   * One level only: the reducer refuses a parent that itself has a parent, so
   * List nesting stays a single flatten pass and the other four layouts never
   * have to answer "where does a grandchild render".
   */
  parentId: string | null;
  cycleId: string | null;
  moduleId: string | null;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. Bumped by every property change. */
  updatedAt: string;
  createdById: string;
  /** Position within its group under manual ordering. */
  order: number;
}

export interface Comment {
  id: string;
  workItemId: string;
  authorId: string;
  /** Markdown. */
  body: string;
  /** ISO timestamp. */
  createdAt: string;
}

/**
 * One recorded change to a work item.
 *
 * Written by the store on every property change rather than by callers, so a
 * mutation cannot forget to leave a trace. `field` is 'created' for the entry
 * that opens an item's history.
 */
export interface Activity {
  id: string;
  workItemId: string;
  actorId: string;
  field: string;
  from: string | null;
  to: string | null;
  /** ISO timestamp. */
  at: string;
}

export interface TimeEntry {
  id: string;
  workItemId: string;
  userId: string;
  /** ISO day. */
  date: string;
  hours: number;
  note: string;
}

/**
 * One archived weekly report.
 *
 * Carried over from the old project pages, where the archive was a real part of
 * the Kiran story. Unlike the old version these are generated from work items
 * at render time rather than pointing at a dead '#' URL.
 */
export interface WeeklyReport {
  id: string;
  projectId: string;
  /** ISO day — the Monday the week opens on. Labels are formatted at render. */
  weekStart: string;
  /** ISO timestamp. */
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Store shape                                                         */
/* ------------------------------------------------------------------ */

/**
 * Records are held in id-keyed maps with a parallel id array for order, so a
 * property edit touches one key instead of walking an array of ninety items.
 */
export interface Collection<T> {
  byId: Record<string, T>;
  allIds: string[];
}

export interface ProjectsState {
  /** Bumped in `constants.ts` when the seed changes shape; triggers a reload. */
  seedVersion: number;
  projects: Collection<Project>;
  states: Collection<State>;
  labels: Collection<Label>;
  cycles: Collection<Cycle>;
  modules: Collection<Module>;
  workItems: Collection<WorkItem>;
  comments: Collection<Comment>;
  activity: Collection<Activity>;
  timeEntries: Collection<TimeEntry>;
  weeklyReports: Collection<WeeklyReport>;
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

/**
 * The active filter set. Every field is a list of ids; an empty list means the
 * filter is off, which keeps "no filter" and "matches nothing" distinct.
 */
export interface WorkItemFilters {
  stateIds: string[];
  priorities: Priority[];
  assigneeIds: string[];
  labelIds: string[];
  cycleIds: string[];
  moduleIds: string[];
  /** ISO day, inclusive. */
  dueFrom: string | null;
  /** ISO day, inclusive. */
  dueTo: string | null;
  /** Free-text match against title and item id. */
  search: string;
}

export const EMPTY_FILTERS: WorkItemFilters = {
  stateIds: [],
  priorities: [],
  assigneeIds: [],
  labelIds: [],
  cycleIds: [],
  moduleIds: [],
  dueFrom: null,
  dueTo: null,
  search: '',
};

/** One group of work items as produced by `groupWorkItems`. */
export interface WorkItemGroup {
  /** Group key — a state id, a priority, a person id, or '__none__'. */
  id: string;
  label: string;
  /** Dot colour for the group header, where the field has one. */
  color: string | null;
  items: WorkItem[];
}
