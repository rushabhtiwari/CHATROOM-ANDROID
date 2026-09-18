import React, { useState, useMemo } from 'react';
import { mockThreeWayMatchRecords } from '../../data/purchase';
import { ThreeWayMatchRecord } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import {
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  FileSpreadsheet,
  FileCheck2,
  Send,
  Search,
  Filter
} from 'lucide-react';

/**
 * Genuine dynamic variance calculation evaluating debit note amount directly from record fields:
 * - Quantity shortfall variance: Math.max(0, rec.poQty - deliveredQty) * rec.poRate
 * - Rate surcharge variance: Math.max(0, rec.invoiceRate - rec.poRate) * deliveredQty
 * - Total debit note = quantity shortfall variance + rate surcharge variance
 * - Format dynamically: `₹${Math.round(totalVariance).toLocaleString('en-IN')}`
 */
export const calculateDebitNoteAmount = (rec: {
  poQty: number;
  deliveredQty?: number;
  grnQty?: number;
  poRate: number;
  invoiceRate: number;
}): string => {
  const deliveredQty = rec.deliveredQty !== undefined ? rec.deliveredQty : (rec.grnQty ?? 0);
  const quantityShortfallVariance = Math.max(0, rec.poQty - deliveredQty) * rec.poRate;
  const rateSurchargeVariance = Math.max(0, rec.invoiceRate - rec.poRate) * deliveredQty;
  const totalVariance = quantityShortfallVariance + rateSurchargeVariance;
  return `₹${Math.round(totalVariance).toLocaleString('en-IN')}`;
};

export const getDebitNoteAmount = calculateDebitNoteAmount;

export const GRNThreeWayMatch: React.FC = () => {
  const [records, setRecords] = useState<ThreeWayMatchRecord[]>(mockThreeWayMatchRecords);
  const [activeFilter, setActiveFilter] = useState<'all' | 'exceptions' | 'matched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDebitNote = (grnNo: string, amount: string) => {
    showToast(`Debit Note DN-2026-042 (${amount}) generated and posted to PACT Accounts ledger for ${grnNo}.`);
  };

  const handleQueryVendor = (vendor: string) => {
    showToast(`Formal rate discrepancy query sent to ${vendor} commercial desk.`);
  };

  const handleSendToAccounts = (grnNo: string) => {
    showToast(`GRN ${grnNo} passed 3-way match audit. Routed to Accounts for payment run.`);
  };

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (activeFilter === 'exceptions' && rec.status !== 'Exception') return false;
      if (activeFilter === 'matched' && rec.status !== 'Matched') return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          rec.vendorName.toLowerCase().includes(query) ||
          rec.item.toLowerCase().includes(query) ||
          rec.grnNumber.toLowerCase().includes(query) ||
          rec.poNumber.toLowerCase().includes(query) ||
          rec.invoiceNumber.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [records, activeFilter, searchQuery]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover border border-primary flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        category="INSPECTION & RECONCILIATION"
        title="Goods Receipt & 3-Way Reconciliation"
        description="Automated 3-way audit matching across PO approved parameters, physical stores GRN, and vendor tax invoices."
      />

      {/* Operational Summary 3-Across KPI Strip */}
      <div className="ku-ledger border-t-3 border-t-structure grid-cols-1 sm:grid-cols-3">
        <div className="bg-white rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="font-mono uppercase text-[10px] tracking-wider text-outline font-semibold">
              Total Audited Value
            </span>
            <div className="mt-1 font-mono text-xl font-bold text-on-surface tabular-nums">
              {formatINR(1338400)}
            </div>
            <span className="text-[11px] font-mono text-outline">Across 3 GRN batches</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
            <PackageCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="font-mono uppercase text-[10px] tracking-wider text-strand-green font-semibold">
              Clean Audit Reconciled
            </span>
            <div className="mt-1 font-mono text-xl font-bold text-strand-green tabular-nums">
              1 GRN (₹4.20 L)
            </div>
            <span className="text-[11px] font-mono text-outline">Reliance Industries · Matched</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-strand-green">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="font-mono uppercase text-[10px] tracking-wider text-strand-red font-semibold">
              Exceptions Flagged
            </span>
            <div className="mt-1 font-mono text-xl font-bold text-strand-red tabular-nums">
              2 GRNs (₹41,400)
            </div>
            <span className="text-[11px] font-mono text-outline">Debit recovery recommended</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-strand-red">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar Strip */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-2xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            All Audits ({records.length})
          </button>
          <button
            onClick={() => setActiveFilter('exceptions')}
            className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
              activeFilter === 'exceptions'
                ? 'bg-surface-container-lowest text-strand-red font-semibold shadow-2xs'
                : 'text-on-surface-variant hover:text-strand-red'
            }`}
          >
            Exceptions ({records.filter((r) => r.status === 'Exception').length})
          </button>
          <button
            onClick={() => setActiveFilter('matched')}
            className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
              activeFilter === 'matched'
                ? 'bg-surface-container-lowest text-strand-green font-semibold shadow-2xs'
                : 'text-on-surface-variant hover:text-strand-green'
            }`}
          >
            Matched ({records.filter((r) => r.status === 'Matched').length})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search GRN, PO, vendor, material..."
            className="w-full pl-8 pr-3 py-1 bg-surface-container-low text-on-surface border border-outline-variant rounded-lg text-xs font-mono focus:outline-none focus:border-primary placeholder:text-outline"
          />
        </div>
      </div>

      {/* 3-Way Match Verification Records */}
      <div className="space-y-4">
        {filteredRecords.map((rec) => {
          const isException = rec.status === 'Exception';
          const debitAmount = getDebitNoteAmount(rec);

          return (
            <div
              key={rec.id}
              className={`bg-surface-container-lowest border rounded-xl p-4 shadow-xs space-y-3.5 ${
                isException ? 'border-amber-400/60 ring-1 ring-strand-amber/40' : 'border-outline-variant'
              }`}
            >
              {/* Record Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                      isException
                        ? 'bg-strand-amber/15 text-strand-amber border border-strand-amber/30'
                        : 'bg-emerald-500/15 text-strand-green border border-emerald-500/30'
                    }`}
                  >
                    3W
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-on-surface font-mono">
                      {rec.vendorName} · <span className="text-on-surface-variant">{rec.item}</span>
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-outline font-mono mt-0.5">
                      <span>GRN: <strong className="text-on-surface">{rec.grnNumber}</strong></span>
                      <span>·</span>
                      <span>PO: <strong className="text-on-surface">{rec.poNumber}</strong></span>
                      <span>·</span>
                      <span>Invoice: <strong className="text-on-surface">{rec.invoiceNumber}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-on-surface text-xs tabular-nums">
                    {formatINR(rec.totalValue)}
                  </span>
                  <StatusPill status={rec.status} />
                </div>
              </div>

              {/* 3-Way Line Comparison Table (36px Fixed Row Height) */}
              <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase tracking-wider text-outline font-mono select-none">
                    <tr className="h-9">
                      <th className="px-3.5 py-0 align-middle font-semibold text-left">VERIFICATION DIMENSION</th>
                      <th className="px-3.5 py-0 align-middle font-semibold text-right">PO APPROVED PARAMETER</th>
                      <th className="px-3.5 py-0 align-middle font-semibold text-right">PHYSICAL STORES GRN</th>
                      <th className="px-3.5 py-0 align-middle font-semibold text-right">VENDOR TAX INVOICE</th>
                      <th className="px-3.5 py-0 align-middle font-semibold text-center">AUDIT MATCH STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {/* Quantity Row */}
                    <tr className="h-9 hover:bg-surface-container-low/70 transition-colors">
                      <td className="px-3.5 py-0 align-middle font-semibold text-on-surface">
                        Delivered Quantity
                      </td>
                      <td className="px-3.5 py-0 align-middle text-right font-bold text-on-surface tabular-nums">
                        {rec.poQty.toLocaleString('en-IN')} {rec.item.includes('Drums') ? 'drums' : 'kg'}
                      </td>
                      <td
                        className={`px-3.5 py-0 align-middle text-right font-bold tabular-nums ${
                          rec.grnQty !== rec.poQty ? 'text-strand-red bg-red-500/10' : 'text-strand-green'
                        }`}
                      >
                        {rec.grnQty.toLocaleString('en-IN')} {rec.item.includes('Drums') ? 'drums' : 'kg'}
                      </td>
                      <td className="px-3.5 py-0 align-middle text-right text-on-surface-variant tabular-nums">
                        {rec.invoiceQty.toLocaleString('en-IN')} {rec.item.includes('Drums') ? 'drums' : 'kg'}
                      </td>
                      <td className="px-3.5 py-0 align-middle text-center whitespace-nowrap">
                        {rec.poQty === rec.grnQty && rec.grnQty === rec.invoiceQty ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-strand-green" /> Exact Match
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-strand-red" /> Qty Short ({rec.poQty - rec.grnQty} {rec.item.includes('Drums') ? 'drums' : 'kg'})
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Unit Rate Row */}
                    <tr className="h-9 hover:bg-surface-container-low/70 transition-colors">
                      <td className="px-3.5 py-0 align-middle font-semibold text-on-surface">
                        Unit Billing Rate
                      </td>
                      <td className="px-3.5 py-0 align-middle text-right font-bold text-on-surface tabular-nums">
                        ₹{rec.poRate.toFixed(2)}
                      </td>
                      <td className="px-3.5 py-0 align-middle text-right text-outline tabular-nums">
                        N/A (Stores)
                      </td>
                      <td
                        className={`px-3.5 py-0 align-middle text-right font-bold tabular-nums ${
                          rec.invoiceRate !== rec.poRate ? 'text-strand-red bg-red-500/10' : 'text-strand-green'
                        }`}
                      >
                        ₹{rec.invoiceRate.toFixed(2)}
                      </td>
                      <td className="px-3.5 py-0 align-middle text-center whitespace-nowrap">
                        {rec.poRate === rec.invoiceRate ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-strand-green" /> Rate Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-strand-red" /> Rate Surcharge (+₹{(rec.invoiceRate - rec.poRate).toFixed(2)})
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Exception & AI Reasoning Block */}
              {isException &&
                rec.exceptions.map((ex, i) => (
                  <div
                    key={i}
                    className="p-3.5 bg-surface-container-low border border-outline-variant rounded-xl space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-strand-red font-semibold font-mono">
                      <span className="flex items-center gap-1.5 text-xs">
                        <AlertTriangle className="w-4 h-4 text-strand-amber" />
                        Exception: {ex.type} — {ex.deltaText}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-outline">
                        claude-opus-5 audit engine
                      </span>
                    </div>

                    <p className="text-on-surface font-sans text-xs leading-relaxed bg-surface-container-lowest p-3 rounded-lg border border-outline-variant shadow-2xs">
                      {ex.aiExplanation}
                    </p>

                    <div className="pt-2 border-t border-outline-variant flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => handleQueryVendor(rec.vendorName)}
                        className="px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container border border-outline-variant rounded-lg text-xs font-mono font-semibold text-on-surface shadow-2xs flex items-center gap-1.5 transition-colors"
                      >
                        <Send className="w-3 h-3 text-outline" />
                        <span>Query Vendor Commercial Desk</span>
                      </button>
                      <button
                        onClick={() => handleDebitNote(rec.grnNumber, debitAmount)}
                        className="px-3 py-1.5 bg-strand-red hover:bg-red-700 text-white rounded-lg text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Generate Debit Note ({debitAmount})</span>
                      </button>
                    </div>
                  </div>
                ))}

              {/* Matched Pass Action */}
              {!isException && (
                <div className="p-3 bg-emerald-50/40 border border-emerald-200/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-emerald-950 font-medium font-sans flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-strand-green shrink-0" />
                    All parameters match PO tolerances. Approved for PACT General Ledger posting and payment batch run.
                  </span>
                  <button
                    onClick={() => handleSendToAccounts(rec.grnNumber)}
                      className="px-3 py-1.5 border-2 border-ink bg-accent active:translate-y-px hover:brightness-95 text-accent-ink rounded-lg text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Pass to Accounts Ledger</span>
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

