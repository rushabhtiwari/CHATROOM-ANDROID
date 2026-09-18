import React from 'react';
import { mockPurchaseRequests } from '../../data/purchase';
import { PurchaseRequest } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import { Sparkles, Plus, ShoppingBag } from 'lucide-react';

export const PurchaseRequests: React.FC = () => {
  const columns: ColumnDef<PurchaseRequest>[] = [
    {
      id: 'prNumber',
      header: 'PR No.',
      accessorKey: 'prNumber',
      isMono: true,
      width: '140px',
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-mono font-semibold text-kiran">
          {row.isAutoPopulatedMRP && (
            <span className="w-1.5 h-1.5 rounded-full bg-ai" title="Auto-populated by Stock / MRP trigger" />
          )}
          <span>{row.prNumber}</span>
        </div>
      )
    },
    {
      id: 'item',
      header: 'Item & Specification',
      accessorKey: 'item',
      width: '260px',
      cell: (row) => (
        <div className={row.isAutoPopulatedMRP ? 'border-l-2 border-ai pl-2 py-0.5' : ''}>
          <div className="font-semibold text-ink">{row.item}</div>
          <div className="text-[10px] text-muted font-mono">{row.partNumber} · {row.costCenter}</div>
        </div>
      )
    },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorKey: 'quantity',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => `${row.quantity.toLocaleString('en-IN')} ${row.uom}`
    },
    {
      id: 'estimatedValue',
      header: 'Est. Value',
      accessorKey: 'estimatedValue',
      isNumeric: true,
      isMono: true,
      width: '130px',
      cell: (row) => <IndianRupee amount={row.estimatedValue} />
    },
    {
      id: 'suggestedVendor',
      header: 'Suggested Vendor',
      accessorKey: 'suggestedVendor',
      width: '220px',
      cell: (row) => <span className="text-xs text-slate-800">{row.suggestedVendor}</span>
    },
    {
      id: 'approvalRoute',
      header: 'Trigger Source / Route',
      accessorKey: 'approvalRoute',
      width: '240px',
      cell: (row) => (
        <span className={`text-[11px] ${row.isAutoPopulatedMRP ? 'text-ai font-medium' : 'text-slate-600'}`}>
          {row.approvalRoute}
        </span>
      )
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
        title="Purchase Requisitions & MRP Triggers"
        actions={
          <button
            onClick={() => alert('New purchase indent form')}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Raise Purchase Indent
          </button>
        }
      />

      <DataGrid
        data={mockPurchaseRequests}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search PR number, item description, suggested vendor..."
      />
    </div>
  );
};
