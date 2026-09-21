import React, { useState } from 'react';
import { mockDepartmentBudgets } from '../../data/requisitions';
import { DepartmentBudget } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';

export const BudgetAllocation: React.FC = () => {
  const [budgets, setBudgets] = useState<DepartmentBudget[]>(mockDepartmentBudgets);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSubmitNextMonthPlan = () => {
    setToastMessage('September plan sent to Meera Iyer.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover text-[14px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader
        title="Budgets"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-muted whitespace-nowrap">Due 24 Aug</span>
            <button onClick={handleSubmitNextMonthPlan} className="btn-primary">
              Submit September plan
            </button>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] font-semibold text-ink">
            Rajesh Kumar <span className="text-[13px] font-normal text-muted">Head of Sales</span>
          </h3>
          <span className="inline-flex items-center h-6 px-2 rounded-md bg-[#E7F3EB] text-[#17723F] text-[13px] font-medium">
            No unsettled bills
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="kpi">
            <div className="kpi-label">Monthly limit</div>
            <div className="kpi-value">₹1,50,000</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Used</div>
            <div className="kpi-value">₹45,000</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Available</div>
            <div className="kpi-value">₹1,05,000</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[16px] font-semibold text-ink">Departments</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((dept) => {
            const spentPct = Math.round((dept.spent / dept.allocated) * 100);

            return (
              <div key={dept.department} className="bg-surface border border-line rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[14px] font-semibold text-ink">{dept.department}</h4>
                  <span
                    className={`text-[13px] tabular-nums whitespace-nowrap ${
                      spentPct > 85 ? 'text-strand-red font-medium' : 'text-muted'
                    }`}
                  >
                    {spentPct}% used
                  </span>
                </div>

                <div className="w-full h-1.5 bg-[#EBEBEF] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${spentPct}%` }}
                    className={`h-full rounded-full ${spentPct > 85 ? 'bg-strand-red' : 'bg-kiran'}`}
                  />
                </div>

                <div className="space-y-2 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-muted">Budget</span>
                    <span className="text-ink tabular-nums">{formatINR(dept.allocated)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Spent</span>
                    <span className="text-ink tabular-nums">{formatINR(dept.spent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Left</span>
                    <span className="text-ink font-medium tabular-nums">{formatINR(dept.remaining)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Bills pending</span>
                    <span className="text-ink tabular-nums">{dept.pendingBillsCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
