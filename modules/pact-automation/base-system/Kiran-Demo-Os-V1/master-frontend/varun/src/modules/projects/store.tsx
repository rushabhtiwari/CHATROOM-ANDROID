/**
 * The project store.
 *
 * Unlike `src/modules/rts/store.tsx`, which posts every action to the Python
 * API and waits for the new state to arrive over an event stream, this module
 * is entirely local. The reasoning is in the brief and it is sound: the backend
 * broadcasts its whole state to every open tab on each mutation and rewrites
 * its snapshot file on each write, which is a good trade at a few dozen claims
 * and a bad one at the thousands of records a project manager produces.
 *
 * So: one reducer, every mutation an action, the whole thing persisted to
 * localStorage under a single key. No component holds authoritative state.
 *
 * Every property change appends an Activity entry from inside the reducer
 * rather than from the caller, so a mutation cannot forget to leave a trace.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import {
  PERSIST_DEBOUNCE_MS,
  SEED_VERSION,
  STORAGE_KEY,
} from './constants';
import { CURRENT_USER_ID } from './people';
import { buildSeed } from './seed';
import type {
  Activity,
  Collection,
  Comment,
  Cycle,
  Label,
  Module,
  Project,
  ProjectsState,
  State,
  TimeEntry,
  WorkItem,
} from './types';

/* ------------------------------------------------------------------ */
/* Collection helpers                                                  */
/* ------------------------------------------------------------------ */

function addTo<T extends { id: string }>(collection: Collection<T>, row: T): Collection<T> {
  return {
    byId: { ...collection.byId, [row.id]: row },
    allIds: collection.allIds.includes(row.id)
      ? collection.allIds
      : [...collection.allIds, row.id],
  };
}

// `NoInfer` on the patch keeps T pinned to the collection's element type.
// Without it a narrow patch — `Partial<Omit<State, 'id' | 'projectId'>>` —
// drags inference down to the `{ id: string }` constraint and the call fails.
function patchIn<T extends { id: string }>(
  collection: Collection<T>,
  id: string,
  patch: Partial<NoInfer<T>>,
): Collection<T> {
  const existing = collection.byId[id];
  if (!existing) return collection;
  return {
    ...collection,
    byId: { ...collection.byId, [id]: { ...existing, ...patch } },
  };
}

function removeFrom<T extends { id: string }>(
  collection: Collection<T>,
  id: string,
): Collection<T> {
  if (!collection.byId[id]) return collection;
  const byId = { ...collection.byId };
  delete byId[id];
  return { byId, allIds: collection.allIds.filter((existing) => existing !== id) };
}

function removeWhere<T extends { id: string }>(
  collection: Collection<T>,
  predicate: (row: T) => boolean,
): Collection<T> {
  const keep = collection.allIds.filter((id) => !predicate(collection.byId[id]));
  return {
    byId: keep.reduce((acc, id) => ({ ...acc, [id]: collection.byId[id] }), {} as Record<string, T>),
    allIds: keep,
  };
}

const listOf = <T,>(collection: Collection<T>): T[] =>
  collection.allIds.map((id) => collection.byId[id]).filter(Boolean);

/** crypto.randomUUID is available in every browser this console targets. */
const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;

const nowIso = (): string => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** The editable surface of a work item. Everything here is inline-editable. */
export type WorkItemPatch = Partial<
  Pick<
    WorkItem,
    | 'title'
    | 'description'
    | 'stateId'
    | 'priority'
    | 'assigneeIds'
    | 'labelIds'
    | 'startDate'
    | 'dueDate'
    | 'estimate'
    | 'parentId'
    | 'cycleId'
    | 'moduleId'
    | 'order'
  >
>;

export interface NewWorkItemInput extends WorkItemPatch {
  projectId: string;
  title: string;
}

export type ProjectsAction =
  | { type: 'hydrate'; state: ProjectsState }
  | { type: 'demo/reset' }
  | { type: 'workItem/create'; input: NewWorkItemInput; actorId: string }
  | { type: 'workItem/patch'; id: string; patch: WorkItemPatch; actorId: string }
  | { type: 'workItem/delete'; id: string }
  | { type: 'comment/add'; workItemId: string; authorId: string; body: string }
  | { type: 'comment/delete'; id: string }
  | { type: 'timeEntry/add'; entry: Omit<TimeEntry, 'id'> }
  | { type: 'timeEntry/delete'; id: string }
  | { type: 'state/create'; state: Omit<State, 'id'> }
  | { type: 'state/patch'; id: string; patch: Partial<Omit<State, 'id' | 'projectId'>> }
  | { type: 'state/delete'; id: string; reassignTo: string }
  | { type: 'label/create'; label: Omit<Label, 'id'> }
  | { type: 'label/patch'; id: string; patch: Partial<Omit<Label, 'id' | 'projectId'>> }
  | { type: 'label/delete'; id: string }
  | { type: 'cycle/create'; cycle: Omit<Cycle, 'id'> }
  | { type: 'cycle/patch'; id: string; patch: Partial<Omit<Cycle, 'id' | 'projectId'>> }
  | { type: 'cycle/delete'; id: string }
  | { type: 'module/create'; module: Omit<Module, 'id'> }
  | { type: 'module/patch'; id: string; patch: Partial<Omit<Module, 'id' | 'projectId'>> }
  | { type: 'module/delete'; id: string }
  | { type: 'project/create'; project: Omit<Project, 'id' | 'createdAt' | 'nextSequence'> }
  | { type: 'project/patch'; id: string; patch: Partial<Omit<Project, 'id'>> };

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

/** Fields worth recording. Reordering and description edits are noise. */
const TRACKED_FIELDS: (keyof WorkItemPatch)[] = [
  'title',
  'stateId',
  'priority',
  'assigneeIds',
  'labelIds',
  'startDate',
  'dueDate',
  'estimate',
  'parentId',
  'cycleId',
  'moduleId',
];

/**
 * Render a field value for the activity feed.
 *
 * Stores the resolved *name* rather than the id, so the feed still reads
 * correctly after a state is renamed or a label deleted. That is a deliberate
 * denormalisation: an activity entry is a historical record of what someone saw
 * at the time, not a live foreign key.
 */
function describeValue(
  state: ProjectsState,
  field: keyof WorkItemPatch,
  value: unknown,
): string | null {
  if (value === null || value === undefined) return null;

  switch (field) {
    case 'stateId':
      return state.states.byId[value as string]?.name ?? null;
    case 'cycleId':
      return state.cycles.byId[value as string]?.name ?? null;
    case 'moduleId':
      return state.modules.byId[value as string]?.name ?? null;
    case 'parentId':
      return state.workItems.byId[value as string]?.title ?? null;
    case 'assigneeIds':
      return (value as string[]).join(',') || null;
    case 'labelIds':
      return (
        (value as string[])
          .map((id) => state.labels.byId[id]?.name)
          .filter(Boolean)
          .join(', ') || null
      );
    case 'estimate':
      return String(value);
    default:
      return String(value);
  }
}

const sameValue = (a: unknown, b: unknown): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((value, i) => value === b[i])
    : a === b;

/** One activity entry per changed field, appended in a single pass. */
function activityForPatch(
  state: ProjectsState,
  item: WorkItem,
  patch: WorkItemPatch,
  actorId: string,
): Activity[] {
  const at = nowIso();

  return TRACKED_FIELDS.filter(
    (field) => field in patch && !sameValue(item[field], patch[field]),
  ).map((field) => ({
    id: newId(),
    workItemId: item.id,
    actorId,
    field,
    from: describeValue(state, field, item[field]),
    to: describeValue(state, field, patch[field]),
    at,
  }));
}

function appendActivity(state: ProjectsState, entries: Activity[]): Collection<Activity> {
  return entries.reduce((acc, entry) => addTo(acc, entry), state.activity);
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

function reducer(state: ProjectsState, action: ProjectsAction): ProjectsState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'demo/reset':
      return buildSeed();

    /* ---------------- work items ---------------- */

    case 'workItem/create': {
      const { input, actorId } = action;
      const project = state.projects.byId[input.projectId];
      if (!project) return state;

      const id = newId();
      const at = nowIso();

      // Sub-items are one level deep. A parent that is itself a sub-item is
      // rejected rather than silently flattened, so callers cannot build a
      // hierarchy the layouts are not written to render.
      const requestedParent = input.parentId ?? null;
      const parent = requestedParent ? state.workItems.byId[requestedParent] : null;
      const parentId = parent && parent.parentId === null ? parent.id : null;

      const siblings = listOf(state.workItems).filter(
        (existing) => existing.projectId === input.projectId,
      );

      const item: WorkItem = {
        id,
        projectId: input.projectId,
        sequence: project.nextSequence,
        title: input.title,
        description: input.description ?? '',
        stateId: input.stateId ?? defaultStateId(state, input.projectId),
        priority: input.priority ?? 'none',
        assigneeIds: input.assigneeIds ?? [],
        labelIds: input.labelIds ?? [],
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimate: input.estimate ?? null,
        parentId,
        cycleId: input.cycleId ?? null,
        moduleId: input.moduleId ?? null,
        createdAt: at,
        updatedAt: at,
        createdById: actorId,
        order: siblings.length,
      };

      return {
        ...state,
        projects: patchIn(state.projects, project.id, {
          nextSequence: project.nextSequence + 1,
        }),
        workItems: addTo(state.workItems, item),
        activity: addTo(state.activity, {
          id: newId(),
          workItemId: id,
          actorId,
          field: 'created',
          from: null,
          to: null,
          at,
        }),
      };
    }

    case 'workItem/patch': {
      const item = state.workItems.byId[action.id];
      if (!item) return state;

      const patch = { ...action.patch };

      // Same one-level rule as create: never let a patch build a grandchild.
      if ('parentId' in patch) {
        const parent = patch.parentId ? state.workItems.byId[patch.parentId] : null;
        const wouldNest = parent && parent.parentId !== null;
        const isSelf = patch.parentId === item.id;
        // An item that already has children cannot itself become a sub-item.
        const hasChildren = listOf(state.workItems).some(
          (other) => other.parentId === item.id,
        );
        if (wouldNest || isSelf || (patch.parentId && hasChildren)) {
          delete patch.parentId;
        }
      }

      const entries = activityForPatch(state, item, patch, action.actorId);
      if (entries.length === 0 && !('description' in patch) && !('order' in patch)) {
        return state;
      }

      return {
        ...state,
        workItems: patchIn(state.workItems, action.id, { ...patch, updatedAt: nowIso() }),
        activity: appendActivity(state, entries),
      };
    }

    case 'workItem/delete': {
      // Deleting a parent takes its sub-items, comments, activity and logged
      // time with it. Leaving orphans behind is how a demo grows ghost rows.
      const children = listOf(state.workItems)
        .filter((item) => item.parentId === action.id)
        .map((item) => item.id);
      const doomed = new Set([action.id, ...children]);

      return {
        ...state,
        workItems: removeWhere(state.workItems, (item) => doomed.has(item.id)),
        comments: removeWhere(state.comments, (row) => doomed.has(row.workItemId)),
        activity: removeWhere(state.activity, (row) => doomed.has(row.workItemId)),
        timeEntries: removeWhere(state.timeEntries, (row) => doomed.has(row.workItemId)),
      };
    }

    /* ---------------- comments ---------------- */

    case 'comment/add': {
      if (!state.workItems.byId[action.workItemId]) return state;
      const body = action.body.trim();
      if (!body) return state;

      return {
        ...state,
        comments: addTo(state.comments, {
          id: newId(),
          workItemId: action.workItemId,
          authorId: action.authorId,
          body,
          createdAt: nowIso(),
        }),
      };
    }

    case 'comment/delete':
      return { ...state, comments: removeFrom(state.comments, action.id) };

    /* ---------------- time ---------------- */

    case 'timeEntry/add':
      return {
        ...state,
        timeEntries: addTo(state.timeEntries, { ...action.entry, id: newId() }),
      };

    case 'timeEntry/delete':
      return { ...state, timeEntries: removeFrom(state.timeEntries, action.id) };

    /* ---------------- states ---------------- */

    case 'state/create':
      return { ...state, states: addTo(state.states, { ...action.state, id: newId() }) };

    case 'state/patch':
      return { ...state, states: patchIn(state.states, action.id, action.patch) };

    case 'state/delete': {
      // A state cannot be deleted out from under its items, so every one is
      // moved to a named replacement first.
      const target = state.states.byId[action.reassignTo];
      if (!target || action.id === action.reassignTo) return state;

      const moved = listOf(state.workItems).filter((item) => item.stateId === action.id);

      return {
        ...state,
        states: removeFrom(state.states, action.id),
        workItems: moved.reduce(
          (acc, item) => patchIn(acc, item.id, { stateId: action.reassignTo, updatedAt: nowIso() }),
          state.workItems,
        ),
      };
    }

    /* ---------------- labels ---------------- */

    case 'label/create':
      return { ...state, labels: addTo(state.labels, { ...action.label, id: newId() }) };

    case 'label/patch':
      return { ...state, labels: patchIn(state.labels, action.id, action.patch) };

    case 'label/delete': {
      const tagged = listOf(state.workItems).filter((item) =>
        item.labelIds.includes(action.id),
      );
      return {
        ...state,
        labels: removeFrom(state.labels, action.id),
        workItems: tagged.reduce(
          (acc, item) =>
            patchIn(acc, item.id, {
              labelIds: item.labelIds.filter((id) => id !== action.id),
            }),
          state.workItems,
        ),
      };
    }

    /* ---------------- cycles ---------------- */

    case 'cycle/create':
      return { ...state, cycles: addTo(state.cycles, { ...action.cycle, id: newId() }) };

    case 'cycle/patch':
      return { ...state, cycles: patchIn(state.cycles, action.id, action.patch) };

    case 'cycle/delete': {
      const assigned = listOf(state.workItems).filter((item) => item.cycleId === action.id);
      return {
        ...state,
        cycles: removeFrom(state.cycles, action.id),
        workItems: assigned.reduce(
          (acc, item) => patchIn(acc, item.id, { cycleId: null }),
          state.workItems,
        ),
      };
    }

    /* ---------------- modules ---------------- */

    case 'module/create':
      return { ...state, modules: addTo(state.modules, { ...action.module, id: newId() }) };

    case 'module/patch':
      return { ...state, modules: patchIn(state.modules, action.id, action.patch) };

    case 'module/delete': {
      const assigned = listOf(state.workItems).filter((item) => item.moduleId === action.id);
      return {
        ...state,
        modules: removeFrom(state.modules, action.id),
        workItems: assigned.reduce(
          (acc, item) => patchIn(acc, item.id, { moduleId: null }),
          state.workItems,
        ),
      };
    }

    /* ---------------- projects ---------------- */

    case 'project/create': {
      const id = newId();
      return {
        ...state,
        projects: addTo(state.projects, {
          ...action.project,
          id,
          createdAt: nowIso(),
          nextSequence: 1,
        }),
      };
    }

    case 'project/patch':
      return { ...state, projects: patchIn(state.projects, action.id, action.patch) };

    default:
      return state;
  }
}

/** The leftmost unstarted state, which is where a new item lands. */
function defaultStateId(state: ProjectsState, projectId: string): string {
  const projectStates = listOf(state.states).filter((s) => s.projectId === projectId);
  const todo = projectStates.find((s) => s.group === 'unstarted');
  const backlog = projectStates.find((s) => s.group === 'backlog');
  return (todo ?? backlog ?? projectStates[0])?.id ?? '';
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

/**
 * Read the stored snapshot, or build a fresh seed.
 *
 * A stored snapshot from an older seed version is discarded rather than
 * migrated — this is demo data, and a half-migrated snapshot rendering against
 * new code is a worse failure than losing a demo's worth of edits.
 */
function loadInitialState(): ProjectsState {
  if (typeof window === 'undefined') return buildSeed();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSeed();

    const parsed = JSON.parse(raw) as ProjectsState;
    if (!parsed || parsed.seedVersion !== SEED_VERSION) return buildSeed();
    if (!parsed.projects?.allIds?.length) return buildSeed();

    return parsed;
  } catch {
    // Corrupt or unreadable storage falls back to the seed rather than leaving
    // the module blank with no explanation.
    return buildSeed();
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface ProjectsContextValue {
  state: ProjectsState;
  dispatch: React.Dispatch<ProjectsAction>;

  /** The persona acting in the demo. There is no auth and there will not be. */
  currentUserId: string;

  createWorkItem: (input: NewWorkItemInput) => void;
  updateWorkItem: (id: string, patch: WorkItemPatch) => void;
  deleteWorkItem: (id: string) => void;
  addComment: (workItemId: string, body: string) => void;
  logTime: (entry: Omit<TimeEntry, 'id'>) => void;
  /** Restores the seed, exactly like the disbursement screen's reset. */
  resetDemoData: () => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }): JSX.Element {
  // Lazy initialiser: localStorage is read once, not on every render, and
  // StrictMode's double-invoke of the render body is harmless because reading
  // storage has no side effect.
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  const timer = useRef<number | null>(null);
  const firstRun = useRef(true);

  // Persist debounced. The first pass is skipped so mounting does not
  // immediately write back the snapshot we just read — which under StrictMode
  // would otherwise fire twice for no reason.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Quota exceeded or storage disabled. The demo keeps working in memory;
        // it just will not survive a reload, which is the right failure here.
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state]);

  const createWorkItem = useCallback(
    (input: NewWorkItemInput) =>
      dispatch({ type: 'workItem/create', input, actorId: CURRENT_USER_ID }),
    [],
  );

  const updateWorkItem = useCallback(
    (id: string, patch: WorkItemPatch) =>
      dispatch({ type: 'workItem/patch', id, patch, actorId: CURRENT_USER_ID }),
    [],
  );

  const deleteWorkItem = useCallback(
    (id: string) => dispatch({ type: 'workItem/delete', id }),
    [],
  );

  const addComment = useCallback(
    (workItemId: string, body: string) =>
      dispatch({ type: 'comment/add', workItemId, authorId: CURRENT_USER_ID, body }),
    [],
  );

  const logTime = useCallback(
    (entry: Omit<TimeEntry, 'id'>) => dispatch({ type: 'timeEntry/add', entry }),
    [],
  );

  const resetDemoData = useCallback(() => dispatch({ type: 'demo/reset' }), []);

  const value = useMemo<ProjectsContextValue>(
    () => ({
      state,
      dispatch,
      currentUserId: CURRENT_USER_ID,
      createWorkItem,
      updateWorkItem,
      deleteWorkItem,
      addComment,
      logTime,
      resetDemoData,
    }),
    [state, createWorkItem, updateWorkItem, deleteWorkItem, addComment, logTime, resetDemoData],
  );

  // Step 1 has no project settings screen and no palette entry yet, so this is
  // how the store is exercised before the UI exists: inspect state, reset it,
  // reload and confirm it persisted. Dev only — Vite strips it from the build.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).kiranProjects = {
      state,
      reset: () => dispatch({ type: 'demo/reset' }),
      clear: () => window.localStorage.removeItem(STORAGE_KEY),
    };
  }, [state]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const value = useContext(ProjectsContext);
  if (!value) {
    throw new Error('useProjects() must be used inside <ProjectsProvider>.');
  }
  return value;
}
