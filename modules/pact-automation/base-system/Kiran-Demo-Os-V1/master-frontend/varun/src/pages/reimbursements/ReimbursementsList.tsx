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
import { CATEGORY_LABEL, actionOwner, statusLabel, statusTone } from '@/modules/rts/status';
import type { ReceiptRequest } from '@/modules/rts/types';
import { ClaimStatusPill } from './ClaimStatusPill';
import { ClaimSummaryBar } from './ClaimSummaryBar';

type Scope = 'all' | 'hr' | 'accounts' | 'payment' | 'settled';

const TITLE: Record<Scope, string> = {
  all: 'All claims',
  hr: 'With HR',
  accounts: 'With Accounts',
  payment: 'Awaiting payment',
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
      header: 'Claim ID',
      isMono: true,
      sortable: true,
      accessorKey: 'id',
      width: '105px',
      cell: (row) => <span className="font-mono text-xs font-semibold text-primary">{row.id}</span>,
    },
    {
      id: 'employee',
      header: 'Employee',
      sortable: true,
      width: '160px',
      cell: (row) => {
        const emp = employeeById(row.employeeId);
        return (
          <div className="truncate font-medium text-xs text-on-surface" title={`${emp?.name} (${emp?.department})`}>
            {emp?.name ?? 'Unknown'}
          </div>
        );
      },
    },
    {
      id: 'title',
      header: 'Purpose / Description',
      sortable: true,
      accessorKey: 'title',
      cell: (row) => (
        <span className="truncate block text-xs text-on-surface-variant font-normal" title={row.title}>
          {row.title}
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      sortable: true,
      accessorKey: 'category',
      width: '120px',
      cell: (row) => (
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-outline px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant">
          {CATEGORY_LABEL[row.category]}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      isNumeric: true,
      isMono: true,
      sortable: true,
      accessorKey: 'amount',
      width: '120px',
      cell: (row) => (
        <span className="font-mono tabular-nums font-semibold text-xs text-on-surface">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      id: 'submittedOn',
      header: 'Filed',
      isMono: true,
      sortable: true,
      accessorKey: 'submittedOn',
      width: '105px',
      cell: (row) => <span className="font-mono text-[11px] text-outline">{formatDate(row.submittedOn)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      accessorKey: 'status',
      width: '150px',
      cell: (row) => <ClaimStatusPill status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Reimbursements"
        badge={
          !connected && !loading ? (
            <span className="inline-flex items-center gap-1.5 rounded-badge border border-strand-amber/30 bg-strand-amber/10 px-2 py-0.5 text-[10.5px] font-medium text-strand-amber">
              <WifiOff className="h-3 w-3" /> Live updates off
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

      <ClaimSummaryBar className="mb-5" />

      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          statement={
            scope === 'all' ? 'No claims have been filed yet' : `Nothing sits ${TITLE[scope].toLowerCase()}`
          }
          instruction="Claims filed from a conversation or from the portal appear here."
        />
      ) : (
        <DataGrid
          data={rows}
          columns={columns}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/reimbursements/${row.id}`)}
          searchPlaceholder="Search by claim id, purpose or employee…"
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
