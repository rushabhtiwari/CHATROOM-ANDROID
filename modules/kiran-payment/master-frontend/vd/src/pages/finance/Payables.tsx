import React, { useState } from 'react';
import { mockPayables } from '../../data/accounts';
import { PayableVendor } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  Building2,
  AlertTriangle,
  Send,
  CheckCircle2,
  Calendar,
  CreditCard,
  Mail
} from 'lucide-react';

export const Payables: React.FC = () => {
  const [payables, setPayables] = useState<PayableVendor[]>(mockPayables);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleExecutePaymentRun = () => {
    setToastMessage('Payment batch submitted for Thursday disbursement run. Bank payment file generated.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const columns: ColumnDef<PayableVendor>[] = [
    {
      id: 'vendorName',
      header: 'Vendor Name',
      accessorKey: 'vendorName',
      width: '240px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.vendorName}</div>
          <div className="text-[10px] text-muted font-mono">{row.billsCount} Active Bills</div>
        </div>
      )
    },
    {
      id: 'totalOutstanding',
      header: 'Total Outstanding',
      accessorKey: 'totalOutstanding',
      isNumeric: true,
      isMono: true,
      width: '140px',
      cell: (row) => <span className="font-bold text-ink">{formatINR(row.totalOutstanding)}</span>
    },
    {
      id: 'dueThisWeek',
      header: 'Due This Week',
      accessorKey: 'dueThisWeek',
      isNumeric: true,
      isMono: true,
      width: '130px',
      cell: (row) => (
        <span className={row.dueThisWeek > 0 ? 'text-strand-amber font-semibold' : 'text-slate-500'}>
          {formatINR(row.dueThisWeek)}
        </span>
      )
    },
    {
      id: 'creditDays',
      header: 'Credit Term',
      accessorKey: 'creditDays',
      isMono: true,
      width: '110px',
      cell: (row) => `${row.creditDays} Days`
    },
    {
      id: 'daysOldestBill',
      header: 'Oldest Bill Age',
      accessorKey: 'daysOldestBill',
      isMono: true,
      width: '120px',
      cell: (row) => (
        <span className={row.is40DayAlert ? 'text-strand-red font-bold animate-pulse' : 'text-slate-700'}>
          {row.daysOldestBill} Days
        </span>
      )
    },
    {
      id: 'utrStatus',
      header: 'UTR / Remittance Status',
      width: '240px',
      cell: (row) => (
        <div className="text-xs">
          {row.utrNumber ? (
            <div className="font-mono text-xs">
              <span className="font-semibold text-kiran">{row.utrNumber}</span>
              <div className="text-[10px] text-muted">{row.utrMailSentAt}</div>
            </div>
          ) : (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-canvas border border-line text-slate-600">
              {row.utrStatus}
            </span>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Vendor Payables & UTR Remittance Tracker"
      />

      {/* 40-Day Credit Alert Banner */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-strand-amber/20 border border-strand-amber/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-strand-amber" />
          </div>
          <div>
            <div className="font-display font-semibold text-sm text-amber-950">
              3 vendors reach 40 days this week — 5 days remaining to pay
            </div>
            <p className="text-xs text-amber-800 mt-0.5">
              Saint-Gobain, Dow Chemical, and Reliance Industries are scheduled on the Thursday payment run to preserve MSME compliance.
            </p>
          </div>
        </div>

        <button
          onClick={handleExecutePaymentRun}
          className="px-4 py-1.5 bg-strand-amber hover:bg-amber-600 text-white font-semibold rounded text-xs shadow-xs"
        >
          Approve Thursday Payment Batch (₹73.50 L)
        </button>
      </div>

      {/* Main Vendor Grid */}
      <DataGrid
        data={payables}
        columns={columns}
        keyExtractor={(item) => item.vendorId}
        searchPlaceholder="Search vendor name, UTR number..."
      />
    </div>
  );
};
