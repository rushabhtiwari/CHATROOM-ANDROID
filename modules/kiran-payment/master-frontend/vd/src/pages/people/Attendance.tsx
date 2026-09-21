import React from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { useRts } from '@/modules/rts/store';
import { attendanceFor, useLeave, type AttendanceStatus } from '@/modules/hr/leave';

const STATUS_CLASS: Record<AttendanceStatus, string> = {
  Present: 'bg-[#E7F3EB] text-[#17723F]',
  Remote: 'bg-kiran-tint text-[#0B4F9C]',
  Late: 'bg-[#FBEFDC] text-[#8A4F00]',
  'On Leave': 'bg-[#EFEFF2] text-[#48484F]',
};

/** Today's register. "On Leave" is whatever the leave screen has approved. */
export const Attendance: React.FC = () => {
  const { employees } = useRts();
  const { requests: leave } = useLeave();

  const rows = attendanceFor(
    employees.map((employee) => employee.id),
    leave,
  );
  const count = (status: AttendanceStatus) => rows.filter((row) => row.status === status).length;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Attendance"
        actions={<span className="text-[14px] text-muted whitespace-nowrap">{today}</span>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['Present', 'Remote', 'Late', 'On Leave'] as AttendanceStatus[]).map((status) => (
          <div key={status} className="kpi">
            <div className="kpi-label">{status === 'On Leave' ? 'On leave' : status}</div>
            <div className="kpi-value">{count(status)}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-surface-2 text-[13px] font-medium text-muted border-b border-line">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Today</th>
              <th className="px-4 py-3 font-medium text-right">Check-in</th>
              <th className="px-4 py-3 font-medium text-right">This month</th>
              <th className="px-4 py-3 font-medium w-[160px]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line-2">
            {rows.map((row, index) => {
              const employee = employees[index];
              const ratio = row.presentDays / row.workingDays;

              return (
                <tr key={row.employeeId} className="h-[52px] hover:bg-canvas">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink whitespace-nowrap">{employee.name}</div>
                    <div className="font-code text-[13px] text-muted">{employee.employeeCode}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{employee.department}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center h-6 px-2 rounded-md text-[13px] font-medium whitespace-nowrap ${STATUS_CLASS[row.status]}`}
                    >
                      {row.status === 'On Leave' ? 'On leave' : row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{row.checkIn ?? '–'}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {row.presentDays}/{row.workingDays}
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 rounded-full bg-[#EBEBEF] overflow-hidden">
                      <div
                        className={`h-full ${ratio < 0.85 ? 'bg-strand-red' : 'bg-kiran'}`}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
