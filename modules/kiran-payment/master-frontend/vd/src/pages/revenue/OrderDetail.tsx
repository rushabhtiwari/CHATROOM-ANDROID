import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockSalesOrders } from '../../data/orders';
import { ArrowLeft } from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill';
import { formatDate, formatINR } from '../../utils/formatters';

export const OrderDetail: React.FC = () => {
  const { id } = useParams();
  const order = mockSalesOrders.find(o => o.id === id) || mockSalesOrders[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Sales orders</span>
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-code font-semibold text-[24px] leading-[1.2] text-ink">{order.poNumber}</h1>
            <StatusPill status={order.status} />
          </div>
          <div className="text-[14px] text-ink-2 mt-1.5">
            <span className="font-medium text-ink">{order.customerName}</span> · {order.product}
          </div>
          <div className="text-[13px] text-muted mt-0.5">
            {order.partNumber} ·{' '}
            <Link to={`/rfq/${order.linkedRfqId}`} className="font-code text-kiran hover:underline">
              {order.linkedRfqNumber}
            </Link>{' '}
            · {formatDate(order.orderDate)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="kpi">
          <div className="kpi-label">PO value</div>
          <div className="kpi-value">{formatINR(order.poValue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pending</div>
          <div className="kpi-value">{formatINR(order.balanceValue)}</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <div className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">Schedule</h3>
              <span className="text-[13px] text-muted">{order.scheduleType}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-surface-2 text-[13px] font-medium text-muted border-y border-line">
                  <tr>
                    <th className="px-4 pl-5 h-11 font-medium">Week</th>
                    <th className="px-4 h-11 font-medium text-right">Quantity</th>
                    <th className="px-4 pr-5 h-11 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {order.weeklyBuckets.map((bucket, idx) => (
                    <tr key={idx} className="h-[52px] border-b border-line-2 last:border-b-0 hover:bg-canvas">
                      <td className="px-4 pl-5 font-medium text-ink whitespace-nowrap">{bucket.week}</td>
                      <td className="px-4 text-right tabular-nums whitespace-nowrap">{bucket.qty.toLocaleString('en-IN')}m</td>
                      <td className="px-4 pr-5 text-right whitespace-nowrap">
                        <StatusPill status={bucket.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="bg-surface border border-line rounded-lg p-5">
            <h3 className="text-[16px] font-semibold text-ink mb-2">Work orders</h3>

            {order.workOrders.length === 0 ? (
              <div className="py-4 text-[14px] text-muted">No work orders yet.</div>
            ) : (
              <div className="divide-y divide-line-2">
                {order.workOrders.map((wo) => (
                  <div key={wo.id} className="py-3 flex items-center justify-between gap-3 text-[14px]">
                    <div>
                      <div className="font-code text-[13px] text-ink">{wo.id}</div>
                      <div className="text-[13px] text-muted mt-0.5">
                        {wo.cutLength} · {wo.machine}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums whitespace-nowrap">{wo.quantity.toLocaleString('en-IN')}m</span>
                      <StatusPill status={wo.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface border border-line rounded-lg p-5">
            <h3 className="text-[16px] font-semibold text-ink mb-2">Dispatches</h3>

            <div className="divide-y divide-line-2">
              {order.dispatches.map((d, i) => (
                <div key={i} className="py-3 flex items-center justify-between gap-3 text-[14px]">
                  <div>
                    <div className="font-code text-[13px] text-ink">{d.invoiceNo}</div>
                    <div className="text-[13px] text-muted mt-0.5 whitespace-nowrap">{formatDate(d.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-ink tabular-nums whitespace-nowrap">{formatINR(d.amount)}</div>
                    <div className="text-[13px] text-muted tabular-nums">{d.qty.toLocaleString('en-IN')}m</div>
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
