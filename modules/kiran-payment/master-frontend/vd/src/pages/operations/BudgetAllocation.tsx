import React, { useState } from 'react';
import { mockDepartmentBudgets } from '../../data/requisitions';
import { DepartmentBudget } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  Calendar,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building2,
  UserCheck
} from 'lucide-react';

export const BudgetAllocation: React.FC = () => {
  const [budgets, setBudgets] = useState<DepartmentBudget[]>(mockDepartmentBudgets);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSubmitNextMonthPlan = () => {
    setToastMessage("September 2026 expenditure plan submitted to Accounts Head (Meera Iyer).");
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Monthly Departmental Budget & Planning"
      />

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

      {/* Personal Budget Card (Logged-in User) */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-line pb-2 font-sans">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-kiran" />
            <h3 className="font-semibold text-sm text-ink">
              Personal Advance Entitlement — Rajesh Kumar (Head of Sales)
            </h3>
          </div>
          <span className="text-xs font-mono text-strand-green font-semibold">Good Standing (0 Unsettled Bills)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="p-3 bg-canvas rounded border border-line">
            <div className="text-[10px] text-muted uppercase font-sans">Monthly Limit</div>
            <div className="text-lg font-bold text-ink mt-1">₹1,50,000</div>
          </div>
          <div className="p-3 bg-canvas rounded border border-line">
            <div className="text-[10px] text-muted uppercase font-sans">Current Utilized</div>
            <div className="text-lg font-bold text-slate-700 mt-1">₹45,000</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
            <div className="text-[10px] text-emerald-800 uppercase font-sans">Available Limit</div>
            <div className="text-lg font-bold text-strand-green mt-1">₹1,05,000</div>
          </div>
        </div>
      </div>

      {/* Department Budget Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgets.map((dept) => {
          const spentPct = Math.round((dept.spent / dept.allocated) * 100);

          return (
            <div
              key={dept.department}
              className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <h4 className="font-display font-semibold text-sm text-ink">
                      {dept.department}
                    </h4>
                  </div>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-canvas border border-line">
                    {spentPct}% Burned
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-muted">
                    <span>Allocated:</span>
                    <span className="text-ink font-semibold">{formatINR(dept.allocated)}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Spent (MTD):</span>
                    <span className="text-slate-700 font-semibold">{formatINR(dept.spent)}</span>
                  </div>
                  <div className="flex justify-between text-muted pt-1 border-t border-line/60">
                    <span>Remaining:</span>
                    <span className="text-strand-green font-bold">{formatINR(dept.remaining)}</span>
                  </div>
                </div>

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
              </div>

              <div className="pt-3 border-t border-line text-[11px] text-muted flex items-center justify-between">
                <span>Pending Bill Vouchers:</span>
                <span className={`font-mono font-semibold ${dept.pendingBillsCount > 0 ? 'text-strand-amber' : 'text-strand-green'}`}>
                  {dept.pendingBillsCount} Pending
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
