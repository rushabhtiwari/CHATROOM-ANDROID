import React, { useState } from 'react';
import { mockRequisitions } from '../../data/requisitions';
import { AdvanceRequisition } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { Plus } from 'lucide-react';

const PILL = 'inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium whitespace-nowrap';

export const RequisitionsList: React.FC = () => {
  const [requisitions, setRequisitions] = useState<AdvanceRequisition[]>(mockRequisitions);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleResendBillEmail = (reqNo: string, personName: string) => {
    setToastMessage(`Reminder sent to ${personName}.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const columns: ColumnDef<AdvanceRequisition>[] = [
    {
      id: 'reqNumber',
      header: 'Request no.',
      accessorKey: 'reqNumber',
      isMono: true,
      cell: (row) => <span className="font-code text-[13px] text-ink whitespace-nowrap">{row.reqNumber}</span>
    },
    {
      id: 'raisedByName',
      header: 'Raised by',
      accessorKey: 'raisedByName',
      cell: (row) => (
        <div>
          <div className="font-medium text-ink whitespace-nowrap">{row.raisedByName}</div>
          <div className="text-[13px] text-muted">{row.department}</div>
        </div>
      )
    },
    {
      id: 'purpose',
      header: 'Purpose',
      accessorKey: 'purpose',
      cell: (row) => <span className="text-slate-700">{row.purpose}</span>
    },
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'amount',
      isNumeric: true,
      cell: (row) => <IndianRupee amount={row.amount} />
    },
    {
      id: 'attachmentsCount',
      header: 'Bills',
      cell: (row) =>
        row.hasMissingBill ? (
          <span className={`${PILL} bg-[#FBE9E7] text-[#B3302A]`}>Missing</span>
        ) : (
          <span className="text-slate-700 tabular-nums whitespace-nowrap">{row.attachmentsCount} attached</span>
        )
    },
    {
      id: 'pactSyncStatus',
      header: 'PACT',
      cell: (row) => (
        <span
          className={`${PILL} ${
            row.pactSyncStatus === 'Posted to PACT'
              ? 'bg-[#E7F3EB] text-[#17723F]'
              : 'bg-[#FBEFDC] text-[#8A4F00]'
          }`}
        >
          {row.pactSyncStatus}
        </span>
      )
    },
    {
      id: 'approvalLevel',
      header: 'Approval',
      cell: (row) => (
        <span className="text-slate-700 tabular-nums whitespace-nowrap">Level {row.approvalLevel} of 4</span>
      )
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
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover text-[14px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader
        title="Advance requests"
        actions={
          <button onClick={() => setToastMessage('Opened new requisition request form.')} className="btn-primary">
            <Plus className="w-4 h-4" />
            New request
          </button>
        }
      />

      <div className="bg-surface border border-line rounded-lg divide-y divide-line-2">
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[14px] text-ink">
            <span className={`${PILL} bg-[#FBE9E7] text-[#B3302A]`}>Blocked</span>
            <span>
              ₹24,000 from <span className="font-code text-[13px]">REQ-2026-0188</span> needs bills, pending since 28 July.
            </span>
          </div>
          <button
            onClick={() => {
              setToastMessage('Emergency HOD waiver request submitted to Rajesh Kumar.');
            }}
            className="btn-secondary"
          >
            Ask for waiver
          </button>
        </div>

        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[14px] text-ink">
            <span className={`${PILL} bg-[#FBEFDC] text-[#8A4F00]`}>Waiting</span>
            <span>
              <span className="font-code text-[13px]">REQ-2026-0214</span> bills requested from Priya Nair on 17 Aug. No reply.
            </span>
          </div>
          <button onClick={() => handleResendBillEmail('REQ-2026-0214', 'Priya Nair')} className="btn-secondary">
            Remind
          </button>
        </div>
      </div>

      <DataGrid
        data={requisitions}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search requests"
      />
    </div>
  );
};
