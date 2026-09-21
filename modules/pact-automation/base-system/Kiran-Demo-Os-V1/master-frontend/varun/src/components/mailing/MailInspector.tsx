import React from 'react';
import { FileText, Paperclip, ShieldCheck, ShieldX } from 'lucide-react';
import type { MailDetail } from '../../modules/mailing/types';
import { TONE, sentenceCase, Tone } from '../../lib/tone';
import { PipelinePanel } from './PipelinePanel';

/**
 * The split message inspector (WORKING.md §3.2).
 *
 * Header panel, body viewer, attachment tray and lifecycle timeline. The
 * timeline is the part that earns its place: it is the job's real route through
 * the state machine, written by the server on every transition, so "why is this
 * on hold" is answerable without opening a log.
 */
export const MailInspector: React.FC<{ detail: MailDetail; onOpenJob?: (jobId: string) => void }> = ({
  detail,
  onOpenJob,
}) => {
  const { email, job, order } = detail;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- Head ----------------------------------------------------- */}
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-h3 font-semibold text-ink">{email.subject}</h3>
            <p className="ku-docket mt-0.5">{email.id}</p>
          </div>
          <span className={`ku-stamp ${TONE[email.tone as Tone].stamp}`}>{sentenceCase(email.statusLabel)}</span>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row label="From" value={email.fromAddress} mono />
          <Row label="To" value={email.toAddress} mono />
          <Row label="Date" value={new Date(email.receivedAt).toLocaleString()} mono />
        </dl>

        {/* Authentication results. A directly injected message never crossed
            the internet, so it is labelled "n/a" rather than shown a pass it
            did not earn. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['spf', 'dkim', 'dmarc'] as const).map((key) => {
            const value = email.headers?.[key] ?? 'none';
            const passed = value === 'pass';
            const notApplicable = value.startsWith('n/a');
            return (
              <span
                key={key}
                className={`ku-stamp ${
                  notApplicable
                    ? TONE.grey.stamp
                    : passed
                      ? TONE.green.stamp
                      : TONE.red.stamp
                }`}
                title={`${key.toUpperCase()}: ${value}`}
              >
                {key.toUpperCase()} {value}
              </span>
            );
          })}
        </div>
      </div>

      {/* ---- Body ----------------------------------------------------- */}
      <div className="ku-scrollbar min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-hairline px-5 py-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-body-s leading-6 text-ink">
            {email.bodyText || '(no body)'}
          </pre>
        </section>

        {/* ---- Attachment tray --------------------------------------- */}
        <section className="border-b border-hairline px-5 py-4">
          <p className="ku-eyebrow">Attachments</p>
          {email.attachments.length === 0 ? (
            <p className="mt-1 text-body-s text-meta">None</p>
          ) : (
            <ul className="ku-ruled mt-2 overflow-hidden rounded-md border border-hairline">
              {email.attachments.map((attachment) => (
                <li key={attachment.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                  <FileText aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                  <span className="min-w-0 flex-1 truncate text-body-s font-medium text-ink">
                    {attachment.filename}
                  </span>
                  <span className="tnum text-caption text-meta" title={`sha256 ${attachment.sha256}`}>
                    {attachment.mimeType.split('/').pop()?.toUpperCase()} · {attachment.pages}p ·{' '}
                    {(attachment.sizeBytes / 1024).toFixed(0)} KB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Lifecycle timeline ------------------------------------ */}
        {job && (
          <section className="border-b border-hairline px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="ku-eyebrow">History</p>
              {job.holdReason && onOpenJob && (
                <button
                  type="button"
                  onClick={() => onOpenJob(job.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline-strong bg-white px-3 text-body-s font-medium leading-none text-ink transition-colors duration-150 hover:bg-canvas"
                >
                  Review
                </button>
              )}
            </div>

            {/* Ruled like a ledger: a mono timestamp in a right-ranged rail, a
                hairline spine, one actor and one action per entry. */}
            <ol className="mt-2">
              {job.timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex flex-wrap gap-x-4 gap-y-1 py-2">
                  <span className="tnum w-20 shrink-0 text-caption leading-[21px] text-meta">
                    {new Date(entry.at).toLocaleTimeString()}
                  </span>
                  <span
                    aria-hidden
                    className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                      index === job.timeline.length - 1 ? 'bg-accent' : 'bg-slate-300'
                    }`}
                  />
                  <span className="min-w-0 flex-1 basis-40 text-body-s text-ink">
                    {entry.action}
                    {entry.note && <span className="text-meta"> — {entry.note}</span>}
                    <span className="ml-2 text-caption text-meta">{entry.actor}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ---- The purchase-order pipeline --------------------------- */}
        {/* Only for a job that actually reached it. A message filtered at intake or
            still extracting has no receipt, no customer gate and no PACT draft, and
            drawing five empty stages for it would imply otherwise. */}
        {job && !['RECEIVED', 'CLASSIFIED', 'EXTRACTING', 'NOT_AN_ORDER'].includes(job.status) && (
          <PipelinePanel jobId={job.id} />
        )}

        {/* ---- Linked canonical order -------------------------------- */}
        {order && (
          <section className="px-5 py-4">
            <p className="ku-eyebrow">Order</p>
            <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              <Row label="Order" value={String(order.id)} mono />
              <Row label="PO number" value={String(order.poNumber ?? '—')} mono />
              <Row label="Customer" value={String(order.customer ?? '—')} />
              <Row
                label="Value"
                value={`Rs ${Number(order.orderValue ?? 0).toLocaleString('en-IN')}`}
                mono
              />
            </dl>

            <p className="ku-eyebrow mt-4">Versions</p>
            <ul className="ku-ruled mt-2 overflow-hidden rounded-md border border-hairline">
              {order.versions.map((version) => (
                <li key={version.id} className="flex flex-wrap items-baseline gap-x-4 px-3 py-2">
                  <span className="ku-fig text-body-s font-semibold text-ink">
                    v{version.versionNo}
                  </span>
                  <span className="text-body-s text-ink">{version.reason}</span>
                  <span className="text-caption text-meta">{version.actor}</span>
                  <span className="ku-fig ml-auto text-caption text-meta">
                    {new Date(version.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value?: string | null; mono?: boolean; truncate?: boolean }> = ({
  label,
  value,
  mono,
  truncate,
}) => (
  <div className="min-w-0">
    <dt className="text-caption text-meta">{label}</dt>
    <dd
      className={`mt-0.5 text-body-s text-ink ${mono ? 'ku-fig' : ''} ${truncate ? 'truncate' : 'break-words'}`}
      title={value ?? undefined}
    >
      {value || '—'}
    </dd>
  </div>
);

export const AttachmentBadge: React.FC<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <span className="inline-flex items-center gap-1 text-caption text-meta">
      <Paperclip aria-hidden className="h-3 w-3" />
      <span className="ku-fig">{count}</span>
    </span>
  ) : null;
