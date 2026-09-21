import React from 'react';
import { mockCommitments } from '../../data/comms';
import { TrackedCommitment } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { Clock, Sparkles, CheckCircle2 } from 'lucide-react';

export const CommitmentsList: React.FC = () => {
  const columns: ColumnDef<TrackedCommitment>[] = [
    {
      id: 'personName',
      header: 'Person / Dept',
      accessorKey: 'personName',
      width: '180px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.personName}</div>
          <div className="text-[12px] text-muted font-mono">{row.department}</div>
        </div>
      )
    },
    {
      id: 'description',
      header: 'Promised Deliverable',
      accessorKey: 'description',
      width: '280px',
      cell: (row) => <span className="font-medium text-ink">{row.description}</span>
    },
    {
      id: 'promisedByDate',
      header: 'Promised By',
      accessorKey: 'promisedByDate',
      isMono: true,
      width: '130px',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-800 font-semibold">{row.promisedByDate}</span>
      )
    },
    {
      id: 'sourceChannel',
      header: 'Source Stream',
      accessorKey: 'sourceChannel',
      width: '200px',
      cell: (row) => (
        <div>
          <div className="text-xs text-kiran font-mono">{row.sourceChannel}</div>
          <div className="text-[12px] text-muted truncate italic">"{row.sourceMessage}"</div>
        </div>
      )
    },
    {
      id: 'remindersSent',
      header: 'Reminders Sent',
      accessorKey: 'remindersSent',
      isNumeric: true,
      isMono: true,
      width: '130px',
      cell: (row) => `${row.remindersSent} Sent`
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      width: '130px',
      cell: (row) => <StatusPill status={row.status} />
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader
        title="AI-Tracked Team Commitments"
      />

      <DataGrid
        data={mockCommitments}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search person name, promise, source stream..."
      />
    </div>
  );
};
