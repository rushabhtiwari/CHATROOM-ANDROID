import React, { useState } from 'react';
import { mockAutomations } from '../../data/automations';
import { AutomationRule } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import {
  Zap,
  Play,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  Sliders,
  Sparkles
} from 'lucide-react';

export const AutomationsList: React.FC = () => {
  const [automations, setAutomations] = useState<AutomationRule[]>(mockAutomations);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleAutomation = (id: string) => {
    setAutomations(prev =>
      prev.map(a => a.id === id ? { ...a, isEnabled: !a.isEnabled } : a)
    );
    setToastMessage('Automation rule state updated.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRunNow = (name: string) => {
    setToastMessage(`Triggered execution for "${name}". 1 event processed.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Event Automation Chains & Workflows"
        actions={
          <button
            onClick={() => alert('New automation rule builder')}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Automation Chain
          </button>
        }
      />

      {/* Automations Cards List */}
      <div className="space-y-4">
        {automations.map((rule) => (
          <div
            key={rule.id}
            className={`bg-surface border rounded-md p-5 shadow-card transition-all space-y-4 ${
              rule.isEnabled ? 'border-line hover:border-kiran' : 'border-line/60 opacity-60'
            }`}
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded flex items-center justify-center ${
                  rule.isEnabled ? 'bg-kiran-tint text-kiran' : 'bg-canvas text-muted'
                }`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-ink">
                    {rule.name}
                  </h3>
                  <div className="text-[10px] text-muted font-mono mt-0.5">
                    {rule.id} · Category: <strong className="text-slate-700 font-sans">{rule.department}</strong>
                  </div>
                </div>
              </div>

              {/* Actions & Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleRunNow(rule.name)}
                  className="px-2.5 py-1 bg-canvas hover:bg-slate-200 border border-line text-[11px] font-mono text-slate-700 rounded flex items-center gap-1"
                >
                  <Play className="w-3 h-3 text-kiran" />
                  <span>Test Run</span>
                </button>

                <button
                  onClick={() => toggleAutomation(rule.id)}
                  className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                    rule.isEnabled ? 'bg-strand-green' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      rule.isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Sentence-Chain Flow Box */}
            <div className="p-3 bg-canvas/60 border border-line rounded flex flex-wrap items-center gap-2 text-xs font-mono text-slate-800">
              <span className="px-2 py-0.5 rounded bg-blue-100 text-kiran font-semibold">
                WHEN: {rule.triggerText}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-muted" />
              {rule.conditionsText && (
                <>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                    IF: {rule.conditionsText}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted" />
                </>
              )}
              <span className="px-2 py-0.5 rounded bg-purple-100 text-ai font-semibold">
                THEN: {rule.actionsText}
              </span>
            </div>

            {/* Footer Stats */}
            <div className="flex items-center justify-between text-xs font-mono text-muted pt-1">
              <span>Total Triggered: <strong className="text-ink">{rule.runsThisMonth.toLocaleString('en-IN')} times</strong></span>
              <span>Owner: <strong className="text-slate-700">{rule.owner}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
