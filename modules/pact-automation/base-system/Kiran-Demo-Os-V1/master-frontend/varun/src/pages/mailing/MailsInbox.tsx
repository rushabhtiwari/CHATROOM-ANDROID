import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { mailingApi } from '../../modules/mailing/api';
import type { MailDetail, MailRow } from '../../modules/mailing/types';
import { useAsync, useMailingVersion } from '../../modules/mailing/useMailing';
import { MailInspector, AttachmentBadge } from '../../components/mailing/MailInspector';
import { TONE, Tone } from '../../lib/tone';

const PAGE_SIZE = 12;

/**
 * "The Mails Part" (WORKING.md §3.2).
 *
 * A full audit ledger of inbound and outbound mail on the left, the split
 * reader on the right. Filters run server-side, so the count under the table is
 * the real total rather than the length of the current page.
 */
export const MailsInbox: React.FC = () => {
  const navigate = useNavigate();
  const version = useMailingVersion();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState<'' | 'INBOUND' | 'OUTBOUND'>('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      mailingApi.mails({
        q: q || undefined,
        status: status || undefined,
        direction: direction || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [q, status, direction, page],
  );

  const { data, loading, error } = useAsync(load, [q, status, direction, page, version]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Keep a selection alive across refetches, but never point at a row that has
  // filtered out from under the reader.
  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
  }, [rows, selectedId]);

  const detailLoader = useCallback(
    () => (selectedId ? mailingApi.mail(selectedId) : Promise.resolve(null as MailDetail | null)),
    [selectedId],
  );
  const { data: detail } = useAsync(detailLoader, [selectedId, version]);

  const statuses = useMemo(() => data?.statuses ?? [], [data]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ---- The ledger ------------------------------------------------ */}
      <section className="ku-sheet flex min-h-0 flex-col">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="ku-eyebrow">Mail ledger</p>
            <h2 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-ink">
              Every message the intake has seen
            </h2>
          </div>
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <dt className="ku-eyebrow">On view</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-ink">{rows.length}</dd>
            </div>
            <div>
              <dt className="ku-eyebrow">Matching</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-ink">{total}</dd>
            </div>
          </dl>
        </div>

        {/* ---- Filters ------------------------------------------------ */}
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search aria-hidden className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-hairline-strong" />
            <input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Search subject, sender, PO number…"
              aria-label="Search messages"
              className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white py-2 pl-8 pr-3 text-body-s text-ink transition-colors duration-150 placeholder:text-meta hover:border-b-ink focus:border-b-ink"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="h-9 border-2 border-hairline-strong bg-white px-2 text-body-s text-ink"
          >
            <option value="">All statuses</option>
            {statuses.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>

          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as '' | 'INBOUND' | 'OUTBOUND');
              setPage(1);
            }}
            aria-label="Filter by direction"
            className="h-9 border-2 border-hairline-strong bg-white px-2 text-body-s text-ink"
          >
            <option value="">Both directions</option>
            <option value="INBOUND">Inbound</option>
            <option value="OUTBOUND">Outbound</option>
          </select>
        </div>

        {/* ---- Rows --------------------------------------------------- */}
        <div className="ku-scrollbar min-h-0 flex-1 overflow-y-auto">
          {error && <p className="px-5 py-4 text-body-s text-st-red-ink">{error}</p>}

          {!error && rows.length === 0 && !loading && (
            <div className="flex flex-col items-start px-6 py-14 text-left">
              <span aria-hidden className="block h-0.5 w-7 origin-left animate-rule-in bg-accent" />
              <div className="mt-3.5 flex items-center gap-2">
                <Search aria-hidden size={13} className="shrink-0 text-hairline-strong" />
                <span className="ku-eyebrow">Nothing on file</span>
              </div>
              <p className="ku-wide mt-2 font-display text-h3 font-semibold text-ink">
                No message matches this view
              </p>
              <p className="mt-2 max-w-[54ch] text-body-s leading-relaxed text-meta">
                Widen the search or clear a filter. New mail arrives from the watcher, or from the
                direct mailer above.
              </p>
            </div>
          )}

          <ul className="ku-ruled">
            {rows.map((row) => (
              <MailLine
                key={row.id}
                row={row}
                selected={row.id === selectedId}
                onSelect={() => setSelectedId(row.id)}
              />
            ))}
          </ul>
        </div>

        {/* ---- Pagination --------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-canvas px-4 py-3 text-body-s text-meta">
          <div>
            Showing <span className="ku-fig font-semibold text-ink">{rows.length}</span> of{' '}
            <span className="ku-fig font-semibold text-ink">{total}</span> messages
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              title="Previous page"
              className="flex h-8 w-8 items-center justify-center border-2 border-hairline-strong bg-white text-ink transition-all duration-150 hover:border-ink hover:bg-canvas active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            <span className="ku-fig px-2 font-semibold text-ink">
              {page} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              disabled={page >= pages}
              aria-label="Next page"
              title="Next page"
              className="flex h-8 w-8 items-center justify-center border-2 border-hairline-strong bg-white text-ink transition-all duration-150 hover:border-ink hover:bg-canvas active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ---- The reader ------------------------------------------------ */}
      <section className="ku-card min-h-[520px]">
        {detail ? (
          <MailInspector
            detail={detail}
            onOpenJob={(jobId) => navigate(`/admin/mailing/on-hold/${jobId}`)}
          />
        ) : (
          <div className="flex flex-col items-start px-6 py-14 text-left">
            <span aria-hidden className="block h-0.5 w-7 origin-left animate-rule-in bg-accent" />
            <p className="ku-eyebrow mt-3.5">Reader</p>
            <p className="ku-wide mt-2 font-display text-h3 font-semibold text-ink">
              Select a message
            </p>
            <p className="mt-2 max-w-[54ch] text-body-s leading-relaxed text-meta">
              Headers, body, attachments and the lifecycle the pipeline recorded appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

const MailLine: React.FC<{ row: MailRow; selected: boolean; onSelect: () => void }> = ({
  row,
  selected,
  onSelect,
}) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`flex w-full items-stretch border-l-3 text-left transition-colors duration-150 ${
        selected ? 'border-l-accent bg-canvas' : 'border-l-transparent bg-white hover:border-l-accent hover:bg-canvas'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="ku-docket">{row.id}</span>
          <span className="ku-stamp border-st-grey-ink text-st-grey-ink">
            {row.direction === 'INBOUND' ? 'In' : 'Out'}
          </span>
          <span className="min-w-0 flex-1 truncate text-body-s font-semibold text-ink">
            {row.subject}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-meta">
          <span className="ku-fig truncate">{row.fromAddress}</span>
          <span className="ku-fig">{new Date(row.receivedAt).toLocaleString()}</span>
          <AttachmentBadge count={row.attachmentCount} />
          {row.poNumber && <span className="ku-fig text-ink">{row.poNumber}</span>}
        </div>

        {row.causeLabel && (
          <p className="text-caption text-st-red-ink">{row.causeLabel}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 px-4 py-3">
        <span className={`ku-stamp ${TONE[row.tone as Tone].stamp}`}>{row.statusLabel}</span>
        {row.confidence !== null && row.confidence > 0 && (
          <span className="ku-fig text-caption text-meta">
            conf {(row.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </button>
  </li>
);
