# BRIEFING — 2026-09-03T10:00:00Z

## Mission
Technical exploration and line-referenced refactoring blueprint for Milestone 3 (Bank Reconciliation & Reimbursements/Disbursement)

## 🔒 My Identity
- Archetype: explorer
- Roles: Technical Explorer & Synthesizer
- Working directory: c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_explorer_m3_2
- Original parent: 56322bad-6d9a-42a8-be1c-b4b85d42d1bd
- Milestone: Milestone 3

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT modify any source code files
- Standardize tables to 36px fixed row height (h-9), font-mono uppercase headers, compact status pills, inline actions
- Maintain all mock data bindings and routes

## Current Parent
- Conversation ID: 56322bad-6d9a-42a8-be1c-b4b85d42d1bd
- Updated: 2026-09-03T10:00:00Z

## Investigation State
- **Explored paths**: 
  - `master-frontend/varun/src/pages/finance/BankReconciliation.tsx`
  - `master-frontend/varun/src/pages/reimbursements/ReimbursementsList.tsx`
  - `master-frontend/varun/src/pages/reimbursements/Disbursement.tsx`
  - `master-frontend/varun/src/pages/reimbursements/ClaimStatusPill.tsx`
  - `master-frontend/varun/src/pages/reimbursements/ClaimSummaryBar.tsx`
  - `master-frontend/varun/src/components/common/DataGrid.tsx`
  - `master-frontend/varun/src/components/common/StatusPill.tsx`
  - `master-frontend/varun/src/modules/rts/store.tsx`
  - `master-frontend/varun/src/data/accounts.ts`
  - `master-frontend/varun/src/types/index.ts`
  - `master-frontend/varun/src/App.tsx`
- **Key findings**:
  1. `BankReconciliation.tsx`: Currently uses stacked cards in a 2-column layout rather than native comparison tables. Needs conversion to dual synchronized native tables with 36px fixed rows (`h-9`), monospace uppercase headers (`text-[10px] font-mono uppercase tracking-wider text-outline bg-surface-container-low border-b border-outline-variant/30`), compact discrepancy pills, and inline Sparkles auto-match buttons.
  2. `ReimbursementsList.tsx`: Uses `DataGrid` with default `h-9` (`isCompact: true`), but the 'Purpose' column bundles multi-line title and employee details which overflow 36px fixed height. Needs separation into distinct single-line columns (`Employee`, `Purpose`, `Category`, `Amount`, `Filed`, `Status`, `Action`) to ensure clean 36px row rendering.
  3. `Disbursement.tsx`: Payment Queue currently renders loose cards (`div.panel`); Payout Ledger renders an unstandardized table with 44-48px rows and legacy tokens. Both must be standardized to 36px fixed row height native tables with uppercase monospace headers, compact UTR link pills, and inline actions (Pay by method, Verify KYC, Retry failed payout).
  4. Mock data bindings (`mockBankStatementLines`, `mockBookEntries`, `useRts`) and route URLs (`/accounts/reconciliation`, `/reimbursements`, `/reimbursements/pay`) are fully verified and must remain intact.
- **Unexplored areas**: None. Exploration of all targets is complete.

## Key Decisions Made
- Dual tables in BankReconciliation will retain side-by-side comparison on wide viewports (12-col grid: 6 cols each on `lg`/`xl`) and use single-line cells with hover tooltips for AI suggestion text to guarantee exact 36px row compliance.
- Payment Queue in Disbursement will be converted from card list to a high-density industrial native table with 36px row height, compact verified/unverified KYC badges, and inline pay/verify buttons.
- Baseline typecheck verified: `tsc --noEmit` exits with status 0.

## Artifact Index
- handoff.md — Comprehensive handoff report
- progress.md — Liveness heartbeat and milestone tracking
