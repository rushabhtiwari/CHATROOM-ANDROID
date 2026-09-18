import React from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { useRts } from '@/modules/rts/store';
import { attendanceFor, useLeave, type AttendanceStatus } from '@/modules/hr/leave';

const STATUS_CLASS: Record<AttendanceStatus, string> = {
  Present: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Remote: 'bg-teal-50 text-teal-800 border-teal-200',
  Late: 'bg-amber-50 text-amber-800 border-amber-200',
  'On Leave': 'bg-slate-100 text-slate-700 border-slate-200',
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
    <div className="space-y-5 animate-fadeIn">
      <PageHeader
        title="Attendance"
        description={`Register for ${today}. Anyone on approved leave is marked from the leave record.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['Present', 'Remote', 'Late', 'On Leave'] as AttendanceStatus[]).map((status) => (
          <div key={status} className="p-4 bg-surface border border-line rounded-md shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{status}</div>
            <div className="text-2xl font-display font-bold text-ink mt-1">{count(status)}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg shadow-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
            <tr>
              <th className="p-3 font-semibold">Employee</th>
              <th className="p-3 font-semibold">Department</th>
              <th className="p-3 font-semibold">Today</th>
              <th className="p-3 font-semibold text-right">Check-in</th>
              <th className="p-3 font-semibold text-right">This month</th>
              <th className="p-3 font-semibold w-[180px]">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => {
              const employee = employees[index];
              const ratio = row.presentDays / row.workingDays;

              return (
                <tr key={row.employeeId}>
                  <td className="p-3">
                    <div className="font-semibold text-ink">{employee.name}</div>
                    <div className="text-[11px] text-muted font-mono">{employee.employeeCode}</div>
                  </td>
                  <td className="p-3">{employee.department}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">{row.checkIn ?? '-'}</td>
                  <td className="p-3 text-right font-mono">
                    {row.presentDays}/{row.workingDays}
                  </td>
                  <td className="p-3">
                    <div className="h-1.5 rounded-full bg-canvas border border-line overflow-hidden">
                      <div
                        className={`h-full ${ratio < 0.85 ? 'bg-strand-amber' : 'bg-strand-green'}`}
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
