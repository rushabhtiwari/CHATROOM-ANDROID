# Handoff Report — Explorer Survey 3: Invoices, Billing, Payments & Vendor Registry

**Target Repository**: `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun`  
**Date & Time**: 2026-09-03T05:54:00Z  
**Author**: `teamwork_preview_explorer` (Survey 3)  
**Parent Agent ID**: `9229d9b4-c8ce-4784-b4aa-2efc0cf10724`  

---

## 1. Observation

### 1.1 Baseline Health & Build Integrity
- Command `npm run typecheck` (`tsc --noEmit`) executed cleanly with exit code 0 and 0 errors.
- Command `npm run build` (`tsc && vite build`) built cleanly in 14.46s with exit code 0.
- Vite bundle output produced:
  - `dist/index.html` (1.21 kB)
  - `dist/assets/index-BHusqZIT.css` (93.75 kB)
  - `dist/assets/emoji-picker-react.esm-BHXDV95u.js` (309.51 kB)
  - `dist/assets/markdown-xRgOuM4X.js` (336.94 kB)
  - `dist/assets/charts-D5ylOf7i.js` (588.26 kB)
  - `dist/assets/index-Dtu3FpLZ.js` (1,238.01 kB)

### 1.2 Invoices, Billing, Payments, Transactions, and Ledger Views
Direct file inspections across `src/pages/finance/`, `src/pages/reimbursements/`, and `src/pages/operations/`:

1. **Vendor Payables & UTR Remittance Tracker** (`src/pages/finance/Payables.tsx`, lines 18–151):
   - Route: `/accounts/payables`.
   - Data source: `mockPayables` (`PayableVendor[]` from `src/data/accounts.ts`, lines 241–314).
   - Core metrics & columns: `vendorName`, `totalOutstanding`, `dueThisWeek`, `creditDays`, `daysOldestBill`, `utrStatus` (with UTR number and advice mail timestamp).
   - Alert: 40-day credit warning banner for Saint-Gobain, Dow Chemical, and Reliance Industries (5 days left on 45-day credit cycle).
   - Component: Uses `<DataGrid>` (`src/components/common/DataGrid.tsx`).

2. **Customer Receivables & Ageing Chaser** (`src/pages/finance/Receivables.tsx`, lines 11–168):
   - Route: `/accounts/receivables`.
   - Data source: `mockReceivables` (`ReceivableCustomer[]` from `src/data/accounts.ts`, lines 122–239).
   - Columns: `customerName`, `totalReceivable`, 4 ageing buckets (`0–30 Days`, `31–45 Days`, `46–60 Days`, `61–90 Days (Overdue)`), `remindersCount`, `nextScheduled`, `collectionStatus`.
   - Controls: Chaser cadence selector (7, 14, 30 days) and bulk reminder dispatch trigger.
   - Component: Uses `<DataGrid>`.

3. **Finance & Accounts Overview** (`src/pages/finance/AccountsOverview.tsx`, lines 20–197):
   - Route: `/accounts`.
   - Data sources: `mockAccountsKPI`, `mockCashTrend` from `src/data/accounts.ts`.
   - 5 KPI metric cards: Net Cash Position, Total Receivables, Total Payables, Overdue >45 Days, Unreconciled Difference.
   - Recharts bar chart: 6-Month Billed Sales vs Realized Collections.
   - Navigation links to Bank Reconciliation, Receivables, Payables, Reports.

4. **Daily Bank-vs-Books Difference Report** (`src/pages/finance/BankReconciliation.tsx`, lines 20–216):
   - Route: `/accounts/reconciliation`.
   - Data sources: `mockBankStatementLines` (MT940 feed) and `mockBookEntries` (PACT ERP general ledger) from `src/data/accounts.ts`.
   - Dual-ledger layout: 6 columns for HDFC Bank Host-to-Host feed vs 6 columns for PACT ERP Journal & Receipt Book.
   - AI discrepancy detection and auto-match suggestion (`aiSuggestedReason`, UTR reference auto-match, manual voucher creation).

5. **Executive Reports & MIS Hub** (`src/pages/finance/ReportsHub.tsx`, lines 17–138; `ReportDetail.tsx`, lines 35–332):
   - Route: `/reports` and `/reports/:reportId`.
   - Data sources: `mockReportsList`, `mockSalesOrders`, `mockDebtorAgeingData`, `mockCustomerMISData` in `src/data/reports.ts`.
   - Includes tabular reporting for Customer PO-wise pending balances, Debtor Ageing Summary, Customer Revenue & Collection MIS, and Severity-shaded Receivables Ageing Slab Matrix.

6. **Reimbursements Claims Console** (`src/pages/reimbursements/ReimbursementsList.tsx`, lines 34–171):
   - Route: `/reimbursements`.
   - Data store: `useRts()` hook from `src/modules/rts/store.tsx`.
   - Action owner tabs: All claims, With HR, With Accounts, Awaiting payment, Settled.
   - Columns: `id` (claim code), `title` (purpose + employee), `category`, `amount` (`formatCurrency`), `submittedOn`, `status` (`<ClaimStatusPill>`).
   - Component: Uses `<DataGrid>`.

7. **Disbursement Console & Payout Ledger** (`src/pages/reimbursements/Disbursement.tsx`, lines 36–312):
   - Route: `/reimbursements/pay`.
   - Two operational tabs:
     - `Payment queue`: Aggregates payable claims per employee (`isPayable(status)`), bank account IFSC and masked account verification, payment method selector (`NEFT`, `IMPS`, `UPI`), single UTR release per employee.
     - `Payout ledger`: Historical ledger table (`<table className="w-full text-[12.5px]">`) with UTR reference, employee, method, amount, timestamp, status tone pill, and retry action.

8. **Claim Detail & Trust Boundary Audit** (`src/pages/reimbursements/ClaimDetail.tsx`, lines 38–421):
   - Route: `/reimbursements/:id`.
   - Compares employee-submitted claim values directly against OCR/AI receipt extraction (`claim.extraction`, `extractedAmount`).
   - Highlights edited amounts, policy findings, approval/rejection actions, audit timeline.

9. **Payment Receipt / Bank Voucher Advice** (`src/pages/reimbursements/PaymentReceipt.tsx`, lines 17–202):
   - Route: `/receipt/:utr`.
   - Chrome-less, printable document layout. Fetches `/api/receipt-context/:utr` or context.
   - Displays UTR advice masthead, employee banking destination, itemized claim breakdown table, and disclaimer.

10. **Supplier Purchase Orders** (`src/pages/operations/PurchaseOrders.tsx`, lines 11–99):
    - Route: `/purchase/orders`.
    - Columns: `poNumber`, `vendorName`, `item`, `value`, `deliveryDate`, `sentToVendorAt` (vendor dispatch sync timestamp), `grnStatus`, `status`.
    - Component: Uses `<DataGrid>`.

11. **Goods Receipt & 3-Way Reconciliation** (`src/pages/operations/GRNThreeWayMatch.tsx`, lines 19–207):
    - Route: `/purchase/grn`.
    - Data source: `mockThreeWayMatchRecords` (`ThreeWayMatchRecord[]` from `src/data/purchase.ts`).
    - 3-Way line comparison table matching PO Approved Parameter, Physical Stores GRN, and Vendor Tax Invoice across Delivered Quantity and Unit Billing Rate.
    - Inline actions: Generate Debit Note to PACT, query vendor commercial desk, route to Accounts.

12. **Advance Requisitions & Department Budgets** (`src/pages/operations/RequisitionsList.tsx`, lines 21–206; `BudgetAllocation.tsx`, lines 18–158):
    - Route: `/requisitions` and `/requisitions/budget`.
    - Advance tracking with bill attachment flags, PACT ERP sync status, 4-level approval hierarchy.
    - Department expenditure allocation, burn %, personal advance limits.

---

### 1.3 Vendor Registry, Partner Directory, Drawers & Scorecards

1. **Current Vendor Data Landscape**:
   - There is currently **no standalone `/vendors` route** in `src/App.tsx`.
   - Vendor data is fragmented across:
     - `src/pages/finance/Payables.tsx`: `mockPayables` (`VND-001` through `VND-005`: Saint-Gobain, Dow Chemical, Wacker Metroark, PolyChem, Reliance Industries).
     - `src/pages/operations/PurchaseOverview.tsx`: Supplier Performance Scorecard (`mockSupplierPerformance`).
     - `src/pages/operations/VendorComparison.tsx`: Vendor RFQ landed cost & lead-time comparison matrix (`mockVendorComparisons`).
     - `src/pages/operations/PurchaseOrders.tsx`: PO records with vendor links (`mockPurchaseOrders`).
     - `src/pages/operations/GRNThreeWayMatch.tsx`: 3-way match records with vendor names (`mockThreeWayMatchRecords`).
   - Customer/Partner Directory data resides in `src/data/customers.ts` (`mockCustomers`, `Customer[]`: Motherson Sumi, Alstom Transport, GE Power, Suzlon Energy, Cummins India, Schneider Electric, etc.), currently consumed in `CommandPalette.tsx`, `EmailIntake.tsx`, `DispatchBoard.tsx`, and `RFQDetail.tsx`.

2. **Supplier Performance Scorecard Table** (`src/pages/operations/PurchaseOverview.tsx`, lines 91–133):
   - Table headers: Vendor Name, On-Time Delivery %, Quality Reject %, Avg Lead Time, Quality Tier.
   - Evaluates suppliers against historical GRN inspection records, on-time delivery %, quality rejection %, lead time in days, and ratings (`Tier 1`, `Tier 2`).

3. **Established Drawer Architecture in Codebase**:
   - `src/components/projects/WorkItemPeek.tsx` (lines 41–104):
     - Slide-over drawer with click-catcher backdrop (`bg-on-surface/20 backdrop-blur-[0.5px]`).
     - Fixed right-aligned drawer container (`fixed inset-y-0 right-0 z-40 w-full max-w-[720px] flex-col border-l border-outline-variant/30 bg-surface-container-lowest shadow-2xl`).
     - Header (`h-12 border-b border-outline-variant/30 px-4 flex items-center justify-between`) with ID, state pill, copy link, maximize, close.
   - `src/components/projects/WorkItemDetail.tsx` (lines 34–40, 279–340):
     - Two-column detail view: left content body and right attribute sidebar (`w-64 shrink-0 border-l border-outline-variant/30 bg-surface-container-low/40 p-4 select-none`).
     - Sidebar header: `<h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-outline font-mono">Attributes</h3>`.
     - Standardized property field rows: `<div className="flex items-center justify-between py-1.5 border-b border-outline-variant/15 text-xs">`.

---

### 1.4 Table Formatting & Standards Analysis

1. **Row Heights**:
   - `src/components/common/DataGrid.tsx` (line 365):
     ```tsx
     <tr className={`... ${isCompact ? 'h-9' : 'h-11'}`}>
     ```
     - Default row height is `h-11` (44px).
     - Compact toggle switches to `h-9` (36px).
     - The requirement mandates standardizing to **36px fixed row height** as the console default.
   - Native `<table>` elements (`Disbursement.tsx:247`, `GRNThreeWayMatch.tsx:109`, `VendorComparison.tsx:121`, `PurchaseOverview.tsx:116`, `ReportDetail.tsx:169`):
     - Cell padding is `p-2.5` or `p-3`, resulting in computed heights of 40px to 48px.

2. **Column Headers**:
   - `DataGrid.tsx` (line 286):
     ```tsx
     <thead className="bg-surface-2/95 backdrop-blur-sm text-muted text-[10px] font-semibold uppercase tracking-[0.09em] border-b border-line sticky top-0 z-10 select-none">
     ```
     - Lacks `font-mono`.
   - Native tables across `ReportDetail.tsx`, `GRNThreeWayMatch.tsx`, `Disbursement.tsx`:
     - Often omit `font-mono` or use generic `th` styling (`text-[10px] uppercase text-muted` without monospace).
   - Target Precision Console standard:
     `text-[10px] font-mono font-semibold uppercase tracking-[0.08em] text-muted border-b border-outline-variant/30 bg-surface-container-low` (or `bg-canvas`).

3. **Status Pills**:
   - `src/components/common/StatusPill.tsx` (lines 83–90):
     ```tsx
     <span className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-[3px] rounded-badge text-[10.5px] font-medium leading-none border ${bgClass} ${className}`}>
       <span className={`w-[5px] h-[5px] rounded-full ${dotClass} shrink-0`} />
       <span className="whitespace-nowrap">{status}</span>
     </span>
     ```
   - `src/pages/reimbursements/ClaimStatusPill.tsx` (lines 27–34):
     ```tsx
     <span className={`inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${tone.pill} ${className}`}>
       <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
       {statusLabel(status)}
     </span>
     ```
   - Both components provide the exact visual hierarchy needed; table rows should consistently render status fields through these pills.

4. **Filter Toolbars & Inline Quick Actions**:
   - `DataGrid.tsx` contains top search, saved view badges, compact toggle, and export CSV button.
   - However, individual table rows in `Payables.tsx`, `Receivables.tsx`, and `PurchaseOrders.tsx` lack **hover inline quick actions** (e.g., "Pay", "View Ledger", "Send Advice", "Match Voucher", "Dispute").

---

### 1.5 Business Logic, Mock Stores, Hooks & Lockout Rules

1. **Friday 12:00 PM Operational Lockout Rule**:
   - `src/data/automations.ts` (lines 119–124):
     ```ts
     name: 'Friday Weekly Auto-Close & Scoreboard Computation',
     triggerText: 'Schedule: Every Friday at 12:00 PM IST',
     readableSentence: 'Every Friday at 12:00 PM sharp, automatically lock project task sheets, calculate department compliance standings, and archive the weekly progress summary.',
     ```
   - `src/modules/projects/selectors.ts` (lines 274–288):
     `isStale` checks whether project work items have not been updated since Friday noon (`differenceInCalendarDays(startOfDay(today), parseISO(lastActivityAt)) >= 7`).
   - `src/pages/projects/ProjectsGrid.tsx` (lines 201–217):
     Banner warns: *"Update task logs before Friday 12:00 PM — the operational week closes automatically. Unlogged work orders and task hours affect plant performance and standing scorecards."*

2. **40-Day Credit Alert & MSME Payment Run**:
   - `src/data/automations.ts` (lines 87–93):
     40-Day Vendor Credit Due Window Alert: identifies vendor bills reaching 40 days on a 45-day credit cycle every Tuesday and Thursday to prevent statutory MSME interest penalties.
   - `src/pages/finance/Payables.tsx` (lines 118–140):
     Banner highlights 3 vendors (Saint-Gobain, Dow Chemical, Reliance Industries) reaching 40 days this week, routing to the Thursday payment run.

3. **60-Day Overdue Stop-Dispatch Hold**:
   - `src/data/customers.ts` (lines 18–19) and `src/pages/revenue/DispatchBoard.tsx` (lines 185–203):
     Customers with receivables overdue past 60 days are flagged with `stopDispatch: true`. Release is permitted only by Accounts Head (Meera Iyer).

4. **Requisition & Budget Monthly Lockout**:
   - `src/pages/operations/BudgetAllocation.tsx` (lines 43–64):
     Expenditure plans must be submitted by the 24th of each month; department budget allocations lock automatically on the 25th for Managing Director sign-off.

5. **State Synchronization & Mock Stores**:
   - `RtsProvider` (`src/modules/rts/store.tsx`): backed by SSE `/api/state` and `/api/subscribeToState`. Fallback gracefully renders when backend server is offline while keeping data model shapes fully intact.
   - `ProjectsProvider` (`src/modules/projects/store.tsx`): fully client-side reactive store persisted in `localStorage` (`kiran_projects_state_v1`).
   - `ChatProvider` (`src/lib/chat-store.ts`): in-memory multi-room conversation state.
   - Mock data arrays in `src/data/` (`accounts.ts`, `purchase.ts`, `customers.ts`, `requisitions.ts`): state changes use local React state handlers and toast notifications without destructive side-effects.

---

## 2. Logic Chain

1. **Build Baseline Integrity**:
   - `npm run typecheck` passes with 0 errors, and `npm run build` generates production assets without errors.
   - Therefore, any refactoring in downstream milestones must maintain TypeScript strictness and zero bundle errors.

2. **Console Invoices, Billing, and Payments Consolidation**:
   - Finance and Procurement domains operate around common monetary flows:
     - Outflow: Requisition -> Purchase Order (`PurchaseOrders.tsx`) -> GRN 3-Way Match (`GRNThreeWayMatch.tsx`) -> Payables & UTR Remittance (`Payables.tsx`) -> Payout Disbursement (`Disbursement.tsx`).
     - Inflow: RFQ -> Quotation -> Sales Order -> Dispatch -> Receivables & Ageing Chaser (`Receivables.tsx`) -> Bank Reconciliation (`BankReconciliation.tsx`).
   - Standardizing these tables with the 36px fixed row height and monospace column headers creates visual and operational unity across all ledger views.

3. **Vendor Registry & Partner Directory Architectural Alignment**:
   - Currently, vendor information is scattered between `Payables.tsx` (commercial status), `PurchaseOverview.tsx` (supplier performance scorecard), `VendorComparison.tsx` (quotes and landed cost), and `PurchaseOrders.tsx` (open POs).
   - Upgrading to a unified Vendor Registry / Partner Directory console requires:
     - Industrial card grid and table views with avatar badges (e.g. tier badges, vendor initials).
     - Standard slide-over detail drawer matching `WorkItemPeek.tsx` (`max-w-[720px]`, `border-outline-variant/30`, `bg-surface-container-lowest`).
     - Right attribute sidebar matching `WorkItemDetail.tsx` (monospaced "Attributes" section, GSTIN, MSME classification, credit terms, bank details).
     - Performance scorecard component showing on-time delivery %, quality rejection %, lead times, and ratings.

4. **Table Formatting Standardization**:
   - In `DataGrid.tsx`, setting default row height to `h-9` (36px) and adding `font-mono` to headers immediately standardizes all 12+ pages utilizing `DataGrid`.
   - In native tables (`Disbursement.tsx`, `GRNThreeWayMatch.tsx`, `VendorComparison.tsx`, `PurchaseOverview.tsx`), converting `thead` to `font-mono text-[10px] uppercase tracking-[0.08em] text-muted border-b border-outline-variant/30` and row classes to `h-9` standardizes remaining custom views.

5. **Non-Destructive Guardrail Adherence**:
   - The Friday weekly lockout rule (12:00 PM IST auto-close), 40-day credit alert on 45-day terms, 60-day stop-dispatch hold, and monthly budget lock (25th) represent core business domain logic.
   - Refactoring must preserve all mock data schemas, hook interfaces (`useRts`, `useProjects`, `useChat`), and interactive action toasts.

---

## 3. Caveats

- **Backend Offline in Dev**: If the Python backend on `:3001` is not actively running, `RtsProvider` logs a graceful fallback error toast and operates from static shapes; client UI must remain fully operational in this disconnected state.
- **Vite Large Chunk Warning**: Vite issues a bundle warning for `index.js` (1,238 kB > 900 kB), which is an architectural optimization task (code-splitting via dynamic `import()`) noted in R3 of the original request and should not be disrupted.
- **No Git Operations**: In strict compliance with R5 and prompt constraints, zero `git commit` or `git push` commands were executed.

---

## 4. Conclusion

The Kiran OS frontend in `master-frontend/varun` has a clean TypeScript and build foundation with rich data structures across Invoices, Billing, Payments, and Procurement. The visual modernization required to elevate it into a Precision Engineering Industrial Console consists of four concrete implementation streams:

1. **Table Engine Standard**:
   - Standardize `DataGrid.tsx` default row height to `h-9` (36px) with uppercase monospace headers (`text-[10px] font-mono uppercase tracking-[0.08em] text-muted`).
   - Add inline quick-action button slots (e.g. UTR advice dispatch, voucher matching, PO release) and filter strips.
   - Refactor native table implementations in `Disbursement.tsx`, `GRNThreeWayMatch.tsx`, `VendorComparison.tsx`, and `PurchaseOverview.tsx` to match this exact 36px monospace specification.

2. **Vendor Registry & Partner Directory**:
   - Unify vendor and customer master records into an industrial console layout (grid/table view, category chips, tier avatars).
   - Implement the slide-over detail drawer (`720px` right slide-over, `surface-container-lowest`, hairline borders) with a dedicated right attribute sidebar (GSTIN, MSME, credit terms, bank details) modeled after `WorkItemPeek` / `WorkItemDetail`.
   - Embed supplier performance scorecards with on-time delivery %, quality rejection %, lead times, and ratings.

3. **Invoices, Billing & Payments Console**:
   - Refactor `Payables.tsx`, `Receivables.tsx`, `BankReconciliation.tsx`, and `Disbursement.tsx` to utilize the high-density console tokens, 4-across KPI cards, compact status pills, and synchronized ledger views.

4. **Business Constraint Preservation**:
   - Maintain all existing state, mock stores, hooks (`useRts`, `useProjects`), and rules: Friday 12:00 PM auto-close, 40-day credit alert on 45-day cycle, and 60-day overdue Stop-Dispatch hold.

---

## 5. Verification Method

To independently reproduce and verify all observations and conclusions:

1. **TypeScript Typecheck**:
   ```bash
   cd c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun
   npm run typecheck
   ```
   *Expected result*: Exit status 0 with zero diagnostic errors.

2. **Production Build**:
   ```bash
   cd c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun
   npm run build
   ```
   *Expected result*: Successful production compilation into `dist/`.

3. **Inspect Key File Artifacts**:
   - Table engine: `src/components/common/DataGrid.tsx` (lines 286, 365)
   - Payables & UTR: `src/pages/finance/Payables.tsx` (lines 27–101, 118–149)
   - Receivables: `src/pages/finance/Receivables.tsx` (lines 22–111, 153–166)
   - Disbursement ledger: `src/pages/reimbursements/Disbursement.tsx` (lines 232–304)
   - 3-Way match: `src/pages/operations/GRNThreeWayMatch.tsx` (lines 97–151)
   - Supplier scorecard: `src/pages/operations/PurchaseOverview.tsx` (lines 91–133)
   - Vendor comparison: `src/pages/operations/VendorComparison.tsx` (lines 88–243)
   - Reference drawer: `src/components/projects/WorkItemPeek.tsx` and `WorkItemDetail.tsx`
   - Friday lockout rule: `src/data/automations.ts` (lines 119–124) and `src/modules/projects/selectors.ts` (lines 274–288)
