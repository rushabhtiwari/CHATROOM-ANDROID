import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockSalesOrders, salesOrderSummary } from '../../data/orders';
import { SalesOrder } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatDate, formatINR, formatINRLakhCrore } from '../../utils/formatters';
import { Send, Mail, CheckCircle2, X } from 'lucide-react';

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
      header: 'PO no.',
      accessorKey: 'poNumber',
      isMono: true,
      cell: (row) => (
        <Link to={`/orders/${row.id}`} className="text-kiran hover:underline whitespace-nowrap">
          {row.poNumber}
        </Link>
      )
    },
    {
      id: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      cell: (row) => <span className="font-medium text-ink whitespace-nowrap">{row.customerName}</span>
    },
    {
      id: 'product',
      header: 'Product',
      accessorKey: 'product',
      cell: (row) => (
        <div className="min-w-[200px]">
          <div className="text-ink truncate max-w-[280px]" title={row.product}>{row.product}</div>
          <div className="text-[12px] text-muted whitespace-nowrap">{row.partNumber}</div>
        </div>
      )
    },
    {
      id: 'poQty',
      header: 'Ordered',
      accessorKey: 'poQty',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums">{row.poQty.toLocaleString('en-IN')}m</span>
    },
    {
      id: 'executedQty',
      header: 'Executed',
      accessorKey: 'executedQty',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums">{row.executedQty.toLocaleString('en-IN')}m</span>
    },
    {
      id: 'balanceQty',
      header: 'Balance',
      accessorKey: 'balanceQty',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums text-ink">{row.balanceQty.toLocaleString('en-IN')}m</span>
    },
    {
      id: 'balanceValue',
      header: 'Balance value',
      accessorKey: 'balanceValue',
      isNumeric: true,
      cell: (row) => <IndianRupee amount={row.balanceValue} />
    },
    {
      id: 'scheduleType',
      header: 'Schedule',
      accessorKey: 'scheduleType',
      cell: (row) => <span className="whitespace-nowrap">{row.scheduleType}</span>
    },
    {
      id: 'nextDeliveryDate',
      header: 'Next delivery',
      accessorKey: 'nextDeliveryDate',
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.nextDeliveryDate)}</span>
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <span className="whitespace-nowrap inline-block"><StatusPill status={row.status} /></span>
    }
  ];

  const handleSendEmail = () => {
    setIsEmailModalOpen(false);
    setToastMessage('Email sent to production.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover flex items-center gap-2.5 text-[14px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Sales orders"
        actions={
          <button onClick={() => setIsEmailModalOpen(true)} className="btn-primary">
            <Mail className="w-4 h-4" />
            Email production
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi">
          <div className="kpi-label">Order book</div>
          <div className="kpi-value">{formatINRLakhCrore(salesOrderSummary.totalPoValue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Executed</div>
          <div className="kpi-value">{formatINRLakhCrore(salesOrderSummary.totalExecutedValue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pending</div>
          <div className="kpi-value">{formatINRLakhCrore(salesOrderSummary.totalBalanceValue)}</div>
        </div>
      </div>

      <DataGrid
        data={filteredOrders}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => navigate(`/orders/${item.id}`)}
        searchPlaceholder="Search orders"
        savedViews={[
          { label: 'All', count: mockSalesOrders.length, active: activeView === 'all', onClick: () => setActiveView('all') },
          { label: 'Pending', count: mockSalesOrders.filter(o => o.balanceQty > 0).length, active: activeView === 'Pending SO', onClick: () => setActiveView('Pending SO') },
          { label: 'Active', count: 6, active: activeView === 'Active', onClick: () => setActiveView('Active') }
        ]}
      />

      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-modal border border-line max-w-2xl w-full p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">Email production</h3>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="btn-icon"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-[14px]">
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-[13px] text-muted">To</span>
                <span className="text-ink">Vikram Shetty &lt;vikram.shetty@kiranudyog.com&gt;</span>
              </div>
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-[13px] text-muted">Cc</span>
                <span className="text-ink-2">Neha Joshi, Rajesh Kumar</span>
              </div>
              <div className="flex gap-3">
                <span className="w-16 shrink-0 text-[13px] text-muted">Subject</span>
                <span className="text-ink">Pending sales orders — 19 Aug 2026</span>
              </div>
            </div>

            <div className="border border-line rounded-lg overflow-hidden">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-surface-2 text-[13px] font-medium text-muted border-b border-line">
                  <tr>
                    <th className="px-4 h-11 font-medium">Customer</th>
                    <th className="px-4 h-11 font-medium">PO no.</th>
                    <th className="px-4 h-11 font-medium">Product</th>
                    <th className="px-4 h-11 font-medium text-right">Balance</th>
                    <th className="px-4 h-11 font-medium text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {mockSalesOrders.slice(0, 4).map((o, i) => (
                    <tr key={i} className="h-[52px] border-b border-line-2 last:border-b-0">
                      <td className="px-4 font-medium text-ink whitespace-nowrap">{o.customerName}</td>
                      <td className="px-4 font-code text-[13px] whitespace-nowrap">{o.poNumber}</td>
                      <td className="px-4 text-ink-2">{o.product}</td>
                      <td className="px-4 text-right tabular-nums whitespace-nowrap">{o.balanceQty.toLocaleString('en-IN')}m</td>
                      <td className="px-4 text-right tabular-nums whitespace-nowrap">{formatINR(o.balanceValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setIsEmailModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSendEmail} className="btn-primary">
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
