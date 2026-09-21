import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Inbox, Search } from 'lucide-react';
import { mailingApi } from '../../modules/mailing/api';
import type { HoldReason, JobRow } from '../../modules/mailing/types';
import { useAsync, useMailingVersion } from '../../modules/mailing/useMailing';
import { OnHoldResolver } from '../../components/mailing/OnHoldResolver';
import { TONE, sentenceCase, Tone } from '../../lib/tone';

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
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          className={`rounded-md px-4 py-2.5 text-body-s ${
            notice.tone === 'green'
              ? 'bg-st-green-bg text-st-green-ink'
              : 'bg-st-red-bg text-st-red-ink'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* ---- Triage matrix ------------------------------------------ */}
        <section className="ku-sheet flex min-h-0 flex-col">
          {/* Group filters. Counts come from the server and always describe the
              whole queue, not the filtered view. */}
          <div className="flex flex-wrap gap-1.5 px-4 pt-3">
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

          <div className="border-b border-hairline px-4 py-3">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search"
                aria-label="Search the queue"
                className="field pl-9"
              />
            </div>
          </div>

          <div className="ku-scrollbar min-h-0 flex-1 overflow-y-auto">
            {error && <p className="px-5 py-4 text-body-s text-st-red-ink">{error}</p>}

            {!error && items.length === 0 && !loading && (
              <p className="px-5 py-16 text-center text-body-s text-meta">Nothing on hold.</p>
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
            <p className="px-5 py-16 text-center text-body-s text-meta">Nothing to review.</p>
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
    className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-medium leading-none transition-colors duration-150 ${
      active ? 'bg-accent-tint text-[#0B4F9C]' : 'bg-canvas-deep text-meta hover:text-ink'
    }`}
  >
    {sentenceCase(label)}
    <span className="tnum opacity-70">{count}</span>
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
      className={`flex min-h-[52px] w-full items-center gap-4 rounded-none px-4 py-3 text-left transition-colors duration-150 ${
        selected ? 'bg-accent-tint' : 'bg-white hover:bg-canvas'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-s font-medium text-ink">{job.subject}</p>
        <p className="mt-0.5 flex items-center gap-2 truncate text-caption text-meta">
          <span className="truncate">{job.fromAddress}</span>
          <span aria-hidden>·</span>
          <span className="tnum shrink-0">{new Date(job.receivedAt).toLocaleDateString()}</span>
        </p>
        {job.causeLabel && <p className="mt-0.5 truncate text-caption text-st-red-ink">{job.causeLabel}</p>}
      </div>

      <span className={`ku-stamp shrink-0 ${TONE[job.tone as Tone].stamp}`}>{sentenceCase(job.statusLabel)}</span>
    </button>
  </li>
);
