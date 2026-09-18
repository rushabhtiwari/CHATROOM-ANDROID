import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  mockReportsList,
  mockProductConsolidatedData,
  mockCustomerMISData
} from '../../data/reports';
import { mockSalesOrders } from '../../data/orders';
import { mockReceivables } from '../../data/accounts';
import {
  ArrowLeft,
  Sparkles,
  Download,
  Mail,
  RefreshCw,
  Calendar,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  BarChart3
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const ReportDetail: React.FC = () => {
  const { reportId } = useParams();
  const report = mockReportsList.find(r => r.id === reportId) || mockReportsList[0];

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRegenerateAI = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
      setToastMessage('AI Executive Observations refreshed by claude-sonnet-4-6.');
      setTimeout(() => setToastMessage(null), 3000);
    }, 600);
  };

  const handleExport = (type: string) => {
    setToastMessage(`Exporting ${report.name} as ${type}... File downloaded.`);
    setTimeout(() => setToastMessage(null), 3000);
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

      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-kiran"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Reports Hub</span>
        </Link>
        <span className="font-mono text-xs text-muted">
          Schedule: {report.schedule}
        </span>
      </div>

      {/* Header & Export Bar */}
      <div className="bg-surface border border-line rounded-lg p-6 shadow-card flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-2xl text-ink">
            {report.name}
          </h1>
          <p className="text-xs text-muted mt-1 max-w-2xl">{report.description}</p>
          <div className="flex items-center gap-3 text-xs text-slate-600 mt-2 font-mono">
            <span>Last computed: <strong>{report.lastRunAt}</strong></span>
            <span>·</span>
            <span>Recipients: <strong>{report.recipients.join(', ')}</strong></span>
          </div>
        </div>

        {/* Export Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('Excel')}
            className="px-3 py-1.5 bg-white hover:bg-canvas border border-line text-xs font-medium text-slate rounded flex items-center gap-1.5 shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-strand-green" />
            Export Excel
          </button>
          <button
            onClick={() => handleExport('PDF')}
            className="px-3 py-1.5 bg-white hover:bg-canvas border border-line text-xs font-medium text-slate rounded flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-muted" />
            Download PDF
          </button>
          <button
            onClick={() => handleExport('Email')}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            Email Report Now
          </button>
        </div>
      </div>

      {/* AI Summary Block in Violet */}
      <div className="bg-ai-tint/30 border border-ai/30 rounded-md p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between border-b border-ai/20 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-ai" />
            <span className="text-xs font-semibold uppercase tracking-wider text-ai font-mono">
              AI Executive Observations & Narrative
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted">
              Model: <strong className="text-ai">{report.aiSummary.generatedByModel}</strong> · {report.aiSummary.generatedAt}
            </span>
            <button
              onClick={handleRegenerateAI}
              disabled={isRegenerating}
              className="p-1 rounded text-ai hover:bg-ai/10 transition-colors"
              title="Regenerate observations"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <ul className="space-y-1.5 text-xs text-slate-800 font-sans">
          {report.aiSummary.points.map((pt, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ai mt-1.5 shrink-0" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Dynamic Report Content Body */}
      
      {/* 1. Pending Sales Orders */}
      {report.id === 'pending-sales-orders' && (
        <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
          <h3 className="font-display font-semibold text-sm text-ink uppercase tracking-wider font-mono">
            Customer & PO-Wise Pending Balance Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
                <tr>
                  <th className="p-2.5 font-sans">Customer Name</th>
                  <th className="p-2.5">PO Number</th>
                  <th className="p-2.5 font-sans">Product</th>
                  <th className="p-2.5 text-right">PO Qty</th>
                  <th className="p-2.5 text-right">Exec Qty</th>
                  <th className="p-2.5 text-right">Balance Qty</th>
                  <th className="p-2.5 text-right">Pending Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mockSalesOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-canvas/50">
                    <td className="p-2.5 font-sans font-semibold text-ink">{o.customerName}</td>
                    <td className="p-2.5 text-kiran font-semibold">{o.poNumber}</td>
                    <td className="p-2.5 font-sans text-slate-700">{o.product}</td>
                    <td className="p-2.5 text-right">{o.poQty.toLocaleString('en-IN')}m</td>
                    <td className="p-2.5 text-right">{o.executedQty.toLocaleString('en-IN')}m</td>
                    <td className="p-2.5 text-right font-bold text-strand-amber">{o.balanceQty.toLocaleString('en-IN')}m</td>
                    <td className="p-2.5 text-right font-semibold text-ink">{formatINR(o.balanceValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-canvas/80 border-t-2 border-line font-bold text-xs">
                <tr>
                  <td colSpan={5} className="p-2.5 text-ink font-sans uppercase">Total Unexecuted Pending Portfolio</td>
                  <td className="p-2.5 text-right text-strand-amber">690,000m</td>
                  <td className="p-2.5 text-right text-kiran text-sm">₹1,74,92,979</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. Product-Wise Consolidated */}
      {report.id === 'product-wise-consolidated' && (
        <div className="space-y-6">
          <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
            <h3 className="font-display font-semibold text-sm text-ink uppercase tracking-wider font-mono">
              Balance Value by Product Category
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockProductConsolidatedData} layout="vertical" margin={{ left: 50, right: 30, top: 10, bottom: 5 }}>
                  <XAxis type="number" tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
                  <YAxis dataKey="product" type="category" width={180} tick={{ fontSize: 11, fill: '#4A5A70' }} />
                  <Tooltip formatter={(val: any) => [formatINR(val), 'Pending Balance Value']} contentStyle={{ backgroundColor: '#0E2340', borderColor: '#1B3A63', color: '#fff', borderRadius: '4px', fontSize: '11px' }} />
                  <Bar dataKey="balVal" fill="#06477F" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
            <h3 className="font-display font-semibold text-sm text-ink uppercase tracking-wider font-mono">
              Product-Wise Quantity & Value Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
                  <tr>
                    <th className="p-2.5 font-sans">Product</th>
                    <th className="p-2.5 text-right">PO Qty</th>
                    <th className="p-2.5 text-right">Exec Qty</th>
                    <th className="p-2.5 text-right">Bal Qty</th>
                    <th className="p-2.5 text-right">PO Value</th>
                    <th className="p-2.5 text-right">Exec Value</th>
                    <th className="p-2.5 text-right">Bal Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {mockProductConsolidatedData.map((p, i) => (
                    <tr key={i} className="hover:bg-canvas/50">
                      <td className="p-2.5 font-sans font-semibold text-ink">{p.product}</td>
                      <td className="p-2.5 text-right">{p.poQty.toLocaleString('en-IN')}m</td>
                      <td className="p-2.5 text-right">{p.execQty.toLocaleString('en-IN')}m</td>
                      <td className="p-2.5 text-right font-bold text-strand-amber">{p.balQty.toLocaleString('en-IN')}m</td>
                      <td className="p-2.5 text-right">{formatINR(p.poVal)}</td>
                      <td className="p-2.5 text-right text-strand-green">{formatINR(p.execVal)}</td>
                      <td className="p-2.5 text-right font-bold text-ink">{formatINR(p.balVal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Customer-Wise Revenue & Collection MIS */}
      {report.id === 'customer-wise-mis' && (
        <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
          <h3 className="font-display font-semibold text-sm text-ink uppercase tracking-wider font-mono">
            Client Revenue, Order Backlog & Collection Status
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
                <tr>
                  <th className="p-2.5 font-sans">Customer</th>
                  <th className="p-2.5 text-right">Sales Value</th>
                  <th className="p-2.5 text-right">Pending Orders</th>
                  <th className="p-2.5 text-right">Overdue &gt;45d</th>
                  <th className="p-2.5 text-right">Yet to Due</th>
                  <th className="p-2.5 text-right">Total Receivable</th>
                  <th className="p-2.5 text-center">Collection Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mockCustomerMISData.map((c, i) => (
                  <tr key={i} className="hover:bg-canvas/50">
                    <td className="p-2.5 font-sans font-semibold text-ink">{c.customer}</td>
                    <td className="p-2.5 text-right">{formatINR(c.salesVal)}</td>
                    <td className="p-2.5 text-right text-strand-amber">{formatINR(c.pendingVal)}</td>
                    <td className={`p-2.5 text-right font-bold ${c.overdueVal > 0 ? 'text-strand-red' : 'text-slate-400'}`}>
                      {formatINR(c.overdueVal)}
                    </td>
                    <td className="p-2.5 text-right">{formatINR(c.yetDueVal)}</td>
                    <td className="p-2.5 text-right font-bold text-ink">{formatINR(c.totalReceivable)}</td>
                    <td className="p-2.5 text-center">
                      <StatusPill status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Weekly Receivables Ageing Report */}
      {report.id === 'weekly-receivables' && (
        <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
          <h3 className="font-display font-semibold text-sm text-ink uppercase tracking-wider font-mono">
            Receivables Ageing Slab Matrix (Severity Shaded)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
                <tr>
                  <th className="p-2.5 font-sans">Customer</th>
                  <th className="p-2.5 text-right">0–30 Days</th>
                  <th className="p-2.5 text-right">31–45 Days</th>
                  <th className="p-2.5 text-right">46–60 Days</th>
                  <th className="p-2.5 text-right">61–90 Days</th>
                  <th className="p-2.5 text-right">90+ Days</th>
                  <th className="p-2.5 text-right">Total Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mockReceivables.map((r, i) => (
                  <tr key={i} className="hover:bg-canvas/50">
                    <td className="p-2.5 font-sans font-semibold text-ink">{r.customerName}</td>
                    <td className="p-2.5 text-right text-strand-green">{formatINR(r.buckets.b0_30)}</td>
                    <td className="p-2.5 text-right text-slate-700">{formatINR(r.buckets.b31_45)}</td>
                    <td className={`p-2.5 text-right ${r.buckets.b46_60 > 0 ? 'bg-amber-50 text-strand-amber font-semibold' : 'text-slate-400'}`}>
                      {formatINR(r.buckets.b46_60)}
                    </td>
                    <td className={`p-2.5 text-right ${r.buckets.b61_90 > 0 ? 'bg-red-50 text-strand-red font-bold animate-pulse' : 'text-slate-400'}`}>
                      {formatINR(r.buckets.b61_90)}
                    </td>
                    <td className="p-2.5 text-right text-slate-400">
                      {formatINR(r.buckets.b90_plus)}
                    </td>
                    <td className="p-2.5 text-right font-bold text-ink">{formatINR(r.totalReceivable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
