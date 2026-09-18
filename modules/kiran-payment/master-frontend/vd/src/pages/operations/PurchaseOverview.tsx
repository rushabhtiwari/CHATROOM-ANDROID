import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockSupplierPerformance } from '../../data/purchase';
import { PageHeader } from '../../components/shell/PageHeader';
import {
  ShoppingBag,
  Plus,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  AlertTriangle,
  Scale,
  PackageCheck,
  CheckCircle2
} from 'lucide-react';

export const PurchaseOverview: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Purchase & Vendor Procurement Overview"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/purchase/rfq"
              className="px-3 py-1.5 bg-ai text-white hover:bg-ai/90 rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Scale className="w-3.5 h-3.5" />
              Vendor Quote Comparison
            </Link>
            <Link
              to="/purchase/requests"
              className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Purchase Requisition
            </Link>
          </div>
        }
      />

      {/* 4 Procurement KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <Link
          to="/purchase/requests"
          className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Pending PRs
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-1">4</div>
          <div className="text-[10px] text-ai mt-1 font-sans">2 MRP Auto-Triggered</div>
        </Link>

        <Link
          to="/purchase/rfq"
          className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Active Vendor RFQs
          </div>
          <div className="text-2xl font-display font-bold text-strand-amber mt-1">2</div>
          <div className="text-[10px] text-muted mt-1 font-sans">Silicone & E-Glass Yarn</div>
        </Link>

        <Link
          to="/purchase/orders"
          className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Open POs in Transit
          </div>
          <div className="text-2xl font-display font-bold text-strand-green mt-1">3</div>
          <div className="text-[10px] text-muted mt-1 font-sans">₹16.42 Lakhs Value</div>
        </Link>

        <Link
          to="/purchase/grn"
          className="p-4 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all"
        >
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-strand-red">
            3-Way Match Exceptions
          </div>
          <div className="text-2xl font-display font-bold text-strand-red mt-1">2</div>
          <div className="text-[10px] text-strand-red mt-1 font-sans font-semibold">1 Qty Discrepancy (200kg)</div>
        </Link>
      </div>

      {/* Supplier Performance Scorecard */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">
              Raw Material Supplier Performance & Quality Ratings
            </h3>
            <p className="text-xs text-muted">Based on historical GRN inspection records, on-time delivery, and lab rejection rates</p>
          </div>
          <span className="font-mono text-xs text-muted">Updated Aug 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
              <tr>
                <th className="p-2.5 font-sans">Vendor Name</th>
                <th className="p-2.5 text-right">On-Time Delivery %</th>
                <th className="p-2.5 text-right">Quality Reject %</th>
                <th className="p-2.5 text-right">Avg Lead Time</th>
                <th className="p-2.5 text-center">Quality Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mockSupplierPerformance.map((sup, idx) => (
                <tr key={idx} className="hover:bg-canvas/50">
                  <td className="p-2.5 font-sans font-semibold text-ink">{sup.vendor}</td>
                  <td className="p-2.5 text-right font-bold text-strand-green">{sup.onTimePct}%</td>
                  <td className={`p-2.5 text-right font-semibold ${sup.qualityRejectPct > 1 ? 'text-strand-amber' : 'text-slate-600'}`}>
                    {sup.qualityRejectPct}%
                  </td>
                  <td className="p-2.5 text-right">{sup.leadTimeDays} Days</td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-line text-[10px] font-semibold text-slate-800">
                      {sup.rating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Module Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/purchase/rfq"
          className="p-5 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-ai-tint text-ai flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <h4 className="font-display font-semibold text-sm text-ink group-hover:text-kiran">
              Vendor Quote Matrix & Recommendation
            </h4>
            <p className="text-xs text-muted">
              Side-by-side pricing matrix highlighting best line values and AI landed-cost rankings.
            </p>
          </div>
          <div className="pt-3 text-xs font-semibold text-kiran flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Compare quotes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/purchase/orders"
          className="p-5 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-canvas text-slate-700 flex items-center justify-center border border-line">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h4 className="font-display font-semibold text-sm text-ink group-hover:text-kiran">
              Purchase Orders & Dispatch Sync
            </h4>
            <p className="text-xs text-muted">
              Automated PO transmission to vendors upon HOD approval with PACT stock reservations.
            </p>
          </div>
          <div className="pt-3 text-xs font-semibold text-kiran flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>View purchase orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/purchase/grn"
          className="p-5 bg-surface border border-line hover:border-kiran rounded-md shadow-card transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-red-50 text-strand-red border border-red-200 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
            <h4 className="font-display font-semibold text-sm text-ink group-hover:text-kiran">
              Goods Receipt & 3-Way Match
            </h4>
            <p className="text-xs text-muted">
              Line-by-line comparison of PO, Goods Receipt Note (GRN), and Tax Invoice with debit notes.
            </p>
          </div>
          <div className="pt-3 text-xs font-semibold text-kiran flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Inspect 3-way match</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>
    </div>
  );
};
