# Project: Kiran OS Frontend Modernization

## Architecture
- **Target Working Directory**: `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun`
- **Design Paradigm**: Stitch Precision Engineering Industrial Console
- **Surface Token Ramp**:
  - `bg-surface-container-lowest` (#ffffff) for primary foreground cards and modal sheets
  - `bg-surface-container-low` (#eff4ff) for control rails, secondary trays, and table headers
  - `bg-surface-container` (#e5eeff) for active progress tracks and container elements
  - `bg-surface-container-high` (#dce9ff) and `bg-surface-container-highest` (#d3e4fe) for hover/active states
  - Hairline dividers: `border-outline-variant/30` (#c2c6d1 with 30% alpha)
  - Monospace typography: `"IBM Plex Mono"` for headers, badges, metric values, and financial figures (`font-mono tabular-nums`)
- **State & Data Boundaries**:
  - All modifications are strictly clientside in `master-frontend/varun`.
  - Mock stores in `src/data/` (`accounts.ts`, `purchase.ts`, `customers.ts`, `automations.ts`, etc.) and context stores (`src/modules/rts/`, `src/modules/projects/`) are strictly preserved.
  - Business rules (Friday 12:00 PM auto-close, 40-day credit warning on 45-day MSME cycle, 60-day overdue stop-dispatch hold, 25th monthly budget lock) are strictly respected and non-destructive.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Stitch Tokens in CSS Primitives | Add Stitch CSS variables to `src/index.css` and modernize `.panel`, `.grid-head`, `.panel-header` | M1 | Survey 1 |
| 2 | Global Shell Layout Alignment | Update `AppShell.tsx` and route container layout with Stitch canvas tokens and proper edge-to-edge padding support | M1 | Survey 1 |
| 3 | Modernized TopBar & Breadcrumbs | Update `TopBar.tsx` with `bg-surface-container-lowest/90 backdrop-blur-md`, hairline divider, monospace breadcrumb keys, and elevated search launcher | M1 | Survey 1 |
| 4 | Sidebar Console Alignment | Sharpen `Sidebar.tsx` section markers to uppercase monospace (`tracking-widest text-[9px] uppercase text-white/40`) and hairline border | M1 | Survey 1 |
| 5 | Standardized PageHeader | Modernize `PageHeader.tsx` with uppercase monospace category eyebrow, action toolbar slot, and hairline divider | M1 | Survey 1 |
| 6 | DataGrid Console Baseline | Update `DataGrid.tsx` with 36px fixed row height default (`h-9`), uppercase monospace headers, and primary active selection indicator | M1 | Survey 1 |
| 7 | Shared KPICard Primitive | Implement reusable `KPICard.tsx` in `src/components/common/` supporting Stitch tokens, monospace metrics, and secondary footers | M2 | Survey 2 |
| 8 | Shared LinearProgressBar Primitive | Implement reusable `LinearProgressBar.tsx` in `src/components/common/` with dual-segment fill and fractional counters | M2 | Survey 2 |
| 9 | Shared HealthPill Primitive | Implement reusable `HealthPill.tsx` in `src/components/common/` with animated pulsing dots for On Track, At Risk, Overdue | M2 | Survey 2 |
| 10 | Executive CommandCenter Dashboard | Modernize `CommandCenter.tsx` with 4-across KPI cards, monospace currency/unit values, and linear progress bars | M2 | Survey 2 |
| 11 | Finance AccountsOverview Dashboard | Standardize `AccountsOverview.tsx` to 4-across responsive grid, Stitch tokens, and monospace metrics | M2 | Survey 2 |
| 12 | Operations PurchaseOverview Dashboard | Modernize `PurchaseOverview.tsx` with 4-across KPI cards, Stitch tokens, and monospace figures | M2 | Survey 2 |
| 13 | Intelligence Dashboards (AIOverview & AICosts) | Modernize `AIOverview.tsx` and `AICosts.tsx` with 4-across KPI cards, Stitch progress bars, and monospace unit economics | M2 | Survey 2 |
| 14 | BudgetAllocation Dashboard | Refactor progress bars and metric cards in `BudgetAllocation.tsx` to use Stitch container tokens | M2 | Survey 2 |
| 15 | Vendor Payables Console & MSME Alert | Refactor `Payables.tsx` with 36px fixed row height, uppercase monospace headers, compact pills, inline actions, and MSME alert | M3 | Survey 3 |
| 16 | Customer Receivables Console | Refactor `Receivables.tsx` with 36px row height, monospace headers, ageing bucket pills, and inline chaser actions | M3 | Survey 3 |
| 17 | Daily Bank-vs-Books Difference Ledger | Refactor `BankReconciliation.tsx` dual-ledger tables with 36px row height and uppercase monospace headers | M3 | Survey 3 |
| 18 | Reimbursements & Payout Ledger | Refactor `ReimbursementsList.tsx` and `Disbursement.tsx` with 36px row heights, uppercase monospace headers, and UTR pills | M3 | Survey 3 |
| 19 | Purchase Orders & GRN 3-Way Reconciliation | Refactor `PurchaseOrders.tsx` and `GRNThreeWayMatch.tsx` with 36px row heights, uppercase monospace headers, and action strips | M3 | Survey 3 |
| 20 | Unified Vendor Registry & Partner Directory | Create `VendorRegistry.tsx` (with grid/table view toggle, avatar badges, tag chips, and scorecard metrics) and link route `/vendors` | M4 | Survey 3 |
| 21 | Vendor Detail Drawer & Attribute Sidebar | Implement slide-over drawer matching `WorkItemPeek.tsx` with 256px right attribute sidebar matching `WorkItemDetail.tsx` | M4 | Survey 3 |
| 22 | Supplier Performance Scorecard Component | Implement standalone scorecard component for vendor evaluation (on-time delivery %, quality rejection %, lead times) | M4 | Survey 3 |
| 23 | E2E Opaque-Box Test Suite | Build comprehensive E2E test suite covering Tiers 1-4 across shell, dashboards, billing, and vendors | M5 | Testing Track |
| 24 | Typecheck & Build Validation | Verify `npm run typecheck` (0 errors) and `npm run build` (clean production build) | M5 | Integrity |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Global Shell, Navigation Alignment & Core Primitives | Features 1-6: `src/index.css`, `AppShell.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `PageHeader.tsx`, `DataGrid.tsx` | None | PLANNED |
| M2 | Shared Industrial Primitives & Dashboards Modernization | Features 7-14: `KPICard.tsx`, `LinearProgressBar.tsx`, `HealthPill.tsx`, `CommandCenter.tsx`, `AccountsOverview.tsx`, `PurchaseOverview.tsx`, `AIOverview.tsx`, `AICosts.tsx`, `BudgetAllocation.tsx` | M1 | PLANNED |
| M3 | Invoices, Billing & Payments Console Refactoring | Features 15-19: `Payables.tsx`, `Receivables.tsx`, `BankReconciliation.tsx`, `ReimbursementsList.tsx`, `Disbursement.tsx`, `PurchaseOrders.tsx`, `GRNThreeWayMatch.tsx` | M1, M2 | PLANNED |
| M4 | Vendor Registry & Partner Directory Console | Features 20-22: `VendorRegistry.tsx`, `VendorDetailDrawer.tsx`, `VendorScorecard.tsx`, `App.tsx`, `Sidebar.tsx` | M1, M2, M3 | PLANNED |
| M5 | E2E Testing Track, Typecheck & Production Build Verification | Features 23-24: E2E test suite execution, `npm run typecheck` 0 errors, `npm run build` 0 errors, Forensic Integrity Audit | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### Primitives ↔ Dashboards / Consoles
- **`KPICard`**:
  ```tsx
  export interface KPICardProps {
    title: string;
    value: string | number;
    unit?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    trend?: { value: string; positive?: boolean; neutral?: boolean };
    status?: 'on_track' | 'at_risk' | 'overdue' | 'neutral';
    footerLeft?: React.ReactNode;
    footerRight?: React.ReactNode;
    className?: string;
  }
  ```
- **`LinearProgressBar`**:
  ```tsx
  export interface LinearProgressBarProps {
    value: number; // 0-100
    secondaryValue?: number; // 0-100 (in-progress segment)
    label?: string;
    valueLabel?: string;
    fractionLabel?: string;
    showLabels?: boolean;
    variant?: 'primary' | 'success' | 'warning' | 'danger';
    className?: string;
  }
  ```
- **`HealthPill`**:
  ```tsx
  export interface HealthPillProps {
    status: 'on_track' | 'at_risk' | 'overdue' | 'stale' | string;
    label?: string;
    showPulse?: boolean;
    size?: 'sm' | 'md';
    className?: string;
  }
  ```

### Vendor Registry ↔ Shell / Navigation
- **Route**: `/vendors` mapped in `src/App.tsx` and integrated in `src/components/shell/Sidebar.tsx` under Procurement/Operations navigation.
- **Drawer**: `VendorDetailDrawer` opens on vendor row/card click with slide-over backdrop and 256px right attribute sidebar.

## Code Layout
- `master-frontend/varun/src/styles/` & `src/index.css`: Design token CSS variables and core utility classes
- `master-frontend/varun/src/components/shell/`: `AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `PageHeader.tsx`, `CommandPalette.tsx`
- `master-frontend/varun/src/components/common/`: `DataGrid.tsx`, `KPICard.tsx`, `LinearProgressBar.tsx`, `HealthPill.tsx`, `StatusPill.tsx`
- `master-frontend/varun/src/pages/command/`: `CommandCenter.tsx`
- `master-frontend/varun/src/pages/finance/`: `AccountsOverview.tsx`, `Payables.tsx`, `Receivables.tsx`, `BankReconciliation.tsx`, `ReportsHub.tsx`, `ReportDetail.tsx`
- `master-frontend/varun/src/pages/operations/`: `PurchaseOverview.tsx`, `PurchaseOrders.tsx`, `GRNThreeWayMatch.tsx`, `BudgetAllocation.tsx`, `VendorRegistry.tsx` (new)
- `master-frontend/varun/src/pages/intelligence/`: `AIOverview.tsx`, `AICosts.tsx`
- `master-frontend/varun/src/pages/reimbursements/`: `ReimbursementsList.tsx`, `Disbursement.tsx`, `ClaimDetail.tsx`
