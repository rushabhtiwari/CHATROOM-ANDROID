# Discovered values — read out of the live PACT window

Every value below was read from the running PACT RevenU client
(*KIRAN CABLE PROTECTION PRODUCTS PRIVATE LIMITED [Index: 13]*, user *Aniket [Test Trail]*),
on the **Purchase Order** screen, on 4 Sep 2026. Nothing here is invented, and nothing was saved
while discovering it — every probe finished by pressing **New**, which discards the draft.

---

## 1. Product codes

| Code | Product Name (as PACT filled it) | HSN | Units | Rate PACT applies |
|---|---|---|---|---|
| `46893` | PET MONOFILAMENT YARN 0.22MM BLACK FR 250 DIN | 54041200 | KGS | **265** |
| `42010` | SYNTHETIC MONOFILMENT YARN 0.25MM NATURAL WHITE FR | 54041200 | KGS | **0** |

**How they were obtained.** Three routes were tried:

1. **INVENTORY menu → product master.** Clicking `INVENTORY` (top-left, y=7) switched the ribbon
   group to *Sales / Purchase / Generate* but opened no navigable product-master screen. No
   `MenuItem` elements are exposed to UI Automation at all (0 found with the menu closed).
2. **F4 (Load Document) → read an existing saved PO.** F4 changed the document state from
   `[Draft]` to `[Open]` and surfaced a `typeslst` list and a *Pending List* button, but the list
   had **0 children** and no document was loaded — `doc_no` stayed `1` and `GrdBody` stayed empty.
   It also narrowed the grid layout. No product codes came out of it.
3. **The grid's own product-master lookup — this is the one that worked.** The *Product Code*
   cell is itself a lookup against the product master. On a throwaway draft, typing a character
   into the cell and pressing `Down` then `Enter` makes PACT commit a genuine master row, which
   then fills in Product Name, HSN, Units, Purchase Account and the rate. Reading the committed
   row back yields the real code. Repeating with `Down`×2 yields the next one.

   The dropdown ignores the typed prefix (`A`, `B` and `C` all returned the same first row), so
   the two codes above are simply the **first and second rows of the product master**.

> The product dropdown does **not** expose its rows to UI Automation (a `FindAll` for `ListItem`
> over the whole window returns only ribbon split-button data), so the codes could not be read by
> enumeration — only by committing one and reading it back.

## 2. The date window

| Evidence | Value | Where it was read |
|---|---|---|
| Status-bar accounting date | `01/04/2025` | bottom strip, y=995 x=714 |
| **Doc Date PACT puts on a brand-new document** | **`04/09/2026`** | `DtpVoucherDate` immediately after clicking New |
| Calendar "today" marker | `9/4/2026 10:21:53 AM` | Doc Date → Show Calendar popup |
| Document-number prefix (reported by you) | `S/26-27/09/` | — |

**Conclusion: use `04/09/2026`.** It is not an assumption about today's date — it is the value
**PACT itself writes into Doc Date on a fresh document**, and it is corroborated by the
`S/26-27/09/` prefix: financial year **2026-27**, month **09** = September 2026. Financial year
2026-27 runs **01/04/2026 – 31/03/2027**, which is what pre-flight validates against
(`accounting_period` in `profiles/pact_purchase_order.json`).

The status bar's `01/04/2025` is a *different* field — it is not what PACT used to default the
document, so it does not describe the period new documents post into.

⚠️ The DatePicker enforces nothing: every date in the calendar popup renders `enabled=True`, with
no blackout range. The period is enforced by PACT **on save**.

✅ **Confirmed 04/09/2026 13:03.** A real Save Draft with `doc_date = 04/09/2026` was **accepted** —
PACT replied `Saved SuccesfullyDraft Saved At 01:03 PM`. That date is therefore inside the period
PACT actually posts into.

**About the `S/26-27/09/` prefix.** It does *not* appear on a saved draft. Immediately after the
successful Save Draft the screen showed `Doc No = 1` in `txtVoucherNo` and the document state
`[Draft]`; a scan of every rendered `Text` and `Edit` in the window found no `S/...` string at all.
So a draft carries a plain sequence number, and the series prefix is presumably applied when the
document is **Posted** — which KPAC never does. KPAC reports whatever `txtVoucherNo` holds, because
PACT's confirmation banner carries no number of its own.

## 3. Mode of Transport / Transporter / Delivery Terms / Payment Terms — free text ✅

Confirmed directly from the control patterns, on the **Extra Fields** tab:

| Field | auto_id | control | wrapper | patterns | read-only |
|---|---|---|---|---|---|
| Mode of Transport | `4345` | Edit / TextBox | `EditWrapper` | Value, Text | `0` |
| Transporter | `4349` | Edit / TextBox | `EditWrapper` | Value, Text | `0` |
| Delivery Terms | `4350` | Edit / TextBox | `EditWrapper` | Value, Text | `0` |
| Payment Terms | `4351` | Edit / TextBox | `EditWrapper` | Value, Text | `0` |
| Duties and Taxes | `4344` | Edit / TextBox | `EditWrapper` | Value, Text | `0` |

None of them exposes **ExpandCollapse** or **Selection**, which every constrained control on this
screen does. They are plain, writable text boxes — **free text, no accepted-value list**. Confirmed
in practice too: `BY ROAD`, `LOCAL TRANSPORT`, `EX WORKS`, `30 DAYS` were all typed and read back
byte-for-byte.

For contrast, `po_confirmation` (`4356`) *is* constrained — ComboBox with ExpandCollapse +
Selection. It is left unset by the demo files.

## 4. Additional real vendors

Read from the vendor master the same way (`Down`×N then `Enter` on `lstname`, then read back;
each returned UIA selection count 1, proving a genuine master row):

- `Acrofil Industries Private Limited`
- `Ad Enterprises`
- `Adarsh Patil`
- `Adept Motors`

These are simply the first four rows of the vendor master. Names must be reproduced **exactly**;
KPAC refuses anything the master does not contain.

## 5. Unit price is PACT's, not ours ⚠️

**The `UnitPrice` column cannot be typed on this screen — for any product.**

Evidence: pressing `F2` on a `UnitPrice` cell opens **no editor** (`_find_in` for an `Edit` child
returns `None`; the cell exposes neither a Value nor a Text pattern). Typing is simply ignored:

- product `46893`: typed `300` → stayed at its master rate **265**
- product `42010`: typed `250`, committed with Enter *and* with Tab, before and after setting Qty
  → stayed at **0** every time

PACT sources the rate from the product master. So `UnitPrice` is **not** in `grid.entry_columns`;
KPAC types only *Product Code* and *Qty*. The unit price in a CSV is treated as the **expected**
price: KPAC reads back what PACT actually charged and records a warning on the row when they
differ, rather than failing the row or pretending it set the value.

The demo CSVs therefore use each product's real master rate (`46893` → 265, `42010` → 0), except
in `po_demo_badrows.csv` where a deliberate mismatch demonstrates the warning.

## 6. Two PACT behaviours that shaped the robot

Both found by running against the live window, both now handled:

- **PACT resets Qty to `1`.** A Product Code resolves when focus *leaves* the cell; PACT then
  recalculates the row and overwrites Qty with its default. A Qty typed before that is lost
  (`10` came back as `1`). KPAC waits for the recalculation, then verifies the committed row and
  retypes anything that was clobbered.
- **A cell being edited reports stale text to UIA.** Mid-edit, a cell reads back empty or shows
  its previous committed value, so a typed value can only be checked *after* the row is committed.
