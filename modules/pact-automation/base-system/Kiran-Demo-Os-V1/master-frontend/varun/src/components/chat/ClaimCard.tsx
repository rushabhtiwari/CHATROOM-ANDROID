/**
 * A reimbursement claim, rendered inside the conversation that filed it.
 *
 * The card holds only the claim's id. Everything it shows is read live from
 * the finance store, which is fed by the server's event stream — so when HR
 * approves a claim from the Reimbursements screen, the card in this thread
 * changes at the same moment, on every open window. A card that showed a
 * snapshot of the claim as filed would be a screenshot, and would start lying
 * within a minute.
 *
 * The reviewer's actions are here too, because the alternative is telling
 * someone who has just been shown a receipt to go and find it somewhere else.
 * The server enforces the same rules the buttons imply; the UI hides what a
 * team may not do, and the API refuses it regardless.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  FileText,
  Loader2,
  Paperclip,
  ReceiptText,
  Sparkles,
  X,
} from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { formatCurrency, formatDate } from '@/modules/rts/format';
import {
  CATEGORY_LABEL,
  actionOwner,
  statusLabel,
  statusTone,
  type StatusTone,
} from '@/modules/rts/status';
import { employeeForName, reviewRoleFor } from '@/modules/rts/identity';
import type { RequestStatus, Role } from '@/modules/rts/types';
import { cn } from '@/lib/utils';

/** The console's four strands, mapped onto the claim's five status tones. */
const TONE: Record<StatusTone, { pill: string; rail: string }> = {
  grey: { pill: 'bg-slate-100 text-slate-700 border-slate-200', rail: 'bg-slate-300' },
  blue: { pill: 'bg-kiran-tint text-kiran border-kiran/20', rail: 'bg-kiran' },
  amber: { pill: 'bg-amber-50 text-amber-800 border-amber-200', rail: 'bg-strand-amber' },
  red: { pill: 'bg-red-50 text-red-800 border-red-200', rail: 'bg-strand-red' },
  green: { pill: 'bg-emerald-50 text-emerald-800 border-emerald-200', rail: 'bg-strand-green' },
};

const STAGES: Array<{ role: Role; label: string }> = [
  { role: 'HR', label: 'HR' },
  { role: 'ACCOUNTS', label: 'Accounts' },
  { role: 'PAYMENTS', label: 'Payment' },
];

/** How far along the chain a status sits, for the three-step rail. */
function reached(status: RequestStatus): number {
  if (status === 'CREDITED' || status === 'PAID' || status === 'PAYMENT_QUEUED') return 3;
  if (status === 'ACC_APPROVED') return 3;
  if (status === 'HR_APPROVED' || status.startsWith('ACC_')) return 2;
  if (status === 'SUBMITTED' || status.startsWith('HR_')) return 1;
  return 0;
}

export interface ClaimCardProps {
  claimId: string;
  /** True when the current chat user is the message's author. */
  mine: boolean;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({ claimId, mine }) => {
  const { currentUser } = useChat();
  const { requests, employees, employeeById, updateRequestStatus } = useRts();
  const [busy, setBusy] = useState<string | null>(null);

  const claim = useMemo(
    () => requests.find((request) => request.id === claimId),
    [requests, claimId],
  );

  if (!claim) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed px-3 py-2.5 text-[12px]',
          mine ? 'border-white/30 text-white/70' : 'border-line text-muted',
        )}
      >
        This claim is no longer available.
      </div>
    );
  }

  const employee = employeeById(claim.employeeId);
  const tone = TONE[statusTone(claim.status)];
  const owner = actionOwner(claim.status);
  const step = reached(claim.status);

  /*
   * Whose turn it is, and whether that is the person looking.
   *
   * Showing Approve to an employee on their own claim would be a lie the
   * server would then refuse, so the card offers the decision only to the
   * team that actually holds it. Everyone else sees where the claim has got
   * to, which is what they came for.
   */
  const viewerRole = reviewRoleFor(employeeForName(employees, currentUser.name));
  const viewerCanAct = owner !== null && owner === viewerRole;

  const act = async (status: RequestStatus, actorRole: Role, label: string) => {
    setBusy(label);
    await updateRequestStatus(
      claim.id,
      status,
      currentUser.name,
      actorRole,
      `${label} from the conversation`,
    );
    setBusy(null);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-card">
      {/* Header */}
      <div className="flex items-start gap-2.5 border-b border-line px-3 py-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-strand-green/10 text-strand-green">
          <ReceiptText className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-snug">{claim.title}</p>
          <p className="mt-0.5 font-mono text-[12px] text-muted">
            {claim.id} · {CATEGORY_LABEL[claim.category]} · {formatDate(claim.submittedOn)}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-[15px] font-semibold leading-none tracking-tight">
            {formatCurrency(claim.amount)}
          </span>
        </span>
      </div>

      {/* Status */}
      <div className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5 text-[12px] font-semibold',
              tone.pill,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', tone.rail)} />
            {statusLabel(claim.status)}
          </span>
          {employee && (
            <span className="text-[12px] text-muted">
              {employee.name} · {employee.department}
            </span>
          )}
        </div>

        {/* Three-step chain. A claim's whole life is HR, then Accounts, then the bank. */}
        <div className="mt-2.5 flex items-center gap-1">
          {STAGES.map((stage, index) => {
            const done = step > index + 0;
            const active = owner === stage.role;
            return (
              <React.Fragment key={stage.role}>
                <span
                  className={cn(
                    'flex-1 rounded-full',
                    done ? 'h-1 bg-strand-green' : active ? 'h-1 bg-strand-amber' : 'h-1 bg-line',
                  )}
                />
              </React.Fragment>
            );
          })}
        </div>
        <div className="mt-1 flex items-center justify-between">
          {STAGES.map((stage) => (
            <span
              key={stage.role}
              className={cn(
                'text-[12px] font-medium ',
                owner === stage.role ? 'text-strand-amber' : 'text-muted',
              )}
            >
              {stage.label}
            </span>
          ))}
        </div>

        {claim.receipts.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {claim.receipts.slice(0, 3).map((receipt) => (
              <a
                key={receipt.id}
                href={receipt.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-[160px] items-center gap-1 rounded-badge border border-line bg-surface-2 px-1.5 py-0.5 text-[12px] text-slate-700 transition-colors hover:bg-line-2"
              >
                <Paperclip className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{receipt.fileName}</span>
              </a>
            ))}
            {claim.receipts.length > 3 && (
              <span className="px-1 text-[12px] text-muted">
                +{claim.receipts.length - 3}
              </span>
            )}
          </div>
        )}

        {claim.extraction && (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-ai">
            <Sparkles className="mt-px h-2.5 w-2.5 shrink-0" />
            Read from the receipt and confirmed by {employee?.name.split(' ')[0] ?? 'the employee'}.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 border-t border-line bg-surface-2 px-3 py-2">
        {viewerCanAct && owner === 'HR' && (
          <>
            <ActionButton
              tone="approve"
              busy={busy === 'HR approved'}
              disabled={Boolean(busy)}
              onClick={() => act('HR_APPROVED', 'HR', 'HR approved')}
            >
              Approve
            </ActionButton>
            <ActionButton
              tone="reject"
              busy={busy === 'HR rejected'}
              disabled={Boolean(busy)}
              onClick={() => act('HR_REJECTED', 'HR', 'HR rejected')}
            >
              Reject
            </ActionButton>
          </>
        )}

        {viewerCanAct && owner === 'ACCOUNTS' && (
          <>
            <ActionButton
              tone="approve"
              busy={busy === 'Accounts approved'}
              disabled={Boolean(busy)}
              onClick={() => act('ACC_APPROVED', 'ACCOUNTS', 'Accounts approved')}
            >
              Approve
            </ActionButton>
            <ActionButton
              tone="reject"
              busy={busy === 'Accounts rejected'}
              disabled={Boolean(busy)}
              onClick={() => act('ACC_REJECTED', 'ACCOUNTS', 'Accounts rejected')}
            >
              Reject
            </ActionButton>
          </>
        )}

        {!viewerCanAct && (
          <span className="text-[12px] text-muted">
            {owner === null
              ? claim.status === 'CREDITED' || claim.status === 'PAID'
                ? 'Settled.'
                : 'No action pending.'
              : owner === 'EMPLOYEE'
                ? `Waiting on ${employee?.name.split(' ')[0] ?? 'the employee'}.`
                : `With ${owner === 'HR' ? 'HR' : owner === 'ACCOUNTS' ? 'Accounts' : 'Payments'}.`}
          </span>
        )}

        <Link
          to={`/reimbursements/${claim.id}`}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-kiran transition-colors hover:bg-kiran-tint"
        >
          Open claim <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
};

const ActionButton: React.FC<{
  tone: 'approve' | 'reject';
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ tone, busy, disabled, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-50',
      tone === 'approve'
        ? 'bg-strand-green text-white hover:bg-emerald-700'
        : 'border border-line bg-surface text-strand-red hover:bg-strand-red/5',
    )}
  >
    {busy ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : tone === 'approve' ? (
      <Check className="h-3 w-3" />
    ) : (
      <X className="h-3 w-3" />
    )}
    {children}
  </button>
);

export default ClaimCard;
