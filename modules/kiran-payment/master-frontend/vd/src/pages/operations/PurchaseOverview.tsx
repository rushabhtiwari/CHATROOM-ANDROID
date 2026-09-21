import React from 'react';
import { Link } from 'react-router-dom';
import { mockSupplierPerformance } from '../../data/purchase';
import { PageHeader } from '../../components/shell/PageHeader';
import { Plus } from 'lucide-react';

export const PurchaseOverview: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Purchase"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/purchase/rfq" className="btn-secondary">
              Compare quotes
            </Link>
            <Link to="/purchase/requests" className="btn-primary">
              <Plus className="w-4 h-4" />
              New request
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/purchase/requests" className="kpi block hover:border-slate-300 transition-colors">
          <div className="kpi-label">Pending requests</div>
          <div className="kpi-value">4</div>
        </Link>

        <Link to="/purchase/rfq" className="kpi block hover:border-slate-300 transition-colors">
          <div className="kpi-label">Open quotes</div>
          <div className="kpi-value">2</div>
        </Link>

        <Link to="/purchase/orders" className="kpi block hover:border-slate-300 transition-colors">
          <div className="kpi-label">Orders in transit</div>
          <div className="kpi-value">3</div>
        </Link>

        <Link to="/purchase/grn" className="kpi block hover:border-slate-300 transition-colors">
          <div className="kpi-label">Receipt mismatches</div>
          <div className="kpi-value text-strand-red">2</div>
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-[16px] font-semibold text-ink">Suppliers</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] font-medium text-muted border-y border-line">
              <tr>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium text-right">On time</th>
                <th className="px-4 py-3 font-medium text-right">Rejected</th>
                <th className="px-4 py-3 font-medium text-right">Lead time</th>
                <th className="px-4 py-3 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {mockSupplierPerformance.map((sup, idx) => (
                <tr key={idx} className="h-[52px] hover:bg-canvas">
                  <td className="px-4 font-medium text-ink">{sup.vendor}</td>
                  <td className="px-4 text-right tabular-nums whitespace-nowrap">{sup.onTimePct}%</td>
                  <td
                    className={`px-4 text-right tabular-nums whitespace-nowrap ${
                      sup.qualityRejectPct > 1 ? 'text-strand-red' : ''
                    }`}
                  >
                    {sup.qualityRejectPct}%
                  </td>
                  <td className="px-4 text-right tabular-nums whitespace-nowrap">{sup.leadTimeDays} days</td>
                  <td className="px-4 whitespace-nowrap">
                    <span className="inline-flex items-center h-6 px-2 rounded-md bg-[#EFEFF2] text-[#48484F] text-[13px] font-medium">
                      {sup.rating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
