/**
 * Fixed vocabulary for the project module: state groups, priorities, the
 * grouping and ordering options, and the colours each is drawn in.
 *
 * Colours here are deliberately literal hex rather than Tailwind tokens. The
 * module renders state dots, priority glyphs and label chips as inline SVG and
 * inline styles, which cannot read a class name, and Plane's look is mostly
 * neutral greys with colour reserved for exactly these three things.
 */

import type {
  GroupByField,
  LayoutKind,
  OrderByField,
  Priority,
  StateGroup,
} from './types';

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

/** Single localStorage key for the whole module. */
export const STORAGE_KEY = 'kiranos.projects.v1';

/** Per-project layout choice is remembered separately from the data. */
export const LAYOUT_STORAGE_KEY = 'kiranos.projects.layout.v2';

/**
 * Bump this when `seed.ts` changes shape.
 *
 * On mount the store compares it against the persisted value and reloads the
 * seed when they differ, so a stored snapshot from an older model never
 * half-renders against new code.
 */
export const SEED_VERSION = 2;

/** Debounce on the localStorage write. */
export const PERSIST_DEBOUNCE_MS = 300;

/* ------------------------------------------------------------------ */
/* State groups                                                        */
/* ------------------------------------------------------------------ */

export interface StateGroupMeta {
  id: StateGroup;
  label: string;
  color: string;
  /** Board column and group-header order. */
  order: number;
}

/**
 * The five groups, in the order they appear as board columns and list groups.
 * Every per-project state maps to one of these.
 */
export const STATE_GROUPS: StateGroupMeta[] = [
  { id: 'backlog', label: 'Backlog', color: '#8B97A8', order: 0 },
  { id: 'unstarted', label: 'Todo', color: '#4A5A70', order: 1 },
  { id: 'started', label: 'In Progress', color: '#E9991B', order: 2 },
  { id: 'completed', label: 'Done', color: '#018F3D', order: 3 },
  { id: 'cancelled', label: 'Cancelled', color: '#B5070E', order: 4 },
];

export const STATE_GROUP_META: Record<StateGroup, StateGroupMeta> =
  STATE_GROUPS.reduce(
    (acc, group) => ({ ...acc, [group.id]: group }),
    {} as Record<StateGroup, StateGroupMeta>,
  );

/** Group ordinal, used to sort states and board columns. */
export const stateGroupOrder = (group: StateGroup): number =>
  STATE_GROUP_META[group].order;

/** The two groups that count as finished for progress and burndown. */
export const CLOSED_GROUPS: StateGroup[] = ['completed', 'cancelled'];

/** Only 'completed' counts toward progress — cancelled work was not done. */
export const isDoneGroup = (group: StateGroup): boolean => group === 'completed';

/* ------------------------------------------------------------------ */
/* Priority                                                            */
/* ------------------------------------------------------------------ */

export interface PriorityMeta {
  id: Priority;
  label: string;
  color: string;
  /** Ascending sort weight — urgent first. */
  weight: number;
  /** Filled signal bars, 0–3. Urgent is drawn as a filled square instead. */
  bars: number;
}

export const PRIORITIES: PriorityMeta[] = [
  { id: 'urgent', label: 'Urgent', color: '#B5070E', weight: 0, bars: 3 },
  { id: 'high', label: 'High', color: '#E9991B', weight: 1, bars: 3 },
  { id: 'medium', label: 'Medium', color: '#B98214', weight: 2, bars: 2 },
  { id: 'low', label: 'Low', color: '#4F86C6', weight: 3, bars: 1 },
  { id: 'none', label: 'None', color: '#94A3B8', weight: 4, bars: 0 },
];

export const PRIORITY_META: Record<Priority, PriorityMeta> = PRIORITIES.reduce(
  (acc, priority) => ({ ...acc, [priority.id]: priority }),
  {} as Record<Priority, PriorityMeta>,
);

export const priorityWeight = (priority: Priority): number =>
  PRIORITY_META[priority].weight;

/* ------------------------------------------------------------------ */
/* Estimates                                                           */
/* ------------------------------------------------------------------ */

/**
 * Story points, not hours.
 *
 * Time tracking is a separate axis — `TimeEntry` carries real logged hours — so
 * an hours-based estimate would make "8 estimated / 12 logged" ambiguous about
 * which number is the plan. Points keep the burndown independent of it.
 */
export const ESTIMATE_POINTS = [1, 2, 3, 5, 8, 13] as const;

/**
 * Rupees per hour, used to derive cost from logged time.
 *
 * A single blended rate rather than per-person rates: the directory carries no
 * salary data, and inventing fourteen of them would be fiction dressed as
 * precision. One rate is honest about being an approximation.
 */
export const BLENDED_HOURLY_RATE_INR = 1450;

/* ------------------------------------------------------------------ */
/* Layouts                                                             */
/* ------------------------------------------------------------------ */

export interface LayoutMeta {
  id: LayoutKind;
  label: string;
  /** Bound to number keys 1–5. */
  shortcut: string;
}

export const LAYOUTS: LayoutMeta[] = [
  { id: 'list', label: 'List', shortcut: '1' },
  { id: 'board', label: 'Board', shortcut: '2' },
  { id: 'calendar', label: 'Calendar', shortcut: '3' },
  { id: 'table', label: 'Table', shortcut: '4' },
  { id: 'timeline', label: 'Timeline', shortcut: '5' },
];

export const DEFAULT_LAYOUT: LayoutKind = 'list';

/* ------------------------------------------------------------------ */
/* Grouping and ordering                                               */
/* ------------------------------------------------------------------ */

export const GROUP_BY_OPTIONS: { id: GroupByField; label: string }[] = [
  { id: 'state', label: 'State' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'label', label: 'Label' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'module', label: 'Module' },
  { id: 'createdBy', label: 'Created by' },
  { id: 'none', label: 'None' },
];

export const ORDER_BY_OPTIONS: { id: OrderByField; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedAt', label: 'Last updated' },
  { id: 'estimate', label: 'Estimate' },
  { id: 'title', label: 'Title' },
];

export const DEFAULT_GROUP_BY: GroupByField = 'state';
export const DEFAULT_ORDER_BY: OrderByField = 'manual';

/**
 * Which properties are drawn on a row or card.
 *
 * Toggled from the Display dropdown; these are the defaults a fresh project
 * starts with.
 */
export interface DisplayProperties {
  itemId: boolean;
  state: boolean;
  priority: boolean;
  labels: boolean;
  startDate: boolean;
  dueDate: boolean;
  assignee: boolean;
  cycle: boolean;
  module: boolean;
  estimate: boolean;
  subItemCount: boolean;
}

/** Labels for the Display dropdown, in the order the pills render on a row. */
export const DISPLAY_PROPERTY_LABELS: Record<keyof DisplayProperties, string> = {
  itemId: 'Item ID',
  state: 'State',
  priority: 'Priority',
  labels: 'Labels',
  startDate: 'Start date',
  dueDate: 'Due date',
  assignee: 'Assignee',
  cycle: 'Cycle',
  module: 'Module',
  estimate: 'Estimate',
  subItemCount: 'Sub-item count',
};

export const DEFAULT_DISPLAY_PROPERTIES: DisplayProperties = {
  itemId: true,
  state: true,
  priority: true,
  labels: true,
  startDate: true,
  dueDate: true,
  assignee: true,
  cycle: true,
  module: false,
  estimate: false,
  subItemCount: true,
};

/** Group headers that are collapsed by default in the List layout. */
export const DEFAULT_COLLAPSED_GROUPS: StateGroup[] = ['cancelled'];

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

/**
 * Label chip colours. Muted rather than saturated, because a list of thirty
 * items with three chips each turns a bright palette into noise.
 */
export const LABEL_COLORS = [
  '#B5070E',
  '#E9991B',
  '#018F3D',
  '#00AEEF',
  '#5B46C8',
  '#06477F',
  '#8B5CF6',
  '#0D9488',
  '#BE5B0B',
  '#6E7F96',
];

/**
 * Avatar colours, assigned deterministically by hashing a person's id so the
 * same person is the same colour on every screen and across reloads.
 */
export const AVATAR_COLORS = [
  '#06477F',
  '#B5070E',
  '#018F3D',
  '#5B46C8',
  '#BE5B0B',
  '#0D9488',
  '#7C3AED',
  '#1D4A7C',
  '#9A3412',
  '#0F766E',
  '#4338CA',
  '#A16207',
];

/** Stable colour for a person, so avatars never flicker between renders. */
export function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Sentinel group key for items with no value for the grouping field. */
export const UNGROUPED_ID = '__none__';
