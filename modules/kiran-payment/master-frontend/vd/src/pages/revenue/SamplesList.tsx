import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockSamples } from '../../data/samples';
import { mockRFQs } from '../../data/rfqs';
import { SampleRequest } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatDate } from '../../utils/formatters';
import { Plus, CheckCircle2, X } from 'lucide-react';

export const SamplesList: React.FC = () => {
  const [samples, setSamples] = useState<SampleRequest[]>(mockSamples);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRfqId, setSelectedRfqId] = useState(mockRFQs[0].id);
  const [sampleQty, setSampleQty] = useState('10');
  const [sampleRemarks, setSampleRemarks] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCreateSample = (e: React.FormEvent) => {
    e.preventDefault();
    const rfq = mockRFQs.find(r => r.id === selectedRfqId) || mockRFQs[0];
    const newSample: SampleRequest = {
      id: `SMP-2026-0${Math.floor(200 + Math.random() * 800)}`,
      sampleNumber: `SMP-2026-0${Math.floor(200 + Math.random() * 800)}`,
      rfqId: rfq.id,
      rfqNumber: rfq.rfqNumber,
      customerId: rfq.customerId,
      customerName: rfq.customerName,
      partNumber: rfq.partNumber,
      quantity: parseInt(sampleQty) || 10,
      uom: 'Metres',
      requestedById: 'EMP-001',
      requestedByName: 'Rajesh Kumar',
      status: 'Requested',
      daysPending: 1,
      remarks: sampleRemarks || 'Pre-qualification qualification sample',
      createdAt: '2026-08-19'
    };

    setSamples([newSample, ...samples]);
    setIsModalOpen(false);
    setToastMessage(`Sample ${newSample.sampleNumber} created.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const columns: ColumnDef<SampleRequest>[] = [
    {
      id: 'sampleNumber',
      header: 'Sample no.',
      accessorKey: 'sampleNumber',
      isMono: true,
      cell: (row) => <span className="whitespace-nowrap">{row.sampleNumber}</span>
    },
    {
      id: 'rfqNumber',
      header: 'RFQ',
      accessorKey: 'rfqNumber',
      cell: (row) => (
        <Link
          to={`/rfq/${row.rfqId}`}
          className="font-code text-[13px] text-kiran hover:underline whitespace-nowrap"
        >
          {row.rfqNumber}
        </Link>
      )
    },
    {
      id: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      cell: (row) => <span className="font-medium text-ink whitespace-nowrap">{row.customerName}</span>
    },
    {
      id: 'partNumber',
      header: 'Part',
      accessorKey: 'partNumber',
      cell: (row) => <span className="whitespace-nowrap">{row.partNumber}</span>
    },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorKey: 'quantity',
      isNumeric: true,
      cell: (row) => <span className="tabular-nums">{row.quantity} {row.uom}</span>
    },
    {
      id: 'requestedByName',
      header: 'Requested by',
      accessorKey: 'requestedByName',
      cell: (row) => <span className="whitespace-nowrap">{row.requestedByName}</span>
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
      id: 'daysPending',
      header: 'Pending',
      accessorKey: 'daysPending',
      isNumeric: true,
      cell: (row) => (
        <span className={`tabular-nums ${row.daysPending > 4 ? 'text-[#8A4F00] font-medium' : ''}`}>
          {row.daysPending}d
        </span>
      )
    },
    {
      id: 'remarks',
      header: 'Remarks',
      accessorKey: 'remarks',
      cell: (row) => (
        <div className="truncate max-w-[260px]" title={row.remarks}>
          {row.courierTracking && (
            <span className="font-code text-[13px] text-muted mr-2">{row.courierTracking}</span>
          )}
          <span>{row.remarks}</span>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover flex items-center gap-2.5 text-[14px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Samples"
        actions={
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New sample
          </button>
        }
      />

      <DataGrid
        data={samples}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search samples"
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-modal border border-line max-w-md w-full p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">New sample</h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-icon" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSample} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-muted mb-1.5">RFQ</label>
                <select
                  value={selectedRfqId}
                  onChange={(e) => setSelectedRfqId(e.target.value)}
                  className="field"
                  required
                >
                  {mockRFQs.map((rfq) => (
                    <option key={rfq.id} value={rfq.id}>
                      {rfq.rfqNumber} — {rfq.customerName} ({rfq.partNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-muted mb-1.5">Quantity (metres)</label>
                <input
                  type="number"
                  value={sampleQty}
                  onChange={(e) => setSampleQty(e.target.value)}
                  className="field"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-muted mb-1.5">Remarks</label>
                <textarea
                  rows={3}
                  value={sampleRemarks}
                  onChange={(e) => setSampleRemarks(e.target.value)}
                  className="field h-auto py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
