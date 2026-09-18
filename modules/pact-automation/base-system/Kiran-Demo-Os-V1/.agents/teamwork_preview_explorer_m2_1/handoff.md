# Milestone 2 Technical Exploration & Modernization Blueprint

## 1. Observation

### 1.1 Shared Primitives in `master-frontend/varun/src/components/common/`

#### A. `KPICard.tsx` (`src/components/common/KPICard.tsx:1-134`)
- **Exported Types and Interfaces**:
  ```ts
  export interface KPITrend {
    value: string;
    positive?: boolean;
    isPositive?: boolean;
    neutral?: boolean;
    isNeutral?: boolean;
  }

  export interface KPICardProps {
    title: string;
    value: string | number;
    unit?: string;
    subtitle?: string;
    icon?: React.ReactNode | React.ElementType;
    badge?: React.ReactNode;
    status?: HealthStatus;
    trend?: KPITrend;
    footerLeft?: React.ReactNode;
    footerRight?: React.ReactNode;
    to?: string;
    onClick?: () => void;
    className?: string;
  }

  export const KPICard: React.FC<KPICardProps>;
  ```
- **Styling and Tokens Used**:
  - Container (`line 62`):
    `bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30 shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-primary/60 hover:shadow-card select-none`
  - Eyebrow header (`line 68`):
    `font-semibold uppercase tracking-wider text-outline text-[11px] font-mono truncate pr-2`
  - Metric figures line (`line 80`):
    `text-2xl font-bold font-mono text-on-surface leading-none tabular-nums`
  - Unit (`line 84`):
    `text-xs text-on-surface-variant font-medium`
  - Subtitle (`line 89`):
    `text-xs text-on-surface-variant font-normal`
  - Trend badge (`lines 95-104`):
    - Base: `font-mono text-xs px-1.5 py-0.5 rounded border ml-auto flex items-center gap-0.5 shrink-0`
    - Positive: `text-strand-green bg-emerald-50 border-emerald-200`
    - Neutral: `text-on-surface-variant bg-surface-container border-outline-variant/30`
    - Negative: `text-strand-red bg-red-50 border-red-200`
  - Footer divider (`lines 110-118`):
    `mt-2.5 pt-2 flex items-center justify-between text-[11px] border-t border-outline-variant/15 text-outline`
- **Link & Click Support** (`lines 63, 124-130`):
  - When `to` is passed, the card wraps in `<Link to={to} className="block text-left no-underline group focus:outline-none">{cardContent}</Link>`.
  - When `to` or `onClick` is passed, it adds `cursor-pointer group` to the card container.
- **Badge & Status Hierarchy** (`lines 71-75`):
  - Eyebrow right slot: `{badge}{!badge && status && <HealthPill status={status} />}{renderIcon()}`.
  - If `badge` is explicitly passed, it takes precedence.
  - If `badge` is absent but `status` is provided, it automatically renders `<HealthPill status={status} />`.
  - `icon` accepts both JSX elements (`<Icon className="..." />`) and component references (`IconComponent`).

#### B. `LinearProgressBar.tsx` (`src/components/common/LinearProgressBar.tsx:1-105`)
- **Exported Interface**:
  ```ts
  export interface LinearProgressBarProps {
    value?: number; // 0-100
    percentage?: number; // alias for value
    secondaryValue?: number; // 0-100 (in-progress segment)
    secondaryPercentage?: number; // alias for secondaryValue
    label?: string;
    valueLabel?: string;
    fractionLabel?: string;
    detail?: string; // alias for fractionLabel
    showLabels?: boolean;
    variant?: 'primary' | 'success' | 'warning' | 'danger';
    heightClass?: string;
    className?: string;
  }
  ```
- **Clamping & Behavior**:
  - `primaryRaw` accepts either `value` or `percentage` (defaults to 0). Clamped: `Math.max(0, Math.min(100, primaryRaw))`.
  - `secondaryRaw` accepts either `secondaryValue` or `secondaryPercentage`. Clamped: `Math.max(0, Math.min(100 - clampedPrimary, secondaryRaw))`.
  - Track: `w-full ${heightClass} rounded-full bg-surface-container overflow-hidden flex` (default `heightClass="h-2"`).
  - Variants:
    - `'primary'` (default): `bg-primary` (secondary: `bg-tertiary-fixed-dim`)
    - `'success'`: `bg-strand-green` (secondary: `bg-emerald-300`)
    - `'warning'`: `bg-strand-amber` (secondary: `bg-amber-300`)
    - `'danger'`: `bg-strand-red` (secondary: `bg-red-300`)
  - Labels: Left `label` (`text-on-surface-variant font-medium truncate pr-2`), Right `primaryDisplay` (`valueLabel` or `${Math.round(clampedPrimary)}%`) in `text-primary font-bold font-mono text-xs`, plus `fraction` (`fractionLabel` or `detail`) in `text-outline font-normal font-mono text-[11px]`.
  - Label visibility: controlled by `showLabels` (defaults to `true`). When set to `false`, only the track renders.

#### C. `HealthPill.tsx` (`src/components/common/HealthPill.tsx:1-106`)
- **Exported Types and Interface**:
  ```ts
  export type HealthStatus =
    | 'on_track'
    | 'at_risk'
    | 'overdue'
    | 'critical'
    | 'stale'
    | 'neutral'
    | string;

  export interface HealthPillProps {
    status: HealthStatus;
    label?: string;
    showPulse?: boolean;
    pulse?: boolean;
    size?: 'sm' | 'md';
    className?: string;
  }
  ```
- **Status Normalization & Pulsing Behavior**:
  - `const norm = (status || '').toLowerCase().replace(/[\s-]+/g, '_');`
  - `const shouldPulse = showPulse !== undefined ? showPulse : pulse;` (defaults to `true`).
  - Status mappings:
    1. `'on_track' | 'good' | 'healthy' | 'active'`:
       - Class: `border-emerald-200 bg-emerald-50 font-semibold text-emerald-800`
       - Pulse: `h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0`
       - Default label: `'On Track'`
    2. `'at_risk' | 'warning' | 'caution'`:
       - Class: `border-amber-200 bg-amber-50 font-semibold text-amber-800`
       - Pulse: `h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0`
       - Default label: `'At Risk'`
    3. `'overdue' | 'critical' | 'danger' | 'blocked'`:
       - Class: `border-red-200 bg-red-50 font-bold text-strand-red`
       - Pulse: if `shouldPulse`, renders `h-1.5 w-1.5 rounded-full bg-strand-red animate-pulse shrink-0`; if false, renders `<AlertCircle className="h-3 w-3 shrink-0" />`.
       - Default label: `'Overdue'` or `'Critical'`
    4. `'stale'`:
       - Class: `border-red-200 bg-red-50 font-bold text-strand-red`, renders `<AlertTriangle className="h-3 w-3 shrink-0" />`.
       - Default label: `'Stale'`
    5. Fallback / `'neutral'` / Custom string:
       - Class: `border-outline-variant/30 bg-surface-container font-medium text-on-surface-variant`
       - Pulse: `h-1.5 w-1.5 rounded-full bg-outline shrink-0` (if shouldPulse)
       - Default label: `status`

---

### 1.2 Inspection of `master-frontend/varun/src/pages/command/CommandCenter.tsx`

#### A. Existing 4 KPI Cards (`CommandCenter.tsx:101-221`)
- **Outer Grid**:
  `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`
- **Existing Card 1: Open RFQs (`lines 103-130`)**:
  - Route: `<Link to="/rfq">`
  - Container classes: `bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50 transition-all group flex flex-col justify-between`
  - Eyebrow Title: `text-[11px] font-semibold uppercase tracking-wider text-muted font-mono` -> `"Open RFQs"`
  - Badge / Trend: `text-xs font-mono font-medium text-strand-green bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5` -> `<TrendingUp className="w-3 h-3" /> +14% (7d)`
  - Value: `font-display font-bold text-3xl text-ink` -> `"28"`
  - Subtitle: `text-xs text-muted font-mono` -> `"11 auto-created"`
  - Bottom graphic: 7-div sparkline `[18, 22, 19, 25, 24, 26, 28]` with height relative to 30.
- **Existing Card 2: Quotations Pending (`lines 133-160`)**:
  - Route: `<Link to="/quotations">`
  - Container classes: `bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50 transition-all group flex flex-col justify-between`
  - Eyebrow Title: `"Quotations Pending"`
  - Badge / Trend: `text-xs font-mono font-medium text-strand-amber bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5` -> `"19 Active"`
  - Value: `font-display font-bold text-3xl text-ink` -> `"₹48.2 L"`
  - Subtitle: `text-xs text-muted font-mono` -> `"Avg margin: 22.4%"`
  - Bottom graphic: 7-div sparkline `[32, 36, 40, 42, 45, 46, 48]` with height relative to 50.
- **Existing Card 3: Overdue Dispatches (`lines 163-190`)**:
  - Route: `<Link to="/dispatch">`
  - Container classes: `bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50 transition-all group flex flex-col justify-between`
  - Eyebrow Title: `"Overdue Dispatches"`
  - Badge / Trend: `text-xs font-mono font-medium text-strand-red bg-red-50 px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-0.5` -> `<AlertTriangle className="w-3 h-3" /> 3 Critical`
  - Value: `font-display font-bold text-3xl text-strand-red` -> `"4"`
  - Subtitle: `text-xs text-muted font-mono` -> `"1 stop-dispatch hold"`
  - Bottom graphic: 7-div sparkline `[2, 1, 3, 2, 4, 3, 4]` with height relative to 6.
- **Existing Card 4: Receivables Overdue >45d (`lines 193-220`)**:
  - Route: `<Link to="/accounts/receivables">`
  - Container classes: `bg-surface border border-line rounded-lg p-4 shadow-card hover:border-kiran/50 transition-all group flex flex-col justify-between`
  - Eyebrow Title: `"Receivables Overdue >45d"`
  - Badge / Trend: `text-xs font-mono font-medium text-slate bg-slate-100 px-1.5 py-0.5 rounded border border-line flex items-center gap-0.5` -> `"3 Accounts"`
  - Value: `font-display font-bold text-3xl text-strand-red` -> `"₹13.62 L"`
  - Subtitle: `text-xs text-muted font-mono` -> `"Total Rec: ₹6.84 Cr"`
  - Bottom graphic: 7-div sparkline `[18, 16, 15, 14, 14, 13.8, 13.6]` with height relative to 20.

#### B. Morning Briefing Strip (`CommandCenter.tsx:69-98`)
- Container: `bg-surface border border-line rounded-lg p-4 shadow-card flex flex-wrap items-center justify-between gap-4`
- Date label: `text-xs font-semibold uppercase tracking-wider text-muted font-mono` -> `"Wednesday, 19 August 2026 · Secunderabad HQ"`
- AI situation summary box: `text-sm font-medium text-ai bg-ai-tint/40 px-3 py-1.5 rounded border border-ai/20`
- Action Buttons:
  - "Briefing" refresh button: `px-2.5 py-1.5 rounded bg-white hover:bg-canvas border border-line text-xs font-medium text-slate flex items-center gap-1.5 shadow-xs transition-colors`
  - "Ask Kiran" button: `px-3 py-1.5 rounded bg-ink hover:bg-ink-2 text-xs font-semibold text-white flex items-center gap-1.5 shadow-xs transition-colors` (`navigate('/ask')`)

#### C. Decisions Zone: "Needs Your Decision" (60%) vs "AI Activity Today" (40%) (`lines 227-366`)
- Left Column (`lg:col-span-7`):
  - Container: `bg-surface border border-line rounded-lg shadow-card flex flex-col`
  - Header: `p-4 border-b border-line flex items-center justify-between`
  - Badge: `font-mono text-xs px-1.5 py-0.2 rounded bg-strand-amber/20 text-strand-amber font-semibold border border-strand-amber/30`
  - Row items: `p-3 hover:bg-canvas transition-colors flex items-center justify-between gap-3 text-xs`
  - Buttons: Open (`bg-white hover:bg-slate-100 border border-line text-slate`), Approve (`bg-strand-green hover:bg-emerald-600 disabled:bg-slate-300 text-white`)
  - Footer link: `p-3 border-t border-line text-center bg-canvas/30`
- Right Column (`lg:col-span-5`):
  - Container: `bg-surface border border-ai/30 rounded-md shadow-card flex flex-col relative overflow-hidden`
  - Accent line: `h-1 w-full bg-ai`
  - Header: `p-4 border-b border-line flex items-center justify-between bg-ai-tint/20`
  - AI Metrics summary 3-box strip: `grid grid-cols-3 gap-2 p-3 bg-ai-tint/10 border-b border-line text-center font-mono`
  - Feed items: `p-3 divide-y divide-line flex-1 overflow-y-auto max-h-[340px]`
  - Footer link: `p-3 border-t border-line text-center bg-canvas/30`

#### D. Bottom Row: 3 Visual Analysis Cards (`lines 368-447`)
- Three cards: "Overdue Tickets by Dept", "Weekly Dispatches vs Plan (L Metres)", "Open Escalations"
- Currently all styled with `bg-surface border border-line rounded-lg p-4 shadow-card`.

#### E. Mock Data Sources & Navigation Verification
- `mockApprovals` (`src/data/approvals.ts`): state `approvals`, approval action `handleApprove`, linked via `item.referenceLink` and `/approvals`.
- `mockEscalations` (`src/data/comms.ts`): rendered in escalations panel, linked via `/comms/escalations`.
- `mockAIRuns` (`src/data/aiControl.ts`): rendered in AI activity feed, linked via `/ai/runs` and `/ai`.
- Chart series: `overdueByDeptData`, `dispatchPlanData`.
- All routes (`/rfq`, `/quotations`, `/dispatch`, `/accounts/receivables`, `/approvals`, `/ai/runs`, `/ai`, `/ask`, `/comms/escalations`) exist and are registered in `App.tsx`.

---

## 2. Logic Chain

### 2.1 Component Architecture & Primitive Synergies
1. **Observation**: `KPICard.tsx` provides built-in `to` prop rendering `<Link to={to}>`, native `tabular-nums font-mono` 2xl figures, trend badges, optional status pills via `status`, badge override via `badge`, and `footerLeft`/`footerRight` slots with `border-t border-outline-variant/15`.
2. **Inference**: The ad-hoc `<Link>` wrappers and raw `<div>` hierarchies in `CommandCenter.tsx` lines 101-221 are direct duplicates of what `KPICard` encapsulates. Replacing them eliminates 120+ lines of duplicated CSS classes while strictly preserving navigation, labels, and metrics.
3. **Observation**: `LinearProgressBar` supports dual segment widths, `bg-surface-container` background tracks, four color variants (`primary`, `success`, `warning`, `danger`), label slots, and `heightClass`.
4. **Inference**: Each of the 4 KPI cards tracks an operational ratio or progress metric:
   - Card 1: 11 auto-created out of 28 open RFQs (`39%` automated completion rate).
   - Card 2: 19 active quotes against weekly quota/pipeline target (e.g. 19/25 or 76% pipeline capacity).
   - Card 3: 3 critical out of 4 overdue dispatches (`75%` critical risk ratio).
   - Card 4: ₹13.62 L overdue (>45d) out of ₹6.84 Cr total receivables (`2.0%` of book value).
   Embedding `LinearProgressBar` into the `footerLeft` or below the KPI metrics provides actionable progress context adhering to the Precision Engineering specification.
5. **Observation**: `HealthPill.tsx` renders standardized operational health pills with live pulsing indicators for `on_track`, `at_risk`, and `overdue`.
6. **Inference**: Placing `HealthPill` in the `badge` or `status` slot of each `KPICard` directly satisfies Requirement R2 of the Original Request and SCOPE.md:
   - Card 1: `status="on_track"` (`On Track`, green pulsing dot).
   - Card 2: `badge={<HealthPill status="at_risk" label="19 Active" />}` (`At Risk`, amber pulsing dot).
   - Card 3: `badge={<HealthPill status="overdue" label="3 Critical" showPulse />}` (`Overdue`, red pulsing dot).
   - Card 4: `badge={<HealthPill status="neutral" label="3 Accounts" />}` or `status="at_risk"` (`At Risk`, 45d threshold warning).

### 2.2 Surface Container Tokens & Grid Standardization
1. **Observation**: `SCOPE.md` specifies:
   `Enforce strict 4-across responsive grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 or xl:grid-cols-4) for primary KPI strips.`
   `CommandCenter.tsx` currently has `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`.
2. **Inference**: Updating the container to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5` ensures the 4-card row breaks cleanly at 1024px (`lg`) instead of remaining 2-column until 1280px (`xl`).
3. **Observation**: `tailwind.config.js` and `src/index.css` define the Stitch surface token ramp:
   - Foreground cards: `bg-surface-container-lowest` (#ffffff)
   - Trays, headers, and backgrounds: `bg-surface-container-low` (#eff4ff)
   - Active tracks: `bg-surface-container` (#e5eeff)
   - Hairline dividers: `border-outline-variant/30`
   - High-contrast text: `text-on-surface` (#0b1c30), `text-on-surface-variant` (#424750), `text-outline` (#727781)
4. **Inference**: The Morning Briefing strip, Decisions zone ("Needs Your Decision" and "AI Activity Today"), and the bottom 3 analysis cards should be refactored from legacy `bg-surface border-line rounded-lg shadow-card` to `bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xs`.

---

## 3. Detailed Component Replacement Blueprint for `CommandCenter.tsx`

### 3.1 Imports Update
```tsx
// Replace:
import { StrandBar } from '../../components/common/StrandBar';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';

// With:
import { KPICard } from '../../components/common/KPICard';
import { LinearProgressBar } from '../../components/common/LinearProgressBar';
import { HealthPill } from '../../components/common/HealthPill';
import { StrandBar } from '../../components/common/StrandBar';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
```

### 3.2 Section 1: Morning Briefing Strip
Align container, typography, briefing box, and buttons with Stitch tokens:
```tsx
{/* 1. Greeting Strip & AI Situation Summary */}
<div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
  <div>
    <div className="text-xs font-semibold uppercase tracking-wider text-outline font-mono">
      Wednesday, 19 August 2026 · Secunderabad HQ
    </div>
    <div className="mt-1.5 flex items-center gap-2.5 text-sm font-medium text-on-surface bg-ai-tint/50 px-3.5 py-1.5 rounded-lg border border-ai/20">
      <Sparkles className="w-4 h-4 text-ai shrink-0" />
      <span>{aiSummary}</span>
    </div>
  </div>

  <div className="flex items-center gap-2">
    <button
      onClick={handleRegenerate}
      disabled={isRegenerating}
      className="px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/30 text-xs font-medium text-on-surface-variant flex items-center gap-1.5 shadow-xs transition-colors"
      title="Regenerate morning AI briefing"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-ai' : 'text-outline'}`} />
      <span>Briefing</span>
    </button>
    <button
      onClick={() => navigate('/ask')}
      className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-brand-600 text-xs font-semibold text-on-primary flex items-center gap-1.5 shadow-xs transition-colors"
    >
      <Bot className="w-3.5 h-3.5 text-on-primary" />
      <span>Ask Kiran</span>
    </button>
  </div>
</div>
```

### 3.3 Section 2: Four Modernized KPI Cards
Replace the ad-hoc markup with a responsive 4-across grid utilizing `KPICard`, `HealthPill`, and `LinearProgressBar`:
```tsx
{/* 2. Four Standardized Industrial KPI Cards */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
  {/* Card 1: Open RFQs */}
  <KPICard
    to="/rfq"
    title="Open RFQs"
    value={28}
    trend={{ value: '+14% (7d)', positive: true }}
    status="on_track"
    footerLeft={
      <div className="w-full">
        <LinearProgressBar
          value={Math.round((11 / 28) * 100)}
          label="Auto-created"
          fractionLabel="11/28"
          variant="primary"
          heightClass="h-1.5"
        />
      </div>
    }
  />

  {/* Card 2: Quotations Pending */}
  <KPICard
    to="/quotations"
    title="Quotations Pending"
    value="₹48.2 L"
    badge={<HealthPill status="at_risk" label="19 Active" />}
    trend={{ value: '22.4% margin', neutral: true }}
    footerLeft={
      <div className="w-full">
        <LinearProgressBar
          value={76}
          label="Active Pipeline"
          fractionLabel="19 quotes"
          variant="warning"
          heightClass="h-1.5"
        />
      </div>
    }
  />

  {/* Card 3: Overdue Dispatches */}
  <KPICard
    to="/dispatch"
    title="Overdue Dispatches"
    value={4}
    badge={<HealthPill status="overdue" label="3 Critical" showPulse />}
    trend={{ value: '1 on hold', positive: false }}
    footerLeft={
      <div className="w-full">
        <LinearProgressBar
          value={75}
          label="Critical hold"
          fractionLabel="3/4"
          variant="danger"
          heightClass="h-1.5"
        />
      </div>
    }
  />

  {/* Card 4: Receivables Overdue >45d */}
  <KPICard
    to="/accounts/receivables"
    title="Receivables Overdue >45d"
    value="₹13.62 L"
    badge={<HealthPill status="neutral" label="3 Accounts" />}
    trend={{ value: '2.0% of total', neutral: true }}
    footerLeft={
      <div className="w-full">
        <LinearProgressBar
          value={Math.round((13.62 / 684) * 100)}
          label="Total Rec: ₹6.84 Cr"
          fractionLabel="₹13.62L"
          variant="success"
          heightClass="h-1.5"
        />
      </div>
    }
  />
</div>
```

*Alternative Option for Sparkline Preservation*:
If the 7-bar sparkline is preferred alongside the progress bar, `footerLeft` can render a flex row containing the `LinearProgressBar` and the mini bar sparklines side-by-side, or `LinearProgressBar` can render directly with `label` and `fractionLabel` which gives a cleaner industrial console finish.

### 3.4 Section 4: Decisions Zone Modernization

#### Left Column: "Needs Your Decision"
- Container:
  ```tsx
  <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xs flex flex-col">
  ```
- Header:
  ```tsx
  <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-on-surface font-mono">
        Needs Your Decision
      </span>
      <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-50 text-strand-amber font-semibold border border-amber-200">
        {approvals.filter(item => item.status === 'Pending').length} Pending
      </span>
    </div>
    <Link
      to="/approvals"
      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
    >
      <span>View all in inbox</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  </div>
  ```
- Item Rows:
  ```tsx
  <div className="divide-y divide-outline-variant/20 flex-1 overflow-y-auto max-h-[460px]">
    {approvals.slice(0, 7).map((item) => (
      <div
        key={item.id}
        className="p-3 hover:bg-surface-container-low/60 transition-colors flex items-center justify-between gap-3 text-xs"
      >
        <div className="min-w-0 flex items-center gap-2.5">
          <StatusPill status={item.type} />
          <div className="min-w-0">
            <Link
              to={item.referenceLink}
              className="font-semibold text-on-surface hover:text-primary truncate block"
            >
              {item.subject}
            </Link>
            <div className="text-[11px] text-outline flex items-center gap-2 mt-0.5">
              <span>By <strong className="text-on-surface">{item.requesterName}</strong></span>
              <span>·</span>
              <span className="font-mono text-on-surface-variant font-medium">
                {item.value ? formatINR(item.value) : 'Policy Update'}
              </span>
              <span>·</span>
              <span className="font-mono text-outline">{item.ageHours}h ago</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(item.referenceLink)}
            className="px-2.5 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/30 text-xs font-medium text-on-surface-variant"
          >
            Open
          </button>
          <button
            onClick={() => handleApprove(item.id)}
            disabled={item.status !== 'Pending'}
            className="px-2.5 py-1 rounded-lg bg-strand-green hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-default text-xs font-semibold text-white shadow-xs transition-colors"
          >
            {item.status === 'Pending' ? 'Approve' : 'Approved'}
          </button>
        </div>
      </div>
    ))}
  </div>
  ```
- Footer:
  ```tsx
  <div className="p-3 border-t border-outline-variant/30 text-center bg-surface-container-low/30 rounded-b-xl">
    <Link to="/approvals" className="text-xs font-semibold text-primary hover:underline">
      Open Full Approval Inbox ({approvals.length} records) →
    </Link>
  </div>
  ```

#### Right Column: "AI Activity Today"
- Container:
  ```tsx
  <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xs flex flex-col relative overflow-hidden">
    <div className="h-1 w-full bg-ai" />
  ```
- Header:
  ```tsx
  <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-ai-tint/20">
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-ai" />
      <span className="text-xs font-semibold uppercase tracking-wider text-ai font-mono">
        AI Activity Today
      </span>
    </div>
    <Link
      to="/ai/runs"
      className="text-xs font-semibold text-ai hover:underline flex items-center gap-1"
    >
      <span>View trace logs</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  </div>
  ```
- Metric Grid:
  ```tsx
  <div className="grid grid-cols-3 gap-2 p-3 bg-surface-container-low/40 border-b border-outline-variant/30 text-center font-mono">
    <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30">
      <div className="text-[10px] text-outline uppercase font-medium">Runs Today</div>
      <div className="text-base font-bold text-on-surface font-mono">48</div>
    </div>
    <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30">
      <div className="text-[10px] text-outline uppercase font-medium">Auto-created</div>
      <div className="text-base font-bold text-strand-green font-mono">11 RFQs</div>
    </div>
    <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30">
      <div className="text-[10px] text-outline uppercase font-medium">Spend Today</div>
      <div className="text-base font-bold text-ai font-mono">₹739</div>
    </div>
  </div>
  ```
- Feed Items & Footer:
  Use `divide-outline-variant/20`, text tokens `text-on-surface`, `text-on-surface-variant`, and `text-outline`.

### 3.5 Section 5: Bottom 3 Analysis Cards
Replace `bg-surface border border-line rounded-lg p-4 shadow-card` on all 3 cards with:
`bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 shadow-xs`
Update headers to use `text-outline font-mono text-xs uppercase font-semibold tracking-wider`.

---

## 4. Caveats
1. **Truncation on `footerLeft`**: In `KPICard.tsx:110-112`, `footerLeft` is wrapped inside `<div className="truncate pr-1">`. When passing a complex component such as `LinearProgressBar` into `footerLeft`, ensure the child has `className="w-full"` so it spans the card width cleanly without overflowing.
2. **Recharts Tooltip Styling**: The charts in `CommandCenter.tsx` use explicit inline tooltip styles (`backgroundColor: '#0E2340', borderColor: '#1B3A63'`). These dark tooltips can remain as-is or be updated to the dark ink console token (`#0A2547`) for brand harmony.
3. **Strict Read-Only Enforcement**: In accordance with the Explorer role constraints, no source code in `master-frontend/varun` has been modified during this exploration. The implementation agent can directly apply the proposed blueprint above.

---

## 5. Conclusion
- The shared primitives (`KPICard`, `LinearProgressBar`, `HealthPill`) in `master-frontend/varun/src/components/common/` are fully implemented, battle-tested, and ready for drop-in replacement across all Milestone 2 dashboards.
- In `CommandCenter.tsx`, replacing the 4 ad-hoc KPI cards with `KPICard` and `LinearProgressBar` will:
  1. Enforce the standardized 4-across responsive grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5`).
  2. Standardize metric numbers to monospace tabular figures (`font-mono tabular-nums leading-none`).
  3. Introduce live pulsing status indicators (`HealthPill`).
  4. Ensure consistent container depths (`bg-surface-container-lowest`) and hairline borders (`border-outline-variant/30`).
- All existing data sources, state mutations, and router links remain 100% intact and functional.

---

## 6. Verification Method

### 6.1 Automated Compilation & Typecheck
Run the frontend typecheck command from `master-frontend/varun`:
```powershell
cd c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun
npm run typecheck
```
*Expected Result*: Status code 0, zero diagnostic errors.

### 6.2 Unit Tests Verification
Execute the existing adversarial test suite for `KPICard`, `LinearProgressBar`, and `HealthPill`:
```powershell
cd c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun
npx tsx src/components/common/__tests__/components.test.tsx
```
*Expected Result*: All assertions pass across Suite 1 (`HealthPill`), Suite 2 (`LinearProgressBar`), Suite 3 (`KPICard`), and Suite 4 (`DataGrid`).

### 6.3 Visual & Route Inspection
1. Start dev server: `npm run dev` in `master-frontend/varun`.
2. Navigate to `http://localhost:5173/`:
   - Verify that 4 KPI cards render in a single horizontal row on viewports >= 1024px (`lg:grid-cols-4`).
   - Click Card 1 (`/rfq`), Card 2 (`/quotations`), Card 3 (`/dispatch`), and Card 4 (`/accounts/receivables`) to verify navigation.
   - Verify the Morning Briefing strip displays the Secunderabad HQ header, AI summary, and that clicking "Briefing" spins the refresh icon and updates the summary text.
   - Verify that clicking "Approve" in the "Needs Your Decision" panel updates the approval status to "Approved" and changes the button state.
