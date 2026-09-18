import React, { useState } from 'react';
import { mockDepartmentBudgets } from '../../data/requisitions';
import { DepartmentBudget } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { LinearProgressBar } from '../../components/common/LinearProgressBar';
import { HealthPill } from '../../components/common/HealthPill';
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
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover border border-primary flex items-center gap-2.5 text-xs animate-fadeIn font-mono">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        category="PROCUREMENT & OPERATIONS"
        title="Monthly Departmental Budget & Planning"
        description="Departmental OPEX burn monitoring, mid-month variance control, and next cycle expenditure proposal submissions."
      />

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
          className="px-4 py-2 bg-primary hover:bg-brand-600 text-white font-mono text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          Submit September Plan
        </button>
      </div>

      {/* Personal Budget Card (Logged-in User) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-outline-variant pb-2 font-sans">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-on-surface">
              Personal Advance Entitlement — Rajesh Kumar (Head of Sales)
            </h3>
          </div>
          <HealthPill status="on_track" label="Good Standing (0 Unsettled Bills)" />
        </div>

        <div className="ku-ledger border-t-3 border-t-structure grid-cols-1 sm:grid-cols-3 pt-1">
          <div className="p-3 bg-white rounded-lg">
            <div className="text-[10px] text-outline uppercase font-mono font-semibold">Monthly Limit</div>
            <div className="text-lg font-bold text-on-surface mt-1 font-mono tabular-nums">₹1,50,000</div>
          </div>
          <div className="p-3 bg-white rounded-lg">
            <div className="text-[10px] text-outline uppercase font-mono font-semibold">Current Utilized</div>
            <div className="text-lg font-bold text-on-surface-variant mt-1 font-mono tabular-nums">₹45,000</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="text-[10px] text-emerald-800 uppercase font-mono font-semibold">Available Limit</div>
            <div className="text-lg font-bold text-strand-green mt-1 font-mono tabular-nums">₹1,05,000</div>
          </div>
        </div>
      </div>

      {/* Department Budget Cards Grid */}
      <div className="ku-ledger border-t-3 border-t-structure grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((dept) => {
          const spentPct = Math.round((dept.spent / dept.allocated) * 100);

          return (
            <div
              key={dept.department}
              className="flex flex-col justify-between bg-white p-4 transition-colors duration-150 hover:bg-canvas"
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
                  <div className="flex justify-between text-on-surface-variant pt-1.5 border-t border-outline-variant">
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

              <div className="mt-3 pt-2.5 border-t border-outline-variant text-[11px] text-outline flex items-center justify-between font-mono">
                <span>Pending Bill Vouchers:</span>
                <span className={`font-semibold tabular-nums ${dept.pendingBillsCount > 0 ? 'text-strand-amber' : 'text-on-surface-variant'}`}>
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
