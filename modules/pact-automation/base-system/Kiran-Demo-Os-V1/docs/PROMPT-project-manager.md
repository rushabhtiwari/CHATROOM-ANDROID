# Build a Plane-style project manager inside KiranOS

Paste this whole file as your first message to Claude Code, or run
`claude` in the repo and say: *"Read docs/PROMPT-project-manager.md and build it,
starting at Step 1."*

---

You are building a new **project management module** inside an existing React +
TypeScript application. Read this entire brief before writing any code. At the
end there is a list of things to confirm with me first — do that, then start at
Step 1 and stop after each step for review.

## 1. The repo you are working in

**Root:** `C:\Users\hp\OneDrive\Desktop\kiran-payment-working-main`

This is **KiranOS**, the internal operations console for Kiran Cable Protection
Products, an Indian automotive-components manufacturer. It is a Vite + React 18 +
TypeScript SPA with a small FastAPI backend. Read `README.md` at the root first —
it is accurate and well written, and it explains the whole application in about
five minutes.

Layout you need to know:

```
master-frontend/varun/        the console — all frontend work happens here
  src/components/shell/         Sidebar, top bar, PageHeader, command palette
  src/components/common/        DataGrid, StatusPill, PageTabs, Timeline, IndianRupee
  src/components/ui/            low-level primitives the chat composes from
  src/components/chat/          the conversation workspace
  src/pages/                    one directory per area of the business
  src/modules/rts/              reimbursement domain: api.ts, store.tsx, status.ts, identity.ts
  src/modules/calendar/         calendar domain
  src/types/index.ts            shared types (large)
  src/data/                     mock data files
  tailwind.config.js            the palette and design tokens
  src/index.css                 CSS variables, .panel primitives, motion
backend/                      FastAPI on :3001 — you will NOT touch this
docs/                         this brief lives here
```

Run it with `powershell -ExecutionPolicy Bypass -File .\start.ps1` from the root.
Backend on `:3001`, console on `http://localhost:5173`.

### Already installed — use these, do not add alternatives

`react` 18 · `react-router-dom` 6 · `tailwindcss` 3.4 · `recharts` 2.15 ·
`date-fns` 3.6 · `lucide-react` · `cmdk` · `@tanstack/react-virtual` ·
`react-markdown` + `remark-gfm` + `rehype-highlight` · `sonner` (toasts) ·
`clsx` + `tailwind-merge` · `class-variance-authority` · `jspdf` ·
Radix: `react-dialog`, `react-dropdown-menu`, `react-tabs`, `react-tooltip`,
`react-slider`, `react-slot`.

**Two dependencies are pre-approved — install them when you reach the step that
needs them:**

- `@dnd-kit/core` + `@dnd-kit/sortable` — for board and list drag-and-drop
  (Step 4). ~6KB, MIT, the community standard. **Do not use
  `react-beautiful-dnd`** — Atlassian deprecated it; no React 19 support, no
  security updates.
- `@svar-ui/react-gantt` — for the Timeline layout (Step 8). MIT free edition,
  backend-agnostic, virtualised, with drag-to-move, drag-to-resize and
  dependencies built in. Do not hand-roll a Gantt chart.

**Any other npm dependency: ask me first.**

## 2. What exists today, and why you are replacing it

There are already two project pages. **They are a demo shell, not a foundation.**

- `src/pages/operations/ProjectsList.tsx` and `ProjectDetail.tsx`
- All data comes from `src/data/projects.ts` — three hardcoded `mockProjects`
- Dates are display strings like `'18 Aug 2026'`, so nothing can sort or compute
  whether something is overdue
- `ProjectDetail.tsx` around line 35 has a hardcoded `burnData` array — every
  project shows the identical cost curve
- The only interactive handlers are `alert('New project initiative')` and
  ``alert(`Downloading ${rep.week} audit summary`)``

Read both files before you start. They contain Kiran-specific ideas worth
keeping — department chips on a project, per-member compliance scores and warning
counts, a weekly report archive, the "not updated since Friday" freshness flag.
Carry those concepts into the new module. Discard the implementation.

Also read `src/types/index.ts` for `ProjectRecord`, `ProjectTask` and
`ProjectMember` (around lines 521–564). Same story: useful vocabulary, too thin
to build on.

## 3. What I want

A **Plane** clone — https://plane.so — living inside KiranOS as a native module.
Plane's feature set, layouts and interaction model, rebuilt from the description
in this brief.

**Do not clone, vendor, install, or read Plane's source code.** It is roughly
half a million lines of Django + Next.js and requires Docker, Postgres, Redis and
MinIO. None of that is going anywhere near this repo. Build from the spec below.

### Hard constraints — these define the whole job

1. **This is a close-ended working demo.** Every button must do something real.
   Nothing may dead-end in an `alert()` or a `TODO`. But it does not need to
   survive a real team using it for a year.
2. **No AI.** No Anthropic API calls, no extraction, no summarisation, no
   suggestions. Not in this build. If you think of a clever AI feature, write it
   in a `docs/ideas.md` and move on.
3. **No backend.** Frontend only. Do not add a router to `backend/`, do not touch
   `backend/app/store.py`, `events.py`, or `seed.json`. See §4 for why.
4. **Not production grade.** No authentication, no permissions, no multi-user, no
   real-time sync, no test suite beyond `npm run typecheck` passing.
5. **Visual consistency with the rest of the console is not required.** If the
   module looks more like Plane than like KiranOS, that is fine and expected.
6. When a decision is between "architecturally correct" and "demoable sooner",
   **pick demoable sooner** and leave a comment saying what you skipped.

## 4. Architecture — deliberately small, and why

The existing backend broadcasts **the entire application state** to every
connected browser tab on every mutation (`backend/app/events.py`), and rewrites
its **whole snapshot JSON file** on every write (`store.py::_persist`). The
README explains the reasoning and it is sound: the reimbursement dataset is a few
dozen records, so a full snapshot removes a whole class of client-side merge
bugs.

A project manager produces thousands of records — work items, comments, activity
entries, time entries — mutating constantly. That design would degrade badly, and
it would degrade as unexplained slowness rather than a clean failure.

Re-architecting it is the right call for production and the wrong call for a
demo. **So keep projects out of the backend entirely.**

Build `src/modules/projects/`, mirroring the shape of the existing
`src/modules/rts/` module so it feels native to the codebase:

```
src/modules/projects/
  types.ts        the data model (§5)
  seed.ts         the demo dataset (§9)
  store.tsx       React context + useReducer, persisted to localStorage
  selectors.ts    grouping, filtering, sorting, rollups — all pure functions
  constants.ts    state groups, priority order, colours, icon mapping
```

Rules for the store:

- One reducer. Every mutation is a dispatched action. No component holds
  authoritative state.
- Persist the whole store to `localStorage` under a single key
  (`kiranos.projects.v1`), debounced ~300ms.
- On mount: read localStorage. If empty, or if the stored `seedVersion` differs
  from `seed.ts`'s, load the seed instead.
- Provide a **"Reset demo data"** action, surfaced as a button in project
  settings and in the command palette. This is what makes the demo close-ended —
  it always returns to a known good state. The disbursement screen already has a
  reset button; match its wording and placement style.
- Dates are stored as ISO strings (`'2026-08-18'` or full ISO timestamps) and
  formatted only at render time with `date-fns`. **Never store a formatted date.**
- Anything derivable is derived in `selectors.ts`, never stored: progress
  percentage, overdue counts, hours spent, cost to date, cycle burndown, and the
  "not updated since Friday" freshness flag.

## 5. Data model

Write this in `types.ts`. IDs are strings (use `crypto.randomUUID()`).

```ts
Project    id, name, key            // key = "SAP", used for item IDs like SAP-42
           description, leadId, memberIds[], departments[]
           startDate, targetDate, status, createdAt

State      id, projectId, name, group, color, order
           // group: 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled'
           // states are per-project data, NOT a TypeScript enum

Label      id, projectId, name, color

Cycle      id, projectId, name, description, startDate, endDate

Module     id, projectId, name, description, leadId, targetDate

WorkItem   id, projectId, sequence          // number; displayed as `${project.key}-${sequence}`
           title, description               // markdown
           stateId
           priority                          // 'urgent'|'high'|'medium'|'low'|'none'
           assigneeIds[], labelIds[]
           startDate, dueDate, estimate      // estimate in points or hours — pick points
           parentId | null                   // sub-items, one level deep only
           cycleId | null, moduleId | null
           createdAt, updatedAt, createdById

Comment    id, workItemId, authorId, body, createdAt
Activity   id, workItemId, actorId, field, from, to, at
TimeEntry  id, workItemId, userId, date, hours, note
```

**People come from `src/modules/rts/identity.ts`** — the existing directory of
fourteen employees, which the README describes as the single place the app's two
people-lists are joined. Do not create a third list of names.

## 6. The Plane look and feel

**Look at `docs/plane-reference/` first.** It holds nine screenshots of Plane's
actual UI — one or more per layout — pulled from their documentation. Read
`docs/plane-reference/README.md` for what each one shows.

**The screenshots are authoritative. The description below is a fallback** for
anything they do not cover. Where the two disagree, follow the screenshots.

What the description adds, mostly about density and interaction:

**Overall:** dense and low-chrome. Small type (13px body, 12px metadata). Tight
row heights (~36px). Mostly neutral greys with colour used only for state dots,
priority icons and label chips. Thin 1px separators rather than cards with
shadows. Generous use of hover states — rows and cards reveal actions on hover.

**Left sidebar:** the console already has one in `src/components/shell/`. Add a
Projects section to it. Each project expands to show its sub-pages: Work Items,
Cycles, Modules, Settings. The active project and page are highlighted.

**Header:** a breadcrumb row (Project ▸ Work Items), then a **second toolbar row**
that is the heart of the module:

- **Layout switcher** — five small icons on the left, one per layout, current one
  highlighted. Remembers the choice per project in localStorage.
- **Filters** button opening a dropdown with State, Priority, Assignee, Label,
  Cycle, Module, Due date. Multi-select. Active filters render as removable chips
  in a strip below the toolbar, with a "Clear all" at the end.
- **Display** dropdown with: Group by, Order by, and toggles for which properties
  appear on each card/row.

**Priority icons** (Plane's are distinctive — draw them with `lucide-react` or
small inline SVG):
- Urgent — filled orange/red rounded square with an exclamation mark
- High / Medium / Low — three ascending signal bars, with 3 / 2 / 1 bars filled
- None — a faint dashed square

**State group icons**, coloured per state:
- Backlog — dashed circle · Todo — empty circle · In Progress — half-filled circle
- Done — filled circle with a check · Cancelled — circle with an ×

**Every property is editable inline.** Clicking a state dot, priority icon,
assignee avatar or label chip opens a small dropdown right there. You should
almost never need to open a work item to change something.

## 7. The five layouts — this is the core of the job

Build **one** hook, `useWorkItems({ filters, groupBy, orderBy })`, returning
grouped and sorted items. Then five presentation components over it. All five
must respond to the same filters and grouping. Grouping options: state, priority,
assignee, label, cycle, module, created by, none.

| Layout | Behaviour |
|---|---|
| **List** | Flat rows under collapsible group headers showing a count. Each row: priority icon, item ID, title, then right-aligned property pills (labels, assignee avatars, due date, state). Sub-items nest under their parent with an expand chevron. Row click opens the peek panel. |
| **Board** | Kanban. One column per value of the grouping field (state by default). Column header shows a coloured dot, name, count, and a `+` to create into that column. Cards show ID, title, and small property pills. **Dragging a card to another column changes that field** — including when grouped by assignee or priority, not just state. |
| **Table** | Spreadsheet. One row per item, one column per property, every cell editable in place. Sticky header. Arrow-key navigation between cells. Column show/hide from the Display dropdown. |
| **Calendar** | Month grid, items placed on their due date. Items with no due date do not appear — show a count of them somewhere so they are not silently lost. Dragging an item to another day changes the due date. Month navigation and a "Today" button. |
| **Timeline** | Gantt. Horizontal bars from start date to due date, rows grouped by module or assignee, a scrollable date axis with a today marker. Drag a bar to move it, drag its edges to resize. **Build this last.** |

Use `@tanstack/react-virtual` for List and Table — these lists get long.

For drag and drop use `@dnd-kit/core` + `@dnd-kit/sortable` (pre-approved).
Do not spend time on native HTML5 drag events — on a kanban they are a known
time sink.

## 8. Screens

```
/projects                          project grid — cards with name, key, lead,
                                   member avatars, progress ring, active cycle
/projects/:id                      → redirect to /items
/projects/:id/items                THE MAIN SCREEN — the five layouts
/projects/:id/cycles               cycle list: active, upcoming, completed
/projects/:id/cycles/:cycleId      that cycle's items in the five layouts,
                                   plus a burndown chart (recharts)
/projects/:id/modules              module list with progress bars
/projects/:id/modules/:moduleId    that module's items in the five layouts
/projects/:id/settings             states, labels, members, reset demo data
```

**Work item detail — the "peek" panel.** Clicking an item opens a panel sliding
in from the right over the current layout, roughly 45% width, with the layout
still visible behind it. Also support a full-page route
`/projects/:id/items/:itemId` for deep links.

Panel contents — left column: item ID and title (editable inline), markdown
description with an edit toggle, a **Sub-items** section (add existing or create
new), **Comments** with markdown, and an **Activity** feed. Right rail: State,
Priority, Assignees, Labels, Start date, Due date, Estimate, Cycle, Module,
Parent — each a label/value row with an inline dropdown.

Use `react-markdown` + `remark-gfm` for descriptions and comments.

**Create work item modal.** Title, markdown description, and every property
inline along the bottom as dropdown buttons. A "Create more" toggle that keeps
the modal open and clears it after each create. Bound to `C` from anywhere.

**Keyboard shortcuts** — a large part of why Plane feels fast:

`C` create item · `/` focus search · `Esc` close panel or modal ·
`1`–`5` switch layout · `Cmd/Ctrl+K` command palette.

The console **already has a command palette** in `src/components/shell/` using
`cmdk`. Extend it with project commands — jump to project, create work item,
switch layout, reset demo data. Do not add a second palette.

## 9. Seed data — make the demo tell a story

Convert the three projects in `src/data/projects.ts` into the new model, then
expand them until every screen has something real to show:

- **3 projects:** SAP S/4HANA migration (key `SAP`), UL94/EV qualification
  (key `UL`), Line 4 braiding capacity expansion (key `CAP`)
- **25–35 work items each**, spread across all five state groups and all
  priorities, with realistic Indian manufacturing task titles in the style of the
  existing mock (ledger reconciliation, HSN/BOM validation, GSTIN scrub, flame
  retardancy testing at CPRI, foundation wiring in Bay 4)
- **Cycles:** on the SAP project, two completed + one active + one upcoming, with
  item completion dates spread through each cycle so the **burndown has a real
  shape**. One active cycle each on the other two.
- **3–4 modules per project**
- **Sub-items** on ~5 items · **comments** on ~10 · **activity entries on
  everything** (created, plus a few state and assignee changes)
- **Time entries** spread across the last six weeks so hours and cost charts are
  genuinely computed, not faked
- **Due dates** clustered around today: some overdue, some this week, some later,
  some with none at all
- Assignees drawn from `identity.ts`, and the Kiran flavour kept — department
  tags on projects, per-member compliance score and warning count, weekly report
  archive entries

The seed is a real deliverable, not an afterthought. A demo with three tasks in
it looks like a prototype; a demo with ninety looks like a product.

## 10. Build order — stop after each step for my review

| # | Build | I should be able to |
|---|---|---|
| 1 | `types.ts`, `constants.ts`, `seed.ts`, `store.tsx`, `selectors.ts`, reset action | Load the app, see data in React DevTools, reload and have it persist, reset it |
| 2 | Project grid + sidebar entries + **List layout** + filters + grouping | Browse projects, open one, filter and regroup a real list |
| 3 | **Peek panel** + create modal + inline property editing everywhere | Create, open, edit and comment on an item; see activity accumulate |
| 4 | **Board layout** with drag between columns | Drag a card and watch its state change — this is the screenshot that sells it |
| 5 | **Table** + **Calendar** layouts | Switch all four layouts on the same filtered set |
| 6 | Cycles + burndown + modules | See an active sprint burn down |
| 7 | Time entries + hours/cost charts + weekly report archive | See the Kiran-specific reporting |
| 8 | **Timeline / Gantt** via `@svar-ui/react-gantt` | Drag a bar to reschedule |

**Steps 1–4 are the demo.** Everything after is depth. If time runs out, stopping
after step 4 must still leave something I can show a client.

## 11. Rules

- **Delete `src/data/projects.ts` and the two old pages at the end of Step 2.**
  No silent fallback to fake data — a fallback that quietly serves mock records
  is how a demo becomes a lie in front of a client.
- Reuse existing components: `PageHeader`, `PageTabs`, `StatusPill`, `DataGrid`,
  `IndianRupee`, the sidebar, the command palette, `sonner` for toasts.
- **No `alert()`.** Ever. `sonner` is installed.
- Money is INR. Use the existing `formatINR` in `src/utils/formatters.ts` and the
  `IndianRupee` component. Lakh/crore formatting where the existing code does it.
- Every property change appends an `Activity` entry. It is cheap and it makes the
  detail panel look alive.
- No new npm dependencies without asking.
- `npm run typecheck` and `npm run build` must pass at the end of every step.
- Keep components under ~300 lines. Split when they grow.
- Do not touch `backend/`, `src/components/chat/`, or `src/modules/rts/` except to
  read `identity.ts`.

## 12. Before you start — confirm these with me

0. **Confirm you can see `docs/plane-reference/`** and that it contains nine
   PNGs. If it is missing or empty, tell me before building any layout — I need
   to run `Get-PlaneScreenshots.ps1` from the repo root first.
1. **Estimates** — story points or hours? I lean points, since time tracking is
   separate. Tell me what you would pick.
2. **Sub-items** — one level deep only, or arbitrary nesting? One level is far
   less work and enough for the demo.
3. Anything in this brief that conflicts with what you find when you read the
   repo. Trust the repo over me and say so.

Then read `README.md`, `tailwind.config.js`, `src/modules/rts/store.tsx`,
`src/components/shell/`, `src/data/projects.ts` and the two old project pages —
and give me a one-page plan for Step 1 before writing it.
