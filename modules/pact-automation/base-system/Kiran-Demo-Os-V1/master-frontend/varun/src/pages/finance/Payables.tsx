import React, { useState, useMemo } from 'react';
import { mockPayables } from '../../data/accounts';
import { PayableVendor } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import {
  Building2,
  AlertTriangle,
  Send,
  CheckCircle2,
  Calendar,
  CreditCard,
  Mail,
  Clock,
  RefreshCw,
  FileText
} from 'lucide-react';

export const Payables: React.FC = () => {
  const [payables, setPayables] = useState<PayableVendor[]>(mockPayables);
  const [activeFilter, setActiveFilter] = useState<'all' | 'alert' | 'due' | 'remitted'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExecutePaymentRun = () => {
    showToast('Disbursement batch approved for Thursday run (₹73.50 L). Bank payment file generated.');
  };

  const handlePayVendor = (vendor: PayableVendor) => {
    showToast(`Queued payment batch for ${vendor.vendorName} (${formatINR(vendor.dueThisWeek || vendor.totalOutstanding)}).`);
  };

  const handleViewLedger = (vendor: PayableVendor) => {
    showToast(`Opened vendor sub-ledger & voucher history for ${vendor.vendorName} (${vendor.vendorId}).`);
  };

  const handleSendAdvice = (vendor: PayableVendor) => {
    showToast(`Remittance advice PDF and UTR confirmation (${vendor.utrNumber}) emailed to ${vendor.vendorName} finance desk.`);
  };

  const filteredPayables = useMemo(() => {
    switch (activeFilter) {
      case 'alert':
        return payables.filter((p) => p.is40DayAlert);
      case 'due':
        return payables.filter((p) => p.dueThisWeek > 0);
      case 'remitted':
        return payables.filter((p) => !!p.utrNumber);
      case 'all':
      default:
        return payables;
    }
  }, [payables, activeFilter]);

  const columns: ColumnDef<PayableVendor>[] = [
    {
      id: 'vendorName',
      header: 'VENDOR NAME',
      accessorKey: 'vendorName',
      width: '240px',
      cell: (row) => (
        <div className="flex items-center gap-2 max-w-[240px] truncate">
          <span className="font-semibold text-xs text-on-surface truncate">{row.vendorName}</span>
          <span className="text-[10px] font-mono text-outline shrink-0 bg-surface-container px-1 py-0.5 rounded border border-outline-variant">
            {row.billsCount} bills
          </span>
        </div>
      )
    },
    {
      id: 'totalOutstanding',
      header: 'TOTAL OUTSTANDING',
      accessorKey: 'totalOutstanding',
      isNumeric: true,
      isMono: true,
      width: '140px',
      cell: (row) => <span className="font-bold text-on-surface tabular-nums">{formatINR(row.totalOutstanding)}</span>
    },
    {
      id: 'dueThisWeek',
      header: 'DUE THIS WEEK',
      accessorKey: 'dueThisWeek',
      isNumeric: true,
      isMono: true,
      width: '130px',
      cell: (row) =>
        row.dueThisWeek > 0 ? (
          <span className="text-strand-amber font-semibold tabular-nums">{formatINR(row.dueThisWeek)}</span>
        ) : (
          <span className="text-outline tabular-nums">—</span>
        )
    },
    {
      id: 'creditDays',
      header: 'CREDIT TERM',
      accessorKey: 'creditDays',
      isMono: true,
      width: '110px',
      cell: (row) => <span className="font-mono text-xs text-on-surface-variant">{row.creditDays}d net</span>
    },
    {
      id: 'daysOldestBill',
      header: 'OLDEST BILL AGE',
      accessorKey: 'daysOldestBill',
      isMono: true,
      width: '160px',
      cell: (row) =>
        row.is40DayAlert ? (
          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-strand-red bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3 text-strand-red shrink-0 animate-pulse" />
            <span>{row.daysOldestBill}d (40d+ MSME)</span>
          </span>
        ) : (
          <span className="font-mono text-xs text-on-surface-variant">{row.daysOldestBill} Days</span>
        )
    },
    {
      id: 'utrStatus',
      header: 'UTR / REMITTANCE',
      width: '200px',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs truncate">
          {row.utrNumber ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                {row.utrNumber}
              </span>
              <span className="text-[10px] text-outline font-mono truncate" title={row.utrMailSentAt}>
                Sent
              </span>
            </div>
          ) : row.utrStatus === 'Queued' ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-800 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
              <Clock className="w-3 h-3 text-strand-amber shrink-0" />
              <span>QUEUED (THU RUN)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant">
              {row.utrStatus}
            </span>
          )}
        </div>
      )
    },
    {
      id: 'actions',
      header: 'ACTIONS',
      width: '170px',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handlePayVendor(row)}
            className="px-2 py-0.5 text-[11px] font-mono font-medium rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
            title="Queue disbursement"
          >
            Pay
          </button>
          <button
            onClick={() => handleViewLedger(row)}
            className="px-2 py-0.5 text-[11px] font-mono font-medium rounded border border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            title="Open Vendor Subledger"
          >
            Ledger
          </button>
          <button
            onClick={() => handleSendAdvice(row)}
            disabled={!row.utrNumber}
            className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded border transition-colors ${
              row.utrNumber
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                : 'border-outline-variant bg-surface-container-lowest text-outline/40 cursor-not-allowed'
            }`}
            title={row.utrNumber ? 'Email Remittance Advice' : 'Requires completed UTR'}
          >
            Advice
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover border border-primary flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        category="ACCOUNTS PAYABLE & DISBURSEMENTS"
        title="Vendor Payables & UTR Remittance Tracker"
        description="Monitor vendor payment schedules, track UTR disbursement advices, and enforce 45-day MSME statutory compliance."
        actions={
          <button
            onClick={handleExecutePaymentRun}
            className="px-3.5 py-1.5 bg-strand-amber hover:bg-amber-600 text-white font-mono font-semibold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Approve Thursday Run (₹73.50 L)</span>
          </button>
        }
      />

      {/* Executive Summary 4-Across KPI Cards */}
      <LedgerBand cols={4}>
        <KPICard
          title="Total Outstanding"
          value={formatINRLakhCrore(24700000)}
          status="neutral"
          footerLeft="5 Active Vendors"
          footerRight="Net 30–45d"
        />
        <KPICard
          title="Due This Week"
          value={formatINRLakhCrore(7350000)}
          status="at_risk"
          footerLeft="Thursday Run"
          footerRight="4 Batches"
        />
        <KPICard
          title="MSME 40d Alert"
          value="3 Vendors"
          status="overdue"
          footerLeft="₹73.50 L at Risk"
          footerRight="5 Days to Limit"
        />
        <KPICard
          title="Remitted / UTR Sent"
          value={formatINRLakhCrore(340000)}
          status="on_track"
          footerLeft="PolyChem Emulsions"
          footerRight="UTR Dispatched"
        />
      </LedgerBand>

      {/* 40-Day Credit Warning Banner (Stitch Tokens) */}
      <div className="bg-surface-container-lowest border border-amber-500/40 border-l-4 border-l-strand-amber rounded-xl shadow-xs p-4 flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-start gap-3 max-w-3xl">
          <div className="w-8 h-8 rounded-lg bg-strand-amber/15 border border-strand-amber/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-strand-amber" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-strand-amber animate-pulse" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800">
                MSME Section 43B(h) Statutory Compliance Alert
              </span>
            </div>
            <div className="font-display font-semibold text-sm text-on-surface">
              3 vendors reach 40 days this week — 5 days remaining to statutory 45-day cycle
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
              Saint-Gobain, Dow Chemical, and Reliance Industries are scheduled on the Thursday payment run to prevent tax deduction disallowance and compound interest penalties.
            </p>
          </div>
        </div>

        <button
          onClick={handleExecutePaymentRun}
          className="px-3.5 py-1.5 bg-strand-amber hover:bg-amber-600 text-white font-mono font-semibold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition-all shrink-0"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Approve Thursday Payment Batch (₹73.50 L)</span>
        </button>
      </div>

      {/* Main Vendor Grid */}
      <DataGrid
        data={filteredPayables}
        columns={columns}
        keyExtractor={(item) => item.vendorId}
        searchPlaceholder="Search vendor name, UTR number..."
        savedViews={[
          { label: 'All Payables', count: payables.length, active: activeFilter === 'all', onClick: () => setActiveFilter('all') },
          { label: 'MSME 40d Alert', count: 3, active: activeFilter === 'alert', onClick: () => setActiveFilter('alert') },
          { label: 'Due This Week', count: 4, active: activeFilter === 'due', onClick: () => setActiveFilter('due') },
          { label: 'UTR Remitted', count: 1, active: activeFilter === 'remitted', onClick: () => setActiveFilter('remitted') }
        ]}
        bulkActions={[
          {
            label: 'Approve Selected for Thursday Run',
            action: (selected) => {
              showToast(`Approved ${selected.length} selected vendor payments for Thursday run.`);
            }
          },
          {
            label: 'Generate Bank Payment File',
            action: (selected) => {
              showToast(`Generated HDFC host-to-host payment batch file for ${selected.length} vendors.`);
            }
          }
        ]}
      />
    </div>
  );
};

