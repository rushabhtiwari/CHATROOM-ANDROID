// The disbursement advice an employee gets once a payout settles.
//
// STANDALONE: this route lives outside <AppShell>, so it renders with no sidebar, no
// topbar and no app chrome — it is its own document, opened in its own tab, and it is
// built to be printed.
//
// It is set as a real advice note rather than a web receipt: a navy band carrying the
// Kiran Udyog / RTS identity and the UTR that keys the document, a settled stamp struck
// once across the top of the sheet, then ruled label/value rows with every figure on the
// mono face. The BRANDING is Kiran Udyog's own — an advice carrying another company's
// name and domain would be a forged document.
//
// PRINT: `print-plain` strips the page ground, `print-band` collapses the navy head to a
// 6mm rule (its screen contents are `print-hide`), and a plain-ink letterhead takes over
// under `print:block`. Every value is rendered from live payout data — nothing is an image.

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DotMatrix } from '@/components/ui/DotMatrix';
import { Stamp } from '@/components/ui/StatusBadge';
import { useApp } from '@/context/AppContext';
import { formatAmount, formatDateTime, maskAccount } from '@/lib/format';

/** One ruled line of the advice: stamped label on the left, the fact on the right. */
function Line({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[minmax(88px,32%)_1fr] items-baseline gap-x-4 py-2.5">
      <dt className="ku-eyebrow">{label}</dt>
      <dd className="min-w-0 text-body-s text-rich-black">{children}</dd>
    </div>
  );
}

export default function PaymentReceipt() {
  const { utr = '' } = useParams<{ utr: string }>();
  const [params] = useSearchParams();
  const { payouts, employeeById, requests } = useApp();

  /**
   * Same tab: read the live payout. New tab or refresh: rebuild from the URL, which
   * carries everything the receipt needs. No storage APIs are used either way.
   */
  const receipt = useMemo(() => {
    const live = payouts.filter((p) => p.utr === utr);
    if (live.length > 0) {
      const emp = employeeById(live[0].employeeId);
      if (emp) {
        return {
          employee: emp,
          payoutId: live[0].id,
          method: live[0].method,
          paidOn: live[0].settledOn ?? live[0].initiatedOn,
          total: live.reduce((s, p) => s + p.amount, 0),
          claims: requests.filter((r) => live.some((p) => p.requestId === r.id)),
        };
      }
    }

    const employeeId = params.get('e');
    const claimIds = (params.get('r') ?? '').split(',').filter(Boolean);
    if (!employeeId || claimIds.length === 0) return null;

    const emp = employeeById(employeeId);
    if (!emp) return null;
    const claims = claimIds.map(id => requests.find(r => r.id === id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    if (claims.length === 0) return null;

    return {
      employee: emp,
      payoutId: params.get('p') ?? '—',
      method: (params.get('m') ?? 'NEFT') as 'NEFT' | 'IMPS' | 'UPI',
      paidOn: params.get('t') ?? new Date().toISOString(),
      total: claims.reduce((s, c) => s + c.amount, 0),
      claims,
    };
  }, [payouts, employeeById, requests, utr, params]);

  const employee = receipt?.employee;
  const total = receipt?.total ?? 0;
  const claims = receipt?.claims ?? [];

  useEffect(() => {
    document.title = employee
      ? `Disbursement advice ${utr} — ₹${formatAmount(total)} to ${employee.name}`
      : 'Disbursement advice — RTS';
  }, [utr, employee, total]);

  if (!receipt || !employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
        <div className="ku-sheet w-full max-w-lg animate-page-in px-6 py-8 sm:px-8">
          <p className="ku-eyebrow">RTS · disbursement advice</p>
          <h1 className="ku-wide mt-2.5 font-display text-h2 font-semibold text-rich-black">
            No advice on file for this UTR
          </h1>
          <p className="mt-3 text-body-s leading-6 text-meta">
            Nothing in the payout register matches{' '}
            <span className="ku-fig break-all text-rich-black">{utr}</span>, and this link is
            missing the details needed to rebuild the advice. Open the disbursement run to release
            the claim again and a fresh advice is issued.
          </p>
          <Link
            to="/pay"
            className="mt-7 inline-flex h-10 items-center gap-2 border-2 border-rich-black bg-orangy px-4 text-body-s font-semibold leading-none text-rich-black transition-all duration-150 hover:brightness-95 active:translate-y-px"
          >
            Go to the disbursement run
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="print-plain min-h-screen bg-canvas">
      <div className="mx-auto w-full max-w-[720px] px-3 py-4 sm:px-4 sm:py-10 print:max-w-none print:p-0">
        <article className="ku-card animate-page-in bg-white print:border-0">
          {/* The document names itself. On screen and in print that job is done by the
              wordmark, the UTR and the stamp, so the heading is carried for the
              accessibility tree only and mirrors the `document.title` set above. */}
          <h1 className="sr-only">Disbursement advice — UTR {utr}</h1>

          {/* ------------------------------------------------------ head band */}
          {/* In print this collapses to a 6mm navy rule, so everything inside it
              is screen-only and the ink letterhead below takes over. */}
          <header className="print-band relative overflow-hidden bg-darkey-bluey px-5 py-5 sm:px-8 sm:py-6">
            <DotMatrix className="print-hide absolute inset-0 text-white" opacity={0.1} />

            <div className="print-hide relative flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1 block h-9 w-1.5 shrink-0 bg-orangy" />
                <span className="min-w-0">
                  <span className="ku-xwide block font-display text-h3 font-bold leading-none text-white">
                    RTS
                  </span>
                  <span className="mt-1.5 block text-caption leading-tight text-dark-white/75">
                    Kiran Udyog · Receipt &amp; Reimbursement Tracking
                  </span>
                </span>
              </div>

              {/* The UTR is the key this whole document is filed under. */}
              <div className="min-w-0">
                <span className="ku-eyebrow block text-orangy">Bank reference · UTR</span>
                <span className="ku-fig mt-1.5 block break-all text-lead font-semibold leading-tight text-white">
                  {utr}
                </span>
              </div>
            </div>
          </header>

          {/* Ink letterhead — print only, because the navy band is gone by then. */}
          <div className="hidden border-b-3 border-rich-black px-8 pb-3 pt-1 print:block">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="ku-xwide font-display text-h3 font-bold leading-none text-rich-black">
                  Kiran Udyog
                </p>
                <p className="mt-1.5 text-caption text-light-black">
                  Receipt &amp; Reimbursement Tracking · Disbursement advice
                </p>
              </div>
              <div className="text-right">
                <p className="ku-eyebrow">Bank reference · UTR</p>
                <p className="ku-fig mt-1 text-body-s font-semibold text-rich-black">{utr}</p>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------ the anchor figure */}
          <section className="flex flex-wrap items-start justify-between gap-x-8 gap-y-6 border-b border-hairline px-5 py-7 sm:px-8">
            <div className="min-w-0">
              <p className="ku-eyebrow">Amount disbursed</p>
              <p className="ku-total mt-2.5 text-figure-lg leading-none">
                ₹{formatAmount(total)}
              </p>
              <p className="mt-3.5 max-w-[42ch] text-body-s leading-6 text-light-black">
                Released to {employee.name} by {receipt.method} on{' '}
                <span className="ku-fig text-rich-black">{formatDateTime(receipt.paidOn)}</span> and
                credited back to the monthly allowance pool.
              </p>
            </div>

            {/* The one struck stamp on the page — this is the artifact it belongs on. */}
            <div className="shrink-0 pr-2 pt-1 sm:pt-3">
              <Stamp label="Settled" tone="green" />
            </div>
          </section>

          {/* ------------------------------------------------------- the facts */}
          <section className="border-b border-hairline px-5 py-5 sm:px-8">
            <h2 className="ku-eyebrow mb-1.5 text-rich-black">Payment</h2>
            <dl className="ku-ruled border-t-2 border-hairline-strong">
              <Line label="Advice ref">
                <span className="ku-fig break-all">{receipt.payoutId}</span>
              </Line>
              <Line label="UTR">
                <span className="ku-fig break-all">{utr}</span>
              </Line>
              <Line label="Value date">
                <span className="ku-fig">{formatDateTime(receipt.paidOn)}</span>
              </Line>
              <Line label="Rail">
                <span className="font-semibold">{receipt.method}</span>
                <span className="ml-2 text-meta">transfer, single settlement</span>
              </Line>
              <Line label="Debited">Kiran Udyog corporate disbursement account</Line>
            </dl>
          </section>

          <section className="border-b border-hairline px-5 py-5 sm:px-8">
            <h2 className="ku-eyebrow mb-1.5 text-rich-black">Beneficiary</h2>
            <dl className="ku-ruled border-t-2 border-hairline-strong">
              <Line label="Paid to">
                <span className="font-semibold">{employee.name}</span>
                <span className="ku-fig ml-2 text-meta">{employee.employeeCode}</span>
              </Line>
              <Line label="Bank">{employee.bankAccount.bankName}</Line>
              <Line label="Account">
                <span className="ku-fig">
                  {maskAccount(employee.bankAccount.accountNumberMasked)}
                </span>
              </Line>
              <Line label="IFSC">
                <span className="ku-fig">{employee.bankAccount.ifsc}</span>
              </Line>
              <Line label="Department">{employee.department}</Line>
              <Line label="Notified">
                <span className="break-all text-link-on-light">{employee.email}</span>
              </Line>
            </dl>
          </section>

          {/* ------------------------------------------- what the advice settles */}
          <section className="px-5 py-5 sm:px-8">
            <div className="flex items-end justify-between gap-4 border-b-2 border-hairline-strong pb-2">
              <h2 className="ku-narrow text-micro font-semibold uppercase text-meta">
                Claims discharged
              </h2>
              <span className="ku-narrow text-micro font-semibold uppercase text-meta">
                Amount
              </span>
            </div>

            <ul className="ku-ruled">
              {claims.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <span className="ku-docket block">{c.id}</span>
                    <span className="mt-0.5 block text-body-s leading-5 text-rich-black">
                      {c.title}
                    </span>
                  </span>
                  <span className="ku-fig shrink-0 text-body-s font-semibold text-rich-black">
                    ₹{formatAmount(c.amount)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between gap-4 border-t-2 border-rich-black pt-2.5">
              <span className="ku-eyebrow">
                Total credited ·{' '}
                <span className="ku-fig">{claims.length}</span>{' '}
                {claims.length === 1 ? 'claim' : 'claims'}
              </span>
              <span className="ku-total text-lead">₹{formatAmount(total)}</span>
            </div>

            <div className="print-hide mt-6 flex flex-wrap items-center gap-3">
              <Button variant="outline" icon={Printer} onClick={() => window.print()}>
                Print this advice
              </Button>
              <p className="text-caption text-meta">
                Keep a copy — the UTR is what your bank will ask for.
              </p>
            </div>
          </section>

          {/* ------------------------------------------------------------ foot */}
          <section className="border-t-2 border-orangy px-5 py-5 sm:px-8">
            <p className="text-body-s leading-6 text-light-black">
              Query on this payout? Raise it with Vikram Sethi, Accounts Controller, quoting the UTR
              above.
            </p>
            <p className="mt-2 text-caption leading-5 text-meta">
              Kiran Udyog · Receipt &amp; Reimbursement Tracking · Demo build — no funds were
              transferred.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
