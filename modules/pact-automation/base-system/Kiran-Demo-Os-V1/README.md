# KiranOS

The operations console for **Kiran Cable Protection Products Private Limited**.

One application, one login, one design language. Revenue, purchase, projects and
finance sit alongside two modules that were previously separate products: the
**conversation workspace** and **reimbursement tracking**.

## Run it

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

That brings up the Python API on `:3001` and the console on
<http://localhost:5173>. Leave the window open; Ctrl+C stops both.

## What is where

```
master-frontend/varun/     The console. Everything the client sees.
  src/components/shell/      Sidebar, top bar, command palette
  src/components/common/     DataGrid, StatusPill, PageHeader, Timeline …
  src/components/chat/       The conversation workspace
  src/components/ui/         The ten primitives the chat composes from
  src/pages/                 One directory per area of the business
  src/lib/                   Chat domain: store, transport, seed, mentions
  src/modules/rts/           Reimbursement domain: API client, store, status rules
  src/modules/calendar/      Calendar API client and date arithmetic

backend/                   FastAPI on :3001
  app/routers/receipts.py    Reads receipts with Claude
  app/routers/requests.py    The claim approval chain
  app/routers/payouts.py     Disbursement and the payout ledger
  app/routers/agent.py       The in-conversation assistant (streaming)
  app/routers/meet.py        Google Meet links and Calendar events
  app/routers/calendar.py    The console's own calendar

frontend/                  Superseded. The original standalone reimbursement app,
chatroom/                  Superseded. The original standalone chat app,
                           both kept for reference. Neither is built or served.
demo-receipts/             Three sample bills to drop into a conversation.
```

## The two merged modules

**Conversations** (`/chat`). Rooms, direct messages, threads, mentions,
attachments and a private assistant in every room. Two things were added when it
moved into the console:

- **Claims are filed in the thread.** The receipt button in the composer uploads
  a bill, Claude reads it, the employee corrects anything wrong, and the claim is
  posted to the conversation as a live card. HR and Accounts approve on the card
  itself. The card reads the claim from the server on every render, so it is
  never a stale screenshot.
- **Scheduling is a conversation.** `@agent schedule a meeting` asks one question
  at a time — who, what, which day, what time, how long, anything for the
  invitation — keeps every answer on screen and editable, then shows a review
  card with a single button that creates the Meet link and sends the invitations.

**Reimbursements** (`/reimbursements`). The claim ledger, the HR review queue,
the disbursement run and the payout ledger, plus the payment advice at
`/receipt/:utr`, which is a document rather than a screen and prints as one.

**Calendar** (`/calendar`). Month, week and agenda. Every meeting scheduled from
a conversation lands here, so nobody has to leave the console to see whether a
slot is free.

## PACT Automation Integration

KiranOS integrates directly with the local **PACT Automation worker** (`http://127.0.0.1:8765`), automating ERP record creation, validation, verification, and execution.

### Two-Terminal Startup

To run KiranOS with live PACT Automation:

**Terminal 1 — PACT Automation Worker**:
```powershell
# Run your local PACT Automation worker on port 8765
.\scripts\start.ps1
```

**Terminal 2 — KiranOS Console & API**:
```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```
KiranOS starts the FastAPI backend on `http://127.0.0.1:3001` and Vite frontend on `http://localhost:5173`.

### Safety & Control Workflow Rules

PACT Automation adheres to strict human-in-the-loop safety principles:
- **Zero Silent Mutations**: State-changing operations (creating entries, approving, or rejecting) are never performed without explicit operator confirmation.
- **Record Staging & Verification**: When queuing a record, the assistant extracts and reflects the fields (`Customer`, `City`, `Phone`), asking for confirmation before creating the entry.
- **Operator Review**: Entries start in `pending` status and can only be executed by an operator via the Operations dashboard (`/pact`) or confirmed chat command.
- **Redaction of Secrets**: Sensitive tokens (`PACT_AUTOMATION_TOKEN`, `ANTHROPIC_API_KEY`) are filtered from all user-facing responses and logs.

### Chat & Slash Commands

KiranOS chat serves as the primary natural-language control interface:

| Natural Language Prompt | Slash Command | Action |
| --- | --- | --- |
| "Check PACT status" / "Is PACT currently busy?" | `/pact status` | Checks worker reachability, queue status, active profile, and flags. |
| "Show pending PACT entries" / "Show PACT entries" | `/pact list` | Lists all entries or filtered entries (`pending`, `saved`, `failed`, `rejected`). |
| "Add [Customer] in [City] with phone [Phone] to PACT" | `/pact add {"Customer": "..."}` | Parses record, presents summary, and awaits operator confirmation. |
| "Approve PACT entry [ID]" | `/pact approve [ID]` | Requests confirmation, then approves entry for worker execution. |
| "Reject PACT entry [ID]" | `/pact reject [ID]` | Requests confirmation, then rejects the entry. |
| "Why did PACT entry [ID] fail?" | — | Explains failure status, mismatches, and execution error. |
| "Show the log for PACT entry [ID]" | `/pact log [ID]` | Displays execution log trace for the specified entry. |

## Configuration

Copy `backend/.env.example` to `backend/.env`.

| Variable | Effect when absent / Default |
| --- | --- |
| `ANTHROPIC_API_KEY` | Receipt reading falls back to manual entry; the assistant answers from the transcript and says it has no model. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Meet links are placeholders and the Calendar link is a real pre-filled "add event" URL. The meeting still reaches the console's own calendar. |
| `PACT_AUTOMATION_URL` | Defaults to `http://127.0.0.1:8765`. URL of the local PACT Automation worker service. |
| `PACT_AUTOMATION_TOKEN` | Empty. Optional Bearer token if token authentication is enabled on PACT. |
| `PACT_AUTOMATION_TIMEOUT` | `30` seconds. Request timeout for worker calls. |
| `RTS_ENFORCE_BUDGET` | Off. Accounts approval reports a budget shortfall but does not refuse. |

Nothing dead-ends on a missing key. Every degraded path says what it is rather
than pretending.

## How the halves stay in step

Every mutation publishes the whole application state to all connected tabs over
`/api/events`. The dataset is tens of records, so pushing a full snapshot costs
nothing and removes a class of client-side merge bugs: a tab cannot drift, it can
only be current. That is what makes a claim card in a conversation change at the
moment HR approves it on the finance screen.

The two directories describe the same fourteen people. `src/modules/rts/identity.ts`
is the single place that joins them, and the single place that would change if a
real identity provider arrived.

## Design

Two files drive everything visual — change these, not the pages:

- `tailwind.config.js` — brand palette, neutral ramp, radii, elevation
- `src/index.css` — CSS variables, `.panel` primitives, chat surfaces, motion

The palette is sampled from the company mark. The four fan strands are used
consistently as department rails and as status semantics:

| Token | Hex | Use |
| --- | --- | --- |
| `kiran` | `#06477F` | Primary actions, links, active state |
| `ink` | `#0A2547` | Headings, sidebar ground |
| `strand-red` | `#B5070E` | Revenue rail, overdue, rejected |
| `strand-amber` | `#E9991B` | Operations rail, awaiting a person |
| `strand-green` | `#018F3D` | Finance rail, approved, settled |
| `strand-teal` | `#00AEEF` | Conversations rail, informational |
| `ai` | `#5B46C8` | Model-generated content |

The chat module was authored against a different token vocabulary
(`primary`, `muted-foreground`, `border`). Those names are defined in
`tailwind.config.js` as aliases of the palette above, so the conversation
surface inherits the console's colours by construction rather than by
maintenance. There is one palette, addressed two ways.

## Demo path

Roughly six minutes, one continuous motion:

1. **Chat → Meera Nair.** Receipt button, drop a bill from `demo-receipts/`,
   Claude reads it, correct the amount, send. A claim card appears in the thread.
2. **Top bar → view as Meera Nair.** The same card now offers Approve. Approve it.
3. **View as Vikram Sethi.** Approve at Accounts.
4. **Reimbursements → Disbursement.** One transfer, one UTR. Open the receipt.
5. **Back to chat → `@agent schedule a meeting`.** Answer the questions, schedule.
6. **Calendar.** The meeting is there.

`Reset demo data` on the disbursement screen restores the seed for the next run.
