import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockApprovals } from '../../data/approvals';
import { ApprovalItem } from '../../types';
import { StatusPill } from '../../components/common/StatusPill';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatINR } from '../../utils/formatters';
import {
  CheckCircle2,
  XCircle,
  Eye,
  ExternalLink
} from 'lucide-react';

export const ApprovalsInbox: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(mockApprovals);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(mockApprovals[0]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const approvalTypes: { id: string; label: string; count: number }[] = [
    { id: 'all', label: 'All Pending Decisions', count: approvals.filter(a => a.status === 'Pending').length },
    { id: 'Price increase', label: 'Price Increase', count: approvals.filter(a => a.type === 'Price increase').length },
    { id: 'Purchase order', label: 'Purchase Orders', count: approvals.filter(a => a.type === 'Purchase order').length },
    { id: 'Requisition', label: 'Advance Requisitions', count: approvals.filter(a => a.type === 'Requisition').length },
    { id: 'Budget top-up', label: 'Budget Top-ups', count: approvals.filter(a => a.type === 'Budget top-up').length },
    { id: 'Stop-dispatch release', label: 'Stop-Dispatch Releases', count: approvals.filter(a => a.type === 'Stop-dispatch release').length },
    { id: 'Sample approval', label: 'Sample Approvals', count: approvals.filter(a => a.type === 'Sample approval').length },
    { id: 'Vendor onboarding', label: 'Vendor Onboarding', count: approvals.filter(a => a.type === 'Vendor onboarding').length },
    { id: 'Prompt change', label: 'AI Prompt Changes', count: approvals.filter(a => a.type === 'Prompt change').length },
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
    setToastMessage(`Marked as 'Seen' — reminder clock paused for 24 hours.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApprove = (id: string, e?: React.MouseEvent) =>
    updateApproval(id, 'Approved', 'Decision recorded: Approved.', e);

  const handleReject = (id: string, e?: React.MouseEvent) =>
    updateApproval(id, 'Rejected', 'Decision recorded: Rejected.', e);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Unified Governance & Approvals Inbox"
      />

      {/* Split Inbox Layout */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-0 bg-surface border border-line rounded-lg shadow-card overflow-hidden">
        
        {/* Left Filter Rail (3 cols) */}
        <div className="xl:col-span-3 border-r border-line p-3 overflow-y-auto bg-canvas/30 space-y-1 max-h-64 xl:max-h-none">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted font-mono mb-2 px-2">
            Decision Categories
          </div>
          {approvalTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`w-full px-2.5 py-2 rounded text-xs flex items-center justify-between transition-colors ${
                selectedType === type.id
                  ? 'bg-ink text-white font-semibold'
                  : 'hover:bg-slate-200/60 text-slate-700'
              }`}
            >
              <span>{type.label}</span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                  selectedType === type.id
                    ? 'bg-white/20 text-white'
                    : type.count > 0
                    ? 'bg-strand-amber/20 text-strand-amber font-bold'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {type.count}
              </span>
            </button>
          ))}
        </div>

        {/* Middle: Approval Items List (5 cols) */}
        <div className="xl:col-span-5 border-r border-line flex flex-col overflow-hidden min-h-0">
          <div className="p-3 border-b border-line bg-canvas/40 flex items-center justify-between text-xs font-mono">
            <span className="font-semibold text-ink uppercase">Queue Items ({filteredApprovals.length})</span>
            <span className="text-muted">Ranked by SLA Age</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {filteredApprovals.length === 0 ? (
              <div className="py-16 text-center text-muted text-xs">
                No pending approvals in this category.
              </div>
            ) : (
              filteredApprovals.map((app) => {
                const isSelected = selectedItem?.id === app.id;
                const isPending = app.status === 'Pending';

                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedItem(app)}
                    className={`p-3.5 cursor-pointer transition-colors space-y-2 ${
                      isSelected ? 'bg-kiran-tint/60' : 'hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <StatusPill status={app.type} />
                        {app.isAcknowledged && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 border border-line text-slate-600">
                            Seen
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-muted">
                        {app.ageHours}h / {app.slaHours}h SLA
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-ink line-clamp-2">
                      {app.subject}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-line/60 font-mono">
                      <span>Requester: <strong className="text-slate-700">{app.requesterName}</strong></span>
                      <span className="font-semibold text-ink">
                        {app.value ? formatINR(app.value) : 'Policy'}
                      </span>
                    </div>

                    {isPending && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={(e) => handleAcknowledge(app.id, e)}
                          disabled={app.isAcknowledged}
                          className="px-2 py-1 rounded bg-canvas hover:bg-slate-200 border border-line text-[10px] font-mono text-slate-600 flex items-center gap-1 disabled:opacity-40"
                          title="Acknowledge viewing without deciding yet"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{app.isAcknowledged ? 'Seen (Paused 24h)' : 'Mark Seen'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleReject(app.id, e)}
                            className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-strand-red text-xs font-semibold"
                          >
                            Reject
                          </button>
                          <button
                            onClick={(e) => handleApprove(app.id, e)}
                            className="px-3 py-1 rounded bg-strand-green hover:bg-emerald-600 text-white text-xs font-semibold shadow-xs"
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

        {/* Right Pane (4 cols): Detailed Approval Context & Audit Chain Drawer */}
        <div className="xl:col-span-4 p-5 overflow-y-auto space-y-5 bg-white flex flex-col justify-between min-h-0">
          {selectedItem ? (
            <div className="space-y-4">
              <div className="border-b border-line pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <StatusPill status={selectedItem.type} />
                  <StatusPill status={selectedItem.status} />
                </div>
                <h3 className="font-display font-semibold text-sm text-ink leading-snug">
                  {selectedItem.subject}
                </h3>
                <div className="text-xs text-muted font-mono mt-1">
                  Reference: <Link to={selectedItem.referenceLink} className="text-kiran hover:underline font-semibold">{selectedItem.referenceId}</Link>
                </div>
              </div>

              {/* Context Summary Box */}
              <div className="p-3 rounded bg-canvas border border-line space-y-1 text-xs">
                <div className="font-semibold text-ink text-[11px] uppercase tracking-wider font-mono">
                  Context Summary
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {selectedItem.contextSummary}
                </p>
                {selectedItem.value && (
                  <div className="pt-2 border-t border-line/60 font-mono text-ink font-bold flex items-center justify-between">
                    <span>Financial Exposure:</span>
                    <span className="text-sm text-kiran">{formatINR(selectedItem.value)}</span>
                  </div>
                )}
              </div>

              {/* Multi-tier Sign-off Chain */}
              <div className="space-y-2">
                <div className="font-semibold text-ink text-xs uppercase tracking-wider font-mono">
                  Multi-Tier Approval Hierarchy
                </div>
                <div className="space-y-2">
                  {selectedItem.signOffChain.map((step, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded border text-xs flex items-center justify-between ${
                        step.status === 'approved'
                          ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                          : step.status === 'current'
                          ? 'bg-amber-50/60 border-strand-amber text-amber-900 ring-1 ring-strand-amber'
                          : 'bg-canvas border-line text-slate-500'
                      }`}
                    >
                      <div>
                        <div className="font-semibold flex items-center gap-1.5">
                          {step.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-strand-green" />}
                          {step.role}
                        </div>
                        <div className="text-[11px] text-muted">{step.person}</div>
                      </div>
                      <span className="font-mono text-[10px] font-semibold">
                        {step.signedAt ? `Signed: ${step.signedAt}` : step.status === 'current' ? 'Awaiting Action' : 'Queued'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Jump Action */}
              <div className="pt-2">
                <Link
                  to={selectedItem.referenceLink}
                  className="w-full py-2 bg-canvas hover:bg-slate-200 border border-line rounded text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted" />
                  <span>Open Primary Record ({selectedItem.referenceId})</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted text-xs">
              Select an item to inspect approval context.
            </div>
          )}

          {selectedItem && selectedItem.status === 'Pending' && (
            <div className="pt-4 border-t border-line flex items-center gap-2">
              <button
                onClick={() => handleReject(selectedItem.id)}
                className="flex-1 py-2 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-strand-red text-xs font-semibold flex items-center justify-center gap-1"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => handleApprove(selectedItem.id)}
                className="flex-1 py-2 rounded bg-strand-green hover:bg-emerald-600 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
