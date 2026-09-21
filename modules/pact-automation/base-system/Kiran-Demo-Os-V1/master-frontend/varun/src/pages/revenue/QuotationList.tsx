import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockQuotations } from '../../data/quotations';
import { Quotation } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatDate, formatINR } from '../../utils/formatters';
import { FileCheck2, Plus, AlertCircle } from 'lucide-react';

export const QuotationList: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('all');

  const filteredQuotes = mockQuotations.filter((q) => {
    if (activeTab === 'Awaiting HOD' && q.status !== 'Awaiting HOD') return false;
    if (activeTab === 'Sent' && q.status !== 'Sent') return false;
    if (activeTab === 'Expiring' && !q.isExpiringSoon) return false;
    return true;
  });

  const columns: ColumnDef<Quotation>[] = [
    {
      id: 'quoteNumber',
      header: 'Quote No.',
      accessorKey: 'quoteNumber',
      isMono: true,
      width: '140px',
      cell: (row) => (
        <Link
          to={`/quotations/${row.id}`}
          className="text-kiran hover:underline font-mono font-semibold"
        >
          {row.quoteNumber}
        </Link>
      )
    },
    {
      id: 'rfqNumber',
      header: 'RFQ Ref',
      accessorKey: 'rfqNumber',
      isMono: true,
      width: '130px',
      cell: (row) => (
        <Link
          to={`/rfq/${row.rfqId}`}
          className="font-mono text-xs text-slate-600 hover:text-ink"
        >
          {row.rfqNumber}
        </Link>
      )
    },
    {
      id: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      width: '220px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.customerName}</div>
          <div className="text-[12px] text-muted truncate">{row.contactPerson}</div>
        </div>
      )
    },
    {
      id: 'items',
      header: 'Items',
      width: '140px',
      cell: (row) => `${row.items.length} Product Line(s)`
    },
    {
      id: 'grandTotal',
      header: 'Total Value (incl GST)',
      accessorKey: 'grandTotal',
      isNumeric: true,
      isMono: true,
      width: '150px',
      cell: (row) => <IndianRupee amount={row.grandTotal} />
    },
    {
      id: 'marginPct',
      header: 'Margin %',
      accessorKey: 'marginPct',
      isNumeric: true,
      isMono: true,
      width: '100px',
      cell: (row) => `${row.marginPct}%`
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      width: '140px',
      cell: (row) => <StatusPill status={row.status} />
    },
    {
      id: 'validTill',
      header: 'Valid Till',
      accessorKey: 'validTill',
      isMono: true,
      width: '130px',
      cell: (row) => (
        <div className={row.isExpiringSoon ? 'text-strand-amber font-semibold flex items-center gap-1' : ''}>
          {row.isExpiringSoon && <AlertCircle className="w-3.5 h-3.5" />}
          <span>{formatDate(row.validTill)}</span>
        </div>
      )
    },
    {
      id: 'followUpsSent',
      header: 'Follow-ups',
      accessorKey: 'followUpsSent',
      isNumeric: true,
      isMono: true,
      width: '100px',
      cell: (row) => `${row.followUpsSent} sent`
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader
        title="Commercial Quotations"
        actions={
          <button
            onClick={() => navigate('/quotations/QTE-2026-0812')}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Quotation
          </button>
        }
      />

      <DataGrid
        data={filteredQuotes}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => navigate(`/quotations/${item.id}`)}
        searchPlaceholder="Search quotation number, customer name, RFQ ref..."
        savedViews={[
          { label: 'All Quotations', count: mockQuotations.length, active: activeTab === 'all', onClick: () => setActiveTab('all') },
          { label: 'Awaiting HOD', count: 1, active: activeTab === 'Awaiting HOD', onClick: () => setActiveTab('Awaiting HOD') },
          { label: 'Sent to Customer', count: 3, active: activeTab === 'Sent', onClick: () => setActiveTab('Sent') },
          { label: 'Expiring Soon (<5d)', count: 2, active: activeTab === 'Expiring', onClick: () => setActiveTab('Expiring') },
        ]}
      />
    </div>
  );
};
