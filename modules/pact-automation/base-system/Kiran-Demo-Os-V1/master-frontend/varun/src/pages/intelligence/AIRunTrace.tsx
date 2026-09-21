import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockAIRunLogs } from '../../data/aiControl';
import { AIRunLog } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  ArrowLeft,
  Activity,
  Play,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Terminal,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  Cpu
} from 'lucide-react';

export const AIRunTrace: React.FC = () => {
  const { runId } = useParams();
  const run = mockAIRunLogs.find(r => r.id === runId) || mockAIRunLogs[0];

  const [replayModel, setReplayModel] = useState<string>('claude-haiku-4-5');
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayResult, setReplayResult] = useState<{
    latencyMs: number;
    tokens: number;
    costINR: number;
    confidence: number;
  } | null>(null);

  const handleReplay = () => {
    setIsReplaying(true);
    setTimeout(() => {
      setIsReplaying(false);
      setReplayResult({
        latencyMs: 780,
        tokens: 3120,
        costINR: 1.15,
        confidence: 96
      });
    }, 700);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          to="/ai/runs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-ai"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Run Logs</span>
        </Link>
        <span className="font-mono text-xs text-muted">
          Executed: {run.timestamp}
        </span>
      </div>

      {/* Main Header Summary */}
      <div className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-xs text-ai bg-ai-tint px-2 py-0.5 rounded border border-ai/30">
                {run.id}
              </span>
              <h1 className="font-display font-semibold text-2xl text-ink">
                {run.feature}
              </h1>
            </div>
            <div className="text-xs text-muted font-mono mt-1">
              Linked Record: <strong className="text-ink">{run.runId}</strong> · User Context: {run.trigger}
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-right">
            <div>
              <div className="text-[12px] text-muted font-sans">Model Engine</div>
              <div className="text-base font-bold text-ai">{run.model}</div>
            </div>
            <div className="pl-4 border-l border-line">
              <div className="text-[12px] text-muted font-sans">Latency / Cost</div>
              <div className="text-base font-bold text-ink">{run.durationSec}s · ₹{run.costINR.toFixed(2)}</div>
            </div>
            <div className="pl-4 border-l border-line">
              <ConfidenceChip confidence={run.confidencePct} />
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Execution Trace Flow */}
      <div className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-6">
        <h3 className="font-display font-semibold text-sm text-ink font-mono border-b border-line pb-3">
          Step-by-Step Execution Trace Graph
        </h3>

        <div className="space-y-4 font-mono text-xs">
          {/* Step 1: Trigger */}
          <div className="p-4 bg-canvas rounded border border-line space-y-1.5">
            <div className="flex items-center justify-between text-slate-600 text-[12px]">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-strand-green" />
                1. System Event Trigger
              </span>
              <span>Latency: 12ms</span>
            </div>
            <p className="text-slate-800 font-sans">
              Inbound IMAP email received from Vivek Sharma (Motherson) with subject "RFQ for 6mm silicone sleeving".
            </p>
          </div>

          {/* Step 2: Retrieval */}
          <div className="p-4 bg-canvas rounded border border-line space-y-1.5">
            <div className="flex items-center justify-between text-slate-600 text-[12px]">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-kiran" />
                2. Semantic Context Retrieval
              </span>
              <span>Latency: 145ms</span>
            </div>
            <p className="text-slate-800 font-sans">
              Matched customer entity <strong>Motherson Sumi Systems Ltd (CUST-001)</strong> with credit ledger and product catalog entry <strong>KU-SLV-001 (Silicone Coated Sleeving)</strong>.
            </p>
          </div>

          {/* Step 3: Prompt Assembly */}
          <div className="p-4 bg-canvas rounded border border-line space-y-1.5">
            <div className="flex items-center justify-between text-slate-600 text-[12px]">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-ai" />
                3. Prompt Assembly & Schema Definition
              </span>
              <span>Prompt Version: v2.4 (Active)</span>
            </div>
            <div className="bg-ink text-slate-200 p-3 rounded text-[12px] overflow-x-auto leading-relaxed">
              <code>System: You are KiranOS Autonomous Commercial Extractor. Extract part_number, quantity, required_spec, delivery_deadline from Indian manufacturing RFQs...</code>
            </div>
          </div>

          {/* Step 4: Model Inference */}
          <div className="p-4 bg-ai-tint/20 border border-ai/40 rounded space-y-1.5">
            <div className="flex items-center justify-between text-ai text-[12px]">
              <span className="font-bold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                4. LLM Model Inference ({run.model})
              </span>
              <span>{run.durationSec}s · {run.tokensUsed} tokens · ₹{run.costINR.toFixed(2)}</span>
            </div>
            <div className="bg-white p-3 rounded border border-ai/20 text-slate-800 font-mono text-[12px] leading-relaxed">
              <code>
                &#123;
                  "customer_name": "Motherson Sumi Systems Ltd",
                  "part_number": "KU-SLV-001",
                  "quantity": 120000,
                  "uom": "Metres",
                  "delivery_deadline": "2026-09-15",
                  "confidence": 98.4
                &#125;
              </code>
            </div>
          </div>

          {/* Step 5: Guardrails & Human Action */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded space-y-1.5">
            <div className="flex items-center justify-between text-strand-green text-[12px]">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                5. Guardrail Verification & Human Acceptance
              </span>
              <span>Confidence Pass: 98% &ge; 90% Gate</span>
            </div>
            <p className="text-slate-800 font-sans text-xs">
              All 6 enterprise guardrail policies passed. Ticket created as <strong>RFQ-2026-0418</strong> and verified by Priya Nair without edits.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Replay Test Bench */}
      <div className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-ai" />
            <h3 className="font-display font-semibold text-sm text-ink">
              Interactive Model Replay & Unit Economics Simulation
            </h3>
          </div>
          <span className="font-mono text-xs text-muted">Test Bench Simulator</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted">Select Engine:</span>
            <select
              value={replayModel}
              onChange={(e) => setReplayModel(e.target.value)}
              className="p-1.5 bg-canvas border border-line rounded font-mono text-xs text-ink focus:outline-none"
            >
              <option value="claude-haiku-4-5">claude-haiku-4-5 (Ultra-Fast)</option>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6 (Balanced)</option>
              <option value="claude-opus-5">claude-opus-5 (Deep Reasoning)</option>
            </select>
          </div>

          <button
            onClick={handleReplay}
            disabled={isReplaying}
            className="px-4 py-1.5 bg-ai hover:bg-ai/90 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReplaying ? 'animate-spin' : ''}`} />
            <span>Replay Extraction Trace</span>
          </button>
        </div>

        {/* Simulation Output Comparison */}
        {replayResult && (
          <div className="p-4 bg-canvas rounded border border-line grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono text-xs animate-fadeIn">
            <div className="p-2.5 bg-white rounded border border-line">
              <div className="text-[12px] text-muted font-sans">Simulated Latency</div>
              <div className="text-sm font-bold text-strand-green mt-0.5">{replayResult.latencyMs}ms</div>
              <div className="text-[12px] text-strand-green font-sans">-1,340ms faster</div>
            </div>
            <div className="p-2.5 bg-white rounded border border-line">
              <div className="text-[12px] text-muted font-sans">Simulated Cost</div>
              <div className="text-sm font-bold text-strand-green mt-0.5">₹{replayResult.costINR.toFixed(2)}</div>
              <div className="text-[12px] text-strand-green font-sans">-72% cheaper</div>
            </div>
            <div className="p-2.5 bg-white rounded border border-line">
              <div className="text-[12px] text-muted font-sans">Confidence Score</div>
              <div className="text-sm font-bold text-strand-green mt-0.5">{replayResult.confidence}%</div>
              <div className="text-[12px] text-muted font-sans">High confidence match</div>
            </div>
            <div className="p-2.5 bg-white rounded border border-line flex flex-col justify-center">
              <span className="text-[12px] font-sans font-semibold text-ai">
                Feasible candidate for production route switch.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
