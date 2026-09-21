import React, { useState } from 'react';
import { mockBankStatementLines, mockBookEntries } from '../../data/accounts';
import { BankStatementLine, BookEntry } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';
import { RefreshCw } from 'lucide-react';

const PILL_OK = 'inline-flex items-center rounded-badge bg-[#E7F3EB] px-2 py-0.5 text-[12px] font-medium text-[#17723F] whitespace-nowrap';
const PILL_WARN = 'inline-flex items-center rounded-badge bg-[#FBEFDC] px-2 py-0.5 text-[12px] font-medium text-[#8A4F00] whitespace-nowrap';

export const BankReconciliation: React.FC = () => {
  const [bankLines, setBankLines] = useState<BankStatementLine[]>(mockBankStatementLines);
  const [bookLines] = useState<BookEntry[]>(mockBookEntries);
  const [isReconciling, setIsReconciling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRunReconciliation = () => {
    setIsReconciling(true);
    setTimeout(() => {
      setIsReconciling(false);
      setToastMessage('Done. 2 more entries matched.');
      setTimeout(() => setToastMessage(null), 3500);
    }, 800);
  };

  const handleAcceptSuggestion = (lineId: string, suggestion: string) => {
    setToastMessage(`Matched as "${suggestion}".`);
    setBankLines(prev =>
      prev.map(l => l.id === lineId ? { ...l, isMatched: true } : l)
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover text-[13px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader
        title="Bank reconciliation"
        actions={
          <button
            onClick={handleRunReconciliation}
            disabled={isReconciling}
            className="btn-primary"
          >
            <RefreshCw className={`w-4 h-4 ${isReconciling ? 'animate-spin' : ''}`} />
            Reconcile
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi">
          <div className="kpi-label">Unexplained</div>
          <div className="kpi-value text-strand-red">₹2,14,380</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Unmatched entries</div>
          <div className="kpi-value">11</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Matched</div>
          <div className="kpi-value">89.4%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Bank balance</div>
          <div className="kpi-value">₹4,82,40,000</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Bank statement */}
        <div className="col-span-12 lg:col-span-6 panel">
          <div className="panel-header">
            <h3 className="text-[16px] font-semibold text-ink">Bank statement</h3>
            <span className="text-[13px] text-muted whitespace-nowrap">
              HDFC · <span className="font-code">50200012984511</span>
            </span>
          </div>

          <div className="divide-y divide-line-2">
            {bankLines.map((line) => (
              <div key={line.id} className="px-5 py-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-ink">{line.description}</div>
                    <div className="text-[13px] text-muted">
                      {line.date} · <span className="font-code">{line.referenceNo}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    {line.credit && <div className="text-[14px] tabular-nums whitespace-nowrap text-ink">+{formatINR(line.credit)}</div>}
                    {line.debit && <div className="text-[14px] tabular-nums whitespace-nowrap text-ink">-{formatINR(line.debit)}</div>}
                    <span className={line.isMatched ? PILL_OK : PILL_WARN}>
                      {line.isMatched ? 'Matched' : 'Unmatched'}
                    </span>
                  </div>
                </div>

                {!line.isMatched && line.aiSuggestedReason && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] text-muted">
                      Suggested: <span className="text-ink">{line.aiSuggestedReason}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptSuggestion(line.id, line.aiSuggestedReason!)}
                        className="btn-secondary"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => setToastMessage('Opened manual voucher matcher.')}
                        className="btn-secondary"
                      >
                        Match manually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Books */}
        <div className="col-span-12 lg:col-span-6 panel">
          <div className="panel-header">
            <h3 className="text-[16px] font-semibold text-ink">Books</h3>
            <button
              onClick={() => setToastMessage('Opened journal voucher creation modal.')}
              className="btn-secondary"
            >
              New journal
            </button>
          </div>

          <div className="divide-y divide-line-2">
            {bookLines.map((entry) => (
              <div key={entry.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-ink">{entry.particulars}</div>
                    <div className="text-[13px] text-muted">
                      {entry.date} · <span className="font-code">{entry.voucherNo}</span> · {entry.account}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    {entry.credit && <div className="text-[14px] tabular-nums whitespace-nowrap text-ink">+{formatINR(entry.credit)}</div>}
                    {entry.debit && <div className="text-[14px] tabular-nums whitespace-nowrap text-ink">-{formatINR(entry.debit)}</div>}
                    <span className={entry.isMatched ? PILL_OK : PILL_WARN}>
                      {entry.isMatched ? 'Matched' : 'Unmatched'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
