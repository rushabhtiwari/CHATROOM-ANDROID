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
  Pencil,
  Sparkles,
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

      <ClaimSummaryBar className="mb-5" />

      {queue.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          statement="The HR queue is clear"
          instruction="New claims arrive here the moment an employee files one."
        />
      ) : (
        <div className="space-y-3">
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
                      <h2 className="text-[14px] font-semibold text-ink">{claim.title}</h2>
                      {amountEdited && (
                        <span className="inline-flex items-center gap-1 rounded-badge border border-strand-amber/30 bg-strand-amber/10 px-1.5 py-0.5 text-[10px] font-semibold text-strand-amber">
                          <Pencil className="h-2.5 w-2.5" /> Amount edited
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {claim.id} · {employee?.name ?? 'Unknown'} ·{' '}
                      {employee?.department ?? '—'} · {CATEGORY_LABEL[claim.category]} ·{' '}
                      filed {formatRelative(claim.submittedOn)}
                    </p>

                    {claim.justification && (
                      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-slate-700">
                        {claim.justification}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {claim.receipts.map((receipt) => (
                        <a
                          key={receipt.id}
                          href={receipt.url ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-[200px] items-center gap-1.5 rounded-badge border border-line bg-surface-2 px-2 py-1 text-[10.5px] text-slate-700 transition-colors hover:bg-line-2"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{receipt.fileName}</span>
                        </a>
                      ))}
                      {claim.extraction && (
                        <span className="inline-flex items-center gap-1 rounded-badge bg-ai-tint px-2 py-1 text-[10.5px] font-medium text-ai">
                          <Sparkles className="h-3 w-3" /> Read automatically
                        </span>
                      )}
                    </div>

                    {findings.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        {findings.map((finding, index) => (
                          <p
                            key={index}
                            className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-strand-amber"
                          >
                            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                            {finding.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[22px] font-semibold leading-none tracking-tight text-ink">
                      {formatCurrency(claim.amount)}
                    </span>
                    {amountEdited && (
                      <span className="font-mono text-[11px] text-muted line-through">
                        {formatCurrency(claim.extractedAmount as number)}
                      </span>
                    )}
                    <Link
                      to={`/reimbursements/${claim.id}`}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-kiran hover:underline"
                    >
                      Open in full <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2 px-5 py-3">
                  <input
                    value={notes[claim.id] ?? ''}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [claim.id]: event.target.value }))
                    }
                    placeholder="Note for the record (optional)"
                    className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] placeholder:text-muted focus:border-kiran focus:outline-none"
                  />
                  <button
                    onClick={() => act(claim, true)}
                    disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-accent active:translate-y-px px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-xs transition-colors hover:brightness-95 disabled:opacity-50"
                  >
                    {busy === `${claim.id}-a` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => act(claim, false)}
                    disabled={Boolean(busy)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-strand-red transition-colors hover:bg-strand-red/5 disabled:opacity-50"
                  >
                    {busy === `${claim.id}-r` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
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
