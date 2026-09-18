import React, { useState } from 'react';
import { mockAIModels } from '../../data/aiControl';
import { AIModelRegistryItem } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  Cpu,
  ChevronDown,
  ChevronUp,
  Settings2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export const AIModels: React.FC = () => {
  const [models, setModels] = useState<AIModelRegistryItem[]>(mockAIModels);
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [selectedChangeModel, setSelectedChangeModel] = useState<AIModelRegistryItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedModelId(expandedModelId === id ? null : id);
  };

  const handleApplyModelChange = () => {
    setToastMessage(`Feature routing updated. Projected monthly savings: ₹2,400 with 0.8% confidence change.`);
    setSelectedChangeModel(null);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-ai flex items-center gap-2.5 text-xs animate-fadeIn">
          <Sparkles className="w-4 h-4 text-ai" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Foundation Model Registry & Parameters"
      />

      {/* Model Registry Table */}
      <div className="bg-surface border border-line rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
              <tr>
                <th className="p-3 font-sans">Model Engine</th>
                <th className="p-3 font-sans">Provider</th>
                <th className="p-3 text-right">Context</th>
                <th className="p-3 text-right">Input / Output Rate</th>
                <th className="p-3 text-right">Monthly Spend</th>
                <th className="p-3 text-right">Avg Latency</th>
                <th className="p-3 text-right">Success %</th>
                <th className="p-3">Fallback Engine</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {models.map((m) => {
                const isExpanded = expandedModelId === m.id;

                return (
                  <React.Fragment key={m.id}>
                    <tr className="hover:bg-canvas/60 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-ink text-sm font-sans flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-ai" />
                          <span>{m.name}</span>
                        </div>
                        <div className="text-[10px] text-muted font-sans mt-0.5">
                          {m.assignedFeatures.join(', ')}
                        </div>
                      </td>
                      <td className="p-3 font-sans text-slate-700">{m.provider}</td>
                      <td className="p-3 text-right">{m.contextWindow}</td>
                      <td className="p-3 text-right">
                        ${m.inputRateUSD} / ${m.outputRateUSD}
                      </td>
                      <td className="p-3 text-right font-bold text-ink">
                        {formatINR(m.monthlySpendINR)}
                      </td>
                      <td className="p-3 text-right">{m.avgLatencySec}s</td>
                      <td className="p-3 text-right font-bold text-strand-green">
                        {m.successRatePct}%
                      </td>
                      <td className="p-3 text-slate-600">{m.fallbackModel || 'None (Primary)'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedChangeModel(m)}
                            className="px-2 py-1 bg-ai-tint text-ai hover:bg-ai-tint/80 border border-ai/30 rounded text-[11px] font-sans font-semibold shadow-2xs"
                          >
                            Route
                          </button>
                          <button
                            onClick={() => toggleExpand(m.id)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600"
                            title="Toggle hyperparameters"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Hyperparameters Drawer */}
                    {isExpanded && (
                      <tr className="bg-canvas/40 border-b border-line">
                        <td colSpan={9} className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
                            <div className="p-3 bg-white rounded border border-line space-y-1">
                              <span className="text-muted text-[10px] uppercase font-sans">Sampling Temperature</span>
                              <div className="text-sm font-bold text-ink">{m.config.temperature}</div>
                              <div className="text-[10px] text-muted font-sans">Deterministic parsing</div>
                            </div>
                            <div className="p-3 bg-white rounded border border-line space-y-1">
                              <span className="text-muted text-[10px] uppercase font-sans">Max Generation Limit</span>
                              <div className="text-sm font-bold text-ink">{m.config.maxTokens} tokens</div>
                              <div className="text-[10px] text-muted font-sans">Safety ceiling per turn</div>
                            </div>
                            <div className="p-3 bg-white rounded border border-line space-y-1">
                              <span className="text-muted text-[10px] uppercase font-sans">Network Timeout</span>
                              <div className="text-sm font-bold text-ink">{m.config.timeoutSec}s</div>
                              <div className="text-[10px] text-muted font-sans">Circuit-breaker trigger</div>
                            </div>
                            <div className="p-3 bg-white rounded border border-line space-y-1">
                              <span className="text-muted text-[10px] uppercase font-sans">Rate Limiting</span>
                              <div className="text-sm font-bold text-ink">{m.config.rateLimit}</div>
                              <div className="text-[10px] text-muted font-sans">Provider tier quota</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Model & Cost Delta Projection Modal */}
      {selectedChangeModel && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-md shadow-popover border border-line max-w-lg w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-ai" />
                <h3 className="font-display font-semibold text-sm text-ink">
                  Model Switch & Impact Projection
                </h3>
              </div>
              <button
                onClick={() => setSelectedChangeModel(null)}
                className="text-xs text-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-canvas rounded border border-line space-y-1 font-mono">
                <div className="text-muted text-[10px] uppercase font-sans">Target Engine:</div>
                <div className="font-bold text-ink text-sm font-sans">{selectedChangeModel.name}</div>
                <div className="text-slate-600 text-xs">Provider: {selectedChangeModel.provider}</div>
              </div>

              {/* Impact Delta Table */}
              <div className="p-3 bg-ai-tint/30 border border-ai/30 rounded space-y-2 font-mono text-xs">
                <div className="text-ai font-semibold font-sans uppercase tracking-wider text-[11px]">
                  Projected Monthly Delta:
                </div>
                <div className="flex justify-between text-slate-800">
                  <span>Unit Cost / Run:</span>
                  <span className="text-strand-green font-bold">-₹1.40 (-35%)</span>
                </div>
                <div className="flex justify-between text-slate-800">
                  <span>Inference Latency:</span>
                  <span className="text-strand-green font-bold">-620ms (Faster)</span>
                </div>
                <div className="flex justify-between text-slate-800">
                  <span>Extraction Accuracy:</span>
                  <span className="text-amber-800 font-semibold">97.8% (vs 98.4%)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedChangeModel(null)}
                  className="px-3 py-1.5 bg-canvas hover:bg-slate-200 border border-line text-xs font-medium text-slate rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyModelChange}
                  className="px-4 py-1.5 bg-ai hover:bg-ai/90 text-white text-xs font-semibold rounded shadow-xs"
                >
                  Apply Routing Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
