# Scope: Milestone 3 — Invoices, Billing & Payments Console

## Objective
Refactor invoice, billing, and payment tables, transaction logs, and ledger views across `master-frontend/varun` into the high-density Precision Engineering Industrial Console standard, enforcing 36px fixed row height (`h-9`), uppercase monospace headers (`text-[10px] font-mono uppercase tracking-wider text-outline bg-surface-container-low`), compact status pills, inline quick-action buttons, and clear filter strips.

## Target Files & Ownership
1. `src/pages/finance/Payables.tsx` (Feature 15)
2. `src/pages/finance/Receivables.tsx` (Feature 16)
3. `src/pages/finance/BankReconciliation.tsx` (Feature 17)
4. `src/pages/reimbursements/ReimbursementsList.tsx` (Feature 18a)
5. `src/pages/reimbursements/Disbursement.tsx` (Feature 18b)
6. `src/pages/operations/PurchaseOrders.tsx` (Feature 19a)
7. `src/pages/operations/GRNThreeWayMatch.tsx` (Feature 19b)
8. Reference: `src/components/common/DataGrid.tsx`, `StatusPill.tsx`, `ClaimStatusPill.tsx`, `IndianRupee.tsx`

## Requirements
- Standardize all table views and ledgers to high-density 36px fixed row height default (`h-9`).
- Use uppercase monospace column headers (`font-mono uppercase text-[10px] tracking-wider text-outline bg-surface-container-low border-b border-outline-variant/30`).
- Ensure compact status pills (`rounded-full` or `rounded-badge` with fine tint border).
- Integrate inline quick-action buttons on table rows (e.g., Pay Now, Remit UTR, Dispatch Chaser, Match Voucher, Debit Note).
- Clear filter toolbars (search, status filter, date range, scope tabs).
- Strictly preserve all mock data stores (`mockPayables`, `mockReceivables`, `mockBankStatementLines`, `mockBookEntries`, `mockPurchaseOrders`, `mockThreeWayMatchRecords`, `useRts`).
- Preserve business rules:
  - 40-day credit warning on 45-day MSME payment cycle (`Payables.tsx`).
  - 60-day overdue stop-dispatch hold indicator (`Receivables.tsx`).
- Zero git commits or pushes.
