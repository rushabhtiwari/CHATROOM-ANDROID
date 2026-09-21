import React, { useState } from 'react';
import { mockPayables } from '../../data/accounts';
import { PayableVendor } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';

export const Payables: React.FC = () => {
  const [payables] = useState<PayableVendor[]>(mockPayables);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleExecutePaymentRun = () => {
    setToastMessage('Payment batch approved for Thursday.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const columns: ColumnDef<PayableVendor>[] = [
    {
      id: 'vendorName',
      header: 'Vendor',
      accessorKey: 'vendorName',
      cell: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-medium text-ink">{row.vendorName}</div>
          <div className="text-[13px] text-muted">{row.billsCount} bills</div>
        </div>
      )
    },
    {
      id: 'totalOutstanding',
      header: 'Outstanding',
      accessorKey: 'totalOutstanding',
      isNumeric: true,
      cell: (row) => <span className="font-medium text-ink tabular-nums">{formatINR(row.totalOutstanding)}</span>
    },
    {
      id: 'dueThisWeek',
      header: 'Due this week',
      accessorKey: 'dueThisWeek',
      isNumeric: true,
      cell: (row) => (
        <span className={`tabular-nums ${row.dueThisWeek > 0 ? 'text-ink' : 'text-slate-400'}`}>
          {formatINR(row.dueThisWeek)}
        </span>
      )
    },
    {
      id: 'creditDays',
      header: 'Credit',
      accessorKey: 'creditDays',
      cell: (row) => <span className="whitespace-nowrap">{row.creditDays} days</span>
    },
    {
      id: 'daysOldestBill',
      header: 'Oldest bill',
      accessorKey: 'daysOldestBill',
      cell: (row) => (
        <span className={`whitespace-nowrap ${row.is40DayAlert ? 'text-strand-red font-medium' : ''}`}>
          {row.daysOldestBill} days
        </span>
      )
    },
    {
      id: 'utrStatus',
      header: 'UTR',
      cell: (row) =>
        row.utrNumber ? (
          <div className="whitespace-nowrap">
            <div className="font-code text-[13px] text-ink">{row.utrNumber}</div>
            <div className="text-[13px] text-muted">{row.utrMailSentAt}</div>
          </div>
        ) : (
          <span className="inline-flex items-center rounded-badge bg-[#EFEFF2] px-2 py-0.5 text-[12px] font-medium text-[#48484F] whitespace-nowrap">
            {row.utrStatus}
          </span>
        )
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover text-[13px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader
        title="Payables"
        actions={
          <button onClick={handleExecutePaymentRun} className="btn-primary">
            Approve batch · ₹73.50 L
          </button>
        }
      />

      <div className="rounded-lg bg-[#FBEFDC] px-4 py-3 text-[14px] text-[#8A4F00]">
        3 vendors reach 40 days this week: Saint-Gobain, Dow Chemical, Reliance Industries.
      </div>

      <DataGrid
        data={payables}
        columns={columns}
        keyExtractor={(item) => item.vendorId}
        searchPlaceholder="Search vendors"
      />
    </div>
  );
};
