import React, { useState } from 'react';
import { mockAutomations } from '../../data/automations';
import { AutomationRule } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { Play, ArrowRight, Plus } from 'lucide-react';

export const AutomationsList: React.FC = () => {
  const [automations, setAutomations] = useState<AutomationRule[]>(mockAutomations);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleAutomation = (id: string) => {
    setAutomations(prev =>
      prev.map(a => a.id === id ? { ...a, isEnabled: !a.isEnabled } : a)
    );
    setToastMessage('Automation updated.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRunNow = (name: string) => {
    setToastMessage(`Ran "${name}".`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover text-[13px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader
        title="Automations"
        actions={
          <button
            onClick={() => alert('New automation rule builder')}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            New automation
          </button>
        }
      />

      <div className="space-y-4">
        {automations.map((rule) => (
          <div
            key={rule.id}
            className={`bg-surface border border-line rounded-lg p-5 space-y-4 ${
              rule.isEnabled ? '' : 'opacity-60'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-ink">{rule.name}</h3>
                <div className="text-[13px] text-muted mt-0.5">
                  <span className="font-code">{rule.id}</span> · {rule.department}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => handleRunNow(rule.name)} className="btn-secondary">
                  <Play className="w-4 h-4 text-slate-500" />
                  Test
                </button>

                <button
                  onClick={() => toggleAutomation(rule.id)}
                  role="switch"
                  aria-checked={rule.isEnabled}
                  aria-label={rule.isEnabled ? 'Turn off' : 'Turn on'}
                  className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
                    rule.isEnabled ? 'bg-kiran' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      rule.isEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* When / if / then */}
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-ink">
              <span className="px-2.5 py-1 rounded-md bg-[#EFEFF2]">
                <span className="text-muted">When </span>
                {rule.triggerText}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              {rule.conditionsText && (
                <>
                  <span className="px-2.5 py-1 rounded-md bg-[#EFEFF2]">
                    <span className="text-muted">If </span>
                    {rule.conditionsText}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </>
              )}
              <span className="px-2.5 py-1 rounded-md bg-[#EFEFF2]">
                <span className="text-muted">Then </span>
                {rule.actionsText}
              </span>
            </div>

            <div className="flex items-center justify-between text-[13px] text-muted">
              <span>
                <span className="text-ink tabular-nums">{rule.runsThisMonth.toLocaleString('en-IN')}</span> runs this month
              </span>
              <span>{rule.owner}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
