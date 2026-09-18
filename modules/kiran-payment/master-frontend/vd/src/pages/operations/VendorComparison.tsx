import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockVendorComparisons } from '../../data/purchase';
import { VendorComparison } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  Scale,
  Sparkles,
  CheckCircle2,
  ShoppingCart,
  Plus,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const VendorComparisonPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedComp, setSelectedComp] = useState<VendorComparison>(mockVendorComparisons[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCreatePO = (vendorName: string) => {
    setToastMessage(`Purchase Order PO-PUR-2026-0922 auto-drafted for ${vendorName}. Sent for HOD approval.`);
    setTimeout(() => setToastMessage(null), 4000);
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
        title="Vendor RFQ & Landed Cost Comparison"
      />

      {/* Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {mockVendorComparisons.map((c) => (
          <button
            key={c.rfqId}
            onClick={() => setSelectedComp(c)}
            className={`px-3 py-1.5 rounded-badge text-xs font-semibold font-mono transition-colors ${
              selectedComp.rfqId === c.rfqId
                ? 'bg-ink text-white shadow-xs'
                : 'bg-surface text-slate-700 hover:bg-canvas border border-line'
            }`}
          >
            {c.rfqNumber}: {c.materialName.slice(0, 30)}...
          </button>
        ))}
      </div>

      {/* AI Recommendation Banner */}
      <div className="p-4 bg-ai-tint/40 border border-ai/30 rounded-md space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-ai font-mono uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-ai" />
            AI Recommended Supplier: <strong className="text-ink font-sans text-sm ml-1">{selectedComp.recommendedVendor}</strong>
          </div>
          <span className="font-mono text-[10px] text-muted">Model: claude-opus-5</span>
        </div>
        <p className="text-xs text-slate-800 leading-relaxed font-sans bg-white/70 p-2.5 rounded border border-ai/20">
          {selectedComp.aiRecommendationReason}
        </p>
      </div>

      {/* Comparison Matrix Table */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">
              {selectedComp.materialName}
            </h3>
            <span className="text-xs font-mono text-muted">
              Batch Quantity: {selectedComp.quantity.toLocaleString('en-IN')} {selectedComp.uom}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-line">
              <tr>
                <th className="p-3 font-semibold text-muted text-[11px] uppercase w-48 font-mono">
                  Evaluation Metric
                </th>
                {selectedComp.vendors.map((v, i) => {
                  const isRec = v.vendorName === selectedComp.recommendedVendor;

                  return (
                    <th
                      key={i}
                      className={`p-3 font-sans text-xs ${
                        isRec
                          ? 'border-2 border-ai bg-ai-tint/20 rounded-t'
                          : 'border-b border-line text-ink'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{v.vendorName}</span>
                        {isRec && (
                          <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-ai text-white">
                            AI Choice
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono text-xs">
              {/* Row 1: Quoted Base Price */}
              <tr>
                <td className="p-3 font-semibold text-slate-700 font-sans">Base Price / Unit</td>
                {selectedComp.vendors.map((v, i) => (
                  <td
                    key={i}
                    className={`p-3 ${
                      v.isBestPrice ? 'bg-emerald-50 text-strand-green font-bold' : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>₹{v.price.toFixed(2)}</span>
                      {v.isBestPrice && (
                        <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-emerald-200 text-emerald-900">
                          Best
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Row 2: Discount */}
              <tr>
                <td className="p-3 font-semibold text-slate-700 font-sans">Commercial Discount</td>
                {selectedComp.vendors.map((v, i) => (
                  <td key={i} className="p-3 text-slate-800">
                    {v.discountPct}% Volume Rebate
                  </td>
                ))}
              </tr>

              {/* Row 3: Net Landed Cost */}
              <tr>
                <td className="p-3 font-semibold text-slate-700 font-sans">Effective Landed Rate</td>
                {selectedComp.vendors.map((v, i) => {
                  const net = v.price * (1 - v.discountPct / 100);
                  const isLowest = v.vendorName === selectedComp.recommendedVendor;

                  return (
                    <td
                      key={i}
                      className={`p-3 font-bold ${
                        isLowest ? 'bg-ai-tint/40 text-ai text-sm' : 'text-ink'
                      }`}
                    >
                      ₹{net.toFixed(2)} / {selectedComp.uom}
                    </td>
                  );
                })}
              </tr>

              {/* Row 4: Delivery Lead Time */}
              <tr>
                <td className="p-3 font-semibold text-slate-700 font-sans">Delivery Lead Time</td>
                {selectedComp.vendors.map((v, i) => (
                  <td
                    key={i}
                    className={`p-3 ${
                      v.isBestDelivery ? 'bg-emerald-50 text-strand-green font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{v.deliveryWeeks} Weeks</span>
                      {v.isBestDelivery && (
                        <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-emerald-200 text-emerald-900">
                          Fastest
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Row 5: Payment Terms */}
              <tr>
                <td className="p-3 font-semibold text-slate-700 font-sans">Payment Terms</td>
                {selectedComp.vendors.map((v, i) => (
                  <td key={i} className="p-3 text-slate-700">
                    {v.paymentTerms}
                  </td>
                ))}
              </tr>

              {/* Row 6: Total PO Value */}
              <tr>
                <td className="p-3 font-semibold text-slate-700 font-sans">Total Batch Cost</td>
                {selectedComp.vendors.map((v, i) => {
                  const total = v.price * (1 - v.discountPct / 100) * selectedComp.quantity;

                  return (
                    <td key={i} className="p-3 font-bold text-ink text-sm">
                      {formatINR(total)}
                    </td>
                  );
                })}
              </tr>

              {/* Row 7: Action Row */}
              <tr>
                <td className="p-3 font-semibold text-slate-700 font-sans">Action</td>
                {selectedComp.vendors.map((v, i) => {
                  const isRec = v.vendorName === selectedComp.recommendedVendor;

                  return (
                    <td key={i} className="p-3">
                      <button
                        onClick={() => handleCreatePO(v.vendorName)}
                        className={`w-full py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          isRec
                            ? 'bg-kiran hover:bg-blue-700 text-white shadow-xs'
                            : 'bg-canvas hover:bg-slate-200 border border-line text-slate-800'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Select Vendor</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
