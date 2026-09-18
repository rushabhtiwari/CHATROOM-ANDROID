/**
 * Disbursement.
 *
 * Grouped by employee rather than by claim, because that is how money actually
 * leaves: one transfer, one UTR, however many claims it settles. Paying three
 * approved claims as three transfers would cost three bank charges and give
 * the employee three credits to reconcile.
 *
 * Nothing here can pay a claim Accounts has not approved — the queue is built
 * from the payable set, and the server refuses anything else regardless.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  Check,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { PageTabs } from '@/components/common/PageTabs';
import { EmptyState } from '@/components/common/EmptyState';
import { useRts } from '@/modules/rts/store';
import { formatCurrency, formatDateTime } from '@/modules/rts/format';
import { PAYOUT_META, isPayable } from '@/modules/rts/status';
import type { Payout } from '@/modules/rts/types';

type Tab = 'queue' | 'ledger';

const METHODS: Payout['method'][] = ['NEFT', 'IMPS', 'UPI'];

export const Disbursement: React.FC = () => {
  const {
    requests,
    payouts,
    employees,
    employeeById,
    disburseTo,
    retryPayout,
    verifyBankAccount,
    resetDemoData,
  } = useRts();

  const [tab, setTab] = useState<Tab>('queue');
  const [method, setMethod] = useState<Payout['method']>('NEFT');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastUtr, setLastUtr] = useState<string | null>(null);

  /** Payable claims, grouped into one transfer per employee. */
  const payees = useMemo(() => {
    const groups = new Map<string, { total: number; claimIds: string[] }>();
    for (const request of requests) {
      if (!isPayable(request.status)) continue;
      const entry = groups.get(request.employeeId) ?? { total: 0, claimIds: [] };
      entry.total += request.amount;
      entry.claimIds.push(request.id);
      groups.set(request.employeeId, entry);
    }
    return [...groups.entries()]
      .map(([employeeId, entry]) => ({
        employee: employeeById(employeeId),
        ...entry,
      }))
      .filter((row) => row.employee)
      .sort((a, b) => b.total - a.total);
  }, [requests, employeeById]);

  const totalPayable = payees.reduce((total, row) => total + row.total, 0);

  const pay = async (employeeId: string) => {
    setBusy(employeeId);
    try {
      const result = await disburseTo(employeeId, method);
      setLastUtr(result.utr);
    } finally {
      setBusy(null);
    }
  };

  const ledger = useMemo(
    () => [...payouts].sort((a, b) => b.initiatedOn.localeCompare(a.initiatedOn)),
    [payouts],
  );

  return (
    <>
      <PageHeader
        title="Disbursement"
        actions={
          <button
            onClick={resetDemoData}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-line-2"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
          </button>
        }
      >
        <PageTabs
          tabs={[
            { id: 'queue', label: 'Payment queue', count: payees.length },
            { id: 'ledger', label: 'Payout ledger', count: payouts.length },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as Tab)}
          departmentColor="#018F3D"
        />
      </PageHeader>

      {lastUtr && (
        <div className="mb-4 flex items-center gap-2.5 rounded-md border border-strand-green/25 bg-strand-green/5 px-4 py-3">
          <Check className="h-4 w-4 shrink-0 text-strand-green" />
          <p className="text-[13px] text-ink">
            Transfer released. UTR{' '}
            <span className="font-mono font-semibold">{lastUtr}</span>
          </p>
          <Link
            to={`/receipt/${lastUtr}`}
            className="ml-auto shrink-0 text-[12px] font-medium text-kiran hover:underline"
          >
            View receipt
          </Link>
        </div>
      )}

      {tab === 'queue' && (
        <>
          <div className="panel mb-4 flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="label-eyebrow">Ready to disburse</p>
              <p className="mt-1 font-mono text-[22px] font-semibold leading-none tracking-tight text-ink">
                {formatCurrency(totalPayable)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                across {payees.length} employee{payees.length === 1 ? '' : 's'}
              </p>
            </div>
            <div>
              <p className="label-eyebrow">Method</p>
              <div className="mt-1.5 flex gap-1">
                {METHODS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setMethod(value)}
                    aria-pressed={method === value}
                    className={`rounded-md border px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                      method === value
                        ? 'border-kiran bg-kiran-tint text-kiran'
                        : 'border-line bg-surface text-slate-600 hover:bg-line-2'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {payees.length === 0 ? (
            <EmptyState
              icon={Banknote}
              statement="Nothing is waiting to be paid"
              instruction="Claims appear here once Accounts has approved them."
            />
          ) : (
            <div className="space-y-2.5">
              {payees.map((row) => {
                const employee = row.employee!;
                const bank = employee.bankAccount;
                return (
                  <div key={employee.id} className="panel flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink">{employee.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted">
                        {employee.employeeCode} · {bank.bankName} · {bank.accountNumberMasked} ·{' '}
                        {bank.ifsc}
                      </p>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {row.claimIds.length} claim{row.claimIds.length === 1 ? '' : 's'}:{' '}
                        <span className="font-mono">{row.claimIds.join(', ')}</span>
                      </p>
                    </div>

                    <span className="shrink-0 font-mono text-[20px] font-semibold leading-none tracking-tight text-ink">
                      {formatCurrency(row.total)}
                    </span>

                    {bank.verified ? (
                      <button
                        onClick={() => pay(employee.id)}
                        disabled={busy === employee.id}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-strand-green px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy === employee.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Banknote className="h-3.5 w-3.5" />
                        )}
                        Pay by {method}
                      </button>
                    ) : (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-strand-amber">
                          <AlertTriangle className="h-3 w-3" /> Bank record unverified
                        </span>
                        <button
                          onClick={() => verifyBankAccount(employee.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-line-2"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Verify to enable
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'ledger' && (
        <div className="panel overflow-hidden">
          {ledger.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-muted">
              No payouts have been made yet.
            </p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="grid-head border-b border-line text-left">
                  <th className="px-5 py-2.5 font-semibold text-muted">UTR</th>
                  <th className="px-3 py-2.5 font-semibold text-muted">Employee</th>
                  <th className="px-3 py-2.5 font-semibold text-muted">Method</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted">Amount</th>
                  <th className="px-3 py-2.5 font-semibold text-muted">Initiated</th>
                  <th className="px-5 py-2.5 font-semibold text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ledger.map((payout) => {
                  const meta = PAYOUT_META[payout.status];
                  return (
                    <tr key={payout.id} className="hover:bg-canvas">
                      <td className="px-5 py-2.5 font-mono text-[11.5px] text-ink">
                        {payout.utr ? (
                          <Link to={`/receipt/${payout.utr}`} className="hover:text-kiran">
                            {payout.utr}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {employeeById(payout.employeeId)?.name ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-slate-600">
                        {payout.method}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">
                        {formatCurrency(payout.amount)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-muted">
                        {formatDateTime(payout.initiatedOn)}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5 text-[10.5px] font-semibold ${
                              meta.tone === 'green'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : meta.tone === 'red'
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : meta.tone === 'amber'
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-slate-200 bg-slate-100 text-slate-700'
                            }`}
                          >
                            {meta.label}
                          </span>
                          {payout.status === 'FAILED' && (
                            <button
                              onClick={() => retryPayout(payout.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-kiran hover:underline"
                            >
                              <RefreshCw className="h-3 w-3" /> Retry
                            </button>
                          )}
                        </div>
                        {payout.failureReason && (
                          <p className="mt-0.5 text-[10.5px] text-strand-red">
                            {payout.failureReason}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
};

export default Disbursement;
