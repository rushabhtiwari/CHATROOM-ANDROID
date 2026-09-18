import React from 'react';
import { mockPurchaseOrders } from '../../data/purchase';
import { PurchaseOrderRecord } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatDate, formatINR } from '../../utils/formatters';
import { FileCheck2, Plus, Send } from 'lucide-react';

export const PurchaseOrders: React.FC = () => {
  const columns: ColumnDef<PurchaseOrderRecord>[] = [
    {
      id: 'poNumber',
      header: 'PO No.',
      accessorKey: 'poNumber',
      isMono: true,
      width: '150px',
      cell: (row) => <span className="font-mono font-semibold text-kiran">{row.poNumber}</span>
    },
    {
      id: 'vendorName',
      header: 'Supplier / Vendor',
      accessorKey: 'vendorName',
      width: '240px',
      cell: (row) => <span className="font-semibold text-ink">{row.vendorName}</span>
    },
    {
      id: 'item',
      header: 'Raw Material Item',
      accessorKey: 'item',
      width: '240px',
      cell: (row) => (
        <div>
          <div className="font-medium text-ink">{row.item}</div>
          <div className="text-[10px] text-muted font-mono">{row.quantity.toLocaleString('en-IN')} {row.uom}</div>
        </div>
      )
    },
    {
      id: 'value',
      header: 'PO Value',
      accessorKey: 'value',
      isNumeric: true,
      isMono: true,
      width: '130px',
      cell: (row) => <IndianRupee amount={row.value} />
    },
    {
      id: 'deliveryDate',
      header: 'Promised Delivery',
      accessorKey: 'deliveryDate',
      isMono: true,
      width: '130px',
      cell: (row) => formatDate(row.deliveryDate)
    },
    {
      id: 'sentToVendorAt',
      header: 'Vendor Dispatch Sync',
      accessorKey: 'sentToVendorAt',
      width: '220px',
      cell: (row) => (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas border border-line text-slate-700">
          {row.sentToVendorAt}
        </span>
      )
    },
    {
      id: 'grnStatus',
      header: 'GRN Status',
      accessorKey: 'grnStatus',
      width: '160px',
      cell: (row) => <StatusPill status={row.grnStatus} />
    },
    {
      id: 'status',
      header: 'PO Status',
      accessorKey: 'status',
      width: '120px',
      cell: (row) => <StatusPill status={row.status} />
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader
        title="Supplier Purchase Orders"
      />

      <DataGrid
        data={mockPurchaseOrders}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search PO number, supplier name, raw material..."
      />
    </div>
  );
};
