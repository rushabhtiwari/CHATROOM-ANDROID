## 2026-09-03T10:17:32Z
You are teamwork_preview_worker_m3_fix.
Your working directory is: c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_worker_m3_fix

MANDATORY FIRST STEP:
Read c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\ORIGINAL_REQUEST.md before starting any work. Do not skip this.
Also read c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\PROJECT.md and c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\orchestrator_industrial_2\SCOPE_M3.md.

Context & Mandatory Fix:
Reviewer 2 found hardcoded returns on lines 31-32 in master-frontend/varun/src/pages/operations/GRNThreeWayMatch.tsx:
```tsx
if (rec.grnNumber === 'GRN-2026-0419') return '₹33,000';
if (rec.grnNumber === 'GRN-2026-0412') return '₹8,400';
```
This is an integrity defect and must be replaced with genuine dynamic calculation.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
1. In master-frontend/varun/src/pages/operations/GRNThreeWayMatch.tsx, remove the hardcoded checks on `rec.grnNumber`.
2. Implement a 100% genuine dynamic variance calculation that evaluates the debit note amount directly from the record fields:
   - Quantity shortfall variance: `Math.max(0, rec.poQty - rec.deliveredQty) * rec.poRate`
   - Rate surcharge variance: `Math.max(0, rec.invoiceRate - rec.poRate) * rec.deliveredQty`
   - Total debit note = quantity shortfall variance + rate surcharge variance
   - Format dynamically: `₹${Math.round(totalVariance).toLocaleString('en-IN')}`
3. Verify that:
   - For `GRN-2026-0419` (short 200 kg @ ₹165), formula dynamically calculates ₹33,000.
   - For `GRN-2026-0412` (surcharge ₹420/kg on 20 kg), formula dynamically calculates ₹8,400.
   - For exact match (`GRN-2026-0408`), formula dynamically calculates ₹0.
4. Run verification in master-frontend/varun:
   - npm run typecheck (must pass with 0 errors)
   - npm run build (must succeed cleanly)
5. Write handoff report to c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\.agents\teamwork_preview_worker_m3_fix\handoff.md and report to parent.
DO NOT execute any git commit or git push commands.
