import React from 'react';
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
      cell: (row) => <span className="font-code text-[13px] text-ink whitespace-nowrap">{row.employeeCode}</span>,
    },
    {
      id: 'name',
      header: 'Employee',
      accessorKey: 'name',
      cell: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-ink truncate">{row.name}</div>
          <div className="text-[13px] text-muted truncate">{row.email}</div>
        </div>
      ),
    },
    { id: 'department', header: 'Department', accessorKey: 'department' },
    { id: 'designation', header: 'Designation', accessorKey: 'designation' },
    { id: 'managerName', header: 'Reports to', accessorKey: 'managerName' },
    {
      id: 'monthlyAllowance',
      header: 'Allowance',
      accessorKey: 'monthlyAllowance',
      isNumeric: true,
      cell: (row) => formatCurrency(row.monthlyAllowance),
    },
    {
      id: 'usedThisMonth',
      header: 'Claimed',
      accessorKey: 'usedThisMonth',
      isNumeric: true,
      cell: (row) => formatCurrency(row.usedThisMonth),
    },
    {
      id: 'bank',
      header: 'Bank',
      sortable: false,
      cell: (row) =>
        row.bankAccount.verified ? (
          <span className="inline-flex items-center gap-2 text-[14px] whitespace-nowrap">
            <span className="text-ink tabular-nums">{row.bankAccount.accountNumberMasked}</span>
            <span className="text-muted">{row.bankAccount.bankName}</span>
          </span>
        ) : (
          <button
            onClick={(event) => {
              event.stopPropagation();
              verifyBankAccount(row.id);
            }}
            className="btn-secondary"
            title="The disbursement screen flags this account to Accounts until it is verified"
          >
            Verify {row.bankAccount.accountNumberMasked}
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Employees" />
      <DataGrid
        data={employees}
        columns={columns}
        keyExtractor={(employee) => employee.id}
        searchPlaceholder="Search employees"
        searchKey={(employee) => `${employee.name} ${employee.department} ${employee.designation} ${employee.employeeCode}`}
        initialSortKey="employeeCode"
        initialSortDir="asc"
        pageSize={15}
      />
    </div>
  );
};
