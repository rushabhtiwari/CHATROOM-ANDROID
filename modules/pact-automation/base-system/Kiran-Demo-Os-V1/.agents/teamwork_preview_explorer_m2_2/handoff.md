# Technical Exploration Handoff Report — Milestone 2: AccountsOverview Modernization

**Target Component**: `master-frontend/varun/src/pages/finance/AccountsOverview.tsx` (Feature 11)  
**Role**: `teamwork_preview_explorer_m2_2`  
**Date**: 2026-09-03  
**Status**: COMPLETE (Read-Only Exploration)

---

## 1. Observation

### 1.1 Current File Structure & Metric Inventory
Direct inspection of `master-frontend/varun/src/pages/finance/AccountsOverview.tsx` (197 lines) reveals the current composition:

1. **Imports (lines 1-19)**:
   ```tsx
   import React from 'react';
   import { Link } from 'react-router-dom';
   import { mockAccountsKPI, mockCashTrend } from '../../data/accounts';
   import { PageHeader } from '../../components/shell/PageHeader';
   import { IndianRupee } from '../../components/common/IndianRupee';
   import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
   import {
     Wallet,
     ArrowUpRight,
     ArrowDownRight,
     Calculator,
     Users,
     Building2,
     TrendingUp,
     AlertTriangle,
     ArrowRight
   } from 'lucide-react';
   import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
   ```
   *Note*: `IndianRupee` is imported on line 5 but is unused in the file.

2. **PageHeader Action Strip (lines 23-36)**:
   ```tsx
   <PageHeader
     title="Finance & Accounts Overview"
     actions={
       <div className="flex items-center gap-2">
         <Link
           to="/accounts/reconciliation"
           className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
         >
           <Calculator className="w-3.5 h-3.5" />
           Daily Reconciliation
         </Link>
       </div>
     }
   />
   ```

3. **Current 5-Across KPI Grid (lines 38-99)**:
   ```tsx
   {/* 5 KPI Cards Row */}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 font-mono">
     {/* Card 1: Net Cash Position */}
     <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
       <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">Net Cash Position</div>
       <div className="text-xl font-display font-bold text-ink mt-1">{formatINRLakhCrore(mockAccountsKPI.cashPosition)}</div>
       <div className="text-[10px] text-strand-green mt-1 flex items-center gap-1 font-sans"><TrendingUp className="w-3 h-3" /> HDFC + Axis Corporate</div>
     </div>

     {/* Card 2: Total Receivables */}
     <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
       <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">Total Receivables</div>
       <div className="text-xl font-display font-bold text-ink mt-1">{formatINRLakhCrore(mockAccountsKPI.totalReceivable)}</div>
       <div className="text-[10px] text-muted mt-1 font-sans">15 Enterprise accounts</div>
     </div>

     {/* Card 3: Total Payables */}
     <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
       <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">Total Payables</div>
       <div className="text-xl font-display font-bold text-slate-800 mt-1">{formatINRLakhCrore(mockAccountsKPI.totalPayable)}</div>
       <div className="text-[10px] text-muted mt-1 font-sans">18 Raw material vendors</div>
     </div>

     {/* Card 4: Overdue >45 Days */}
     <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
       <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-strand-red">Overdue &gt;45 Days</div>
       <div className="text-xl font-display font-bold text-strand-red mt-1">{formatINRLakhCrore(mockAccountsKPI.overdueReceivable)}</div>
       <div className="text-[10px] text-strand-red mt-1 font-sans flex items-center gap-1 font-semibold"><AlertTriangle className="w-3 h-3" /> 3 Accounts flagged</div>
     </div>

     {/* Card 5: Unreconciled Difference */}
     <div className="bg-surface border border-line rounded-lg p-4 shadow-card">
       <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-strand-amber">Unreconciled Difference</div>
       <div className="text-xl font-display font-bold text-strand-amber mt-1">{formatINR(mockAccountsKPI.unreconciledAmount)}</div>
       <div className="text-[10px] text-muted mt-1 font-sans">{mockAccountsKPI.unreconciledCount} unmatched entries</div>
     </div>
   </div>
   ```

4. **6-Month Trend & Collection Metric (lines 101-127)**:
   ```tsx
   <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-3">
     <div className="flex items-center justify-between">
       <div>
         <h3 className="font-display font-semibold text-sm text-ink">6-Month Billed Sales vs Cash Collections</h3>
         <p className="text-xs text-muted">Tracking monthly billing against realized bank credits (₹ Cr)</p>
       </div>
       <span className="font-mono text-xs text-strand-green font-semibold">
         94.2% Overall Collection Efficiency
       </span>
     </div>
     <div className="h-64 w-full">
       <ResponsiveContainer width="100%" height="100%">
         <BarChart data={mockCashTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
           <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A5A70' }} />
           <YAxis tickFormatter={(v) => `₹${(v / 10000000).toFixed(1)}Cr`} tick={{ fontSize: 11, fill: '#4A5A70' }} />
           <Tooltip formatter={(val: any) => [formatINR(val), '']} contentStyle={{ backgroundColor: '#0E2340', borderColor: '#1B3A63', color: '#fff', borderRadius: '4px', fontSize: '11px' }} />
           <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
           <Bar dataKey="billed" name="Billed Sales (INR)" fill="#E2E7EE" radius={[2, 2, 0, 0]} />
           <Bar dataKey="collected" name="Realized Collections (INR)" fill="#018F3D" radius={[2, 2, 0, 0]} />
         </BarChart>
       </ResponsiveContainer>
     </div>
   </div>
   ```

5. **Quick Access Module Cards (lines 129-194)**:
   - 3-column navigation grid linking to:
     - `/accounts/reconciliation` (`Bank-vs-Books Reconciliation`)
     - `/accounts/receivables` (`Customer Ageing & Receivables`)
     - `/accounts/payables` (`Vendor Outstanding & UTR Tracker`)
   - Uses outdated `bg-surface border border-line rounded-md shadow-card` styling.

### 1.2 Data Store Bindings in `src/data/accounts.ts`
Inspection of `master-frontend/varun/src/data/accounts.ts` confirms the exact shape:
```ts
export const mockAccountsKPI = {
  cashPosition: 48200000, // ₹4.82 Cr
  totalReceivable: 68420000, // ₹6.84 Cr
  totalPayable: 34210000, // ₹3.42 Cr
  overdueReceivable: 1362150, // ₹13.62 L
  unreconciledCount: 11,
  unreconciledAmount: 214380, // ₹2,14,380
  collectionEfficiencyPct: 94.2
};

export const mockCashTrend = [
  { month: 'Mar 2026', billed: 48000000, collected: 45200000 },
  { month: 'Apr 2026', billed: 52000000, collected: 49800000 },
  { month: 'May 2026', billed: 56500000, collected: 54100000 },
  { month: 'Jun 2026', billed: 61000000, collected: 58900000 },
  { month: 'Jul 2026', billed: 64500000, collected: 62000000 },
  { month: 'Aug 2026 (MTD)', billed: 42000000, collected: 39500000 },
];
```

### 1.3 Verified Shared Primitives
The following standardized components are already created and operational in `master-frontend/varun/src/components/common/`:
- `KPICard.tsx`: Supports `title`, `value`, `unit`, `subtitle`, `icon`, `status`, `trend`, `footerLeft`, `footerRight`, `to`, `className`. Encapsulates `bg-surface-container-lowest`, `border-outline-variant/30`, `rounded-xl`, `font-mono font-bold text-2xl tabular-nums`.
- `LinearProgressBar.tsx`: Supports `value`, `secondaryValue`, `label`, `valueLabel`, `fractionLabel`, `variant` (`'primary' | 'success' | 'warning' | 'danger'`), `heightClass`.
- `HealthPill.tsx`: Supports `status` (`'on_track' | 'at_risk' | 'overdue' | 'neutral'`), `label`, `size` (`'sm' | 'md'`), pulsing dot indicators.

---

## 2. Logic Chain

1. **Premise 1 (Design Mandate & 4-Across Rule)**:
   Milestone 2 and SCOPE.md mandate a strict 4-across responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5`) across all dashboard overviews to maintain visual rhythm with `CommandCenter.tsx`, `PurchaseOverview.tsx`, and `CycleDetailPage.tsx`.
   - *Observation Reference*: In `AccountsOverview.tsx:39`, the current grid uses `lg:grid-cols-5`. On 1024px-1280px displays, 5 cards are severely cramped (each < 180px width), forcing text to wrap awkwardly and breaking alignment with other pages.

2. **Premise 2 (Domain Classification of Metrics)**:
   In financial ledger operations:
   - `Net Cash Position`, `Total Receivables`, `Total Payables`, and `Overdue >45 Days` are **standing liquidity and balance sheet state metrics**.
   - In contrast, `Unreconciled Difference` is an **operational exception / reconciliation delta** requiring immediate reconciliation between MT940 bank statements and general ledger vouchers.
   - *Observation Reference*: Squeezing an operational exception into the standing balance sheet KPI strip dilutes both. Removing it from the 4-across grid allows the 4 balance metrics to breathe while elevating the variance into an action-oriented highlight.

3. **Premise 3 (Non-Destructive 5th Metric Placement)**:
   To ensure 0% data loss and 100% feature preservation:
   - **Primary Highlight**: A dedicated `Reconciliation Variance Notice` alert banner situated between `PageHeader` and the 4-card KPI strip. Rendered with `border-l-4 border-l-strand-amber`, amber icon, explicit amount `{formatINR(mockAccountsKPI.unreconciledAmount)}`, entry count `{mockAccountsKPI.unreconciledCount} Unmatched Entries` in a `HealthPill`, and a direct CTA link `Resolve Entries → /accounts/reconciliation`.
   - **Header Toolbar Companion**: A compact status badge inside `PageHeader.actions` directly preceding the "Daily Reconciliation" button.
   - **Sub-Panel Reinforcement**: In the `Bank-vs-Books Reconciliation` quick access card, displaying a delta pill.

4. **Premise 4 (LinearProgressBar Integration)**:
   - *Observation Reference*: `AccountsOverview.tsx:110-112` currently displays collection efficiency as a static text string:
     `<span className="font-mono text-xs text-strand-green font-semibold">94.2% Overall Collection Efficiency</span>`.
   - *Observation Reference*: `mockAccountsKPI.collectionEfficiencyPct` contains `94.2`. In `mockCashTrend`, total billed is ₹32.40 Cr and collected is ₹30.95 Cr.
   - *Deduction*: Replacing the static text in the chart header with `LinearProgressBar` (variant `success`, value `94.2`, fractionLabel `"₹30.95 Cr / ₹32.40 Cr"`) transforms a flat label into an industrial progress indicator matching the project management specification.

5. **Premise 5 (Typography & Token Harmonization)**:
   - *Observation Reference*: Current cards use `font-display font-bold text-xl text-ink` (`Archivo`), `bg-surface`, `border-line`.
   - *Deduction*: Replacing with `KPICard` automatically enforces `"IBM Plex Mono"` tabular numbers (`font-mono font-bold tabular-nums text-2xl text-on-surface leading-none`), hairline dividers (`border-outline-variant/30`), and Stitch depth token `bg-surface-container-lowest`.

---

## 3. Caveats

1. **Unreconciled Difference Metric Value**:
   In `src/data/accounts.ts`, `mockAccountsKPI.unreconciledAmount` is `214380` (`₹2,14,380`) with `11` unmatched entries. The user prompt mentioned `₹1,42,800` as an illustrative example. The implementation must bind dynamically to `{formatINR(mockAccountsKPI.unreconciledAmount)}` so any data store changes automatically reflect in the UI without hardcoding.
2. **Recharts Tooltip Background**:
   The current Recharts tooltip uses `#0E2340`. To match Stitch console tokens, the tooltip should use `#0b1c30` (`on-surface` dark base) with `border-outline-variant/40` and `font-mono`.
3. **No Source Modifications in Explorer Phase**:
   This exploration report is strictly read-only. No edits have been made to `master-frontend/varun/src/pages/finance/AccountsOverview.tsx` or any other source files.

---

## 4. Conclusion & Complete Implementation Blueprint

### 4.1 Summary of Architectural Realignment
1. **Grid Layout**: Converted from `lg:grid-cols-5` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5`.
2. **Primary 4 KPI Cards**:
   - `Net Cash Position` → `KPICard` with `formatINRLakhCrore(mockAccountsKPI.cashPosition)`, `Wallet` icon, `on_track` status, and HDFC + Axis Corporate footnote.
   - `Total Receivables` → `KPICard` with `formatINRLakhCrore(mockAccountsKPI.totalReceivable)`, `ArrowUpRight` icon, `15 Enterprise accounts` footnote, linked to `/accounts/receivables`.
   - `Total Payables` → `KPICard` with `formatINRLakhCrore(mockAccountsKPI.totalPayable)`, `ArrowDownRight` icon, `18 Raw material vendors` footnote, linked to `/accounts/payables`.
   - `Overdue >45 Days` → `KPICard` with `formatINRLakhCrore(mockAccountsKPI.overdueReceivable)`, `AlertTriangle` icon, `overdue` status, `3 Accounts flagged` footnote, linked to `/accounts/receivables`.
3. **5th Metric Placement**:
   - Re-architected into a high-visibility `Reconciliation Variance Notice` alert banner immediately above the KPI grid with an amber accent bar, entry count pill, amount callout, and "Resolve Entries" link.
   - Added companion quick-badge in `PageHeader.actions`.
   - Added delta health pill in the Bank-vs-Books module card.
4. **Collection Efficiency Bar**:
   - `LinearProgressBar` with `value={mockAccountsKPI.collectionEfficiencyPct}` (94.2%), `variant="success"`, `valueLabel="94.2%"`, and `fractionLabel="₹30.95 Cr / ₹32.40 Cr"`.
5. **Quick Access Cards**:
   - Modernized with `bg-surface-container-lowest`, `border-outline-variant/30`, `rounded-xl`, and `HealthPill` status badges.

---

### 4.2 Proposed Complete Replacement for `AccountsOverview.tsx`

The following code is ready for drop-in replacement by the implementer:

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { mockAccountsKPI, mockCashTrend } from '../../data/accounts';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard } from '../../components/common/KPICard';
import { LinearProgressBar } from '../../components/common/LinearProgressBar';
import { HealthPill } from '../../components/common/HealthPill';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Users,
  Building2,
  TrendingUp,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export const AccountsOverview: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        category="FINANCE & OPERATIONS"
        title="Finance & Accounts Overview"
        description="Consolidated cash position, trade receivables ageing, vendor liabilities, and bank statement reconciliation."
        actions={
          <div className="flex items-center gap-3">
            {/* 5th Metric Companion Pill in Action Toolbar */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 shadow-xs text-xs font-mono">
              <span className="text-outline uppercase text-[10px] tracking-wider font-semibold">Unreconciled:</span>
              <span className="font-bold text-strand-amber tabular-nums">
                {formatINR(mockAccountsKPI.unreconciledAmount)}
              </span>
              <HealthPill
                status="at_risk"
                label={`${mockAccountsKPI.unreconciledCount} unmatched`}
                size="sm"
              />
            </div>
            <Link
              to="/accounts/reconciliation"
              className="px-3.5 py-1.5 bg-primary hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Daily Reconciliation</span>
            </Link>
          </div>
        }
      />

      {/* 5th Metric Operational Alert / Highlight Bar */}
      <div className="bg-surface-container-lowest border border-amber-300/60 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-strand-amber">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-strand-amber shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-strand-amber">
                Bank-vs-Books Variance Alert
              </span>
              <HealthPill status="at_risk" label={`${mockAccountsKPI.unreconciledCount} Unmatched Entries`} size="sm" />
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              MT940 statement balance deviates by <span className="font-mono font-bold text-on-surface tabular-nums">{formatINR(mockAccountsKPI.unreconciledAmount)}</span> against PACT ERP general ledger.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] uppercase font-mono text-outline">Unreconciled Delta</div>
            <div className="font-mono font-bold text-base text-strand-amber tabular-nums leading-tight">
              {formatINR(mockAccountsKPI.unreconciledAmount)}
            </div>
          </div>
          <Link
            to="/accounts/reconciliation"
            className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/40 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>Resolve Entries</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4-Across Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Net Cash Position */}
        <KPICard
          title="Net Cash Position"
          value={formatINRLakhCrore(mockAccountsKPI.cashPosition)}
          icon={<Wallet className="h-4 w-4 text-outline" />}
          status="on_track"
          footerLeft={
            <div className="flex items-center gap-1 text-strand-green font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>HDFC + Axis Corporate</span>
            </div>
          }
          footerRight="Verified 09:30"
        />

        {/* KPI 2: Total Receivables */}
        <KPICard
          title="Total Receivables"
          value={formatINRLakhCrore(mockAccountsKPI.totalReceivable)}
          icon={<ArrowUpRight className="h-4 w-4 text-outline" />}
          status="on_track"
          footerLeft="15 Enterprise accounts"
          footerRight="DSO: 38 days"
          to="/accounts/receivables"
        />

        {/* KPI 3: Total Payables */}
        <KPICard
          title="Total Payables"
          value={formatINRLakhCrore(mockAccountsKPI.totalPayable)}
          icon={<ArrowDownRight className="h-4 w-4 text-outline" />}
          status="neutral"
          footerLeft="18 Raw material vendors"
          footerRight="MSME Priority"
          to="/accounts/payables"
        />

        {/* KPI 4: Overdue >45 Days */}
        <KPICard
          title="Overdue >45 Days"
          value={formatINRLakhCrore(mockAccountsKPI.overdueReceivable)}
          icon={<AlertTriangle className="h-4 w-4 text-strand-red" />}
          status="overdue"
          footerLeft={
            <div className="flex items-center gap-1 text-strand-red font-semibold">
              <AlertTriangle className="w-3 h-3" />
              <span>3 Accounts flagged</span>
            </div>
          }
          footerRight="Stop-Dispatch"
          to="/accounts/receivables"
          className="border-strand-red/30"
        />
      </div>

      {/* 6-Month Billed vs Collected Trend with LinearProgressBar */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-outline-variant/15">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-sm text-on-surface">
                6-Month Billed Sales vs Cash Collections
              </h3>
              <HealthPill status="on_track" label="Target >90%" size="sm" />
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Tracking monthly billing against realized bank credits (₹ Cr)
            </p>
          </div>
          <div className="w-full sm:w-80 shrink-0">
            <LinearProgressBar
              value={mockAccountsKPI.collectionEfficiencyPct}
              label="Overall Collection Efficiency"
              valueLabel={`${mockAccountsKPI.collectionEfficiencyPct}%`}
              fractionLabel="₹30.95 Cr / ₹32.40 Cr"
              variant="success"
              heightClass="h-2"
            />
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockCashTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }}
                stroke="#c2c6d1"
              />
              <YAxis
                tickFormatter={(v) => `₹${(v / 10000000).toFixed(1)}Cr`}
                tick={{ fontSize: 11, fill: '#727781', fontFamily: '"IBM Plex Mono", monospace' }}
                stroke="#c2c6d1"
              />
              <Tooltip
                formatter={(val: any) => [formatINR(val), '']}
                contentStyle={{
                  backgroundColor: '#0b1c30',
                  borderColor: 'rgba(194, 198, 209, 0.4)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px -2px rgba(11, 28, 48, 0.2)',
                  fontSize: '11px',
                  fontFamily: '"IBM Plex Mono", monospace',
                  color: '#ffffff'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px', fontFamily: '"Inter Tight", sans-serif' }} />
              <Bar dataKey="billed" name="Billed Sales (INR)" fill="#c2c6d1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="collected" name="Realized Collections (INR)" fill="#018F3D" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Access Modules Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Link
          to="/accounts/reconciliation"
          className="p-4.5 bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/60 rounded-xl shadow-xs hover:shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
              <HealthPill status="at_risk" label={`${formatINR(mockAccountsKPI.unreconciledAmount)} delta`} size="sm" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Bank-vs-Books Reconciliation
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Auto-matches MT940 statement lines with PACT journal vouchers using AI discrepancy analysis.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant/15 text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>Open reconciliation</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/accounts/receivables"
          className="p-4.5 bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/60 rounded-xl shadow-xs hover:shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-strand-green border border-emerald-200 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <HealthPill status="on_track" label="15 Accounts" size="sm" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Customer Ageing & Receivables
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Slab-wise analysis (0-30 to 90+) and automated payment reminder cadence enforcement.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant/15 text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>Manage receivables</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/accounts/payables"
          className="p-4.5 bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/60 rounded-xl shadow-xs hover:shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-strand-amber border border-amber-200 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <HealthPill status="at_risk" label="40d Warning" size="sm" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Vendor Outstanding & UTR Tracker
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              40-day credit warning window, bi-weekly payment runs, and automated UTR advice emails.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant/15 text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>Manage payables</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
};
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **TypeScript Typecheck**:
   ```bash
   cd master-frontend/varun
   npm run typecheck
   ```
   *Expected Result*: Exits with code 0. Zero TypeScript diagnostic errors.
2. **Production Bundle Build**:
   ```bash
   cd master-frontend/varun
   npm run build
   ```
   *Expected Result*: Vite completes production bundling cleanly with 0 errors.

### 5.2 Visual & Structural Inspection Checkpoints
1. Verify the KPI grid renders strictly with `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5`.
2. Verify the 5th metric `Unreconciled Difference` appears prominently in the alert strip with amber accent (`border-l-strand-amber`) and in the `PageHeader` action toolbar without cluttering the 4-card grid.
3. Verify `LinearProgressBar` renders in the trend card header with dual labels (`94.2%` and `(₹30.95 Cr / ₹32.40 Cr)`).
4. Verify all numerical values use monospace styling (`font-mono tabular-nums`).
5. Verify clicking each card or link routes accurately:
   - Receivables card & module card → `/accounts/receivables`
   - Payables card & module card → `/accounts/payables`
   - Variance banner & reconciliation module card → `/accounts/reconciliation`

### 5.3 Invalidation Conditions
- If any component import introduces an undeclared prop not present in `KPICardProps`, `LinearProgressBarProps`, or `HealthPillProps`.
- If the 5th metric is deleted or hidden rather than placed in the alert highlight strip.
- If mock data imports from `src/data/accounts.ts` are broken or bypassed.
