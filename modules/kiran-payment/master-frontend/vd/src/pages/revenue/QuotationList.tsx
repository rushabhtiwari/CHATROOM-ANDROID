import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockQuotations } from '../../data/quotations';
import { Quotation } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { IndianRupee } from '../../components/common/IndianRupee';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatDate, formatINR } from '../../utils/formatters';
import { Plus } from 'lucide-react';

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
      header: 'Quote no.',
      accessorKey: 'quoteNumber',
      isMono: true,
      cell: (row) => (
        <Link to={`/quotations/${row.id}`} className="text-kiran hover:underline whitespace-nowrap">
          {row.quoteNumber}
        </Link>
      )
    },
    {
      id: 'rfqNumber',
      header: 'RFQ',
      accessorKey: 'rfqNumber',
      cell: (row) => (
        <Link
          to={`/rfq/${row.rfqId}`}
          className="font-code text-[13px] text-ink-2 hover:text-ink hover:underline whitespace-nowrap"
        >
          {row.rfqNumber}
        </Link>
      )
    },
    {
      id: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      cell: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-medium text-ink">{row.customerName}</div>
          <div className="text-[12px] text-muted">{row.contactPerson}</div>
        </div>
      )
    },
    {
      id: 'items',
      header: 'Items',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums">{row.items.length}</span>
    },
    {
      id: 'grandTotal',
      header: 'Total',
      accessorKey: 'grandTotal',
      isNumeric: true,
      cell: (row) => <IndianRupee amount={row.grandTotal} />
    },
    {
      id: 'marginPct',
      header: 'Margin',
      accessorKey: 'marginPct',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums">{row.marginPct}%</span>
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => (
        <span className="whitespace-nowrap inline-block">
          <StatusPill status={row.status} />
        </span>
      )
    },
    {
      id: 'validTill',
      header: 'Valid till',
      accessorKey: 'validTill',
      cell: (row) => (
        <span className={`whitespace-nowrap ${row.isExpiringSoon ? 'text-[#8A4F00] font-medium' : ''}`}>
          {formatDate(row.validTill)}
        </span>
      )
    },
    {
      id: 'followUpsSent',
      header: 'Follow-ups',
      accessorKey: 'followUpsSent',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums">{row.followUpsSent}</span>
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Quotations"
        actions={
          <button onClick={() => navigate('/quotations/QTE-2026-0812')} className="btn-primary">
            <Plus className="w-4 h-4" />
            New quotation
          </button>
        }
      />

      <DataGrid
        data={filteredQuotes}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => navigate(`/quotations/${item.id}`)}
        searchPlaceholder="Search quotations"
        savedViews={[
          { label: 'All', count: mockQuotations.length, active: activeTab === 'all', onClick: () => setActiveTab('all') },
          { label: 'Awaiting HOD', count: 1, active: activeTab === 'Awaiting HOD', onClick: () => setActiveTab('Awaiting HOD') },
          { label: 'Sent', count: 3, active: activeTab === 'Sent', onClick: () => setActiveTab('Sent') },
          { label: 'Expiring', count: 2, active: activeTab === 'Expiring', onClick: () => setActiveTab('Expiring') },
        ]}
      />
    </div>
  );
};
