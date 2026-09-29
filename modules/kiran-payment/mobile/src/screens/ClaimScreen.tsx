import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, FileText } from 'lucide-react';
import { useRts } from '@/modules/rts/store';
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from '@/modules/rts/format';
import { CATEGORY_LABEL, ROLE_LABEL, actionOwner } from '@/modules/rts/status';
import { ClaimStatusPill } from '@/pages/reimbursements/ClaimStatusPill';
import { Empty, Screen, Section } from '~/components/Screen';

/**
 * One reimbursement claim: where a claim card's "Open claim" goes.
 *
 * The card in the chat is the console's own, and it links to the console's
 * claim page at `/reimbursements/:id`. The phone had no such route, so the
 * link fell through to the chat list and took the reader out of the
 * conversation. This is that page cut to a phone: what was claimed, what the
 * receipt said, the receipts and the history. Approving and rejecting stay on
 * the card, in the chat, where the reviewer already is.
 */
export function ClaimScreen() {
  const { claimId = '' } = useParams<{ claimId: string }>();
  const { requests, loading } = useRts();
  const claim = requests.find((request) => request.id === claimId);

  if (!claim) {
    return (
      <Screen back title="Claim">
        {loading ? (
          <Empty title="Loading the claim…" />
        ) : (
          <Empty title="Claim not found" detail="It may have been withdrawn." />
        )}
      </Screen>
    );
  }

  const owner = actionOwner(claim.status);
  const reading = claim.extraction;
  const amountEdited =
    typeof claim.extractedAmount === 'number' && claim.extractedAmount !== claim.amount;

  return (
    <Screen back title={claim.title} subtitle={claim.id}>
      <div className="border-b border-line bg-surface px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <ClaimStatusPill status={claim.status} />
          <span className="text-[22px] font-semibold tabular-nums text-ink">
            {formatCurrency(claim.amount)}
          </span>
        </div>
        <p className="mt-2 text-[13px] text-slate-500">
          {owner ? `With ${ROLE_LABEL[owner]}` : 'Review complete'}
        </p>
      </div>

      <Section title="Claim">
        <Field label="Category">{CATEGORY_LABEL[claim.category]}</Field>
        <Field label="Filed">{formatDate(claim.submittedOn)}</Field>
        {claim.travelDates && (
          <Field label="Travel">
            {formatDate(claim.travelDates.from)} – {formatDate(claim.travelDates.to)}
          </Field>
        )}
        <Field label="Reason">{claim.justification || '—'}</Field>
      </Section>

      {reading && (
        <Section title="Receipt check">
          <Field label="On receipt">
            {typeof claim.extractedAmount === 'number'
              ? formatCurrency(claim.extractedAmount)
              : '—'}
          </Field>
          <Field label="Claimed">
            {formatCurrency(claim.amount)}
            {amountEdited && (
              <span className="ml-2 rounded bg-strand-amber/10 px-1.5 py-0.5 text-[12px] font-medium text-strand-amber">
                Amount edited
              </span>
            )}
          </Field>
          {reading.policyFindings?.map((finding, index) => (
            <p key={index} className="bg-strand-amber/10 px-4 py-2.5 text-[13px] text-strand-amber">
              {finding.message}
            </p>
          ))}
        </Section>
      )}

      <Section title={`Receipts (${claim.receipts.length})`}>
        {claim.receipts.length === 0 ? (
          <p className="px-4 py-3 text-[14px] text-slate-500">No receipts attached.</p>
        ) : (
          claim.receipts.map((receipt) => (
            // A server path: the app turns it into the server's address when
            // tapped (see installServerOrigin), and it opens outside the app.
            <a
              key={receipt.id}
              href={receipt.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-touch items-center gap-3 px-4 py-2.5 active:bg-slate-50"
            >
              <FileText className="h-5 w-5 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">
                  {receipt.fileName}
                </span>
                <span className="block text-[12px] text-slate-500">
                  {formatFileSize(receipt.sizeKb)} · {formatDate(receipt.uploadedOn)}
                </span>
              </span>
              {receipt.url && <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />}
            </a>
          ))
        )}
      </Section>

      <Section title="History">
        {claim.timeline.map((event) => (
          <div key={event.id} className="px-4 py-2.5">
            <p className="text-[14px] font-medium text-ink">
              {event.action}
              <span className="font-normal text-slate-500">
                {' '}
                · {event.actor} ({ROLE_LABEL[event.role]})
              </span>
            </p>
            {event.comment && <p className="mt-0.5 text-[14px] text-slate-700">{event.comment}</p>}
            <p className="mt-0.5 text-[12px] text-slate-500">{formatDateTime(event.at)}</p>
          </div>
        ))}
      </Section>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-touch items-center justify-between gap-4 px-4 py-2.5">
      <span className="shrink-0 text-[14px] text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-[14px] text-ink">{children}</span>
    </div>
  );
}
