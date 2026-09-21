import React, { useState } from 'react';
import { mockAIPrompts } from '../../data/aiControl';
import { AIPromptVersion } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import {
  FileCode2,
  GitCompare,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';

export const AIPrompts: React.FC = () => {
  const [prompts, setPrompts] = useState<AIPromptVersion[]>(mockAIPrompts);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPromptVersion>(mockAIPrompts[0]);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleTestPrompt = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setTestOutput(`{\n  "part_number": "KU-SLV-001",\n  "quantity": 50000,\n  "delivery_weeks": 2,\n  "confidence": 99.1\n}`);
    }, 600);
  };

  const handleApprovePrompt = (id: string) => {
    setPrompts(prev =>
      prev.map(p => p.id === id ? { ...p, status: 'Production' } : p)
    );
    setToastMessage(`Prompt version ${selectedPrompt.currentVersion} approved and deployed to production.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-[13px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Prompt Engineering & Governance Studio"
      />

      {/* Prompts Selector Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {prompts.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedPrompt(p);
              setTestOutput(null);
            }}
            className={`px-3 py-1.5 rounded-badge text-[13px] font-semibold font-mono transition-colors flex items-center gap-2 ${
              selectedPrompt.id === p.id
                ? 'bg-ink text-white '
                : 'bg-surface text-slate-700 hover:bg-canvas border border-line'
            }`}
          >
            <span>{p.feature}</span>
            <span className="text-[12px] opacity-75">({p.currentVersion})</span>
          </button>
        ))}
      </div>

      {/* Prompt Card & Side-by-Side Diff */}
      <div className="bg-surface border border-line rounded-lg p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg text-ink">
                {selectedPrompt.feature}
              </h3>
              <span className="font-mono text-[13px] text-ai font-semibold bg-ai-tint px-2 py-0.5 rounded">
                {selectedPrompt.currentVersion}
              </span>
              <StatusPill status={selectedPrompt.status} />
            </div>
            <div className="text-[13px] text-muted font-mono mt-1">
              Engine: <strong className="text-ink">{selectedPrompt.feature}</strong> · Author: {selectedPrompt.lastEditedBy} · Modified: {selectedPrompt.lastEditedAt}
            </div>
          </div>

          {selectedPrompt.status === 'Pending Approval' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApprovePrompt(selectedPrompt.id)}
                className="px-3 py-1.5 bg-strand-green hover:bg-emerald-600 text-white rounded text-[13px] font-semibold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Approve Prompt Revision
              </button>
            </div>
          )}
        </div>

        {/* Side-by-Side Diff Viewer */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink font-mono ">
            <GitCompare className="w-4 h-4 text-kiran" />
            <span>Prompt Revision Diff (Previous vs Proposed)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] font-mono">
            {/* Previous Version */}
            <div className="bg-canvas/60 border border-line rounded p-4 space-y-2">
              <div className="text-[12px] font-semibold text-slate-600 font-sans border-b border-line pb-1">
                Previous Active Version ({selectedPrompt.previousVersionText ? 'Previous' : 'Initial'})
              </div>
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedPrompt.previousVersionText || 'No previous version available.'}
              </div>
            </div>

            {/* Current Proposed Version */}
            <div className="bg-emerald-50/30 border border-emerald-300/80 rounded p-4 space-y-2">
              <div className="text-[12px] font-semibold text-strand-green font-sans border-b border-emerald-200 pb-1 flex items-center justify-between">
                <span>Proposed New Version ({selectedPrompt.currentVersion})</span>
                <span className="text-[12px] text-emerald-800">Current draft</span>
              </div>
              <div className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedPrompt.promptText}
              </div>
            </div>
          </div>
        </div>

        {/* Live Interactive Test Bench */}
        <div className="pt-4 border-t border-line space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ai font-mono ">
              <Sparkles className="w-4 h-4 text-ai" />
              <span>Interactive Prompt Evaluation Bench</span>
            </div>
            <span className="font-mono text-[13px] text-muted">Direct Sandbox</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] font-mono">
            <div>
              <label className="block text-[12px] text-muted font-sans mb-1">
                Sample Inbound Test Payload:
              </label>
              <textarea
                rows={5}
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Paste customer RFQ email text or quotation requirements..."
                className="w-full p-2.5 bg-canvas border border-line rounded text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-ai font-mono"
              />
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleTestPrompt}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-ai hover:bg-ai/90 text-white rounded text-[13px] font-semibold flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3" />
                  Run Sandbox Test
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[12px] text-muted font-sans mb-1">
                Model Structured Response Output:
              </label>
              <div className="w-full h-36 p-2.5 bg-ink text-slate-200 rounded border border-line overflow-y-auto leading-relaxed text-[12px]">
                {testOutput ? (
                  <pre className="font-mono">{testOutput}</pre>
                ) : (
                  <span className="text-muted italic">Click 'Run Sandbox Test' to evaluate structured JSON extraction...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
