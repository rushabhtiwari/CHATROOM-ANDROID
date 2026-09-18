# Milestone 3 Handoff Report: Payables & Receivables Industrial Consoles

**Agent**: `teamwork_preview_explorer_m3_1`  
**Working Directory**: `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_explorer_m3_1`  
**Date**: 2026-09-03  
**Target Scope**: Milestone 3 — Invoices, Billing & Payments Console  
**Target Files**:
1. `master-frontend/varun/src/pages/finance/Payables.tsx` (Feature 15)
2. `master-frontend/varun/src/pages/finance/Receivables.tsx` (Feature 16)

---

## 1. Observation

### 1.1 Codebase Layout & Current File States
- **`master-frontend/varun/src/pages/finance/Payables.tsx`** (152 lines):
  - Uses `DataGrid` from `../../components/common/DataGrid` with `ColumnDef<PayableVendor>[]`.
  - Binds to `mockPayables` from `../../data/accounts` (lines 2, 19).
  - Header: `<PageHeader title="Vendor Payables & UTR Remittance Tracker" />` without eyebrow, badges, or summary KPI cards.
  - 40-Day Credit Alert Banner (lines 119–140):
    ```tsx
    <div className="p-4 bg-amber-50 border border-amber-300 rounded-md flex flex-wrap items-center justify-between gap-4">
    ```
    Uses legacy Tailwind palette (`amber-50`, `amber-300`, `amber-950`, `amber-800`, `bg-strand-amber`) rather than Stitch surface container depth tokens (`bg-surface-container-lowest`, `border-amber-500/40`, `border-l-4 border-l-strand-amber`).
  - Columns (lines 27–101): `vendorName`, `totalOutstanding`, `dueThisWeek`, `creditDays`, `daysOldestBill`, `utrStatus`.
  - Current cell renders in `vendorName` (lines 33–38) and `utrStatus` (lines 86–99) stack two lines of `<div>` tags with `text-ink` / `text-muted` without bounding vertical heights.
  - **No inline quick-action buttons exist** on vendor rows (e.g. no "Pay", "View Ledger", or "Send Advice").
- **`master-frontend/varun/src/pages/finance/Receivables.tsx`** (168 lines):
  - Uses `DataGrid` with `ColumnDef<ReceivableCustomer>[]`.
  - Binds to `mockReceivables` from `../../data/accounts` (lines 2, 12).
  - Header: `<PageHeader title="Customer Receivables & Automated Ageing Chaser" actions={...} />` (lines 124–151).
  - Chaser cadence control uses raw `<div className="flex items-center gap-1.5 bg-canvas border border-line rounded px-2.5 py-1 text-xs font-mono">` and button with `bg-kiran`.
  - Columns (lines 22–111): `customerName`, `totalReceivable`, `b0_30`, `b31_45`, `b46_60`, `b61_90`, `remindersCount`, `nextScheduled`, `collectionStatus`.
  - Ageing buckets include `0–30 Days`, `31–45 Days`, `46–60 Days`, `61–90 Days (Overdue)`.
  - In line 79, overdue bucket 61–90 displays `<span className={... row.buckets.b61_90 > 0 ? 'text-strand-red bg-red-50 px-1.5 py-0.5 rounded border border-red-200' : 'text-slate-400'}>`.
  - **Missing 60-day overdue stop-dispatch indicator**: Does not render a prominent "STOP DISPATCH" badge or banner, even though customer `CUST-001` (Motherson Sumi Systems Ltd) has ₹8,42,150 overdue for 62 days and is under active stop-dispatch hold in `src/data/automations.ts` (AUT-004, lines 54–68).
  - **No inline chaser actions exist** on customer rows (only a global bulk button exists).
- **`master-frontend/varun/src/components/common/DataGrid.tsx`** (433 lines):
  - Default `isCompact` state is `true` (line 68).
  - Row height styling (line 364): `${isCompact ? 'h-9' : 'h-11'}`.
  - Table thead (line 286): `font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30`.
  - Table cell padding (line 384): `px-3 py-1.5`.
  - Bulk actions and saved views are supported natively via props `bulkActions` and `savedViews`.
- **`master-frontend/varun/src/components/common/__tests__/components.test.tsx`** (lines 508–534):
  - Directly tests row height expansion:
    *"Empirical finding: Row has class 'h-9', but HTML table specification expands row height when cell content exceeds 36px because td has no overflow:hidden or fixed line-clamp."*
- **Mock Data Coherence**:
  - `mockPayables` has 5 vendors:
    - Saint-Gobain (41d oldest, `is40DayAlert: true`, ₹21.50 L due)
    - Dow Chemical (42d oldest, `is40DayAlert: true`, ₹18.00 L due)
    - Wacker Metroark (28d oldest, `is40DayAlert: false`, ₹9.50 L due)
    - PolyChem Emulsions (14d oldest, `is40DayAlert: false`, UTR: HDFC26081799120)
    - Reliance Industries (43d oldest, `is40DayAlert: true`, ₹34.00 L due)
    - Sum due this week for the 3 MSME alert vendors: ₹21.50 L + ₹18.00 L + ₹34.00 L = **₹73.50 L** (matches banner exactly).
  - `mockReceivables` has 5 customers:
    - Motherson Sumi (`buckets.b61_90: 842150`, status: 'Overdue', 4 reminders)
    - Alstom Transport (b0_30: 82.0L, b31_45: 33.5L, status: 'On track')
    - GE Power (b0_30: 51.0L, b31_45: 28.0L, status: 'On track')
    - Suzlon Energy (b46_60: 10.6L, b61_90: 340000, status: 'At risk')
    - Raychem RPG (b46_60: 5.2L, b61_90: 180000, status: 'At risk')
    - Total Overdue (>60d): 8,42,150 + 3,40,000 + 1,80,000 = **₹13,62,150** (matches `mockAccountsKPI.overdueReceivable: 1362150` exactly).
- **TypeScript Compilation**:
  - `npm run typecheck` (`tsc --noEmit`) currently passes with exit code 0.

---

## 2. Logic Chain

```
[Observation: DataGrid applies h-9 (36px) to tr, but HTML tables expand tr if td content > 24px]
                                       ↓
[Logic Step 1: Vertical Height Arithmetic]
Row height = 36px. Vertical padding in td = py-1.5 (6px top + 6px bottom = 12px).
Available vertical inner content height = 36px - 12px = 24px.
To guarantee strict 36px fixed row height without expanding, every cell's child element
must have max-height <= 24px (inline flex layout, single-line text with truncate, or compact badge).
                                       ↓
[Logic Step 2: Column Header Standard]
DataGrid thead has font-mono uppercase tracking-wider text-outline text-[10px].
ColumnDef header strings must be uppercase monospace (e.g. "VENDOR NAME", "TOTAL OUTSTANDING",
"ACTIONS") to match the Industrial Console standard.
                                       ↓
[Logic Step 3: Status Pills & Alert Badges]
Replace unbordered, generic text with compact status pills (StatusPill and Stitch badge tokens):
- Payables: UTR Sent (emerald), Queued (amber), Processing (blue), MSME Alert (pulsing red).
- Receivables: Stop-Dispatch Hold (pulsing red badge), Overdue, At Risk, On Track.
                                       ↓
[Logic Step 4: Inline Quick-Action Buttons]
Add dedicated ACTIONS column (width 160px–170px) to both tables:
- Payables: "Pay" (queue disbursement), "Ledger" (view subledger), "Advice" (send remittance email).
- Receivables: "Chase" (dispatch reminder), "Ledger" (inspect invoices).
All buttons styled with compact height (px-2 py-0.5 text-[11px] font-mono leading-tight <= 22px).
                                       ↓
[Logic Step 5: MSME 40-Day Credit Warning Banner]
Preserve MSME 45-day statutory compliance rule. Re-style container with Stitch tokens:
bg-surface-container-lowest, border-amber-500/40, border-l-4 border-l-strand-amber,
font-mono statutory eyebrow, and clear action button for the ₹73.50 L Thursday batch.
                                       ↓
[Logic Step 6: 60-Day Overdue Stop-Dispatch Hold Indicator]
Preserve ERP 60-day auto-hold rule (AUT-004). Add top alert banner for locked accounts,
a pulsing STOP DISPATCH pill in the Customer Name cell, and red indicator in the 61-90+ bucket.
                                       ↓
[Logic Step 7: Executive Industrial KPI Cards]
Introduce 4-across KPICard summary rows at the top of both pages to elevate density
and match Milestone 1 & 2 console standards.
                                       ↓
[Conclusion: Zero Breaking Changes, Strict Mock & Route Preservation, Precision Refactor]
```

---

## 3. Caveats
1. **HTML Table Cell Height Behavior**:
   As discovered in `components.test.tsx`, `<tr>` classes like `h-9` cannot prevent cell expansion if child elements exceed 24px height. The Worker must strictly ensure cell renderers do not introduce multiline margins or vertically stacked blocks without compact height constraints.
2. **Interactive Simulation**:
   Inline quick-actions ("Pay", "Ledger", "Send Advice", "Chase") and cadence selector update state and trigger descriptive feedback toasts (`toastMessage`). No backend API calls should be introduced in this milestone.
3. **Route & Mock Invariance**:
   Mock stores `mockPayables` and `mockReceivables` in `src/data/accounts.ts`, and routes `/accounts/payables` and `/accounts/receivables` in `src/App.tsx` must remain completely untouched.

---

## 4. Conclusion & Actionable Blueprint for Worker

### 4.1 Refactoring Blueprint: `master-frontend/varun/src/pages/finance/Payables.tsx`

#### Imports
```tsx
import React, { useState, useMemo } from 'react';
import { mockPayables } from '../../data/accounts';
import { PayableVendor } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard } from '../../components/common/KPICard';
import { HealthPill } from '../../components/common/HealthPill';
import { StatusPill } from '../../components/common/StatusPill';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import {
  Building2,
  AlertTriangle,
  Send,
  CheckCircle2,
  Calendar,
  CreditCard,
  Mail,
  ArrowDownRight,
  Clock,
  RefreshCw,
  FileText,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
```

#### State & Handlers
- `payables`: `useState<PayableVendor[]>(mockPayables)`
- `activeFilter`: `useState<'all' | 'alert' | 'due' | 'remitted'>('all')`
- `toastMessage`: `useState<string | null>(null)`
- `handleExecutePaymentRun()`: sets toast `"Disbursement batch approved for Thursday run (₹73.50 L). Bank payment file generated."`
- `handlePayVendor(vendor: PayableVendor)`: sets toast `"Queued payment batch for ${vendor.vendorName} (${formatINR(vendor.dueThisWeek || vendor.totalOutstanding)})."`
- `handleViewLedger(vendor: PayableVendor)`: sets toast `"Opened vendor sub-ledger & voucher history for ${vendor.vendorName} (${vendor.vendorId})."`
- `handleSendAdvice(vendor: PayableVendor)`: sets toast `"Remittance advice PDF and UTR confirmation (${vendor.utrNumber}) emailed to ${vendor.vendorName} finance desk."`

#### Summary KPIs (4-Across Grid)
1. **Total Outstanding**: `formatINRLakhCrore(24700000)` (₹2.47 Cr), status: `"neutral"`, footerLeft: `"5 Active Vendors"`, footerRight: `"Net 30–45d"`
2. **Due This Week**: `formatINRLakhCrore(7350000)` (₹73.50 L), status: `"at_risk"`, footerLeft: `"Thursday Run"`, footerRight: `"4 Batches"`
3. **MSME 40d Alert**: `"3 Vendors"`, status: `"overdue"`, footerLeft: `"₹73.50 L at Risk"`, footerRight: `"5 Days to Limit"`
4. **Remitted / UTR Sent**: `formatINRLakhCrore(340000)` (₹3.40 L), status: `"on_track"`, footerLeft: `"PolyChem Emulsions"`, footerRight: `"UTR Dispatched"`

#### 40-Day Credit Warning Banner (Stitch Tokens)
```tsx
<div className="bg-surface-container-lowest border border-amber-500/40 border-l-4 border-l-strand-amber rounded-xl shadow-xs p-4 flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
  <div className="flex items-start gap-3 max-w-3xl">
    <div className="w-8 h-8 rounded-lg bg-strand-amber/15 border border-strand-amber/30 flex items-center justify-center shrink-0 mt-0.5">
      <AlertTriangle className="w-4 h-4 text-strand-amber" />
    </div>
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="w-2 h-2 rounded-full bg-strand-amber animate-pulse" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800">
          MSME Section 43B(h) Statutory Compliance Alert
        </span>
      </div>
      <div className="font-display font-semibold text-sm text-on-surface">
        3 vendors reach 40 days this week — 5 days remaining to statutory 45-day cycle
      </div>
      <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
        Saint-Gobain, Dow Chemical, and Reliance Industries are scheduled on the Thursday payment run to prevent tax deduction disallowance and compound interest penalties.
      </p>
    </div>
  </div>

  <button
    onClick={handleExecutePaymentRun}
    className="px-3.5 py-1.5 bg-strand-amber hover:bg-amber-600 text-white font-mono font-semibold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition-all shrink-0"
  >
    <CreditCard className="w-3.5 h-3.5" />
    <span>Approve Thursday Payment Batch (₹73.50 L)</span>
  </button>
</div>
```

#### Table Columns (`ColumnDef<PayableVendor>[]`) — 36px Enforced
1. **`vendorName`**:
   - Header: `"VENDOR NAME"`
   - Width: `"240px"`
   - Cell:
     ```tsx
     <div className="flex items-center gap-2 max-w-[240px] truncate">
       <span className="font-semibold text-xs text-on-surface truncate">{row.vendorName}</span>
       <span className="text-[10px] font-mono text-outline shrink-0 bg-surface-container px-1 py-0.5 rounded border border-outline-variant/30">
         {row.billsCount} bills
       </span>
     </div>
     ```
2. **`totalOutstanding`**:
   - Header: `"TOTAL OUTSTANDING"`
   - isNumeric: true, isMono: true, Width: `"140px"`
   - Cell: `<span className="font-bold text-on-surface tabular-nums">{formatINR(row.totalOutstanding)}</span>`
3. **`dueThisWeek`**:
   - Header: `"DUE THIS WEEK"`
   - isNumeric: true, isMono: true, Width: `"130px"`
   - Cell:
     ```tsx
     row.dueThisWeek > 0 ? (
       <span className="text-strand-amber font-semibold tabular-nums">{formatINR(row.dueThisWeek)}</span>
     ) : (
       <span className="text-outline tabular-nums">—</span>
     )
     ```
4. **`creditDays`**:
   - Header: `"CREDIT TERM"`
   - isMono: true, Width: `"100px"`
   - Cell: `<span className="font-mono text-xs text-on-surface-variant">{row.creditDays}d net</span>`
5. **`daysOldestBill`**:
   - Header: `"OLDEST BILL AGE"`
   - isMono: true, Width: `"150px"`
   - Cell:
     ```tsx
     row.is40DayAlert ? (
       <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-strand-red bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
         <AlertTriangle className="w-3 h-3 text-strand-red shrink-0 animate-pulse" />
         <span>{row.daysOldestBill}d (40d+ MSME)</span>
       </span>
     ) : (
       <span className="font-mono text-xs text-on-surface-variant">{row.daysOldestBill} Days</span>
     )
     ```
6. **`utrStatus`**:
   - Header: `"UTR / REMITTANCE"`
   - Width: `"200px"`
   - Cell:
     ```tsx
     row.utrNumber ? (
       <div className="flex items-center gap-1.5">
         <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
           {row.utrNumber}
         </span>
         <span className="text-[10px] text-outline font-mono truncate" title={row.utrMailSentAt}>
           Sent
         </span>
       </div>
     ) : row.utrStatus === 'Queued' ? (
       <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-800 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
         <Clock className="w-3 h-3 text-strand-amber shrink-0" />
         <span>QUEUED (THU RUN)</span>
       </span>
     ) : (
       <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/30">
         {row.utrStatus}
       </span>
     )
     ```
7. **`actions`**:
   - Header: `"ACTIONS"`
   - Width: `"160px"`
   - Cell:
     ```tsx
     <div className="flex items-center gap-1 justify-end">
       <button
         onClick={(e) => { e.stopPropagation(); handlePayVendor(row); }}
         className="px-2 py-0.5 text-[11px] font-mono font-medium rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
         title="Queue disbursement"
       >
         Pay
       </button>
       <button
         onClick={(e) => { e.stopPropagation(); handleViewLedger(row); }}
         className="px-2 py-0.5 text-[11px] font-mono font-medium rounded border border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
         title="Open Vendor Subledger"
       >
         Ledger
       </button>
       <button
         onClick={(e) => { e.stopPropagation(); handleSendAdvice(row); }}
         disabled={!row.utrNumber}
         className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded border transition-colors ${
           row.utrNumber
             ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-600 hover:text-white'
             : 'border-outline-variant/20 bg-surface-container-lowest text-outline/40 cursor-not-allowed'
         }`}
         title={row.utrNumber ? "Email Remittance Advice" : "Requires completed UTR"}
       >
         Advice
       </button>
     </div>
     ```

#### DataGrid Saved Views & Bulk Actions
- `savedViews`:
  - `{ label: 'All Payables', count: payables.length, active: activeFilter === 'all', onClick: () => setActiveFilter('all') }`
  - `{ label: 'MSME 40d Alert', count: 3, active: activeFilter === 'alert', onClick: () => setActiveFilter('alert') }`
  - `{ label: 'Due This Week', count: 4, active: activeFilter === 'due', onClick: () => setActiveFilter('due') }`
  - `{ label: 'UTR Remitted', count: 1, active: activeFilter === 'remitted', onClick: () => setActiveFilter('remitted') }`
- `bulkActions`:
  - `{ label: 'Approve Selected for Thursday Run', action: (items) => ... }`
  - `{ label: 'Generate Bank Payment File', action: (items) => ... }`

---

### 4.2 Refactoring Blueprint: `master-frontend/varun/src/pages/finance/Receivables.tsx`

#### Imports
```tsx
import React, { useState, useMemo } from 'react';
import { mockReceivables } from '../../data/accounts';
import { ReceivableCustomer } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard } from '../../components/common/KPICard';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import {
  Send,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Ban,
  FileText,
  SlidersHorizontal,
  ShieldAlert
} from 'lucide-react';
```

#### State & Handlers
- `receivables`: `useState<ReceivableCustomer[]>(mockReceivables)`
- `reminderCadence`: `useState<number>(7)`
- `activeFilter`: `useState<'all' | 'overdue' | 'risk' | 'ontrack'>('all')`
- `toastMessage`: `useState<string | null>(null)`
- `handleSendReminders(selected: ReceivableCustomer[])`: dispatches automated statements & reminders to selected or all overdue accounts.
- `handleChaseSingleCustomer(customer: ReceivableCustomer)`:
  `setToastMessage("Dispatched automated statement & reminder to " + customer.customerName + " (" + (customer.remindersCount + 1) + "th notice). Next auto-chase: " + customer.nextScheduled);`
- `handleViewLedger(customer: ReceivableCustomer)`:
  `setToastMessage("Opened customer ledger & invoice breakdown for " + customer.customerName + " (" + customer.customerId + ").");`

#### Summary KPIs (4-Across Grid)
1. **Total Receivables**: `formatINRLakhCrore(50610000)` (₹5.06 Cr), status: `"on_track"`, footerLeft: `"5 Active Accounts"`, footerRight: `"DSO: 38 days"`
2. **Current (0–30 Days)**: `formatINRLakhCrore(31700000)` (₹3.17 Cr), status: `"on_track"`, footerLeft: `"62.6% of Ledger"`, footerRight: `"Healthy Turnover"`
3. **At Risk (46–60 Days)**: `formatINRLakhCrore(3197850)` (₹31.98 L), status: `"at_risk"`, footerLeft: `"3 Accounts"`, footerRight: `"Weekly Followup"`
4. **Stop-Dispatch Hold (>60d)**: `formatINRLakhCrore(1362150)` (₹13.62 L), status: `"overdue"`, footerLeft: `"1 Account Locked"`, footerRight: `"ERP Hold Engaged"`

#### 60-Day Overdue Stop-Dispatch Hold Alert Banner
```tsx
<div className="bg-surface-container-lowest border border-strand-red/40 border-l-4 border-l-strand-red rounded-xl shadow-xs p-4 flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
  <div className="flex items-start gap-3 max-w-3xl">
    <div className="w-8 h-8 rounded-lg bg-strand-red/15 border border-strand-red/30 flex items-center justify-center shrink-0 mt-0.5">
      <Ban className="w-4 h-4 text-strand-red" />
    </div>
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="w-2 h-2 rounded-full bg-strand-red animate-pulse" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-strand-red">
          ERP Automated Safeguard · Stop-Dispatch Hold Active
        </span>
      </div>
      <div className="font-display font-semibold text-sm text-on-surface">
        1 Customer Under Active Stop-Dispatch Hold — Invoices Overdue &gt;60 Days
      </div>
      <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
        Motherson Sumi Systems Ltd has ₹8.42 L overdue for 62 days. Warehouse goods dispatch lock is active until overdue clearing is verified by Accounts.
      </p>
    </div>
  </div>

  <button
    onClick={() => handleSendReminders(receivables.filter(r => r.buckets.b61_90 > 0))}
    className="px-3.5 py-1.5 bg-strand-red hover:bg-red-700 text-white font-mono font-semibold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition-all shrink-0"
  >
    <Send className="w-3.5 h-3.5" />
    <span>Dispatch Urgent Notice (Motherson Sumi)</span>
  </button>
</div>
```

#### Modernized Chaser Cadence Controls (in `PageHeader` `actions` slot)
```tsx
<div className="flex items-center gap-3">
  <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs font-mono text-on-surface">
    <span className="text-outline text-[11px] uppercase font-semibold">Chaser Cadence:</span>
    <select
      value={reminderCadence}
      onChange={(e) => setReminderCadence(parseInt(e.target.value))}
      className="bg-surface-container-lowest text-on-surface border border-outline-variant/30 rounded px-2 py-0.5 text-xs font-mono font-semibold focus:outline-none focus:border-primary"
    >
      <option value={7}>Every 7 Days (Weekly)</option>
      <option value={14}>Every 14 Days (Bi-Weekly)</option>
      <option value={30}>Every 30 Days (Monthly)</option>
    </select>
  </div>

  <button
    onClick={() => handleSendReminders([])}
    className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
  >
    <Send className="w-3.5 h-3.5" />
    <span>Send Overdue Reminders Now</span>
  </button>
</div>
```

#### Table Columns (`ColumnDef<ReceivableCustomer>[]`) — 36px Enforced
1. **`customerName`**:
   - Header: `"CUSTOMER NAME"`
   - Width: `"240px"`
   - Cell:
     ```tsx
     <div className="flex items-center gap-2 max-w-[240px] truncate">
       <span className="font-semibold text-xs text-on-surface truncate">{row.customerName}</span>
       {row.buckets.b61_90 > 0 && (
         <span className="inline-flex items-center gap-0.5 font-mono text-[9px] font-bold text-strand-red bg-red-500/10 border border-red-500/30 px-1 py-0.5 rounded shrink-0 animate-pulse">
           <Ban className="w-2.5 h-2.5" />
           <span>STOP DISPATCH</span>
         </span>
       )}
       <span className="text-[10px] font-mono text-outline shrink-0 ml-auto">
         {row.region}
       </span>
     </div>
     ```
2. **`totalReceivable`**:
   - Header: `"TOTAL RECEIVABLE"`
   - isNumeric: true, isMono: true, Width: `"135px"`
   - Cell: `<span className="font-bold text-on-surface tabular-nums">{formatINR(row.totalReceivable)}</span>`
3. **`b0_30`**:
   - Header: `"0–30 DAYS"`
   - isNumeric: true, isMono: true, Width: `"100px"`
   - Cell: `<span className="text-strand-green tabular-nums">{formatINR(row.buckets.b0_30)}</span>`
4. **`b31_45`**:
   - Header: `"31–45 DAYS"`
   - isNumeric: true, isMono: true, Width: `"100px"`
   - Cell: `<span className="text-on-surface-variant tabular-nums">{formatINR(row.buckets.b31_45)}</span>`
5. **`b46_60`**:
   - Header: `"46–60 DAYS"`
   - isNumeric: true, isMono: true, Width: `"105px"`
   - Cell:
     ```tsx
     row.buckets.b46_60 > 0 ? (
       <span className="text-strand-amber font-semibold tabular-nums">{formatINR(row.buckets.b46_60)}</span>
     ) : (
       <span className="text-outline tabular-nums">—</span>
     )
     ```
6. **`b61_90`**:
   - Header: `"61–90+ DAYS (OVERDUE)"`
   - isNumeric: true, isMono: true, Width: `"145px"`
   - Cell:
     ```tsx
     row.buckets.b61_90 > 0 ? (
       <span className="inline-flex items-center gap-1 font-mono font-bold text-strand-red bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded text-xs tabular-nums">
         <AlertTriangle className="w-3 h-3 text-strand-red shrink-0" />
         <span>{formatINR(row.buckets.b61_90)}</span>
       </span>
     ) : (
       <span className="text-outline tabular-nums">—</span>
     )
     ```
7. **`remindersCount`**:
   - Header: `"CHASER LOG"`
   - isMono: true, Width: `"130px"`
   - Cell:
     ```tsx
     <div className="flex items-center gap-1.5">
       <span className="font-mono text-xs font-semibold text-on-surface">{row.remindersCount} mails</span>
       <span className="text-[10px] font-mono text-outline truncate">
         ({row.lastReminderSent.split(' ')[0]} {row.lastReminderSent.split(' ')[1]})
       </span>
     </div>
     ```
8. **`nextScheduled`**:
   - Header: `"NEXT CHASE"`
   - isMono: true, Width: `"105px"`
   - Cell: `<span className="font-mono text-xs text-on-surface-variant">{row.nextScheduled.split(' ')[0]} {row.nextScheduled.split(' ')[1]}</span>`
9. **`collectionStatus`**:
   - Header: `"STATUS"`
   - Width: `"115px"`
   - Cell: `<StatusPill status={row.buckets.b61_90 > 0 ? 'stop dispatch blocked' : row.collectionStatus} />`
10. **`actions`**:
    - Header: `"ACTIONS"`
    - Width: `"130px"`
    - Cell:
      ```tsx
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); handleChaseSingleCustomer(row); }}
          className="px-2 py-0.5 text-[11px] font-mono font-medium rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
          title="Dispatch statement reminder email"
        >
          Chase
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleViewLedger(row); }}
          className="px-2 py-0.5 text-[11px] font-mono font-medium rounded border border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          title="View statements & invoices"
        >
          Ledger
        </button>
      </div>
      ```

#### DataGrid Saved Views & Bulk Actions
- `savedViews`:
  - `{ label: 'All Accounts', count: receivables.length, active: activeFilter === 'all', onClick: () => setActiveFilter('all') }`
  - `{ label: 'Overdue >60d (Stop-Dispatch)', count: 1, active: activeFilter === 'overdue', onClick: () => setActiveFilter('overdue') }`
  - `{ label: 'At Risk (46-60d)', count: 2, active: activeFilter === 'risk', onClick: () => setActiveFilter('risk') }`
  - `{ label: 'On Track (0-45d)', count: 2, active: activeFilter === 'ontrack', onClick: () => setActiveFilter('ontrack') }`
- `bulkActions`:
  - `{ label: 'Send Reminders to Selected', action: (selected) => handleSendReminders(selected) }`
  - `{ label: 'Generate Statements Batch', action: (selected) => ... }`

---

## 5. Verification Method

### 5.1 Independent Verification Commands
1. **TypeScript Typecheck**:
   ```powershell
   cd master-frontend/varun
   npm run typecheck
   ```
   *Expected result*: Exit code 0 with zero diagnostics or errors.
2. **Production Build**:
   ```powershell
   cd master-frontend/varun
   npm run build
   ```
   *Expected result*: Clean Vite production build output in `dist/`.
3. **Component Test Suite**:
   ```powershell
   npx ts-node src/components/common/__tests__/components.test.tsx
   ```
   *Expected result*: All 4 test suites pass (HealthPill, LinearProgressBar, KPICard, DataGrid).

### 5.2 Visual & Inspection Checklist
- **Payables Console (`/accounts/payables`)**:
  - [ ] 4-across `KPICard` summary strip renders at the top with formatted currency figures (`₹2.47 Cr`, `₹73.50 L`, etc.).
  - [ ] 40-Day MSME alert banner uses `bg-surface-container-lowest`, `border-amber-500/40`, `border-l-4 border-l-strand-amber`.
  - [ ] All table headers are uppercase monospace (`font-mono uppercase text-[10px] tracking-wider text-outline`).
  - [ ] Table rows render at exactly 36px (`h-9`), no cells push vertical bounds.
  - [ ] Inline quick actions ("Pay", "Ledger", "Advice") render in the `ACTIONS` column.
  - [ ] Oldest bill age renders compact alert pill for MSME 40d+ vendors.
  - [ ] UTR numbers render as compact monospace emerald tags.
- **Receivables Console (`/accounts/receivables`)**:
  - [ ] 4-across `KPICard` summary strip renders at the top with ageing breakdown.
  - [ ] 60-Day Overdue Stop-Dispatch Hold banner renders with `border-l-4 border-l-strand-red` and Motherson Sumi lock context.
  - [ ] Customer Name cell renders pulsing `STOP DISPATCH` badge for Motherson Sumi.
  - [ ] Ageing bucket `61–90+ DAYS (OVERDUE)` highlights overdue amounts with alert badges.
  - [ ] Inline chaser actions ("Chase", "Ledger") render in the `ACTIONS` column.
  - [ ] Chaser cadence controls in `PageHeader` use Stitch container tokens.
  - [ ] Table rows render at exactly 36px (`h-9`).
- **Data & Routing Invalidation Conditions**:
  - [ ] `mockPayables` and `mockReceivables` must not be altered.
  - [ ] Route paths `/accounts/payables` and `/accounts/receivables` must not change.
