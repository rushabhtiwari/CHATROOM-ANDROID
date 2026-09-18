/**
 * One claim, in full.
 *
 * The layout follows the question a reviewer actually asks: what is being
 * claimed, does the receipt support it, and has anything been changed between
 * the two. That last one is why the reading is shown beside the submission
 * rather than instead of it — an amount the employee edited is the single most
 * useful thing a reviewer can be told, and it is invisible if the system only
 * keeps the final figure.
 */

import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  Pencil,
  Sparkles,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useRts } from '@/modules/rts/store';
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from '@/modules/rts/format';
import {
  CATEGORY_LABEL,
  ROLE_LABEL,
  accountsBlockedReason,
  actionOwner,
} from '@/modules/rts/status';
import type { RequestStatus, Role } from '@/modules/rts/types';
import { ClaimStatusPill } from './ClaimStatusPill';

export const ClaimDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requests, employeeById, payouts, updateRequestStatus } = useRts();

  const [busy, setBusy] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const claim = useMemo(() => requests.find((request) => request.id === id), [requests, id]);
  const payout = useMemo(
    () => payouts.find((row) => row.requestId === id),
    [payouts, id],
  );

  if (!claim) {
    return (
      <>
        <PageHeader title="Claim not found" />
        <EmptyState
          icon={FileText}
          statement="That claim is not in the system"
          instruction="It may have been reset with the demo data."
          actionLabel="Back to reimbursements"
          onAction={() => navigate('/reimbursements')}
        />
      </>
    );
  }

  const employee = employeeById(claim.employeeId);
  const owner = actionOwner(claim.status);
  const blocked = accountsBlockedReason(claim.status);

  const act = async (status: RequestStatus, role: Role, label: string) => {
    setBusy(label);
    await updateRequestStatus(
      claim.id,
      status,
      employee?.managerName ?? 'Reviewer',
      role,
      comment.trim() || undefined,
    );
    setComment('');
    setBusy(null);
  };

  /* The reading, next to what was actually submitted. */
  const reading = claim.extraction;
  const amountEdited =
    typeof claim.extractedAmount === 'number' && claim.extractedAmount !== claim.amount;

  return (
    <>
      <PageHeader
        title={claim.title}
        badge={<ClaimStatusPill status={claim.status} />}
        description={`${claim.id} · ${CATEGORY_LABEL[claim.category]} · filed ${formatDate(
          claim.submittedOn,
        )} by ${employee?.name ?? 'an employee'}`}
        actions={
          <Link
            to="/reimbursements"
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-line-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All claims
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ------------------------------ main ------------------------------ */}
        <div className="space-y-5">
          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[13px] font-semibold text-ink">The claim</h2>
              <span className="font-mono text-[20px] font-semibold leading-none tracking-tight text-ink">
                {formatCurrency(claim.amount)}
              </span>
            </div>
            <div className="space-y-4 px-5 py-4">
              <Field label="Purpose">{claim.title}</Field>
              <Field label="Justification">
                {claim.justification || (
                  <span className="text-muted">Nothing was written.</span>
                )}
              </Field>
              {claim.travelDates && (
                <Field label="Travel">
                  {formatDate(claim.travelDates.from)} – {formatDate(claim.travelDates.to)}
                </Field>
              )}
            </div>
          </section>

          {/* The trust boundary, made visible. */}
          {reading && (
            <section className="panel">
              <div className="panel-header">
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <Sparkles className="h-3.5 w-3.5 text-ai" /> What the receipt said
                </h2>
                {amountEdited && (
                  <span className="inline-flex items-center gap-1 rounded-badge border border-strand-amber/30 bg-strand-amber/10 px-2 py-0.5 text-[10.5px] font-semibold text-strand-amber">
                    <Pencil className="h-2.5 w-2.5" /> Amount edited
                  </span>
                )}
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="label-eyebrow">Read from the receipt</p>
                    <p className="mt-1 font-mono text-[17px] font-semibold text-ai">
                      {typeof claim.extractedAmount === 'number'
                        ? formatCurrency(claim.extractedAmount)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="label-eyebrow">Submitted by {employee?.name.split(' ')[0]}</p>
                    <p className="mt-1 font-mono text-[17px] font-semibold text-ink">
                      {formatCurrency(claim.amount)}
                    </p>
                  </div>
                </div>

                {reading.policyFindings && reading.policyFindings.length > 0 && (
                  <div className="mt-4 space-y-1.5 border-t border-line pt-3.5">
                    <p className="label-eyebrow">Policy</p>
                    {reading.policyFindings.map((finding, index) => (
                      <p
                        key={index}
                        className="rounded-md bg-strand-amber/8 px-2.5 py-1.5 text-[12px] leading-relaxed text-strand-amber"
                      >
                        {finding.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[13px] font-semibold text-ink">Receipts</h2>
              <span className="font-mono text-[11px] text-muted">{claim.receipts.length}</span>
            </div>
            {claim.receipts.length === 0 ? (
              <p className="px-5 py-6 text-center text-[12.5px] text-muted">
                No documents were attached to this claim.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {claim.receipts.map((receipt) => (
                  <li key={receipt.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas text-muted">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-ink">
                        {receipt.fileName}
                      </span>
                      <span className="block font-mono text-[10.5px] text-muted">
                        {formatFileSize(receipt.sizeKb)} · {formatDate(receipt.uploadedOn)}
                      </span>
                    </span>
                    {receipt.url && (
                      <a
                        href={receipt.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-line-2"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[13px] font-semibold text-ink">History</h2>
            </div>
            <ol className="relative space-y-5 px-5 py-5">
              {claim.timeline.map((event, index) => (
                <li key={event.id} className="relative flex gap-3">
                  <span className="relative flex flex-col items-center">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-kiran ring-4 ring-kiran-tint" />
                    {index < claim.timeline.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-line" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <p className="text-[12.5px] font-medium text-ink">
                      {event.action}
                      <span className="ml-1.5 font-normal text-muted">
                        · {event.actor} ({ROLE_LABEL[event.role]})
                      </span>
                    </p>
                    {event.comment && (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                        {event.comment}
                      </p>
                    )}
                    <p className="mt-0.5 font-mono text-[10.5px] text-muted">
                      {formatDateTime(event.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ------------------------------ aside ----------------------------- */}
        <div className="space-y-5">
          {employee && (
            <section className="panel">
              <div className="panel-header">
                <h2 className="text-[13px] font-semibold text-ink">Employee</h2>
              </div>
              <div className="space-y-3 px-5 py-4">
                <div>
                  <p className="text-[13px] font-semibold text-ink">{employee.name}</p>
                  <p className="font-mono text-[11px] text-muted">
                    {employee.employeeCode} · {employee.department}
                  </p>
                </div>
                <Field label="Reports to">{employee.managerName}</Field>
                <Field label="Monthly allowance">
                  <span className="font-mono">
                    {formatCurrency(employee.usedThisMonth)} of{' '}
                    {formatCurrency(employee.monthlyAllowance)} used
                  </span>
                </Field>
                <Field label="Bank">
                  <span className="font-mono">
                    {employee.bankAccount.bankName} · {employee.bankAccount.accountNumberMasked}
                  </span>
                  {employee.bankAccount.verified ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-badge bg-strand-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-strand-green">
                      <Check className="h-2.5 w-2.5" /> Verified
                    </span>
                  ) : (
                    <span className="ml-2 rounded-badge bg-strand-amber/10 px-1.5 py-0.5 text-[10px] font-semibold text-strand-amber">
                      Unverified
                    </span>
                  )}
                </Field>
              </div>
            </section>
          )}

          {payout && (
            <section className="panel">
              <div className="panel-header">
                <h2 className="text-[13px] font-semibold text-ink">Payment</h2>
              </div>
              <div className="space-y-3 px-5 py-4">
                <Field label="Status">{payout.status}</Field>
                <Field label="Method">{payout.method}</Field>
                {payout.utr && (
                  <Field label="UTR">
                    <span className="font-mono">{payout.utr}</span>
                  </Field>
                )}
                {payout.failureReason && (
                  <p className="rounded-md bg-strand-red/8 px-2.5 py-1.5 text-[11.5px] text-strand-red">
                    {payout.failureReason}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Actions. The server enforces the same rule this panel implies. */}
          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[13px] font-semibold text-ink">
                {owner ? `Waiting on ${ROLE_LABEL[owner]}` : 'No action pending'}
              </h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              {blocked && (
                <p className="rounded-md bg-canvas px-2.5 py-2 text-[11.5px] leading-relaxed text-muted">
                  {blocked}
                </p>
              )}

              {(owner === 'HR' || owner === 'ACCOUNTS') && (
                <>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Add a note for the record"
                    className="w-full resize-none rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px] placeholder:text-muted focus:border-kiran focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        act(
                          owner === 'HR' ? 'HR_APPROVED' : 'ACC_APPROVED',
                          owner,
                          'approve',
                        )
                      }
                      disabled={Boolean(busy)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-strand-green px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busy === 'approve' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        act(
                          owner === 'HR' ? 'HR_REJECTED' : 'ACC_REJECTED',
                          owner,
                          'reject',
                        )
                      }
                      disabled={Boolean(busy)}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs font-semibold text-strand-red transition-colors hover:bg-strand-red/5 disabled:opacity-50"
                    >
                      {busy === 'reject' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Reject
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      act(
                        owner === 'HR' ? 'HR_INFO_REQUESTED' : 'ACC_INFO_REQUESTED',
                        owner,
                        'info',
                      )
                    }
                    disabled={Boolean(busy)}
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-line-2 disabled:opacity-50"
                  >
                    Ask for more information
                  </button>
                </>
              )}

              {!owner && (
                <p className="text-[12.5px] text-muted">
                  This claim has completed its review chain.
                </p>
              )}

              <Link
                to="/chat"
                className="flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-line-2"
              >
                <MessageSquareText className="h-3.5 w-3.5" /> Discuss in chat
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="label-eyebrow">{label}</p>
    <div className="mt-1 text-[12.5px] leading-relaxed text-slate-700">{children}</div>
  </div>
);

export default ClaimDetail;
