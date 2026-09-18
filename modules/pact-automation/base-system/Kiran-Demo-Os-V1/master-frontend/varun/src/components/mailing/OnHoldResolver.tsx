import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, RotateCcw, ShieldPlus, Trash2 } from 'lucide-react';
import { mailingApi } from '../../modules/mailing/api';
import type { ExtractedField, JobRow, TriageAction } from '../../modules/mailing/types';
import { TONE, Tone } from '../../lib/tone';

interface Props {
  job: JobRow;
  onResolved: (message: string) => void;
  onError: (message: string) => void;
}

const ACTOR = 'k.s.rao';

const FIELD_LABELS: Record<string, string> = {
  poNumber: 'PO number',
  customer: 'Customer',
  product: 'Product',
  quantityMetres: 'Quantity (m)',
  orderValue: 'Order value',
  deliveryDate: 'Delivery date',
};

/**
 * The triage resolver (WORKING.md §3.3).
 *
 * Side-by-side: what the pipeline extracted, the evidence it read it from, and
 * an input the operator can correct it in. The four actions are the spec's, and
 * each is shown only when the server says it applies — `availableActions` comes
 * from the state machine, so a button that cannot work is never rendered.
 */
export const OnHoldResolver: React.FC<Props> = ({ job, onResolved, onError }) => {
  const fields = useMemo(() => job.extraction?.fields ?? {}, [job]);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState<TriageAction | null>(null);

  // A new job clears the desk: edits typed against one message must never be
  // carried into the next one.
  useEffect(() => {
    setEdits({});
    setNote('');
    setCompany(job.domain ? job.domain.split('.')[0].replace(/^\w/, (c) => c.toUpperCase()) : '');
  }, [job.id, job.domain]);

  const corrected = useMemo(() => {
    const payload: Record<string, unknown> = {};
    Object.entries(edits).forEach(([name, raw]) => {
      const original = fields[name]?.value;
      if (raw === '' || String(original ?? '') === raw) return;
      // Keep numbers numeric so the approval gate and the ledger agree on type.
      payload[name] = typeof original === 'number' && raw.trim() !== '' && !Number.isNaN(Number(raw))
        ? Number(raw)
        : raw;
    });
    return payload;
  }, [edits, fields]);

  const editedCount = Object.keys(corrected).length;

  const act = async (action: TriageAction) => {
    setBusy(action);
    try {
      if (action === 'WHITELIST') {
        const result = await mailingApi.whitelist({
          domain: job.domain,
          companyName: company || job.domain,
          actor: ACTOR,
        });
        onResolved(
          `Whitelisted ${job.domain} — ${result.reprocessedCount ?? 0} message(s) returned to the pipeline.`,
        );
        return;
      }

      const result = await mailingApi.resolve(job.id, action, {
        actor: ACTOR,
        correctedData: action === 'COMMIT_EDITED' && editedCount ? corrected : undefined,
        reason: note || undefined,
      });

      onResolved(
        action === 'COMMIT_EDITED'
          ? `Approved${editedCount ? ` with ${editedCount} correction(s)` : ''}. The customer has been acknowledged and Sales, Accounts and Manufacturing tasked — now with Accounts.`
          : action === 'ACCOUNTS_APPROVE'
            ? result.documentNo
              ? `Released to PACT — draft ${result.documentNo} saved, proforma and dispatch notice sent.`
              : `Released to PACT — now ${result.status}. ${result.steps?.find((s) => s.status !== 'done')?.detail ?? ''}`
            : action === 'REJECT'
              ? 'Message discarded. The record stays on the ledger with your note.'
              : `Re-extracted — now ${result.status}.`,
      );
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'The triage action failed.');
    } finally {
      setBusy(null);
    }
  };

  const can = (action: TriageAction) => job.availableActions.includes(action);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- Head ---------------------------------------------------- */}
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="ku-docket">{job.id}</p>
            <h3 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-ink">
              {job.subject}
            </h3>
            <p className="ku-fig mt-1 text-caption text-meta">{job.fromAddress}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`ku-stamp ${TONE[job.tone as Tone].stamp}`}>{job.statusLabel}</span>
            <span className="ku-stamp border-meta border-l-3 border-l-accent text-ink">
              {job.holdReasonLabel}
            </span>
          </div>
        </div>

        {job.causeLabel && (
          <div className="mt-3 flex items-start gap-2.5 border border-l-3 border-hairline border-l-st-amber-ink bg-st-amber-bg px-3 py-2.5">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-st-amber-ink" />
            <p className="min-w-0 flex-1 text-body-s text-st-amber-ink">
              {job.causeLabel}
              {job.confidence !== null && (
                <>
                  {' '}
                  — extraction confidence <span className="ku-fig">{(job.confidence * 100).toFixed(0)}%</span>
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ---- Field-by-field comparison -------------------------------- */}
      <div className="ku-scrollbar min-h-0 flex-1 overflow-y-auto">
        {Object.keys(fields).length === 0 ? (
          <div className="px-5 py-6">
            <p className="ku-eyebrow">No extraction</p>
            <p className="mt-2 max-w-[60ch] text-body-s leading-relaxed text-meta">
              This message was filtered at intake, so nothing was extracted from it. Whitelist the
              sender to put it through the pipeline, or discard it.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-body-s">
            <thead>
              <tr>
                {['Field', 'Extracted', 'Evidence', 'Correction'].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="ku-narrow sticky top-0 z-10 bg-white px-4 py-2.5 text-left align-bottom text-micro font-semibold uppercase text-meta after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-structure after:content-['']"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(fields).map(([name, field]) => (
                <FieldRow
                  key={name}
                  name={name}
                  field={field}
                  suspect={job.suspectFields.includes(name)}
                  value={edits[name] ?? String(field.value ?? '')}
                  onChange={(next) => setEdits((prev) => ({ ...prev, [name]: next }))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- Action bar ----------------------------------------------- */}
      <div className="space-y-3 border-t border-hairline bg-canvas px-5 py-4">
        <label className="block">
          <span className="ku-eyebrow text-ink">
            Decision note {can('REJECT') && <span className="text-st-red-ink">— required to discard</span>}
          </span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why are you taking this decision?"
            className="mt-1.5 w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 placeholder:text-meta hover:border-b-ink focus:border-b-ink"
          />
        </label>

        {can('WHITELIST') && (
          <label className="block">
            <span className="ku-eyebrow text-ink">Company for {job.domain}</span>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="mt-1.5 w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 hover:border-b-ink focus:border-b-ink"
            />
          </label>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-meta">
            {editedCount > 0 ? (
              <>
                <span className="ku-fig font-semibold text-ink">{editedCount}</span> field(s) edited —
                committing records you as the source.
              </>
            ) : (
              'Committing without edits accepts the extraction as it stands.'
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {can('REJECT') && (
              <button
                type="button"
                onClick={() => act('REJECT')}
                disabled={busy !== null}
                title="Discard this message"
                className="inline-flex h-10 items-center gap-2 border-2 border-danger bg-transparent px-4 text-body-s font-semibold leading-none text-danger transition-all duration-150 hover:bg-st-red-bg active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                Discard
              </button>
            )}

            {can('RETRY_EXTRACTION') && (
              <button
                type="button"
                onClick={() => act('RETRY_EXTRACTION')}
                disabled={busy !== null}
                title="Re-queue this document for extraction"
                className="inline-flex h-10 items-center gap-2 border-2 border-hairline-strong bg-white px-4 text-body-s font-semibold leading-none text-ink transition-all duration-150 hover:border-ink hover:bg-canvas active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw aria-hidden className="h-4 w-4" />
                Re-extract
              </button>
            )}

            {can('WHITELIST') && (
              <button
                type="button"
                onClick={() => act('WHITELIST')}
                disabled={busy !== null}
                title="Whitelist this sender domain and re-ingest"
                className="inline-flex h-10 items-center gap-2 border-2 border-structure bg-structure px-4 text-body-s font-semibold leading-none text-white transition-all duration-150 hover:bg-structure-600 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldPlus aria-hidden className="h-4 w-4" />
                Whitelist domain
              </button>
            )}

            {can('COMMIT_EDITED') && (
              <button
                type="button"
                onClick={() => act('COMMIT_EDITED')}
                disabled={busy !== null}
                title="Gate 1 — acknowledge the customer and task Sales, Accounts and Manufacturing"
                className="inline-flex h-10 items-center gap-2 border-2 border-ink bg-accent px-5 text-body-s font-semibold leading-none text-accent-ink transition-all duration-150 hover:brightness-95 active:translate-y-px active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check aria-hidden className="h-4 w-4" />
                {busy === 'COMMIT_EDITED' ? 'Approving…' : 'Approve as admin'}
              </button>
            )}

            {/* Gate 2. The server offers this only on a job already through gate 1, so the
                button appears exactly when it can be pressed - and it is the same call the
                Order Automation screen makes. It drives the real PACT window, so it is slow
                and the label says so rather than looking hung. */}
            {can('ACCOUNTS_APPROVE') && (
              <button
                type="button"
                onClick={() => act('ACCOUNTS_APPROVE')}
                disabled={busy !== null}
                title="Gate 2 — save one PACT Purchase Order draft with every line item, then close the order out"
                className="inline-flex h-10 items-center gap-2 border-2 border-ink bg-accent px-5 text-body-s font-semibold leading-none text-accent-ink transition-all duration-150 hover:brightness-95 active:translate-y-px active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check aria-hidden className="h-4 w-4" />
                {busy === 'ACCOUNTS_APPROVE'
                  ? 'Filling PACT — this takes a minute…'
                  : 'Release to PACT as Accounts'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FieldRow: React.FC<{
  name: string;
  field: ExtractedField;
  suspect: boolean;
  value: string;
  onChange: (next: string) => void;
}> = ({ name, field, suspect, value, onChange }) => {
  const dirty = value !== String(field.value ?? '');

  return (
    <tr className="border-b border-hairline border-l-3 border-l-transparent bg-white transition-colors duration-150 last:border-b-0 hover:border-l-accent hover:bg-canvas">
      <td className="px-4 py-3 align-top">
        <span className="font-semibold text-ink">{FIELD_LABELS[name] ?? name}</span>
        {field.source === 'HUMAN' && (
          <span className="ku-stamp mt-1.5 block w-fit border-st-blue-ink text-st-blue-ink">
            edited
          </span>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <span className="ku-fig text-ink">{String(field.value ?? '—')}</span>
        {field.supersededValue !== undefined && (
          <span className="ku-fig mt-1 block text-caption text-meta line-through">
            {String(field.supersededValue ?? '')}
          </span>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        {/* Provenance, verbatim: page, the snippet it was read from, and the
            confidence. A field with no snippet is pinned to 0 by the server,
            and that is exactly the case a reviewer should look at first. */}
        {field.snippet ? (
          <>
            <p className="max-w-[36ch] break-words text-caption italic leading-5 text-meta">
              “{field.snippet}”
            </p>
            <span className="ku-fig mt-1 block text-caption text-meta">
              p{field.page} · {(field.confidence * 100).toFixed(0)}%
            </span>
          </>
        ) : (
          <span className={`ku-stamp ${suspect ? TONE.red.stamp : TONE.grey.stamp}`}>
            no evidence
          </span>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`Correct ${FIELD_LABELS[name] ?? name}`}
          className={`w-full min-w-0 border border-b-2 bg-white px-2.5 py-1.5 text-body-s text-ink transition-colors duration-150 ${
            dirty
              ? 'border-accent border-b-ink'
              : 'border-hairline-strong border-b-meta hover:border-b-ink focus:border-b-ink'
          }`}
        />
      </td>
    </tr>
  );
};
