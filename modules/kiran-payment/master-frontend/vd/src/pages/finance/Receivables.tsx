import React, { useState } from 'react';
import { mockReceivables } from '../../data/accounts';
import { ReceivableCustomer } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';

export const Receivables: React.FC = () => {
  const [receivables] = useState<ReceivableCustomer[]>(mockReceivables);
  const [reminderCadence, setReminderCadence] = useState<number>(7);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSendReminders = (selected: ReceivableCustomer[]) => {
    const targets = selected.length > 0 ? selected : receivables.filter(r => r.overdueAmount > 0);
    setToastMessage(`Reminders sent to ${targets.length} customers.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const columns: ColumnDef<ReceivableCustomer>[] = [
    {
      id: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      cell: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-medium text-ink">{row.customerName}</div>
          <div className="text-[13px] text-muted">{row.region}</div>
        </div>
      )
    },
    {
      id: 'totalReceivable',
      header: 'Total',
      accessorKey: 'totalReceivable',
      isNumeric: true,
      cell: (row) => <span className="font-medium text-ink tabular-nums">{formatINR(row.totalReceivable)}</span>
    },
    {
      id: 'b0_30',
      header: '0–30 days',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums">{formatINR(row.buckets.b0_30)}</span>
    },
    {
      id: 'b31_45',
      header: '31–45 days',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums">{formatINR(row.buckets.b31_45)}</span>
    },
    {
      id: 'b46_60',
      header: '46–60 days',
      isNumeric: true,
      cell: (row) => (
        <span className={`tabular-nums ${row.buckets.b46_60 > 0 ? 'text-strand-amber' : 'text-slate-400'}`}>
          {formatINR(row.buckets.b46_60)}
        </span>
      )
    },
    {
      id: 'b61_90',
      header: '61–90 days',
      isNumeric: true,
      cell: (row) => (
        <span className={`tabular-nums ${row.buckets.b61_90 > 0 ? 'text-strand-red font-medium' : 'text-slate-400'}`}>
          {formatINR(row.buckets.b61_90)}
        </span>
      )
    },
    {
      id: 'remindersCount',
      header: 'Reminders',
      cell: (row) => (
        <div className="whitespace-nowrap">
          <div>{row.remindersCount}</div>
          <div className="text-[13px] text-muted">{row.lastReminderSent}</div>
        </div>
      )
    },
    {
      id: 'nextScheduled',
      header: 'Next reminder',
      accessorKey: 'nextScheduled',
      cell: (row) => <span className="whitespace-nowrap">{row.nextScheduled}</span>
    },
    {
      id: 'collectionStatus',
      header: 'Status',
      accessorKey: 'collectionStatus',
      cell: (row) => <StatusPill status={row.collectionStatus} />
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
        title="Receivables"
        actions={
          <div className="flex items-center gap-3">
            <select
              value={reminderCadence}
              onChange={(e) => setReminderCadence(parseInt(e.target.value))}
              className="field w-auto"
              aria-label="Reminder frequency"
            >
              <option value={7}>Every 7 days</option>
              <option value={14}>Every 14 days</option>
              <option value={30}>Every 30 days</option>
            </select>

            <button onClick={() => handleSendReminders([])} className="btn-primary">
              Send reminders
            </button>
          </div>
        }
      />

      <DataGrid
        data={receivables}
        columns={columns}
        keyExtractor={(item) => item.customerId}
        searchPlaceholder="Search customers"
        bulkActions={[
          {
            label: 'Send reminders',
            action: (selected) => handleSendReminders(selected)
          }
        ]}
      />
    </div>
  );
};
