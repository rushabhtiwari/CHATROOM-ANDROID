// Accounts-owned disbursement screen: the tail of the Accounts review, not a separate
// department. It is set as a cheque run — a ruled register of payees, a release sheet
// that states the destination account and the anchor total, and one consequential
// control at the foot of it. It is deliberately NOT a clone of any real provider's
// branded checkout, and it collects no card, UPI or account credentials. The only bank
// data shown is the already-masked account on file.
//
// HARD GATE: only claims that HR approved AND Accounts approved can appear here.

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Landmark, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApp } from '@/context/AppContext';
import type { Employee, ReceiptRequest } from '@/lib/types';
import { isPayable } from '@/lib/status';
import { cx, formatCurrency, maskAccount } from '@/lib/format';

const PAY_ACTOR = 'Vikram Sethi';

type Method = 'NEFT' | 'IMPS' | 'UPI';

/**
 * A rail is picked on two facts and no others: when it settles, and what it will
 * carry. No glyphs — a lightning bolt does not tell a clerk the ceiling. Only the
 * ceiling itself is a figure, so only the ceiling sits on the mono face.
 */
const METHODS: { key: Method; label: string; hint: ReactNode }[] = [
  {
    key: 'IMPS',
    label: 'IMPS',
    hint: (
      <>
        Settles now · ceiling <span className="ku-fig">₹5,00,000</span>
      </>
    ),
  },
  { key: 'NEFT', label: 'NEFT', hint: 'Half-hourly batch · no ceiling' },
  {
    key: 'UPI',
    label: 'UPI',
    hint: (
      <>
        Settles now · ceiling <span className="ku-fig">₹1,00,000</span>
      </>
    ),
  },
];

interface Payee {
  employee: Employee;
  claims: ReceiptRequest[];
  total: number;
  receiptCount: number;
}

export default function DisbursementCheckout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // TODO: replace with API call
  const {
    requests,
    employeeById,
    updateRequestStatus,
    creditEmployeeAllowance,
    pushNotification,
    resetDemoData,
    setPayouts,
  } = useApp();

  const [selectedId, setSelectedId] = useState<string | null>(params.get('employee'));
  const [method, setMethod] = useState<Method>('IMPS');
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done'>('idle');
  /** Set when the browser blocked the receipt tab, so we can offer a manual link. */
  const [blockedReceipt, setBlockedReceipt] = useState<string | null>(null);

  /**
   * Payees are grouped from claims Accounts has approved. `isPayable` implies HR
   * approval, so an un-approved claim can never surface on this screen.
   */
  const payees = useMemo<Payee[]>(() => {
    const byEmployee = new Map<string, ReceiptRequest[]>();
    for (const r of requests) {
      if (!isPayable(r.status)) continue;
      const list = byEmployee.get(r.employeeId) ?? [];
      list.push(r);
      byEmployee.set(r.employeeId, list);
    }
    return [...byEmployee.entries()]
      .map(([employeeId, claims]) => {
        const employee = employeeById(employeeId);
        if (!employee) return null;
        return {
          employee,
          claims,
          // Total owed, summed from the amounts on the bills they uploaded.
          total: claims.reduce((s, c) => s + c.amount, 0),
          receiptCount: claims.reduce((s, c) => s + c.receipts.length, 0),
        };
      })
      .filter((p): p is Payee => p !== null)
      .sort((a, b) => b.total - a.total);
  }, [requests, employeeById]);

  /** What the whole register is worth — the figure at the head of the page. */
  const queueTotal = useMemo(() => payees.reduce((s, p) => s + p.total, 0), [payees]);

  // Keep the selection valid as the queue drains.
  useEffect(() => {
    if (payees.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !payees.some((p) => p.employee.id === selectedId)) {
      setSelectedId(payees[0].employee.id);
    }
  }, [payees, selectedId]);

  const selected = payees.find((p) => p.employee.id === selectedId) ?? null;

  const pay = () => {
    if (!selected) return;

    // Opened synchronously inside the click so pop-up blockers allow it; the URL is
    // filled in once the payout settles.
    const tab = window.open('', '_blank');
    setBlockedReceipt(null);
    setPhase('processing');

    const utr = `UTR${String(Date.now()).slice(-14)}`;
    const { employee, claims, total } = selected;

    window.setTimeout(() => {
      claims.forEach((claim, i) => {
        // Money out, then the claim lands back on the employee's allowance.
        updateRequestStatus(claim.id, 'PAID', PAY_ACTOR, 'PAYMENTS', `Disbursed via ${method}.`);
        updateRequestStatus(
          claim.id,
          'CREDITED',
          PAY_ACTOR,
          'PAYMENTS',
          'Monthly allowance balance restored.',
        );
        creditEmployeeAllowance(employee.id, claim.amount);

        // Settle the claim's existing open payout if one is already queued, so the
        // ledger never shows two live rows for the same request.
        setPayouts((prev) => {
          const now = new Date().toISOString();
          const openIndex = prev.findIndex(
            (p) =>
              p.requestId === claim.id && (p.status === 'QUEUED' || p.status === 'PROCESSING'),
          );
          if (openIndex >= 0) {
            const next = [...prev];
            next[openIndex] = {
              ...next[openIndex],
              method,
              status: 'PAID',
              utr,
              settledOn: now,
              failureReason: undefined,
            };
            return next;
          }
          return [
            {
              id: `PAY-RUN-${utr.slice(-6)}-${i + 1}`,
              requestId: claim.id,
              employeeId: employee.id,
              amount: claim.amount,
              method,
              status: 'PAID' as const,
              utr,
              initiatedOn: now,
              settledOn: now,
            },
            ...prev,
          ];
        });
      });

      // The employee is told, and sees it on their own account.
      pushNotification({
        toRole: 'EMPLOYEE',
        toEmployeeId: employee.id,
        title: `Payment successful — ${formatCurrency(total)} received`,
        body: `Your reimbursement of ${formatCurrency(total)} has been disbursed via ${method} to ${maskAccount(
          employee.bankAccount.accountNumberMasked,
        )} and credited to your monthly allowance. UTR ${utr}.`,
        requestId: claims[0].id,
      });

      // Settled — hand the user the receipt in its own tab. The URL carries everything
      // the receipt needs, because a new tab boots its own (seed) state.
      const query = new URLSearchParams({
        e: employee.id,
        p: `PAY-${utr.slice(-6)}`,
        m: method,
        r: claims.map((c) => c.id).join(','),
        t: new Date().toISOString(),
      });
      const url = `${window.location.origin}/receipt/${utr}?${query.toString()}`;
      if (tab && !tab.closed) {
        tab.location.href = url;
      } else {
        setBlockedReceipt(url);
      }
      setPhase('idle');
    }, 900);
  };

  /* ------------------------------------------------------------------ empty */

  if (payees.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Disbursement run"
          subtitle="Nothing is standing against the corporate disbursement account right now."
          breadcrumb={[
            { label: 'Home', to: '/overview' },
            { label: 'Accounts Portal', to: '/accounts' },
            { label: 'Disbursement' },
          ]}
        />
        <Card variant="sheet">
          <EmptyState
            icon={ShieldCheck}
            eyebrow="Register empty"
            title="No claim is cleared for release"
            description="A claim reaches this page only after HR clears it and Accounts then passes it for payment. Pass one in the Accounts Portal and it joins the next run."
            action={
              <Button variant="primary" onClick={() => navigate('/accounts')}>
                Open Accounts Portal
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  /* --------------------------------------------------------------- checkout */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disbursement run"
        subtitle="Release passed claims to employee bank accounts. One run settles one payee against a single UTR."
        breadcrumb={[
          { label: 'Home', to: '/overview' },
          { label: 'Accounts Portal', to: '/accounts' },
          { label: 'Disbursement' },
        ]}
        actions={
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/accounts')}>
              Back to review
            </Button>
            <Button
              variant="outline"
              icon={RotateCcw}
              onClick={() => {
                resetDemoData();
                setBlockedReceipt(null);
              }}
            >
              Restore demo data
            </Button>
          </>
        }
      />

      {blockedReceipt && (
        <div className="ku-card flex flex-wrap items-center gap-x-3 gap-y-2 border-l-3 border-l-st-amber-ink px-4 py-3 animate-page-in">
          <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-st-amber-ink" />
          <p className="text-body-s text-light-black">
            The payment settled, but this browser blocked the receipt tab.
          </p>
          <a
            href={blockedReceipt}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-body-s font-semibold text-link-on-light underline underline-offset-2"
          >
            Open the receipt
          </a>
        </div>
      )}

      {/* The gate, stated once — a note ruled in the cleared tone, not a pastel banner. */}
      <div className="ku-card flex items-start gap-3 border-l-3 border-l-st-green-ink px-4 py-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-st-green-ink" />
        <p className="text-body-s leading-6 text-light-black">
          Every payee below has been cleared by HR and then passed for payment by Accounts. A claim
          still sitting on either desk cannot reach this page.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* -------------------------------------------- the payout register */}
        <Card variant="sheet" className="lg:col-span-3">
          <CardHeader
            eyebrow="Accounts · payout register"
            title="Cleared for release"
            subtitle="Totals are summed from the bills each employee filed."
            action={
              <span className="text-right">
                <span className="ku-total block text-lead leading-none">
                  {formatCurrency(queueTotal)}
                </span>
                <span className="ku-eyebrow mt-1 block">Standing in the queue</span>
              </span>
            }
          />

          {/* A register has ruled column heads, so this one does too. */}
          <div className="flex items-end justify-between gap-4 border-b-2 border-hairline-strong px-3 py-2 sm:px-4">
            <span className="ku-narrow text-micro font-semibold uppercase text-meta">
              Payee &amp; destination account
            </span>
            <span className="ku-narrow text-micro font-semibold uppercase text-meta">
              Payable
            </span>
          </div>

          <ul className="ku-ruled ku-stagger">
            {payees.map((p, index) => {
              const active = p.employee.id === selectedId;
              return (
                <li key={p.employee.id} style={{ '--i': index } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.employee.id)}
                    aria-pressed={active}
                    className={cx(
                      'flex w-full items-start gap-3 border-l-3 px-3 py-3 text-left transition-colors duration-150 sm:px-4',
                      active
                        ? 'border-l-orangy bg-canvas'
                        : 'border-l-transparent bg-white hover:bg-canvas',
                    )}
                  >
                    <Avatar name={p.employee.name} size="sm" className="mt-0.5" />

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="truncate font-semibold text-rich-black">
                          {p.employee.name}
                        </span>
                        <span className="ku-docket">{p.employee.employeeCode}</span>
                      </span>

                      <span className="mt-0.5 block truncate text-caption text-meta">
                        {p.employee.department}
                      </span>

                      {/* The destination account — the fact that makes this a cheque run. */}
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="ku-fig text-caption text-light-black">
                          {maskAccount(p.employee.bankAccount.accountNumberMasked)}
                        </span>
                        <span aria-hidden="true" className="h-2.5 w-px bg-hairline-strong" />
                        <span className="ku-fig text-caption text-meta">
                          {p.employee.bankAccount.ifsc}
                        </span>
                        {!p.employee.bankAccount.verified && (
                          <Badge tone="amber">Account unverified</Badge>
                        )}
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="ku-total block text-lead leading-none">
                        {formatCurrency(p.total)}
                      </span>
                      <span className="mt-1 block text-caption text-meta">
                        <span className="ku-fig">{p.claims.length}</span>{' '}
                        {p.claims.length === 1 ? 'claim' : 'claims'} ·{' '}
                        <span className="ku-fig">{p.receiptCount}</span> bills
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* ----------------------------------------------- the release sheet */}
        <div className="lg:col-span-2">
          <div className="ku-sheet lg:sticky lg:top-20">
            {selected ? (
              <>
                {/* The anchor figure. Everything beneath it explains this number. */}
                <div className="border-b border-hairline px-4 py-5 sm:px-5">
                  <p className="ku-eyebrow">Amount to release</p>
                  <p className="ku-total mt-2 text-figure leading-none">
                    {formatCurrency(selected.total)}
                  </p>
                  <p className="mt-2.5 text-caption text-meta">
                    <span className="ku-fig text-rich-black">1</span> payee ·{' '}
                    <span className="ku-fig text-rich-black">{selected.claims.length}</span>{' '}
                    {selected.claims.length === 1 ? 'claim' : 'claims'} ·{' '}
                    <span className="ku-fig text-rich-black">{selected.receiptCount}</span> bills on
                    file
                  </p>
                </div>

                {/* Where the money lands. */}
                <div className="border-b border-hairline px-4 py-4 sm:px-5">
                  <p className="ku-eyebrow">Credit to</p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <Avatar name={selected.employee.name} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-rich-black">
                        {selected.employee.name}
                      </p>
                      <p className="ku-docket mt-0.5">{selected.employee.employeeCode}</p>
                    </div>
                  </div>

                  <dl className="ku-ruled mt-3 border-t border-hairline">
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <dt className="shrink-0 text-caption text-meta">Bank</dt>
                      <dd className="truncate text-body-s text-rich-black">
                        {selected.employee.bankAccount.bankName}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <dt className="shrink-0 text-caption text-meta">Account</dt>
                      <dd className="ku-fig text-body-s text-rich-black">
                        {maskAccount(selected.employee.bankAccount.accountNumberMasked)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <dt className="shrink-0 text-caption text-meta">IFSC</dt>
                      <dd className="ku-fig text-body-s text-rich-black">
                        {selected.employee.bankAccount.ifsc}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* The claims this run discharges. */}
                <div className="border-b border-hairline px-4 py-4 sm:px-5">
                  <p className="ku-eyebrow">Claims discharged by this run</p>
                  <ul className="ku-ruled ku-scrollbar mt-2.5 max-h-52 overflow-y-auto border-t border-hairline">
                    {selected.claims.map((c) => (
                      <li key={c.id} className="flex items-baseline justify-between gap-3 py-2 pr-1">
                        <span className="min-w-0">
                          <span className="ku-docket block">{c.id}</span>
                          <span className="mt-0.5 block truncate text-body-s text-rich-black">
                            {c.title}
                          </span>
                        </span>
                        <span className="ku-fig shrink-0 text-body-s font-semibold text-rich-black">
                          {formatCurrency(c.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Rail. The chosen one carries the orange tone rule along its top edge. */}
                <div className="border-b border-hairline px-4 py-4 sm:px-5">
                  <p className="ku-eyebrow">Transfer rail</p>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {METHODS.map((m) => {
                      const active = m.key === method;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setMethod(m.key)}
                          aria-pressed={active}
                          className={cx(
                            'border px-2 py-2 text-center transition-colors duration-150',
                            active
                              ? 'border-t-3 border-rich-black border-t-orangy bg-canvas'
                              : 'border-hairline bg-white hover:border-hairline-strong',
                          )}
                        >
                          <span className="block font-mono text-micro font-semibold uppercase text-rich-black">
                            {m.label}
                          </span>
                          <span className="mt-1 block text-caption leading-tight text-meta">
                            {m.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sign-off strip: the heaviest rule on the page sits directly above the
                    one control that actually moves money. */}
                <div className="border-t-3 border-t-darkey-bluey px-4 py-4 sm:px-5">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={phase === 'processing'}
                    onClick={pay}
                  >
                    {phase === 'processing'
                      ? 'Releasing payment…'
                      : `Release ${formatCurrency(selected.total)}`}
                  </Button>

                  <p className="mt-3 text-caption leading-5 text-light-black">
                    Releases{' '}
                    <span className="ku-fig font-semibold text-rich-black">
                      {formatCurrency(selected.total)}
                    </span>{' '}
                    to <span className="ku-fig font-semibold text-rich-black">1</span> payee,{' '}
                    <span className="font-semibold text-rich-black">{selected.employee.name}</span>,
                    against{' '}
                    <span className="ku-fig font-semibold text-rich-black">
                      {selected.claims.length}
                    </span>{' '}
                    {selected.claims.length === 1 ? 'claim' : 'claims'} by{' '}
                    <span className="font-semibold text-rich-black">{method}</span>. A UTR is issued
                    the moment it goes, and a released run cannot be recalled from RTS.
                  </p>

                  <p className="mt-2.5 flex items-start gap-2 text-caption leading-5 text-meta">
                    <Lock aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
                    Demo build — no real transfer is made, and no card, UPI or account credentials
                    are collected. Funds notionally debit the corporate disbursement account.
                  </p>
                </div>
              </>
            ) : (
              <EmptyState
                compact
                icon={Landmark}
                eyebrow="No payee open"
                title="Pick a payee to open the release sheet"
                description="The sheet states the destination account, the claims being discharged and the exact amount before anything is released."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
