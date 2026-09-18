# Handoff Report — Explorer Survey 2: Dashboards & KPI Components

**Summary**: This investigation surveys all executive and operational dashboard views across `master-frontend/varun`, audits existing KPI/metric cards, progress bars, health pills, and numerical typography, and compares them against the benchmark Precision Engineering standard established in the Project Management module (`CycleDetailPage.tsx` and `ProjectsGrid.tsx`). It details the concrete architectural gaps, code references, and refactoring blueprints needed to unify the console.

---

## 1. Observation

### 1.1 Executive & Operational Dashboard Routes and Pages Inventory

From `master-frontend/varun/src/App.tsx` and filesystem inspection, the following dashboard views and overview screens were located:

| Route Path | Page Component | File Path | Core Role | Existing Layout Grid |
|---|---|---|---|---|
| `/` | `CommandCenter` | `src/pages/command/CommandCenter.tsx` | Executive Command Center & Morning Briefing | 4-across cards (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`) + 2-col decision zone + 3 visual analysis cards |
| `/accounts` | `AccountsOverview` | `src/pages/finance/AccountsOverview.tsx` | Finance & Accounts Operational Overview | **5-across cards** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`) + 6-month billed vs collected chart + 3 module cards |
| `/purchase` | `PurchaseOverview` | `src/pages/operations/PurchaseOverview.tsx` | Procurement & Vendor Operations Overview | 4-across cards (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`) + Supplier scorecard table + 3 module cards |
| `/reports` | `ReportsHub` | `src/pages/finance/ReportsHub.tsx` | Executive Reports & MIS Hub | Category tabs + 2-column report card grid (`grid-cols-1 md:grid-cols-2 gap-6`) |
| `/reports/:reportId` | `ReportDetail` | `src/pages/finance/ReportDetail.tsx` | Computed Report Detail View | Export bar + AI observation card + summary charts & tables |
| `/ai` | `AIOverview` | `src/pages/intelligence/AIOverview.tsx` | AI Control Plane & Model Supervision | 4-across cards (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`) + Feature routing table + 4 sub-module cards |
| `/ai/costs` | `AICosts` | `src/pages/intelligence/AICosts.tsx` | AI Unit Economics & Inference Budget | 3-across budget cards (`grid-cols-1 sm:grid-cols-3 gap-4`) + 90-day trajectory area chart + dept cost chart |
| `/requisitions/budget` | `BudgetAllocation` | `src/pages/operations/BudgetAllocation.tsx` | Departmental Budget Allocation & Planning | 3 personal budget cards + 3-col department budget card grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`) |
| `/approvals` | `ApprovalsInbox` | `src/pages/approvals/ApprovalsInbox.tsx` | Unified Governance & Approvals Inbox | Split view: 3-col category rail, 5-col queue list, 4-col preview pane |
| `/dispatch` | `DispatchBoard` | `src/pages/revenue/DispatchBoard.tsx` | Logistics & Dispatch Pipeline Board | 6 horizontal stage columns with metric headers |
| `/reimbursements` | `ReimbursementsList` | `src/pages/reimbursements/ReimbursementsList.tsx` | Expense Reimbursements Management | Scope tabs + `ClaimSummaryBar` (4-across metric cards) + DataGrid |
| `/orders` | `OrdersList` | `src/pages/revenue/OrdersList.tsx` | Sales Orders Pipeline & Execution | 3-tile summary strip (`grid-cols-1 sm:grid-cols-3 gap-4`) + DataGrid |

---

### 1.2 The Project Management Reference Implementation (Precision Benchmark)

The Project Management module implements the Precision Engineering design system established in the brief (`master-frontend/varun/tailwind.config.js` and `src/pages/projects/`):

#### A. 4-Across KPI Cards Grid Benchmark (`CycleDetailPage.tsx:132-228`)
```tsx
// src/pages/projects/CycleDetailPage.tsx:132-152
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 px-6 py-4 bg-surface-container-low/40">
  {/* KPI 1: Total Workload */}
  <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
    <div className="flex items-center justify-between text-xs">
      <span className="font-semibold uppercase tracking-wider text-outline text-[11px] font-mono">
        Total Workload
      </span>
      <CheckCircle2 className="h-4 w-4 text-outline" />
    </div>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="text-2xl font-bold text-on-surface leading-none">{totalItems}</span>
      <span className="text-xs text-on-surface-variant">items</span>
      {totalPts > 0 && (
        <span className="font-mono text-xs text-outline ml-auto">{totalPts} pts</span>
      )}
    </div>
    <div className="mt-2.5 pt-2 flex items-center justify-between text-[11px] border-t border-outline-variant/15 text-outline">
      <span className="text-primary font-medium">100% In Scope</span>
      <span className="font-mono">{uniqueAssignees} assignees</span>
    </div>
  </div>
```
Key benchmark attributes:
1. **Container & Canvas Tokens**: Cards render with `bg-surface-container-lowest`, `rounded-xl`, hairline border `border-outline-variant/30`, subtle elevation `shadow-xs`, floating over low-contrast canvas `bg-surface-container-low/40`.
2. **Eyebrow Header**: `font-semibold uppercase tracking-wider text-outline text-[11px] font-mono` paired with status indicator or glyph.
3. **Primary Numerical Typography**: `text-2xl font-bold text-on-surface leading-none font-mono` with baseline-aligned unit labels (`items-baseline gap-2`, `text-xs text-on-surface-variant`).
4. **Card Footer Divider**: `mt-2.5 pt-2 flex items-center justify-between text-[11px] border-t border-outline-variant/15 text-outline` carrying contextual secondary metrics.

#### B. Linear Completion / Progress Bar Benchmark (`CycleDetailPage.tsx:106-128`)
```tsx
// src/pages/projects/CycleDetailPage.tsx:106-128
<div className="flex items-center gap-3 min-w-[280px]">
  <div className="flex flex-col flex-1 gap-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-on-surface-variant font-medium">Cycle Completion</span>
      <span className="text-primary font-bold">
        {completionPct}%{' '}
        <span className="text-outline font-normal font-mono text-[11px]">
          ({completedItems.length}/{totalItems} items)
        </span>
      </span>
    </div>
    <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden flex">
      <div
        className="h-full bg-primary transition-all duration-500"
        style={{ width: `${completionPct}%` }}
      />
      <div
        className="h-full bg-tertiary-fixed-dim transition-all duration-500"
        style={{ width: `${inProgressPct}%` }}
      />
    </div>
  </div>
</div>
```
Key benchmark attributes:
1. Container track uses `bg-surface-container` (`#e5eeff`), with `h-2 rounded-full overflow-hidden flex`.
2. Dual-state fills: Completed segment uses `bg-primary`, active/in-progress segment uses `bg-tertiary-fixed-dim` (`#4edea3`) with smooth transitions (`transition-all duration-500`).
3. Dual metric labeling: Primary bold percentage (`text-primary font-bold`) accompanied by fractional item count (`text-outline font-mono text-[11px]`).

#### C. Operational Health Pills Benchmark (`ProjectsGrid.tsx:252-267` & `CycleDetailPage.tsx:86-94`)
```tsx
// src/pages/projects/ProjectsGrid.tsx:252-267
{stale ? (
  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-strand-red">
    <AlertTriangle className="h-3 w-3" />
    Stale
  </span>
) : isAtRisk ? (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
    At Risk
  </span>
) : (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
    On Track
  </span>
)}
```
Key benchmark attributes:
1. Pill shape is strictly `rounded-full` with fine 1px tint borders (`border-emerald-200`, `border-amber-200`, `border-red-200`).
2. High-precision live operational pulse: Live active states feature a pulsing indicator dot (`h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse` or `bg-amber-500 animate-pulse`).
3. Compact typography: `text-[10.5px]` or `text-[11px] font-semibold`.

---

### 1.3 Direct Observations of Existing Non-Project Dashboard Components

#### A. Executive CommandCenter (`src/pages/command/CommandCenter.tsx:101-221`)
- **Card Surface Tokens**: Uses `bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50` (lines 105, 135, 165, 195).
- **Typography**: Card primary figures use variable-width display font `font-display font-bold text-3xl text-ink` (lines 116, 146, 176, 206) rather than monospace `font-mono`.
- **Currency Figures**: Currency values like `₹48.2 L` (line 147) and `₹13.62 L` (line 207) are rendered as raw strings in `font-display` rather than tabular monospace numbers.
- **Sparklines**: Ad-hoc custom div bars (`h-6 w-full flex items-end gap-1`, line 121) instead of unified metrics.
- **Health Indicators**: Ad-hoc styling (e.g. `text-xs font-mono font-medium text-strand-green bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200`, line 111), lacking the standard `rounded-full` pulse-dot pattern.
- **Progress Bars**: Absent entirely from the top KPI strip.

#### B. Finance AccountsOverview (`src/pages/finance/AccountsOverview.tsx:39-99`)
- **Grid Layout**: Explicitly violates the 4-across grid standard by using 5 columns:
  ```tsx
  // src/pages/finance/AccountsOverview.tsx:39
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 font-mono">
  ```
- **Typography**: Uses `text-xl font-display font-bold text-ink mt-1` (lines 44, 56, 68, 80, 92) rather than `font-mono`.
- **Tokens**: Uses `bg-surface border border-line rounded-lg p-4 shadow-card`.
- **Health Pills**: No operational health pills ("On Track", "At Risk", "Overdue") with pulse dots; instead renders loose lines like `<div className="text-[10px] text-strand-red mt-1 font-sans flex items-center gap-1 font-semibold"><AlertTriangle className="w-3 h-3" /> 3 Accounts flagged</div>` (lines 83-85).

#### C. Purchase Overview (`src/pages/operations/PurchaseOverview.tsx:45-90`)
- **Tokens & Radius**: Uses `p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card` (lines 48, 59, 70, 81).
- **Typography**: Uses `text-2xl font-display font-bold text-ink mt-1` (lines 53, 64, 75, 86).
- **Progress & Health**: Missing linear progress bars and animated health pills.
- **Scorecard Table**: Table headers and rows use legacy canvas/line styling without 36px fixed density or uppercase monospace headers.

#### D. AI Overview & Unit Economics (`src/pages/intelligence/AIOverview.tsx` & `AICosts.tsx`)
- **AIOverview KPI Cards (lines 36-96)**: Uses `p-4 bg-surface border border-line rounded-md shadow-card`, `text-2xl font-display font-bold text-ink`.
- **AICosts Progress Bar (lines 48-53)**:
  ```tsx
  // src/pages/intelligence/AICosts.tsx:48-53
  <div className="w-full h-2 bg-line rounded-full overflow-hidden">
    <div
      style={{ width: `${(mockAIOverviewKPI.totalSpendINR / 30000) * 100}%` }}
      className="h-full bg-ai rounded-full"
    />
  </div>
  ```
  Uses `bg-line` track instead of `bg-surface-container`, single un-transitioned bar, lacking dual-state tracking.

#### E. Departmental Budget Allocation (`src/pages/operations/BudgetAllocation.tsx:133-141`)
- **Progress Bar**:
  ```tsx
  // src/pages/operations/BudgetAllocation.tsx:133-141
  <div className="w-full h-2 bg-line rounded-full overflow-hidden">
    <div
      style={{ width: `${spentPct}%` }}
      className={`h-full rounded-full ${spentPct > 85 ? 'bg-strand-amber' : 'bg-strand-green'}`}
    />
  </div>
  ```
  Crude single-segment bar without fractional item counters or Stitch container backgrounds.

#### F. Shared Primitives Status
- `master-frontend/varun/src/components/common/StatusPill.tsx`:
  - Uses `rounded-badge` (`rounded-[4px]`, line 84) instead of `rounded-full`.
  - Dot is a static 5px square/circle (`w-[5px] h-[5px] rounded-full`, line 86) without `animate-pulse` (except for `blocked`).
- `master-frontend/varun/src/components/common/IndianRupee.tsx`:
  - Formats numbers in `font-mono`, but is only used in select tables/forms, not in dashboard KPI cards.
- **No Shared Component**: Grep searches confirm there is no `KPICard.tsx`, `MetricCard.tsx`, or `LinearProgressBar.tsx` in `src/components/common` or `src/components/ui`. Every dashboard writes custom, repetitive JSX.

---

## 2. Logic Chain

1. **Premise 1 (Design Mandate)**: R2 of `ORIGINAL_REQUEST.md` mandates:
   > "Modernize home and overview dashboards with high-density 4-across KPI cards, linear completion/progress bars, operational health pills (On Track, At Risk, Overdue), and monospace numerical figures formatted in standard currency and unit notations."
   And specifies matching the visual hierarchy, hairline borders (`border-outline-variant/30`), and surface container depth tokens (`bg-surface-container-lowest`, `bg-surface-container-low`) established in the Project Management module.

2. **Premise 2 (Observed Benchmark)**: The Project Management module (`CycleDetailPage.tsx` and `ProjectsGrid.tsx`) contains the verified reference implementation:
   - Layout: strict 4-across grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5`).
   - Surfaces: `bg-surface-container-lowest` card on `bg-surface-container-low/40` canvas.
   - Borders: hairline `border-outline-variant/30` with `shadow-xs`.
   - Headers: uppercase monospace eyebrows (`font-mono text-[11px] uppercase tracking-wider text-outline`).
   - Metrics: `font-mono text-2xl font-bold text-on-surface leading-none tabular-nums` with distinct unit labels.
   - Health: `rounded-full` pills with animated pulsing indicator dots (`animate-pulse`).
   - Progress: `h-2 rounded-full bg-surface-container overflow-hidden flex` with primary/tertiary dual-segment fills and fractional item counters.

3. **Inference 1 (Token Drift)**: In `CommandCenter.tsx`, `AccountsOverview.tsx`, `PurchaseOverview.tsx`, and `AIOverview.tsx`, every card uses `bg-surface`, `border-line`, `shadow-card`, and `rounded-lg`/`rounded-md`. This produces flat, low-contrast surfaces that clash with the industrial console aesthetic.

4. **Inference 2 (Grid Non-Compliance)**: `AccountsOverview.tsx` renders in 5 columns (`lg:grid-cols-5`), compressing each tile on medium screens and breaking rhythm with the rest of the application.

5. **Inference 3 (Typography Inconsistency)**: In `CommandCenter.tsx`, `AccountsOverview.tsx`, and `PurchaseOverview.tsx`, KPI figures use Archivo display font (`font-display font-bold`), causing numbers of varying lengths (e.g. `28` vs `₹13.62 L`) to jitter and misalign. Tabular alignment requires `font-mono font-bold tabular-nums`.

6. **Inference 4 (Code Duplication & Maintenance Burden)**: The complete absence of shared `KPICard`, `LinearProgressBar`, and `HealthPill` components has forced developers to repeatedly write ad-hoc JSX. Creating these standardized shared components in `src/components/common/` is the cleanest, most maintainable path to unifying all dashboards.

---

## 3. Caveats

1. **Friday Lockout Rules**: Friday noon cutoff rules and weekly lockout warnings (e.g. in `ProjectsGrid.tsx:206-210` and `BudgetAllocation.tsx:50-54`) are critical business logic; refactoring card layouts must not modify or remove any lockout messaging.
2. **Mock Data Stores**: All dashboard metrics derive from mock stores (`src/data/approvals.ts`, `src/data/accounts.ts`, `src/data/purchase.ts`, `src/data/aiControl.ts`, `src/data/reports.ts`, `src/data/dispatches.ts`). Component refactorings must consume these existing data models without breaking shape expectations.
3. **Responsive Breakpoints**: While 4-across is standard on desktop (`lg:grid-cols-4` or `xl:grid-cols-4`), mobile and tablet viewports must retain graceful degradation (`grid-cols-1 sm:grid-cols-2`).
4. **No Git Commands**: Under no circumstances should git commit or push commands be run, adhering to R5 guardrails.

---

## 4. Conclusion & Actionable Refactoring Plan

### 4.1 Synthesis of Gaps

| Component Dimension | Current Dashboard State | Project Management Benchmark | Refactoring Action Required |
|---|---|---|---|
| **Shared Primitives** | Non-existent; duplicate inline JSX across 7+ files | Embedded in `CycleDetailPage.tsx` and `Glyphs.tsx` | Create `KPICard.tsx`, `LinearProgressBar.tsx`, and `HealthPill.tsx` in `src/components/common/` |
| **Grid Rhythm** | Inconsistent: 5-col in Accounts, 3-col in AICosts/Orders, 4-col in CommandCenter | Strict 4-across responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5`) | Standardize `CommandCenter`, `AccountsOverview`, `PurchaseOverview`, and `AIOverview` to 4-across grids |
| **Surface Tokens** | `bg-surface border-line shadow-card rounded-lg` | `bg-surface-container-lowest border-outline-variant/30 shadow-xs rounded-xl` | Update all dashboard card containers to Stitch tokens |
| **Numerical Type** | `font-display font-bold text-3xl/2xl` (variable-width) | `font-mono font-bold tabular-nums leading-none` | Switch all primary figures to monospace tabular typography with baseline unit labels |
| **Currency Formats** | Mixed: raw strings, Lakhs without unit separation | Clean `formatINR` / `formatINRLakhCrore` with separate magnitude & unit | Standardize currency rendering across all KPI cards |
| **Health Badges** | Static 4px rectangles without live pulsing dots | `rounded-full` pills with animated pulsing dots (`animate-pulse`) | Standardize "On Track", "At Risk", and "Overdue" status pills |
| **Progress Bars** | Missing or crude single-segment `bg-line` tracks | Dual-segment `bg-surface-container` with fraction counters | Replace crude bars with standardized `LinearProgressBar` component |

---

### 4.2 Proposed Shared Component Blueprints

To eliminate duplicated JSX and ensure complete consistency, the implementer should introduce three lightweight, modular components in `master-frontend/varun/src/components/common/`:

#### A. Proposed `src/components/common/HealthPill.tsx`
```tsx
import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export type HealthStatus = 'on_track' | 'at_risk' | 'overdue' | 'stale' | string;

interface HealthPillProps {
  status: HealthStatus;
  label?: string;
  className?: string;
  pulse?: boolean;
}

export const HealthPill: React.FC<HealthPillProps> = ({
  status,
  label,
  className = '',
  pulse = true,
}) => {
  const norm = status?.toLowerCase().replace(/\s+/g, '_');

  if (norm === 'on_track' || norm === 'good') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800 ${className}`}>
        {pulse && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />}
        {label || 'On Track'}
      </span>
    );
  }

  if (norm === 'at_risk' || norm === 'warning') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 ${className}`}>
        {pulse && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
        {label || 'At Risk'}
      </span>
    );
  }

  if (norm === 'overdue' || norm === 'danger' || norm === 'critical') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-strand-red ${className}`}>
        {pulse ? <span className="h-1.5 w-1.5 rounded-full bg-strand-red animate-pulse" /> : <AlertCircle className="h-3 w-3" />}
        {label || 'Overdue'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container px-2 py-0.5 text-[10.5px] font-medium text-on-surface-variant ${className}`}>
      {label || status}
    </span>
  );
};
```

#### B. Proposed `src/components/common/LinearProgressBar.tsx`
```tsx
import React from 'react';

interface LinearProgressBarProps {
  label?: string;
  percentage: number;
  secondaryPercentage?: number;
  detail?: string;
  className?: string;
  heightClass?: string;
}

export const LinearProgressBar: React.FC<LinearProgressBarProps> = ({
  label,
  percentage,
  secondaryPercentage = 0,
  detail,
  className = '',
  heightClass = 'h-2',
}) => {
  const clampedPrimary = Math.max(0, Math.min(100, percentage));
  const clampedSecondary = Math.max(0, Math.min(100 - clampedPrimary, secondaryPercentage));

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {(label || detail) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-on-surface-variant font-medium">{label}</span>}
          <div className="flex items-baseline gap-1 ml-auto">
            <span className="text-primary font-bold font-mono text-xs">{clampedPrimary}%</span>
            {detail && <span className="text-outline font-normal font-mono text-[11px]">({detail})</span>}
          </div>
        </div>
      )}
      <div className={`w-full ${heightClass} rounded-full bg-surface-container overflow-hidden flex`}>
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${clampedPrimary}%` }}
        />
        {clampedSecondary > 0 && (
          <div
            className="h-full bg-tertiary-fixed-dim transition-all duration-500"
            style={{ width: `${clampedSecondary}%` }}
          />
        )}
      </div>
    </div>
  );
};
```

#### C. Proposed `src/components/common/KPICard.tsx`
```tsx
import React from 'react';
import { Link } from 'react-router-dom';

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  badge?: React.ReactNode;
  icon?: React.ElementType;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  badge,
  icon: Icon,
  trend,
  footerLeft,
  footerRight,
  to,
  onClick,
  className = '',
}) => {
  const content = (
    <div className={`bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30 shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-primary/60 hover:shadow-md ${to || onClick ? 'cursor-pointer group' : ''} ${className}`}>
      {/* Eyebrow Header Strip */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-outline text-[11px] font-mono truncate pr-2">
          {title}
        </span>
        <div className="shrink-0 flex items-center gap-1.5">
          {badge}
          {Icon && <Icon className="h-4 w-4 text-outline group-hover:text-primary transition-colors" />}
        </div>
      </div>

      {/* Primary Figures Line */}
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-on-surface leading-none tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs text-on-surface-variant font-medium">{unit}</span>}
        {trend && (
          <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ml-auto flex items-center gap-0.5 ${
            trend.isNeutral
              ? 'text-on-surface-variant bg-surface-container border-outline-variant/30'
              : trend.isPositive
              ? 'text-strand-green bg-emerald-50 border-emerald-200'
              : 'text-strand-red bg-red-50 border-red-200'
          }`}>
            {trend.value}
          </span>
        )}
      </div>

      {/* Card Footer Divider Strip */}
      {(footerLeft || footerRight) && (
        <div className="mt-2.5 pt-2 flex items-center justify-between text-[11px] border-t border-outline-variant/15 text-outline">
          <div className="truncate pr-1">{footerLeft}</div>
          <div className="shrink-0 font-mono text-on-surface-variant">{footerRight}</div>
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block text-left no-underline">
        {content}
      </Link>
    );
  }

  return content;
};
```

---

### 4.3 Page-by-Page Target Refactoring Roadmap

1. **`CommandCenter.tsx` (`/`)**:
   - Wrap 4 KPI cards in standardized `KPICard` components with `font-mono text-2xl font-bold tabular-nums`.
   - Card 1 (Open RFQs): value `28`, unit `RFQs`, trend `+14% (7d)`, footer `11 auto-created` + `On Track` health pill.
   - Card 2 (Quotations Pending): value `₹48.2 L`, unit `active`, footer `19 active quotes` + `Avg margin 22.4%`.
   - Card 3 (Overdue Dispatches): value `4`, unit `held`, badge `<HealthPill status="overdue" label="3 Critical" />`, footer `1 stop-dispatch hold`.
   - Card 4 (Receivables Overdue >45d): value `₹13.62 L`, unit `overdue`, badge `<HealthPill status="at_risk" label="3 Accounts" />`, footer `Total Rec: ₹6.84 Cr`.
   - Modernize Morning Briefing strip with `bg-surface-container-lowest` and hairline border `border-outline-variant/30`.

2. **`AccountsOverview.tsx` (`/accounts`)**:
   - Restructure top 5 cards into the standardized **4-across KPI grid**:
     - Card 1: **Net Cash Position** (`₹14.82 Cr` in `font-mono`) + `HDFC + Axis Corporate`.
     - Card 2: **Total Receivables** (`₹6.84 Cr`) + `15 Enterprise accounts`.
     - Card 3: **Total Payables** (`₹4.12 Cr`) + `18 Raw material vendors`.
     - Card 4: **Receivables Overdue >45d** (`₹13.62 L`) + `<HealthPill status="overdue" label="3 Flagged" />`.
   - Move the 5th metric (**Unreconciled Difference**: `₹1,42,800`) into a dedicated reconciliation highlight banner or secondary stat next to the Daily Reconciliation action button.
   - Embed a `LinearProgressBar` for **6-Month Collection Efficiency** (94.2% realized collections).

3. **`PurchaseOverview.tsx` (`/purchase`)**:
   - Upgrade 4 procurement cards (Pending PRs, Active Vendor RFQs, Open POs in Transit, 3-Way Match Exceptions) to `KPICard` with `font-mono` values and `HealthPill` statuses.
   - Refactor Supplier Performance Scorecard table to high-density 36px fixed row height with uppercase monospace headers.

4. **`AIOverview.tsx` & `AICosts.tsx` (`/ai`, `/ai/costs`)**:
   - Upgrade AI spend and agent run cards to `KPICard`.
   - Replace the crude `bg-line` progress bar in `AICosts.tsx` with `LinearProgressBar` (utilizing `bg-surface-container` and `bg-primary`).

---

## 5. Verification Method

### 5.1 Static Typecheck Verification
Run TypeScript validation to ensure all imported types and components resolve cleanly:
```bash
cd master-frontend/varun
npm run typecheck
```
*Expected Result*: Status code 0, zero diagnostic errors.

### 5.2 Production Build Verification
Execute Vite production compilation:
```bash
cd master-frontend/varun
npm run build
```
*Expected Result*: Clean build output with no bundle resolution errors.

### 5.3 Code Inspection Checklist
Verify against these exact criteria during code review:
- [ ] No occurrences of `font-display` on primary KPI numeric values in dashboard cards; all use `font-mono` and `tabular-nums`.
- [ ] No occurrences of `bg-surface` or `border-line` on new/refactored dashboard card containers; all use `bg-surface-container-lowest` and `border-outline-variant/30`.
- [ ] `AccountsOverview.tsx` renders in `lg:grid-cols-4` rather than `lg:grid-cols-5`.
- [ ] Health pills on "On Track", "At Risk", and "Overdue" render with `rounded-full` and `animate-pulse` dots.
- [ ] Progress bars utilize `bg-surface-container` track with smooth transition fills.
