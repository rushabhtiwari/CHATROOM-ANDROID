/**
 * The payment receipt.
 *
 * This is the one screen in the console that is a document rather than an
 * interface: it is what an employee is sent, what they forward to their bank
 * if a credit does not arrive, and what an auditor asks for. So it carries no
 * application chrome, prints cleanly on one page, and states the UTR before
 * anything else — that is the number every downstream question is about.
 */

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { getReceiptContext, type ReceiptContext } from '@/modules/rts/api';
import { formatCurrency, formatDate, formatDateTime } from '@/modules/rts/format';

export const PaymentReceipt: React.FC = () => {
  const { utr = '' } = useParams<{ utr: string }>();
  const [context, setContext] = useState<ReceiptContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReceiptContext(utr)
      .then((result) => {
        if (!cancelled) setContext(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'That receipt could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [utr]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="panel max-w-md px-8 py-10 text-center">
          <h1 className="font-display text-lg font-semibold text-ink">Receipt unavailable</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{error}</p>
          <Link
            to="/reimbursements/pay"
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-kiran px-3.5 py-2 text-xs font-semibold text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to disbursement
          </Link>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-5 w-5 animate-spin text-kiran" />
      </div>
    );
  }

  const { employee, requests, total, method, settledOn } = context;

  return (
    <div className="min-h-screen bg-canvas px-4 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            to="/reimbursements/pay"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Disbursement
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-line-2"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>

        <article className="panel-lift overflow-hidden print:border-0 print:shadow-none">
          {/* Masthead */}
          <header className="flex items-start justify-between gap-4 border-b border-line px-8 py-6">
            <div className="flex items-center gap-3">
              <img
                src="/kiran-mark.png"
                alt=""
                className="h-9 w-9 rounded-md object-contain ring-1 ring-line"
              />
              <div>
                <p className="font-display text-[15px] font-bold leading-none tracking-tight text-ink">
                  Kiran Cable Protection
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Products Private Limited
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="label-eyebrow">Payment advice</p>
              <p className="mt-1 font-mono text-[12px] text-muted">
                {settledOn ? formatDate(settledOn) : formatDate(new Date())}
              </p>
            </div>
          </header>

          {/* The number everything else refers to */}
          <div className="border-b border-line bg-surface-2 px-8 py-6">
            <p className="label-eyebrow">Bank reference (UTR)</p>
            <p className="mt-1.5 font-mono text-[26px] font-semibold leading-none tracking-tight text-ink">
              {context.utr}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
              <div>
                <p className="label-eyebrow">Amount credited</p>
                <p className="mt-1 font-mono text-[20px] font-semibold leading-none text-strand-green">
                  {formatCurrency(total)}
                </p>
              </div>
              <div>
                <p className="label-eyebrow">Method</p>
                <p className="mt-1 font-mono text-[15px] font-semibold leading-none text-ink">
                  {method}
                </p>
              </div>
              {settledOn && (
                <div>
                  <p className="label-eyebrow">Settled</p>
                  <p className="mt-1 font-mono text-[13px] leading-none text-ink">
                    {formatDateTime(settledOn)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payee */}
          {employee && (
            <div className="border-b border-line px-8 py-5">
              <p className="label-eyebrow">Paid to</p>
              <p className="mt-1.5 text-[14px] font-semibold text-ink">{employee.name}</p>
              <p className="mt-0.5 font-mono text-[12px] text-muted">
                {employee.employeeCode} · {employee.department}
              </p>
              <p className="mt-2 font-mono text-[12px] text-slate-700">
                {employee.bankAccount.bankName} · {employee.bankAccount.accountNumberMasked} ·{' '}
                {employee.bankAccount.ifsc}
              </p>
            </div>
          )}

          {/* What it settles */}
          <div className="px-8 py-5">
            <p className="label-eyebrow">Claims settled by this transfer</p>
            <table className="mt-3 w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="pb-2 font-semibold text-muted">Claim</th>
                  <th className="pb-2 font-semibold text-muted">Purpose</th>
                  <th className="pb-2 text-right font-semibold text-muted">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="py-2 font-mono text-[12px] text-slate-600">{request.id}</td>
                    <td className="py-2 pr-3 text-slate-700">{request.title}</td>
                    <td className="py-2 text-right font-mono font-semibold text-ink">
                      {formatCurrency(request.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink/15">
                  <td colSpan={2} className="pt-3 text-right font-semibold text-ink">
                    Total
                  </td>
                  <td className="pt-3 text-right font-mono text-[15px] font-semibold text-ink">
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <footer className="border-t border-line bg-surface-2 px-8 py-4">
            <p className="text-[12px] leading-relaxed text-muted">
              Computer-generated advice; no signature is required. If the credit has not appeared
              within two working days, quote the UTR above to your bank.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
};

export default PaymentReceipt;
