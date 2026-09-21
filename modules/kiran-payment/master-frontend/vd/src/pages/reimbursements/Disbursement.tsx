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
import { Banknote, Check, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
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
        title="Payments"
        actions={
          <button onClick={resetDemoData} className="btn-secondary">
            <RotateCcw className="h-4 w-4 text-slate-500" /> Reset demo
          </button>
        }
      >
        <PageTabs
          tabs={[
            { id: 'queue', label: 'To pay', count: payees.length },
            { id: 'ledger', label: 'Paid', count: payouts.length },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as Tab)}
          departmentColor="#018F3D"
        />
      </PageHeader>

      {lastUtr && (
        <div className="mb-6 flex items-center gap-2.5 rounded-lg bg-[#E7F3EB] px-4 py-3">
          <Check className="h-4 w-4 shrink-0 text-[#17723F]" />
          <p className="text-[14px] text-ink">
            Paid. UTR <span className="font-code text-[13px]">{lastUtr}</span>
          </p>
          <Link
            to={`/receipt/${lastUtr}`}
            className="ml-auto shrink-0 text-[13px] font-medium text-kiran hover:underline"
          >
            Receipt
          </Link>
        </div>
      )}

      {tab === 'queue' && (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="kpi min-w-[240px]">
              <div className="kpi-label">
                To pay · {payees.length} employee{payees.length === 1 ? '' : 's'}
              </div>
              <div className="kpi-value">{formatCurrency(totalPayable)}</div>
            </div>
            <div
              className="inline-flex rounded-md bg-[#EBEBEF] p-0.5"
              role="group"
              aria-label="Payment method"
            >
              {METHODS.map((value) => (
                <button
                  key={value}
                  onClick={() => setMethod(value)}
                  aria-pressed={method === value}
                  className={`h-8 rounded-sm px-3.5 text-[13px] font-medium transition-colors ${
                    method === value ? 'bg-white text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {payees.length === 0 ? (
            <EmptyState icon={Banknote} statement="Nothing to pay" />
          ) : (
            <div className="space-y-4">
              {payees.map((row) => {
                const employee = row.employee!;
                const bank = employee.bankAccount;
                return (
                  <div key={employee.id} className="panel flex flex-wrap items-center gap-5 p-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-semibold text-ink">{employee.name}</p>
                      <p className="mt-1 text-[13px] text-muted">
                        {employee.employeeCode} · {bank.bankName} · {bank.accountNumberMasked} ·{' '}
                        {bank.ifsc}
                      </p>
                      <p className="mt-1 font-code text-[13px] text-muted">
                        {row.claimIds.join(', ')}
                      </p>
                    </div>

                    <span className="shrink-0 whitespace-nowrap text-[22px] font-semibold leading-none tabular-nums text-ink">
                      {formatCurrency(row.total)}
                    </span>

                    {bank.verified ? (
                      <button
                        onClick={() => pay(employee.id)}
                        disabled={busy === employee.id}
                        className="btn-primary shrink-0"
                      >
                        {busy === employee.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        Pay by {method}
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="inline-flex items-center rounded-badge bg-[#FBEFDC] px-2 py-0.5 text-[12px] font-medium text-[#8A4F00]">
                          Bank not verified
                        </span>
                        <button
                          onClick={() => verifyBankAccount(employee.id)}
                          className="btn-secondary"
                        >
                          Verify
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
            <p className="px-5 py-10 text-center text-[14px] text-muted">No payments yet.</p>
          ) : (
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-[13px] text-muted">
                  <th className="px-4 py-3 font-medium">UTR</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {ledger.map((payout) => {
                  const meta = PAYOUT_META[payout.status];
                  return (
                    <tr key={payout.id} className="h-[52px] hover:bg-canvas">
                      <td className="whitespace-nowrap px-4 py-3 font-code text-[13px] text-ink">
                        {payout.utr ? (
                          <Link to={`/receipt/${payout.utr}`} className="hover:text-kiran">
                            {payout.utr}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {employeeById(payout.employeeId)?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{payout.method}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink">
                        {formatCurrency(payout.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {formatDateTime(payout.initiatedOn)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-badge px-2 py-0.5 text-[12px] font-medium ${
                              meta.tone === 'green'
                                ? 'bg-[#E7F3EB] text-[#17723F]'
                                : meta.tone === 'red'
                                  ? 'bg-[#FBE9E7] text-[#B3302A]'
                                  : meta.tone === 'amber'
                                    ? 'bg-[#FBEFDC] text-[#8A4F00]'
                                    : 'bg-[#EFEFF2] text-[#48484F]'
                            }`}
                          >
                            {meta.label}
                          </span>
                          {payout.status === 'FAILED' && (
                            <button
                              onClick={() => retryPayout(payout.id)}
                              className="inline-flex items-center gap-1 text-[13px] font-medium text-kiran hover:underline"
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Retry
                            </button>
                          )}
                        </div>
                        {payout.failureReason && (
                          <p className="mt-1 text-[13px] text-strand-red">{payout.failureReason}</p>
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
