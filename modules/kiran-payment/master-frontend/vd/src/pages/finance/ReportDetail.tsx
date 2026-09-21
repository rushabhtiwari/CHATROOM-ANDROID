import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  mockReportsList,
  mockProductConsolidatedData,
  mockCustomerMISData
} from '../../data/reports';
import { mockSalesOrders } from '../../data/orders';
import { mockReceivables } from '../../data/accounts';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill';
import { formatINR } from '../../utils/formatters';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const TABLE = 'w-full text-left text-[14px]';
const THEAD = 'bg-surface-2 text-[13px] text-muted border-b border-line';
const TH = 'px-4 py-3 font-medium whitespace-nowrap';
const TH_NUM = `${TH} text-right`;
const TBODY = 'divide-y divide-line-2';
const TR = 'h-[52px] hover:bg-canvas';
const TD = 'px-4 py-3';
const TD_MAIN = `${TD} font-medium text-ink`;
const TD_NUM = `${TD} text-right tabular-nums whitespace-nowrap`;
const SECTION_TITLE = 'px-5 py-4 text-[16px] font-semibold text-ink';

export const ReportDetail: React.FC = () => {
  const { reportId } = useParams();
  const report = mockReportsList.find(r => r.id === reportId) || mockReportsList[0];

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRegenerateAI = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
      setToastMessage('Summary refreshed.');
      setTimeout(() => setToastMessage(null), 3000);
    }, 600);
  };

  const handleExport = (type: string) => {
    setToastMessage(type === 'Email' ? 'Report emailed.' : `${type} downloaded.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover text-[13px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <Link
        to="/reports"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Reports</span>
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-ink">{report.name}</h1>
          <div className="text-[13px] text-muted mt-1">
            {report.schedule} · {report.lastRunAt} · {report.recipients.join(', ')}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('Excel')} className="btn-secondary">
            Excel
          </button>
          <button onClick={() => handleExport('PDF')} className="btn-secondary">
            PDF
          </button>
          <button onClick={() => handleExport('Email')} className="btn-primary">
            Email report
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-ink">Summary</h3>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted">{report.aiSummary.generatedAt}</span>
            <button
              onClick={handleRegenerateAI}
              disabled={isRegenerating}
              className="btn-icon"
              title="Refresh summary"
              aria-label="Refresh summary"
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <ul className="space-y-2 text-[14px] text-slate-700">
          {report.aiSummary.points.map((pt, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 1. Pending Sales Orders */}
      {report.id === 'pending-sales-orders' && (
        <div className="panel overflow-hidden">
          <h3 className={SECTION_TITLE}>Pending by order</h3>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Customer</th>
                  <th className={TH}>PO no.</th>
                  <th className={TH}>Product</th>
                  <th className={TH_NUM}>PO qty</th>
                  <th className={TH_NUM}>Executed</th>
                  <th className={TH_NUM}>Balance</th>
                  <th className={TH_NUM}>Pending value</th>
                </tr>
              </thead>
              <tbody className={TBODY}>
                {mockSalesOrders.map((o) => (
                  <tr key={o.id} className={TR}>
                    <td className={TD_MAIN}>{o.customerName}</td>
                    <td className={`${TD} font-code text-[13px] whitespace-nowrap`}>{o.poNumber}</td>
                    <td className={`${TD} text-slate-700`}>{o.product}</td>
                    <td className={TD_NUM}>{o.poQty.toLocaleString('en-IN')}m</td>
                    <td className={TD_NUM}>{o.executedQty.toLocaleString('en-IN')}m</td>
                    <td className={TD_NUM}>{o.balanceQty.toLocaleString('en-IN')}m</td>
                    <td className={`${TD_NUM} text-ink`}>{formatINR(o.balanceValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-2 border-t border-line font-semibold text-ink">
                <tr className="h-[52px]">
                  <td colSpan={5} className={TD}>Total</td>
                  <td className={TD_NUM}>690,000m</td>
                  <td className={TD_NUM}>₹1,74,92,979</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. Product-Wise Consolidated */}
      {report.id === 'product-wise-consolidated' && (
        <div className="space-y-6">
          <div className="panel p-5 space-y-4">
            <h3 className="text-[16px] font-semibold text-ink">Balance by product</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockProductConsolidatedData} layout="vertical" margin={{ left: 50, right: 30, top: 10, bottom: 5 }}>
                  <XAxis type="number" tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} tick={{ fontSize: 12, fill: '#5B5B63' }} axisLine={{ stroke: '#E6E6EB' }} tickLine={false} />
                  <YAxis dataKey="product" type="category" width={180} tick={{ fontSize: 12, fill: '#5B5B63' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val: any) => [formatINR(val), 'Balance']} contentStyle={{ backgroundColor: '#1D1D1F', borderColor: '#1D1D1F', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="balVal" fill="#0A63C9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <h3 className={SECTION_TITLE}>By product</h3>
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Product</th>
                    <th className={TH_NUM}>PO qty</th>
                    <th className={TH_NUM}>Executed qty</th>
                    <th className={TH_NUM}>Balance qty</th>
                    <th className={TH_NUM}>PO value</th>
                    <th className={TH_NUM}>Executed value</th>
                    <th className={TH_NUM}>Balance value</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {mockProductConsolidatedData.map((p, i) => (
                    <tr key={i} className={TR}>
                      <td className={TD_MAIN}>{p.product}</td>
                      <td className={TD_NUM}>{p.poQty.toLocaleString('en-IN')}m</td>
                      <td className={TD_NUM}>{p.execQty.toLocaleString('en-IN')}m</td>
                      <td className={TD_NUM}>{p.balQty.toLocaleString('en-IN')}m</td>
                      <td className={TD_NUM}>{formatINR(p.poVal)}</td>
                      <td className={TD_NUM}>{formatINR(p.execVal)}</td>
                      <td className={`${TD_NUM} text-ink`}>{formatINR(p.balVal)}</td>
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
        <div className="panel overflow-hidden">
          <h3 className={SECTION_TITLE}>By customer</h3>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Customer</th>
                  <th className={TH_NUM}>Sales</th>
                  <th className={TH_NUM}>Pending orders</th>
                  <th className={TH_NUM}>Overdue 45+ days</th>
                  <th className={TH_NUM}>Not yet due</th>
                  <th className={TH_NUM}>Receivable</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody className={TBODY}>
                {mockCustomerMISData.map((c, i) => (
                  <tr key={i} className={TR}>
                    <td className={TD_MAIN}>{c.customer}</td>
                    <td className={TD_NUM}>{formatINR(c.salesVal)}</td>
                    <td className={TD_NUM}>{formatINR(c.pendingVal)}</td>
                    <td className={`${TD_NUM} ${c.overdueVal > 0 ? 'text-strand-red font-medium' : 'text-slate-400'}`}>
                      {formatINR(c.overdueVal)}
                    </td>
                    <td className={TD_NUM}>{formatINR(c.yetDueVal)}</td>
                    <td className={`${TD_NUM} text-ink`}>{formatINR(c.totalReceivable)}</td>
                    <td className={TD}>
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
        <div className="panel overflow-hidden">
          <h3 className={SECTION_TITLE}>Ageing</h3>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Customer</th>
                  <th className={TH_NUM}>0–30 days</th>
                  <th className={TH_NUM}>31–45 days</th>
                  <th className={TH_NUM}>46–60 days</th>
                  <th className={TH_NUM}>61–90 days</th>
                  <th className={TH_NUM}>90+ days</th>
                  <th className={TH_NUM}>Total</th>
                </tr>
              </thead>
              <tbody className={TBODY}>
                {mockReceivables.map((r, i) => (
                  <tr key={i} className={TR}>
                    <td className={TD_MAIN}>{r.customerName}</td>
                    <td className={TD_NUM}>{formatINR(r.buckets.b0_30)}</td>
                    <td className={TD_NUM}>{formatINR(r.buckets.b31_45)}</td>
                    <td className={`${TD_NUM} ${r.buckets.b46_60 > 0 ? 'text-strand-amber' : 'text-slate-400'}`}>
                      {formatINR(r.buckets.b46_60)}
                    </td>
                    <td className={`${TD_NUM} ${r.buckets.b61_90 > 0 ? 'text-strand-red font-medium' : 'text-slate-400'}`}>
                      {formatINR(r.buckets.b61_90)}
                    </td>
                    <td className={`${TD_NUM} ${r.buckets.b90_plus > 0 ? 'text-strand-red font-medium' : 'text-slate-400'}`}>
                      {formatINR(r.buckets.b90_plus)}
                    </td>
                    <td className={`${TD_NUM} text-ink`}>{formatINR(r.totalReceivable)}</td>
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
