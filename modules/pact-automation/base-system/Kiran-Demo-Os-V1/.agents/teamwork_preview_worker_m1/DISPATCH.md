# DISPATCH — Worker Milestone 1: Global Shell & Core Industrial Primitives

## Role
Implementation Worker for Milestone 1: Global Shell, Navigation Alignment & Core Design Primitives.

## Working Directory
`c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_worker_m1`

## Mandatory Reference Documents
- MUST read: `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\ORIGINAL_REQUEST.md` (specifically 2026-09-03T05:44:07Z)
- Architecture & Contracts: `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\PROJECT.md`
- Survey 1 Report: `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_explorer_survey_1\handoff.md`
- Survey 2 Report: `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_explorer_survey_2\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership (Exclusively Assigned Files)
Target working directory: `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun`
1. `src/index.css`: Add Stitch CSS variables and modernize `.panel`, `.grid-head`, `.panel-header`.
2. `src/components/shell/AppShell.tsx`: Update base canvas to Stitch surface hierarchy (`bg-surface-container-low/30` or `bg-surface-container-lowest`), ensuring full-bleed and container consistency.
3. `src/components/shell/TopBar.tsx`: Modernize container (`bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/30 text-on-surface`), breadcrumb separators with `text-outline` / `text-outline-variant/50`, and elevated search launcher (`bg-surface-container-low border border-outline-variant/30 hover:border-primary/40`).
4. `src/components/shell/Sidebar.tsx`: Modernize section markers (`font-mono tracking-widest text-[9px] uppercase text-white/40`) and hairline border (`border-r border-outline-variant/30`).
5. `src/components/shell/PageHeader.tsx`: Modernize with optional monospace category eyebrow (`font-mono text-[11px] uppercase tracking-wider text-outline`), action toolbar slot, and hairline divider (`border-b border-outline-variant/30 pb-4 mb-6`).
6. `src/components/common/DataGrid.tsx`: Set default row height to 36px (`h-9`), table headers to uppercase monospace (`font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30`), and row selection indicator to `bg-surface-container-low border-l-2 border-primary`.
7. `src/components/common/HealthPill.tsx`: Create shared health status pill with animated pulsing dots for On Track, At Risk, Overdue/Critical (per Survey 2 blueprint).
8. `src/components/common/LinearProgressBar.tsx`: Create shared linear progress bar with dual-state fill (`bg-primary` and `bg-tertiary-fixed-dim`) on `bg-surface-container` track (per Survey 2 blueprint).
9. `src/components/common/KPICard.tsx`: Create shared industrial KPI card with Stitch container styling, monospace metric formatting, baseline unit alignment, and secondary metric footers (per Survey 2 blueprint).

## Guardrails
- Strictly clientside changes in `master-frontend/varun`.
- Preserve all existing state, mock stores, and routing.
- Absolutely NO git commit or git push commands.
- Run `npm run typecheck` and `npm run build` in `master-frontend/varun` to verify zero compilation errors.

## Handoff Requirements
Write complete report to `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_worker_m1\handoff.md` with:
- Observation (files modified, lines changed)
- Build and Typecheck verification results (commands run, exit codes, output)
- Verification that all existing routes and functionality continue to work

## 2026-09-03T05:54:40Z
<USER_REQUEST>
You are teamwork_preview_worker for Milestone 1: Global Shell & Core Industrial Primitives.
Your working directory is c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_worker_m1.
Read c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\ORIGINAL_REQUEST.md (specifically the latest request dated 2026-09-03T05:44:07Z), c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\PROJECT.md, and c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_worker_m1\DISPATCH.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Target working directory: c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun
Your exclusively assigned files to modify/create:
1. `src/index.css`: Add Stitch CSS variables, modernize `.panel`, `.grid-head`, `.panel-header`.
2. `src/components/shell/AppShell.tsx`: Update base canvas to Stitch surface hierarchy, ensure layout and edge-to-edge container margins.
3. `src/components/shell/TopBar.tsx`: Modernize container (Stitch surface tokens, hairline divider), breadcrumbs (Stitch outline tokens), and elevated search launcher.
4. `src/components/shell/Sidebar.tsx`: Modernize group headers with uppercase monospace markers and hairline divider.
5. `src/components/shell/PageHeader.tsx`: Modernize with optional monospace category eyebrow, action toolbar slot, hairline divider.
6. `src/components/common/DataGrid.tsx`: Set default row height to 36px (`h-9`), table headers to uppercase monospace (`font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant/30`), and row selection indicator to `bg-surface-container-low border-l-2 border-primary`.
7. `src/components/common/HealthPill.tsx`: Create shared health pill with animated pulsing dots for On Track, At Risk, Overdue/Critical.
8. `src/components/common/LinearProgressBar.tsx`: Create shared linear progress bar with dual-segment fills on Stitch container tracks.
9. `src/components/common/KPICard.tsx`: Create shared industrial KPI card with Stitch container tokens, monospace typography, and secondary footers.

Strict guardrails:
- Strictly clientside changes within master-frontend/varun.
- Preserve all existing state, mock data stores, routing, and business logic.
- Absolutely NO git commit or git push commands.
- Run `npm run typecheck` and `npm run build` in master-frontend/varun to verify that TypeScript compilation passes with 0 errors and production build succeeds.

Maintain progress.md in your working directory.
Write your complete handoff report to c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_worker_m1\handoff.md.
When finished, send a message to orchestrator with your results and verification commands.
</USER_REQUEST>

