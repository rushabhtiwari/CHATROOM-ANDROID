/**
 * The HR review queue.
 *
 * HR is answering one question — was this expense legitimate business need —
 * and it is a question they can usually answer in a few seconds per claim. So
 * this is a working queue, not a table: each claim is a card with the receipt
 * reading, the policy flags and the two buttons on it, and approving one moves
 * to the next. Anything requiring a longer look opens in full.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ClipboardCheck,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useRts } from '@/modules/rts/store';
import { formatCurrency, formatDate, formatRelative } from '@/modules/rts/format';
import { CATEGORY_LABEL, actionOwner } from '@/modules/rts/status';
import type { ReceiptRequest } from '@/modules/rts/types';
import { ClaimSummaryBar } from './ClaimSummaryBar';

export const HrReview: React.FC = () => {
  const { requests, employeeById, updateRequestStatus } = useRts();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queue = useMemo(
    () =>
      requests
        .filter((request) => actionOwner(request.status) === 'HR')
        .sort((a, b) => a.submittedOn.localeCompare(b.submittedOn)),
    [requests],
  );

  const act = async (claim: ReceiptRequest, approve: boolean) => {
    const key = `${claim.id}-${approve ? 'a' : 'r'}`;
    setBusy(key);
    const employee = employeeById(claim.employeeId);
    await updateRequestStatus(
      claim.id,
      approve ? 'HR_APPROVED' : 'HR_REJECTED',
      employee?.managerName ?? 'HR',
      'HR',
      notes[claim.id]?.trim() || undefined,
    );
    setNotes((current) => {
      const next = { ...current };
      delete next[claim.id];
      return next;
    });
    setBusy(null);
  };

  return (
    <>
      <PageHeader
        title="HR review"
      />

      <ClaimSummaryBar className="mb-6" />

      {queue.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          statement="Nothing to review"
        />
      ) : (
        <div className="space-y-4">
          {queue.map((claim) => {
            const employee = employeeById(claim.employeeId);
            const amountEdited =
              typeof claim.extractedAmount === 'number' && claim.extractedAmount !== claim.amount;
            const findings = claim.extraction?.policyFindings ?? [];

            return (
              <article key={claim.id} className="panel overflow-hidden">
                <div className="flex flex-wrap items-start gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold text-ink">{claim.title}</h2>
                      {amountEdited && (
                        <span className="inline-flex items-center rounded-badge bg-[#FBEFDC] px-2 py-0.5 text-[12px] font-medium text-[#8A4F00]">
                          Amount edited
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] text-muted">
                      <span className="font-code">{claim.id}</span> · {employee?.name ?? 'Unknown'} ·{' '}
                      {employee?.department ?? '—'} · {CATEGORY_LABEL[claim.category]} ·{' '}
                      {formatRelative(claim.submittedOn)}
                    </p>

                    {claim.justification && (
                      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-700">
                        {claim.justification}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {claim.receipts.map((receipt) => (
                        <a
                          key={receipt.id}
                          href={receipt.url ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-[220px] items-center gap-1.5 rounded-badge border border-line bg-surface-2 px-2.5 py-1 text-[13px] text-slate-700 transition-colors hover:bg-line-2"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">{receipt.fileName}</span>
                        </a>
                      ))}
                    </div>

                    {findings.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {findings.map((finding, index) => (
                          <p
                            key={index}
                            className="flex items-start gap-1.5 text-[13px] leading-relaxed text-[#8A4F00]"
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {finding.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="whitespace-nowrap text-[22px] font-semibold leading-none tabular-nums text-ink">
                      {formatCurrency(claim.amount)}
                    </span>
                    {amountEdited && (
                      <span className="whitespace-nowrap text-[13px] tabular-nums text-muted line-through">
                        {formatCurrency(claim.extractedAmount as number)}
                      </span>
                    )}
                    <Link
                      to={`/reimbursements/${claim.id}`}
                      className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-kiran hover:underline"
                    >
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line-2 px-5 py-3">
                  <input
                    value={notes[claim.id] ?? ''}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [claim.id]: event.target.value }))
                    }
                    placeholder="Add a note"
                    className="field min-w-0 flex-1"
                  />
                  <button
                    onClick={() => act(claim, true)}
                    disabled={Boolean(busy)}
                    className="btn-primary"
                  >
                    {busy === `${claim.id}-a` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => act(claim, false)}
                    disabled={Boolean(busy)}
                    className="btn-secondary text-strand-red"
                  >
                    {busy === `${claim.id}-r` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
};

export default HrReview;
