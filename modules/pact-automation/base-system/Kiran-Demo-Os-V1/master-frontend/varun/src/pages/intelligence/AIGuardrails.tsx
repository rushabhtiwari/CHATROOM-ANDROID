import React, { useState } from 'react';
import {
  mockAIGuardrails,
  mockAIBlockedActions
} from '../../data/aiControl';
import { AIGuardrailPolicy, AIBlockedAction } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  Sliders,
  CheckCircle2,
  XCircle,
  EyeOff
} from 'lucide-react';

export const AIGuardrails: React.FC = () => {
  const [guardrails, setGuardrails] = useState<AIGuardrailPolicy[]>(mockAIGuardrails);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const togglePolicy = (id: string) => {
    setGuardrails(prev =>
      prev.map(g => g.id === id ? { ...g, isEnabled: !g.isEnabled } : g)
    );
    setToastMessage('Guardrail policy updated.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-strand-green flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="AI Safety Guardrails & Policy Gates"
      />

      {/* Active Policies Table */}
      <div className="bg-surface border border-line rounded-lg shadow-card overflow-hidden">
        <div className="p-4 border-b border-line bg-canvas/40 flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-ink">
            Active Safety Policies ({guardrails.filter(g => g.isEnabled).length} Enabled)
          </h3>
          <span className="font-mono text-xs text-strand-green font-semibold">100% Policy Enforcement</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
              <tr>
                <th className="p-3 font-sans">Policy Name</th>
                <th className="p-3 font-sans">Operational Scope</th>
                <th className="p-3">Safety Parameter / Threshold</th>
                <th className="p-3 font-sans">Violation Intercept Action</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center font-sans">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {guardrails.map((g) => (
                <tr key={g.id} className="hover:bg-canvas/60">
                  <td className="p-3">
                    <div className="font-bold text-ink font-sans text-xs">{g.name}</div>
                    <div className="text-[10px] text-muted font-sans mt-0.5">{g.description}</div>
                  </td>
                  <td className="p-3 font-sans text-slate-700">{g.scope}</td>
                  <td className="p-3 text-ai font-semibold">{g.threshold}</td>
                  <td className="p-3 font-sans text-slate-800">{g.action}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      g.isEnabled ? 'bg-emerald-50 text-strand-green border border-emerald-200' : 'bg-canvas text-muted'
                    }`}>
                      {g.isEnabled ? 'Enforcing' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => togglePolicy(g.id)}
                      className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                        g.isEnabled ? 'bg-strand-green' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          g.isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blocked Actions & Intercepts Audit Log */}
      <div className="bg-surface border border-line rounded-lg shadow-card overflow-hidden">
        <div className="p-4 border-b border-line bg-canvas/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-strand-amber" />
            <h3 className="font-display font-semibold text-sm text-ink">
              Recent Intercepted Violations & Blocked Actions
            </h3>
          </div>
          <span className="font-mono text-xs text-muted">Immutable Audit Stream</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3 font-sans">Feature Context</th>
                <th className="p-3 font-sans">Triggered Safety Policy</th>
                <th className="p-3 font-sans">Intercepted Action / Payload</th>
                <th className="p-3 font-sans">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mockAIBlockedActions.map((b) => (
                <tr key={b.id} className="hover:bg-canvas/50">
                  <td className="p-3 text-muted">{b.timestamp}</td>
                  <td className="p-3 font-sans font-semibold text-ink">{b.feature}</td>
                  <td className="p-3 text-strand-red font-semibold">{b.reason}</td>
                  <td className="p-3 font-sans text-slate-700 max-w-xs truncate">{b.interceptedPayload}</td>
                  <td className="p-3 font-sans">
                    <span className="px-2 py-0.5 rounded bg-canvas border border-line text-[11px] text-slate-800 font-medium">
                      {b.actionTaken}
                    </span>
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
