import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Inbox, Search } from 'lucide-react';
import { mailingApi } from '../../modules/mailing/api';
import type { HoldReason, JobRow } from '../../modules/mailing/types';
import { useAsync, useMailingVersion } from '../../modules/mailing/useMailing';
import { OnHoldResolver } from '../../components/mailing/OnHoldResolver';
import { TONE, Tone } from '../../lib/tone';

/**
 * "The On Hold Part" (WORKING.md §3.3).
 *
 * The triage matrix on the left, the resolver on the right. Items are grouped
 * by the three hold reasons the state machine derives — intake filter,
 * extraction exception, and the ADR-0005 approval gate — so an operator can
 * work one category at a time rather than a mixed pile.
 */
export const OnHoldQueue: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const version = useMailingVersion();

  const [reason, setReason] = useState<HoldReason | ''>('');
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

  const load = useCallback(
    () => mailingApi.onHold({ reason: reason || undefined, q: q || undefined }),
    [reason, q],
  );
  const { data, loading, error } = useAsync(load, [reason, q, version]);

  const items = data?.items ?? [];
  const selected = items.find((item) => item.id === jobId) ?? items[0] ?? null;

  // Keep the URL pointing at something that still exists: resolving an item
  // removes it from the queue, and the resolver must move on rather than sit on
  // a job that is no longer held.
  useEffect(() => {
    if (!selected) return;
    if (jobId !== selected.id) navigate(`/admin/mailing/on-hold/${selected.id}`, { replace: true });
  }, [selected, jobId, navigate]);

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role="status"
          className={`border border-l-3 border-hairline px-4 py-2.5 text-body-s ${
            notice.tone === 'green'
              ? 'border-l-st-green-ink bg-st-green-bg text-st-green-ink'
              : 'border-l-st-red-ink bg-st-red-bg text-st-red-ink'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* ---- Triage matrix ------------------------------------------ */}
        <section className="ku-sheet flex min-h-0 flex-col">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <p className="ku-eyebrow">Quarantine</p>
              <h2 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-ink">
                Waiting on a human
              </h2>
            </div>
            <dl>
              <dt className="ku-eyebrow">Held</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-ink">{data?.total ?? 0}</dd>
            </dl>
          </div>

          {/* Group filters. Counts come from the server and always describe the
              whole queue, not the filtered view. */}
          <div className="flex flex-wrap gap-2 border-b border-hairline px-5 py-3">
            <FilterChip active={reason === ''} onClick={() => setReason('')} label="All" count={data?.total ?? 0} />
            {(data?.groups ?? []).map((group) => (
              <FilterChip
                key={group.reason}
                active={reason === group.reason}
                onClick={() => setReason(group.reason)}
                label={group.label}
                count={group.count}
              />
            ))}
          </div>

          <div className="border-b border-hairline px-5 py-3">
            <div className="relative">
              <Search aria-hidden className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-hairline-strong" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search subject, sender, job id…"
                aria-label="Search the queue"
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white py-2 pl-8 pr-3 text-body-s text-ink transition-colors duration-150 placeholder:text-meta hover:border-b-ink focus:border-b-ink"
              />
            </div>
          </div>

          <div className="ku-scrollbar min-h-0 flex-1 overflow-y-auto">
            {error && <p className="px-5 py-4 text-body-s text-st-red-ink">{error}</p>}

            {!error && items.length === 0 && !loading && (
              <div className="flex flex-col items-start px-6 py-14 text-left">
                <span aria-hidden className="block h-0.5 w-7 origin-left animate-rule-in bg-accent" />
                <div className="mt-3.5 flex items-center gap-2">
                  <Inbox aria-hidden size={13} className="shrink-0 text-hairline-strong" />
                  <span className="ku-eyebrow">Queue clear</span>
                </div>
                <p className="ku-wide mt-2 font-display text-h3 font-semibold text-ink">
                  Nothing is waiting on you
                </p>
                <p className="mt-2 max-w-[54ch] text-body-s leading-relaxed text-meta">
                  Every message the intake has seen was either committed automatically or already
                  triaged.
                </p>
              </div>
            )}

            <ul className="ku-ruled">
              {items.map((job) => (
                <HoldLine
                  key={job.id}
                  job={job}
                  selected={selected?.id === job.id}
                  onSelect={() => navigate(`/admin/mailing/on-hold/${job.id}`)}
                />
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Resolver ----------------------------------------------- */}
        <section className="ku-card min-h-[560px]">
          {selected ? (
            <OnHoldResolver
              job={selected}
              onResolved={(text) => setNotice({ tone: 'green', text })}
              onError={(text) => setNotice({ tone: 'red', text })}
            />
          ) : (
            <div className="flex flex-col items-start px-6 py-14 text-left">
              <span aria-hidden className="block h-0.5 w-7 origin-left animate-rule-in bg-accent" />
              <p className="ku-eyebrow mt-3.5">Resolver</p>
              <p className="ku-wide mt-2 font-display text-h3 font-semibold text-ink">
                Nothing to resolve
              </p>
              <p className="mt-2 max-w-[54ch] text-body-s leading-relaxed text-meta">
                Pick an item from the queue to compare the extraction against its evidence.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}> = ({ active, onClick, label, count }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex shrink-0 items-center gap-2 border-2 px-2.5 py-1 text-caption font-semibold leading-none transition-all duration-150 active:translate-y-px ${
      active
        ? 'border-ink bg-accent text-accent-ink'
        : 'border-hairline-strong bg-white text-ink hover:border-ink hover:bg-canvas'
    }`}
  >
    {label}
    <span className={`ku-fig px-1 ${active ? 'bg-ink/10' : 'bg-canvas text-meta'}`}>{count}</span>
  </button>
);

const HoldLine: React.FC<{ job: JobRow; selected: boolean; onSelect: () => void }> = ({
  job,
  selected,
  onSelect,
}) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`flex w-full items-stretch border-l-3 text-left transition-colors duration-150 ${
        selected
          ? 'border-l-accent bg-canvas'
          : 'border-l-transparent bg-white hover:border-l-accent hover:bg-canvas'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="ku-docket">{job.id}</span>
          <span className="min-w-0 flex-1 truncate text-body-s font-semibold text-ink">
            {job.subject}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-meta">
          <span className="ku-fig truncate">{job.fromAddress}</span>
          <span className="ku-fig">{new Date(job.receivedAt).toLocaleDateString()}</span>
          {job.retryCount > 0 && <span className="ku-fig">retried {job.retryCount}×</span>}
        </div>
        {job.causeLabel && <p className="text-caption text-st-red-ink">{job.causeLabel}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 px-4 py-3">
        <span className={`ku-stamp ${TONE[job.tone as Tone].stamp}`}>{job.statusLabel}</span>
        {job.confidence !== null && job.confidence > 0 && (
          <span className="ku-fig text-caption text-meta">
            {(job.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </button>
  </li>
);
