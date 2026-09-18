# Handoff Report — Explorer M2-3: Operations & Intelligence Dashboards

**Summary**: This report presents a technical investigation and refactoring blueprint for Milestone 2 across four key operational and intelligence dashboards in `master-frontend/varun`: `PurchaseOverview.tsx`, `AIOverview.tsx`, `AICosts.tsx`, and `BudgetAllocation.tsx`. It audits existing ad-hoc KPI cards, progress bars, and data tables against the Precision Engineering Industrial Console standard, provides exact file and line references, and delivers concrete, drop-in replacement blueprints for each component while preserving all business rules (notably the Friday 25th budget lockout warning).

---

## 1. Observation

### 1.1 Shared Primitives Verification
A filesystem audit of `master-frontend/varun/src/components/common/` confirmed that the required design system primitives already exist and have verified test suites in `src/components/common/__tests__/components.test.tsx`:

1. **`KPICard.tsx`** (`src/components/common/KPICard.tsx:13-134`):
   - Supports: `title: string`, `value: string | number`, `unit?: string`, `subtitle?: string`, `icon?: React.ReactNode | React.ElementType`, `badge?: React.ReactNode`, `status?: HealthStatus`, `trend?: KPITrend`, `footerLeft?: React.ReactNode`, `footerRight?: React.ReactNode`, `to?: string`, `onClick?: () => void`.
   - Visual tokens: `bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30 shadow-xs hover:border-primary/60 hover:shadow-card`.
   - Typography: Eyebrow header in `font-mono text-[11px] uppercase tracking-wider text-outline`, value in `text-2xl font-bold font-mono text-on-surface leading-none tabular-nums`, divider in `border-t border-outline-variant/15 text-outline text-[11px]`.
   - Automatic `HealthPill` integration when `status` is provided and `badge` is omitted (lines 72-74).
   - Direct routing support via `to` prop rendering React Router `<Link>`.

2. **`HealthPill.tsx`** (`src/components/common/HealthPill.tsx:13-105`):
   - Supports: `status: HealthStatus ('on_track' | 'at_risk' | 'overdue' | 'critical' | 'stale' | 'neutral')`, `label?: string`, `showPulse?: boolean`, `pulse?: boolean`, `size?: 'sm' | 'md'`.
   - Visual tokens: `rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tracking-tight` with animated pulsing dot (`animate-pulse`). Emerald for `on_track`, amber for `at_risk`, red for `overdue`/`critical`, and neutral container for fallback.

3. **`LinearProgressBar.tsx`** (`src/components/common/LinearProgressBar.tsx:3-105`):
   - Supports: `value?: number`, `percentage?: number`, `secondaryValue?: number`, `secondaryPercentage?: number`, `label?: string`, `valueLabel?: string`, `fractionLabel?: string`, `detail?: string`, `showLabels?: boolean`, `variant?: 'primary' | 'success' | 'warning' | 'danger'`, `heightClass?: string`.
   - Visual tokens: Track in `bg-surface-container rounded-full overflow-hidden`, fills with `transition-all duration-500` in `bg-primary`, `bg-strand-green`, `bg-strand-amber`, or `bg-strand-red`.

4. **`DataGrid.tsx`** (`src/components/common/DataGrid.tsx:286, 364`):
   - Establishes the 36px row standard (`isCompact ? 'h-9' : 'h-11'`) and uppercase monospace headers (`font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30`).

---

### 1.2 Target 1: PurchaseOverview.tsx Audit
File path: `master-frontend/varun/src/pages/operations/PurchaseOverview.tsx` (203 lines).

#### A. 4 Procurement KPI Cards (Lines 44–89)
```tsx
// Verbatim from PurchaseOverview.tsx:44-89
      {/* 4 Procurement KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <Link
          to="/purchase/requests"
          className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Pending PRs
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-1">4</div>
          <div className="text-[10px] text-ai mt-1 font-sans">2 MRP Auto-Triggered</div>
        </Link>

        <Link
          to="/purchase/rfq"
          className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Active Vendor RFQs
          </div>
          <div className="text-2xl font-display font-bold text-strand-amber mt-1">2</div>
          <div className="text-[10px] text-muted mt-1 font-sans">Silicone & E-Glass Yarn</div>
        </Link>

        <Link
          to="/purchase/orders"
          className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Open POs in Transit
          </div>
          <div className="text-2xl font-display font-bold text-strand-green mt-1">3</div>
          <div className="text-[10px] text-muted mt-1 font-sans">₹16.42 Lakhs Value</div>
        </Link>

        <Link
          to="/purchase/grn"
          className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-strand-red">
            3-Way Match Exceptions
          </div>
          <div className="text-2xl font-display font-bold text-strand-red mt-1">2</div>
          <div className="text-[10px] text-strand-red mt-1 font-sans font-semibold">1 Qty Discrepancy (200kg)</div>
        </Link>
      </div>
```
Defects Identified:
- **Surface & Border Tokens**: Uses obsolete `bg-surface border border-line rounded-md shadow-card hover:border-kiran` instead of `bg-surface-container-lowest border-outline-variant/30 rounded-xl shadow-xs`.
- **Grid Spacing**: Uses `gap-4` instead of `gap-3.5`.
- **Numerical Typography**: Uses variable-width `font-display font-bold text-2xl text-ink` (Archivo font) rather than monospace tabular numbers (`font-mono font-bold text-2xl tabular-nums`).
- **Operational Health**: No `HealthPill` status indicators; status is communicated crudely via text colors (`text-strand-red`, `text-strand-amber`).
- **Footer Separation**: Secondary metadata (`2 MRP Auto-Triggered`, `₹16.42 Lakhs Value`) is jammed into an unbordered `<div>` without the standard hairline footer divider (`border-t border-outline-variant/15`).

#### B. Supplier Performance Scorecard Table (Lines 91–133)
```tsx
// Verbatim from PurchaseOverview.tsx:91-133
      {/* Supplier Performance Scorecard */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">
              Raw Material Supplier Performance & Quality Ratings
            </h3>
            <p className="text-xs text-muted">Based on historical GRN inspection records, on-time delivery, and lab rejection rates</p>
          </div>
          <span className="font-mono text-xs text-muted">Updated Aug 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
              <tr>
                <th className="p-2.5 font-sans">Vendor Name</th>
                <th className="p-2.5 text-right">On-Time Delivery %</th>
                <th className="p-2.5 text-right">Quality Reject %</th>
                <th className="p-2.5 text-right">Avg Lead Time</th>
                <th className="p-2.5 text-center">Quality Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mockSupplierPerformance.map((sup, idx) => (
                <tr key={idx} className="hover:bg-canvas/50">
                  <td className="p-2.5 font-sans font-semibold text-ink">{sup.vendor}</td>
                  <td className="p-2.5 text-right font-bold text-strand-green">{sup.onTimePct}%</td>
                  <td className={`p-2.5 text-right font-semibold ${sup.qualityRejectPct > 1 ? 'text-strand-amber' : 'text-slate-600'}`}>
                    {sup.qualityRejectPct}%
                  </td>
                  <td className="p-2.5 text-right">{sup.leadTimeDays} Days</td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-line text-[10px] font-semibold text-slate-800">
                      {sup.rating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
```
Defects Identified:
- **Card Container**: `bg-surface border border-line rounded-lg p-5 shadow-card` lacks Stitch container hierarchy and hairline border tokens.
- **Header Density & Typography**: `bg-canvas text-muted text-[10px] uppercase border-b border-line` has variable cell padding `p-2.5 font-sans` without fixed row height or monospace formatting.
- **Row Density**: Table rows have unbounded heights (`p-2.5`) rather than the precision 36px fixed height (`h-9` / `h-[36px]`).
- **Tier Badge**: Uses crude `bg-slate-100 border border-line text-slate-800` instead of precision monospace badge or HealthPill.

---

### 1.3 Target 2: AIOverview.tsx Audit
File path: `master-frontend/varun/src/pages/intelligence/AIOverview.tsx` (207 lines).

#### 4 AI KPI Cards (Lines 35–96)
```tsx
// Verbatim from AIOverview.tsx:35-96
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <Link
          to="/ai/costs"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Monthly AI Spend
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-1">
            {formatINR(totalSpend)}
          </div>
          <div className="text-[10px] text-strand-green mt-1 font-sans">
            61.4% of ₹30,000 monthly budget cap
          </div>
        </Link>

        <Link
          to="/ai/runs"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Total Agent Runs (MTD)
          </div>
          <div className="text-2xl font-display font-bold text-ai mt-1">
            {totalRuns.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-muted mt-1 font-sans">
            Avg Latency: 1,420ms
          </div>
        </Link>

        <Link
          to="/ai/guardrails"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Active Guardrail Policies
          </div>
          <div className="text-2xl font-display font-bold text-strand-green mt-1">
            {mockAIGuardrails.filter(g => g.isEnabled).length}
          </div>
          <div className="text-[10px] text-muted mt-1 font-sans">
            100% human-in-the-loop enforcement
          </div>
        </Link>

        <Link
          to="/ai/models"
          className="p-4 bg-surface border border-line hover:border-ai rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Registered LLM Engines
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-1">
            {mockAIModels.length}
          </div>
          <div className="text-[10px] text-muted mt-1 font-sans">
            Claude 4.6, Haiku 4.5, Opus 5
          </div>
        </Link>
      </div>
```
Defects Identified:
- Hand-rolled `<Link>` wrappers with `bg-surface border border-line rounded-md shadow-card`.
- Numeric values rendered with `text-2xl font-display font-bold text-ink` rather than `font-mono tabular-nums`.
- Subtitles rendered in `text-[10px] font-sans` without hairline divider.
- Missing operational status indicators (`HealthPill` or status dots).
- Routing map table (lines 117–144) and sub-module navigation cards (lines 147–203) still use legacy `bg-surface` and `border-line` tokens.

---

### 1.4 Target 3: AICosts.tsx Audit
File path: `master-frontend/varun/src/pages/intelligence/AICosts.tsx` (130 lines).

#### A. Crude Progress Bar (Lines 48–53)
```tsx
// Verbatim from AICosts.tsx:48-53
          <div className="w-full h-2 bg-line rounded-full overflow-hidden">
            <div
              style={{ width: `${(mockAIOverviewKPI.totalSpendINR / 30000) * 100}%` }}
              className="h-full bg-ai rounded-full"
            />
          </div>
```
Defects Identified:
- **Obsolete Track Token**: Uses `bg-line` instead of Stitch token `bg-surface-container`.
- **Missing Animation & Transitions**: Direct `style={{ width }}` without `transition-all duration-500`.
- **Hardcoded Styling**: Crude inline div bar instead of the shared `LinearProgressBar` component with integrated labels and variant coloring.

#### B. Budget Cards Alignment (Lines 40–76)
```tsx
// Verbatim from AICosts.tsx:40-76
      {/* Budget Gauges & Currency Parity Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
        <div className="bg-surface border border-line rounded-lg p-4 shadow-card space-y-2">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Monthly Budget Utilization
          </div>
          <div className="text-2xl font-display font-bold text-ink">
            {formatINR(mockAIOverviewKPI.totalSpendINR)} / {formatINR(30000)}
          </div>
          <div className="w-full h-2 bg-line rounded-full overflow-hidden">
            <div
              style={{ width: `${(mockAIOverviewKPI.totalSpendINR / 30000) * 100}%` }}
              className="h-full bg-ai rounded-full"
            />
          </div>
          <div className="text-[10px] text-muted font-sans">38.6% remaining for August</div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-4 shadow-card space-y-1">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Exchange Rate Parity
          </div>
          <div className="text-2xl font-display font-bold text-ink">
            1 USD = ₹84.10 INR
          </div>
          <div className="text-[10px] text-muted font-sans">Real-time daily conversion via RBI reference</div>
        </div>

        <div className="bg-surface border border-line rounded-lg p-4 shadow-card space-y-1">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Avg Cost / Extraction Ticket
          </div>
          <div className="text-2xl font-display font-bold text-strand-green">
            ₹4.40
          </div>
          <div className="text-[10px] text-muted font-sans">Down from ₹12.50 prior to Haiku routing</div>
        </div>
      </div>
```
Defects Identified:
- Asymmetrical 3-card grid (`sm:grid-cols-3`) with ad-hoc card structures (`space-y-2`, `space-y-1`).
- Card 2 ("Exchange Rate Parity") and Card 3 ("Avg Cost / Extraction Ticket") can be direct `KPICard` instances with proper units and trend pills.
- Card 1 ("Monthly Budget Utilization") embeds the crude progress bar and should be refactored using `LinearProgressBar` inside a Stitch-aligned card container.

---

### 1.5 Target 4: BudgetAllocation.tsx Audit
File path: `master-frontend/varun/src/pages/operations/BudgetAllocation.tsx` (158 lines).

#### A. Single-Segment Progress Bars (Lines 133–142)
```tsx
// Verbatim from BudgetAllocation.tsx:133-142
                {/* Progress Bar */}
                <div className="w-full h-2 bg-line rounded-full overflow-hidden">
                  <div
                    style={{ width: `${spentPct}%` }}
                    className={`h-full rounded-full ${
                      spentPct > 85
                        ? 'bg-strand-amber'
                        : 'bg-strand-green'
                    }`}
                  />
                </div>
```
Defects Identified:
- Track uses `bg-line` instead of `bg-surface-container`.
- Binary static color logic (`spentPct > 85 ? 'bg-strand-amber' : 'bg-strand-green'`) without `danger` variant (>90%) or smooth transitions.
- Lacks fractional item labels or integration with `LinearProgressBar`.

#### B. Friday 25th Budget Lockout Warning Logic (Lines 42–64)
```tsx
// Verbatim from BudgetAllocation.tsx:42-64
      {/* Submission Calendar Callout Banner */}
      <div className="p-4 bg-ai-tint/40 border border-ai/30 rounded-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-ai text-white flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display font-semibold text-sm text-ink">
              Submit next month's expenditure plan by 24 August 2026
            </div>
            <p className="text-xs text-muted mt-0.5">
              Department allocations lock automatically on the 25th for Managing Director review.
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmitNextMonthPlan}
          className="px-4 py-1.5 bg-ink hover:bg-ink-2 text-white font-semibold rounded text-xs shadow-xs"
        >
          Submit September Plan
        </button>
      </div>
```
Preservation Audit:
- Handlers: `handleSubmitNextMonthPlan()` triggers state update `setToastMessage("September 2026 expenditure plan submitted to Accounts Head (Meera Iyer).")` (lines 22-25).
- Business Constraint: Mandate in `PROJECT.md:16` states "25th monthly budget lock is strictly respected and non-destructive."
- The banner text, deadline warning ("24 August 2026 / Department allocations lock automatically on the 25th for Managing Director review"), button label, and toast handler must remain 100% intact.

---

## 2. Logic Chain

1. **Premise 1 (Component Maturity)**: Observations in Section 1.1 prove that `KPICard`, `LinearProgressBar`, and `HealthPill` are fully implemented, typed, tested, and exported in `src/components/common/`. No new primitive development is required.
2. **Premise 2 (Inconsistent Implementation in Target Pages)**:
   - In `PurchaseOverview.tsx:44-89` and `AIOverview.tsx:35-96`, cards use legacy `bg-surface`, `border-line`, and variable-width `font-display` fonts.
   - In `AICosts.tsx:48-53` and `BudgetAllocation.tsx:133-142`, progress bars are hand-rolled `<div>` elements with `bg-line` tracks and inline width styles.
   - In `PurchaseOverview.tsx:103-132`, the scorecard table lacks 36px fixed row heights and uppercase monospace headers.
3. **Inference 1 (Standardization to KPICard)**:
   - Because `KPICard` natively supports `to` for routing, `status` for `HealthPill` rendering, `footerLeft` for contextual notes, and `icon` for visual identification, all 4 cards in `PurchaseOverview.tsx` and all 4 cards in `AIOverview.tsx` can be refactored to single `<KPICard />` invocations with zero loss of functionality.
   - Furthermore, `KPICard` enforces `font-mono tabular-nums` for primary figures and `bg-surface-container-lowest border-outline-variant/30` container styling, directly satisfying Acceptance Criteria.
4. **Inference 2 (Standardization to LinearProgressBar)**:
   - Replacing lines 48–53 in `AICosts.tsx` and lines 133–142 in `BudgetAllocation.tsx` with `<LinearProgressBar />` standardizes the track to `bg-surface-container`, adds `transition-all duration-500` animation, and binds semantic variant colors (`primary`, `success`, `warning`, `danger`).
5. **Inference 3 (Strict Lockout Preservation)**:
   - The Friday 25th monthly budget lockout callout banner in `BudgetAllocation.tsx:42-64` and its toast trigger must remain functional. The banner styling should be upgraded to Stitch tokens (`bg-surface-container-lowest border-outline-variant/30 rounded-xl` or subtle primary tint) while keeping text and event handlers identical.

---

## 3. Caveats

1. **Read-Only Explorer Constraints**: This explorer agent does not write or modify source code files. All blueprints and diffs provided herein are for subsequent implementers.
2. **Chart Layouts in AICosts.tsx**: `AICosts.tsx` includes Recharts components (`AreaChart` and `BarChart`). While the card containers wrapping these charts should be refactored to `bg-surface-container-lowest border-outline-variant/30 rounded-xl`, the Recharts internal SVG definitions (`stroke`, `fill`, and `margin`) should be preserved to avoid regressions.
3. **DataGrid vs HTML Table for Scorecard**: While `DataGrid.tsx` exists, the Supplier Performance Scorecard in `PurchaseOverview.tsx` is a compact 5-row summary table without pagination or search requirements. It is more lightweight and reliable to style the table directly with `h-9` fixed row classes and `font-mono text-[10px] uppercase` headers rather than incurring overhead from a full `DataGrid` state machine.
4. **No Git Commands**: As mandated by R5, zero git commit or git push commands are permitted.

---

## 4. Conclusion & Refactoring Blueprints

### 4.1 PurchaseOverview.tsx Refactoring Blueprint

#### Imports Update
```tsx
import { KPICard } from '../../components/common/KPICard';
import { HealthPill } from '../../components/common/HealthPill';
```

#### Replacement 1: 4 Procurement KPI Cards (Lines 44–89)
```tsx
      {/* 4 Procurement KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KPICard
          title="Pending PRs"
          value={4}
          to="/purchase/requests"
          status="neutral"
          icon={ShoppingBag}
          footerLeft="2 MRP Auto-Triggered"
        />

        <KPICard
          title="Active Vendor RFQs"
          value={2}
          to="/purchase/rfq"
          status="at_risk"
          icon={Scale}
          footerLeft="Silicone & E-Glass Yarn"
        />

        <KPICard
          title="Open POs in Transit"
          value={3}
          to="/purchase/orders"
          status="on_track"
          icon={PackageCheck}
          footerLeft="₹16.42 Lakhs Value"
        />

        <KPICard
          title="3-Way Match Exceptions"
          value={2}
          to="/purchase/grn"
          status="overdue"
          icon={AlertTriangle}
          footerLeft="1 Qty Discrepancy (200kg)"
        />
      </div>
```

#### Replacement 2: Supplier Performance Scorecard Table (Lines 91–133)
```tsx
      {/* Supplier Performance Scorecard */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-on-surface">
              Raw Material Supplier Performance & Quality Ratings
            </h3>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              Based on historical GRN inspection records, on-time delivery, and lab rejection rates
            </p>
          </div>
          <span className="font-mono text-xs text-outline">Updated Aug 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead className="bg-surface-container-low border-b border-outline-variant/30 text-[10px] uppercase tracking-wider text-outline select-none">
              <tr className="h-9">
                <th className="px-3.5 py-0 align-middle font-mono font-semibold">Vendor Name</th>
                <th className="px-3.5 py-0 align-middle text-right font-mono font-semibold">On-Time Delivery %</th>
                <th className="px-3.5 py-0 align-middle text-right font-mono font-semibold">Quality Reject %</th>
                <th className="px-3.5 py-0 align-middle text-right font-mono font-semibold">Avg Lead Time</th>
                <th className="px-3.5 py-0 align-middle text-center font-mono font-semibold">Quality Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {mockSupplierPerformance.map((sup, idx) => (
                <tr key={idx} className="h-9 hover:bg-surface-container-low/70 transition-colors">
                  <td className="px-3.5 py-0 align-middle font-semibold text-on-surface truncate max-w-[240px]">
                    {sup.vendor}
                  </td>
                  <td className="px-3.5 py-0 align-middle text-right font-bold text-strand-green tabular-nums">
                    {sup.onTimePct}%
                  </td>
                  <td className={`px-3.5 py-0 align-middle text-right font-semibold tabular-nums ${
                    sup.qualityRejectPct > 1 ? 'text-strand-amber' : 'text-on-surface-variant'
                  }`}>
                    {sup.qualityRejectPct}%
                  </td>
                  <td className="px-3.5 py-0 align-middle text-right text-on-surface-variant tabular-nums">
                    {sup.leadTimeDays} Days
                  </td>
                  <td className="px-3.5 py-0 align-middle text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                      sup.rating === 'Tier 1'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-outline-variant/30 bg-surface-container text-on-surface-variant'
                    }`}>
                      {sup.rating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
```

---

### 4.2 AIOverview.tsx Refactoring Blueprint

#### Imports Update
```tsx
import { KPICard } from '../../components/common/KPICard';
import { Activity, DollarSign, ShieldCheck, Cpu } from 'lucide-react';
```

#### Replacement: 4 AI KPI Cards (Lines 35–96)
```tsx
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KPICard
          title="Monthly AI Spend"
          value={formatINR(totalSpend)}
          to="/ai/costs"
          status="on_track"
          icon={DollarSign}
          footerLeft="61.4% of ₹30k budget cap"
        />

        <KPICard
          title="Total Agent Runs (MTD)"
          value={totalRuns.toLocaleString('en-IN')}
          to="/ai/runs"
          icon={Activity}
          footerLeft="Avg Latency: 1,420ms"
        />

        <KPICard
          title="Active Guardrail Policies"
          value={mockAIGuardrails.filter(g => g.isEnabled).length}
          to="/ai/guardrails"
          status="on_track"
          icon={ShieldCheck}
          footerLeft="100% human-in-the-loop"
        />

        <KPICard
          title="Registered LLM Engines"
          value={mockAIModels.length}
          to="/ai/models"
          status="neutral"
          icon={Cpu}
          footerLeft="Claude 4.6, Haiku, Opus"
        />
      </div>
```

---

### 4.3 AICosts.tsx Refactoring Blueprint

#### Imports Update
```tsx
import { KPICard } from '../../components/common/KPICard';
import { LinearProgressBar } from '../../components/common/LinearProgressBar';
import { HealthPill } from '../../components/common/HealthPill';
```

#### Replacement 1: Progress Bar & Budget Gauges Strip (Lines 40–76)
```tsx
      {/* Budget Gauges & Currency Parity Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Card 1: Budget Utilization with LinearProgressBar */}
        <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-outline text-[11px] font-mono truncate pr-2">
                Monthly Budget Utilization
              </span>
              <HealthPill status="on_track" label="61.4% Spent" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-on-surface leading-none tabular-nums">
                {formatINR(mockAIOverviewKPI.totalSpendINR)}
              </span>
              <span className="text-xs text-on-surface-variant font-mono">
                / {formatINR(30000)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <LinearProgressBar
              value={(mockAIOverviewKPI.totalSpendINR / 30000) * 100}
              variant="primary"
              showLabels={false}
              heightClass="h-2"
            />
            <div className="pt-2 flex items-center justify-between text-[11px] border-t border-outline-variant/15 text-outline font-mono">
              <span>38.6% remaining for August</span>
              <span className="text-primary font-medium">₹11,580 available</span>
            </div>
          </div>
        </div>

        {/* Card 2: Exchange Rate Parity */}
        <KPICard
          title="Exchange Rate Parity"
          value="₹84.10"
          unit="per USD"
          icon={DollarSign}
          status="neutral"
          footerLeft="Real-time daily RBI reference"
        />

        {/* Card 3: Avg Cost / Extraction Ticket */}
        <KPICard
          title="Avg Cost / Ticket"
          value="₹4.40"
          status="on_track"
          trend={{ value: "-64.8%", positive: true }}
          icon={TrendingUp}
          footerLeft="Down from ₹12.50 (Haiku routing)"
        />
      </div>
```

---

### 4.4 BudgetAllocation.tsx Refactoring Blueprint

#### Imports Update
```tsx
import { LinearProgressBar } from '../../components/common/LinearProgressBar';
import { HealthPill } from '../../components/common/HealthPill';
```

#### Replacement 1: Single-Segment Progress Bar in Department Budget Card (Lines 133–142)
```tsx
                {/* Standardized LinearProgressBar */}
                <LinearProgressBar
                  value={spentPct}
                  variant={spentPct > 90 ? 'danger' : spentPct > 80 ? 'warning' : 'success'}
                  showLabels={false}
                  heightClass="h-2"
                />
```

#### Replacement 2: Card Container Modernization (Lines 100–153)
```tsx
            <div
              key={dept.department}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 shadow-xs hover:border-primary/60 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-outline" />
                    <h4 className="font-semibold text-sm text-on-surface">
                      {dept.department}
                    </h4>
                  </div>
                  <HealthPill
                    status={spentPct > 90 ? 'critical' : spentPct > 80 ? 'at_risk' : 'on_track'}
                    label={`${spentPct}% Burned`}
                  />
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Allocated:</span>
                    <span className="text-on-surface font-semibold tabular-nums">{formatINR(dept.allocated)}</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Spent (MTD):</span>
                    <span className="text-on-surface font-semibold tabular-nums">{formatINR(dept.spent)}</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant pt-1.5 border-t border-outline-variant/15">
                    <span>Remaining:</span>
                    <span className="text-strand-green font-bold tabular-nums">{formatINR(dept.remaining)}</span>
                  </div>
                </div>

                {/* Standardized LinearProgressBar */}
                <LinearProgressBar
                  value={spentPct}
                  variant={spentPct > 90 ? 'danger' : spentPct > 80 ? 'warning' : 'success'}
                  showLabels={false}
                  heightClass="h-2"
                />
              </div>

              <div className="mt-3 pt-2.5 border-t border-outline-variant/15 text-[11px] text-outline flex items-center justify-between font-mono">
                <span>Pending Bill Vouchers:</span>
                <span className={`font-semibold tabular-nums ${dept.pendingBillsCount > 0 ? 'text-strand-amber' : 'text-on-surface-variant'}`}>
                  {dept.pendingBillsCount} Pending
                </span>
              </div>
            </div>
```

#### Strict Preservation: Friday 25th Lockout Callout Banner (Lines 42–64)
Ensure this exact component structure and text remains:
```tsx
      {/* Submission Calendar Callout Banner — 25th Lockout Warning Preserved */}
      <div className="p-4 bg-surface-container-lowest border border-primary/30 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm text-on-surface">
              Submit next month's expenditure plan by 24 August 2026
            </div>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              Department allocations lock automatically on the 25th for Managing Director review.
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmitNextMonthPlan}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-mono text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          Submit September Plan
        </button>
      </div>
```

---

## 5. Verification Method

To verify the implementation of this blueprint:

1. **Static Analysis & Typecheck**:
   Run TypeScript compilation from the frontend root:
   ```bash
   cd master-frontend/varun
   npm run typecheck
   ```
   *Expected result*: Exit code 0, 0 type errors. (Verified baseline in current workspace: `tsc --noEmit` exited with code 0).

2. **Production Build Validation**:
   ```bash
   cd master-frontend/varun
   npm run build
   ```
   *Expected result*: Clean Vite bundle generation without warnings or broken imports.

3. **Adversarial Unit Test Suite**:
   ```bash
   cd master-frontend/varun
   npm test
   ```
   *Expected result*: Verification that `KPICard`, `LinearProgressBar`, and `HealthPill` tests pass cleanly.

4. **DOM & Layout Inspection Checklist**:
   - Navigate to `/purchase`:
     - Inspect 4 KPI cards: Check container has `bg-surface-container-lowest`, `border-outline-variant/30`, `rounded-xl`.
     - Confirm values are rendered in `font-mono tabular-nums`.
     - Confirm Supplier Performance Scorecard table rows possess fixed 36px height (`h-9`), uppercase monospace headers, and hover states.
   - Navigate to `/ai`:
     - Inspect 4 AI KPI cards: Confirm `KPICard` implementation with monospace figures and navigation links.
   - Navigate to `/ai/costs`:
     - Inspect progress bar: Confirm replacement of `bg-line` track with `bg-surface-container` and animated fill.
     - Confirm budget card alignments.
   - Navigate to `/requisitions/budget`:
     - Inspect department budget cards: Confirm `LinearProgressBar` replaces legacy `bg-line` progress bars.
     - Verify the calendar lockout warning ("Submit next month's expenditure plan by 24 August 2026 / Department allocations lock automatically on the 25th for Managing Director review") is visible and functional.
     - Click "Submit September Plan" and verify the toast confirmation appears.

5. **Invalidation Conditions**:
   - Removal or rewording of the Friday 25th monthly lockout warning text.
   - Any modification of mock stores in `src/data/`.
   - Any git commit or git push actions.
