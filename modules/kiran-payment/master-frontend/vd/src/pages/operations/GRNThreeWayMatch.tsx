import React, { useState } from 'react';
import { mockThreeWayMatchRecords } from '../../data/purchase';
import { ThreeWayMatchRecord } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  FileSpreadsheet,
  FileCheck2,
  Send
} from 'lucide-react';

export const GRNThreeWayMatch: React.FC = () => {
  const [records, setRecords] = useState<ThreeWayMatchRecord[]>(mockThreeWayMatchRecords);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleDebitNote = (grnNo: string, amount: string) => {
    setToastMessage(`Debit Note DN-2026-042 (${amount}) generated and posted to PACT Accounts ledger.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleQueryVendor = (vendor: string) => {
    setToastMessage(`Formal rate discrepancy query sent to ${vendor} commercial desk.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendToAccounts = (grnNo: string) => {
    setToastMessage(`GRN ${grnNo} passed 3-way match audit. Routed to Accounts for payment run.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Goods Receipt & 3-Way Reconciliation"
      />

      {/* 3-Way Match Verification Records */}
      <div className="space-y-6">
        {records.map((rec) => {
          const isException = rec.status === 'Exception';

          return (
            <div
              key={rec.id}
              className={`bg-surface border rounded-md p-5 shadow-card space-y-4 ${
                isException ? 'border-amber-300 ring-1 ring-strand-amber' : 'border-line'
              }`}
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center font-mono text-xs font-bold ${
                    isException ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    3W
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-ink">
                      {rec.vendorName} · <span className="font-mono text-slate-700">{rec.item}</span>
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted font-mono mt-0.5">
                      <span>GRN: <strong className="text-ink">{rec.grnNumber}</strong></span>
                      <span>·</span>
                      <span>PO: <strong className="text-ink">{rec.poNumber}</strong></span>
                      <span>·</span>
                      <span>Invoice: <strong className="text-ink">{rec.invoiceNumber}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-ink text-sm">
                    {formatINR(rec.totalValue)}
                  </span>
                  <StatusPill status={rec.status} />
                </div>
              </div>

              {/* 3-Way Line Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
                    <tr>
                      <th className="p-2.5 font-sans">Verification Dimension</th>
                      <th className="p-2.5 text-right">PO Approved Parameter</th>
                      <th className="p-2.5 text-right">Physical Stores GRN</th>
                      <th className="p-2.5 text-right">Vendor Tax Invoice</th>
                      <th className="p-2.5 text-center font-sans">Audit Match Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {/* Qty Row */}
                    <tr className="hover:bg-canvas/50">
                      <td className="p-2.5 font-sans font-semibold text-slate-700">Delivered Quantity</td>
                      <td className="p-2.5 text-right font-bold text-ink">{rec.poQty.toLocaleString('en-IN')} kg</td>
                      <td className={`p-2.5 text-right font-bold ${rec.grnQty !== rec.poQty ? 'text-strand-red bg-red-50' : 'text-strand-green'}`}>
                        {rec.grnQty.toLocaleString('en-IN')} kg
                      </td>
                      <td className="p-2.5 text-right text-slate-700">{rec.invoiceQty.toLocaleString('en-IN')} kg</td>
                      <td className="p-2.5 text-center">
                        {rec.poQty === rec.grnQty && rec.grnQty === rec.invoiceQty ? (
                          <span className="text-strand-green font-semibold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Exact Match
                          </span>
                        ) : (
                          <span className="text-strand-red font-semibold flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Qty Variance
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Rate Row */}
                    <tr className="hover:bg-canvas/50">
                      <td className="p-2.5 font-sans font-semibold text-slate-700">Unit Billing Rate</td>
                      <td className="p-2.5 text-right font-bold text-ink">₹{rec.poRate.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-slate-600">N/A (Stores)</td>
                      <td className={`p-2.5 text-right font-bold ${rec.invoiceRate !== rec.poRate ? 'text-strand-red bg-red-50' : 'text-strand-green'}`}>
                        ₹{rec.invoiceRate.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        {rec.poRate === rec.invoiceRate ? (
                          <span className="text-strand-green font-semibold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Rate Verified
                          </span>
                        ) : (
                          <span className="text-strand-red font-semibold flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Price Variance
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Exception & AI Reasoning Block */}
              {isException && rec.exceptions.map((ex, i) => (
                <div key={i} className="p-3.5 bg-ai-tint/30 border border-ai/30 rounded space-y-2 text-xs">
                  <div className="flex items-center justify-between text-strand-red font-semibold font-mono">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-strand-amber" />
                      Exception: {ex.type} — {ex.deltaText}
                    </span>
                    <span className="text-[10px] text-ai font-mono uppercase">claude-opus-5 analysis</span>
                  </div>

                  <p className="text-slate-800 font-sans leading-relaxed bg-white p-2.5 rounded border border-ai/20">
                    {ex.aiExplanation}
                  </p>

                  <div className="pt-2 border-t border-ai/20 flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => handleQueryVendor(rec.vendorName)}
                      className="px-3 py-1 bg-white hover:bg-canvas border border-line rounded text-xs font-semibold text-slate-700 shadow-2xs"
                    >
                      Query Vendor Accounts Desk
                    </button>
                    <button
                      onClick={() => handleDebitNote(rec.grnNumber, '₹33,000')}
                      className="px-3 py-1 bg-strand-red hover:bg-red-700 text-white rounded text-xs font-semibold shadow-xs"
                    >
                      Raise Debit Note (₹33,000)
                    </button>
                  </div>
                </div>
              ))}

              {/* Matched Pass Action */}
              {!isException && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded flex items-center justify-between text-xs">
                  <span className="text-emerald-950 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-strand-green" />
                    All parameters match. Ready for Accounts GL posting and payment batch inclusion.
                  </span>
                  <button
                    onClick={() => handleSendToAccounts(rec.grnNumber)}
                    className="px-3 py-1 bg-strand-green hover:bg-emerald-600 text-white rounded font-semibold shadow-xs"
                  >
                    Pass to Accounts Ledger
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
