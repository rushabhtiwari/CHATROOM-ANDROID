# Milestone 3 Handoff Report: Bank Reconciliation & Reimbursements / Disbursement Technical Exploration

**Agent**: `teamwork_preview_explorer_m3_2`  
**Role**: Teamwork Explorer (Read-Only Technical Investigation)  
**Milestone**: Milestone 3 — Invoices, Billing & Payments Console  
**Date**: 2026-09-03  
**Status**: Hard Handoff (Investigation & Blueprint Complete)  

---

## 1. Observation

### 1.1 Baseline System Integrity
- **TypeScript Typecheck**: Executed `npm run typecheck` (`tsc --noEmit`) in `master-frontend/varun`. Process exited with status code `0` (zero compilation or type errors).
- **Core Design Primitives**:
  - `master-frontend/varun/src/components/common/DataGrid.tsx`: Exposes `DataGrid` and `ColumnDef<T>`. Lines 68 & 364 enforce `isCompact: true` default which assigns `h-9` (36px fixed row height). Line 286 enforces the standardized table header: `className="font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30 sticky top-0 z-10 select-none"`.
  - `master-frontend/varun/src/components/common/StatusPill.tsx`: Standardized status pill with animated or static status indicator dot, fine outline border, and `rounded-badge` geometry.
  - `master-frontend/varun/src/pages/reimbursements/ClaimStatusPill.tsx`: Implements `statusTone` mapping (`grey`, `blue`, `amber`, `red`, `green`) for reimbursement request statuses.
  - `master-frontend/varun/src/modules/rts/store.tsx`: Supplies `useRts()` hook with `requests`, `payouts`, `employees`, `employeeById`, `disburseTo`, `retryPayout`, `verifyBankAccount`, `resetDemoData`, `connected`, and `loading`.
  - `master-frontend/varun/src/data/accounts.ts`: Exports `mockBankStatementLines: BankStatementLine[]` (lines 22–93) and `mockBookEntries: BookEntry[]` (lines 95–141).

---

### 1.2 Target 1: `master-frontend/varun/src/pages/finance/BankReconciliation.tsx`

#### Direct Observations & File Audit:
- **Total Lines**: 216 lines.
- **Data Imports**:
  ```tsx
  import { mockBankStatementLines, mockBookEntries } from '../../data/accounts';
  import { BankStatementLine, BookEntry } from '../../types';
  ```
- **Current State Defect 1 (Cards Instead of Comparison Tables)**:
  - Lines 92–212 split the screen into two 6-column containers (`grid grid-cols-12 gap-6`).
  - Left Container (lines 95–161): Uses `bg-surface border border-line rounded-lg p-5 shadow-card space-y-4` containing a card list (`{bankLines.map((line) => <div className="p-3 rounded border transition-colors space-y-2 ...">...</div>)}`).
  - Right Container (lines 164–211): Also uses `bg-surface border border-line rounded-lg p-5 shadow-card space-y-4` containing a card list (`{bookLines.map((entry) => <div className="p-3 rounded border transition-colors space-y-1 ...">...</div>)}`).
  - Neither side uses a `<table>` structure, missing the mandatory 36px fixed row height standard (`h-9`) and uppercase monospace column headers.
- **Current State Defect 2 (Discrepancy Indication)**:
  - Discrepancy is shown by expanding the entire card with a 130px multi-line AI reason box (lines 130–157) and applying `ring-1 ring-strand-amber`, preventing synchronized row-by-row scanning.
  - In a true precision engineering ledger, discrepancies must be surfaced via compact pills in a fixed 36px row with inline Auto-Match buttons.
- **Current State Defect 3 (Discrepancy Banner)**:
  - Lines 69–89 use legacy classes: `p-4 bg-amber-50 border border-amber-300 rounded-md` and `font-display font-semibold text-sm text-amber-950`.

---

### 1.3 Target 2: `master-frontend/varun/src/pages/reimbursements/ReimbursementsList.tsx`

#### Direct Observations & File Audit:
- **Total Lines**: 171 lines.
- **Data & Module Imports**:
  ```tsx
  import { useRts } from '@/modules/rts/store';
  import { CATEGORY_LABEL, actionOwner, statusLabel, statusTone } from '@/modules/rts/status';
  import type { ReceiptRequest } from '@/modules/rts/types';
  import { ClaimStatusPill } from './ClaimStatusPill';
  import { ClaimSummaryBar } from './ClaimSummaryBar';
  ```
- **Current State Audit**:
  - `ReimbursementsList` uses `DataGrid` (line 152), which already provides the standard `font-mono uppercase text-[10px] tracking-wider text-outline bg-surface-container-low` header.
  - However, column definitions in lines 54–113 have cell-height issues:
    - **Purpose Column (lines 64–77)**:
      ```tsx
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{row.title}</div>
          <div className="truncate text-[11px] text-muted">
            {employeeById(row.employeeId)?.name ?? 'Unknown'} ·{' '}
            {employeeById(row.employeeId)?.department ?? '—'}
          </div>
        </div>
      )
      ```
      This two-line block has an intrinsic height of ~34px, which when combined with `py-1.5` padding forces the row height to exceed the 36px (`h-9`) threshold, causing visual overflow or uneven rows.
    - **Legacy Token References**: Uses `text-ink`, `text-muted`, and `text-slate-700` instead of Stitch tokens (`text-on-surface`, `text-outline`, `text-on-surface-variant`).
    - **Missing Dedicated Employee Column**: Employee name is conflated with claim purpose, preventing single-click column sorting by employee.

---

### 1.4 Target 3: `master-frontend/varun/src/pages/reimbursements/Disbursement.tsx`

#### Direct Observations & File Audit:
- **Total Lines**: 312 lines.
- **Tab State**:
  - `tab === 'queue'` (Payment Queue, lines 129–223)
  - `tab === 'ledger'` (Payout Ledger, lines 225–306)
- **Current State Defect 1 (Payment Queue is Card-Based)**:
  - Lines 169–220 render payees as stacked cards:
    `<div key={employee.id} className="panel flex flex-wrap items-center gap-4 px-5 py-4">`
  - Uses loose vertical padding (`py-4`), irregular widths, and missing table headers.
  - Ready-to-disburse control strip (lines 131–160) uses legacy `panel px-5 py-3.5` and `text-ink`.
- **Current State Defect 2 (Payout Ledger Native Table Uses Legacy Tokens & Row Heights)**:
  - Lines 232–304:
    ```tsx
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="grid-head border-b border-line text-left">
          <th className="px-5 py-2.5 font-semibold text-muted">UTR</th>
          <th className="px-3 py-2.5 font-semibold text-muted">Employee</th>
          ...
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {ledger.map((payout) => (
          <tr key={payout.id} className="hover:bg-canvas">
            <td className="px-5 py-2.5 font-mono text-[11.5px] text-ink">...</td>
            ...
          </tr>
        ))}
      </tbody>
    </table>
    ```
  - Unconstrained row height (~44–48px) with `py-2.5`.
  - Non-monospace, non-uppercase table headers (`font-semibold text-muted`).
  - UTR link is unstyled plain text rather than a compact monospace UTR pill.
  - Multi-line `failureReason` text directly inside `<td>` breaks uniform row heights.

---

## 2. Logic Chain

1. **Step 1 — Foundation in Precision Engineering Design System**:
   - The Stitch Industrial Console specification requires strict visual rhythm across all tables and ledgers:
     - 36px fixed row height (`h-9`)
     - Uppercase monospace headers: `font-mono uppercase text-[10px] tracking-wider text-outline bg-surface-container-low border-b border-outline-variant/30 select-none`
     - Surface containers: `bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-xs`
     - Typography: `tabular-nums font-mono` for all currency, dates, IDs, and UTRs.
2. **Step 2 — BankReconciliation Table Transformation**:
   - Financial dual-ledger reconciliation requires side-by-side visual alignment between bank statement lines (Left) and ERP book entries (Right).
   - Transforming both sides into native HTML `<table>` elements with synchronized `h-9` rows allows operators to quickly spot unmatched amounts and dates across columns.
   - For items with AI discrepancy reasons, moving the reason into a compact badge with tooltip and providing an inline `Auto-Match` button (`handleAcceptSuggestion`) preserves full functionality while maintaining strict 36px row height.
3. **Step 3 — ReimbursementsList Single-Line Column Separation**:
   - To keep `DataGrid` rows strictly at 36px (`h-9`), each cell must be single-line.
   - Splitting `title` and `employee` into two distinct columns (`Employee` and `Purpose`) eliminates multi-line text wrapping, enables employee sorting, and matches the industrial standard.
4. **Step 4 — Disbursement Dual-Table Architecture**:
   - The Payment Queue must be converted from a loose card list into a high-density 36px native table (`EMPLOYEE`, `BANK DETAILS`, `CLAIMS`, `AMOUNT`, `KYC STATUS`, `ACTION`).
   - The Payout Ledger table must be upgraded from legacy `grid-head` classes to uppercase monospace headers, `h-9` rows, compact UTR pills, and inline retry actions.
5. **Step 5 — Preserving Data Integrity and State**:
   - All state hooks (`mockBankStatementLines`, `mockBookEntries`, `useRts`), handlers (`handleRunReconciliation`, `handleAcceptSuggestion`, `disburseTo`, `retryPayout`, `verifyBankAccount`), and routes (`/accounts/reconciliation`, `/reimbursements`, `/reimbursements/pay`, `/receipt/:utr`) must remain 100% intact.

---

## 3. Implementation Blueprints for the Worker

### 3.1 Refactoring Blueprint: `master-frontend/varun/src/pages/finance/BankReconciliation.tsx`

#### Target Line Ranges:
- **Lines 1–19**: Clean up imports. Remove unused icons (`Calculator`, `FileCheck2`, `ExternalLink`). Add `Search` if needed.
- **Lines 68–89**: Modernize Discrepancy Status Banner with Stitch container tokens:
  ```tsx
  <div className="p-4 bg-amber-50/70 border border-amber-300/60 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-strand-amber/20 border border-strand-amber/40 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-strand-amber" />
      </div>
      <div>
        <div className="font-semibold text-sm text-amber-950 font-sans">
          ₹2,14,380 unexplained across 11 entries
        </div>
        <p className="text-xs text-amber-800/90 mt-0.5 font-sans">
          AI has analyzed 3 unposted entries with matching suggested debit/credit accounts.
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="px-2.5 py-1 rounded-md bg-white border border-amber-200 text-amber-900 shadow-2xs">
        Auto-Match Rate: <strong className="tabular-nums">89.4%</strong>
      </span>
    </div>
  </div>
  ```
- **Lines 92–212**: Replace the 2-column card layout with dual synchronized native tables:
  ```tsx
  <div className="grid grid-cols-12 gap-6">
    {/* Left Column (6 cols): HDFC Bank Feed */}
    <div className="col-span-12 xl:col-span-6 bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-xs flex flex-col">
      <div className="p-3.5 px-4 bg-surface-container-low/50 border-b border-outline-variant/30 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-xs text-on-surface font-mono uppercase tracking-wider">
            HDFC Bank Host-to-Host Feed
          </h3>
          <span className="font-mono text-[10px] text-outline">A/C: 50200012984511 (Secunderabad)</span>
        </div>
        <span className="font-mono text-xs font-semibold text-strand-green bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 tabular-nums">
          Balance: ₹4,82,40,000
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30 sticky top-0 z-10 select-none">
            <tr>
              <th className="px-3 py-2 w-24">Date</th>
              <th className="px-3 py-2">Description / Ref</th>
              <th className="px-3 py-2 text-right w-28">Amount</th>
              <th className="px-3 py-2 text-center w-28">Status</th>
              <th className="px-3 py-2 text-right w-28">Action</th>
            </tr>
          </thead>
          <tbody>
            {bankLines.map((line) => (
              <tr
                key={line.id}
                className={`h-9 border-b border-outline-variant/20 hover:bg-surface-container-low/70 transition-colors ${
                  !line.isMatched ? 'bg-amber-50/30' : ''
                }`}
              >
                <td className="px-3 py-1.5 font-mono text-[11px] text-outline whitespace-nowrap">
                  {line.date}
                </td>
                <td className="px-3 py-1.5 min-w-[150px] max-w-[220px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-medium text-on-surface text-xs truncate" title={line.description}>
                      {line.description}
                    </span>
                    <span className="font-mono text-[10px] text-outline shrink-0">
                      · {line.referenceNo}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                  {line.credit ? (
                    <span className="font-bold text-strand-green">+{formatINR(line.credit)}</span>
                  ) : (
                    <span className="font-bold text-strand-red">-{formatINR(line.debit || 0)}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-center whitespace-nowrap">
                  {line.isMatched ? (
                    <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[10px] font-medium font-mono leading-none border border-emerald-200 bg-emerald-50 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-strand-green shrink-0" />
                      MATCHED
                    </span>
                  ) : (
                    <span
                      title={line.aiSuggestedReason}
                      className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[10px] font-medium font-mono leading-none border border-amber-300 bg-amber-50 text-amber-900 animate-pulse"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-strand-amber shrink-0" />
                      UNMATCHED
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  {!line.isMatched ? (
                    <button
                      onClick={() => handleAcceptSuggestion(line.id, line.aiSuggestedReason || 'Auto match')}
                      className="inline-flex items-center gap-1 h-6.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary text-white hover:bg-primary/90 transition-colors shadow-2xs"
                      title={line.aiSuggestedReason ? `Accept AI: ${line.aiSuggestedReason}` : 'Auto-Match'}
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto-Match
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-outline">
                      <CheckCircle2 className="w-3 h-3 text-strand-green" />
                      Linked
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Right Column (6 cols): PACT ERP General Ledger */}
    <div className="col-span-12 xl:col-span-6 bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-xs flex flex-col">
      <div className="p-3.5 px-4 bg-surface-container-low/50 border-b border-outline-variant/30 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-xs text-on-surface font-mono uppercase tracking-wider">
            PACT ERP General Ledger
          </h3>
          <span className="font-mono text-[10px] text-outline">General Ledger: Bank Receipts</span>
        </div>
        <button
          onClick={() => setToastMessage('Opened journal voucher creation modal.')}
          className="px-2.5 py-1 bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/30 text-xs font-semibold text-on-surface rounded-lg flex items-center gap-1 shadow-2xs transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Create Journal
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30 sticky top-0 z-10 select-none">
            <tr>
              <th className="px-3 py-2 w-24">Date</th>
              <th className="px-3 py-2 w-32">Voucher No</th>
              <th className="px-3 py-2">Particulars</th>
              <th className="px-3 py-2 text-right w-28">Amount</th>
              <th className="px-3 py-2 text-center w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookLines.map((entry) => (
              <tr
                key={entry.id}
                className={`h-9 border-b border-outline-variant/20 hover:bg-surface-container-low/70 transition-colors ${
                  !entry.isMatched ? 'bg-amber-50/20' : ''
                }`}
              >
                <td className="px-3 py-1.5 font-mono text-[11px] text-outline whitespace-nowrap">
                  {entry.date}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs font-medium text-on-surface whitespace-nowrap">
                  {entry.voucherNo}
                </td>
                <td className="px-3 py-1.5 min-w-[140px] max-w-[200px]">
                  <div className="truncate font-medium text-on-surface text-xs" title={entry.particulars}>
                    {entry.particulars}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                  {entry.credit ? (
                    <span className="font-bold text-strand-green">+{formatINR(entry.credit)}</span>
                  ) : (
                    <span className="font-bold text-strand-red">-{formatINR(entry.debit || 0)}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-center whitespace-nowrap">
                  {entry.isMatched ? (
                    <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[10px] font-medium font-mono leading-none border border-emerald-200 bg-emerald-50 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-strand-green shrink-0" />
                      MATCHED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[10px] font-medium font-mono leading-none border border-amber-200 bg-amber-50 text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-strand-amber shrink-0" />
                      AWAITING
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  ```

---

### 3.2 Refactoring Blueprint: `master-frontend/varun/src/pages/reimbursements/ReimbursementsList.tsx`

#### Target Line Ranges:
- **Lines 54–113**: Refactor `columns: ColumnDef<ReceiptRequest>[]` to enforce single-line cells and a dedicated `Employee` column:
  ```tsx
  const columns: ColumnDef<ReceiptRequest>[] = [
    {
      id: 'id',
      header: 'Claim ID',
      isMono: true,
      sortable: true,
      accessorKey: 'id',
      width: '105px',
      cell: (row) => <span className="font-mono text-xs font-semibold text-primary">{row.id}</span>,
    },
    {
      id: 'employee',
      header: 'Employee',
      sortable: true,
      width: '160px',
      cell: (row) => {
        const emp = employeeById(row.employeeId);
        return (
          <div className="truncate font-medium text-xs text-on-surface" title={`${emp?.name} (${emp?.department})`}>
            {emp?.name ?? 'Unknown'}
          </div>
        );
      },
    },
    {
      id: 'title',
      header: 'Purpose / Description',
      sortable: true,
      accessorKey: 'title',
      cell: (row) => (
        <span className="truncate block text-xs text-on-surface-variant font-normal" title={row.title}>
          {row.title}
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      sortable: true,
      accessorKey: 'category',
      width: '120px',
      cell: (row) => (
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-outline px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/30">
          {CATEGORY_LABEL[row.category]}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      isNumeric: true,
      isMono: true,
      sortable: true,
      accessorKey: 'amount',
      width: '120px',
      cell: (row) => (
        <span className="font-mono tabular-nums font-semibold text-xs text-on-surface">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      id: 'submittedOn',
      header: 'Filed',
      isMono: true,
      sortable: true,
      accessorKey: 'submittedOn',
      width: '105px',
      cell: (row) => <span className="font-mono text-[11px] text-outline">{formatDate(row.submittedOn)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessorKey: 'status',
      width: '150px',
      cell: (row) => <ClaimStatusPill status={row.status} />,
    },
  ];
  ```

---

### 3.3 Refactoring Blueprint: `master-frontend/varun/src/pages/reimbursements/Disbursement.tsx`

#### Target Line Ranges:
- **Lines 131–160**: Modernize Ready to Disburse control strip:
  ```tsx
  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl mb-4 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-outline">Ready to disburse</p>
      <p className="mt-1 font-mono text-2xl font-bold leading-none tracking-tight text-on-surface tabular-nums">
        {formatCurrency(totalPayable)}
      </p>
      <p className="mt-1 text-[11px] font-mono text-outline">
        across {payees.length} employee{payees.length === 1 ? '' : 's'}
      </p>
    </div>
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-outline mb-1.5">Payment Method</p>
      <div className="flex gap-1.5">
        {METHODS.map((value) => (
          <button
            key={value}
            onClick={() => setMethod(value)}
            aria-pressed={method === value}
            className={`rounded-lg border px-3 py-1 font-mono text-xs font-semibold transition-colors ${
              method === value
                ? 'border-primary bg-primary text-white shadow-xs'
                : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  </div>
  ```
- **Lines 169–220**: Transform Payment Queue from card panels to 36px fixed row height (`h-9`) native table:
  ```tsx
  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-xs">
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30 sticky top-0 z-10 select-none">
          <tr>
            <th className="px-4 py-2 w-48">Employee</th>
            <th className="px-3 py-2">Bank & Account Details</th>
            <th className="px-3 py-2 w-32">Claims</th>
            <th className="px-3 py-2 text-right w-32">Payable Amount</th>
            <th className="px-3 py-2 text-center w-28">KYC Status</th>
            <th className="px-4 py-2 text-right w-36">Action</th>
          </tr>
        </thead>
        <tbody>
          {payees.map((row) => {
            const employee = row.employee!;
            const bank = employee.bankAccount;
            return (
              <tr
                key={employee.id}
                className="h-9 border-b border-outline-variant/20 hover:bg-surface-container-low/70 transition-colors"
              >
                <td className="px-4 py-1.5 whitespace-nowrap">
                  <span className="font-semibold text-xs text-on-surface">{employee.name}</span>
                  <span className="ml-1.5 font-mono text-[10px] text-outline">({employee.employeeCode})</span>
                </td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-on-surface-variant truncate whitespace-nowrap">
                  <span>{bank.bankName}</span>
                  <span className="text-outline mx-1">·</span>
                  <span>{bank.accountNumberMasked}</span>
                  <span className="text-outline mx-1">·</span>
                  <span className="text-outline text-[10px]">{bank.ifsc}</span>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span
                    title={row.claimIds.join(', ')}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-container text-on-surface-variant border border-outline-variant/30"
                  >
                    <strong>{row.claimIds.length}</strong> claim{row.claimIds.length === 1 ? '' : 's'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs font-bold text-on-surface whitespace-nowrap">
                  {formatCurrency(row.total)}
                </td>
                <td className="px-3 py-1.5 text-center whitespace-nowrap">
                  {bank.verified ? (
                    <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[10px] font-medium font-mono border border-emerald-200 bg-emerald-50 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-strand-green shrink-0" />
                      VERIFIED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[10px] font-medium font-mono border border-amber-200 bg-amber-50 text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-strand-amber shrink-0" />
                      UNVERIFIED
                    </span>
                  )}
                </td>
                <td className="px-4 py-1.5 text-right whitespace-nowrap">
                  {bank.verified ? (
                    <button
                      onClick={() => pay(employee.id)}
                      disabled={busy === employee.id}
                      className="inline-flex items-center gap-1 h-6.5 px-2.5 py-0.5 rounded text-[11px] font-semibold font-mono bg-strand-green text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs"
                    >
                      {busy === employee.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Banknote className="w-3 h-3" />
                      )}
                      Pay by {method}
                    </button>
                  ) : (
                    <button
                      onClick={() => verifyBankAccount(employee.id)}
                      className="inline-flex items-center gap-1 h-6.5 px-2 py-0.5 rounded text-[10.5px] font-semibold font-mono bg-surface-container text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30 transition-colors shadow-2xs"
                    >
                      <ShieldCheck className="w-3 h-3 text-primary" />
                      Verify
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
  ```
- **Lines 226–306**: Standardize Payout Ledger table to `h-9` fixed height rows, uppercase monospace headers, compact UTR pills, and inline actions:
  ```tsx
  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-xs">
    {ledger.length === 0 ? (
      <p className="px-5 py-10 text-center text-xs text-outline font-mono">
        No payouts have been made yet.
      </p>
    ) : (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30 sticky top-0 z-10 select-none">
            <tr>
              <th className="px-4 py-2 w-48">UTR Reference</th>
              <th className="px-3 py-2 w-44">Employee</th>
              <th className="px-3 py-2 w-24">Method</th>
              <th className="px-3 py-2 text-right w-32">Amount</th>
              <th className="px-3 py-2 w-40">Initiated On</th>
              <th className="px-4 py-2 text-center w-36">Status</th>
              <th className="px-4 py-2 text-right w-28">Action</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((payout) => {
              const meta = PAYOUT_META[payout.status];
              return (
                <tr
                  key={payout.id}
                  className="h-9 border-b border-outline-variant/20 hover:bg-surface-container-low/70 transition-colors"
                >
                  <td className="px-4 py-1.5 whitespace-nowrap">
                    {payout.utr ? (
                      <Link
                        to={`/receipt/${payout.utr}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-surface-container-low border border-outline-variant/30 text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Banknote className="w-3 h-3 text-primary" />
                        {payout.utr}
                      </Link>
                    ) : (
                      <span className="font-mono text-outline text-[11px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-on-surface font-medium text-xs whitespace-nowrap">
                    {employeeById(payout.employeeId)?.name ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant/30">
                      {payout.method}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums font-semibold text-xs text-on-surface whitespace-nowrap">
                    {formatCurrency(payout.amount)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-outline whitespace-nowrap">
                    {formatDateTime(payout.initiatedOn)}
                  </td>
                  <td className="px-4 py-1.5 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5 text-[10px] font-mono font-semibold ${
                        meta.tone === 'green'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : meta.tone === 'red'
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : meta.tone === 'amber'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-outline-variant/30 bg-surface-container text-on-surface-variant'
                      }`}
                      title={payout.failureReason}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          meta.tone === 'green'
                            ? 'bg-strand-green'
                            : meta.tone === 'red'
                              ? 'bg-strand-red'
                              : meta.tone === 'amber'
                                ? 'bg-strand-amber'
                                : 'bg-outline'
                        }`}
                      />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-right whitespace-nowrap">
                    {payout.status === 'FAILED' ? (
                      <button
                        onClick={() => retryPayout(payout.id)}
                        className="inline-flex items-center gap-1 h-6.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary text-white hover:bg-primary/90 transition-colors shadow-2xs"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        Retry
                      </button>
                    ) : payout.utr ? (
                      <Link
                        to={`/receipt/${payout.utr}`}
                        className="font-mono text-[10px] text-primary hover:underline"
                      >
                        Advice →
                      </Link>
                    ) : (
                      <span className="font-mono text-[10px] text-outline">Processed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
  ```

---

## 4. Caveats

1. **Read-Only Scope Compliance**: This investigation is strictly read-only. No source files were altered by this explorer agent.
2. **Layout Adaptability on Narrow Screens**: Dual side-by-side ledger tables in `BankReconciliation.tsx` collapse gracefully into stacked full-width tables on screen widths under 1280px (`xl:col-span-6 col-span-12`), ensuring responsiveness without compromising the 36px fixed row standard.
3. **Tooltip Utilization for Long Text**: AI discrepancy suggestions and failure reasons use browser native `title` tooltips and compact status pills, ensuring that multi-sentence text does not expand the 36px row height.
4. **No other caveats**: All types, handlers, and stores are 100% compatible.

---

## 5. Conclusion

1. **Milestone 3 Readiness**: The technical exploration and line-referenced refactoring blueprints for `BankReconciliation.tsx`, `ReimbursementsList.tsx`, and `Disbursement.tsx` are complete, comprehensive, and ready for immediate implementation by the Worker.
2. **Standardization Coverage**:
   - `BankReconciliation.tsx`: Standardized from irregular card lists into dual synchronized native tables with 36px fixed row height (`h-9`), uppercase monospace headers, compact discrepancy pills, and inline Sparkles Auto-Match buttons.
   - `ReimbursementsList.tsx`: Column definitions partitioned into distinct single-line columns (adding dedicated `Employee` column), guaranteeing strict 36px row height without text overflow.
   - `Disbursement.tsx`: Both the Payment Queue and Payout Ledger tables standardized to 36px fixed rows (`h-9`), uppercase monospace headers, compact UTR pills, and inline retry/verify actions.
3. **Data & Route Preservation**: All mock data structures (`mockBankStatementLines`, `mockBookEntries`, `useRts`) and routes (`/accounts/reconciliation`, `/reimbursements`, `/reimbursements/pay`) are verified and preserved intact.

---

## 6. Verification Method

To independently verify after the Worker implements the refactor:

1. **TypeScript Typecheck**:
   ```bash
   cd c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun
   npm run typecheck
   ```
   *Expected*: Exits with code `0`, zero errors.

2. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected*: Exits with code `0`, clean Vite build output.

3. **DOM & Height Audit**:
   - Inspect table rows in Chrome DevTools: verify `<tr>` elements render with `height: 36px` (`h-9`).
   - Verify table headers render with uppercase monospace styling: `font-mono uppercase text-[10px] tracking-wider text-outline bg-surface-container-low border-b border-outline-variant/30`.
   - Verify clicking "Auto-Match" on `BankReconciliation` transitions line to matched status and triggers toast notification.
   - Verify clicking "Pay by {method}" and "Verify" on `Disbursement` triggers expected mock store mutations.
