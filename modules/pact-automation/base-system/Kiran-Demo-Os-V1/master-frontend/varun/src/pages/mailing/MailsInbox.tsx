import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { mailingApi } from '../../modules/mailing/api';
import type { MailDetail, MailRow } from '../../modules/mailing/types';
import { useAsync, useMailingVersion } from '../../modules/mailing/useMailing';
import { MailInspector, AttachmentBadge } from '../../components/mailing/MailInspector';
import { TONE, sentenceCase, Tone } from '../../lib/tone';

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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---- The ledger ------------------------------------------------ */}
      <section className="ku-sheet flex min-h-0 flex-col">
        {/* ---- Filters ------------------------------------------------ */}
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
          <div className="relative min-w-[140px] flex-1">
            <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Search"
              aria-label="Search messages"
              className="field pl-9"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="field w-auto"
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
            className="field w-auto"
          >
            <option value="">In and out</option>
            <option value="INBOUND">In</option>
            <option value="OUTBOUND">Out</option>
          </select>
        </div>

        {/* ---- Rows --------------------------------------------------- */}
        <div className="ku-scrollbar min-h-0 flex-1 overflow-y-auto">
          {error && <p className="px-5 py-4 text-body-s text-st-red-ink">{error}</p>}

          {!error && rows.length === 0 && !loading && (
            <p className="px-5 py-16 text-center text-body-s text-meta">No mails found.</p>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-2.5 text-body-s text-meta">
          <div className="tnum text-caption">
            {rows.length} of {total}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              title="Previous page"
              className="btn-icon disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            <span className="tnum px-1 text-caption text-meta">
              {page} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              disabled={page >= pages}
              aria-label="Next page"
              title="Next page"
              className="btn-icon disabled:cursor-not-allowed disabled:opacity-40"
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
          <p className="px-5 py-16 text-center text-body-s text-meta">Select a mail.</p>
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
      className={`flex min-h-[52px] w-full items-center gap-4 rounded-none px-4 py-3 text-left transition-colors duration-150 ${
        selected ? 'bg-accent-tint' : 'bg-white hover:bg-canvas'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-s font-medium text-ink">{row.subject}</p>
        <p className="mt-0.5 flex items-center gap-2 truncate text-caption text-meta">
          <span className="truncate">{row.fromAddress}</span>
          <span aria-hidden>·</span>
          <span className="tnum shrink-0">{new Date(row.receivedAt).toLocaleString()}</span>
          <AttachmentBadge count={row.attachmentCount} />
          {row.poNumber && <span className="shrink-0 font-code text-[12px] text-ink">{row.poNumber}</span>}
        </p>
        {row.causeLabel && <p className="mt-0.5 truncate text-caption text-st-red-ink">{row.causeLabel}</p>}
      </div>

      <span className={`ku-stamp shrink-0 ${TONE[row.tone as Tone].stamp}`}>{sentenceCase(row.statusLabel)}</span>
    </button>
  </li>
);
