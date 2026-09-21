import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockApprovals } from '../../data/approvals';
import { ApprovalItem } from '../../types';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';
import { CheckCircle2 } from 'lucide-react';

export const ApprovalsInbox: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(mockApprovals);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(mockApprovals[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const approvalTypes: { id: string; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: approvals.filter(a => a.status === 'Pending').length },
    { id: 'Price increase', label: 'Price increases', count: approvals.filter(a => a.type === 'Price increase').length },
    { id: 'Purchase order', label: 'Purchase orders', count: approvals.filter(a => a.type === 'Purchase order').length },
    { id: 'Requisition', label: 'Requisitions', count: approvals.filter(a => a.type === 'Requisition').length },
    { id: 'Budget top-up', label: 'Budget top-ups', count: approvals.filter(a => a.type === 'Budget top-up').length },
    { id: 'Stop-dispatch release', label: 'Dispatch releases', count: approvals.filter(a => a.type === 'Stop-dispatch release').length },
    { id: 'Sample approval', label: 'Samples', count: approvals.filter(a => a.type === 'Sample approval').length },
    { id: 'Vendor onboarding', label: 'Vendors', count: approvals.filter(a => a.type === 'Vendor onboarding').length },
    { id: 'Prompt change', label: 'Prompt changes', count: approvals.filter(a => a.type === 'Prompt change').length },
  ];

  const filteredApprovals = approvals.filter((app) => {
    if (selectedType !== 'all' && app.type !== selectedType) return false;
    return true;
  });

  const updateApproval = (id: string, status: ApprovalItem['status'], message: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setApprovals(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, status } : a);
      setSelectedItem(updated.find(a => a.id === id) || null);
      return updated;
    });
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAcknowledge = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setApprovals(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, isAcknowledged: true } : a);
      setSelectedItem(updated.find(a => a.id === id) || null);
      return updated;
    });
    setToastMessage('Marked as seen.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApprove = (id: string, e?: React.MouseEvent) =>
    updateApproval(id, 'Approved', 'Approved.', e);

  const handleReject = (id: string, e?: React.MouseEvent) =>
    updateApproval(id, 'Rejected', 'Rejected.', e);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-6 animate-fadeIn">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover text-[13px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader title="Approvals" />

      {/* Split inbox layout */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 min-h-0 bg-surface border border-line rounded-lg overflow-hidden">

        {/* Left filter rail (3 cols) */}
        <div className="xl:col-span-3 border-r border-line p-3 overflow-y-auto space-y-0.5 max-h-64 xl:max-h-none">
          {approvalTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`w-full h-9 px-3 rounded-md text-[14px] flex items-center justify-between transition-colors ${
                selectedType === type.id
                  ? 'bg-kiran-tint text-[#0B4F9C] font-medium'
                  : 'hover:bg-black/5 text-slate-700'
              }`}
            >
              <span className="truncate">{type.label}</span>
              <span className="text-[13px] tabular-nums text-muted">{type.count}</span>
            </button>
          ))}
        </div>

        {/* Middle: approval items (5 cols) */}
        <div className="xl:col-span-5 border-r border-line flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto divide-y divide-line-2">
            {filteredApprovals.length === 0 ? (
              <div className="py-16 text-center text-muted text-[14px]">
                Nothing to approve.
              </div>
            ) : (
              filteredApprovals.map((app) => {
                const isSelected = selectedItem?.id === app.id;
                const isPending = app.status === 'Pending';

                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedItem(app)}
                    className={`px-5 py-4 cursor-pointer transition-colors space-y-2 ${
                      isSelected ? 'bg-kiran-tint' : 'hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-[14px] text-ink line-clamp-2">
                        {app.subject}
                      </div>
                      <span className="text-[14px] text-ink tabular-nums whitespace-nowrap">
                        {app.value ? formatINR(app.value) : 'Policy'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
                      <span className="truncate">
                        {app.type} · {app.requesterName}
                        {app.isAcknowledged && ' · Seen'}
                      </span>
                      <span
                        className={`whitespace-nowrap tabular-nums ${
                          app.ageHours >= app.slaHours ? 'text-strand-red' : ''
                        }`}
                        title={`${app.ageHours}h of ${app.slaHours}h`}
                      >
                        {app.ageHours}h / {app.slaHours}h
                      </span>
                    </div>

                    {isPending && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={(e) => handleAcknowledge(app.id, e)}
                          disabled={app.isAcknowledged}
                          className="btn-secondary"
                          title="Acknowledge viewing without deciding yet"
                        >
                          {app.isAcknowledged ? 'Seen' : 'Mark seen'}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleReject(app.id, e)}
                            className="btn-secondary text-strand-red"
                          >
                            Reject
                          </button>
                          <button
                            onClick={(e) => handleApprove(app.id, e)}
                            className="btn-secondary text-kiran"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane (4 cols): detail */}
        <div className="xl:col-span-4 p-5 overflow-y-auto space-y-5 bg-white flex flex-col justify-between min-h-0">
          {selectedItem ? (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <StatusPill status={selectedItem.type} />
                  <StatusPill status={selectedItem.status} />
                </div>
                <h3 className="text-[16px] font-semibold text-ink leading-snug">
                  {selectedItem.subject}
                </h3>
                <Link
                  to={selectedItem.referenceLink}
                  className="inline-block mt-1 font-code text-[13px] text-kiran hover:underline"
                >
                  {selectedItem.referenceId}
                </Link>
              </div>

              <p className="text-[14px] text-slate-700 leading-relaxed">
                {selectedItem.contextSummary}
              </p>

              {selectedItem.value && (
                <div className="flex items-center justify-between text-[14px] py-3 border-y border-line-2">
                  <span className="text-muted">Amount</span>
                  <span className="text-ink font-medium tabular-nums">{formatINR(selectedItem.value)}</span>
                </div>
              )}

              {/* Sign-off chain */}
              <div className="space-y-2">
                <div className="text-[13px] font-medium text-muted">Sign-off</div>
                <div className="divide-y divide-line-2">
                  {selectedItem.signOffChain.map((step, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-[14px]">
                      <div className="min-w-0">
                        <div className="text-ink flex items-center gap-1.5">
                          {step.status === 'approved' && <CheckCircle2 className="w-4 h-4 text-[#17723F] shrink-0" />}
                          <span className="truncate">{step.person}</span>
                        </div>
                        <div className="text-[13px] text-muted truncate">{step.role}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[12px] font-medium whitespace-nowrap ${
                          step.status === 'approved'
                            ? 'bg-[#E7F3EB] text-[#17723F]'
                            : step.status === 'current'
                            ? 'bg-[#FBEFDC] text-[#8A4F00]'
                            : 'bg-[#EFEFF2] text-[#48484F]'
                        }`}
                      >
                        {step.signedAt ? step.signedAt : step.status === 'current' ? 'Waiting' : 'Queued'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Link to={selectedItem.referenceLink} className="btn-secondary w-full">
                Open record
              </Link>
            </div>
          ) : (
            <div className="py-12 text-center text-muted text-[14px]">
              Select an item.
            </div>
          )}

          {selectedItem && selectedItem.status === 'Pending' && (
            <div className="pt-4 border-t border-line flex items-center justify-end gap-2">
              <button
                onClick={() => handleReject(selectedItem.id)}
                className="btn-secondary text-strand-red"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(selectedItem.id)}
                className="btn-primary"
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
