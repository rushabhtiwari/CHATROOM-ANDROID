# Profiles = form maps

A profile tells KPAC which record field goes to which control on screen, and which column
headers your CSV/XLSX needs. One profile per PACT screen. Build it from `discovery\discover.py`
output. Pick the active one with `PROFILE=<file name without .json>` in `.env`.

```json
{
  "window": { "title_re": "PACT RevenU - Practice Form" },
  "duplicate_key": ["customer_name"],
  "fields": {
    "customer_name": { "auto_id": "txtCustomerName", "type": "edit",  "required": true },
    "city":          { "auto_id": "cmbCity",         "type": "combo",
                       "options": ["Mumbai", "Pune", "Delhi"] },
    "active":        { "auto_id": "chkActive",       "type": "check" }
  },
  "actions": {
    "new":  { "auto_id": "btnNew",  "type": "button" },
    "save": { "auto_id": "btnSave", "type": "button" }
  },
  "confirmation": {
    "auto_id": "lblStatus",
    "success_re": "^Saved: (?P<record_id>.+)$",
    "error_re":   "^Error"
  },
  "verify_labels": { "customer_name": "Customer Name", "city": "City", "active": "Active" }
}
```

## Locators

`auto_id` (preferred), `name` (the control's visible name), or `title_re`. Add
`"found_index": 0` when a name matches more than one control — this happens with WPF ribbon
buttons, where the Button itself is unnamed and its child TextBlock carries the label.

## Field types

| type | control | notes |
|---|---|---|
| `edit` | TextBox | set through the ValuePattern, exact |
| `combo` | ComboBox with a fixed list | give it `"options": [...]` so pre-flight can reject a bad value before the run |
| `check`, `radio` | CheckBox / RadioButton | `true/false/yes/no/1/0` |
| `date` | WPF DatePicker | the editable part is a child `PART_TextBox`; written as `dd/MM/yyyy` (set `"child_edit"` if it differs) |
| `lookup_combo` | ComboBox backed by a PACT master (vendor, product) | editable part is a child `PART_EditableTextBox`. KPAC types, waits `dropdown_wait_ms` (default 400), presses Enter, then reads it back. A value that does not stick stops the record — the master has no such row |

Any field may carry `"tab": "<tab name>"`. KPAC groups fields by tab and selects each tab once.
Any field may carry `"validate"`: `number`, `email`, `phone`, `date` or `text`, overriding the
name-based guess pre-flight otherwise makes.

## Optional top-level keys

- `duplicate_key` — the field(s) that make a row unique, so pre-flight can flag duplicates
  *inside one uploaded file*. Defaults to the first required field.
- `date_format` — strftime format for `date` fields. Default `%d/%m/%Y`.
- `tabs` — `{ "container": "<tab control auto_id>", "names": [...] }`. Required if any field has a `tab`.
- `locked_marker` — text that appears when the open document is read-only (PACT shows `(locked)`).
  KPAC clicks **New** first when it sees it.
- `grid` — a line-item DataGrid whose cells have no automation ids:

  ```json
  "grid": {
    "auto_id": "GrdBody",
    "columns":  ["", "#", "Approval Status", "Product Code", "...", "TOTAL"],
    "entry_columns": ["Product Code", "Qty", "UnitPrice"],
    "item_keys": { "Product Code": "product_code", "Qty": "qty", "UnitPrice": "unit_price" },
    "verify_columns": ["Product Code", "Qty"],
    "lookup_columns": ["Product Code"],
    "commit_key": "{ENTER}"
  }
  ```

  `columns` must mirror the real header row **including unnamed columns**, because a cell's index
  inside a DataGridRow is its index in this list. Only `entry_columns` are ever typed; everything
  else (Product Name, HSN, tax, TOTAL) is computed by PACT. After each row KPAC reads
  `verify_columns` back and stops the record on a mismatch. Records feed the grid through a
  `line_items` list; in a CSV that is one column shaped `CODE|QTY|PRICE; CODE|QTY|PRICE`.

  A lookup column (`lookup_columns`) is retried when the master does not answer:
  `lookup_attempts` per commit, and `lookup_attempts_total` (default 5) for the whole row
  across the fill and every repair pass. Each failed attempt costs about the dropdown timeout
  plus the resolve timeout, so the total is what bounds how long a row can sit on a code the
  master does not have.

- `actions` — `new`, `save`, `save_draft`, `goto_line`, `search`, `load_doc`, `post`.
  An action is either a locator (clicked) or `{"type": "hotkey", "keys": "^+d"}`.
  **`save_draft` is preferred over `save`** — that is what makes PACT commit a draft rather than a
  posted document. **`post` is never executed**; asking for it raises an error.
- `confirmation.success_re` may capture `record_id`; if it does not, KPAC falls back to reading the
  `doc_no` field so the report still shows a document number.
- `verify_labels` — what each field is called *on screen*, so the Claude screenshot check can find it.
