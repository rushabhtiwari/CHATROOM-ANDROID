import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockSalesOrders, salesOrderSummary } from '../../data/orders';
import { SalesOrder } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatDate, formatINR, formatINRLakhCrore } from '../../utils/formatters';
import { ShoppingCart, Send, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export const OrdersList: React.FC = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<string>('all');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredOrders = mockSalesOrders.filter((o) => {
    if (activeView === 'Pending SO' && o.balanceQty <= 0) return false;
    if (activeView === 'Active' && o.status !== 'Active') return false;
    return true;
  });

  const columns: ColumnDef<SalesOrder>[] = [
    {
      id: 'poNumber',
      header: 'PO No.',
      accessorKey: 'poNumber',
      isMono: true,
      width: '150px',
      cell: (row) => (
        <Link
          to={`/orders/${row.id}`}
          className="text-kiran hover:underline font-mono font-semibold"
        >
          {row.poNumber}
        </Link>
      )
    },
    {
      id: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      width: '200px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.customerName}</div>
          <div className="text-[10px] text-muted font-mono">Linked: {row.linkedRfqNumber}</div>
        </div>
      )
    },
    {
      id: 'product',
      header: 'Product / Part',
      accessorKey: 'product',
      width: '220px',
      cell: (row) => (
        <div>
          <div className="font-medium text-ink text-xs">{row.product}</div>
          <div className="text-[10px] font-mono text-muted">{row.partNumber}</div>
        </div>
      )
    },
    {
      id: 'poQty',
      header: 'PO Qty',
      accessorKey: 'poQty',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => `${row.poQty.toLocaleString('en-IN')}m`
    },
    {
      id: 'executedQty',
      header: 'Executed Qty',
      accessorKey: 'executedQty',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => `${row.executedQty.toLocaleString('en-IN')}m`
    },
    {
      id: 'balanceQty',
      header: 'Balance Qty',
      accessorKey: 'balanceQty',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => (
        <span className={`font-semibold ${row.balanceQty > 0 ? 'text-strand-amber' : 'text-strand-green'}`}>
          {row.balanceQty.toLocaleString('en-IN')}m
        </span>
      )
    },
    {
      id: 'balanceValue',
      header: 'Balance Value',
      accessorKey: 'balanceValue',
      isNumeric: true,
      isMono: true,
      width: '130px',
      cell: (row) => <IndianRupee amount={row.balanceValue} />
    },
    {
      id: 'scheduleType',
      header: 'Schedule',
      accessorKey: 'scheduleType',
      width: '130px',
      cell: (row) => (
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-canvas border border-line text-slate-700">
          {row.scheduleType}
        </span>
      )
    },
    {
      id: 'nextDeliveryDate',
      header: 'Next Delivery',
      accessorKey: 'nextDeliveryDate',
      isMono: true,
      width: '120px',
      cell: (row) => formatDate(row.nextDeliveryDate)
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      width: '140px',
      cell: (row) => <StatusPill status={row.status} />
    }
  ];

  const handleSendEmail = () => {
    setIsEmailModalOpen(false);
    setToastMessage('Pending Sales Orders email dispatched to Vikram Shetty (Production Head).');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Sales Orders & Execution"
        actions={
          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="px-3 py-1.5 bg-ink hover:bg-ink-2 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5 text-strand-amber" />
            Send Pending SO Mail to Production
          </button>
        }
      />

      {/* Summary Strip (₹ Crore figures) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface border border-line rounded-lg p-4 shadow-card font-mono">
        <div className="p-3 bg-canvas/60 rounded border border-line">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted">
            Total Active PO Book
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-1">
            {formatINRLakhCrore(salesOrderSummary.totalPoValue)}
          </div>
          <div className="text-[11px] text-muted font-sans mt-0.5">Across 7 enterprise customers</div>
        </div>

        <div className="p-3 bg-emerald-50/50 rounded border border-emerald-200/60">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-emerald-800">
            Executed Value (MTD)
          </div>
          <div className="text-2xl font-display font-bold text-strand-green mt-1">
            {formatINRLakhCrore(salesOrderSummary.totalExecutedValue)}
          </div>
          <div className="text-[11px] text-emerald-700 font-sans mt-0.5">41.0% completion rate</div>
        </div>

        <div className="p-3 bg-amber-50/50 rounded border border-amber-200/60">
          <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-amber-800">
            Balance Pending Execution
          </div>
          <div className="text-2xl font-display font-bold text-strand-amber mt-1">
            {formatINRLakhCrore(salesOrderSummary.totalBalanceValue)}
          </div>
          <div className="text-[11px] text-amber-700 font-sans mt-0.5">59.0% scheduled for Aug-Sep</div>
        </div>
      </div>

      <DataGrid
        data={filteredOrders}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => navigate(`/orders/${item.id}`)}
        searchPlaceholder="Search customer, PO number, product name..."
        savedViews={[
          { label: 'All Orders', count: mockSalesOrders.length, active: activeView === 'all', onClick: () => setActiveView('all') },
          { label: 'Pending SO (Named View)', count: mockSalesOrders.filter(o => o.balanceQty > 0).length, active: activeView === 'Pending SO', onClick: () => setActiveView('Pending SO') },
          { label: 'Active', count: 6, active: activeView === 'Active', onClick: () => setActiveView('Active') }
        ]}
      />

      {/* Auto-generated Pending SO Email Preview Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-md shadow-popover border border-line max-w-2xl w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-kiran" />
                <h3 className="font-display font-semibold text-sm text-ink">
                  Auto-Generated Pending Sales Orders Notification
                </h3>
              </div>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="text-xs text-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-canvas rounded border border-line space-y-1">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-muted">To:</span>
                  <span className="font-semibold text-ink">Vikram Shetty &lt;vikram.shetty@kiranudyog.com&gt; (Production Head)</span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-muted">CC:</span>
                  <span>Neha Joshi (Planning), Rajesh Kumar (HOD Sales)</span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-muted">Subject:</span>
                  <span className="font-semibold text-ink">KiranOS: Priority Pending Sales Orders Schedule — 19 Aug 2026</span>
                </div>
              </div>

              {/* Email Content Preview */}
              <div className="p-4 bg-white border border-line rounded space-y-3 font-sans">
                <p className="text-slate-700">
                  Dear Vikram ji,
                </p>
                <p className="text-slate-700">
                  Below is the daily digest of priority pending sales order commitments requiring active production scheduling for the upcoming 7-day window:
                </p>

                <table className="w-full text-left font-mono text-[11px] border border-line">
                  <thead className="bg-canvas text-muted border-b border-line">
                    <tr>
                      <th className="p-1.5">Customer</th>
                      <th className="p-1.5">PO No</th>
                      <th className="p-1.5">Product</th>
                      <th className="p-1.5 text-right">Bal Qty</th>
                      <th className="p-1.5 text-right">Bal Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {mockSalesOrders.slice(0, 4).map((o, i) => (
                      <tr key={i}>
                        <td className="p-1.5 font-sans font-medium">{o.customerName}</td>
                        <td className="p-1.5">{o.poNumber}</td>
                        <td className="p-1.5 font-sans text-slate-600">{o.product}</td>
                        <td className="p-1.5 text-right font-bold text-strand-amber">{o.balanceQty.toLocaleString('en-IN')}m</td>
                        <td className="p-1.5 text-right">{formatINR(o.balanceValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="text-slate-600 text-[11px]">
                  Generated automatically by KiranOS Revenue & Planning Engine.
                </p>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-3 py-1.5 bg-canvas hover:bg-slate-200 border border-line text-xs font-medium text-slate rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  className="px-4 py-1.5 bg-kiran hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Dispatch Email Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
