import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockSalesOrders } from '../../data/orders';
import {
  ArrowLeft,
  Calendar,
  Layers,
  Truck,
  FileCheck2,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatDate, formatINR } from '../../utils/formatters';

export const OrderDetail: React.FC = () => {
  const { id } = useParams();
  const order = mockSalesOrders.find(o => o.id === id) || mockSalesOrders[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-kiran"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sales Orders List</span>
        </Link>
        <span className="font-mono text-xs text-muted">
          Order Logged: {formatDate(order.orderDate)}
        </span>
      </div>

      {/* Main Header Card */}
      <div className="bg-surface border border-line rounded-lg p-6 shadow-card flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-semibold text-2xl text-ink font-mono">
              {order.poNumber}
            </h1>
            <StatusPill status={order.status} />
          </div>
          <div className="text-sm font-semibold text-slate-800 mt-1">
            {order.customerName} · <span className="font-mono text-slate-600 font-normal">{order.product}</span>
          </div>
          <div className="text-xs text-muted mt-0.5 font-mono">
            Part Number: {order.partNumber} · Linked RFQ: <Link to={`/rfq/${order.linkedRfqId}`} className="text-kiran hover:underline">{order.linkedRfqNumber}</Link>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-right">
          <div>
            <div className="text-[10px] text-muted uppercase">Total PO Value</div>
            <div className="text-lg font-bold text-ink">{formatINR(order.poValue)}</div>
          </div>
          <div className="pl-4 border-l border-line">
            <div className="text-[10px] text-muted uppercase">Pending Balance</div>
            <div className="text-lg font-bold text-strand-amber">{formatINR(order.balanceValue)}</div>
          </div>
        </div>
      </div>

      {/* Two Column Structure: Weekly Schedule + Work Orders & Dispatches */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Customer Weekly Schedule */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-kiran" />
                <h3 className="font-display font-semibold text-sm text-ink">
                  Customer Monthly Schedule (Weekly Buckets)
                </h3>
              </div>
              <span className="font-mono text-xs text-muted">{order.scheduleType}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
                  <tr>
                    <th className="p-2">Tranche / Week</th>
                    <th className="p-2 text-right">Scheduled Qty</th>
                    <th className="p-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.weeklyBuckets.map((bucket, idx) => (
                    <tr key={idx} className="hover:bg-canvas/60">
                      <td className="p-2 font-semibold text-ink">{bucket.week}</td>
                      <td className="p-2 text-right">{bucket.qty.toLocaleString('en-IN')}m</td>
                      <td className="p-2 text-right">
                        <StatusPill status={bucket.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Work Orders & Dispatches Made */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          
          {/* Work Orders Generated */}
          <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-strand-amber" />
                <h3 className="font-display font-semibold text-sm text-ink">
                  Production Work Orders (BOM Cut Length)
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              {order.workOrders.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted">
                  No work orders released to shop floor yet.
                </div>
              ) : (
                order.workOrders.map((wo) => (
                  <div
                    key={wo.id}
                    className="p-3 bg-canvas border border-line rounded flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <div className="font-semibold text-ink">{wo.id}</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        Cut: {wo.cutLength} · {wo.machine}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{wo.quantity.toLocaleString('en-IN')}m</div>
                      <StatusPill status={wo.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invoices & Dispatches Made */}
          <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-strand-green" />
                <h3 className="font-display font-semibold text-sm text-ink">
                  Dispatches & Invoices Raised
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              {order.dispatches.map((d, i) => (
                <div
                  key={i}
                  className="p-3 bg-white border border-line rounded flex items-center justify-between text-xs font-mono shadow-2xs"
                >
                  <div>
                    <span className="font-semibold text-kiran">{d.invoiceNo}</span>
                    <div className="text-[10px] text-muted">{formatDate(d.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{d.qty.toLocaleString('en-IN')}m</div>
                    <div className="text-slate-600 font-semibold">{formatINR(d.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
