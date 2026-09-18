import React, { useState } from 'react';
import { mockReceivables } from '../../data/accounts';
import { ReceivableCustomer } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import { Send, Mail, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export const Receivables: React.FC = () => {
  const [receivables, setReceivables] = useState<ReceivableCustomer[]>(mockReceivables);
  const [reminderCadence, setReminderCadence] = useState<number>(7);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSendReminders = (selected: ReceivableCustomer[]) => {
    const targets = selected.length > 0 ? selected : receivables.filter(r => r.overdueAmount > 0);
    setToastMessage(`Dispatched automated statements & reminders to ${targets.length} accounts.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const columns: ColumnDef<ReceivableCustomer>[] = [
    {
      id: 'customerName',
      header: 'Customer Name',
      accessorKey: 'customerName',
      width: '220px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.customerName}</div>
          <div className="text-[10px] text-muted font-mono">{row.region} Zone</div>
        </div>
      )
    },
    {
      id: 'totalReceivable',
      header: 'Total Receivable',
      accessorKey: 'totalReceivable',
      isNumeric: true,
      isMono: true,
      width: '140px',
      cell: (row) => <span className="font-bold text-ink">{formatINR(row.totalReceivable)}</span>
    },
    {
      id: 'b0_30',
      header: '0–30 Days',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => <span className="text-strand-green">{formatINR(row.buckets.b0_30)}</span>
    },
    {
      id: 'b31_45',
      header: '31–45 Days',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => formatINR(row.buckets.b31_45)
    },
    {
      id: 'b46_60',
      header: '46–60 Days',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => (
        <span className={row.buckets.b46_60 > 0 ? 'text-strand-amber font-semibold' : 'text-slate-400'}>
          {formatINR(row.buckets.b46_60)}
        </span>
      )
    },
    {
      id: 'b61_90',
      header: '61–90 Days (Overdue)',
      isNumeric: true,
      isMono: true,
      width: '140px',
      cell: (row) => (
        <span className={`font-bold ${row.buckets.b61_90 > 0 ? 'text-strand-red bg-red-50 px-1.5 py-0.5 rounded border border-red-200' : 'text-slate-400'}`}>
          {formatINR(row.buckets.b61_90)}
        </span>
      )
    },
    {
      id: 'remindersCount',
      header: 'Reminders Sent',
      isMono: true,
      width: '130px',
      cell: (row) => (
        <div>
          <div className="text-xs font-semibold">{row.remindersCount} Auto-mails</div>
          <div className="text-[10px] text-muted">Last: {row.lastReminderSent}</div>
        </div>
      )
    },
    {
      id: 'nextScheduled',
      header: 'Next Auto-Chase',
      accessorKey: 'nextScheduled',
      isMono: true,
      width: '130px',
      cell: (row) => <span className="text-slate-700">{row.nextScheduled}</span>
    },
    {
      id: 'collectionStatus',
      header: 'Status',
      accessorKey: 'collectionStatus',
      width: '120px',
      cell: (row) => <StatusPill status={row.collectionStatus} />
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Customer Receivables & Automated Ageing Chaser"
        actions={
          <div className="flex items-center gap-3">
            {/* Frequency Selector */}
            <div className="flex items-center gap-1.5 bg-canvas border border-line rounded px-2.5 py-1 text-xs font-mono">
              <span className="text-muted">Chaser Cadence:</span>
              <select
                value={reminderCadence}
                onChange={(e) => setReminderCadence(parseInt(e.target.value))}
                className="bg-transparent font-semibold text-ink focus:outline-none"
              >
                <option value={7}>Every 7 Days</option>
                <option value={14}>Every 14 Days</option>
                <option value={30}>Every 30 Days</option>
              </select>
            </div>

            <button
              onClick={() => handleSendReminders([])}
              className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Send Overdue Reminders Now
            </button>
          </div>
        }
      />

      <DataGrid
        data={receivables}
        columns={columns}
        keyExtractor={(item) => item.customerId}
        searchPlaceholder="Search customer receivables..."
        bulkActions={[
          {
            label: 'Send Reminders to Selected',
            action: (selected) => handleSendReminders(selected)
          }
        ]}
      />
    </div>
  );
};
