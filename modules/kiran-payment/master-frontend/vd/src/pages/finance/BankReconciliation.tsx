import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockBankStatementLines, mockBookEntries } from '../../data/accounts';
import { BankStatementLine, BookEntry } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  Calculator,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  FileCheck2,
  ExternalLink
} from 'lucide-react';

export const BankReconciliation: React.FC = () => {
  const [bankLines, setBankLines] = useState<BankStatementLine[]>(mockBankStatementLines);
  const [bookLines, setBookLines] = useState<BookEntry[]>(mockBookEntries);
  const [isReconciling, setIsReconciling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRunReconciliation = () => {
    setIsReconciling(true);
    setTimeout(() => {
      setIsReconciling(false);
      setToastMessage('Reconciliation completed. Matched 2 additional entries via UTR reference.');
      setTimeout(() => setToastMessage(null), 3500);
    }, 800);
  };

  const handleAcceptSuggestion = (lineId: string, suggestion: string) => {
    setToastMessage(`Accepted AI suggestion "${suggestion}". Auto-drafted journal voucher.`);
    setBankLines(prev =>
      prev.map(l => l.id === lineId ? { ...l, isMatched: true } : l)
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Daily Bank-vs-Books Difference Report"
        actions={
          <button
            onClick={handleRunReconciliation}
            disabled={isReconciling}
            className="px-4 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            Run Reconciliation
          </button>
        }
      />

      {/* Discrepancy Status Banner */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-strand-amber/20 border border-strand-amber/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-strand-amber" />
          </div>
          <div>
            <div className="font-display font-semibold text-sm text-amber-950">
              ₹2,14,380 unexplained across 11 entries
            </div>
            <p className="text-xs text-amber-800 mt-0.5">
              AI has analyzed 3 unposted entries with matching suggested debit/credit accounts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded bg-white border border-amber-200 text-amber-900">
            Auto-Match Rate: <strong>89.4%</strong>
          </span>
        </div>
      </div>

      {/* Synchronized Columns: Bank Statement Lines vs Book Entries */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Column (6 cols): Bank Statement Feed */}
        <div className="col-span-12 lg:col-span-6 bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-display font-semibold text-sm text-ink">
                HDFC Bank Host-to-Host Statement
              </h3>
              <span className="font-mono text-[10px] text-muted">A/C: 50200012984511 (Secunderabad)</span>
            </div>
            <span className="font-mono text-xs font-semibold text-strand-green">
              Balance: ₹4,82,40,000
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {bankLines.map((line) => (
              <div
                key={line.id}
                className={`p-3 rounded border transition-colors space-y-2 ${
                  line.isMatched
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-amber-50/40 border-amber-300 ring-1 ring-strand-amber'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-ink font-sans">{line.description}</div>
                    <div className="text-[10px] text-muted">{line.date} · Ref: {line.referenceNo}</div>
                  </div>
                  <div className="text-right">
                    {line.credit && <div className="font-bold text-strand-green">+{formatINR(line.credit)}</div>}
                    {line.debit && <div className="font-bold text-strand-red">-{formatINR(line.debit)}</div>}
                  </div>
                </div>

                {/* AI Reason Suggestion & Action (if unmatched) */}
                {!line.isMatched && line.aiSuggestedReason && (
                  <div className="p-2 bg-white rounded border border-ai/30 text-[11px] font-sans space-y-1.5">
                    <div className="flex items-center justify-between text-ai font-semibold">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Discrepancy Reason:
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-ai-tint text-ai text-[10px] font-mono">
                        {line.aiSuggestedReason}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => handleAcceptSuggestion(line.id, line.aiSuggestedReason!)}
                        className="px-2 py-0.5 bg-ai text-white rounded text-[10px] font-semibold hover:bg-ai/90 shadow-2xs"
                      >
                        Accept Suggestion
                      </button>
                      <button
                        onClick={() => setToastMessage('Opened manual voucher matcher.')}
                        className="px-2 py-0.5 bg-canvas border border-line rounded text-[10px] font-medium text-slate-700"
                      >
                        Match Manually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (6 cols): PACT Book Ledger Entries */}
        <div className="col-span-12 lg:col-span-6 bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-display font-semibold text-sm text-ink">
                PACT ERP Journal & Receipt Book
              </h3>
              <span className="font-mono text-[10px] text-muted">General Ledger: Bank Receipts</span>
            </div>
            <button
              onClick={() => setToastMessage('Opened journal voucher creation modal.')}
              className="px-2.5 py-1 bg-white hover:bg-canvas border border-line text-xs font-semibold text-slate-800 rounded flex items-center gap-1 shadow-2xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create Journal
            </button>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {bookLines.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded border transition-colors space-y-1 ${
                  entry.isMatched
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-white border-line'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-ink font-sans">{entry.particulars}</div>
                    <div className="text-[10px] text-muted">{entry.date} · Voucher: {entry.voucherNo}</div>
                  </div>
                  <div className="text-right">
                    {entry.credit && <div className="font-bold text-strand-green">+{formatINR(entry.credit)}</div>}
                    {entry.debit && <div className="font-bold text-strand-red">-{formatINR(entry.debit)}</div>}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[10px] text-muted">
                  <span>Account: {entry.account}</span>
                  <span className={entry.isMatched ? 'text-strand-green font-semibold' : 'text-strand-amber font-semibold'}>
                    {entry.isMatched ? 'Matched to MT940' : 'Awaiting Bank Match'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
