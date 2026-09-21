import React from 'react';
import { mockCommitments } from '../../data/comms';
import { TrackedCommitment } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';

export const CommitmentsList: React.FC = () => {
  const columns: ColumnDef<TrackedCommitment>[] = [
    {
      id: 'personName',
      header: 'Person',
      accessorKey: 'personName',
      cell: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-medium text-ink">{row.personName}</div>
          <div className="text-[13px] text-muted">{row.department}</div>
        </div>
      )
    },
    {
      id: 'description',
      header: 'Promise',
      accessorKey: 'description',
      cell: (row) => <span className="text-ink">{row.description}</span>
    },
    {
      id: 'promisedByDate',
      header: 'Due',
      accessorKey: 'promisedByDate',
      cell: (row) => (
        <span className="whitespace-nowrap text-ink">{row.promisedByDate}</span>
      )
    },
    {
      id: 'sourceChannel',
      header: 'Source',
      accessorKey: 'sourceChannel',
      cell: (row) => (
        <span className="whitespace-nowrap text-muted" title={row.sourceMessage}>
          {row.sourceChannel}
        </span>
      )
    },
    {
      id: 'remindersSent',
      header: 'Reminders',
      accessorKey: 'remindersSent',
      isNumeric: true,
      cell: (row) => row.remindersSent
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <StatusPill status={row.status} />
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Commitments" />

      <DataGrid
        data={mockCommitments}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search"
      />
    </div>
  );
};
