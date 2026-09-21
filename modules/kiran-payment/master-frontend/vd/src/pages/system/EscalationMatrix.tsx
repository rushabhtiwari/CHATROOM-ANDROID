import React, { useState } from 'react';
import { mockEscalationMatrix } from '../../data/admin';
import { EscalationMatrixItem } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sliders,
  ShieldAlert,
  Edit2
} from 'lucide-react';

export const EscalationMatrix: React.FC = () => {
  const [matrix, setMatrix] = useState<EscalationMatrixItem[]>(mockEscalationMatrix);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleUpdateTimeout = (triggerType: string, level: string, newTime: string) => {
    setToastMessage(`Updated ${level} timeout for "${triggerType}" to ${newTime}.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-[13px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Automated Escalation Matrix & SLA Policies"
      />

      {/* Escalation Matrix Visual Grid */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="p-4 border-b border-line bg-canvas/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-strand-amber" />
            <h3 className="font-semibold text-sm text-ink">
              Multi-Tier Escalation Threshold Matrix (L1 &rarr; L4)
            </h3>
          </div>
          <span className="font-mono text-[13px] text-muted">Auto-Climb Enforced</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] font-mono">
            <thead className="bg-canvas text-muted text-[12px] border-b border-line">
              <tr>
                <th className="p-3 font-sans w-56">Trigger Condition</th>
                <th className="p-3 font-sans w-40">Department</th>
                <th className="p-3">Level 1 (Direct Lead)</th>
                <th className="p-3">Level 2 (HOD Desk)</th>
                <th className="p-3">Level 3 (VP / Ops)</th>
                <th className="p-3">Level 4 (Managing Director)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {matrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-canvas/50">
                  <td className="p-3 font-sans font-semibold text-ink">
                    {row.triggerType}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-canvas border border-line text-[12px] text-slate-700">
                      {row.department}
                    </span>
                  </td>

                  {/* L1 */}
                  <td className="p-3 bg-canvas/20">
                    <div className="font-sans font-semibold text-ink">{row.l1.role}</div>
                    <div className="text-[12px] text-muted">{row.l1.timeBeforeEscalate}</div>
                  </td>

                  {/* L2 */}
                  <td className="p-3 bg-amber-50/20">
                    <div className="font-sans font-semibold text-amber-950">{row.l2.role}</div>
                    <div className="text-[12px] text-strand-amber font-semibold">{row.l2.timeBeforeEscalate}</div>
                  </td>

                  {/* L3 */}
                  <td className="p-3 bg-orange-50/20">
                    <div className="font-sans font-semibold text-orange-950">{row.l3.role}</div>
                    <div className="text-[12px] text-orange-700 font-semibold">{row.l3.timeBeforeEscalate}</div>
                  </td>

                  {/* L4 */}
                  <td className="p-3 bg-red-50/20">
                    <div className="font-sans font-semibold text-strand-red">{row.l4.role}</div>
                    <div className="text-[12px] text-strand-red font-semibold">{row.l4.timeBeforeEscalate}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
