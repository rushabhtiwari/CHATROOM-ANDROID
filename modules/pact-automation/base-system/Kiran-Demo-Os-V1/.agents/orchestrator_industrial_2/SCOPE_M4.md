# Scope: Milestone 4 — Vendor Registry & Partner Directory Console

## Objective
Implement a unified Vendor Registry and Partner Directory console (`/vendors`), featuring:
1. Industrial console card grids and high-density 36px fixed table views with grid/table view toggle.
2. Avatar badges, tag chips (chemical, packaging, electronics categories; Tier 1 / Tier 2 status), and scorecard metrics.
3. Slide-over `VendorDetailDrawer.tsx` matching `WorkItemPeek.tsx` with a 256px right attribute sidebar matching `WorkItemDetail.tsx` (GSTIN, MSME status, credit days, bank IFSC & account, contact person).
4. Standalone `VendorScorecard.tsx` component evaluating on-time delivery %, quality rejection %, average lead time in days, and quality rating.
5. Integration into `src/App.tsx` (route `/vendors`) and `src/components/shell/Sidebar.tsx` (under Procurement / Operations).

## Target Files & Ownership
1. `src/pages/operations/VendorRegistry.tsx` (Feature 20)
2. `src/components/vendors/VendorDetailDrawer.tsx` (Feature 21)
3. `src/components/vendors/VendorScorecard.tsx` (Feature 22)
4. `src/App.tsx` (Route registration for `/vendors`)
5. `src/components/shell/Sidebar.tsx` (Navigation link for Vendor Registry)
6. Data Sources: `src/data/purchase.ts` (`mockSupplierPerformance`, `mockVendorComparisons`), `src/data/accounts.ts` (`mockPayables`), `src/data/customers.ts` (`mockCustomers`).

## Requirements
- Support dual-view: High-density 36px DataGrid table view + Industrial console card grid view.
- Click on any vendor row or card opens `VendorDetailDrawer`.
- Drawer features slide-over animation, backdrop blur (`bg-on-surface/20`), header strip, tab bar (Overview, Purchase Orders, Performance Scorecard, Commercials), and a 256px right attribute sidebar (`w-64 border-l border-outline-variant/30 bg-surface-container-low/40 p-4 font-mono`).
- Strictly preserve all existing mock data stores, types, and existing routes.
- Zero git commits or pushes.
- `npm run typecheck` and `npm run build` must pass cleanly.
