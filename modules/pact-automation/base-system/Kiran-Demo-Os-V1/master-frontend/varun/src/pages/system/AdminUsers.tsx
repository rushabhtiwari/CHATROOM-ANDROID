import React from 'react';
import { mockAdminUsers } from '../../data/admin';
import { AdminUser } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import { Users, Plus, ShieldCheck, Mail } from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const columns: ColumnDef<AdminUser>[] = [
    {
      id: 'name',
      header: 'Employee Name & Role',
      accessorKey: 'name',
      width: '240px',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-ink text-white font-mono text-[10px] flex items-center justify-center font-bold">
            {row.avatar}
          </div>
          <div>
            <div className="font-semibold text-ink text-xs">{row.name}</div>
            <div className="text-[10px] text-muted">{row.role}</div>
          </div>
        </div>
      )
    },
    {
      id: 'department',
      header: 'Department',
      accessorKey: 'department',
      width: '160px',
      cell: (row) => (
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-canvas border border-line text-slate-800">
          {row.department}
        </span>
      )
    },
    {
      id: 'email',
      header: 'Company Email',
      accessorKey: 'email',
      isMono: true,
      width: '240px',
      cell: (row) => <span className="text-slate-700 text-xs">{row.email}</span>
    },
    {
      id: 'accessTier',
      header: 'Access Tier',
      accessorKey: 'accessTier',
      width: '140px',
      cell: (row) => (
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
          row.accessTier === 'Superadmin'
            ? 'bg-purple-100 text-ai border border-purple-200'
            : row.accessTier === 'HOD Approver'
            ? 'bg-blue-100 text-kiran border border-blue-200'
            : 'bg-canvas text-slate-700'
        }`}>
          {row.accessTier}
        </span>
      )
    },
    {
      id: 'spendingAuthorityLimit',
      header: 'Spending Authority',
      accessorKey: 'spendingAuthorityLimit',
      isNumeric: true,
      isMono: true,
      width: '150px',
      cell: (row) => (
        <span className="font-mono font-semibold text-ink">
          {row.spendingAuthorityLimit ? `₹${(row.spendingAuthorityLimit / 100000).toFixed(1)} Lakhs` : 'Unlimited'}
        </span>
      )
    },
    {
      id: 'status',
      header: 'Account Status',
      accessorKey: 'status',
      width: '130px',
      cell: (row) => <StatusPill status={row.status} />
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader
        title="Employee Access & Permissions Matrix"
        actions={
          <button
            onClick={() => alert('New user provisioning modal')}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Provision Employee Access
          </button>
        }
      />

      <DataGrid
        data={mockAdminUsers}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search employee name, department, role..."
      />
    </div>
  );
};
