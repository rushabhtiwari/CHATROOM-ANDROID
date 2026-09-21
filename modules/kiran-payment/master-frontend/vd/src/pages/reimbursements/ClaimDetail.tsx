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
          statement="Claim not found"
          actionLabel="Back"
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
        actions={
          <Link
            to="/reimbursements"
            className="btn-secondary"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" /> Back
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ------------------------------ main ------------------------------ */}
        <div className="space-y-6">
          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[16px] font-semibold text-ink">Claim</h2>
              <span className="whitespace-nowrap text-[22px] font-semibold leading-none tabular-nums text-ink">
                {formatCurrency(claim.amount)}
              </span>
            </div>
            <div className="space-y-4 px-5 py-4">
              <Field label="Claim no.">
                <span className="font-code text-[13px]">{claim.id}</span>
              </Field>
              <Field label="Category">{CATEGORY_LABEL[claim.category]}</Field>
              <Field label="Filed">{formatDate(claim.submittedOn)}</Field>
              <Field label="Reason">
                {claim.justification || <span className="text-muted">—</span>}
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
                <h2 className="text-[16px] font-semibold text-ink">Receipt check</h2>
                {amountEdited && (
                  <span className="inline-flex items-center rounded-badge bg-[#FBEFDC] px-2 py-0.5 text-[12px] font-medium text-[#8A4F00]">
                    Amount edited
                  </span>
                )}
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="label-eyebrow">On receipt</p>
                    <p className="mt-1 text-[18px] font-semibold tabular-nums text-ink">
                      {typeof claim.extractedAmount === 'number'
                        ? formatCurrency(claim.extractedAmount)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="label-eyebrow">Claimed</p>
                    <p className="mt-1 text-[18px] font-semibold tabular-nums text-ink">
                      {formatCurrency(claim.amount)}
                    </p>
                  </div>
                </div>

                {reading.policyFindings && reading.policyFindings.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-line-2 pt-4">
                    <p className="label-eyebrow">Policy</p>
                    {reading.policyFindings.map((finding, index) => (
                      <p
                        key={index}
                        className="rounded-md bg-[#FBEFDC] px-3 py-2 text-[13px] leading-relaxed text-[#8A4F00]"
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
              <h2 className="text-[16px] font-semibold text-ink">Receipts</h2>
              <span className="text-[13px] text-muted">{claim.receipts.length}</span>
            </div>
            {claim.receipts.length === 0 ? (
              <p className="px-5 py-6 text-center text-[14px] text-muted">No receipts attached.</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {claim.receipts.map((receipt) => (
                  <li key={receipt.id} className="flex min-h-[52px] items-center gap-3 px-5 py-3">
                    <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">
                        {receipt.fileName}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {formatFileSize(receipt.sizeKb)} · {formatDate(receipt.uploadedOn)}
                      </span>
                    </span>
                    {receipt.url && (
                      <a
                        href={receipt.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary shrink-0"
                      >
                        Open <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[16px] font-semibold text-ink">History</h2>
            </div>
            <ol className="relative space-y-5 px-5 py-5">
              {claim.timeline.map((event, index) => (
                <li key={event.id} className="relative flex gap-3">
                  <span className="relative flex flex-col items-center">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                    {index < claim.timeline.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-line" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <p className="text-[14px] font-medium text-ink">
                      {event.action}
                      <span className="ml-1.5 font-normal text-muted">
                        · {event.actor} ({ROLE_LABEL[event.role]})
                      </span>
                    </p>
                    {event.comment && (
                      <p className="mt-0.5 text-[14px] leading-relaxed text-slate-700">
                        {event.comment}
                      </p>
                    )}
                    <p className="mt-0.5 text-[13px] text-muted">
                      {formatDateTime(event.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ------------------------------ aside ----------------------------- */}
        <div className="space-y-6">
          {employee && (
            <section className="panel">
              <div className="panel-header">
                <h2 className="text-[16px] font-semibold text-ink">Employee</h2>
              </div>
              <div className="space-y-3 px-5 py-4">
                <div>
                  <p className="text-[14px] font-medium text-ink">{employee.name}</p>
                  <p className="text-[13px] text-muted">
                    {employee.employeeCode} · {employee.department}
                  </p>
                </div>
                <Field label="Manager">{employee.managerName}</Field>
                <Field label="Allowance used">
                  <span className="tabular-nums">
                    {formatCurrency(employee.usedThisMonth)} of{' '}
                    {formatCurrency(employee.monthlyAllowance)}
                  </span>
                </Field>
                <Field label="Bank">
                  <span>
                    {employee.bankAccount.bankName} · {employee.bankAccount.accountNumberMasked}
                  </span>
                  {employee.bankAccount.verified ? (
                    <span className="ml-2 inline-flex items-center rounded-badge bg-[#E7F3EB] px-2 py-0.5 text-[12px] font-medium text-[#17723F]">
                      Verified
                    </span>
                  ) : (
                    <span className="ml-2 rounded-badge bg-[#FBEFDC] px-2 py-0.5 text-[12px] font-medium text-[#8A4F00]">
                      Not verified
                    </span>
                  )}
                </Field>
              </div>
            </section>
          )}

          {payout && (
            <section className="panel">
              <div className="panel-header">
                <h2 className="text-[16px] font-semibold text-ink">Payment</h2>
              </div>
              <div className="space-y-3 px-5 py-4">
                <Field label="Status">{payout.status}</Field>
                <Field label="Method">{payout.method}</Field>
                {payout.utr && (
                  <Field label="UTR">
                    <span className="font-code text-[13px]">{payout.utr}</span>
                  </Field>
                )}
                {payout.failureReason && (
                  <p className="rounded-md bg-[#FBE9E7] px-3 py-2 text-[13px] text-[#B3302A]">
                    {payout.failureReason}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Actions. The server enforces the same rule this panel implies. */}
          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[16px] font-semibold text-ink">
                {owner ? `With ${ROLE_LABEL[owner]}` : 'Review complete'}
              </h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              {blocked && (
                <p className="rounded-md bg-canvas px-3 py-2 text-[13px] leading-relaxed text-muted">
                  {blocked}
                </p>
              )}

              {(owner === 'HR' || owner === 'ACCOUNTS') && (
                <>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Add a note"
                    className="field h-auto resize-none py-2"
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
                      className="btn-primary flex-1"
                    >
                      {busy === 'approve' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
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
                      className="btn-secondary h-11 text-strand-red"
                    >
                      {busy === 'reject' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
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
                    className="btn-secondary w-full"
                  >
                    Ask for details
                  </button>
                </>
              )}

              <Link
                to="/chat"
                className="btn-secondary w-full"
              >
                <MessageSquareText className="h-4 w-4 text-slate-500" /> Chat
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
    <div className="mt-1 text-[14px] leading-relaxed text-ink">{children}</div>
  </div>
);

export default ClaimDetail;
