import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { formatDateShort } from '@/modules/rts/format';
import { LEAVE_ENTITLEMENT, useLeave, type LeaveRequest, type LeaveStatus } from '@/modules/hr/leave';

type View = 'Pending' | 'All';

/**
 * Leave requests. A decision here is sent to the employee through the same
 * activity feed the claim chain uses, so they hear it where they hear
 * everything else.
 */
export const Leave: React.FC = () => {
  const { employeeById, pushNotification } = useRts();
  const { currentUser } = useChat();
  const { requests, decide } = useLeave();
  const [view, setView] = useState<View>('Pending');

  const pending = requests.filter((request) => request.status === 'Pending');
  const rows = view === 'Pending' ? pending : requests;

  const taken = (employeeId: string, type: LeaveRequest['type']) =>
    requests
      .filter((r) => r.employeeId === employeeId && r.type === type && r.status === 'Approved')
      .reduce((days, r) => days + r.days, 0);

  const handleDecision = (request: LeaveRequest, status: Exclude<LeaveStatus, 'Pending'>) => {
    const employee = employeeById(request.employeeId);
    decide(request.id, status, currentUser.name);
    pushNotification({
      toRole: 'EMPLOYEE',
      toEmployeeId: request.employeeId,
      title: `Leave ${request.id} ${status.toLowerCase()} by HR`,
      body: `${request.days} day(s) of ${request.type.toLowerCase()} leave from ${formatDateShort(request.from)} to ${formatDateShort(request.to)}, decided by ${currentUser.name}.`,
    });
    toast.success(`${status} ${request.id} for ${employee?.name ?? request.employeeId}`);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader
        title="Leave"
        description="Requests waiting on HR and the record of what was decided. The employee is told through the activity feed."
      />

      <div className="flex items-center gap-1.5">
        {(['Pending', 'All'] as View[]).map((entry) => (
          <button
            key={entry}
            onClick={() => setView(entry)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              view === entry
                ? 'bg-kiran text-white border-kiran'
                : 'bg-surface text-slate-700 border-line hover:border-kiran/40'
            }`}
          >
            {entry === 'Pending' ? 'Awaiting decision' : 'All requests'}
            <span className="font-mono text-[10px] ml-1.5 opacity-75">
              {entry === 'Pending' ? pending.length : requests.length}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg shadow-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
            <tr>
              <th className="p-3 font-semibold">Request</th>
              <th className="p-3 font-semibold">Employee</th>
              <th className="p-3 font-semibold">Type</th>
              <th className="p-3 font-semibold">Dates</th>
              <th className="p-3 font-semibold text-right">Days</th>
              <th className="p-3 font-semibold text-right">Balance</th>
              <th className="p-3 font-semibold">Reason</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold text-right">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted">
                  No leave requests are waiting on HR.
                </td>
              </tr>
            ) : (
              rows.map((request) => {
                const employee = employeeById(request.employeeId);
                const balance = LEAVE_ENTITLEMENT[request.type] - taken(request.employeeId, request.type);

                return (
                  <tr key={request.id}>
                    <td className="p-3 font-mono font-semibold text-kiran">{request.id}</td>
                    <td className="p-3">
                      <div className="font-semibold text-ink">{employee?.name ?? request.employeeId}</div>
                      <div className="text-[11px] text-muted">{employee?.department}</div>
                    </td>
                    <td className="p-3">{request.type}</td>
                    <td className="p-3 font-mono whitespace-nowrap">
                      {formatDateShort(request.from)}
                      {request.to !== request.from && ` to ${formatDateShort(request.to)}`}
                    </td>
                    <td className="p-3 text-right font-mono">{request.days}</td>
                    <td
                      className={`p-3 text-right font-mono ${
                        balance < request.days && request.status === 'Pending'
                          ? 'text-strand-red font-semibold'
                          : 'text-slate-700'
                      }`}
                      title={`${request.type} leave remaining this year`}
                    >
                      {balance}d
                    </td>
                    <td className="p-3 text-slate-600 max-w-[260px] truncate" title={request.reason}>
                      {request.reason}
                    </td>
                    <td className="p-3">
                      <StatusPill status={request.status} />
                      {request.decidedBy && (
                        <div className="text-[10px] text-muted mt-1">by {request.decidedBy}</div>
                      )}
                    </td>
                    <td className="p-3">
                      {request.status === 'Pending' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDecision(request, 'Approved')}
                            className="px-2 py-1 rounded bg-strand-green text-white text-[11px] font-semibold hover:opacity-90 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision(request, 'Rejected')}
                            className="px-2 py-1 rounded border border-line text-slate-700 text-[11px] font-semibold hover:border-strand-red hover:text-strand-red flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
