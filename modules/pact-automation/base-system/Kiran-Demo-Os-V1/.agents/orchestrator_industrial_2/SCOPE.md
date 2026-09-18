# Scope: Milestone 2 — Main Executive & Operational Dashboards

## Objective
Modernize executive and operational dashboards across `master-frontend/varun` into the high-density Precision Engineering Industrial Console standard, utilizing shared `KPICard`, `LinearProgressBar`, `HealthPill` primitives, 4-across responsive grids, and monospace numerical typography.

## Target Files & Ownership
1. `src/pages/command/CommandCenter.tsx` (Feature 10)
2. `src/pages/finance/AccountsOverview.tsx` (Feature 11)
3. `src/pages/operations/PurchaseOverview.tsx` (Feature 12)
4. `src/pages/intelligence/AIOverview.tsx` (Feature 13a)
5. `src/pages/intelligence/AICosts.tsx` (Feature 13b)
6. `src/pages/operations/BudgetAllocation.tsx` (Feature 14)
7. Primitives reference: `src/components/common/KPICard.tsx`, `LinearProgressBar.tsx`, `HealthPill.tsx`

## Requirements
- Enforce strict 4-across responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5` or `xl:grid-cols-4`) for primary KPI strips.
- Use `KPICard` with Stitch container tokens (`bg-surface-container-lowest`, `border-outline-variant/30`, `shadow-xs`, `rounded-xl`).
- Format all numeric values in monospace tabular typography (`font-mono font-bold tabular-nums leading-none`) with baseline unit labels.
- Standardize operational status pills to `HealthPill` with live pulsing dots (`on_track`, `at_risk`, `overdue`).
- Implement dual-segment `LinearProgressBar` with `bg-surface-container` track and smooth transitions.
- Strictly preserve all existing mock data sources, business rules (e.g. Friday weekly lockout rules), and routing.
- Zero git commits or pushes.
