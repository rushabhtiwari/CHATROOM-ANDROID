import React, { useState } from 'react';
import { mockBankStatementLines, mockBookEntries } from '../../data/accounts';
import { BankStatementLine, BookEntry } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';
import {
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  PlusCircle
} from 'lucide-react';

export const BankReconciliation: React.FC = () => {
  const [bankLines, setBankLines] = useState<BankStatementLine[]>(mockBankStatementLines);
  const [bookLines, setBookLines] = useState<BookEntry[]>(mockBookEntries);
  const [isReconciling, setIsReconciling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRunReconciliation = () => {
    setIsReconciling(true);
    setTimeout(() => {
      setIsReconciling(false);
      showToast('Reconciliation completed. Matched 2 additional entries via UTR reference.');
    }, 800);
  };

  const handleAcceptSuggestion = (lineId: string, suggestion: string) => {
    showToast(`Accepted AI suggestion "${suggestion}". Auto-drafted journal voucher.`);
    setBankLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, isMatched: true } : l))
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover border border-primary flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        category="TREASURY & GENERAL LEDGER"
        title="Daily Bank-vs-Books Difference Report"
        description="Automated dual-ledger matching between host-to-host bank statement lines and PACT ERP journal vouchers."
        actions={
          <button
            onClick={handleRunReconciliation}
            disabled={isReconciling}
            className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            <span>Run Reconciliation</span>
          </button>
        }
      />

      {/* Discrepancy Status Banner */}
      <div className="p-4 bg-amber-50/80 border border-amber-300/70 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-strand-amber/20 border border-strand-amber/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-strand-amber" />
          </div>
          <div>
            <div className="font-semibold text-sm text-amber-950 font-sans">
              ₹2,14,380 unexplained across 11 entries
            </div>
            <p className="text-xs text-amber-800 mt-0.5 font-sans">
              AI has analyzed 3 unposted entries with matching suggested debit/credit accounts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-md bg-white border border-amber-200 text-amber-900 shadow-2xs">
            Auto-Match Rate: <strong className="tabular-nums">89.4%</strong>
          </span>
        </div>
      </div>

      {/* Synchronized Dual Comparison Tables: Bank Statement Lines vs Book Entries */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left Column (6 cols): HDFC Bank Host-to-Host Feed */}
        <div className="col-span-12 xl:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xs flex flex-col">
          <div className="p-3 px-4 bg-surface-container-low/50 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-xs text-on-surface font-mono ">
                HDFC Bank Host-to-Host Feed
              </h3>
              <span className="font-mono text-[12px] text-outline">A/C: 50200012984511 (Secunderabad)</span>
            </div>
            <span className="font-mono text-xs font-semibold text-strand-green bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 tabular-nums">
              Balance: ₹4,82,40,000
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="font-mono text-outline text-[12px] bg-surface-container-low border-b border-outline-variant sticky top-0 z-10 select-none">
                <tr>
                  <th className="px-3 py-2 w-24">Date</th>
                  <th className="px-3 py-2">Description / Ref</th>
                  <th className="px-3 py-2 text-right w-28">Amount</th>
                  <th className="px-3 py-2 text-center w-28">Status</th>
                  <th className="px-3 py-2 text-right w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                {bankLines.map((line) => (
                  <tr
                    key={line.id}
                    className={`h-9 border-b border-outline-variant hover:bg-surface-container-low/70 transition-colors ${
                      !line.isMatched ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-[12px] text-outline whitespace-nowrap">
                      {line.date}
                    </td>
                    <td className="px-3 py-1.5 min-w-[150px] max-w-[220px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-medium text-on-surface text-xs truncate" title={line.description}>
                          {line.description}
                        </span>
                        <span className="font-mono text-[12px] text-outline shrink-0">
                          · {line.referenceNo}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                      {line.credit ? (
                        <span className="font-bold text-strand-green">+{formatINR(line.credit)}</span>
                      ) : (
                        <span className="font-bold text-strand-red">-{formatINR(line.debit || 0)}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                      {line.isMatched ? (
                        <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[12px] font-medium font-mono leading-none border border-emerald-200 bg-emerald-50 text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-st-green-ink shrink-0" />
                          MATCHED
                        </span>
                      ) : (
                        <span
                          title={line.aiSuggestedReason}
                          className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[12px] font-medium font-mono leading-none border border-amber-300 bg-amber-50 text-amber-900 animate-pulse"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-strand-amber shrink-0" />
                          UNMATCHED
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {!line.isMatched ? (
                        <button
                          onClick={() => handleAcceptSuggestion(line.id, line.aiSuggestedReason || 'Auto match')}
                          className="inline-flex items-center gap-1 h-6.5 px-2 py-0.5 rounded text-[12px] font-mono font-semibold bg-primary text-white hover:bg-primary/90 transition-colors shadow-2xs"
                          title={line.aiSuggestedReason ? `Accept AI: ${line.aiSuggestedReason}` : 'Auto-Match'}
                        >
                          <Sparkles className="w-3 h-3" />
                          Auto-Match
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[12px] text-outline">
                          <CheckCircle2 className="w-3 h-3 text-strand-green" />
                          Linked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (6 cols): PACT ERP General Ledger */}
        <div className="col-span-12 xl:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xs flex flex-col">
          <div className="p-3 px-4 bg-surface-container-low/50 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-xs text-on-surface font-mono ">
                PACT ERP General Ledger
              </h3>
              <span className="font-mono text-[12px] text-outline">General Ledger: Bank Receipts</span>
            </div>
            <button
              onClick={() => showToast('Opened journal voucher creation modal.')}
              className="px-2.5 py-1 bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant text-xs font-semibold text-on-surface rounded-lg flex items-center gap-1 shadow-2xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Journal</span>
            </button>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="font-mono text-outline text-[12px] bg-surface-container-low border-b border-outline-variant sticky top-0 z-10 select-none">
                <tr>
                  <th className="px-3 py-2 w-24">Date</th>
                  <th className="px-3 py-2 w-32">Voucher No</th>
                  <th className="px-3 py-2">Particulars</th>
                  <th className="px-3 py-2 text-right w-28">Amount</th>
                  <th className="px-3 py-2 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookLines.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`h-9 border-b border-outline-variant hover:bg-surface-container-low/70 transition-colors ${
                      !entry.isMatched ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-[12px] text-outline whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs font-medium text-on-surface whitespace-nowrap">
                      {entry.voucherNo}
                    </td>
                    <td className="px-3 py-1.5 min-w-[140px] max-w-[200px]">
                      <div className="truncate font-medium text-on-surface text-xs" title={entry.particulars}>
                        {entry.particulars}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                      {entry.credit ? (
                        <span className="font-bold text-strand-green">+{formatINR(entry.credit)}</span>
                      ) : (
                        <span className="font-bold text-strand-red">-{formatINR(entry.debit || 0)}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                      {entry.isMatched ? (
                        <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[12px] font-medium font-mono leading-none border border-emerald-200 bg-emerald-50 text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-st-green-ink shrink-0" />
                          MATCHED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[12px] font-medium font-mono leading-none border border-amber-200 bg-amber-50 text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-strand-amber shrink-0" />
                          AWAITING
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

