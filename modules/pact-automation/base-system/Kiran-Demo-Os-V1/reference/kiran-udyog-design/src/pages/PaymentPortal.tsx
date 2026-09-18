import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, Check, Copy, Info, RotateCcw, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { EmployeeChip } from '@/components/ui/Avatar';
import { Badge, PayoutBadge } from '@/components/ui/StatusBadge';
import { LedgerBand, StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Field';
import { useApp } from '@/context/AppContext';
import type { Employee, Payout } from '@/lib/types';
import { formatCurrency, formatDate, maskAccount } from '@/lib/format';

const PAY_ACTOR = 'Kavya Reddy';

/** Shown when the bank returns a payout without telling us why. */
const NO_REASON_GIVEN =
  'The bank returned this payout without a reason code. Re-check the beneficiary name, account and IFSC before releasing it again.';

/** A ledger that reads "1 payouts" looks unfinished, so counts carry their own noun. */
function payoutCount(n: number): string {
  return `${n} ${n === 1 ? 'payout' : 'payouts'}`;
}

/*
  The payout ledger.

  One string on this screen matters more than any other: the UTR. It is what an employee
  quotes when the money has not landed, and what Accounts quotes back to the bank. So it
  is set in the figure face, given room, and made copyable in one click. Everything else
  on the row — beneficiary, method, amount, settlement date — is arranged around it.

  A returned payout is never allowed to hide inside a table cell: failures are lifted into
  their own ruled panel above the ledger, each stating exactly what the bank said.
*/
export default function PaymentPortal() {
  // TODO: replace with API call
  const {
    payouts,
    setPayouts,
    employees,
    employeeById,
    requests,
    updateRequestStatus,
    verifyBankAccount,
    pushNotification,
  } = useApp();

  const [tab, setTab] = useState('queue');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  const kpis = useMemo(() => {
    const queued = payouts.filter((p) => p.status === 'QUEUED' || p.status === 'PROCESSING');
    const paid = payouts.filter((p) => p.status === 'PAID');
    const failed = payouts.filter((p) => p.status === 'FAILED');
    const unverified = employees.filter((e) => !e.bankAccount.verified);
    return {
      queuedValue: queued.reduce((s, p) => s + p.amount, 0),
      queuedCount: queued.length,
      paidValue: paid.reduce((s, p) => s + p.amount, 0),
      paidCount: paid.length,
      failedCount: failed.length,
      failedValue: failed.reduce((s, p) => s + p.amount, 0),
      unverified: unverified.length,
    };
  }, [payouts, employees]);

  const failedPayouts = useMemo(() => payouts.filter((p) => p.status === 'FAILED'), [payouts]);

  const selectedPayouts = useMemo(
    () => payouts.filter((p) => selected.includes(p.id)),
    [payouts, selected],
  );
  const selectedTotal = selectedPayouts.reduce((s, p) => s + p.amount, 0);

  const retry = (id: string) =>
    setPayouts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'QUEUED', failureReason: undefined } : p)),
    );

  const disburse = () => {
    setPayouts((prev) =>
      prev.map((p) => (selected.includes(p.id) ? { ...p, status: 'PROCESSING' } : p)),
    );
    selectedPayouts.forEach((p) => {
      const linked = requests.find((r) => r.id === p.requestId);
      if (linked && linked.status === 'ACC_APPROVED') {
        updateRequestStatus(linked.id, 'PAYMENT_QUEUED', PAY_ACTOR, 'PAYMENTS');
      }
    });
    setConfirmOpen(false);
    setSelected([]);
  };

  /** The UTR is quoted over the phone and pasted into bank portals — one click copies it. */
  const copyUtr = async (utr: string) => {
    try {
      await navigator.clipboard.writeText(utr);
      setCopiedUtr(utr);
      window.setTimeout(() => setCopiedUtr((current) => (current === utr ? null : current)), 1600);
    } catch {
      // No clipboard permission (or no secure context) — the figure stays selectable by hand.
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.name} ${e.employeeCode} ${e.bankAccount.bankName}`.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const columns: Column<Payout>[] = [
    {
      key: 'id',
      header: 'Payout',
      className: 'whitespace-nowrap',
      render: (p) => (
        <div className="min-w-0">
          <p className="ku-docket text-rich-black">{p.id}</p>
          {/*
            Both lines are navy ink at 12px, so the claim number is marked as the live one
            by a standing orange rule under it rather than by an orange letter colour —
            which at this size cannot hold 4.5:1 against the sheet.
          */}
          <Link
            to={`/requests/${p.requestId}`}
            onClick={(e) => e.stopPropagation()}
            className="ku-docket text-rich-black underline decoration-orangy decoration-2 underline-offset-2 transition-colors duration-150 hover:decoration-rich-black"
          >
            {p.requestId}
          </Link>
        </div>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (p) => {
        const emp = employeeById(p.employeeId);
        return emp ? <EmployeeChip employee={emp} /> : <span className="text-meta">—</span>;
      },
    },
    {
      key: 'bank',
      header: 'Beneficiary',
      render: (p) => {
        const emp = employeeById(p.employeeId);
        if (!emp) return <span className="text-meta">—</span>;
        return (
          <div className="min-w-0">
            <p className="truncate text-body-s text-rich-black">{emp.bankAccount.bankName}</p>
            <p className="ku-fig text-caption text-meta">
              {maskAccount(emp.bankAccount.accountNumberMasked)} · {emp.bankAccount.ifsc}
            </p>
            {!emp.bankAccount.verified && (
              <Badge tone="amber" className="mt-1.5">
                Unverified
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'method',
      header: 'Method',
      // A quiet mono tag, not a stamp: the rail the money took is a fact, not a verdict.
      render: (p) => (
        <span className="ku-fig text-caption uppercase tracking-stamp text-meta">{p.method}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (p) => <span className="font-semibold text-rich-black">{formatCurrency(p.amount)}</span>,
    },
    {
      key: 'status',
      header: 'State',
      width: '210px',
      render: (p) => (
        <div className="space-y-1.5">
          <PayoutBadge status={p.status} />
          {p.status === 'FAILED' && (
            <p className="border-l-3 border-l-washed pl-2 text-caption leading-snug text-st-red-ink">
              {p.failureReason ?? NO_REASON_GIVEN}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'utr',
      header: 'UTR',
      width: '230px',
      className: 'whitespace-nowrap',
      render: (p) => {
        const utr = p.utr;
        if (!utr) {
          return <span className="ku-fig text-caption text-meta">awaited</span>;
        }
        const isCopied = copiedUtr === utr;
        return (
          <button
            type="button"
            title="Copy this UTR"
            aria-label={`Copy UTR ${utr}`}
            onClick={(e) => {
              e.stopPropagation();
              void copyUtr(utr);
            }}
            className="group -mx-1 inline-flex items-center gap-2 border border-transparent px-1 py-0.5 text-left transition-colors duration-150 hover:border-hairline-strong hover:bg-canvas"
          >
            <span className="ku-fig text-body-s font-semibold text-rich-black">{utr}</span>
            {isCopied ? (
              <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-st-green-ink" />
            ) : (
              <Copy
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-hairline-strong transition-colors duration-150 group-hover:text-meta"
              />
            )}
            <span className="sr-only" role="status">
              {isCopied ? 'UTR copied' : ''}
            </span>
          </button>
        );
      },
    },
    {
      key: 'settled',
      header: 'Settled',
      className: 'whitespace-nowrap',
      render: (p) => (
        <div>
          <p className={p.settledOn ? 'ku-fig text-rich-black' : 'ku-fig text-meta'}>
            {p.settledOn ? formatDate(p.settledOn) : '—'}
          </p>
          <p className="ku-fig text-caption text-meta">out {formatDate(p.initiatedOn)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) =>
        p.status === 'FAILED' ? (
          <Button
            variant="outline"
            size="sm"
            icon={RotateCcw}
            onClick={(e) => {
              e.stopPropagation();
              retry(p.id);
            }}
          >
            Release again
          </Button>
        ) : (
          <span className="text-meta">—</span>
        ),
    },
  ];

  const bankColumns: Column<Employee>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (e) => <EmployeeChip employee={e} showCode />,
    },
    {
      key: 'holder',
      header: 'Account holder',
      // Mismatched holder names are the single commonest cause of a returned payout.
      render: (e) => <span className="text-rich-black">{e.bankAccount.accountHolder}</span>,
    },
    { key: 'bank', header: 'Bank', render: (e) => e.bankAccount.bankName },
    {
      key: 'account',
      header: 'Account',
      render: (e) => (
        <span className="ku-fig text-rich-black">
          {maskAccount(e.bankAccount.accountNumberMasked)}
        </span>
      ),
    },
    {
      key: 'ifsc',
      header: 'IFSC',
      render: (e) => <span className="ku-fig text-rich-black">{e.bankAccount.ifsc}</span>,
    },
    {
      key: 'state',
      header: 'State',
      render: (e) =>
        e.bankAccount.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Unverified</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (e) =>
        e.bankAccount.verified ? (
          <span className="text-meta">—</span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              verifyBankAccount(e.id);
              pushNotification({
                toRole: 'EMPLOYEE',
                toEmployeeId: e.id,
                title: 'Bank account verified',
                body: `${e.bankAccount.bankName} ${maskAccount(
                  e.bankAccount.accountNumberMasked,
                )} has been verified. Payouts to this account can now be released.`,
              });
            }}
          >
            Verify account
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payout Ledger"
        subtitle="Release passed claims to the bank in a batch, then follow each UTR through to settlement."
        breadcrumb={[{ label: 'Home', to: '/overview' }, { label: 'Payout ledger' }]}
        actions={
          <Button
            variant="primary"
            icon={Banknote}
            disabled={selected.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            Release selected
          </Button>
        }
      />

      {/* One ruled band, not four floating tiles: these four figures are one account. */}
      <LedgerBand cols={4}>
        <StatCard
          label="In the batch"
          value={formatCurrency(kpis.queuedValue)}
          sublabel={payoutCount(kpis.queuedCount)}
          tone="orange"
        />
        <StatCard
          label="Settled"
          value={formatCurrency(kpis.paidValue)}
          sublabel={`${kpis.paidCount} credited`}
          tone="success"
        />
        <StatCard
          label="Returned by bank"
          value={formatCurrency(kpis.failedValue)}
          sublabel={`${kpis.failedCount} to release again`}
          tone="danger"
        />
        <StatCard
          label="Bank records unverified"
          value={String(kpis.unverified)}
          sublabel={`of ${employees.length} on file`}
        />
      </LedgerBand>

      <Tabs
        className="mt-6"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'queue', label: 'Payout ledger', count: payouts.length },
          { key: 'bank', label: 'Bank records', count: employees.length },
        ]}
      />

      {tab === 'queue' ? (
        <>
          {selected.length > 0 && (
            <div className="sticky top-0 z-20 mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-l-3 border-l-orangy bg-darkey-bluey px-4 py-3 animate-fade-rise">
              <div>
                <p className="ku-eyebrow text-orangy">Batch selection</p>
                <p className="mt-1 text-body-s text-white">
                  <span className="ku-fig font-semibold">{selected.length}</span>{' '}
                  {selected.length === 1 ? 'payout' : 'payouts'} worth{' '}
                  <span className="ku-fig font-semibold">{formatCurrency(selectedTotal)}</span>
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => setConfirmOpen(true)}>
                  Release this batch
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSelected([])}
                  className="border-white/40 bg-transparent text-white hover:bg-white/10"
                >
                  Clear selection
                </Button>
              </div>
            </div>
          )}

          {/* Returned payouts are lifted out of the table: money that did not land is news. */}
          {failedPayouts.length > 0 && (
            <section className="ku-sheet mt-6 border-t-washed">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline-strong px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-washed" />
                  <h2 className="ku-wide font-display text-lead font-semibold leading-tight text-rich-black">
                    Returned by the bank
                  </h2>
                </div>
                <span className="ku-fig text-caption text-meta">
                  {payoutCount(failedPayouts.length)} · {formatCurrency(kpis.failedValue)}
                </span>
              </div>

              <ul className="ku-ruled">
                {failedPayouts.map((p) => {
                  const emp = employeeById(p.employeeId);
                  return (
                    <li key={p.id} className="border-l-3 border-l-washed px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="ku-docket text-rich-black">{p.id}</span>
                        <span className="text-body-s font-semibold text-rich-black">
                          {emp?.name ?? 'Unknown beneficiary'}
                        </span>
                        <span className="ku-fig text-caption uppercase tracking-stamp text-meta">
                          {p.method}
                        </span>
                        <span className="ku-fig ml-auto text-body-s font-semibold text-rich-black">
                          {formatCurrency(p.amount)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                        <p className="max-w-[68ch] text-body-s leading-snug text-st-red-ink">
                          Released <span className="ku-fig">{formatDate(p.initiatedOn)}</span> —{' '}
                          {p.failureReason ?? NO_REASON_GIVEN}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={RotateCcw}
                          onClick={() => retry(p.id)}
                        >
                          Release again
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <Card variant="sheet" className="mt-6">
            <CardHeader
              title="Payout ledger"
              subtitle="Tick the payouts that go out in the next batch."
              action={
                <span className="ku-fig text-caption text-meta">{payouts.length} on file</span>
              }
            />
            <DataTable
              columns={columns}
              rows={payouts}
              rowKey={(p) => p.id}
              selectable
              selectedIds={selected}
              onSelectionChange={setSelected}
              empty={
                <EmptyState
                  eyebrow="Ledger clear"
                  title="Nothing is waiting to be released"
                  description="Claims land here the moment Accounts passes them for payment. Batch them, release them, then track the UTR back."
                />
              }
            />
          </Card>
        </>
      ) : (
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-meta"
            />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Employee, code or bank"
              aria-label="Search bank records"
            />
          </div>

          <Card variant="sheet" className="mt-4">
            <CardHeader
              title="Bank records"
              subtitle="A payout can only be released against a verified beneficiary."
              action={
                <span className="ku-fig text-caption text-meta">
                  {kpis.unverified} of {employees.length} unverified
                </span>
              }
            />
            <DataTable
              columns={bankColumns}
              rows={filteredEmployees}
              rowKey={(e) => e.id}
              empty={
                <EmptyState
                  eyebrow="No match"
                  title="No bank record matches that search"
                  description="Try the employee code, or part of the bank name. Clearing the box brings the full register back."
                />
              }
            />
          </Card>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        eyebrow="Disbursement batch"
        title="Release this batch to the bank"
        subtitle="Each payout is sent on its own rail. The bank returns a UTR against every one."
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={disburse}>
              Release <span className="ku-fig">{formatCurrency(selectedTotal)}</span>
            </Button>
          </div>
        }
      >
        <div>
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-hairline-strong pb-2">
            <span className="ku-eyebrow">In this batch</span>
            <span className="ku-fig text-caption text-meta">{payoutCount(selectedPayouts.length)}</span>
          </div>

          <ul className="ku-scrollbar ku-ruled max-h-64 overflow-y-auto border-b border-hairline">
            {selectedPayouts.map((p) => {
              const emp = employeeById(p.employeeId);
              return (
                <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
                  <span className="ku-docket text-rich-black">{p.id}</span>
                  <span className="text-body-s text-rich-black">{emp?.name ?? '—'}</span>
                  <span className="ku-fig text-caption text-meta">
                    {emp ? maskAccount(emp.bankAccount.accountNumberMasked) : '—'}
                  </span>
                  <span className="ku-fig text-caption uppercase tracking-stamp text-meta">
                    {p.method}
                  </span>
                  <span className="ku-fig ml-auto text-body-s font-semibold text-rich-black">
                    {formatCurrency(p.amount)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex items-baseline justify-between gap-3 py-4">
            <span className="ku-eyebrow">Batch total</span>
            <span className="ku-total text-h2">{formatCurrency(selectedTotal)}</span>
          </div>

          <div className="flex items-start gap-2.5 border-l-3 border-l-st-blue-line bg-canvas px-4 py-3">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-st-blue-ink" />
            <p className="text-body-s text-st-blue-ink">
              Funds leave the Kiran Udyog disbursement account as soon as this batch is released.
              Each employee is notified when the bank returns a UTR against their payout.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
