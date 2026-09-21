import React, { useState } from 'react';
import { mockThreeWayMatchRecords } from '../../data/purchase';
import { ThreeWayMatchRecord } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import { formatINR } from '../../utils/formatters';

const PILL_OK =
  'inline-flex items-center h-6 px-2 rounded-md bg-[#E7F3EB] text-[#17723F] text-[13px] font-medium';
const PILL_BAD =
  'inline-flex items-center h-6 px-2 rounded-md bg-[#FBE9E7] text-[#B3302A] text-[13px] font-medium';

export const GRNThreeWayMatch: React.FC = () => {
  const [records, setRecords] = useState<ThreeWayMatchRecord[]>(mockThreeWayMatchRecords);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleDebitNote = (grnNo: string, amount: string) => {
    setToastMessage(`Debit note DN-2026-042 (${amount}) raised.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleQueryVendor = (vendor: string) => {
    setToastMessage(`Query sent to ${vendor}.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendToAccounts = (grnNo: string) => {
    setToastMessage(`${grnNo} sent to Accounts.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover text-[14px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader title="Goods receipt" />

      <div className="space-y-6">
        {records.map((rec) => {
          const isException = rec.status === 'Exception';

          return (
            <div key={rec.id} className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-ink">{rec.vendorName}</h3>
                  <div className="text-[14px] text-slate-700">{rec.item}</div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted mt-1.5">
                    <span className="whitespace-nowrap">
                      GRN <span className="font-code text-ink">{rec.grnNumber}</span>
                    </span>
                    <span className="whitespace-nowrap">
                      PO <span className="font-code text-ink">{rec.poNumber}</span>
                    </span>
                    <span className="whitespace-nowrap">
                      Invoice <span className="font-code text-ink">{rec.invoiceNumber}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-medium text-ink tabular-nums whitespace-nowrap">
                    {formatINR(rec.totalValue)}
                  </span>
                  <StatusPill status={rec.status} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-surface-2 text-[13px] font-medium text-muted border-y border-line">
                    <tr>
                      <th className="px-4 py-3 font-medium" />
                      <th className="px-4 py-3 font-medium text-right">Ordered</th>
                      <th className="px-4 py-3 font-medium text-right">Received</th>
                      <th className="px-4 py-3 font-medium text-right">Invoiced</th>
                      <th className="px-4 py-3 font-medium">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-2">
                    <tr className="h-[52px]">
                      <td className="px-4 text-muted">Quantity</td>
                      <td className="px-4 text-right tabular-nums whitespace-nowrap">{rec.poQty.toLocaleString('en-IN')} kg</td>
                      <td className={`px-4 text-right tabular-nums whitespace-nowrap ${rec.grnQty !== rec.poQty ? 'text-strand-red font-medium' : ''}`}>
                        {rec.grnQty.toLocaleString('en-IN')} kg
                      </td>
                      <td className="px-4 text-right tabular-nums whitespace-nowrap">{rec.invoiceQty.toLocaleString('en-IN')} kg</td>
                      <td className="px-4 whitespace-nowrap">
                        {rec.poQty === rec.grnQty && rec.grnQty === rec.invoiceQty ? (
                          <span className={PILL_OK}>Match</span>
                        ) : (
                          <span className={PILL_BAD}>Mismatch</span>
                        )}
                      </td>
                    </tr>

                    <tr className="h-[52px]">
                      <td className="px-4 text-muted">Rate</td>
                      <td className="px-4 text-right tabular-nums whitespace-nowrap">₹{rec.poRate.toFixed(2)}</td>
                      <td className="px-4 text-right text-muted">–</td>
                      <td className={`px-4 text-right tabular-nums whitespace-nowrap ${rec.invoiceRate !== rec.poRate ? 'text-strand-red font-medium' : ''}`}>
                        ₹{rec.invoiceRate.toFixed(2)}
                      </td>
                      <td className="px-4 whitespace-nowrap">
                        {rec.poRate === rec.invoiceRate ? (
                          <span className={PILL_OK}>Match</span>
                        ) : (
                          <span className={PILL_BAD}>Mismatch</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {isException && rec.exceptions.map((ex, i) => (
                <div key={i} className="px-5 py-4 border-t border-line space-y-3">
                  <div>
                    <div className="text-[14px] font-medium text-strand-red">
                      {ex.type} — {ex.deltaText}
                    </div>
                    <p className="text-[14px] text-slate-700 mt-1 max-w-3xl">{ex.aiExplanation}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button onClick={() => handleQueryVendor(rec.vendorName)} className="btn-secondary">
                      Ask vendor
                    </button>
                    <button onClick={() => handleDebitNote(rec.grnNumber, '₹33,000')} className="btn-secondary">
                      Raise debit note (₹33,000)
                    </button>
                  </div>
                </div>
              ))}

              {!isException && (
                <div className="px-5 py-4 border-t border-line flex justify-end">
                  <button onClick={() => handleSendToAccounts(rec.grnNumber)} className="btn-secondary">
                    Send to Accounts
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
