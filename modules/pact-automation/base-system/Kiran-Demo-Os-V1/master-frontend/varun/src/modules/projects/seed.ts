/**
 * The demo dataset.
 *
 * Three real Kiran programmes — the SAP S/4HANA cutover, UL94/EV qualification
 * and the Line 4 braiding expansion — carried over from the project pages this
 * module replaces, then expanded until every screen has something to show. Task
 * titles are the manufacturing work the old mock described: ledger
 * reconciliation, HSN/BOM validation, GSTIN scrubs, flame retardancy at CPRI,
 * foundation wiring in Bay 4.
 *
 * Dates are day offsets from today, resolved to ISO when the seed is built. The
 * demo therefore always has genuinely overdue items and a cycle genuinely in
 * progress, on whatever day it is run — rather than a fixed August 2026 that
 * quietly slid into the past.
 *
 * Written as compact literal rows fed through builders. A hand-authored object
 * per work item would be nine hundred lines nobody would read.
 */

import { SEED_VERSION } from './constants';
import { CURRENT_USER_ID, PEOPLE } from './people';
import type {
  Activity,
  Comment,
  Cycle,
  Label,
  Module,
  Priority,
  Project,
  ProjectsState,
  State,
  StateGroup,
  TimeEntry,
  WeeklyReport,
  WorkItem,
} from './types';

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

/** Midnight today, so every offset lands on a clean calendar day. */
const TODAY = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
})();

/** ISO calendar day, `offset` days from today. Local time, not UTC. */
function day(offset: number): string {
  const d = new Date(TODAY.getTime() + offset * DAY_MS);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${date}`;
}

/** ISO timestamp, `offset` days from today at a fixed working hour. */
function stamp(offset: number, hour = 11, minute = 20): string {
  const d = new Date(TODAY.getTime() + offset * DAY_MS);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** The Monday on or before today, which is what the weekly archive anchors on. */
const MONDAY_OFFSET = -((TODAY.getDay() + 6) % 7);

/**
 * A cycle written as day offsets rather than dates.
 *
 * The offsets are kept because the item builder needs them: a completed item
 * that belongs to a cycle has to have been completed *inside* that cycle's
 * window, or the burndown reads as a flat line — the work having apparently all
 * landed after the sprint closed.
 */
interface CycleSpec {
  id: string;
  projectId: string;
  name: string;
  description: string;
  from: number;
  to: number;
}

const toCycle = (spec: CycleSpec): Cycle => ({
  id: spec.id,
  projectId: spec.projectId,
  name: spec.name,
  description: spec.description,
  startDate: day(spec.from),
  endDate: day(spec.to),
});

/* ------------------------------------------------------------------ */
/* People shorthands                                                   */
/* ------------------------------------------------------------------ */

// Named by role so the seed rows read as sentences. These are the ids from
// src/data/people.ts, which is the directory the old project data used too.
const RAJESH = 'EMP-001'; // Head of Sales
const PRIYA = 'EMP-002'; // Sales Executive (South)
const AMIT = 'EMP-003'; // Sales Executive (West)
const SUNITA = 'EMP-004'; // CRM & Lead Manager
const VIKRAM = 'EMP-005'; // Production Head
const NEHA = 'EMP-006'; // Planning & Scheduling Lead
const FARHAN = 'EMP-007'; // Purchase Head
const MEERA = 'EMP-008'; // Accounts Head
const KARTHIK = 'EMP-009'; // Dispatch & Logistics Lead
const ANJALI = 'EMP-010'; // Projects & ERP Lead
const SURESH = 'EMP-011'; // Stores & Inventory Manager
const DIVYA = 'EMP-012'; // Quality Assurance Head

/* ------------------------------------------------------------------ */
/* Collection builder                                                  */
/* ------------------------------------------------------------------ */

function collect<T extends { id: string }>(rows: T[]) {
  return {
    byId: rows.reduce((acc, row) => ({ ...acc, [row.id]: row }), {} as Record<string, T>),
    allIds: rows.map((row) => row.id),
  };
}

/* ------------------------------------------------------------------ */
/* States and labels                                                   */
/* ------------------------------------------------------------------ */

/** Every project starts with the same five states; they are editable per project. */
const STATE_TEMPLATE: { key: string; name: string; group: StateGroup; color: string }[] = [
  { key: 'backlog', name: 'Backlog', group: 'backlog', color: '#8B97A8' },
  { key: 'todo', name: 'Todo', group: 'unstarted', color: '#4A5A70' },
  { key: 'doing', name: 'In Progress', group: 'started', color: '#E9991B' },
  { key: 'done', name: 'Done', group: 'completed', color: '#018F3D' },
  { key: 'cancelled', name: 'Cancelled', group: 'cancelled', color: '#B5070E' },
];

function statesFor(projectId: string): State[] {
  return STATE_TEMPLATE.map((tpl, index) => ({
    id: `${projectId}-st-${tpl.key}`,
    projectId,
    name: tpl.name,
    group: tpl.group,
    color: tpl.color,
    order: index,
  }));
}

const st = (projectId: string, key: string) => `${projectId}-st-${key}`;

function labelsFor(projectId: string, rows: [string, string][]): Label[] {
  return rows.map(([name, color], index) => ({
    id: `${projectId}-lb-${index}`,
    projectId,
    name,
    color,
  }));
}

const lb = (projectId: string, index: number) => `${projectId}-lb-${index}`;

/* ------------------------------------------------------------------ */
/* Work item builder                                                   */
/* ------------------------------------------------------------------ */

/**
 * One row of the seed table.
 *
 * `s` is the state key, `due`/`start` are day offsets, `est` is story points,
 * `who` the assignee ids, `lb` label indices, `cy`/`md` cycle and module indices.
 * `sub` nests a row one level under the row above it.
 */
interface Row {
  t: string;
  s: string;
  p: Priority;
  who?: string[];
  due?: number;
  start?: number;
  est?: number;
  lb?: number[];
  cy?: number;
  md?: number;
  sub?: boolean;
  /** Days ago the item was created. Defaults to a spread based on its state. */
  age?: number;
  desc?: string;
}

interface BuildResult {
  items: WorkItem[];
  activity: Activity[];
  timeEntries: TimeEntry[];
}

/**
 * Turn seed rows into work items, and give each one a history.
 *
 * Every item gets a 'created' activity entry; started and finished ones get the
 * state and assignee changes that would have produced them, so the detail panel
 * has a real feed rather than a single line. Items that are underway or done
 * also get time entries spread over the weeks since they were created, which is
 * what makes the hours and cost figures computed rather than declared.
 */
function buildItems(
  projectId: string,
  rows: Row[],
  cycles: CycleSpec[],
  moduleIds: string[],
  /**
   * Force every item's last touch to be at least this many days ago.
   *
   * Used to make one project trip the "not updated since Friday" flag. That is
   * the exact situation Kiran's weekly lock exists to catch — work sitting in
   * progress that nobody has updated since the week closed — and a demo where
   * the flag never fires does not show the rule working.
   */
  staleFloorDays = 0,
): BuildResult {
  const items: WorkItem[] = [];
  const activity: Activity[] = [];
  const timeEntries: TimeEntry[] = [];

  let lastRootId: string | null = null;
  let timeCounter = 0;

  // How many completed items each cycle has taken so far, so their completion
  // dates can be walked across the cycle instead of stacking on one day.
  const doneInCycle = new Map<number, number>();
  const doneTotals = new Map<number, number>();
  rows.forEach((row) => {
    if (row.s === 'done' && row.cy !== undefined) {
      doneTotals.set(row.cy, (doneTotals.get(row.cy) ?? 0) + 1);
    }
  });

  rows.forEach((row, index) => {
    const id = `${projectId}-wi-${index + 1}`;
    const stateId = st(projectId, row.s);
    const assignees = row.who ?? [];

    // Older items further down the backlog; done work was created earliest.
    const age = row.age ?? (row.s === 'done' ? 34 : row.s === 'doing' ? 19 : 11) - (index % 7);
    const createdAt = stamp(-age, 9, 30);

    /*
     * An item's last change is what the freshness flag and the burndown read,
     * so it has to be a real moment.
     *
     * A completed item inside a cycle is settled at a point spread across that
     * cycle's window — the nth of its cycle's finished items lands n/total of
     * the way through. That is what gives the burndown a slope rather than a
     * cliff. Everything else settles relative to its own age.
     */
    let updatedOffset: number;

    if (row.s === 'done' && row.cy !== undefined && cycles[row.cy]) {
      const cycle = cycles[row.cy];
      const total = doneTotals.get(row.cy) ?? 1;
      const nth = doneInCycle.get(row.cy) ?? 0;
      doneInCycle.set(row.cy, nth + 1);

      // Never later than yesterday: an active cycle must not claim work
      // finished in its remaining days.
      const last = Math.min(cycle.to, -1);
      const span = Math.max(1, last - cycle.from);
      updatedOffset = Math.round(cycle.from + (span * (nth + 1)) / (total + 1));
    } else if (row.s === 'done') {
      updatedOffset = -Math.max(1, Math.round(age * 0.35) - (index % 4));
    } else if (row.s === 'doing') {
      updatedOffset = -(index % 3);
    } else if (row.s === 'cancelled') {
      updatedOffset = -Math.round(age * 0.5);
    } else {
      updatedOffset = -age;
    }

    if (staleFloorDays > 0) {
      updatedOffset = Math.min(updatedOffset, -staleFloorDays);
    }

    items.push({
      id,
      projectId,
      sequence: index + 1,
      title: row.t,
      description: row.desc ?? '',
      stateId,
      priority: row.p,
      assigneeIds: assignees,
      labelIds: (row.lb ?? []).map((i) => lb(projectId, i)),
      startDate: row.start !== undefined ? day(row.start) : null,
      dueDate: row.due !== undefined ? day(row.due) : null,
      estimate: row.est ?? null,
      parentId: row.sub ? lastRootId : null,
      cycleId: row.cy !== undefined ? (cycles[row.cy]?.id ?? null) : null,
      moduleId: row.md !== undefined ? (moduleIds[row.md] ?? null) : null,
      createdAt,
      updatedAt: stamp(updatedOffset, 16, 5),
      createdById: index % 3 === 0 ? ANJALI : (assignees[0] ?? CURRENT_USER_ID),
      order: index,
    });

    if (!row.sub) lastRootId = id;

    /* ---- history ---- */

    activity.push({
      id: `${id}-ac-0`,
      workItemId: id,
      actorId: index % 3 === 0 ? ANJALI : (assignees[0] ?? CURRENT_USER_ID),
      field: 'created',
      from: null,
      to: null,
      at: createdAt,
    });

    if (assignees.length > 0) {
      activity.push({
        id: `${id}-ac-1`,
        workItemId: id,
        actorId: ANJALI,
        field: 'assignee',
        from: null,
        to: assignees[0],
        at: stamp(-age, 10, 15),
      });
    }

    if (row.s === 'doing' || row.s === 'done') {
      activity.push({
        id: `${id}-ac-2`,
        workItemId: id,
        actorId: assignees[0] ?? ANJALI,
        field: 'state',
        from: 'Todo',
        to: 'In Progress',
        at: stamp(-Math.round(age * 0.7), 11, 40),
      });
    }

    if (row.s === 'done') {
      activity.push({
        id: `${id}-ac-3`,
        workItemId: id,
        actorId: assignees[0] ?? ANJALI,
        field: 'state',
        from: 'In Progress',
        to: 'Done',
        at: stamp(updatedOffset, 16, 5),
      });
    }

    if (row.s === 'cancelled') {
      activity.push({
        id: `${id}-ac-2`,
        workItemId: id,
        actorId: ANJALI,
        field: 'state',
        from: 'Todo',
        to: 'Cancelled',
        at: stamp(updatedOffset, 15, 0),
      });
    }

    /* ---- logged time ---- */

    if ((row.s === 'doing' || row.s === 'done') && assignees.length > 0) {
      // Two or three sessions per item, walked back over the last six weeks.
      const sessions = row.s === 'done' ? 3 : 2;
      for (let n = 0; n < sessions; n += 1) {
        const offset = -(4 + ((timeCounter * 5 + n * 9) % 38));
        timeEntries.push({
          id: `${id}-te-${n}`,
          workItemId: id,
          userId: assignees[n % assignees.length],
          date: day(offset),
          hours: [2, 3, 4, 6, 1.5][(timeCounter + n) % 5],
          note: n === 0 ? 'Initial pass' : n === 1 ? 'Review and rework' : 'Sign-off',
        });
      }
      timeCounter += 1;
    }
  });

  return { items, activity, timeEntries };
}

/* ------------------------------------------------------------------ */
/* Project 1 — SAP S/4HANA migration                                   */
/* ------------------------------------------------------------------ */

const SAP = 'prj-sap';

const SAP_CYCLES: CycleSpec[] = [
  {
    id: `${SAP}-cy-0`,
    projectId: SAP,
    name: 'Cutover Sprint 1',
    description: 'Master data extraction and the first reconciliation pass.',
    from: -56,
    to: -43,
  },
  {
    id: `${SAP}-cy-1`,
    projectId: SAP,
    name: 'Cutover Sprint 2',
    description: 'Vendor and customer master cleansing.',
    from: -42,
    to: -29,
  },
  {
    id: `${SAP}-cy-2`,
    projectId: SAP,
    name: 'Cutover Sprint 3',
    description: 'Interface build and the staging environment dry run.',
    from: -13,
    to: 1,
  },
  {
    id: `${SAP}-cy-3`,
    projectId: SAP,
    name: 'Cutover Sprint 4',
    description: 'Go-live rehearsal and user acceptance.',
    from: 2,
    to: 16,
  },
];

const SAP_MODULES: Module[] = [
  {
    id: `${SAP}-md-0`,
    projectId: SAP,
    name: 'Master Data',
    description: 'Customer, vendor and product masters cleansed and loaded.',
    leadId: MEERA,
    targetDate: day(-20),
  },
  {
    id: `${SAP}-md-1`,
    projectId: SAP,
    name: 'Finance & Controlling',
    description: 'Chart of accounts, opening balances, tax configuration.',
    leadId: MEERA,
    targetDate: day(8),
  },
  {
    id: `${SAP}-md-2`,
    projectId: SAP,
    name: 'Interfaces',
    description: 'KiranOS connectors, API gateway, PACT decommissioning.',
    leadId: ANJALI,
    targetDate: day(21),
  },
  {
    id: `${SAP}-md-3`,
    projectId: SAP,
    name: 'Training & Cutover',
    description: 'Department training, dry runs, go-live checklist.',
    leadId: ANJALI,
    targetDate: day(40),
  },
];

const SAP_ROWS: Row[] = [
  // ---- Master Data (module 0) ----
  { t: 'Legacy PACT customer ledger reconciliation & opening balances', s: 'done', p: 'high', who: [MEERA], due: -46, start: -56, est: 8, lb: [0], cy: 0, md: 0,
    desc: 'Reconcile all 412 open customer ledger lines from PACT against the trial balance before extraction. Any unmatched line blocks the opening balance load.' },
  { t: 'Pull trial balance extract and lock the PACT period', s: 'done', p: 'high', who: [MEERA], due: -50, est: 2, cy: 0, md: 0, sub: true },
  { t: 'Match 412 open ledger lines against customer statements', s: 'done', p: 'medium', who: [MEERA, PRIYA], due: -47, est: 5, cy: 0, md: 0, sub: true },
  { t: 'Product master HSN & BOM routing validation (40+ product lines)', s: 'doing', p: 'urgent', who: [VIKRAM], due: -3, start: -20, est: 13, lb: [0, 2], cy: 2, md: 0,
    desc: 'Every sleeving and conduit SKU needs its HSN code confirmed against the 2026 tariff schedule, and its BOM routing re-pointed at the S/4 work centre IDs.' },
  { t: 'Confirm HSN codes for the KU-SLV series against 2026 tariff', s: 'done', p: 'high', who: [VIKRAM], due: -1, est: 5, cy: 2, md: 0, sub: true },
  { t: 'Re-point BOM routings at S/4 work centre IDs', s: 'todo', p: 'high', who: [NEHA], due: 4, est: 8, cy: 2, md: 0, sub: true },
  { t: 'Vendor master GSTIN & MSME classification scrub', s: 'doing', p: 'urgent', who: [FARHAN], due: -6, start: -24, est: 8, lb: [0, 2], cy: 2, md: 0,
    desc: 'MSME status drives payment terms under the 45-day rule. 61 vendors have no classification on record and 14 have GSTINs that fail checksum validation.' },
  { t: 'Chase 61 vendors for missing MSME declarations', s: 'done', p: 'high', who: [FARHAN, SURESH], due: -2, est: 5, cy: 2, md: 0 },
  { t: 'Customer master de-duplication across PACT and CRM', s: 'done', p: 'medium', who: [SUNITA], due: -32, start: -42, est: 5, lb: [0], cy: 1, md: 0 },
  { t: 'Freight and packing cost element mapping', s: 'done', p: 'low', who: [KARTHIK], due: -31, est: 3, cy: 1, md: 1 },
  { t: 'Purchase organisation and plant hierarchy setup', s: 'done', p: 'medium', who: [FARHAN], due: -34, est: 5, cy: 1, md: 0 },
  { t: 'Material master unit-of-measure conversion table', s: 'done', p: 'low', who: [SURESH], due: -35, est: 3, cy: 1, md: 0 },
  { t: 'Extract and stage the PACT vendor master for cleansing', s: 'done', p: 'high', who: [FARHAN], due: -48, est: 5, cy: 0, md: 0 },
  { t: 'Storage location and warehouse mapping for Bay 1-3', s: 'done', p: 'medium', who: [SURESH], due: -45, est: 5, cy: 0, md: 0 },
  { t: 'Define the S/4 company code and fiscal year variant', s: 'done', p: 'urgent', who: [MEERA], due: -52, est: 3, cy: 0, md: 1 },
  { t: 'Bank master and payment method configuration', s: 'todo', p: 'medium', who: [MEERA], due: 9, est: 3, md: 0 },

  // ---- Finance & Controlling (module 1) ----
  { t: 'Chart of accounts mapping — PACT to S/4 clean core', s: 'done', p: 'urgent', who: [MEERA], due: -38, start: -50, est: 13, lb: [0, 1], cy: 1, md: 1,
    desc: 'The legacy chart carries 218 accounts, many of them dormant since the 2019 restructure. Target is a clean 140-account structure with cost centres carried across.' },
  { t: 'Cost centre hierarchy for the four production bays', s: 'done', p: 'high', who: [MEERA, VIKRAM], due: -30, est: 5, cy: 1, md: 1 },
  { t: 'GST output and input tax code configuration', s: 'done', p: 'urgent', who: [MEERA], due: 1, start: -12, est: 8, lb: [1], cy: 2, md: 1 },
  { t: 'e-Invoicing IRP integration and QR code generation test', s: 'doing', p: 'high', who: [ANJALI, MEERA], due: 5, start: -8, est: 8, lb: [1, 3], cy: 2, md: 1 },
  { t: 'TDS and TCS deduction rules for vendor payments', s: 'todo', p: 'high', who: [MEERA], due: 12, est: 5, cy: 3, md: 1 },
  { t: 'Asset register migration with accumulated depreciation', s: 'todo', p: 'medium', who: [MEERA], due: 18, est: 8, cy: 3, md: 1 },
  { t: 'Month-end close calendar and automated posting run', s: 'backlog', p: 'medium', who: [MEERA], est: 5, md: 1 },
  { t: 'Retire the parallel PACT ledger after two clean closes', s: 'backlog', p: 'low', est: 3, md: 1 },

  // ---- Interfaces (module 2) ----
  { t: 'API Gateway staging environment test with mock PO creation', s: 'doing', p: 'urgent', who: [ANJALI], due: 0, start: -14, est: 13, lb: [3], cy: 2, md: 2,
    desc: 'End-to-end test: KiranOS raises a purchase requisition, the gateway creates the PO in S/4, and the GRN posts back. Currently failing on the tax jurisdiction field.' },
  { t: 'Fix tax jurisdiction field mapping in the PO payload', s: 'doing', p: 'urgent', who: [ANJALI], due: -1, est: 3, cy: 2, md: 2, sub: true },
  { t: 'KiranOS → S/4 sales order connector', s: 'doing', p: 'high', who: [ANJALI, RAJESH], due: 6, start: -10, est: 13, lb: [3], cy: 2, md: 2 },
  { t: 'Dispatch and e-way bill interface to the logistics portal', s: 'todo', p: 'high', who: [KARTHIK], due: 14, est: 8, lb: [3], cy: 3, md: 2 },
  { t: 'Nightly batch reconciliation job between PACT and S/4', s: 'todo', p: 'medium', who: [ANJALI], due: 20, est: 5, cy: 3, md: 2 },
  { t: 'Error queue monitoring and alerting for failed IDocs', s: 'backlog', p: 'medium', who: [ANJALI], est: 5, md: 2 },
  { t: 'Decommission the PACT ERP server and archive the database', s: 'backlog', p: 'low', est: 8, md: 2 },
  { t: 'Legacy Tally connector — superseded by the direct S/4 interface', s: 'cancelled', p: 'low', who: [ANJALI], est: 5, md: 2 },

  // ---- Training & Cutover (module 3) ----
  { t: 'Sales pricing master & customer discount matrices upload', s: 'done', p: 'medium', who: [RAJESH], due: -24, start: -34, est: 5, lb: [0], cy: 1, md: 3 },
  { t: 'Department key-user training — Accounts and Purchase', s: 'doing', p: 'high', who: [ANJALI, MEERA], due: 3, start: -6, est: 8, lb: [4], cy: 2, md: 3 },
  { t: 'Department key-user training — Production and Stores', s: 'todo', p: 'high', who: [ANJALI, VIKRAM], due: 10, est: 8, lb: [4], cy: 3, md: 3 },
  { t: 'Cutover dress rehearsal over a weekend window', s: 'todo', p: 'urgent', who: [ANJALI], due: 15, start: 14, est: 13, lb: [4], cy: 3, md: 3 },
  { t: 'Go-live checklist sign-off with department heads', s: 'todo', p: 'urgent', who: [ANJALI, RAJESH, MEERA], due: 22, est: 5, md: 3 },
  { t: 'Hypercare roster for the first two weeks post go-live', s: 'backlog', p: 'medium', who: [ANJALI], est: 3, md: 3 },
  { t: 'Post-implementation review and lessons log', s: 'backlog', p: 'low', est: 2, md: 3 },
];

/* ------------------------------------------------------------------ */
/* Project 2 — UL94 / EV qualification                                 */
/* ------------------------------------------------------------------ */

const UL = 'prj-ul';

const UL_CYCLES: CycleSpec[] = [
  {
    id: `${UL}-cy-0`,
    projectId: UL,
    name: 'Qualification Round 2',
    description: 'Thermal ageing results and the customer audit pack.',
    from: -9,
    to: 5,
  },
];

const UL_MODULES: Module[] = [
  { id: `${UL}-md-0`, projectId: UL, name: 'Flame Retardancy', description: 'UL94 V-0 vertical burn qualification.', leadId: DIVYA, targetDate: day(-2) },
  { id: `${UL}-md-1`, projectId: UL, name: 'Thermal Endurance', description: 'Class H 180°C ageing across 5,000 hours.', leadId: DIVYA, targetDate: day(12) },
  { id: `${UL}-md-2`, projectId: UL, name: 'Customer Audits', description: 'Motherson and Alstom documentation packs.', leadId: RAJESH, targetDate: day(25) },
];

const UL_ROWS: Row[] = [
  { t: 'Third-party flame retardancy testing at CPRI Bangalore', s: 'done', p: 'urgent', who: [DIVYA], due: -18, start: -32, est: 13, lb: [0], cy: 0, md: 0,
    desc: 'UL94 vertical burn on KU-SLV-0625 and KU-SLV-0800. Five specimens per series, two flame applications, afterflame under 10 seconds for V-0.' },
  { t: 'Prepare 10 specimens per series to UL94 dimensions', s: 'done', p: 'high', who: [VIKRAM], due: -26, est: 3, cy: 0, md: 0, sub: true },
  { t: 'Witness the burn test and countersign the CPRI report', s: 'done', p: 'medium', who: [DIVYA], due: -19, est: 2, cy: 0, md: 0, sub: true },
  { t: 'V-0 rating certificate filed against KU-SLV-0625', s: 'done', p: 'high', who: [DIVYA], due: -14, est: 2, lb: [0], md: 0 },
  { t: 'Glow wire ignition test for the connector housing grade', s: 'doing', p: 'high', who: [DIVYA], due: 2, start: -7, est: 8, lb: [0], cy: 0, md: 0 },
  { t: 'Re-test the 0800 series after the resin formulation change', s: 'todo', p: 'urgent', who: [DIVYA, VIKRAM], due: -1, est: 8, lb: [0, 2], cy: 0, md: 0 },

  { t: 'Class H 180°C thermal ageing — 5,000 hour endurance run', s: 'doing', p: 'urgent', who: [DIVYA], due: 8, start: -40, est: 13, lb: [1], cy: 0, md: 1,
    desc: 'Continuous oven run with pull-outs at 1,000 hour intervals for tensile and elongation retention. Currently at 3,400 hours with no failures.' },
  { t: '3,000 hour pull-out — tensile and elongation retention', s: 'done', p: 'high', who: [DIVYA], due: -6, est: 3, cy: 0, md: 1, sub: true },
  { t: '4,000 hour pull-out and interim report', s: 'todo', p: 'high', who: [DIVYA], due: 6, est: 3, cy: 0, md: 1, sub: true },
  { t: 'Cold bend test at -40°C on aged specimens', s: 'todo', p: 'medium', who: [DIVYA], due: 11, est: 5, lb: [1], md: 1 },
  { t: 'Dielectric strength retention after full ageing cycle', s: 'todo', p: 'medium', who: [DIVYA], due: 16, est: 5, lb: [1], md: 1 },
  { t: 'Humidity and salt spray resistance per IEC 60068', s: 'backlog', p: 'low', who: [DIVYA], est: 8, md: 1 },

  { t: 'Batch test reports consolidation for Motherson & Alstom audits', s: 'doing', p: 'high', who: [DIVYA], due: 4, start: -11, est: 8, lb: [3], cy: 0, md: 2 },
  { t: 'Motherson supplier audit — corrective action closure', s: 'doing', p: 'urgent', who: [DIVYA, RAJESH], due: -2, start: -16, est: 8, lb: [3], cy: 0, md: 2 },
  { t: 'Alstom rolling stock qualification dossier', s: 'todo', p: 'high', who: [RAJESH], due: 13, est: 13, lb: [3], md: 2 },
  { t: 'IATF 16949 internal audit for the sleeving line', s: 'todo', p: 'medium', who: [DIVYA], due: 19, est: 8, lb: [2], md: 2 },
  { t: 'PPAP level 3 submission for the EV harness programme', s: 'todo', p: 'high', who: [DIVYA, VIKRAM], due: 24, est: 13, lb: [3], md: 2 },
  { t: 'Customer-specific marking and traceability requirements', s: 'backlog', p: 'medium', who: [VIKRAM], est: 5, md: 2 },
  { t: 'REACH and RoHS declaration refresh for 2026', s: 'backlog', p: 'medium', who: [DIVYA], est: 3, md: 2 },
  { t: 'Halogen-free variant qualification', s: 'backlog', p: 'low', est: 13, md: 1 },
  { t: 'UL file transfer to the Chennai plant — deferred to FY27', s: 'cancelled', p: 'low', who: [DIVYA], est: 8, md: 2 },
];

/* ------------------------------------------------------------------ */
/* Project 3 — Line 4 braiding capacity expansion                      */
/* ------------------------------------------------------------------ */

const CAP = 'prj-cap';

const CAP_CYCLES: CycleSpec[] = [
  {
    id: `${CAP}-cy-0`,
    projectId: CAP,
    name: 'Bay 4 Commissioning',
    description: 'Civil works through to the first machine trial run.',
    from: -11,
    to: 3,
  },
];

const CAP_MODULES: Module[] = [
  { id: `${CAP}-md-0`, projectId: CAP, name: 'Civil & Utilities', description: 'Foundations, power distribution, compressed air.', leadId: VIKRAM, targetDate: day(-4) },
  { id: `${CAP}-md-1`, projectId: CAP, name: 'Machine Installation', description: 'Eight 32-carrier braiders, positioned and levelled.', leadId: VIKRAM, targetDate: day(14) },
  { id: `${CAP}-md-2`, projectId: CAP, name: 'Materials & Stores', description: 'Bobbin inventory, creel stock, spares holding.', leadId: SURESH, targetDate: day(20) },
  { id: `${CAP}-md-3`, projectId: CAP, name: 'Ramp-up', description: 'Operator training, OEE baseline, 40M metre target.', leadId: NEHA, targetDate: day(48) },
];

const CAP_ROWS: Row[] = [
  { t: 'Foundation and power distribution wiring in Bay 4', s: 'doing', p: 'urgent', who: [VIKRAM], due: -8, start: -30, est: 13, lb: [0], cy: 0, md: 0,
    desc: 'RCC foundations for eight machines, 400A distribution board, and the cable trays feeding each position. Held up by the transformer delivery.' },
  { t: 'Pour and cure RCC foundations for positions 1–4', s: 'done', p: 'high', who: [VIKRAM], due: -20, est: 8, cy: 0, md: 0, sub: true },
  { t: 'Pour and cure RCC foundations for positions 5–8', s: 'doing', p: 'high', who: [VIKRAM], due: -2, est: 8, cy: 0, md: 0, sub: true },
  { t: '400A distribution board installation and load test', s: 'todo', p: 'urgent', who: [VIKRAM], due: 1, est: 8, lb: [0, 3], cy: 0, md: 0 },
  { t: 'Compressed air ring main extension to Bay 4', s: 'done', p: 'medium', who: [SURESH], due: -12, start: -24, est: 5, cy: 0, md: 0 },
  { t: 'Fire suppression and extraction survey for the new bay', s: 'todo', p: 'high', who: [DIVYA], due: 7, est: 5, lb: [3], md: 0 },
  { t: 'Bay 4 lighting and emergency egress certification', s: 'todo', p: 'medium', who: [VIKRAM], due: 12, est: 3, md: 0 },

  { t: 'Receive and unload 8 × 32-carrier braiding machines', s: 'done', p: 'urgent', who: [SURESH, VIKRAM], due: -15, start: -22, est: 8, lb: [1], cy: 0, md: 1 },
  { t: 'Position and level machines 1–4 on the cured foundations', s: 'doing', p: 'urgent', who: [VIKRAM], due: 0, start: -9, est: 13, lb: [1], cy: 0, md: 1 },
  { t: 'Position and level machines 5–8', s: 'todo', p: 'high', who: [VIKRAM], due: 9, est: 13, lb: [1], md: 1 },
  { t: 'Vendor commissioning engineer visit and handover', s: 'todo', p: 'urgent', who: [VIKRAM, NEHA], due: 15, start: 14, est: 8, lb: [1], md: 1 },
  { t: 'First article trial run — 100m sample per machine', s: 'todo', p: 'high', who: [VIKRAM, DIVYA], due: 18, est: 8, md: 1 },
  { t: 'Machine safety interlock and guarding verification', s: 'todo', p: 'urgent', who: [DIVYA], due: 16, est: 5, lb: [3], md: 1 },

  { t: 'Bobbin and creel inventory build for 8 additional positions', s: 'doing', p: 'high', who: [SURESH], due: 5, start: -14, est: 8, lb: [2], cy: 0, md: 2 },
  { t: 'Critical spares holding agreed with the machine vendor', s: 'todo', p: 'medium', who: [SURESH, FARHAN], due: 17, est: 5, lb: [2], md: 2 },
  { t: 'Yarn supplier capacity confirmation for the ramp', s: 'doing', p: 'high', who: [FARHAN], due: 3, start: -8, est: 5, lb: [2], cy: 0, md: 2 },
  { t: 'Stores layout rework to hold the increased WIP', s: 'todo', p: 'low', who: [SURESH], due: 26, est: 5, md: 2 },
  { t: 'Barcode and bin location scheme for Bay 4 consumables', s: 'backlog', p: 'low', who: [SURESH], est: 3, md: 2 },

  { t: 'Operator recruitment and three-shift roster design', s: 'doing', p: 'high', who: [NEHA], due: 11, start: -5, est: 8, md: 3 },
  { t: 'Operator training programme and competency sign-off', s: 'todo', p: 'high', who: [NEHA, VIKRAM], due: 23, est: 13, md: 3 },
  { t: 'OEE baseline measurement across the first month', s: 'todo', p: 'medium', who: [NEHA], due: 34, est: 8, md: 3 },
  { t: 'Ramp plan to 40M metres annualised capacity', s: 'todo', p: 'urgent', who: [NEHA, VIKRAM], due: 40, est: 13, md: 3 },
  { t: 'Preventive maintenance schedule for the new line', s: 'backlog', p: 'medium', who: [VIKRAM], est: 5, md: 3 },
  { t: 'Energy consumption baseline and sub-metering', s: 'backlog', p: 'low', who: [VIKRAM], est: 5, md: 0 },
  { t: 'Second-hand machine option — dropped after the trial run', s: 'cancelled', p: 'medium', who: [FARHAN], est: 8, md: 1 },
];

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

/** Threads on the items most likely to be opened during a demo. */
const COMMENT_ROWS: [string, string, string, number][] = [
  [`${SAP}-wi-4`, VIKRAM, 'Tariff schedule for 2026 moved the braided sleeving lines into a new sub-heading. I have flagged 11 SKUs that need a fresh classification before we can sign this off.', -4],
  [`${SAP}-wi-4`, ANJALI, 'Noted. Can you put the 11 into a sub-item so the cutover checklist picks them up?', -3],
  [`${SAP}-wi-4`, MEERA, 'If the HSN changes we will need the GST tax codes re-pointed too — that is on my side, I have raised it under Finance & Controlling.', -2],
  [`${SAP}-wi-7`, FARHAN, '61 vendors still without an MSME declaration. I have sent the second reminder; after that we treat them as non-MSME and the 45-day rule does not apply.', -5],
  [`${SAP}-wi-7`, MEERA, 'Please keep the evidence of both reminders on file. Statutory auditors asked for exactly this last year.', -4],
  [`${SAP}-wi-19`, ANJALI, 'Gateway test is failing on the tax jurisdiction field — S/4 expects a region code and we are sending the state name. Fix is small, raised as a sub-item.', -2],
  [`${SAP}-wi-19`, RAJESH, 'Does that affect the sales order connector as well?', -1],
  [`${SAP}-wi-19`, ANJALI, 'Same payload shape, so yes. I will fix both together.', -1],
  [`${SAP}-wi-12`, MEERA, 'Down from 218 accounts to 141. The dormant 2019 restructure accounts are gone and cost centres carried across cleanly.', -30],
  [`${UL}-wi-1`, DIVYA, 'CPRI report is in — afterflame 4.2s and 3.8s across both series, comfortably inside V-0. Certificate filed.', -17],
  [`${UL}-wi-6`, DIVYA, 'Resin formulation changed on the 0800 series after the supplier switch, so the earlier result does not carry. We need a re-test before Motherson audit.', -3],
  [`${UL}-wi-6`, VIKRAM, 'I can have specimens ready by Thursday if the line is free after the second shift.', -2],
  [`${UL}-wi-7`, DIVYA, '3,400 hours in, no tensile failures. Elongation retention at 78% which is well above the 50% floor.', -6],
  [`${UL}-wi-14`, RAJESH, 'Motherson want the corrective actions closed before the audit date, not on the day. Please prioritise.', -3],
  [`${CAP}-wi-1`, VIKRAM, 'Transformer delivery slipped by two weeks, which has pushed the whole distribution board task. Foundations for 5–8 are curing now.', -15],
  [`${CAP}-wi-1`, ANJALI, 'Does that move the commissioning engineer visit? Their travel is booked.', -14],
  [`${CAP}-wi-1`, VIKRAM, 'It should not — machines 1–4 will be levelled and ready even if the board is late. Worst case they start on those four.', -13],
  [`${CAP}-wi-9`, VIKRAM, 'Machines 1 and 2 levelled to within 0.2mm. 3 and 4 tomorrow.', -11],
  [`${CAP}-wi-16`, FARHAN, 'Yarn supplier has confirmed capacity for the ramp but wants a rolling 12-week forecast. Passing that to Planning.', -10],
  [`${CAP}-wi-19`, NEHA, 'Three-shift roster needs 14 additional operators. HR have started on the first six.', -10],
];

const COMMENTS: Comment[] = COMMENT_ROWS.map(([workItemId, authorId, body, offset], index) => ({
  id: `cm-${index}`,
  workItemId,
  authorId,
  body,
  createdAt: stamp(offset, 14, 25),
}));

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

const PROJECTS: Project[] = [
  {
    id: SAP,
    name: 'SAP S/4HANA ERP Migration & Master Data Cutover',
    key: 'SAP',
    description:
      'Transition from legacy PACT ERP to SAP S/4HANA Cloud with custom KiranOS connector interfaces and clean chart-of-accounts mapping.',
    leadId: ANJALI,
    memberIds: [ANJALI, MEERA, RAJESH, VIKRAM, FARHAN, NEHA, SUNITA, SURESH, KARTHIK, PRIYA],
    departments: ['Projects', 'Accounts', 'Sales', 'Purchase', 'Production'],
    startDate: day(-90),
    targetDate: day(45),
    status: 'active',
    createdAt: stamp(-92, 10, 0),
    nextSequence: SAP_ROWS.length + 1,
  },
  {
    id: UL,
    name: 'UL94 V-0 & Class H Sleeving Qualification for Global EV Programs',
    key: 'UL',
    description:
      'Underwriters Laboratories thermal ageing and flame retardancy certification for silicone coated sleeving series KU-SLV-0625 and KU-SLV-0800.',
    leadId: DIVYA,
    memberIds: [DIVYA, VIKRAM, RAJESH, AMIT],
    departments: ['Quality', 'Production', 'Sales'],
    startDate: day(-60),
    targetDate: day(30),
    status: 'active',
    createdAt: stamp(-62, 10, 0),
    nextSequence: UL_ROWS.length + 1,
  },
  {
    id: CAP,
    name: 'Line 4 Braiding Capacity Expansion (40M Metres Target)',
    key: 'CAP',
    description:
      'Installation and commissioning of 8 high-speed 32-carrier braiding machines to ramp annual capacity by 10 million metres.',
    leadId: VIKRAM,
    memberIds: [VIKRAM, SURESH, NEHA, FARHAN, DIVYA],
    departments: ['Production', 'Stores', 'Projects'],
    startDate: day(-45),
    targetDate: day(55),
    status: 'active',
    createdAt: stamp(-47, 10, 0),
    nextSequence: CAP_ROWS.length + 1,
  },
];

const LABELS: Label[] = [
  ...labelsFor(SAP, [
    ['data-migration', '#06477F'],
    ['statutory', '#B5070E'],
    ['blocked', '#BE5B0B'],
    ['integration', '#5B46C8'],
    ['training', '#0D9488'],
  ]),
  ...labelsFor(UL, [
    ['flame-test', '#B5070E'],
    ['thermal', '#E9991B'],
    ['re-test', '#BE5B0B'],
    ['customer-audit', '#06477F'],
  ]),
  ...labelsFor(CAP, [
    ['civil', '#6E7F96'],
    ['machine', '#06477F'],
    ['procurement', '#0D9488'],
    ['safety', '#B5070E'],
  ]),
];

/* ------------------------------------------------------------------ */
/* Weekly report archive                                               */
/* ------------------------------------------------------------------ */

/**
 * Six weeks of archive per project.
 *
 * The old pages listed these with a dead '#' URL. Here they carry only a week
 * anchor — the report itself is generated from work items when opened, so the
 * archive cannot drift out of step with the data.
 */
const WEEKLY_REPORTS: WeeklyReport[] = PROJECTS.flatMap((project) =>
  Array.from({ length: 6 }, (_, n) => {
    const weekStart = MONDAY_OFFSET - (n + 1) * 7;
    return {
      id: `${project.id}-wr-${n}`,
      projectId: project.id,
      weekStart: day(weekStart),
      // Generated Friday 18:00, when Kiran's week closes.
      generatedAt: stamp(weekStart + 4, 18, 0),
    };
  }),
);

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build the full seed.
 *
 * Called on first load and by "Reset demo data". Dates resolve against the day
 * it runs, so a reset in three months still produces a live-looking dataset.
 */
export function buildSeed(): ProjectsState {
  const sap = buildItems(SAP, SAP_ROWS, SAP_CYCLES, SAP_MODULES.map((m) => m.id));
  const ul = buildItems(UL, UL_ROWS, UL_CYCLES, UL_MODULES.map((m) => m.id));
  // Line 4 has been blocked on a late transformer, so nothing has been updated
  // since the week closed. It is the project that trips the freshness flag.
  const cap = buildItems(CAP, CAP_ROWS, CAP_CYCLES, CAP_MODULES.map((m) => m.id), 9);

  const workItems: WorkItem[] = [...sap.items, ...ul.items, ...cap.items];
  const activity: Activity[] = [...sap.activity, ...ul.activity, ...cap.activity];
  const timeEntries: TimeEntry[] = [...sap.timeEntries, ...ul.timeEntries, ...cap.timeEntries];

  // Comments are seeded against known item ids; drop any whose item was removed
  // during editing rather than shipping a thread that points at nothing.
  const itemIds = new Set(workItems.map((item) => item.id));
  const comments = COMMENTS.filter((comment) => itemIds.has(comment.workItemId));

  return {
    seedVersion: SEED_VERSION,
    projects: collect(PROJECTS),
    states: collect([...statesFor(SAP), ...statesFor(UL), ...statesFor(CAP)]),
    labels: collect(LABELS),
    cycles: collect([...SAP_CYCLES, ...UL_CYCLES, ...CAP_CYCLES].map(toCycle)),
    modules: collect([...SAP_MODULES, ...UL_MODULES, ...CAP_MODULES]),
    workItems: collect(workItems),
    comments: collect(comments),
    activity: collect(activity),
    timeEntries: collect(timeEntries),
    weeklyReports: collect(WEEKLY_REPORTS),
  };
}

/** Guard against a people list that no longer contains the seeded ids. */
export const SEED_PEOPLE_OK = [ANJALI, MEERA, VIKRAM, DIVYA, SURESH, NEHA, FARHAN, RAJESH].every(
  (id) => PEOPLE.some((person) => person.id === id),
);
