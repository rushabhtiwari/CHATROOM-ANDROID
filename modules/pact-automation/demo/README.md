# KPAC demo files — real PACT Purchase Order

Three CSVs for demonstrating the batch flow against the **real** PACT RevenU Purchase Order
screen, plus the evidence they were built from.

**Every value in these files was read out of the live PACT window.** Nothing is invented.
`discovered_values.md` records what was read, from which screen, and how — read it first.

| File | What it is for |
|---|---|
| `po_demo_1.csv` | One order, one line item. The smallest thing that proves the whole chain: New → header → Extra Fields → grid → screenshot → verifier → Save Draft → document number. |
| `po_demo_3.csv` | Three orders, the third with two line items. The full batch demo — one approval, three documents, unattended. |
| `po_demo_badrows.csv` | One good row plus four failures: **two caught in pre-flight before anything runs**, **two caught at fill time** against the live masters. |
| `discovered_values.md` | Provenance for every value below, and the three PACT behaviours that shaped the robot. |

## Format

Header fields are columns; line items are one `line_items` column holding
`CODE|QTY|UNITPRICE` entries separated by `;`. Dates are `dd/MM/yyyy`.

```
doc_date,vendor_name,narration,mode_of_transport,transporter,delivery_terms,payment_terms,
supplier_validity,po_validity,party_ref_no,party_ref_date,packing_instruction,
shipping_instructions,line_items
```

Required by the profile: `doc_date`, `vendor_name`, `mode_of_transport`, `transporter`,
`delivery_terms`, `payment_terms`. `party_ref_no` is the duplicate key, so it is unique per row.

## Provenance of every value

| Value used | Where it came from |
|---|---|
| `04/09/2026` (all `doc_date`) | The date **PACT itself writes into Doc Date** on a brand-new document (`DtpVoucherDate` read straight after clicking New). Corroborated by the `S/26-27/09/` document prefix — FY 2026-27, month 09. |
| `30/09/2026` (validity dates) | Same month and financial year; inside the `01/04/2026 – 31/03/2027` accounting period that pre-flight enforces. |
| `Acrofil Industries Private Limited`, `Ad Enterprises`, `Adarsh Patil` | The first three rows of the **vendor master**, read from the `lstname` combo. Each returned a UIA selection count of 1, proving a genuine master row. |
| `46893` — PET MONOFILAMENT YARN 0.22MM BLACK FR 250 DIN | Row 1 of the **product master**, read by committing it into a grid cell and reading the row back. PACT filled HSN `54041200`, units `KGS`, rate **265**. |
| `42010` — SYNTHETIC MONOFILMENT YARN 0.25MM NATURAL WHITE FR | Row 2 of the product master, same method. HSN `54041200`, units `KGS`, rate **0**. |
| `BY ROAD`, `LOCAL TRANSPORT`, `EX WORKS`, `30 DAYS`, `BY AIR`, `BLUE DART`, `FOB`, `15 DAYS`, `45 DAYS` | Free text. Mode of Transport / Transporter / Delivery Terms / Payment Terms were **confirmed to be plain writable `TextBox` controls** (Value + Text patterns, `readonly=0`, no Selection or ExpandCollapse), so any text is accepted. These particular words are ours; the *fields* were verified, not the values. |
| Unit prices `265` and `0` | Each product's **own rate from the product master**, so the file agrees with what PACT will charge. |

## About the unit price ⚠️

`UnitPrice` **cannot be typed on this screen** — for any product. Pressing F2 on the cell opens no
editor at all, and typing is ignored (`46893` stayed at 265 when `300` was typed; `42010` stayed at
`0`). PACT takes the rate from the product master.

So KPAC types only **Product Code** and **Qty**. The price in the CSV is the *expected* price: KPAC
reads back what PACT actually used and records a warning on the row when they differ. It never
fails the row over it, and never pretends to have set it. `po_demo_badrows.csv` row 5 leaves the
price deliberately mismatched so you can see that warning in the summary.

## What each bad row proves

| Row | Vendor | Problem | Caught |
|---|---|---|---|
| 1 | Acrofil Industries Private Limited | none — this one should save | — |
| 2 | *(empty)* | Vendor Name required but empty | **pre-flight** |
| 3 | Ad Enterprises | `line_items` is `46893|ten|265` — qty is not a number | **pre-flight** |
| 4 | ZZ Nonexistent Vendor Pvt Ltd | not in the vendor master | **fill time** — the combo cannot resolve it, so the box clears and the row stops |
| 5 | Adarsh Patil | product code `99999999` is not in the product master | **fill time** — the grid row stays blank, so the row stops |

Rows 2 and 3 are unticked in the pre-flight table before anything runs. Rows 4 and 5 look fine on
paper — only the live masters can reject them, which is exactly why the fill-time read-back exists.

## Running them

With `PROFILE=pact_purchase_order` in `.env` and PACT open on the Purchase Order screen:

```
python cli.py batch upload demo\po_demo_1.csv "PO demo 1"
python cli.py batch start <id>
python cli.py batch status <id>
```

or use the KPAC console: **Batches → New batch → Upload & pre-flight → Approve batch & start**.

Set `DRY_RUN=true` in `.env` to fill and verify every row without ever pressing Save Draft.
Documents are only ever committed with **Save Draft (Ctrl+Shift+D)**; the **Post** button is
never touched.
