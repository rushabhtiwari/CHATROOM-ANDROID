import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockSamples } from '../../data/samples';
import { mockRFQs } from '../../data/rfqs';
import { SampleRequest } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatDate } from '../../utils/formatters';
import { PackageCheck, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';

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
    setToastMessage(`Sample ${newSample.sampleNumber} logged successfully against ${rfq.rfqNumber}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const columns: ColumnDef<SampleRequest>[] = [
    {
      id: 'sampleNumber',
      header: 'Sample No.',
      accessorKey: 'sampleNumber',
      isMono: true,
      width: '140px',
      cell: (row) => <span className="font-mono font-semibold text-kiran">{row.sampleNumber}</span>
    },
    {
      id: 'rfqNumber',
      header: 'Linked RFQ Ref',
      accessorKey: 'rfqNumber',
      isMono: true,
      width: '140px',
      cell: (row) => (
        <Link
          to={`/rfq/${row.rfqId}`}
          className="font-mono text-xs text-ink hover:underline font-semibold bg-canvas px-1.5 py-0.5 rounded border border-line"
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
      cell: (row) => <span className="font-semibold text-ink">{row.customerName}</span>
    },
    {
      id: 'partNumber',
      header: 'Part / Product',
      accessorKey: 'partNumber',
      isMono: true,
      width: '150px',
      cell: (row) => <span className="font-mono text-xs text-slate-800">{row.partNumber}</span>
    },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorKey: 'quantity',
      isNumeric: true,
      isMono: true,
      width: '100px',
      cell: (row) => `${row.quantity} ${row.uom}`
    },
    {
      id: 'requestedByName',
      header: 'Requested By',
      accessorKey: 'requestedByName',
      width: '140px',
      cell: (row) => <span className="text-xs text-slate-700">{row.requestedByName}</span>
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      width: '160px',
      cell: (row) => <StatusPill status={row.status} />
    },
    {
      id: 'daysPending',
      header: 'Days Pending',
      accessorKey: 'daysPending',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => (
        <span className={`font-mono text-xs ${row.daysPending > 4 ? 'text-strand-amber font-semibold' : 'text-slate'}`}>
          {row.daysPending}d
        </span>
      )
    },
    {
      id: 'remarks',
      header: 'Remarks & Courier AWB',
      accessorKey: 'remarks',
      width: '240px',
      cell: (row) => (
        <div className="text-xs text-slate-600 truncate max-w-[220px]">
          {row.courierTracking && (
            <span className="font-mono text-[12px] text-muted mr-1.5 bg-canvas px-1 rounded border border-line">
              {row.courierTracking}
            </span>
          )}
          <span>{row.remarks}</span>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Sample Requests & Approvals"
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Request Sample
          </button>
        }
      />

      <DataGrid
        data={samples}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search sample number, linked RFQ, customer..."
      />

      {/* Mandatory RFQ Link Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-md shadow-popover border border-line max-w-md w-full p-5 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display font-semibold text-sm text-ink">
                New Sample Qualification Request
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-xs text-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateSample} className="space-y-3 text-xs">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[12px] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-strand-amber shrink-0" />
                <span>Samples must mandatorily link to an existing RFQ reference.</span>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">
                  Select Parent RFQ Reference *
                </label>
                <select
                  value={selectedRfqId}
                  onChange={(e) => setSelectedRfqId(e.target.value)}
                  className="w-full p-2 bg-canvas border border-line rounded font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-kiran"
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
                <label className="block font-semibold text-ink mb-1">
                  Sample Quantity (Metres) *
                </label>
                <input
                  type="number"
                  value={sampleQty}
                  onChange={(e) => setSampleQty(e.target.value)}
                  className="w-full p-2 bg-canvas border border-line rounded font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-kiran"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">
                  Test / Qualification Remarks
                </label>
                <textarea
                  rows={3}
                  value={sampleRemarks}
                  onChange={(e) => setSampleRemarks(e.target.value)}
                  placeholder="e.g. UL94 V-0 flame test pre-qualification for customer EV harness R&D..."
                  className="w-full p-2 bg-canvas border border-line rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-kiran"
                />
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-canvas hover:bg-slate-200 border border-line text-xs font-medium text-slate rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-kiran hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs"
                >
                  Submit Sample Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
