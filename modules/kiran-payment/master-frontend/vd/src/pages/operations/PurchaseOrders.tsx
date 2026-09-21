import React from 'react';
import { mockPurchaseOrders } from '../../data/purchase';
import { PurchaseOrderRecord } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatDate } from '../../utils/formatters';

export const PurchaseOrders: React.FC = () => {
  const columns: ColumnDef<PurchaseOrderRecord>[] = [
    {
      id: 'poNumber',
      header: 'PO no.',
      accessorKey: 'poNumber',
      isMono: true,
      cell: (row) => <span className="font-code text-[13px] text-ink whitespace-nowrap">{row.poNumber}</span>
    },
    {
      id: 'vendorName',
      header: 'Vendor',
      accessorKey: 'vendorName',
      cell: (row) => <span className="font-medium text-ink">{row.vendorName}</span>
    },
    {
      id: 'item',
      header: 'Item',
      accessorKey: 'item',
      cell: (row) => (
        <div>
          <div className="text-ink">{row.item}</div>
          <div className="text-[13px] text-muted">{row.quantity.toLocaleString('en-IN')} {row.uom}</div>
        </div>
      )
    },
    {
      id: 'value',
      header: 'Value',
      accessorKey: 'value',
      isNumeric: true,
      cell: (row) => <IndianRupee amount={row.value} />
    },
    {
      id: 'deliveryDate',
      header: 'Delivery',
      accessorKey: 'deliveryDate',
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.deliveryDate)}</span>
    },
    {
      id: 'sentToVendorAt',
      header: 'Sent to vendor',
      accessorKey: 'sentToVendorAt',
      cell: (row) => <span className="text-[13px] text-muted">{row.sentToVendorAt}</span>
    },
    {
      id: 'grnStatus',
      header: 'Receipt',
      accessorKey: 'grnStatus',
      cell: (row) => <StatusPill status={row.grnStatus} />
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
      <PageHeader title="Purchase orders" />

      <DataGrid
        data={mockPurchaseOrders}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search orders"
      />
    </div>
  );
};
