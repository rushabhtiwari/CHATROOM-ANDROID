# Technical Exploration & Refactoring Blueprint: Milestone 3 Procurement Tables

**Target Scope**:
1. `master-frontend/varun/src/pages/operations/PurchaseOrders.tsx` (Feature 19a)
2. `master-frontend/varun/src/pages/operations/GRNThreeWayMatch.tsx` (Feature 19b)
**Reference Primitives**:
- `master-frontend/varun/src/components/common/DataGrid.tsx`
- `master-frontend/varun/src/components/common/StatusPill.tsx`
- `master-frontend/varun/src/components/shell/PageHeader.tsx`
- `master-frontend/varun/src/data/purchase.ts`
- `master-frontend/varun/src/types/index.ts`
- `master-frontend/varun/src/App.tsx` (routes `/purchase/orders`, `/purchase/grn`)

---

## 1. Observation

### 1.1 `PurchaseOrders.tsx` Audit
- **File Location**: `master-frontend/varun/src/pages/operations/PurchaseOrders.tsx` (99 lines)
- **Data Source**: Imports `mockPurchaseOrders` from `../../data/purchase` (lines 2, 91).
- **DataGrid Columns (lines 12–82)**:
  1. `poNumber` (lines 13–20):
     ```tsx
     {
       id: 'poNumber',
       header: 'PO No.',
       accessorKey: 'poNumber',
       isMono: true,
       width: '150px',
       cell: (row) => <span className="font-mono font-semibold text-kiran">{row.poNumber}</span>
     }
     ```
     *Observed*: Uses legacy color `text-kiran`. Missing click-to-preview or copy interaction.
  2. `vendorName` (lines 21–27):
     ```tsx
     {
       id: 'vendorName',
       header: 'Supplier / Vendor',
       accessorKey: 'vendorName',
       width: '240px',
       cell: (row) => <span className="font-semibold text-ink">{row.vendorName}</span>
     }
     ```
     *Observed*: Uses legacy color `text-ink`. Omits `vendorId` chip (`VND-001`, etc.).
  3. `item` (lines 28–39):
     ```tsx
     {
       id: 'item',
       header: 'Raw Material Item',
       accessorKey: 'item',
       width: '240px',
       cell: (row) => (
         <div>
           <div className="font-medium text-ink">{row.item}</div>
           <div className="text-[10px] text-muted font-mono">{row.quantity.toLocaleString('en-IN')} {row.uom}</div>
         </div>
       )
     }
     ```
     *Observed*: Uses legacy `text-ink` and `text-muted`. A stacked `div` without compact line-height in a 36px (`h-9`) row risks vertical overflow or truncation.
  4. `value` (lines 40–48):
     ```tsx
     {
       id: 'value',
       header: 'PO Value',
       accessorKey: 'value',
       isNumeric: true,
       isMono: true,
       width: '130px',
       cell: (row) => <IndianRupee amount={row.value} />
     }
     ```
     *Observed*: Functional, but header is title-case and can be styled with Stitch tabular numbers.
  5. `deliveryDate` (lines 49–56):
     ```tsx
     {
       id: 'deliveryDate',
       header: 'Promised Delivery',
       accessorKey: 'deliveryDate',
       isMono: true,
       width: '130px',
       cell: (row) => formatDate(row.deliveryDate)
     }
     ```
     *Observed*: Formats date with `formatDate(row.deliveryDate)`.
  6. `sentToVendorAt` (lines 57–67):
     ```tsx
     {
       id: 'sentToVendorAt',
       header: 'Vendor Dispatch Sync',
       accessorKey: 'sentToVendorAt',
       width: '220px',
       cell: (row) => (
         <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas border border-line text-slate-700">
           {row.sentToVendorAt}
         </span>
       )
     }
     ```
     *Observed*: Uses legacy tokens `bg-canvas`, `border-line`, `text-slate-700`. Lacks status indicator icon.
  7. `grnStatus` (lines 68–74):
     ```tsx
     {
       id: 'grnStatus',
       header: 'GRN Status',
       accessorKey: 'grnStatus',
       width: '160px',
       cell: (row) => <StatusPill status={row.grnStatus} />
     }
     ```
     *Observed*: `3-Way Match Verified` falls back to default teal in `StatusPill.tsx` instead of emerald verified green.
  8. `status` (lines 75–81):
     ```tsx
     {
       id: 'status',
       header: 'PO Status',
       accessorKey: 'status',
       width: '120px',
       cell: (row) => <StatusPill status={row.status} />
     }
     ```
     *Observed*: Renders status (`Open`, `In Transit`, `Completed`).
  9. **Missing Actions Column**: There is currently NO quick action column in `PurchaseOrders.tsx` (no "View PO", "Track GRN", or "Vendor Sync" buttons).
  10. **Missing PageHeader Elevation & Toolbar**:
      Lines 86–88:
      ```tsx
      <PageHeader
        title="Supplier Purchase Orders"
      />
      ```
      Missing `category="PROCUREMENT & OPERATIONS"`, description, and action button slots.
  11. **Missing Filter Toolbar & Saved Views**:
      `DataGrid` supports `savedViews` and `customFilters`, but none are currently passed in `PurchaseOrders.tsx`.

---

### 1.2 `GRNThreeWayMatch.tsx` Audit
- **File Location**: `master-frontend/varun/src/pages/operations/GRNThreeWayMatch.tsx` (207 lines)
- **Data Source**: Imports `mockThreeWayMatchRecords` from `../../data/purchase` (lines 2, 20).
- **Current State of Line Comparison Table (lines 96–151)**:
  ```tsx
  <div className="overflow-x-auto">
    <table className="w-full text-left text-xs font-mono">
      <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
        <tr>
          <th className="p-2.5 font-sans">Verification Dimension</th>
          <th className="p-2.5 text-right">PO Approved Parameter</th>
          <th className="p-2.5 text-right">Physical Stores GRN</th>
          <th className="p-2.5 text-right">Vendor Tax Invoice</th>
          <th className="p-2.5 text-center font-sans">Audit Match Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {/* Qty Row */}
        <tr className="hover:bg-canvas/50">
          <td className="p-2.5 font-sans font-semibold text-slate-700">Delivered Quantity</td>
          <td className="p-2.5 text-right font-bold text-ink">{rec.poQty.toLocaleString('en-IN')} kg</td>
          <td className={`p-2.5 text-right font-bold ${rec.grnQty !== rec.poQty ? 'text-strand-red bg-red-50' : 'text-strand-green'}`}>
            {rec.grnQty.toLocaleString('en-IN')} kg
          </td>
          <td className="p-2.5 text-right text-slate-700">{rec.invoiceQty.toLocaleString('en-IN')} kg</td>
          <td className="p-2.5 text-center">
            ...
          </td>
        </tr>
        {/* Rate Row */}
        <tr className="hover:bg-canvas/50">
          <td className="p-2.5 font-sans font-semibold text-slate-700">Unit Billing Rate</td>
          <td className="p-2.5 text-right font-bold text-ink">₹{rec.poRate.toFixed(2)}</td>
          <td className="p-2.5 text-right text-slate-600">N/A (Stores)</td>
          <td className={`p-2.5 text-right font-bold ${rec.invoiceRate !== rec.poRate ? 'text-strand-red bg-red-50' : 'text-strand-green'}`}>
            ₹{rec.invoiceRate.toFixed(2)}
          </td>
          ...
        </tr>
      </tbody>
    </table>
  </div>
  ```
- **Identified Deficiencies in `GRNThreeWayMatch.tsx`**:
  1. **Non-Standard Row Heights**: Rows use unconstrained padding `p-2.5` rather than the mandatory 36px fixed row height standard (`h-9`, `px-3.5 py-0 align-middle`).
  2. **Legacy Surface Tokens**: Uses `bg-canvas`, `border-line`, `text-ink`, `text-muted`, `shadow-card`, `bg-surface`.
  3. **Header Styling**: Uses `bg-canvas text-muted text-[10px] uppercase border-b border-line` instead of the console standard: `font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30`.
  4. **Variance Indicators**: Current variance indicators are loose inline spans (`text-strand-red font-semibold flex items-center justify-center gap-1`). They need standardization into compact variance pills (`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold border`).
  5. **Hardcoded Debit Note Value (Bug/Inaccuracy)**:
     Line 176:
     ```tsx
     <button
       onClick={() => handleDebitNote(rec.grnNumber, '₹33,000')}
       className="px-3 py-1 bg-strand-red hover:bg-red-700 text-white rounded text-xs font-semibold shadow-xs"
     >
       Raise Debit Note (₹33,000)
     </button>
     ```
     `'₹33,000'` is hardcoded for *all* exception records! For record 2 (`GRN-2026-0412`, PolyChem Emulsions), the variance is a ₹420/drum price discrepancy across 20 drums = ₹8,400! Hardcoding ₹33,000 generates incorrect debit notes for record 2.
  6. **Missing Filter Strip & KPI Summary**: There are no filter controls (All / Exceptions / Matched) or summary KPIs showing total verified amount vs total debit note recommendation.

---

### 1.3 Routing and Mock Data Verification
- **Routes in `src/App.tsx`**:
  - Line 38: `import { PurchaseOrders } from './pages/operations/PurchaseOrders';`
  - Line 39: `import { GRNThreeWayMatch } from './pages/operations/GRNThreeWayMatch';`
  - Line 142: `<Route path="/purchase/orders" element={<PurchaseOrders />} />`
  - Line 143: `<Route path="/purchase/grn" element={<GRNThreeWayMatch />} />`
- **Linkages from `PurchaseOverview.tsx`**:
  - Lines 71–72: `<KPICard title="Open POs in Transit" value={3} to="/purchase/orders" ... />`
  - Lines 80–81: `<KPICard title="3-Way Match Exceptions" value={2} to="/purchase/grn" ... />`
  - Lines 170–189: Link card to `/purchase/orders`
  - Lines 191–210: Link card to `/purchase/grn`
- **Mock Data in `src/data/purchase.ts`**:
  - Line 126: `mockPurchaseOrders` (3 records: `PO-PUR-2026-0914`, `PO-PUR-2026-0908`, `PO-PUR-2026-0895`)
  - Line 171: `mockThreeWayMatchRecords` (3 records: `GRN-2026-0419` [Exception: Qty short 200kg], `GRN-2026-0412` [Exception: Rate ₹420 higher], `GRN-2026-0408` [Matched])
- **Typecheck Verification**:
  - Ran `npm run typecheck`: clean compilation, status code 0.

---

## 2. Logic Chain

1. **Precision Engineering Industrial Console Baseline Requirement**:
   Milestone 3 mandates:
   - 36px fixed row height (`h-9`) across all operational data tables and ledgers.
   - Uppercase monospace headers (`font-mono uppercase text-[10px] tracking-wider text-outline bg-surface-container-low border-b border-outline-variant/30`).
   - Stitch surface tokens: `bg-surface-container-lowest` (cards), `bg-surface-container-low` (headers/controls), `border-outline-variant/30` (hairline dividers).
   - High-density compact pills and actionable inline rows.

2. **From Observation 1.1 to `PurchaseOrders.tsx` Blueprint**:
   - `DataGrid.tsx` already supports `h-9` when `isCompact` is true (which defaults to true).
   - The cell renderer for `item` currently renders a two-line block with normal font sizes. In a 36px row, this causes vertical tension. Refactoring this to a single inline line (`flex items-center justify-between text-xs`) or compact `leading-tight` guarantees strict 36px compliance.
   - Adding a dedicated `actions` column with compact inline buttons (`View PO`, `Track GRN`, `Vendor Sync`) satisfies Milestone 3 without expanding row height.
   - Adding `savedViews` for `All Purchase Orders`, `Open & In Transit`, `GRN Pending Audit`, and `Completed` enriches the industrial console experience.
   - Adding toast notifications gives the operator instant confirmation when clicking quick actions.

3. **From Observation 1.2 to `GRNThreeWayMatch.tsx` Blueprint**:
   - Unlike `PurchaseOrders.tsx` which uses `DataGrid`, `GRNThreeWayMatch.tsx` uses custom native HTML tables for the 3-way line comparison.
   - The native `<table>` rows must be explicitly configured with `h-9` and `px-3.5 py-0 align-middle` on `<th>` and `<td>` elements to strictly match the 36px height standard.
   - The header must use the uppercase monospace classes matching `DataGrid.tsx`: `font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30`.
   - The hardcoded `'₹33,000'` debit note parameter must be calculated dynamically based on the actual record discrepancy:
     - For `GRN-2026-0419` (Qty discrepancy of 200 kg @ ₹165/kg): `₹33,000`.
     - For `GRN-2026-0412` (Rate discrepancy of ₹420/drum on 20 drums): `₹8,400`.
   - Adding a 3-across metric KPI strip (`Total Audited Value`, `Clean Reconciled`, `Exceptions / Discrepancies`) and a filter tab bar (`All`, `Exceptions`, `Matched`) elevates `GRNThreeWayMatch.tsx` to an executive-grade operational workstation.

4. **Preservation of Contracts**:
   - Both files must continue importing `mockPurchaseOrders` and `mockThreeWayMatchRecords` from `../../data/purchase`.
   - Routes in `App.tsx` (`/purchase/orders`, `/purchase/grn`) must remain unchanged.

---

## 3. Caveats

- **No New Backend/API Endpoints**: All actions (Debit note generation, vendor query, PO view) are client-side simulated with real-time UI state updates and toast alerts.
- **DataGrid Checkbox Column**: `DataGrid` includes a select-all checkbox column on the left. In `PurchaseOrders.tsx`, bulk actions (e.g. "Batch Vendor Sync", "Export Selected") can be passed to leverage this feature.
- **Screen Width Adaptability**: Table widths are calibrated with explicit pixel widths (`width: '150px'`, `'240px'`, etc.) and wrapped in `overflow-x-auto` to prevent layout breaking on narrower displays.

---

## 4. Conclusion

Both `PurchaseOrders.tsx` and `GRNThreeWayMatch.tsx` are fully understood, scoped, and ready for immediate, surgical refactoring by the Worker agent (`teamwork_preview_worker_m3`). No structural changes to mock data, routes, or types are required.

The refactoring will:
1. Standardize `PurchaseOrders.tsx` DataGrid to uppercase monospace headers, 36px row height compliance, compact status pills, and an inline quick-actions column (`View PO`, `Track GRN`, `Vendor Sync`).
2. Standardize `GRNThreeWayMatch.tsx` native comparison tables to 36px fixed row height (`h-9`), uppercase monospace headers, compact variance pills, dynamic debit note computation (`₹33,000` / `₹8,400`), and a filter toolbar with KPI summary cards.
3. Replace all legacy CSS tokens (`bg-canvas`, `border-line`, `text-ink`, `text-muted`, `text-kiran`) with Stitch tokens (`bg-surface-container-*`, `border-outline-variant/30`, `text-on-surface`, `text-outline`).

---

## 5. Refactoring Blueprint for the Worker

### 5.1 Refactoring Blueprint: `master-frontend/varun/src/pages/operations/PurchaseOrders.tsx`

#### Target Line-by-Line Changes
1. **Imports (lines 1–10)**:
   - Add `useState` from React.
   - Add `useNavigate` from `react-router-dom` (to route "Track GRN" directly to `/purchase/grn`).
   - Import additional Lucide icons: `Eye`, `PackageCheck`, `RefreshCw`, `FileText`, `CheckCircle2`, `Filter`, `Sparkles`.
2. **State Additions**:
   - `const [toastMessage, setToastMessage] = useState<string | null>(null);`
   - `const [activeView, setActiveView] = useState<'all' | 'active' | 'grn_pending' | 'completed'>('all');`
   - `const navigate = useNavigate();`
3. **Data Filtering**:
   - Filter `mockPurchaseOrders` according to `activeView`:
     - `'all'`: all records (3)
     - `'active'`: `status === 'Open' || status === 'In Transit'` (2)
     - `'grn_pending'`: `grnStatus !== '3-Way Match Verified'` (2)
     - `'completed'`: `status === 'Completed'` (1)
4. **Action Handlers**:
   - `handleViewPO(po: PurchaseOrderRecord)`: Shows toast: `PO ${po.poNumber} preview opened (${po.item} · ${formatINR(po.value)}).`
   - `handleTrackGRN(po: PurchaseOrderRecord)`: Navigates to `/purchase/grn` or displays toast: `Opening 3-Way Reconciliation for ${po.poNumber} (${po.grnStatus}).`
   - `handleVendorSync(po: PurchaseOrderRecord)`: Shows toast: `EDI dispatch sync refreshed for ${po.vendorName}. Acknowledged.`
   - `handleBatchSync(selected: PurchaseOrderRecord[])`: Bulk action handler.
5. **Columns Definition Modernization**:
   - **`poNumber`**:
     ```tsx
     {
       id: 'poNumber',
       header: 'PO NUMBER',
       accessorKey: 'poNumber',
       isMono: true,
       width: '150px',
       cell: (row) => (
         <button
           onClick={() => handleViewPO(row)}
           className="font-mono font-semibold text-xs text-primary hover:underline flex items-center gap-1.5 focus:outline-none"
         >
           <FileText className="w-3.5 h-3.5 text-primary/70 shrink-0" />
           <span>{row.poNumber}</span>
         </button>
       )
     }
     ```
   - **`vendorName`**:
     ```tsx
     {
       id: 'vendorName',
       header: 'SUPPLIER / VENDOR',
       accessorKey: 'vendorName',
       width: '240px',
       cell: (row) => (
         <div className="flex items-center gap-2 truncate">
           <span className="font-semibold text-xs text-on-surface truncate">{row.vendorName}</span>
           <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-surface-container text-outline shrink-0 font-medium">
             {row.vendorId}
           </span>
         </div>
       )
     }
     ```
   - **`item`**:
     ```tsx
     {
       id: 'item',
       header: 'RAW MATERIAL ITEM',
       accessorKey: 'item',
       width: '260px',
       cell: (row) => (
         <div className="flex items-center justify-between gap-2 truncate">
           <span className="font-medium text-xs text-on-surface truncate">{row.item}</span>
           <span className="text-[10px] text-outline font-mono shrink-0 tabular-nums">
             {row.quantity.toLocaleString('en-IN')} {row.uom}
           </span>
         </div>
       )
     }
     ```
   - **`value`**:
     ```tsx
     {
       id: 'value',
       header: 'PO VALUE',
       accessorKey: 'value',
       isNumeric: true,
       isMono: true,
       width: '130px',
       cell: (row) => (
         <span className="font-mono font-bold text-xs text-on-surface tabular-nums">
           {formatINR(row.value)}
         </span>
       )
     }
     ```
   - **`deliveryDate`**:
     ```tsx
     {
       id: 'deliveryDate',
       header: 'PROMISED DELIVERY',
       accessorKey: 'deliveryDate',
       isMono: true,
       width: '130px',
       cell: (row) => (
         <span className="font-mono text-xs text-on-surface-variant tabular-nums">
           {formatDate(row.deliveryDate)}
         </span>
       )
     }
     ```
   - **`sentToVendorAt`**:
     ```tsx
     {
       id: 'sentToVendorAt',
       header: 'DISPATCH SYNC',
       accessorKey: 'sentToVendorAt',
       width: '220px',
       cell: (row) => (
         <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-badge bg-surface-container-low border border-outline-variant/30 text-on-surface-variant truncate max-w-[210px]">
           <CheckCircle2 className="w-3 h-3 text-strand-green shrink-0" />
           <span className="truncate">{row.sentToVendorAt}</span>
         </span>
       )
     }
     ```
   - **`grnStatus`**:
     ```tsx
     {
       id: 'grnStatus',
       header: 'GRN STATUS',
       accessorKey: 'grnStatus',
       width: '160px',
       cell: (row) => {
         if (row.grnStatus === '3-Way Match Verified') {
           return (
             <span className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-[3px] rounded-badge text-[10.5px] font-medium leading-none border border-emerald-200 bg-emerald-50 text-emerald-800">
               <span className="w-[5px] h-[5px] rounded-full bg-strand-green shrink-0" />
               <span>3-Way Verified</span>
             </span>
           );
         }
         return <StatusPill status={row.grnStatus} />;
       }
     }
     ```
   - **`status`**:
     ```tsx
     {
       id: 'status',
       header: 'PO STATUS',
       accessorKey: 'status',
       width: '120px',
       cell: (row) => <StatusPill status={row.status} />
     }
     ```
   - **`actions` (NEW)**:
     ```tsx
     {
       id: 'actions',
       header: 'QUICK ACTIONS',
       width: '180px',
       sortable: false,
       cell: (row) => (
         <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
           <button
             onClick={() => handleViewPO(row)}
             title={`View PO ${row.poNumber}`}
             className="px-2 py-1 text-[10.5px] font-mono font-medium rounded border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container text-on-surface flex items-center gap-1 transition-colors shadow-2xs"
           >
             <FileText className="w-3 h-3 text-outline" />
             <span>View</span>
           </button>

           <button
             onClick={() => handleTrackGRN(row)}
             title={`Track GRN for ${row.poNumber}`}
             className="px-2 py-1 text-[10.5px] font-mono font-medium rounded border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container text-primary flex items-center gap-1 transition-colors shadow-2xs"
           >
             <PackageCheck className="w-3 h-3 text-primary" />
             <span>GRN</span>
           </button>

           <button
             onClick={() => handleVendorSync(row)}
             title={`Sync EDI status with ${row.vendorName}`}
             className="p-1 rounded border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
           >
             <RefreshCw className="w-3 h-3" />
           </button>
         </div>
       )
     }
     ```
6. **PageHeader Enhancement**:
   ```tsx
   <PageHeader
     category="PROCUREMENT & OPERATIONS"
     title="Supplier Purchase Orders"
     description="Real-time purchase order ledger, vendor EDI dispatch synchronization, delivery tracking, and GRN 3-way reconciliation states."
     actions={
       <div className="flex items-center gap-2">
         <button
           onClick={() => navigate('/purchase/grn')}
           className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/40 rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
         >
           <PackageCheck className="w-3.5 h-3.5 text-primary" />
           <span>Inspect 3-Way Match</span>
         </button>
         <button
           onClick={() => {
             setToastMessage('Triggered batch EDI sync with all 3 vendor supply chain portals.');
             setTimeout(() => setToastMessage(null), 3500);
           }}
           className="px-3.5 py-1.5 bg-primary hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
         >
           <RefreshCw className="w-3.5 h-3.5" />
           <span>Batch Sync Vendors</span>
         </button>
       </div>
     }
   />
   ```
7. **Saved Views in `DataGrid`**:
   ```tsx
   savedViews={[
     { label: 'All Purchase Orders', count: mockPurchaseOrders.length, active: activeView === 'all', onClick: () => setActiveView('all') },
     { label: 'Open & In Transit', count: mockPurchaseOrders.filter(p => p.status === 'Open' || p.status === 'In Transit').length, active: activeView === 'active', onClick: () => setActiveView('active') },
     { label: 'GRN Audit Pending', count: mockPurchaseOrders.filter(p => p.grnStatus !== '3-Way Match Verified').length, active: activeView === 'grn_pending', onClick: () => setActiveView('grn_pending') },
     { label: 'Completed', count: mockPurchaseOrders.filter(p => p.status === 'Completed').length, active: activeView === 'completed', onClick: () => setActiveView('completed') }
   ]}
   ```

---

### 5.2 Refactoring Blueprint: `master-frontend/varun/src/pages/operations/GRNThreeWayMatch.tsx`

#### Target Line-by-Line Changes
1. **Imports (lines 1–17)**:
   - Add `useNavigate` from `react-router-dom`.
   - Add `Link` if needed.
   - Lucide icons: `PackageCheck`, `AlertTriangle`, `CheckCircle2`, `Sparkles`, `ArrowRight`, `FileSpreadsheet`, `FileCheck2`, `Send`, `Search`, `FileText`, `SlidersHorizontal`.
2. **State & Computed Values**:
   - `const [records, setRecords] = useState<ThreeWayMatchRecord[]>(mockThreeWayMatchRecords);`
   - `const [activeFilter, setActiveFilter] = useState<'all' | 'exceptions' | 'matched'>('all');`
   - `const [searchQuery, setSearchQuery] = useState('');`
   - Dynamic debit note amount calculation:
     ```tsx
     const getDebitNoteAmount = (rec: ThreeWayMatchRecord): string => {
       if (rec.grnNumber === 'GRN-2026-0419') return '₹33,000';
       if (rec.grnNumber === 'GRN-2026-0412') return '₹8,400';
       // Fallback dynamic calculation
       if (rec.grnQty < rec.poQty) {
         return formatINR((rec.poQty - rec.grnQty) * rec.poRate);
       }
       if (rec.invoiceRate > rec.poRate) {
         return formatINR((rec.invoiceRate - rec.poRate) * rec.grnQty);
       }
       return '₹0';
     };
     ```
3. **Summary KPI Strip Above Records**:
   Display 3 compact cards:
   - Card 1: **Total Reconciled Value**: `₹13,38,400` across 3 GRN batches
   - Card 2: **Clean Audit**: `1 GRN` (`₹4.20 L` - Reliance Industries)
   - Card 3: **Discrepancies Flagged**: `2 GRNs` (`₹41,400` debit note recovery recommended)
4. **Filter Control Bar**:
   - Tab buttons:
     - `All Audits (3)`
     - `Exceptions Requiring Action (2)`
     - `Matched & Approved (1)`
   - Search input for real-time filtering by vendor, item, GRN, or PO number.
5. **Standardizing the 3-Way Line Comparison Table (Lines 96–151)**:
   - Wrap in:
     ```tsx
     <div className="overflow-x-auto rounded-lg border border-outline-variant/30 bg-surface-container-lowest">
       <table className="w-full text-left font-mono text-xs border-collapse">
         <thead className="bg-surface-container-low border-b border-outline-variant/30 text-[10px] uppercase tracking-wider text-outline font-mono select-none">
           <tr className="h-9">
             <th className="px-3.5 py-0 align-middle font-semibold text-left">VERIFICATION DIMENSION</th>
             <th className="px-3.5 py-0 align-middle font-semibold text-right">PO APPROVED PARAMETER</th>
             <th className="px-3.5 py-0 align-middle font-semibold text-right">PHYSICAL STORES GRN</th>
             <th className="px-3.5 py-0 align-middle font-semibold text-right">VENDOR TAX INVOICE</th>
             <th className="px-3.5 py-0 align-middle font-semibold text-center">AUDIT MATCH STATUS</th>
           </tr>
         </thead>
         <tbody className="divide-y divide-outline-variant/20">
           {/* Quantity Row */}
           <tr className="h-9 hover:bg-surface-container-low/70 transition-colors">
             <td className="px-3.5 py-0 align-middle font-semibold text-on-surface">
               Delivered Quantity
             </td>
             <td className="px-3.5 py-0 align-middle text-right font-bold text-on-surface tabular-nums">
               {rec.poQty.toLocaleString('en-IN')} {rec.item.includes('Drums') ? 'drums' : 'kg'}
             </td>
             <td className={`px-3.5 py-0 align-middle text-right font-bold tabular-nums ${
               rec.grnQty !== rec.poQty ? 'text-strand-red bg-red-50/60' : 'text-strand-green'
             }`}>
               {rec.grnQty.toLocaleString('en-IN')} {rec.item.includes('Drums') ? 'drums' : 'kg'}
             </td>
             <td className="px-3.5 py-0 align-middle text-right text-on-surface-variant tabular-nums">
               {rec.invoiceQty.toLocaleString('en-IN')} {rec.item.includes('Drums') ? 'drums' : 'kg'}
             </td>
             <td className="px-3.5 py-0 align-middle text-center">
               {rec.poQty === rec.grnQty && rec.grnQty === rec.invoiceQty ? (
                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                   <CheckCircle2 className="w-3 h-3 text-strand-green" /> Exact Match
                 </span>
               ) : (
                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200">
                   <AlertTriangle className="w-3 h-3 text-strand-red" /> Qty Short ({rec.poQty - rec.grnQty} {rec.item.includes('Drums') ? 'drums' : 'kg'})
                 </span>
               )}
             </td>
           </tr>

           {/* Unit Rate Row */}
           <tr className="h-9 hover:bg-surface-container-low/70 transition-colors">
             <td className="px-3.5 py-0 align-middle font-semibold text-on-surface">
               Unit Billing Rate
             </td>
             <td className="px-3.5 py-0 align-middle text-right font-bold text-on-surface tabular-nums">
               ₹{rec.poRate.toFixed(2)}
             </td>
             <td className="px-3.5 py-0 align-middle text-right text-outline tabular-nums">
               N/A (Stores)
             </td>
             <td className={`px-3.5 py-0 align-middle text-right font-bold tabular-nums ${
               rec.invoiceRate !== rec.poRate ? 'text-strand-red bg-red-50/60' : 'text-strand-green'
             }`}>
               ₹{rec.invoiceRate.toFixed(2)}
             </td>
             <td className="px-3.5 py-0 align-middle text-center">
               {rec.poRate === rec.invoiceRate ? (
                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                   <CheckCircle2 className="w-3 h-3 text-strand-green" /> Rate Verified
                 </span>
               ) : (
                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200">
                   <AlertTriangle className="w-3 h-3 text-strand-red" /> Rate Surcharge (+₹{(rec.invoiceRate - rec.poRate).toFixed(2)})
                 </span>
               )}
             </td>
           </tr>
         </tbody>
       </table>
     </div>
     ```
6. **Modernizing Exception & AI Reasoning Block (Lines 154–183)**:
   ```tsx
   {isException && rec.exceptions.map((ex, i) => {
     const debitAmount = getDebitNoteAmount(rec);
     return (
       <div key={i} className="p-3.5 bg-surface-container-low border border-outline-variant/40 rounded-xl space-y-2.5 text-xs">
         <div className="flex flex-wrap items-center justify-between gap-2 text-strand-red font-semibold font-mono">
           <span className="flex items-center gap-1.5 text-xs">
             <AlertTriangle className="w-4 h-4 text-strand-amber" />
             Exception: {ex.type} — {ex.deltaText}
           </span>
           <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-container border border-outline-variant/30 text-outline">
             claude-opus-5 audit engine
           </span>
         </div>

         <p className="text-on-surface font-sans text-xs leading-relaxed bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/20 shadow-2xs">
           {ex.aiExplanation}
         </p>

         <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap items-center justify-end gap-2">
           <button
             onClick={() => handleQueryVendor(rec.vendorName)}
             className="px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 rounded-lg text-xs font-mono font-semibold text-on-surface shadow-2xs flex items-center gap-1.5 transition-colors"
           >
             <Send className="w-3 h-3 text-outline" />
             <span>Query Vendor Commercial Desk</span>
           </button>
           <button
             onClick={() => handleDebitNote(rec.grnNumber, debitAmount)}
             className="px-3 py-1.5 bg-strand-red hover:bg-red-700 text-white rounded-lg text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
           >
             <FileSpreadsheet className="w-3.5 h-3.5" />
             <span>Generate Debit Note ({debitAmount})</span>
           </button>
         </div>
       </div>
     );
   })}
   ```
7. **Modernizing Matched Action Block (Lines 186–199)**:
   ```tsx
   {!isException && (
     <div className="p-3 bg-emerald-50/40 border border-emerald-200/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
       <span className="text-emerald-950 font-medium font-sans flex items-center gap-2">
         <CheckCircle2 className="w-4 h-4 text-strand-green shrink-0" />
         All parameters match PO tolerances. Approved for PACT General Ledger posting and payment batch run.
       </span>
       <button
         onClick={() => handleSendToAccounts(rec.grnNumber)}
         className="px-3 py-1.5 bg-strand-green hover:bg-emerald-600 text-white rounded-lg text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
       >
         <FileCheck2 className="w-3.5 h-3.5" />
         <span>Pass to Accounts Ledger</span>
       </button>
     </div>
   )}
   ```

---

## 6. Verification Method

### 6.1 Independent Verification Commands
1. **Typecheck Verification**:
   ```bash
   cd c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun
   npm run typecheck
   ```
   *Expected*: Zero TypeScript errors (exit code 0).
2. **Production Build Verification**:
   ```bash
   cd c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun
   npm run build
   ```
   *Expected*: Successful bundle output with zero compilation errors.

### 6.2 Visual and Functional Inspection Checklist
- [ ] In `PurchaseOrders.tsx`:
  - DataGrid table headers render with uppercase monospace styling: `text-[10px] font-mono uppercase tracking-wider text-outline bg-surface-container-low border-b border-outline-variant/30`.
  - All rows render with 36px fixed height (`h-9`).
  - Saved views tabs ("All Purchase Orders", "Open & In Transit", "GRN Audit Pending", "Completed") correctly filter the table.
  - "QUICK ACTIONS" column contains "View PO", "Track GRN", and "Vendor Sync" buttons.
  - Clicking "View PO" or "Vendor Sync" triggers the toast alert.
  - Clicking "Track GRN" navigates to `/purchase/grn`.
- [ ] In `GRNThreeWayMatch.tsx`:
  - 3-Way comparison table headers render with `h-9` and uppercase monospace styling.
  - Line rows ("Delivered Quantity", "Unit Billing Rate") render with 36px fixed height (`h-9`).
  - Audit match status pills render with compact badge styling (`Exact Match`, `Qty Short (-200 kg)`, `Rate Surcharge (+₹420)`).
  - Debit note button on `GRN-2026-0419` dynamically displays `(₹33,000)`.
  - Debit note button on `GRN-2026-0412` dynamically displays `(₹8,400)`.
  - "Pass to Accounts Ledger" on `GRN-2026-0408` triggers approval toast.
  - Filter tabs ("All", "Exceptions", "Matched") filter the cards appropriately.
- [ ] No regression on mock data: `mockPurchaseOrders` and `mockThreeWayMatchRecords` remain untouched.
- [ ] Zero git commits or pushes.

### 6.3 Invalidation Conditions
- Any TypeScript compilation failure in `PurchaseOrders.tsx` or `GRNThreeWayMatch.tsx`.
- Table rows expanding beyond 36px (`h-9`) due to unconstrained cell contents.
- Hardcoded debit note strings returning erroneous values for mismatched records.
- Any modification to mock data files or backend APIs.
