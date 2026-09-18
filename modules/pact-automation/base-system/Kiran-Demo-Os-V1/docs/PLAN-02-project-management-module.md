# Brief 02 — A Plane-style project manager inside KiranOS

**For:** Claude Code
**Repo:** `C:\Users\hp\OneDrive\Desktop\kiran-payment-working-main`
**Reference for look and feel:** https://plane.so (do not clone, do not vendor,
do not read its source — build from the description below)

---

## Scope — read this first, it defines everything

- **A close-ended working demo.** Every button does something. Nothing dead-ends
  in an `alert()`. But it does not have to survive a real team.
- **No AI.** No Claude calls, no extraction, no summaries. Not in this build.
- **No backend.** Frontend only. See §2.
- **Not production grade.** No auth, no permissions, no multi-user, no tests
  beyond typecheck. Don't build for a second client.
- Looking different from the rest of the console is acceptable.

If a decision is between "correct" and "demoable this week", pick demoable.

---

## 1. What exists today — replace it

`src/pages/operations/ProjectsList.tsx` and `ProjectDetail.tsx` look like a
product but are a shell:

- Data is `mockProjects` in `src/data/projects.ts` — three hardcoded records.
- Dates are display strings (`'18 Aug 2026'`), so nothing can sort or compute
  overdue.
- `ProjectDetail.tsx` ~line 35: `burnData` is hardcoded — every project shows the
  same cost curve.
- The only handlers are `alert('New project initiative')` and
  `alert('Downloading …')`.

Keep them as a visual reference for the Kiran-flavoured bits (department chips,
compliance scores, weekly report archive). Replace the rest.

---

## 2. Architecture — deliberately small

**Frontend only. Do not add a backend router for this.**

The existing backend broadcasts the entire app state on every mutation and
rewrites its whole snapshot file per write (`backend/app/events.py`,
`store.py::_persist`). That is a good trade at tens of records and a bad one at
the thousands a project manager produces. Rather than re-architect it for a demo,
keep projects out of it entirely.

Build `src/modules/projects/` mirroring the shape of `src/modules/rts/`:

```
src/modules/projects/
  types.ts      the data model (§3)
  seed.ts       the demo dataset (§6)
  store.tsx     React context + reducer, persisted to localStorage
  selectors.ts  grouping, filtering, sorting, rollups
```

- All state in one reducer. Every mutation goes through it.
- Persist to `localStorage` under one key, debounced ~300ms.
- On load: read localStorage; if empty or the seed version changed, load `seed.ts`.
- Ship a **"Reset demo data"** button, same as the disbursement screen has. This
  is what makes it close-ended — the demo always returns to a known state.
- Dates: store ISO strings (`'2026-08-18'`), format at render with `date-fns`
  (already installed).

---

## 3. Data model

```
Project    id, name, key (e.g. "SAP"), description, lead, members[],
           departments[], startDate, targetDate, status
State      id, name, group ('backlog'|'unstarted'|'started'|'completed'|'cancelled'),
           color, order            — per project, not a global enum
Label      id, name, color
Cycle      id, projectId, name, startDate, endDate
Module     id, projectId, name, description, lead, targetDate
WorkItem   id, projectId, sequence (KIRAN-42), title, description,
           stateId, priority ('urgent'|'high'|'medium'|'low'|'none'),
           assigneeIds[], labelIds[], startDate, dueDate,
           estimate, parentId|null, cycleId|null, moduleId|null,
           createdAt, updatedAt
Comment    id, workItemId, authorId, body, createdAt
Activity   id, workItemId, actorId, field, from, to, at
TimeEntry  id, workItemId, userId, date, hours, note
```

People come from `src/modules/rts/identity.ts` — the existing directory. Do not
create a third list of names.

Anything derivable is derived, never stored: progress %, overdue count, hours
spent, cost to date, "not updated since Friday".

---

## 4. The five layouts — this is the core of the job

Plane's identity is that the same filtered set of work items renders five ways
and you switch instantly. Build one `useWorkItems(filters, grouping)` hook and
five presentation components over it.

| Layout | What it does |
|---|---|
| **List** | Flat rows under collapsible group headers. Group by state / priority / assignee / label / module / cycle. Sub-items nest under parents. Inline property edits. |
| **Board** | Kanban. Columns = the grouping field (state by default). Drag a card between columns to change that field. Column headers show counts. |
| **Table** | Spreadsheet. One row per item, one column per property, all editable in place. Keyboard navigation. |
| **Calendar** | Month grid by due date. Items without a due date don't appear. Drag to a different day to change the due date. |
| **Timeline** | Gantt. Bars from start to due date, grouped by module or assignee. Drag to move, drag the edge to resize. **Build this last** — it's the most work and least used. |

Shared across all five, in a header bar:

- **Layout switcher** — five icons, remembers your choice per project.
- **Filters** — state, priority, assignee, label, cycle, module, due date range.
  Multi-select, shown as removable chips.
- **Group by** and **Order by** dropdowns.
- **Display options** — which properties show on a card/row.

`@tanstack/react-virtual` is installed; use it for List and Table.

## 5. Screens

```
/projects                        project grid — name, lead, members,
                                 progress ring, cycle status
/projects/:id                    redirects to the work items view
/projects/:id/items              THE MAIN SCREEN — the five layouts
/projects/:id/cycles             cycle list + active cycle burndown
/projects/:id/cycles/:cycleId    that cycle's work items (same five layouts)
/projects/:id/modules            module list with progress bars
/projects/:id/modules/:moduleId  that module's work items
/projects/:id/settings           states, labels, members
```

**Work item detail** opens as a right-side peek panel over the layout (Plane's
behaviour), with a full-page route as a fallback. Left: title, markdown
description, sub-items, comments, activity feed. Right rail: state, priority,
assignee, labels, dates, estimate, cycle, module, parent.

`react-markdown` + `remark-gfm` are installed for the description and comments.

**Create work item** as a modal: title, description, and every property inline —
plus a "create more" toggle that keeps the modal open. Bind it to `C`.

Keyboard shortcuts, because it's most of why Plane feels fast:
`C` create · `/` search · `Esc` close panel · `1–5` switch layout ·
`cmd/ctrl+K` command palette. `cmdk` is already installed and the console already
has a palette in `src/components/shell/` — extend that rather than adding one.

## 6. Seed data — make the demo tell a story

Convert the three existing projects from `src/data/projects.ts` into the new
model, then flesh them out so every screen has something to show:

- 3 projects: SAP migration, UL/EV qualification, Line 4 expansion
- ~25–35 work items each, across all five state groups
- 2 completed cycles + 1 active + 1 upcoming on the SAP project, so the burndown
  has a real shape and cycle history exists
- 3–4 modules per project
- sub-items on ~5 items, comments on ~10, activity on everything
- time entries spread over the last 6 weeks so cost and hours charts are real
- a spread of due dates around today, including overdue and this-week

Keep the Kiran flavour from the existing mock: department chips, real member
names, the compliance score and warning fields, the weekly report archive.

## 7. Order of work

| Step | Build | Demoable |
|---|---|---|
| 1 | `types.ts`, `seed.ts`, `store.tsx`, reset button | Data loads, survives reload |
| 2 | Project grid + List layout + filters/grouping | Browse and filter real work |
| 3 | Work item detail panel + create modal + inline edits | Full CRUD |
| 4 | Board layout with drag | The screenshot that sells it |
| 5 | Table + Calendar layouts | Layout switching feels real |
| 6 | Cycles + burndown + modules | Sprint story |
| 7 | Time entries, cost/hours charts, weekly report archive | The Kiran-specific asks |
| 8 | Timeline/Gantt | Complete |

Steps 1–4 are the demo. 5–8 are depth. Stop wherever the deadline lands.

## 8. Rules

- **Delete `src/data/projects.ts` at step 1.** No silent fallback to fake data.
- No new npm dependencies without asking — everything needed is installed
  (`recharts`, `date-fns`, `cmdk`, `@tanstack/react-virtual`, `react-markdown`,
  `sonner`, `lucide-react`, radix primitives). Drag-and-drop is the one likely
  gap: try HTML5 drag events first, and ask before adding `dnd-kit`.
- Reuse `src/components/common/` (`DataGrid`, `PageTabs`, `StatusPill`,
  `Timeline`) and `src/components/shell/` (`PageHeader`, sidebar, palette).
- No `alert()`. `sonner` is installed for toasts.
- Every property change appends an Activity entry — it's cheap and it makes the
  detail panel look alive.
- `npm run typecheck` and `npm run build` clean at every step.
