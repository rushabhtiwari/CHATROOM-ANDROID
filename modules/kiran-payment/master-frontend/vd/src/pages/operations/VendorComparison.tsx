import React, { useState } from 'react';
import { mockVendorComparisons } from '../../data/purchase';
import { VendorComparison } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';

const BEST_PILL =
  'inline-flex items-center h-6 px-2 rounded-md bg-[#E7F3EB] text-[#17723F] text-[13px] font-medium';

export const VendorComparisonPage: React.FC = () => {
  const [selectedComp, setSelectedComp] = useState<VendorComparison>(mockVendorComparisons[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCreatePO = (vendorName: string) => {
    setToastMessage(`PO-PUR-2026-0922 drafted for ${vendorName}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover text-[14px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader title="Compare quotes" />

      <div className="flex items-center gap-2 overflow-x-auto">
        {mockVendorComparisons.map((c) => (
          <button
            key={c.rfqId}
            onClick={() => setSelectedComp(c)}
            title={c.materialName}
            className={`h-9 px-3.5 rounded-md text-[14px] font-medium whitespace-nowrap border transition-colors inline-flex items-center gap-2 ${
              selectedComp.rfqId === c.rfqId
                ? 'bg-kiran-tint border-kiran-tint text-[#0B4F9C]'
                : 'bg-white border-slate-300 text-ink hover:bg-slate-100'
            }`}
          >
            <span className="font-code text-[13px]">{c.rfqNumber}</span>
            <span className="max-w-[200px] truncate font-normal">{c.materialName}</span>
          </button>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-5 py-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[16px] font-semibold text-ink">{selectedComp.materialName}</h3>
          <span className="text-[13px] text-muted whitespace-nowrap">
            {selectedComp.quantity.toLocaleString('en-IN')} {selectedComp.uom}
          </span>
        </div>

        <div className="px-5 pb-4">
          <div className="text-[13px] text-muted">Suggested</div>
          <div className="text-[14px] font-medium text-ink">{selectedComp.recommendedVendor}</div>
          <p className="text-[14px] text-slate-700 mt-1 max-w-3xl">{selectedComp.aiRecommendationReason}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] font-medium text-muted border-y border-line">
              <tr>
                <th className="px-4 py-3 font-medium w-40" />
                {selectedComp.vendors.map((v, i) => {
                  const isRec = v.vendorName === selectedComp.recommendedVendor;

                  return (
                    <th key={i} className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-ink">{v.vendorName}</span>
                        {isRec && (
                          <span className="inline-flex items-center h-6 px-2 rounded-md bg-kiran-tint text-[#0B4F9C] text-[13px] font-medium">
                            Suggested
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              <tr className="h-[52px]">
                <td className="px-4 text-muted">Price</td>
                {selectedComp.vendors.map((v, i) => (
                  <td key={i} className="px-4 tabular-nums whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>₹{v.price.toFixed(2)}</span>
                      {v.isBestPrice && <span className={BEST_PILL}>Best</span>}
                    </div>
                  </td>
                ))}
              </tr>

              <tr className="h-[52px]">
                <td className="px-4 text-muted">Discount</td>
                {selectedComp.vendors.map((v, i) => (
                  <td key={i} className="px-4 tabular-nums whitespace-nowrap">
                    {v.discountPct}%
                  </td>
                ))}
              </tr>

              <tr className="h-[52px]">
                <td className="px-4 text-muted">Net price</td>
                {selectedComp.vendors.map((v, i) => {
                  const net = v.price * (1 - v.discountPct / 100);

                  return (
                    <td key={i} className="px-4 font-medium text-ink tabular-nums whitespace-nowrap">
                      ₹{net.toFixed(2)} / {selectedComp.uom}
                    </td>
                  );
                })}
              </tr>

              <tr className="h-[52px]">
                <td className="px-4 text-muted">Delivery</td>
                {selectedComp.vendors.map((v, i) => (
                  <td key={i} className="px-4 tabular-nums whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{v.deliveryWeeks} weeks</span>
                      {v.isBestDelivery && <span className={BEST_PILL}>Fastest</span>}
                    </div>
                  </td>
                ))}
              </tr>

              <tr className="h-[52px]">
                <td className="px-4 text-muted">Payment terms</td>
                {selectedComp.vendors.map((v, i) => (
                  <td key={i} className="px-4 text-slate-700">
                    {v.paymentTerms}
                  </td>
                ))}
              </tr>

              <tr className="h-[52px]">
                <td className="px-4 text-muted">Total</td>
                {selectedComp.vendors.map((v, i) => {
                  const total = v.price * (1 - v.discountPct / 100) * selectedComp.quantity;

                  return (
                    <td key={i} className="px-4 font-medium text-ink tabular-nums whitespace-nowrap">
                      {formatINR(total)}
                    </td>
                  );
                })}
              </tr>

              <tr>
                <td className="px-4 py-4" />
                {selectedComp.vendors.map((v, i) => {
                  const isRec = v.vendorName === selectedComp.recommendedVendor;

                  return (
                    <td key={i} className="px-4 py-4">
                      <button
                        onClick={() => handleCreatePO(v.vendorName)}
                        className={isRec ? 'btn-primary' : 'btn-secondary'}
                      >
                        Select
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
