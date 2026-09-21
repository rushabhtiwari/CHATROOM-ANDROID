import React from 'react';
import { mockPurchaseRequests } from '../../data/purchase';
import { PurchaseRequest } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { Plus } from 'lucide-react';

export const PurchaseRequests: React.FC = () => {
  const columns: ColumnDef<PurchaseRequest>[] = [
    {
      id: 'prNumber',
      header: 'Request no.',
      accessorKey: 'prNumber',
      isMono: true,
      cell: (row) => (
        <span
          className="font-code text-[13px] text-ink whitespace-nowrap"
          title={row.isAutoPopulatedMRP ? 'Auto-populated by Stock / MRP trigger' : undefined}
        >
          {row.prNumber}
        </span>
      )
    },
    {
      id: 'item',
      header: 'Item',
      accessorKey: 'item',
      cell: (row) => (
        <div>
          <div className="font-medium text-ink">{row.item}</div>
          <div className="text-[13px] text-muted">{row.partNumber} · {row.costCenter}</div>
        </div>
      )
    },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorKey: 'quantity',
      isNumeric: true,
      cell: (row) => `${row.quantity.toLocaleString('en-IN')} ${row.uom}`
    },
    {
      id: 'estimatedValue',
      header: 'Value',
      accessorKey: 'estimatedValue',
      isNumeric: true,
      cell: (row) => <IndianRupee amount={row.estimatedValue} />
    },
    {
      id: 'suggestedVendor',
      header: 'Vendor',
      accessorKey: 'suggestedVendor',
      cell: (row) => <span className="text-slate-800">{row.suggestedVendor}</span>
    },
    {
      id: 'approvalRoute',
      header: 'Source',
      accessorKey: 'approvalRoute',
      cell: (row) => <span className="text-[13px] text-muted">{row.approvalRoute}</span>
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
      <PageHeader
        title="Purchase requests"
        actions={
          <button onClick={() => alert('New purchase indent form')} className="btn-primary">
            <Plus className="w-4 h-4" />
            New request
          </button>
        }
      />

      <DataGrid
        data={mockPurchaseRequests}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search requests"
      />
    </div>
  );
};
