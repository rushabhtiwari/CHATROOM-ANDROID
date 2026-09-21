/**
 * Reimbursement claims.
 *
 * One table, filtered by who has to act next. That framing is deliberate: the
 * question people arrive with is never "show me claims", it is "what is
 * waiting on me" or "where has mine got to". The tabs answer both, and the
 * counts on them are the only status report most days need.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText, WifiOff } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { PageTabs } from '@/components/common/PageTabs';
import { DataGrid, type ColumnDef } from '@/components/common/DataGrid';
import { EmptyState } from '@/components/common/EmptyState';
import { useRts } from '@/modules/rts/store';
import { formatCurrency, formatDate } from '@/modules/rts/format';
import { CATEGORY_LABEL, actionOwner, statusLabel } from '@/modules/rts/status';
import type { ReceiptRequest } from '@/modules/rts/types';
import { ClaimStatusPill } from './ClaimStatusPill';
import { ClaimSummaryBar } from './ClaimSummaryBar';

type Scope = 'all' | 'hr' | 'accounts' | 'payment' | 'settled';

const TITLE: Record<Scope, string> = {
  all: 'All claims',
  hr: 'With HR',
  accounts: 'With accounts',
  payment: 'To pay',
  settled: 'Settled',
};

export const ReimbursementsList: React.FC = () => {
  const navigate = useNavigate();
  const { requests, employeeById, connected, loading } = useRts();
  const [scope, setScope] = useState<Scope>('all');

  const buckets = useMemo(() => {
    const owner = (request: ReceiptRequest) => actionOwner(request.status);
    return {
      all: requests,
      hr: requests.filter((request) => owner(request) === 'HR'),
      accounts: requests.filter((request) => owner(request) === 'ACCOUNTS'),
      payment: requests.filter((request) => owner(request) === 'PAYMENTS'),
      settled: requests.filter(
        (request) => request.status === 'CREDITED' || request.status === 'PAID',
      ),
    } satisfies Record<Scope, ReceiptRequest[]>;
  }, [requests]);

  const rows = buckets[scope];

  const columns: ColumnDef<ReceiptRequest>[] = [
    {
      id: 'id',
      header: 'Claim',
      isMono: true,
      sortable: true,
      accessorKey: 'id',
    },
    {
      id: 'title',
      header: 'Purpose',
      sortable: true,
      accessorKey: 'title',
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{row.title}</div>
          <div className="truncate text-[13px] text-muted">
            {employeeById(row.employeeId)?.name ?? 'Unknown'} ·{' '}
            {employeeById(row.employeeId)?.department ?? '—'}
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      sortable: true,
      accessorKey: 'category',
      cell: (row) => <span className="whitespace-nowrap">{CATEGORY_LABEL[row.category]}</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      isNumeric: true,
      sortable: true,
      accessorKey: 'amount',
      cell: (row) => <span className="tabular-nums text-ink">{formatCurrency(row.amount)}</span>,
    },
    {
      id: 'submittedOn',
      header: 'Filed',
      sortable: true,
      accessorKey: 'submittedOn',
      cell: (row) => <span className="whitespace-nowrap text-muted">{formatDate(row.submittedOn)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessorKey: 'status',
      cell: (row) => <ClaimStatusPill status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Reimbursements"
        badge={
          !connected && !loading ? (
            <span className="inline-flex items-center gap-1.5 rounded-badge bg-[#FBEFDC] px-2 py-0.5 text-[12px] font-medium text-[#8A4F00]">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          ) : undefined
        }
      >
        <PageTabs
          tabs={[
            { id: 'all', label: TITLE.all, count: buckets.all.length },
            { id: 'hr', label: TITLE.hr, count: buckets.hr.length },
            { id: 'accounts', label: TITLE.accounts, count: buckets.accounts.length },
            { id: 'payment', label: TITLE.payment, count: buckets.payment.length },
            { id: 'settled', label: TITLE.settled, count: buckets.settled.length },
          ]}
          activeTab={scope}
          onChange={(id) => setScope(id as Scope)}
          departmentColor="#018F3D"
        />
      </PageHeader>

      <ClaimSummaryBar className="mb-6" />

      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          statement={scope === 'all' ? 'No claims yet' : 'Nothing here'}
        />
      ) : (
        <DataGrid
          data={rows}
          columns={columns}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/reimbursements/${row.id}`)}
          searchPlaceholder="Search claims"
          searchKey={(row) =>
            `${row.id} ${row.title} ${employeeById(row.employeeId)?.name ?? ''} ${statusLabel(row.status)}`
          }
          initialSortKey="submittedOn"
          initialSortDir="desc"
          pageSize={14}
        />
      )}
    </>
  );
};

export default ReimbursementsList;
