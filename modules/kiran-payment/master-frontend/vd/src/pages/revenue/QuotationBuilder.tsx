import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { mockQuotations } from '../../data/quotations';
import { Quotation, QuotationLineItem } from '../../types';
import {
  ArrowLeft,
  Send,
  Save,
  Copy,
  Download,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { ApprovalBar } from '../../components/common/ApprovalBar';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatDate, formatINR } from '../../utils/formatters';

export const QuotationBuilder: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const initialQuote = mockQuotations.find(q => q.id === id) || mockQuotations[0];
  const [quote, setQuote] = useState<Quotation>(initialQuote);
  const [items, setItems] = useState<QuotationLineItem[]>(initialQuote.items);
  const [commercialTerms, setCommercialTerms] = useState<string>(initialQuote.commercialTerms);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Recalculate totals when offered price changes
  const handlePriceChange = (index: number, newPrice: number) => {
    const updated = [...items];
    const item = updated[index];
    item.offeredPrice = newPrice;
    item.isPriceAboveStandard = newPrice > item.standardPrice;
    setItems(updated);
  };

  const handleAIDraftTerms = () => {
    setCommercialTerms(
      `1. Prices are EX-WORKS Secunderabad. Freight extra at actuals.
2. GST 18% extra as applicable at time of dispatch.
3. Dielectric qualification certificates (UL94 V-0 & 4.0kV) included with first lot.
4. Delivery: 2-3 weeks from confirmed PO and clear dispatch instruction.
5. Payment: 60 days credit, subject to clearance of overdue ledger balance.
6. Validity: 15 days from date of quotation.`
    );
    setToastMessage('Commercial terms regenerated via claude-sonnet-4-6.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApprove = () => {
    setToastMessage('Price increase approved. Status updated to Sent.');
    setQuote(prev => ({ ...prev, status: 'Sent' }));
    setTimeout(() => setToastMessage(null), 4000);
  };

  const subtotal = items.reduce((acc, it) => acc + (it.offeredPrice * it.quantity), 0);
  const gstTotal = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + gstTotal;
  const hasPriceIncrease = items.some(it => it.isPriceAboveStandard);

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Back and Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/quotations"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-kiran"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quotations List</span>
          </Link>
          <span className="text-muted">/</span>
          <span className="font-mono font-bold text-ink">{quote.quoteNumber}</span>
          <StatusPill status={quote.status} />
        </div>

        {/* Top-Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setToastMessage('Quotation duplicated as new revision.')}
            className="px-2.5 py-1.5 bg-white hover:bg-canvas border border-line text-xs font-medium text-slate rounded flex items-center gap-1 shadow-2xs"
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          <button
            onClick={() => window.print()}
            className="px-2.5 py-1.5 bg-white hover:bg-canvas border border-line text-xs font-medium text-slate rounded flex items-center gap-1 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
          <button
            onClick={() => setToastMessage('Draft saved successfully in PACT.')}
            className="px-3 py-1.5 bg-white hover:bg-canvas border border-line text-xs font-semibold text-slate-800 rounded flex items-center gap-1"
          >
            <Save className="w-3.5 h-3.5" />
            Save as draft
          </button>
          <button
            onClick={() => {
              setToastMessage('Quotation dispatched to Vivek Sharma (Motherson).');
              setQuote(prev => ({ ...prev, status: 'Sent' }));
            }}
            className="px-4 py-1.5 bg-kiran hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Send quotation
          </button>
        </div>
      </div>

      {/* Two-Panel Builder Grid */}
      <div className="grid grid-cols-12 gap-6 items-start">
        
        {/* Left Panel (6 cols): Line Items & Commercials */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display font-semibold text-sm text-ink">
                  Quotation Line Items
                </h3>
                <p className="text-xs text-muted">
                  Standard prices pre-filled from master. Deviations require HOD approval.
                </p>
              </div>
              <span className="font-mono text-xs text-muted">
                RFQ Ref: <strong className="text-ink">{quote.rfqNumber}</strong>
              </span>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-muted text-[10px] uppercase font-semibold border-b border-line">
                  <tr>
                    <th className="p-2">Part No / Description</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Std Rate</th>
                    <th className="p-2 text-right">Offered Rate</th>
                    <th className="p-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-canvas/60">
                      <td className="p-2">
                        <div className="font-semibold text-ink">{item.partNumber}</div>
                        <div className="text-[10px] text-muted font-sans line-clamp-1">
                          {item.description}
                        </div>
                        <div className="text-[10px] text-muted">
                          HSN: {item.hsnCode} · GST: {item.gstRate}%
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        {item.quantity.toLocaleString('en-IN')} {item.uom}
                      </td>
                      <td className="p-2 text-right text-slate-500">
                        ₹{item.standardPrice.toFixed(2)}
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.05"
                          value={item.offeredPrice}
                          onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                          className={`w-20 text-right px-1.5 py-1 rounded border text-xs font-mono font-semibold focus:outline-none ${
                            item.isPriceAboveStandard
                              ? 'bg-amber-50 border-strand-amber text-amber-900 ring-1 ring-strand-amber'
                              : 'bg-canvas border-line text-ink'
                          }`}
                        />
                        {item.isPriceAboveStandard && (
                          <div className="text-[9px] text-strand-amber font-semibold mt-0.5">
                            +{(((item.offeredPrice - item.standardPrice) / item.standardPrice) * 100).toFixed(1)}% vs Std
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-right font-semibold text-ink">
                        ₹{(item.offeredPrice * item.quantity).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Summary */}
            <div className="p-3 bg-canvas border border-line rounded space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>GST (18% Integrated):</span>
                <span>{formatINR(gstTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-ink font-bold text-sm pt-1.5 border-t border-line">
                <span>Grand Total (INR):</span>
                <span className="text-kiran">{formatINR(grandTotal)}</span>
              </div>
            </div>

            {/* AI Commercial Terms Generator */}
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink font-mono uppercase tracking-wider">
                  Commercial Terms & Conditions
                </span>
                <button
                  onClick={handleAIDraftTerms}
                  className="px-2.5 py-1 rounded bg-ai-tint text-ai hover:bg-ai-tint/80 border border-ai/30 text-xs font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Draft with AI
                </button>
              </div>

              <textarea
                rows={6}
                value={commercialTerms}
                onChange={(e) => setCommercialTerms(e.target.value)}
                className="w-full text-xs font-mono p-3 rounded bg-canvas border border-line text-slate-800 focus:outline-none focus:ring-1 focus:ring-kiran"
              />
            </div>
          </div>
        </div>

        {/* Right Panel (6 cols): Live A4 Letterhead Preview */}
        <div className="col-span-12 lg:col-span-6 bg-white border border-line rounded-md p-8 shadow-card space-y-6 text-slate-800 font-sans text-xs">
          
          {/* Kiran Header Letterhead */}
          <div className="border-b-2 border-ink pb-4 flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="font-display font-bold text-lg text-ink tracking-tight">
                KIRAN CABLE PROTECTION PRODUCTS PVT. LTD.
              </div>
              <div className="text-[11px] text-muted">
                Plot 14/B, Industrial Development Area, Nacharam, Secunderabad - 500076, Telangana
              </div>
              <div className="text-[11px] text-muted font-mono">
                GSTIN: 36AAACK4921K1Z8 · CIN: U31300TG1976PTC002014
              </div>
            </div>

            {/* Signature Fan Mark */}
            <div className="w-10 h-10 rounded bg-ink flex items-center justify-center shrink-0">
              <svg viewBox="0 0 32 32" className="w-8 h-8">
                <path d="M4 28 C 8 20, 16 12, 28 4" stroke="#B5070E" strokeWidth="3" fill="none" />
                <path d="M4 28 C 12 20, 20 14, 28 10" stroke="#E9991B" strokeWidth="3" fill="none" />
                <path d="M4 28 C 14 22, 22 18, 28 16" stroke="#018F3D" strokeWidth="3" fill="none" />
                <path d="M4 28 C 16 24, 24 22, 28 22" stroke="#00AEEF" strokeWidth="3" fill="none" />
              </svg>
            </div>
          </div>

          {/* Quotation Metadata Bar */}
          <div className="grid grid-cols-2 gap-4 font-mono text-xs border-b border-line pb-4">
            <div>
              <div className="text-muted text-[10px] uppercase font-sans">Quotation To:</div>
              <div className="font-bold text-ink">{quote.customerName}</div>
              <div className="text-slate-600">{quote.contactPerson}</div>
              <div className="text-slate-500 text-[11px]">{quote.contactEmail}</div>
            </div>
            <div className="text-right space-y-0.5">
              <div>Quote Ref: <strong className="text-ink">{quote.quoteNumber}</strong></div>
              <div>Date: {formatDate(quote.createdAt)}</div>
              <div>Valid Till: <strong className="text-strand-amber">{formatDate(quote.validTill)}</strong></div>
              <div>RFQ Ref: {quote.rfqNumber}</div>
            </div>
          </div>

          {/* Letterhead Items Table */}
          <div className="space-y-2">
            <table className="w-full text-left border border-line">
              <thead className="bg-canvas text-ink text-[11px] font-semibold uppercase border-b border-line">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Rate (₹)</th>
                  <th className="p-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono text-xs">
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2">
                      <div className="font-semibold text-ink">{it.partNumber}</div>
                      <div className="text-[10px] text-muted font-sans">{it.description}</div>
                    </td>
                    <td className="p-2 text-right">{it.quantity.toLocaleString('en-IN')} {it.uom}</td>
                    <td className="p-2 text-right">₹{it.offeredPrice.toFixed(2)}</td>
                    <td className="p-2 text-right font-semibold">
                      ₹{(it.offeredPrice * it.quantity).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Block */}
            <div className="flex justify-end pt-2">
              <div className="w-64 font-mono text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST 18%:</span>
                  <span>{formatINR(gstTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-ink border-t border-line pt-1">
                  <span>Grand Total:</span>
                  <span>{formatINR(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Bank Details */}
          <div className="border-t border-line pt-4 space-y-3">
            <div>
              <div className="font-semibold text-ink text-[11px] uppercase tracking-wider mb-1">
                Terms & Conditions
              </div>
              <div className="whitespace-pre-line text-[11px] text-slate-600 font-mono leading-relaxed bg-canvas/40 p-3 rounded">
                {commercialTerms}
              </div>
            </div>

            <div className="p-3 rounded border border-line bg-canvas/30 text-[11px] font-mono flex items-center justify-between">
              <div>
                <span className="text-muted">Bank Name: </span><strong>HDFC Bank Ltd</strong>
                <span className="mx-2">·</span>
                <span className="text-muted">IFSC: </span><strong>HDFC0000045</strong>
              </div>
              <div>
                <span className="text-muted">A/C No: </span><strong>50200012984511</strong>
              </div>
            </div>
          </div>

          {/* Letterhead Footer Sign-off */}
          <div className="pt-6 flex items-end justify-between text-xs">
            <div>
              <span className="text-muted text-[10px]">Prepared by:</span>
              <div className="font-semibold text-ink font-mono">KiranOS Automated Quotation Desk</div>
            </div>
            <div className="text-right">
              <span className="text-muted text-[10px]">Authorized Signatory:</span>
              <div className="font-semibold text-ink">Rajesh Kumar (Head of Sales)</div>
              <div className="text-[10px] text-muted">Kiran Cable Protection Products Pvt. Ltd.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Approval Bar if Price Increase > Standard */}
      {hasPriceIncrease && quote.status === 'Awaiting HOD' && (
        <ApprovalBar
          title="Price increase of 8.4% over standard on 2 lines"
          nextSignee="Rajesh Kumar (HOD Sales)"
          onApprove={handleApprove}
          onRequestChanges={() => setToastMessage('Changes requested from estimating desk.')}
          onReject={() => {
            setQuote(prev => ({ ...prev, status: 'Draft' }));
            setToastMessage('Price increase rejected.');
          }}
        />
      )}
    </div>
  );
};
