import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockPurchaseOrders } from '../../data/purchase';
import { PurchaseOrderRecord } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatDate, formatINR } from '../../utils/formatters';
import {
  FileText,
  PackageCheck,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

export const PurchaseOrders: React.FC = () => {
  const navigate = useNavigate();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'active' | 'grn_pending' | 'completed'>('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleViewPO = (po: PurchaseOrderRecord) => {
    showToast(`PO ${po.poNumber} preview opened (${po.item} · ${formatINR(po.value)}).`);
  };

  const handleTrackGRN = (po: PurchaseOrderRecord) => {
    navigate('/purchase/grn');
  };

  const handleVendorSync = (po: PurchaseOrderRecord) => {
    showToast(`EDI dispatch sync refreshed for ${po.vendorName}. Acknowledged.`);
  };

  const filteredOrders = useMemo(() => {
    switch (activeView) {
      case 'active':
        return mockPurchaseOrders.filter((p) => p.status === 'Open' || p.status === 'In Transit');
      case 'grn_pending':
        return mockPurchaseOrders.filter((p) => p.grnStatus !== '3-Way Match Verified');
      case 'completed':
        return mockPurchaseOrders.filter((p) => p.status === 'Completed');
      case 'all':
      default:
        return mockPurchaseOrders;
    }
  }, [activeView]);

  const columns: ColumnDef<PurchaseOrderRecord>[] = [
    {
      id: 'poNumber',
      header: 'PO NUMBER',
      accessorKey: 'poNumber',
      isMono: true,
      width: '150px',
      cell: (row) => (
        <button
          onClick={() => handleViewPO(row)}
          className="font-mono font-semibold text-xs text-primary hover:underline flex items-center gap-1.5 focus:outline-none"
        >
          <FileText className="w-3.5 h-3.5 text-primary/70 shrink-0" />
          <span>{row.poNumber}</span>
        </button>
      )
    },
    {
      id: 'vendorName',
      header: 'SUPPLIER / VENDOR',
      accessorKey: 'vendorName',
      width: '240px',
      cell: (row) => (
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-xs text-on-surface truncate">{row.vendorName}</span>
          <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-surface-container text-outline shrink-0 font-medium">
            {row.vendorId}
          </span>
        </div>
      )
    },
    {
      id: 'item',
      header: 'RAW MATERIAL ITEM',
      accessorKey: 'item',
      width: '260px',
      cell: (row) => (
        <div className="flex items-center justify-between gap-2 truncate">
          <span className="font-medium text-xs text-on-surface truncate">{row.item}</span>
          <span className="text-[10px] text-outline font-mono shrink-0 tabular-nums">
            {row.quantity.toLocaleString('en-IN')} {row.uom}
          </span>
        </div>
      )
    },
    {
      id: 'value',
      header: 'PO VALUE',
      accessorKey: 'value',
      isNumeric: true,
      isMono: true,
      width: '130px',
      cell: (row) => (
        <span className="font-mono font-bold text-xs text-on-surface tabular-nums">
          {formatINR(row.value)}
        </span>
      )
    },
    {
      id: 'deliveryDate',
      header: 'PROMISED DELIVERY',
      accessorKey: 'deliveryDate',
      isMono: true,
      width: '140px',
      cell: (row) => (
        <span className="font-mono text-xs text-on-surface-variant tabular-nums">
          {formatDate(row.deliveryDate)}
        </span>
      )
    },
    {
      id: 'sentToVendorAt',
      header: 'DISPATCH SYNC',
      accessorKey: 'sentToVendorAt',
      width: '220px',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-badge bg-surface-container-low border border-outline-variant text-on-surface-variant truncate max-w-[210px]">
          <CheckCircle2 className="w-3 h-3 text-strand-green shrink-0" />
          <span className="truncate">{row.sentToVendorAt}</span>
        </span>
      )
    },
    {
      id: 'grnStatus',
      header: 'GRN STATUS',
      accessorKey: 'grnStatus',
      width: '160px',
      cell: (row) => {
        if (row.grnStatus === '3-Way Match Verified') {
          return (
            <span className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-[3px] rounded-badge text-[10.5px] font-medium leading-none border border-emerald-200 bg-emerald-50 text-emerald-800">
              <span className="w-[5px] h-[5px] rounded-full bg-strand-green shrink-0" />
              <span>3-Way Verified</span>
            </span>
          );
        }
        return <StatusPill status={row.grnStatus} />;
      }
    },
    {
      id: 'status',
      header: 'PO STATUS',
      accessorKey: 'status',
      width: '120px',
      cell: (row) => <StatusPill status={row.status} />
    },
    {
      id: 'actions',
      header: 'QUICK ACTIONS',
      width: '180px',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleViewPO(row)}
            title={`View PO ${row.poNumber}`}
            className="px-2 py-1 text-[10.5px] font-mono font-medium rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-on-surface flex items-center gap-1 transition-colors shadow-2xs"
          >
            <FileText className="w-3 h-3 text-outline" />
            <span>View</span>
          </button>

          <button
            onClick={() => handleTrackGRN(row)}
            title={`Track GRN for ${row.poNumber}`}
            className="px-2 py-1 text-[10.5px] font-mono font-medium rounded border border-outline-variant bg-surface-container-low hover:bg-surface-container text-primary flex items-center gap-1 transition-colors shadow-2xs"
          >
            <PackageCheck className="w-3 h-3 text-primary" />
            <span>GRN</span>
          </button>

          <button
            onClick={() => handleVendorSync(row)}
            title={`Sync EDI status with ${row.vendorName}`}
            className="p-1 rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
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

      <PageHeader
        category="PROCUREMENT & OPERATIONS"
        title="Supplier Purchase Orders"
        description="Real-time purchase order ledger, vendor EDI dispatch synchronization, delivery tracking, and GRN 3-way reconciliation states."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/purchase/grn')}
              className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <PackageCheck className="w-3.5 h-3.5 text-primary" />
              <span>Inspect 3-Way Match</span>
            </button>
            <button
              onClick={() => showToast('Triggered batch EDI sync with all 3 vendor supply chain portals.')}
              className="px-3.5 py-1.5 bg-primary hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Batch Sync Vendors</span>
            </button>
          </div>
        }
      />

      <DataGrid
        data={filteredOrders}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search PO number, supplier name, raw material..."
        savedViews={[
          { label: 'All Purchase Orders', count: mockPurchaseOrders.length, active: activeView === 'all', onClick: () => setActiveView('all') },
          { label: 'Open & In Transit', count: mockPurchaseOrders.filter((p) => p.status === 'Open' || p.status === 'In Transit').length, active: activeView === 'active', onClick: () => setActiveView('active') },
          { label: 'GRN Audit Pending', count: mockPurchaseOrders.filter((p) => p.grnStatus !== '3-Way Match Verified').length, active: activeView === 'grn_pending', onClick: () => setActiveView('grn_pending') },
          { label: 'Completed', count: mockPurchaseOrders.filter((p) => p.status === 'Completed').length, active: activeView === 'completed', onClick: () => setActiveView('completed') }
        ]}
        bulkActions={[
          {
            label: 'Batch Vendor EDI Sync',
            action: (selected) => {
              showToast(`Dispatched EDI status poll to ${selected.length} supplier supply chains.`);
            }
          },
          {
            label: 'Export Selected POs',
            action: (selected) => {
              showToast(`Exported ${selected.length} purchase order records.`);
            }
          }
        ]}
      />
    </div>
  );
};

