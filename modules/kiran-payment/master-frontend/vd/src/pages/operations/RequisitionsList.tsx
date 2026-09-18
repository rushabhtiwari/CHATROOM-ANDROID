import React, { useState } from 'react';
import { mockRequisitions } from '../../data/requisitions';
import { AdvanceRequisition } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  CreditCard,
  Plus,
  AlertCircle,
  Paperclip,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Send,
  ExternalLink
} from 'lucide-react';

export const RequisitionsList: React.FC = () => {
  const [requisitions, setRequisitions] = useState<AdvanceRequisition[]>(mockRequisitions);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleResendBillEmail = (reqNo: string, personName: string) => {
    setToastMessage(`Automated invoice request email re-sent to ${personName}.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const columns: ColumnDef<AdvanceRequisition>[] = [
    {
      id: 'reqNumber',
      header: 'Req No.',
      accessorKey: 'reqNumber',
      isMono: true,
      width: '140px',
      cell: (row) => <span className="font-mono font-semibold text-kiran">{row.reqNumber}</span>
    },
    {
      id: 'raisedByName',
      header: 'Raised By / Dept',
      accessorKey: 'raisedByName',
      width: '180px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.raisedByName}</div>
          <div className="text-[10px] text-muted font-mono">{row.department}</div>
        </div>
      )
    },
    {
      id: 'purpose',
      header: 'Purpose & Description',
      accessorKey: 'purpose',
      width: '280px',
      cell: (row) => <span className="text-xs text-slate-700">{row.purpose}</span>
    },
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'amount',
      isNumeric: true,
      isMono: true,
      width: '120px',
      cell: (row) => <IndianRupee amount={row.amount} />
    },
    {
      id: 'attachmentsCount',
      header: 'Attachments / Bills',
      width: '160px',
      cell: (row) => (
        <div>
          {row.hasMissingBill ? (
            <span className="px-2 py-0.5 rounded bg-red-100 text-strand-red font-semibold text-[10px] border border-red-200">
              Bill copy missing
            </span>
          ) : (
            <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
              <Paperclip className="w-3 h-3 text-muted" />
              {row.attachmentsCount} vouchers attached
            </span>
          )}
        </div>
      )
    },
    {
      id: 'pactSyncStatus',
      header: 'PACT ERP Status',
      width: '180px',
      cell: (row) => (
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
          row.pactSyncStatus === 'Posted to PACT'
            ? 'bg-emerald-50 text-strand-green border border-emerald-200 font-semibold'
            : 'bg-amber-50 text-strand-amber border border-amber-200 font-medium'
        }`}>
          {row.pactSyncStatus}
        </span>
      )
    },
    {
      id: 'approvalLevel',
      header: 'Approval Stage',
      width: '140px',
      cell: (row) => (
        <div className="flex items-center gap-1 font-mono text-xs">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
                step <= row.approvalLevel
                  ? 'bg-strand-green text-white'
                  : 'bg-line text-muted'
              }`}
            >
              {step}
            </div>
          ))}
          <span className="ml-1 text-[11px] text-muted font-sans">L{row.approvalLevel}/4</span>
        </div>
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
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Advance Requisitions & Expenditure Controls"
        actions={
          <button
            onClick={() => setToastMessage('Opened new requisition request form.')}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Raise Requisition
          </button>
        }
      />

      {/* Prior Unsettled Requisition Blocking Banner */}
      <div className="p-4 bg-red-50 border border-red-300 rounded-md text-xs text-red-950 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-strand-red shrink-0" />
          <div>
            <div className="font-bold text-strand-red">
              Cannot raise a new requisition — ₹24,000 from REQ-2026-0188 pending bill submission since 28 July
            </div>
            <p className="text-[11px] text-red-800 mt-0.5">
              Policy rule: Prior advances must have certified GST invoices submitted before next advance disbursement.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setToastMessage('Emergency HOD waiver request submitted to Rajesh Kumar.');
          }}
          className="px-3 py-1 bg-strand-red text-white rounded text-xs font-semibold hover:bg-red-700 shadow-xs"
        >
          Escalate to HOD for Emergency Waiver
        </button>
      </div>

      {/* Missing Bills Notice Card */}
      <div className="p-3 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-strand-amber shrink-0" />
          <span>
            <strong>REQ-2026-0214:</strong> Auto-email requesting hotel & taxi tax invoice copies sent to Priya Nair on 17 Aug. No response.
          </span>
        </div>
        <button
          onClick={() => handleResendBillEmail('REQ-2026-0214', 'Priya Nair')}
          className="px-2.5 py-1 bg-white hover:bg-canvas border border-amber-300 text-amber-900 rounded font-semibold text-[11px] shadow-2xs flex items-center gap-1"
        >
          <Send className="w-3 h-3 text-strand-amber" />
          Resend Request Email
        </button>
      </div>

      {/* Main Grid */}
      <DataGrid
        data={requisitions}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search requisition number, requester, purpose..."
      />
    </div>
  );
};
