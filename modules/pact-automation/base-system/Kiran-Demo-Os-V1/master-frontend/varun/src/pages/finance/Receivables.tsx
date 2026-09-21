import React, { useState, useMemo } from 'react';
import { mockReceivables } from '../../data/accounts';
import { ReceivableCustomer } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';
import {
  Send,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  FileText
} from 'lucide-react';

export const Receivables: React.FC = () => {
  const [receivables, setReceivables] = useState<ReceivableCustomer[]>(mockReceivables);
  const [reminderCadence, setReminderCadence] = useState<number>(7);
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'risk' | 'ontrack'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSendReminders = (selected: ReceivableCustomer[]) => {
    const targets = selected.length > 0 ? selected : receivables.filter((r) => r.overdueAmount > 0);
    showToast(`Dispatched automated statements & reminders to ${targets.length} accounts.`);
  };

  const handleChaseSingleCustomer = (customer: ReceivableCustomer) => {
    showToast(`Dispatched automated statement & reminder to ${customer.customerName} (${customer.remindersCount + 1}th notice). Next auto-chase: ${customer.nextScheduled}`);
  };

  const handleViewLedger = (customer: ReceivableCustomer) => {
    showToast(`Opened customer ledger & invoice breakdown for ${customer.customerName} (${customer.customerId}).`);
  };

  const filteredReceivables = useMemo(() => {
    switch (activeFilter) {
      case 'overdue':
        return receivables.filter((r) => r.buckets.b61_90 > 0);
      case 'risk':
        return receivables.filter((r) => r.buckets.b46_60 > 0);
      case 'ontrack':
        return receivables.filter((r) => r.buckets.b46_60 === 0 && r.buckets.b61_90 === 0);
      case 'all':
      default:
        return receivables;
    }
  }, [receivables, activeFilter]);

  const columns: ColumnDef<ReceivableCustomer>[] = [
    {
      id: 'customerName',
      header: 'CUSTOMER NAME',
      accessorKey: 'customerName',
      width: '240px',
      cell: (row) => (
        <div className="flex items-center gap-2 max-w-[240px] truncate">
          <span className="font-semibold text-xs text-on-surface truncate">{row.customerName}</span>
          {row.buckets.b61_90 > 0 && (
            <span className="inline-flex items-center gap-0.5 font-mono text-[12px] font-bold text-strand-red bg-red-500/10 border border-red-500/30 px-1 py-0.5 rounded shrink-0 animate-pulse">
              <Ban className="w-2.5 h-2.5" />
              <span>STOP DISPATCH</span>
            </span>
          )}
          <span className="text-[12px] font-mono text-outline shrink-0 ml-auto">
            {row.region}
          </span>
        </div>
      )
    },
    {
      id: 'totalReceivable',
      header: 'TOTAL RECEIVABLE',
      accessorKey: 'totalReceivable',
      isNumeric: true,
      isMono: true,
      width: '135px',
      cell: (row) => <span className="font-bold text-on-surface tabular-nums">{formatINR(row.totalReceivable)}</span>
    },
    {
      id: 'b0_30',
      header: '0–30 DAYS',
      isNumeric: true,
      isMono: true,
      width: '100px',
      cell: (row) => <span className="text-strand-green font-medium tabular-nums">{formatINR(row.buckets.b0_30)}</span>
    },
    {
      id: 'b31_45',
      header: '31–45 DAYS',
      isNumeric: true,
      isMono: true,
      width: '100px',
      cell: (row) => <span className="text-on-surface-variant tabular-nums">{formatINR(row.buckets.b31_45)}</span>
    },
    {
      id: 'b46_60',
      header: '46–60 DAYS',
      isNumeric: true,
      isMono: true,
      width: '105px',
      cell: (row) =>
        row.buckets.b46_60 > 0 ? (
          <span className="text-strand-amber font-semibold tabular-nums">{formatINR(row.buckets.b46_60)}</span>
        ) : (
          <span className="text-outline tabular-nums">—</span>
        )
    },
    {
      id: 'b61_90',
      header: '61–90+ DAYS (OVERDUE)',
      isNumeric: true,
      isMono: true,
      width: '155px',
      cell: (row) =>
        row.buckets.b61_90 > 0 ? (
          <span className="inline-flex items-center gap-1 font-mono font-bold text-strand-red bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded text-xs tabular-nums">
            <AlertTriangle className="w-3 h-3 text-strand-red shrink-0" />
            <span>{formatINR(row.buckets.b61_90)}</span>
          </span>
        ) : (
          <span className="text-outline tabular-nums">—</span>
        )
    },
    {
      id: 'remindersCount',
      header: 'CHASER LOG',
      isMono: true,
      width: '130px',
      cell: (row) => (
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-mono text-xs font-semibold text-on-surface">{row.remindersCount} mails</span>
          <span className="text-[12px] font-mono text-outline truncate">
            ({row.lastReminderSent.split(' ')[0]} {row.lastReminderSent.split(' ')[1]})
          </span>
        </div>
      )
    },
    {
      id: 'nextScheduled',
      header: 'NEXT CHASE',
      accessorKey: 'nextScheduled',
      isMono: true,
      width: '110px',
      cell: (row) => (
        <span className="font-mono text-xs text-on-surface-variant">
          {row.nextScheduled.split(' ')[0]} {row.nextScheduled.split(' ')[1]}
        </span>
      )
    },
    {
      id: 'collectionStatus',
      header: 'STATUS',
      accessorKey: 'collectionStatus',
      width: '120px',
      cell: (row) => <StatusPill status={row.buckets.b61_90 > 0 ? 'stop dispatch blocked' : row.collectionStatus} />
    },
    {
      id: 'actions',
      header: 'ACTIONS',
      width: '140px',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleChaseSingleCustomer(row)}
            className="px-2 py-0.5 text-[12px] font-mono font-medium rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
            title="Dispatch statement reminder email"
          >
            Chase
          </button>
          <button
            onClick={() => handleViewLedger(row)}
            className="px-2 py-0.5 text-[12px] font-mono font-medium rounded border border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            title="View statements & invoices"
          >
            Ledger
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
        category="ACCOUNTS RECEIVABLE & COLLECTIONS"
        title="Customer Receivables & Automated Ageing Chaser"
        description="Monitor debtor ledger ageing buckets, configure automated cadence chasing, and review warehouse dispatch locks."
        actions={
          <div className="flex items-center gap-3">
            {/* Chaser Cadence Control */}
            <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs font-mono text-on-surface">
              <span className="text-outline text-[12px] font-semibold">Chaser Cadence:</span>
              <select
                value={reminderCadence}
                onChange={(e) => setReminderCadence(parseInt(e.target.value))}
                className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded px-2 py-0.5 text-xs font-mono font-semibold focus:outline-none focus:border-primary"
              >
                <option value={7}>Every 7 Days (Weekly)</option>
                <option value={14}>Every 14 Days (Bi-Weekly)</option>
                <option value={30}>Every 30 Days (Monthly)</option>
              </select>
            </div>

            <button
              onClick={() => handleSendReminders([])}
              className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Overdue Reminders Now</span>
            </button>
          </div>
        }
      />

      {/* Executive Summary 4-Across KPI Cards */}
      <LedgerBand cols={4}>
        <KPICard
          title="Total Receivables"
          value={formatINRLakhCrore(50610000)}
          status="on_track"
          footerLeft="5 Active Accounts"
          footerRight="DSO: 38 days"
        />
        <KPICard
          title="Current (0–30 Days)"
          value={formatINRLakhCrore(31700000)}
          status="on_track"
          footerLeft="62.6% of Ledger"
          footerRight="Healthy Turnover"
        />
        <KPICard
          title="At Risk (46–60 Days)"
          value={formatINRLakhCrore(3197850)}
          status="at_risk"
          footerLeft="3 Accounts"
          footerRight="Weekly Followup"
        />
        <KPICard
          title="Stop-Dispatch Hold (>60d)"
          value={formatINRLakhCrore(1362150)}
          status="overdue"
          footerLeft="1 Account Locked"
          footerRight="ERP Hold Engaged"
        />
      </LedgerBand>

      {/* 60-Day Overdue Stop-Dispatch Hold Alert Banner (Stitch Tokens) */}
      <div className="bg-surface-container-lowest border border-strand-red/40 border-l-4 border-l-strand-red rounded-xl shadow-xs p-4 flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-start gap-3 max-w-3xl">
          <div className="w-8 h-8 rounded-lg bg-strand-red/15 border border-strand-red/30 flex items-center justify-center shrink-0 mt-0.5">
            <Ban className="w-4 h-4 text-strand-red" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-strand-red animate-pulse" />
              <span className="font-mono text-[12px] font-bold text-strand-red">
                ERP Automated Safeguard · Stop-Dispatch Hold Active
              </span>
            </div>
            <div className="font-display font-semibold text-sm text-on-surface">
              1 Customer Under Active Stop-Dispatch Hold — Invoices Overdue &gt;60 Days
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
              Motherson Sumi Systems Ltd has ₹8.42 L overdue for 62 days. Warehouse goods dispatch lock is active until overdue clearing is verified by Accounts.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSendReminders(receivables.filter((r) => r.buckets.b61_90 > 0))}
          className="px-3.5 py-1.5 bg-strand-red hover:bg-red-700 text-white font-mono font-semibold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition-all shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Dispatch Urgent Notice (Motherson Sumi)</span>
        </button>
      </div>

      <DataGrid
        data={filteredReceivables}
        columns={columns}
        keyExtractor={(item) => item.customerId}
        searchPlaceholder="Search customer receivables..."
        savedViews={[
          { label: 'All Accounts', count: receivables.length, active: activeFilter === 'all', onClick: () => setActiveFilter('all') },
          { label: 'Overdue >60d (Stop-Dispatch)', count: 1, active: activeFilter === 'overdue', onClick: () => setActiveFilter('overdue') },
          { label: 'At Risk (46-60d)', count: 2, active: activeFilter === 'risk', onClick: () => setActiveFilter('risk') },
          { label: 'On Track (0-45d)', count: 2, active: activeFilter === 'ontrack', onClick: () => setActiveFilter('ontrack') }
        ]}
        bulkActions={[
          {
            label: 'Send Reminders to Selected',
            action: (selected) => handleSendReminders(selected)
          },
          {
            label: 'Generate Statements Batch',
            action: (selected) => {
              showToast(`Generated batch statement PDFs for ${selected.length} accounts.`);
            }
          }
        ]}
      />
    </div>
  );
};

