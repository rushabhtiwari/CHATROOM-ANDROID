# RTS Backend

Python API behind the Receipt & Reimbursement Tracking System. Serves the React
app's whole data contract, streams live updates to every open window, stores
uploaded receipts, and reads those receipts with Claude.

FastAPI + Pydantic, an in-memory store with a JSON snapshot, and no native
dependencies — nothing to compile on the morning of a demo.

## Run it

From the repository root, `start.ps1` brings up both halves. To run only the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 3001 --reload
```

Interactive API docs: <http://localhost:3001/docs>

## Configuration

Copy `.env.example` to `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Turns on receipt reading. Without it the app still works; the claim form falls back to manual entry. |
| `RTS_EXTRACTION_MODEL` | `claude-haiku-4-5` | Model used to read receipts. Handles images and PDFs natively. |
| `RTS_PORT` | `3001` | The port Vite proxies to. |
| `RTS_ENFORCE_BUDGET` | `false` | When true, Accounts approval is refused if the department has no headroom. Off by default so a long demo cannot dead-end; the shortfall is reported either way. |
| `CALL_ICE_SERVERS` | Google's public STUN server | How two phones on a call find a way to each other: a JSON list of WebRTC ICE servers. Enough as it is on one office network; add a TURN server for calls between networks that block direct connections. |

The key is read server-side only and never reaches the browser bundle.

## How it fits together

```
Browser ──POST /api/…──▶ FastAPI ──▶ Store (memory + data/state.json)
   ▲                                    │
   └──────── SSE /api/events ◀──────────┘   full snapshot per mutation
```

**Live sync.** Every mutation publishes the entire application state to all
connected tabs. The dataset is tens of records, so pushing a full snapshot costs
nothing and removes a whole class of client-side merge bugs: a tab cannot drift,
it can only be current. That is what lets the employee, HR and Accounts windows
move together during the demo.

**Business rules.** `app/workflow.py` mirrors the frontend's `src/lib/status.ts`.
The UI hides actions a team may not take; the server refuses them too, with the
reason. Accounts genuinely cannot act on a claim HR has not cleared.

**The trust boundary.** A reading is a proposal, never a claim. It pre-fills the
form, the employee corrects anything wrong, and their submission creates the
record. Both versions are stored, so the claim detail can show a reviewer that
the employee changed the amount the receipt showed.

**Seed data.** `seed.json` is generated from the frontend's `src/data/mock.ts`,
so the demo opens with exactly the 24 claims, 12 employees and 8 payouts the
design was built around. To regenerate after editing the mock, see the note at
the top of that file.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/state` | The whole world in one call. |
| `GET` | `/api/events` | SSE stream; a full snapshot per mutation. |
| `GET` | `/api/health` | Liveness, record counts, whether reading is configured. |
| `POST` | `/api/requests` | File a claim (draft or submitted). |
| `POST` | `/api/requests/{id}/transition` | Approve, reject, or request information. |
| `GET` | `/api/requests/{id}/headroom` | The department's budget position for a claim. |
| `POST` | `/api/receipts/extract` | Upload receipts, get a claim proposal back. |
| `GET` | `/api/receipts/status` | Whether reading is live, and on which model. |
| `GET` | `/api/payees` | The disbursement queue, grouped by employee. |
| `POST` | `/api/disburse` | Pay every payable claim for one employee. |
| `POST` | `/api/payouts/queue` | Release selected ledger rows to the bank. |
| `POST` | `/api/payouts/{id}/retry` | Requeue a failed payout. |
| `POST` | `/api/employees/{id}/verify-bank` | Mark a bank record verified. |
| `GET` | `/api/receipt-context/{utr}` | Everything the standalone receipt page needs. |
| `POST` | `/api/demo/reset` | Restore the seed so the demo can be run again. |
| `GET` | `/api/calls/events` | SSE stream of call signals for one person's phone (`user`, `device`). |
| `POST` | `/api/calls/signal` | Relay one call signal — invitation, answer, network candidates, hang-up. The audio and video never pass through the server. |
| `GET` | `/api/calls/history` | One person's calls, newest first (`user`). |

## Resetting

`POST /api/demo/reset` (also the "Reset demo data" button on the disbursement
screen) restores the seed. Deleting `data/state.json` and restarting does the
same thing.
