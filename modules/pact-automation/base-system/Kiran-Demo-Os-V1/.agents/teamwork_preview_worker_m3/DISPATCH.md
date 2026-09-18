## 2026-09-03T15:29:32Z
Task assignment for teamwork_preview_worker_m3:
Implement Milestone 3 (M3) dense industrial table views across 7 files:
- master-frontend/varun/src/pages/finance/Payables.tsx
- master-frontend/varun/src/pages/finance/Receivables.tsx
- master-frontend/varun/src/pages/finance/BankReconciliation.tsx
- master-frontend/varun/src/pages/reimbursements/ReimbursementsList.tsx
- master-frontend/varun/src/pages/reimbursements/Disbursement.tsx
- master-frontend/varun/src/pages/operations/PurchaseOrders.tsx
- master-frontend/varun/src/pages/operations/GRNThreeWayMatch.tsx

Key constraints:
- 36px fixed row height standard (h-9) across tables without vertical overflow
- Uppercase monospace table column headers (`text-[10px] font-mono uppercase tracking-wider text-outline bg-surface-container-low border-b border-outline-variant/30`)
- Compact status pills and inline quick-action buttons on rows
- Filter strips and tab bars preserved and enhanced
- 40-day credit warning banner in Payables.tsx preserved
- 60-day overdue Stop-Dispatch hold indicator in Receivables.tsx preserved
- Strictly preserve all mock data stores and routing
- npm run typecheck & npm run build in master-frontend/varun must pass cleanly
- ABSOLUTELY NO git commit or git push commands
