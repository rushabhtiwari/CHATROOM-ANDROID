# KPAC — master build prompt
# Run Claude Code from C:\Users\prach\pact-automation and paste this whole file,
# or simply say: "Read KPAC_MASTER_PROMPT.md and do everything in it."

## 0. Read before you touch anything

This is an existing, WORKING project. Read these first and do not break them:

- `README.md` — what the system does end to end
- `robot/fill.py` — fills a Windows form via UI Automation (pywinauto) using control ids from a profile
- `verifier/verify.py` — exact read-back check + a Claude vision check on a screenshot, BEFORE anything is saved
- `server/worker.py` — one entry at a time: attach → new → fill → read back → screenshot → verify → save → confirmation
- `server/db.py` (SQLite queue), `server/app.py` (FastAPI), `server/static/index.html` (the page)
- `practice/practice_form.ps1` — a WPF "PACT RevenU - Practice Form" stand-in used for safe testing
- `profiles/practice.json` — the working profile for that practice form
- `profiles/pact_purchase_order.json` — a profile for the REAL PACT Purchase Order screen, already written
- `discovery/20260904_105539_PACT_RevenU.json` — the real UIA control tree the profile was built from
- `scripts/start.ps1` (venv + server), `scripts/run_practice_form.ps1`, `scripts/discover.ps1`

Existing behaviour that must still work at the end: the practice-form flow, `DRY_RUN`, the per-entry run
log with screenshot, `cli.py`, and the OpenClaw skill in `openclaw-skill/`.

## 1. Rebrand and redesign the UI

Product name everywhere: **KPAC — Kiran Pact Automation System**. Browser title `KPAC`.

- Logo: `assets/logo.png` if present; otherwise a clean text wordmark "KPAC" plus a TODO comment.
- Visual style: match `assets/ui-reference.png` if present (colours, spacing, card style, type feel).
  Otherwise a modern light enterprise look — white cards, soft shadow, one accent colour, generous
  whitespace, 10px radius, system font stack.
- Stay a single `server/static/index.html` with inline CSS/JS. No React, no bundler, no CDN dependency
  (it must work with no internet).
- Layout: slim top bar (logo, product name, live pills: profile · worker idle/busy · mode · verifier model)
  → left sidebar: **Dashboard**, **Batches**, **Manual entry**, **Settings** → main content. Works down to 1100px.
- Dashboard: KPI tiles (saved today, failed today, avg seconds per record, batches run), a live
  "Now processing" card showing the current record and which step it is on, and recent activity.
- Status colours + spinner while running, for: pending, approved, filling, verifying, awaiting_save,
  saving, saved, failed, rejected.
- When `DRY_RUN=true`, show a loud yellow banner across the top: "DRY RUN — nothing will be saved".

## 2. Bulk upload → automatic filling → ONE approval → summary

Replace per-row approval with a batch flow.

**Upload.** CSV or .xlsx (add `openpyxl`). Parse and show a **pre-flight table** of every row with
validation done locally BEFORE anything runs:
- required field empty (profile `required: true`)
- combo/lookup value not in the known list — support an optional `"options": [...]` on combo fields;
  add the practice form's cities to `profiles/practice.json` (Mumbai, Pune, Delhi, Bengaluru, Hyderabad, Dubai)
- duplicate key row inside the same file
- malformed values: non-numeric quantity/amount, email without `@`, phone containing letters
Blocking errors are flagged and the row can be excluded with a checkbox. Warnings are shown, not blocking.

**One approval.** A single **"Approve batch & start"** button, with a confirm dialog stating the row count
and the mode (LIVE vs DRY RUN). This is the ONLY human approval in the flow.

**Run.** The worker processes rows in file order, unattended, using the existing
fill → read back → screenshot → verify → save pipeline. Live progress bar `3 / 12 · est. 1m 40s left`,
current row highlighted, updates without a page reload (1s poll or SSE). **Pause** and **Stop after current**.
If the target window is missing, PAUSE the batch and show "Open PACT and log in, then Resume" — do not
fail every remaining row.

**Summary.** On finish, show it automatically: saved / failed / skipped, elapsed, average per record, and a
table of every row with its PACT document number (from `confirmation.record_id`) or the failure reason plus
the verifier's mismatches. Buttons: **Download report (CSV)** and **Download report (printable HTML)**.
Persist batches so past summaries reopen from the Batches list.

**Backend.** Keep `/api/entries/*` working (cli.py and the OpenClaw skill use it). Add:
- `batches` table (id, name, created_at, started_at, finished_at, status [draft|running|paused|stopping|done],
  mode, totals JSON, source filename); `entries` gains `batch_id` and `row_no`
- `POST /api/batches/upload`, `POST /api/batches/{id}/start|pause|resume|stop`,
  `GET /api/batches`, `GET /api/batches/{id}`, `GET /api/batches/{id}/report.csv`, `.../report.html`
- worker: process by batch in row order, respect pause/stop, record per-row duration for ETA and KPIs
- `cli.py` and `openclaw-skill/pact-autofill/SKILL.md`: `batch upload <file>`, `batch start <id>`, `batch status <id>`

## 3. Real PACT Purchase Order support

`profiles/pact_purchase_order.json` describes the real screen. `robot/fill.py` cannot drive it yet.
Add four capabilities, keeping every existing field type working:

1. **`lookup_combo`** (e.g. `lstname` = Vendor Name). A WPF ComboBox whose editable part is a child
   `PART_EditableTextBox`. Focus the child edit, type the value, wait ~400ms for the dropdown to populate,
   confirm with Enter (try Down+Enter as a fallback). Then READ IT BACK and raise a clear error if the value
   did not stick — that means no such vendor exists in the master. Never silently continue.
2. **`date`** (e.g. `DtpVoucherDate`, `4347`, `4352`, `4355`). Editable part is a child `PART_TextBox`.
   Write as `dd/MM/yyyy`.
3. **`tab`**. Fields carrying `"tab": "Extra Fields"` need that tab selected in the `PACTContainer2` tab
   control first. Switch once per tab, not once per field.
4. **Grid entry into `GrdBody`** — the hard part. Rows are virtualised and cells have NO automation ids, so
   keyboard-drive it: focus row 1's *Product Code* cell, type, Tab, type *Qty*, Tab, type *UnitPrice*, Enter to
   commit and advance. Only ever type the columns in `grid.entry_columns`; Product Name, HSN, GST and TOTAL are
   computed by PACT — never type them. `Ctrl+G` (GoToLine) is available for jumping to a row. After each row,
   read it back and verify Product Code and Qty landed; stop the record on mismatch.

Record shape: header fields at the top level plus `line_items: [{product_code, qty, unit_price}]`.
CSV encoding for line items: one column `line_items` holding `CODE|QTY|PRICE` entries separated by `;`.
Add `practice/sample_pact_po.csv` in that shape (leave the product codes as obvious placeholders and note in
the README that real codes from the PACT product master are required).

Update `server/worker.py` so a record containing `line_items` routes through the grid path.

### Safety rules — non-negotiable
- Commit with **Save Draft (`Ctrl+Shift+D`)** only. A draft does not commit to the books.
- **Do NOT wire up the Post button.** Posting commits the document. Leave it defined in the profile, unused.
- The robot NEVER logs into PACT. If the window is missing or shows the Sign In screen, stop and say so.
- If a PACT document shows `(locked)`, click **New** to get a fresh editable draft before filling.
- Keep the verifier gate before every save, and keep `DRY_RUN` honoured everywhere.
- Never print, log, or commit `.env` or the API key.

## 4. Test, document, report

1. Practice form must still pass end to end: `scripts\start.ps1` + `scripts\run_practice_form.ps1`, upload
   `practice/sample_entries.csv`, approve batch, all 4 save, summary appears.
2. Pre-flight must catch a bad file: one row with City `Kolkata` (not in options) and one with an empty
   customer name → both flagged before anything runs.
3. Mid-batch recovery: close the practice form while a batch runs → batch pauses with the "open the window"
   message → reopen → Resume → continues from the next row.
4. Update `README.md`: new name, the batch flow, the PACT profile, and how to switch profiles via `PROFILE=`
   in `.env` after running `discovery/discover.py`.
5. You cannot drive the real PACT window yourself. Write that code carefully, verify the server and page,
   and finish by printing a numbered checklist of exactly what the human clicks to test against real PACT.

Work in small steps. Read a file before editing it. Run the server between steps. When done, print a short
"what changed / how to test" summary.
