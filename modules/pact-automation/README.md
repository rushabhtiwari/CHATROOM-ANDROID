# KPAC — Kiran Pact Automation System

Upload a file of records → check the pre-flight table → **approve once** → a robot types every row
into PACT RevenU, reads it back, screenshots it, has Claude verify it, and only then saves →
you get a summary with each row's PACT document number.

The robot does **not** click by screenshot. PACT RevenU is a WPF app, so every field has an
internal automation id; the robot sets values by id via Windows UI Automation (pywinauto).
Fast, exact, repeatable. The one place ids do not exist — the line-item grid — is driven by
keyboard and read back cell by cell.

## Folder layout

```
pact-automation/
  practice/        Fake PACT-lookalike form (WPF via PowerShell) to demo without a PACT login
                   sample_entries.csv, sample_entries_bad.csv (pre-flight demo), sample_pact_po.csv
  discovery/       discover.py dumps any window's control tree -> used to build a form map
  profiles/        form maps: which field goes to which control id (practice.json, pact_*.json)
  robot/           fill.py - fills a form from a profile + record; Save Draft on command
  verifier/        verify.py - read-back check + Claude screenshot check, before Save
  server/          FastAPI backend, SQLite queue, batch runner, reports, and the KPAC console
                   (static/index.html - one file, inline CSS/JS, works with no internet)
  openclaw-skill/  skill so the OpenClaw agent can drive batches from chat
  scripts/         start.ps1 (setup + run), run_practice_form.ps1, discover.ps1
  logs/            run logs
```

## First run (practice form, no PACT login needed)

1. Install Python 3.10+ from python.org (tick "Add python.exe to PATH").
2. Copy `.env.example` → `.env`, paste your Anthropic API key.
3. In PowerShell, inside this folder:
   ```
   .\scripts\start.ps1
   ```
   First run creates a venv and installs packages, then opens http://127.0.0.1:8765 — the KPAC console.
   If the port is busy or reserved by Windows, `start.ps1` says so; change `PORT=` in `.env`.
4. In a second PowerShell window:
   ```
   .\scripts\run_practice_form.ps1
   ```
   A "PACT RevenU - Practice Form" window opens. Leave it visible.
5. In the console: **Batches → New batch → Upload & pre-flight** with `practice\sample_entries.csv`,
   then **Approve batch & start**. Watch the four rows fill, verify and save, then read the summary.

Try `practice\sample_entries_bad.csv` to see pre-flight refuse bad rows before anything runs.

## The batch flow

| Step | What happens | Who acts |
|---|---|---|
| Upload | CSV or `.xlsx` is parsed; every row is checked against the profile | you pick the file |
| Pre-flight | required-but-empty fields, values outside a combo's list, duplicate keys inside the file, non-numeric amounts, emails without `@`, phones with letters. Blocking rows are unticked; warnings are shown but do not block | you review, untick anything else |
| **Approve batch & start** | the one and only human approval; the confirm dialog states the row count and LIVE vs DRY RUN | you click once |
| Run | rows run in file order, unattended: fill → read back → screenshot → verify → Save Draft → capture the document number. Live progress `3 / 12 · est. 1m 40s left`, current row highlighted | nobody |
| Pause / Stop after current | pause and resume at any time; if the target window disappears the batch **pauses itself** and says "Open PACT and log in, then Resume" — the remaining rows are untouched | you, if needed |
| Summary | saved / failed / skipped, elapsed, average per record, every row with its PACT document number or the failure reason and the verifier's mismatches. **Download report (CSV)** and **(printable HTML)**. Past batches reopen from the Batches list | you read it |

`DRY_RUN=true` in `.env` puts a loud banner across the console; rows are filled and verified but
Save is never pressed, and they finish as *skipped* with "DRY RUN - verified OK, nothing was saved".

For a batch, the approval **is** the approval: `AUTO_SAVE` only applies to one-off entries added on
the Manual entry page (or by `cli.py add`).

### Speed

One `Robot` is attached for the whole batch and its resolved-control cache survives from row
to row. That matters more than it sounds: a cold UI Automation resolve on the PACT screen
costs 2-9 seconds per control (see the note above `Robot._condition` in `robot/fill.py`), and
building a fresh `Robot` per row — which is what the worker used to do — re-paid that for
every field of every row.

`VERIFY_MODE` in `.env` controls how often the Claude vision check runs: `every` (per row),
`first` (once per batch, the default) or `off`. The exact read-back check is local, free and
always runs, whatever this says — only the screenshot call is turned down.

To measure it against the real window:

```
python scripts\measure_speed.py --profile pact_purchase_order --rows 3
```

It fills the same rows twice, once rebuilding the `Robot` per row and once reusing it, and
prints seconds per entry for each. Nothing is ever saved. `COLD_CACHE_EACH_RECORD=true`
restores the old per-row behaviour if a batch ever fills a row with the previous row's values.

Nothing here touches PACT's own cold start. Open PACT and log in before a demo, not during.

## File shape

Column headers must match the active profile's field keys — the **Settings** page lists them,
with which are required and which have a fixed list of allowed values.

Practice form:

```csv
customer_name,phone,email,city,credit_limit,active,notes
Sharma Traders,9820011223,accounts@sharmatraders.in,Mumbai,50000,true,Net 30 terms
```

A screen with a line-item grid (e.g. the Purchase Order) takes one extra column, `line_items`,
holding `CODE|QTY|PRICE` entries separated by `;`:

```csv
doc_date,vendor_name,mode_of_transport,transporter,delivery_terms,payment_terms,line_items
04/09/2026,ACME CABLES PVT LTD,By Road,Local Transport Co,Ex-works,30 days,PRD-001|10|250; PRD-002|4|1200
```

See `practice/sample_pact_po.csv`. **Its vendor names and product codes are placeholders.**
Real codes from the PACT product master and real names from the vendor master are required —
a value PACT cannot resolve does not stick, and KPAC stops that record rather than saving a wrong one.

## The real PACT Purchase Order

`profiles/pact_purchase_order.json` maps the real screen (built from
`discovery/20260904_105539_PACT_RevenU.json`, company *KIRAN CABLE PROTECTION PRODUCTS PVT LTD*).
Four things there are unlike the practice form, and `robot/fill.py` handles each:

- **`lookup_combo`** (Vendor Name, `lstname`) — a WPF ComboBox whose editable part is a child
  `PART_EditableTextBox`. Two live-screen behaviours shape how KPAC drives it: the combo queries
  the master on every text change and **drops keystrokes** while that query is in flight, and it
  is editable, so text matching nothing can simply sit in the box. KPAC therefore puts all but the
  last character in through the ValuePattern and *types* only the final character, so the dropdown
  filters on the complete value; then Enter. PACT commits a true match (UIA selection count 1) or
  **clears the box** (count 0). KPAC requires both the exact text and a real selection, so a name
  the master does not contain stops the record with a message naming the value.
  Down+Enter is deliberately **not** used as a fallback: on this screen it selects the first row of
  the *unfiltered* list, which would enter a real but completely wrong vendor.
- **`date`** (`DtpVoucherDate`, `4347`, `4352`, `4355`) — a WPF DatePicker whose editable part is a
  child `PART_TextBox`. Written as `dd/MM/yyyy`; `dd-MM-yyyy` and `yyyy-MM-dd` in your file are
  converted for you.
- **`tab`** — fields carrying `"tab": "Extra Fields"` need that tab picked in the `PACTContainer2`
  tab control. KPAC groups fields by tab and switches once per tab, not once per field.
- **Grid `GrdBody`** — rows are virtualised and cells have no automation ids, so it is keyboard
  driven: focus row 1's *Product Code* cell, type, Tab across to *Qty*, Tab to *UnitPrice*, Enter to
  commit and advance. Only the columns in `grid.entry_columns` are ever typed — Product Name, HSN,
  GST and TOTAL are computed by PACT. After each row KPAC reads the row back and stops the record
  if Product Code or Qty did not land. `Ctrl+G` (GoToLine) is used only as a fallback for a row the
  grid has not realised.
  A row's child list contains 0×0 placeholders for columns WPF has not realised, so a cell's index
  in that list means nothing; KPAC matches every cell to its column by **screen geometry**
  (left edge and width against the header row), which also survives horizontal scrolling.

### Safety rules baked in

- Documents are committed with **Save Draft (`Ctrl+Shift+D`)** only. A draft does not commit to the books.
- The **Post** button is defined in the profile but deliberately **not wired up**; asking the robot to
  run it raises an error. Post by hand in PACT if you want to commit.
- The robot **never logs into PACT**. If the window is missing or shows a sign-in screen it stops and
  says so (and a batch pauses instead of failing every row).
- A document showing `(locked)` gets a **New** click first, so filling always happens on a fresh draft.
  PACT keeps a hidden 0×0 `(locked)` label in the tree permanently, so KPAC checks that it is
  actually *rendered* — otherwise every record would trigger a needless New.
- The verifier gate runs before every save. Mismatch → the row is Failed and nothing is saved.
  `VERIFY_MODE` changes how often the *vision* half of it runs; the read-back half always runs.
- `DRY_RUN` is honoured everywhere.
- `.env` and the API key are never printed, logged or committed.

## Switching profiles

1. Log into PACT yourself and open the data-entry screen you want.
2. Dump its control tree:
   ```
   python discovery\discover.py --title "PACT RevenU"
   ```
   (or `.\scripts\discover.ps1 "PACT RevenU"`) — writes `discovery\<timestamp>_<title>.json`.
3. Build `profiles\pact_<form>.json` from that dump — see `profiles/README.md` for every key
   (`fields`, `options`, `tabs`, `grid`, `actions`, `confirmation`, `duplicate_key`).
4. Set `PROFILE=pact_<form>` in `.env`.
5. Either restart `start.ps1`, or press **Reload .env** in the KPAC top bar. The Settings page then
   lists the new field keys — those are your file's column headers.

## From a terminal / from OpenClaw

```
python cli.py batch upload practice\sample_entries.csv "Morning run"
python cli.py batch start 3 --exclude 5,9
python cli.py batch status 3
python cli.py batch report 3
python cli.py status | list | add '<json>' | approve <id> | log <id>
```

The single-entry API (`/api/entries/*`) is unchanged, so anything already built on it keeps working.
