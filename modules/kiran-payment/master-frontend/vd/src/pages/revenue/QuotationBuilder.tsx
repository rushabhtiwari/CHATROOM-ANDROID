import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { mockQuotations } from '../../data/quotations';
import { Quotation, QuotationLineItem } from '../../types';
import { ArrowLeft, Send, Copy, Download, CheckCircle2 } from 'lucide-react';
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
    setToastMessage('Terms drafted.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApprove = () => {
    setToastMessage('Price increase approved.');
    setQuote(prev => ({ ...prev, status: 'Sent' }));
    setTimeout(() => setToastMessage(null), 4000);
  };

  const subtotal = items.reduce((acc, it) => acc + (it.offeredPrice * it.quantity), 0);
  const gstTotal = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + gstTotal;
  const hasPriceIncrease = items.some(it => it.isPriceAboveStandard);

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover flex items-center gap-2.5 text-[14px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Link
        to="/quotations"
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quotations</span>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-code font-semibold text-[24px] leading-[1.2] text-ink">{quote.quoteNumber}</h1>
            <StatusPill status={quote.status} />
          </div>
          <div className="text-[13px] text-muted mt-1">
            {quote.customerName} · <span className="font-code">{quote.rfqNumber}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setToastMessage('Quotation duplicated.')}
            className="btn-icon"
            title="Duplicate"
            aria-label="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.print()}
            className="btn-icon"
            title="Download PDF"
            aria-label="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => setToastMessage('Draft saved.')} className="btn-secondary">
            Save draft
          </button>
          <button
            onClick={() => {
              setToastMessage('Quotation sent to Vivek Sharma.');
              setQuote(prev => ({ ...prev, status: 'Sent' }));
            }}
            className="btn-primary"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Editor */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          <div className="bg-surface border border-line rounded-lg overflow-hidden">
            <h3 className="px-5 py-4 text-[16px] font-semibold text-ink">Items</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-surface-2 text-[13px] font-medium text-muted border-y border-line">
                  <tr>
                    <th className="px-4 pl-5 h-11 font-medium">Part</th>
                    <th className="px-4 h-11 font-medium text-right">Qty</th>
                    <th className="px-4 h-11 font-medium text-right whitespace-nowrap">Std rate</th>
                    <th className="px-4 h-11 font-medium text-right">Rate</th>
                    <th className="px-4 pr-5 h-11 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-line-2 hover:bg-canvas">
                      <td className="px-4 pl-5 py-3.5">
                        <div className="font-medium text-ink whitespace-nowrap">{item.partNumber}</div>
                        <div className="text-[13px] text-muted line-clamp-1">{item.description}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                        {item.quantity.toLocaleString('en-IN')} {item.uom}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap text-muted">
                        ₹{item.standardPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <input
                          type="number"
                          step="0.05"
                          aria-label="Offered rate"
                          value={item.offeredPrice}
                          onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                          className={`field w-24 text-right tabular-nums ml-auto ${
                            item.isPriceAboveStandard ? 'border-[#C77700]' : ''
                          }`}
                        />
                        {item.isPriceAboveStandard && (
                          <div className="text-[12px] text-[#8A4F00] mt-1 tabular-nums whitespace-nowrap">
                            +{(((item.offeredPrice - item.standardPrice) / item.standardPrice) * 100).toFixed(1)}%
                          </div>
                        )}
                      </td>
                      <td className="px-4 pr-5 py-3.5 text-right tabular-nums whitespace-nowrap text-ink">
                        ₹{(item.offeredPrice * item.quantity).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 space-y-2 text-[14px]">
              <div className="flex items-center justify-between text-muted">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatINR(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>GST 18%</span>
                <span className="tabular-nums">{formatINR(gstTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-ink font-semibold text-[16px] pt-2 border-t border-line-2">
                <span>Total</span>
                <span className="tabular-nums">{formatINR(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">Terms</h3>
              <button onClick={handleAIDraftTerms} className="btn-secondary">
                Draft terms
              </button>
            </div>

            <textarea
              rows={7}
              aria-label="Terms"
              value={commercialTerms}
              onChange={(e) => setCommercialTerms(e.target.value)}
              className="field h-auto py-2 leading-relaxed"
            />
          </div>
        </div>

        {/* Letterhead preview */}
        <div className="col-span-12 lg:col-span-6 bg-white border border-line rounded-lg p-8 space-y-6 text-ink-2 text-[13px]">
          <div className="border-b border-line pb-4 flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <div className="font-semibold text-[16px] text-ink">
                Kiran Cable Protection Products Pvt. Ltd.
              </div>
              <div className="text-[12px] text-muted">
                Plot 14/B, Industrial Development Area, Nacharam, Secunderabad - 500076, Telangana
              </div>
              <div className="text-[12px] text-muted">
                GSTIN 36AAACK4921K1Z8 · CIN U31300TG1976PTC002014
              </div>
            </div>

            <div className="w-10 h-10 rounded-md bg-[#02223C] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 32 32" className="w-8 h-8">
                <path d="M4 28 C 8 20, 16 12, 28 4" stroke="#B5070E" strokeWidth="3" fill="none" />
                <path d="M4 28 C 12 20, 20 14, 28 10" stroke="#E9991B" strokeWidth="3" fill="none" />
                <path d="M4 28 C 14 22, 22 18, 28 16" stroke="#018F3D" strokeWidth="3" fill="none" />
                <path d="M4 28 C 16 24, 24 22, 28 22" stroke="#00AEEF" strokeWidth="3" fill="none" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-line pb-4">
            <div>
              <div className="text-muted text-[12px]">To</div>
              <div className="font-medium text-ink">{quote.customerName}</div>
              <div>{quote.contactPerson}</div>
              <div className="text-muted text-[12px]">{quote.contactEmail}</div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="font-code text-ink">{quote.quoteNumber}</div>
              <div>{formatDate(quote.createdAt)}</div>
              <div>Valid till {formatDate(quote.validTill)}</div>
              <div className="font-code text-muted">{quote.rfqNumber}</div>
            </div>
          </div>

          <div className="space-y-2">
            <table className="w-full text-left">
              <thead className="text-muted text-[12px] font-medium border-b border-line">
                <tr>
                  <th className="py-2 pr-2 font-medium">Item</th>
                  <th className="py-2 px-2 font-medium text-right">Qty</th>
                  <th className="py-2 px-2 font-medium text-right">Rate</th>
                  <th className="py-2 pl-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 pr-2">
                      <div className="font-medium text-ink">{it.partNumber}</div>
                      <div className="text-[12px] text-muted">{it.description}</div>
                      <div className="text-[12px] text-muted">
                        HSN {it.hsnCode} · GST {it.gstRate}%
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">{it.quantity.toLocaleString('en-IN')} {it.uom}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">₹{it.offeredPrice.toFixed(2)}</td>
                    <td className="py-2.5 pl-2 text-right tabular-nums whitespace-nowrap text-ink">
                      ₹{(it.offeredPrice * it.quantity).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-1">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>GST 18%</span>
                  <span className="tabular-nums">{formatINR(gstTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-[14px] text-ink border-t border-line pt-1.5">
                  <span>Total</span>
                  <span className="tabular-nums">{formatINR(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-line pt-4 space-y-4">
            <div>
              <div className="font-medium text-ink text-[12px] mb-1">Terms</div>
              <div className="whitespace-pre-line text-[12px] text-ink-2 leading-relaxed">
                {commercialTerms}
              </div>
            </div>

            <div className="text-[12px] flex flex-wrap items-center gap-x-4 gap-y-1">
              <span><span className="text-muted">Bank </span>HDFC Bank Ltd</span>
              <span><span className="text-muted">IFSC </span>HDFC0000045</span>
              <span><span className="text-muted">A/C </span>50200012984511</span>
            </div>
          </div>

          <div className="pt-6 text-right">
            <div className="text-muted text-[12px]">Authorised signatory</div>
            <div className="font-medium text-ink">Rajesh Kumar, Head of Sales</div>
          </div>
        </div>
      </div>

      {hasPriceIncrease && quote.status === 'Awaiting HOD' && (
        <ApprovalBar
          title="Price 8.4% above standard on 2 lines"
          nextSignee="Rajesh Kumar"
          onApprove={handleApprove}
          onRequestChanges={() => setToastMessage('Changes requested.')}
          onReject={() => {
            setQuote(prev => ({ ...prev, status: 'Draft' }));
            setToastMessage('Price increase rejected.');
          }}
        />
      )}
    </div>
  );
};
