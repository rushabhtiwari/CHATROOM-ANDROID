---
name: pact-autofill
description: Queue, approve and monitor data-entry jobs that KPAC (Kiran Pact Automation System) fills into the PACT RevenU client on this PC. Use when the user asks to enter/fill/add records into PACT, run or check a batch, or report what was saved.
---

# KPAC autofill

The KPAC server must be running (`scripts\start.ps1` in C:\Users\prach\pact-automation).
All commands run from that folder with its venv:

```
C:\Users\prach\pact-automation\.venv\Scripts\python.exe C:\Users\prach\pact-automation\cli.py <command>
```

## Batches — the normal way to do volume

Upload → pre-flight → **one** approval → the robot runs the rows unattended, in file order.

- `batch upload <file> ["name"]` — CSV or .xlsx. Validates every row and prints a pre-flight
  report. **Nothing is typed into PACT yet.** Rows marked `BLOCKING` cannot run.
- `batch start <id> [--exclude 3,7]` — the single approval. Excluded rows are recorded as skipped.
- `batch status <id>` — progress, per-row status, PACT document number or failure reason.
- `batch list` — every batch.
- `batch pause <id>` / `batch resume <id>` / `batch stop <id>` — stop is "after the current row".
- `batch report <id> [out.csv]` — download the finished batch report.

Report the batch back to the user as: how many saved, how many failed and why, and the
PACT document numbers.

## Single entries

- `status` — worker idle/busy, which step, which profile, LIVE or DRY RUN
- `list` — all entries with status and PACT document id
- `add '<json>'` — queue one record, e.g. `add '{"customer_name":"Acme","phone":"98200","city":"Pune"}'`
- `approve <id>` — run that one entry (fill → read back → screenshot → Claude verifies → save)
- `reject <id>` / `approve-all`
- `log <id>` — the run log for an entry
- `import <csv>` — legacy: queue every row with no pre-flight (prefer `batch upload`)

## File shape

Column headers must match the active profile's field keys (`status` prints the profile;
the Settings page lists the keys). For a screen with a line-item grid, add one `line_items`
column shaped `CODE|QTY|PRICE; CODE|QTY|PRICE`.

## Rules

- **Never log into PACT.** If the log says "window not found" or "sign-in screen", tell the user to
  open PACT, log in and open the document screen, then `batch resume <id>`.
- A batch **pauses** by itself if the window disappears mid-run. Resume it; it continues from the
  next row. Do not restart the batch from the beginning.
- Purchase Orders are committed with **Save Draft** only. The **Post** button is never used.
  If the user asks to post a document, tell them that has to be done by hand in PACT.
- A vendor or product code that "did not stick" means PACT's master has no such entry. Show the
  user the exact value and ask them to correct the file — do not invent a substitute.
- Do not retry a failed row automatically; show the mismatch and ask.
- After `batch start`, poll `batch status <id>` every ~15s rather than guessing when it is done.
