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
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl mb-4 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-outline">Ready to disburse</p>
              <p className="mt-1 font-mono text-2xl font-bold leading-none tracking-tight text-on-surface tabular-nums">
                {formatCurrency(totalPayable)}
              </p>
              <p className="mt-1 text-[11px] font-mono text-outline">
                across {payees.length} employee{payees.length === 1 ? '' : 's'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-outline mb-1.5">Payment Method</p>
              <div className="flex gap-1.5">
                {METHODS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setMethod(value)}
                    aria-pressed={method === value}
                    className={`rounded-lg border px-3 py-1 font-mono text-xs font-semibold transition-colors ${
                      method === value
                        ? 'border-primary bg-primary text-white shadow-xs'
                        : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
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
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xs">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant sticky top-0 z-10 select-none">
                    <tr>
                      <th className="px-4 py-2 w-48">Employee</th>
                      <th className="px-3 py-2">Bank & Account Details</th>
                      <th className="px-3 py-2 w-32">Claims</th>
                      <th className="px-3 py-2 text-right w-32">Payable Amount</th>
                      <th className="px-3 py-2 text-center w-28">KYC Status</th>
                      <th className="px-4 py-2 text-right w-36">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payees.map((row) => {
                      const employee = row.employee!;
                      const bank = employee.bankAccount;
                      return (
                        <tr
                          key={employee.id}
                          className="h-9 border-b border-outline-variant hover:bg-surface-container-low/70 transition-colors"
                        >
                          <td className="px-4 py-1.5 whitespace-nowrap">
                            <span className="font-semibold text-xs text-on-surface">{employee.name}</span>
                            <span className="ml-1.5 font-mono text-[10px] text-outline">({employee.employeeCode})</span>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-on-surface-variant truncate whitespace-nowrap">
                            <span>{bank.bankName}</span>
                            <span className="text-outline mx-1">·</span>
                            <span>{bank.accountNumberMasked}</span>
                            <span className="text-outline mx-1">·</span>
                            <span className="text-outline text-[10px]">{bank.ifsc}</span>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <span
                              title={row.claimIds.join(', ')}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-container text-on-surface-variant border border-outline-variant"
                            >
                              <strong>{row.claimIds.length}</strong> claim{row.claimIds.length === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs font-bold text-on-surface whitespace-nowrap">
                            {formatCurrency(row.total)}
                          </td>
                          <td className="px-3 py-1.5 text-center whitespace-nowrap">
                            {bank.verified ? (
                              <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[10px] font-medium font-mono border border-emerald-200 bg-emerald-50 text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-st-green-ink shrink-0" />
                                VERIFIED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-badge text-[10px] font-medium font-mono border border-amber-200 bg-amber-50 text-amber-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-strand-amber shrink-0" />
                                UNVERIFIED
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-1.5 text-right whitespace-nowrap">
                            {bank.verified ? (
                              <button
                                onClick={() => pay(employee.id)}
                                disabled={busy === employee.id}
                                  className="inline-flex items-center gap-1 h-6.5 px-2.5 py-0.5 rounded text-[11px] font-semibold font-mono border-2 border-ink bg-accent active:translate-y-px text-accent-ink hover:brightness-95 disabled:opacity-50 transition-colors shadow-2xs"
                              >
                                {busy === employee.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Banknote className="w-3 h-3" />
                                )}
                                Pay by {method}
                              </button>
                            ) : (
                              <button
                                onClick={() => verifyBankAccount(employee.id)}
                                className="inline-flex items-center gap-1 h-6.5 px-2 py-0.5 rounded text-[10.5px] font-semibold font-mono bg-surface-container text-on-surface-variant hover:bg-surface-container-high border border-outline-variant transition-colors shadow-2xs"
                              >
                                <ShieldCheck className="w-3 h-3 text-primary" />
                                Verify
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'ledger' && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xs">
          {ledger.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-outline font-mono">
              No payouts have been made yet.
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="font-mono uppercase tracking-wider text-outline text-[10px] bg-surface-container-low border-b border-outline-variant sticky top-0 z-10 select-none">
                  <tr>
                    <th className="px-4 py-2 w-48">UTR Reference</th>
                    <th className="px-3 py-2 w-44">Employee</th>
                    <th className="px-3 py-2 w-24">Method</th>
                    <th className="px-3 py-2 text-right w-32">Amount</th>
                    <th className="px-3 py-2 w-40">Initiated On</th>
                    <th className="px-4 py-2 text-center w-36">Status</th>
                    <th className="px-4 py-2 text-right w-28">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((payout) => {
                    const meta = PAYOUT_META[payout.status];
                    return (
                      <tr
                        key={payout.id}
                        className="h-9 border-b border-outline-variant hover:bg-surface-container-low/70 transition-colors"
                      >
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          {payout.utr ? (
                            <Link
                              to={`/receipt/${payout.utr}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-surface-container-low border border-outline-variant text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Banknote className="w-3 h-3 text-primary" />
                              {payout.utr}
                            </Link>
                          ) : (
                            <span className="font-mono text-outline text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-on-surface font-medium text-xs whitespace-nowrap">
                          {employeeById(payout.employeeId)?.name ?? '—'}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant">
                            {payout.method}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums font-semibold text-xs text-on-surface whitespace-nowrap">
                          {formatCurrency(payout.amount)}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-outline whitespace-nowrap">
                          {formatDateTime(payout.initiatedOn)}
                        </td>
                        <td className="px-4 py-1.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5 text-[10px] font-mono font-semibold ${
                              meta.tone === 'green'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : meta.tone === 'red'
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : meta.tone === 'amber'
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-outline-variant bg-surface-container text-on-surface-variant'
                            }`}
                            title={payout.failureReason}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                meta.tone === 'green'
                                  ? 'bg-strand-green'
                                  : meta.tone === 'red'
                                    ? 'bg-strand-red'
                                    : meta.tone === 'amber'
                                      ? 'bg-strand-amber'
                                      : 'bg-outline'
                              }`}
                            />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right whitespace-nowrap">
                          {payout.status === 'FAILED' ? (
                            <button
                              onClick={() => retryPayout(payout.id)}
                              className="inline-flex items-center gap-1 h-6.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary text-white hover:bg-primary/90 transition-colors shadow-2xs"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              Retry
                            </button>
                          ) : payout.utr ? (
                            <Link
                              to={`/receipt/${payout.utr}`}
                              className="font-mono text-[10px] text-primary hover:underline"
                            >
                              Advice →
                            </Link>
                          ) : (
                            <span className="font-mono text-[10px] text-outline">Processed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Disbursement;
