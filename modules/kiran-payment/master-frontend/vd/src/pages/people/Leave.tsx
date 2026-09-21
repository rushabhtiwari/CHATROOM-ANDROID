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
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Leave" />

      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#EBEBEF]">
        {(['Pending', 'All'] as View[]).map((entry) => (
          <button
            key={entry}
            onClick={() => setView(entry)}
            className={`h-7 px-3 rounded-md text-[13px] font-medium transition-colors ${
              view === entry ? 'bg-white text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {entry === 'Pending' ? 'To decide' : 'All'}
            <span className="ml-1.5 text-muted tabular-nums">
              {entry === 'Pending' ? pending.length : requests.length}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-surface-2 text-[13px] font-medium text-muted border-b border-line">
            <tr>
              <th className="px-4 py-3 font-medium">Request</th>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium text-right">Days</th>
              <th className="px-4 py-3 font-medium text-right">Balance</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line-2">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted">
                  No leave requests.
                </td>
              </tr>
            ) : (
              rows.map((request) => {
                const employee = employeeById(request.employeeId);
                const balance = LEAVE_ENTITLEMENT[request.type] - taken(request.employeeId, request.type);

                return (
                  <tr key={request.id} className="h-[52px] hover:bg-canvas">
                    <td className="px-4 py-3 font-code text-[13px] text-ink whitespace-nowrap">{request.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink whitespace-nowrap">{employee?.name ?? request.employeeId}</div>
                      <div className="text-[13px] text-muted">{employee?.department}</div>
                    </td>
                    <td className="px-4 py-3">{request.type}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateShort(request.from)}
                      {request.to !== request.from && ` to ${formatDateShort(request.to)}`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{request.days}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        balance < request.days && request.status === 'Pending'
                          ? 'text-strand-red font-medium'
                          : ''
                      }`}
                      title={`${request.type} leave remaining this year`}
                    >
                      {balance}d
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[260px] truncate" title={request.reason}>
                      {request.reason}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={request.status} />
                      {request.decidedBy && (
                        <div className="text-[13px] text-muted mt-1 whitespace-nowrap">{request.decidedBy}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {request.status === 'Pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDecision(request, 'Approved')}
                            className="btn-secondary"
                          >
                            <Check className="w-4 h-4 text-slate-500" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision(request, 'Rejected')}
                            className="btn-secondary text-strand-red"
                          >
                            <X className="w-4 h-4" />
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
