import React from 'react';
import { BadgeCheck, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { DataGrid, ColumnDef } from '@/components/common/DataGrid';
import { useRts } from '@/modules/rts/store';
import { formatCurrency } from '@/modules/rts/format';
import type { Employee } from '@/modules/rts/types';

/**
 * The employee directory. These are the records claims are paid against, so
 * the bank column matters: the disbursement screen flags an unverified account
 * to Accounts, and clearing that flag is done here.
 */
export const Employees: React.FC = () => {
  const { employees, verifyBankAccount } = useRts();

  const columns: ColumnDef<Employee>[] = [
    {
      id: 'employeeCode',
      header: 'Code',
      accessorKey: 'employeeCode',
      isMono: true,
      width: '110px',
      cell: (row) => <span className="font-mono font-semibold text-kiran">{row.employeeCode}</span>,
    },
    {
      id: 'name',
      header: 'Employee',
      accessorKey: 'name',
      width: '220px',
      cell: (row) => (
        <div className="min-w-0">
          <div className="font-semibold text-ink truncate">{row.name}</div>
          <div className="text-[11px] text-muted truncate">{row.email}</div>
        </div>
      ),
    },
    { id: 'department', header: 'Department', accessorKey: 'department', width: '130px' },
    { id: 'designation', header: 'Designation', accessorKey: 'designation', width: '200px' },
    { id: 'managerName', header: 'Reports to', accessorKey: 'managerName', width: '150px' },
    {
      id: 'monthlyAllowance',
      header: 'Monthly allowance',
      accessorKey: 'monthlyAllowance',
      isNumeric: true,
      isMono: true,
      width: '150px',
      cell: (row) => formatCurrency(row.monthlyAllowance),
    },
    {
      id: 'usedThisMonth',
      header: 'Claimed',
      accessorKey: 'usedThisMonth',
      isNumeric: true,
      isMono: true,
      width: '120px',
      cell: (row) => formatCurrency(row.usedThisMonth),
    },
    {
      id: 'bank',
      header: 'Bank account',
      width: '230px',
      sortable: false,
      cell: (row) =>
        row.bankAccount.verified ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800">
            <BadgeCheck className="w-3.5 h-3.5 text-strand-green" />
            <span className="font-mono">{row.bankAccount.accountNumberMasked}</span>
            <span className="text-muted">{row.bankAccount.bankName}</span>
          </span>
        ) : (
          <button
            onClick={(event) => {
              event.stopPropagation();
              verifyBankAccount(row.id);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-strand-amber/40 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100"
            title="The disbursement screen flags this account to Accounts until it is verified"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Verify {row.bankAccount.accountNumberMasked}
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader
        title="Employees"
        description="The directory claims are paid against. An unverified bank account is flagged to Accounts at disbursement until it is verified here."
      />
      <DataGrid
        data={employees}
        columns={columns}
        keyExtractor={(employee) => employee.id}
        searchPlaceholder="Search by name, department or designation..."
        searchKey={(employee) => `${employee.name} ${employee.department} ${employee.designation} ${employee.employeeCode}`}
        initialSortKey="employeeCode"
        initialSortDir="asc"
        pageSize={15}
      />
    </div>
  );
};
