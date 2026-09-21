import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockSupplierPerformance } from '../../data/purchase';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { HealthPill } from '../../components/common/HealthPill';
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
        category="PROCUREMENT & OPERATIONS"
        title="Purchase & Vendor Procurement Overview"
        description="Monitor active purchase requisitions, RFQ tender bids, supplier quality scorecard, and 3-way invoice reconciliation."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/purchase/rfq"
              className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Scale className="w-3.5 h-3.5 text-primary" />
              <span>Vendor Quote Comparison</span>
            </Link>
            <Link
              to="/purchase/requests"
              className="px-3.5 py-1.5 bg-primary hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase Requisition</span>
            </Link>
          </div>
        }
      />

      {/* 4 Procurement KPI Cards */}
      <LedgerBand cols={4}>
        <KPICard
          title="Pending PRs"
          value={4}
          to="/purchase/requests"
          status="neutral"
          icon={ShoppingBag}
          footerLeft="2 MRP Auto-Triggered"
        />

        <KPICard
          title="Active Vendor RFQs"
          value={2}
          to="/purchase/rfq"
          status="at_risk"
          icon={Scale}
          footerLeft="Silicone & E-Glass Yarn"
        />

        <KPICard
          title="Open POs in Transit"
          value={3}
          to="/purchase/orders"
          status="on_track"
          icon={PackageCheck}
          footerLeft="₹16.42 Lakhs Value"
        />

        <KPICard
          title="3-Way Match Exceptions"
          value={2}
          to="/purchase/grn"
          status="overdue"
          icon={AlertTriangle}
          footerLeft="1 Qty Discrepancy (200kg)"
          className="border-strand-red/30"
        />
      </LedgerBand>

      {/* Supplier Performance Scorecard */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-on-surface">
              Raw Material Supplier Performance & Quality Ratings
            </h3>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              Based on historical GRN inspection records, on-time delivery, and lab rejection rates
            </p>
          </div>
          <span className="font-mono text-xs text-outline">Updated Aug 2026</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead className="bg-surface-container-low border-b border-outline-variant text-[12px] text-outline select-none">
              <tr className="h-9">
                <th className="px-3.5 py-0 align-middle font-mono font-semibold">Vendor Name</th>
                <th className="px-3.5 py-0 align-middle text-right font-mono font-semibold">On-Time Delivery %</th>
                <th className="px-3.5 py-0 align-middle text-right font-mono font-semibold">Quality Reject %</th>
                <th className="px-3.5 py-0 align-middle text-right font-mono font-semibold">Avg Lead Time</th>
                <th className="px-3.5 py-0 align-middle text-center font-mono font-semibold">Quality Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {mockSupplierPerformance.map((sup, idx) => (
                <tr key={idx} className="h-9 hover:bg-surface-container-low/70 transition-colors">
                  <td className="px-3.5 py-0 align-middle font-semibold text-on-surface truncate max-w-[240px]">
                    {sup.vendor}
                  </td>
                  <td className="px-3.5 py-0 align-middle text-right font-bold text-strand-green tabular-nums">
                    {sup.onTimePct}%
                  </td>
                  <td className={`px-3.5 py-0 align-middle text-right font-semibold tabular-nums ${
                    sup.qualityRejectPct > 1 ? 'text-strand-amber' : 'text-on-surface-variant'
                  }`}>
                    {sup.qualityRejectPct}%
                  </td>
                  <td className="px-3.5 py-0 align-middle text-right text-on-surface-variant tabular-nums">
                    {sup.leadTimeDays} Days
                  </td>
                  <td className="px-3.5 py-0 align-middle text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-mono font-semibold border ${
                      sup.rating === 'Tier 1'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-outline-variant bg-surface-container text-on-surface-variant'
                    }`}>
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
      <div className="ku-ledger grid-cols-1 md:grid-cols-3">
        <Link
          to="/purchase/rfq"
          className="p-4.5 bg-white hover:border-primary/60 rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-container text-primary flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Vendor Quote Matrix & Recommendation
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Side-by-side pricing matrix highlighting best line values and AI landed-cost rankings.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>Compare quotes</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/purchase/orders"
          className="p-4.5 bg-white hover:border-primary/60 rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-container-low text-on-surface-variant flex items-center justify-center">
              <FileCheck2 className="w-4 h-4 text-primary" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Purchase Orders & Dispatch Sync
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Automated PO transmission to vendors upon HOD approval with PACT stock reservations.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>View purchase orders</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/purchase/grn"
          className="p-4.5 bg-white hover:border-primary/60 rounded-xl transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-strand-red border border-red-200 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
            <h4 className="font-display font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
              Goods Receipt & 3-Way Match
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Line-by-line comparison of PO, Goods Receipt Note (GRN), and Tax Invoice with debit notes.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-variant text-xs font-mono font-semibold text-primary flex items-center justify-between">
            <span>Inspect 3-way match</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
};
