# Modules

Department modules and company tools that ship inside this repository. Each keeps its own source
tree, dependencies and README; the platform registers it in the app catalog so it appears in the
launcher. All of them run on the operator's machine beside the platform, each on its own ports.

| Tile | Module folder | Opens | Made live by |
|---|---|---|---|
| PACT Automation | `pact-automation` | `http://localhost:5173` | migration `0003` |
| Sales, Dispatch, Accounts, Finance, Marketing & RFQ, Purchase, HR, Production, Quality | `kiran-payment` | `http://localhost:5174/d/<department>` | `open-departments.sql` |
| Requisitions & Budget, Automation | `kiran-payment` | `http://localhost:5174/d/requisitions`, `/d/automation` | `open-departments.sql` |
| Chat | `kiran-payment` | `http://localhost:5174/chat` | `open-departments.sql` |
| Projects | `kiran-mgmt` | `http://localhost:3020` | `open-departments.sql` |

## Starting everything

```powershell
powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1          # PACT + workspaces
powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1 -Kcms    # ... and KCMS
powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1 -Stop
```

Services start detached, log to `%TEMP%\central-modules\`, and a port that already answers is left
alone, so the script is safe to run twice. It also applies `open-departments.sql` (below). Run it
from a terminal: with its output piped into another program it never returns, because the detached
services inherit the pipe and keep it open.

### Port map

| Service | Port | Why not the module's default |
|---|---|---|
| Portal / identity / Postgres | 3000 / 8000 / 5433 | the platform itself |
| PACT robot (KPAC) | 8765 | default |
| PACT API / console | 3001 / 5173 | default |
| Workspace API / console | 3011 / 5174 | defaults 3001 / 5173 belong to the PACT console |
| KCMS | 3020 | one container; admin at `/god-mode/`, public pages at `/spaces/`. Default 80 is left alone |

## pact-automation — Kiran PACT Automation System

Vendored from the working copy at `C:\Users\prach\pact-automation`: commit `86247c5` **plus its
uncommitted work** (auto-release, the Gmail domain allow-list, ledger durability, robot and worker
fixes, demo POs for real PACT master customers). That work exists nowhere else — it was never
committed or pushed — so commit it in that repository before anything happens to the disk.

Three processes: the **KPAC robot** (drives PACT RevenU through Windows UI Automation, which is why
nothing here is containerised), the **KiranOS API** (mail watcher, order pipeline, PACT bridge) and
the **console**.

The console has been cut down to the two working halves of the pipeline — everything else from the
original KiranOS console is out of the router and the rail:

- **Mail Monitoring** — Mailing: Emails, On Hold, Analytics
- **PACT Entry** — Order Automation (Orders, KPAC & PACT, Rules) and PACT Automation (`/pact`)

Four files carry that change, all under `base-system/Kiran-Demo-Os-V1/master-frontend/varun/src/`:
`App.tsx`, `components/shell/Sidebar.tsx`, `components/shell/TopBar.tsx`,
`components/shell/CommandPalette.tsx`.

### The order path

1. A PO arrives at the watched Gmail inbox (polled every 60 s) and lands in **Mailing → Emails**.
2. **Order Automation → Orders**: *Approve* (Gate 1) acknowledges the customer and tasks the teams;
   *Run* (Gate 2) writes the PACT draft. With `PACT_AUTO_RELEASE=true` Gate 2 runs by itself.
3. **Mailing → On Hold → Commit as edited** is a different exit: it commits the order to the ledger
   and ends the job *without* touching PACT. Use it for triage, not for PACT entry.

Two things that look like faults and are not:

- **A re-sent PDF does nothing.** Attachments are de-duplicated by SHA-256, silently. A byte-identical
  PDF that has been through once is refused as "the same document forwarded twice".
- **Replies to unknown addresses stay on the ledger.** `may_transmit` only puts mail on the wire for
  reserved demo domains, `DEMO_MAIL_REDIRECT`, `DEMO_MAIL_ALLOWED` and `DEMO_MAIL_ALLOWED_DOMAINS`.

### Configuration

- `.env` — KPAC: port, PACT profile, verifier key. `DRY_RUN=false` + `AUTO_SAVE=true` means rows are
  **saved into real PACT**.
- `base-system/Kiran-Demo-Os-V1/backend/.env` — Gmail address and app password, mail guardrails,
  PACT master and product maps.

### The port the robot wants

`OpenClaw.Tray.WinUI.exe` also binds `127.0.0.1:8765` through Windows' http.sys, and whichever
starts first keeps it. While OpenClaw holds it the robot refuses to start and anything pointed at
8765 gets `origin not allowed` (`Server: Microsoft-HTTPAPI/2.0` is the giveaway; KPAC answers
`server: uvicorn`). It returns at every login via
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OpenClaw Companion.lnk`.

## kiran-payment — the department workspaces and the shared chat

Vendored from the working tree of `Creaitify/kiran-payment-working` (console in
`master-frontend/vd`; the module's own `start.ps1` still points at the deleted
`master-frontend/varun` and no longer works, which is one more reason to use `start-modules.ps1`).
This one console serves every department tile and the chat.

### Workspaces

`/d/<key>` scopes a browser tab to one workspace (`src/lib/workspace.tsx`): it sets the tools on the
rail, the landing page, and the person the console is viewed as. The choice lives in
`sessionStorage`, so it is per tab: two tiles opened side by side stay what their tile said, and a
tab opened on `/chat` alone is only the chat.

| Workspace | Rail | Viewed as |
|---|---|---|
| `sales` | Sales Orders, RFQs, Quotations, Samples, Receivables & Credit, Reports; **PO Mail Monitoring** and **PACT Entry** (links into the PACT console) | Rohan Deshmukh |
| `dispatch` | Dispatch Board, Sales Orders, GRN Follow-up | Sunita Barve |
| `accounts` | Accounts Overview, Bank Reconciliation, Payables, Claims, **Disbursement**; PACT Entry | Vikram Sethi |
| `finance` | Receivables, Reports & MIS, Budget Allocation, Claims Ledger | Deepak Rao |
| `marketing` | Enquiries, RFQs, Quotations, Samples | Sneha Kulkarni |
| `purchase` | Overview, Requests, Vendor Comparison, POs, GRN, Requisitions; PO Mail Monitoring, PACT Entry | Sunita Barve |
| `hr` | HR Overview, Employees, Leave, Attendance, **Claims Review**, Claims Ledger | Meera Nair |
| `production` | Production Plan, Projects, Requisitions; Project Management (link to KCMS) | Farhan Qureshi |
| `quality` | Inspections, Samples, Incoming GRN | Imran Shaikh |
| `requisitions`, `automation` | the two company tools of the same name | unchanged |

Every rail ends with the same **Connect** group: Chat, Calendar, Activity. The identity switcher in
the top bar still lets one presenter become anyone. The identity is shared by all tabs of the
browser (it lives in the chat store), so opening a second department tile switches the first tab's
person too; the rail of each tab does not change.

Pages of the original console that belong to no workspace (Command Center, Comms Hub, Ask Kiran, AI
Control Plane, Integrations, Administration, Settings) are out of the router; their files are still
in `src/pages`.

### Expense claims are not a module

There is no Reimbursements tile. A claim is filed **in the chat** (receipt button in the composer),
HR reviews it in the HR workspace or on the card in the thread, Accounts approves and disburses it
in the Accounts workspace, and the payment advice is at `/receipt/<utr>`.

### How departments hear about each other

- Every claim transition raises notifications server-side (`backend/app/store.py`). Accounts
  approving, querying, rejecting or **disbursing** a claim notifies HR as well as the employee.
- **Activity** (`/activity`, and the bell) is that feed for all departments, filterable by
  department and "for me". A leave decision in HR goes to the employee through the same feed.
- Activity also shows the **order pipeline** read from the PACT API (proxied at `/pact-api`):
  orders awaiting approval, with Accounts, PACT drafts, completed, and whether the robot is online.
- The PACT console has a **Team Chat** link back to the shared chat.
- State is pushed to every open tab over `/api/events`, so the HR tab changes when Accounts pays.

Leave, attendance, the production plan and inspections are demo data held in the browser; employees,
claims, payouts and notifications are live from the API. Chat rooms and messages are kept in the
browser too (the module's transport is a local simulation), so they are shared between tabs of one
browser, not between machines.

### Changes made to the module

- `master-frontend/vd/vite.config.ts` reads `KIRAN_API` / `KIRAN_PORT` (defaults 3001 / 5173) and
  proxies `/pact-api` to `PACT_API` (default `http://127.0.0.1:3001`).
- New: `src/lib/workspace.tsx`, `src/modules/hr/leave.ts`, `src/pages/{activity,people,production,quality}`,
  `src/vite-env.d.ts`. Rewritten: `src/App.tsx`, `src/components/shell/Sidebar.tsx`. Edited:
  `src/main.tsx`, `src/components/shell/{TopBar,CommandPalette}.tsx`.
- Backend: HR notifications in `app/store.py`; `app/routers/agent.py` names a no-credit account.

Receipt reading and the chat assistant (`@agent`) call Anthropic with `ANTHROPIC_API_KEY` from
`backend/.env`. A key whose account has no credit authenticates but every call is refused; the
assistant then says so in the thread.

## kiran-mgmt — Project Management (KCMS)

Vendored from `Creaitify/KIRAN-MGMT` (a Plane CE 1.4.2 fork), and run as **one container**:

```powershell
docker compose -f modules\kcms.compose.yml up -d --build    # first build: about 15 minutes
docker exec kcms kcms-seed-demo                              # optional: the Kiran demo workspace
```

`start-modules.ps1 -Kcms` runs the first line for you. The app is at `http://localhost:3020`, the
instance admin at `http://localhost:3020/god-mode/`.

### What is in the container

`kiran-mgmt/deployments/kcms/` holds the image: `Dockerfile`, `start.sh`, `supervisor.conf`,
`Caddyfile`, `seed-demo.sh`. The web, admin, space and live apps are **built from this repository's
source** (the stock all-in-one image in `deployments/aio` pulls upstream Plane images and would lose
the KCMS work). A supervisor then runs, all on the container's loopback:

| Process | Role |
|---|---|
| PostgreSQL 16 | database, trusted local connections, never published |
| Valkey | cache, sessions, **and the Celery broker** |
| MinIO | uploaded files, reached through the proxy at `/uploads` |
| migrator, api, worker, beat | the Django backend |
| space, live | public pages and real-time collaboration (Node) |
| Caddy | the one published port; serves the web and admin bundles from disk |

There is no RabbitMQ. Plane passes `AMQP_URL` straight to Celery as its broker URL, so pointing it
at Valkey (`redis://127.0.0.1:6379/1`) removes the service without touching the code.

All state is in the `kcms_kcms-data` volume (`/data`: `postgres/`, `minio/`, `valkey/`, and
`kcms.env`, the secrets generated on first boot). `docker logs kcms` shows every process.

### Settings

`kiran-mgmt/kcms.env` (not committed) carries the AI assistant's `LLM_PROVIDER`, `LLM_MODEL` and
`LLM_API_KEY`, and the `DEMO_PASSWORD` the seeder gives the demo users
(`admin@kirancableppl.com` and four others). The server itself runs with `DEBUG=0`; the seeder
insists on `DEBUG`, so `kcms-seed-demo` switches it on for that one command only.

### Why the labels were missing before

`packages/i18n/locales` is a symlink to `src/locales` in git, and the built `@plane/i18n` imports
`../locales/<lang>/<namespace>.json` through it. Git on Windows checks a symlink out as a small text
file, so on this machine no translation could ever load and every label fell back to its key
(`your_work`, `drafts`, a lower-case "good afternoon", blank menu entries). The image build
recreates the link before building, which is the whole fix. It is also why the four `pnpm` dev
servers are gone: they had the same fault, and compiled every screen on first visit.

The image installs with pnpm 9.15.4 rather than the pnpm 11 that `package.json` names: the committed
lockfile predates the `overrides` block in `pnpm-workspace.yaml`, which pnpm 11 refuses to install
against with `--frozen-lockfile`.

## How tiles go live

`pact-automation` is a new catalog row, so migration `0003` adds it the way `0002` added the rest of
the catalog, idempotent by slug.

Everything else was already in the catalog as "coming soon". Taking a tile live is an admin action
in this platform (Admin > Apps: address, callback URL, Live), and `open-departments.sql` is that
action scripted: data for this installation, not schema. The catalog that `0002` seeds is unchanged
in code, so the platform's own tests still describe it. The script only touches tiles that are
still "coming soon", so an address changed in Admin > Apps is never overwritten.

None of the modules speaks OpenID Connect yet, so each live row keeps the unusable client secret
hash `'!'` and a placeholder callback URL; the placeholder exists because the admin pages refuse
every edit to a Live app that has no callback URL.

| Tile | Who sees it |
|---|---|
| A department tile | that department (seeded by `0002`) |
| Chat, Projects, Requisitions & Budget, Automation | every department (seeded by `0002`) |
| PACT Automation | Purchase, Accounts (`0003`) and Sales (`open-departments.sql`) |

```bash
docker compose up -d --build identity     # applies migrations: the container runs `alembic upgrade head`
docker compose exec -T postgres psql -U central -d identity < modules/open-departments.sql
```

The portal's own Playwright specs expect the seeded state (Sales "Coming soon"), so they are for a
database where this script has not been run.
