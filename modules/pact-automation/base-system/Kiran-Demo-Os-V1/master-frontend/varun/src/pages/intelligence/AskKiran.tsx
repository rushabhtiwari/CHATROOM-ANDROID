import React, { useState } from 'react';
import { PageHeader } from '../../components/shell/PageHeader';
import {
  Sparkles,
  Bot,
  Send,
  ArrowRight,
  Database,
  ExternalLink,
  Table,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';

interface QnAResponse {
  id: string;
  query: string;
  answer: string;
  tableData?: { headers: string[]; rows: (string | number)[][] };
  sources: { title: string; link: string }[];
  model: string;
  latencySec: number;
  tokens: number;
  costINR: number;
}

export const AskKiran: React.FC = () => {
  const [queryInput, setQueryInput] = useState('');
  const [conversation, setConversation] = useState<QnAResponse[]>([
    {
      id: 'ans-1',
      query: "What's the status of Motherson's September schedule?",
      answer: "Motherson Sumi Systems Ltd has 1,05,000 metres pending on active order PO-MOTH-2026-881 for 6mm silicone sleeving. However, dispatches are currently BLOCKED due to an overdue debt of ₹8,42,150 beyond 60 days.",
      tableData: {
        headers: ['Order PO', 'Product Line', 'Balance Qty', 'Overdue Debt', 'Stop-Dispatch Status'],
        rows: [
          ['PO-MOTH-2026-881', 'Silicone Coated Sleeve 6mm', '105,000m', '₹8,42,150', 'LOCKED (Meera Iyer approval required)']
        ]
      },
      sources: [
        { title: 'Sales Order SO-2026-0741', link: '/orders/SO-2026-0741' },
        { title: 'Customer Ledger CUST-001', link: '/accounts/receivables' },
        { title: 'Dispatch SLD-2026-0812', link: '/dispatch/DSP-2026-0812' }
      ],
      model: 'claude-opus-5',
      latencySec: 2.8,
      tokens: 3890,
      costINR: 5.80
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const suggestedPrompts = [
    "Show me open dispatches over ₹5L",
    "What's the status of Motherson's September schedule?",
    "Which vendors are due on the Thursday payment run?",
    "Summarize last week's sales order execution rate"
  ];

  const handleAsk = (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setQueryInput('');

    setTimeout(() => {
      let mockRes: QnAResponse;

      if (query.toLowerCase().includes('dispatches over') || query.toLowerCase().includes('5l')) {
        mockRes = {
          id: `ans-${Date.now()}`,
          query,
          answer: "Found 3 dispatches exceeding ₹5,00,000 currently in pipeline across Alstom, GE Power, and Motherson.",
          tableData: {
            headers: ['Consignment', 'Customer', 'Product', 'Qty', 'Value', 'Stage'],
            rows: [
              ['SLD-2026-0809', 'Alstom Transport India', 'Class H Varnished 4mm', '60,000m', '₹12,40,000', 'ASN linked'],
              ['SLD-2026-0805', 'GE Power India Ltd', 'Braided Expandable 16mm', '45,000m', '₹10,02,857', 'Dispatched'],
              ['SLD-2026-0812', 'Motherson Sumi Systems', 'Silicone Coated 6mm', '25,000m', '₹6,73,611', 'SLD generated (Hold)']
            ]
          },
          sources: [
            { title: 'Dispatch Board', link: '/dispatch' },
            { title: 'Invoicing Ledger', link: '/reports/pending-sales-orders' }
          ],
          model: 'claude-opus-5',
          latencySec: 3.1,
          tokens: 4120,
          costINR: 6.20
        };
      } else {
        mockRes = {
          id: `ans-${Date.now()}`,
          query,
          answer: "On the Thursday payment run, 3 raw material vendors (Saint-Gobain, Dow Chemical, Reliance) reach 40 days of credit and require ₹73.50 Lakhs in disbursements to maintain MSME compliance.",
          tableData: {
            headers: ['Vendor', 'Oldest Bill Age', 'Payment Run', 'Due Amount'],
            rows: [
              ['Saint-Gobain Vetrotex', '41 Days', '20 Aug (Thursday)', '₹21,50,000'],
              ['Dow Chemical International', '42 Days', '20 Aug (Thursday)', '₹18,00,000'],
              ['Reliance Industries (PET)', '43 Days', '20 Aug (Thursday)', '₹34,00,000']
            ]
          },
          sources: [
            { title: 'Accounts Payables', link: '/accounts/payables' },
            { title: '40-Day Credit Automation AUT-006', link: '/automations' }
          ],
          model: 'claude-opus-5',
          latencySec: 2.4,
          tokens: 3450,
          costINR: 5.15
        };
      }

      setConversation(prev => [mockRes, ...prev]);
      setIsLoading(false);
    }, 900);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn pb-12">
      {/* Header */}
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ai-tint border border-ai/30 text-ai text-xs font-mono font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          KiranOS Autonomous Knowledge Assistant
        </div>
        <h1 className="font-display font-bold text-3xl text-ink">
          Ask Kiran Enterprise Assistant
        </h1>
        <p className="text-xs text-muted max-w-xl mx-auto">
          Natural-language querying across live PACT ERP ledgers, customer dispatches, BOM costing engines, and supplier payment cycles.
        </p>
      </div>

      {/* Suggested Prompts Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestedPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleAsk(p)}
            className="p-3 bg-surface hover:bg-canvas border border-line hover:border-ai/60 rounded-md shadow-card text-left transition-all text-xs flex items-center justify-between group"
          >
            <span className="font-medium text-slate-800 group-hover:text-ink">"{p}"</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-ai group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="bg-surface border border-ai/40 rounded-md p-2 shadow-popover">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(queryInput);
          }}
          className="flex items-center gap-2"
        >
          <div className="p-2 text-ai">
            <Bot className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Ask anything about orders, dispatches, receivables, costing, or stock (e.g. 'Show me open dispatches over ₹5L')..."
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="flex-1 text-sm bg-transparent focus:outline-none text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={isLoading || !queryInput.trim()}
            className="px-4 py-2 bg-ink hover:bg-ink-2 disabled:opacity-40 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-ai-tint" />
            <span>Ask</span>
          </button>
        </form>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="p-6 bg-surface border border-ai/30 rounded-md shadow-card space-y-3 animate-pulse">
          <div className="flex items-center gap-2 text-ai text-xs font-mono font-semibold">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Reasoning across 41 ERP tables via claude-opus-5...</span>
          </div>
          <div className="h-4 bg-canvas rounded w-3/4" />
          <div className="h-24 bg-canvas rounded" />
        </div>
      )}

      {/* Conversation Responses */}
      <div className="space-y-6">
        {conversation.map((c) => (
          <div
            key={c.id}
            className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-4 font-sans text-xs"
          >
            {/* User Prompt */}
            <div className="font-semibold text-sm text-ink flex items-center gap-2 border-b border-line pb-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 border border-line flex items-center justify-center font-mono text-[12px] text-slate-600">
                Q
              </span>
              <span>{c.query}</span>
            </div>

            {/* Answer Narrative */}
            <div className="text-slate-800 leading-relaxed text-sm bg-canvas/40 p-4 rounded border border-line">
              {c.answer}
            </div>

            {/* Structured Data Table (if present) */}
            {c.tableData && (
              <div className="overflow-x-auto border border-line rounded">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-canvas text-muted text-[12px] border-b border-line">
                    <tr>
                      {c.tableData.headers.map((h, i) => (
                        <th key={i} className="p-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {c.tableData.rows.map((row, rI) => (
                      <tr key={rI} className="hover:bg-canvas/50">
                        {row.map((cell, cI) => (
                          <td key={cI} className={`p-2.5 ${cI === 0 ? 'font-semibold text-ink font-sans' : 'text-slate-700'}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Source Citations */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[12px] font-mono text-muted ">
                Citations & Primary Records:
              </span>
              {c.sources.map((s, idx) => (
                <a
                  key={idx}
                  href={s.link}
                  className="px-2 py-1 bg-white hover:bg-canvas border border-line rounded text-[12px] font-mono text-kiran font-medium flex items-center gap-1 shadow-2xs"
                >
                  <span>{s.title}</span>
                  <ExternalLink className="w-3 h-3 text-muted" />
                </a>
              ))}
            </div>

            {/* Monospace Metadata Footer */}
            <div className="pt-3 border-t border-line/60 flex items-center justify-between text-[12px] font-mono text-muted">
              <span>{c.model} · {c.latencySec}s · {c.tokens.toLocaleString('en-IN')} tokens · ₹{c.costINR.toFixed(2)}</span>
              <span>KiranOS Semantic Engine</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
