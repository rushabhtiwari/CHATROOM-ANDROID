import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { cx } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export type ColumnAlign = 'left' | 'right' | 'center';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: ColumnAlign;
  /**
   * Money, counts, dates, ids, percentages. Right-aligns the column and sets the cell in
   * `ku-fig` so figures stack on the decimal — the whole point of the ledger. Prefer this
   * over `align: 'right'`, which is for action columns that must not be set in mono.
   */
  numeric?: boolean;
  /** Opt in to the quiet mono sort caret. Pair with `sort` + `onSortChange` on the table. */
  sortable?: boolean;
  width?: string;
  className?: string;
  render: (row: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
  /**
   * Keeps the ruled column heads in view while a long ledger scrolls. The wrapper becomes
   * the vertical scrollport to make that possible, so the table takes a capped height.
   * Pass `false` for a short table that should simply flow with the page.
   */
  stickyHeader?: boolean;
  dense?: boolean;
  /** Current sort, when the caller sorts its own rows. */
  sort?: SortState | null;
  onSortChange?: (key: string, direction: SortDirection) => void;
  /** The table normally lives inside a sheet that already draws the box. */
  bordered?: boolean;
  className?: string;
}

const ALIGN: Record<ColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const JUSTIFY: Record<ColumnAlign, string> = {
  left: 'justify-start',
  right: 'justify-end',
  center: 'justify-center',
};

/** Hard-edged, orange when ticked. A ledger is marked up, not toggled. */
const CHECKBOX = 'h-4 w-4 shrink-0 cursor-pointer rounded-none accent-orangy align-middle';

/**
 * The ledger cursor. A 3px left rule that the header row also carries (transparent) so
 * the collapsed border grid stays aligned column-for-column between head and body.
 */
const ROW_RULE = 'border-l-3 border-l-transparent';

/**
 * The 2px navy rule under the head. Under `border-collapse: collapse` that border belongs
 * to the table's border grid rather than to the cell, so it does not travel with a sticky
 * `th` in Chromium — the rule would scroll away from the heads it underlines. When the head
 * sticks, the same rule is drawn inside the cell instead (a sticky box is positioned, so it
 * is the containing block for the pseudo-element). Same 2px read, either way.
 */
const HEAD_RULE = 'border-b-2 border-b-darkey-bluey';
const HEAD_STICKY =
  "sticky top-0 z-10 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-darkey-bluey after:content-['']";

function alignOf<T>(col: Column<T>): ColumnAlign {
  return col.align ?? (col.numeric ? 'right' : 'left');
}

/**
 * A number never appears in the sans face. Callers say so with `numeric`, but the older
 * convention in this codebase is just as reliable and is honoured here: a labelled
 * right-aligned column is a figure column, while an action column is right-aligned with
 * no header at all. Pass `numeric: false` to keep a labelled right column out of mono.
 */
function isNumeric<T>(col: Column<T>): boolean {
  if (col.numeric !== undefined) return col.numeric;
  return col.align === 'right' && typeof col.header === 'string' && col.header.trim() !== '';
}

/** Quiet mono caret. No icon button, no fill — it reads as a proof mark in the margin. */
function SortCaret({ state }: { state: SortDirection | null }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'ku-fig text-micro leading-none',
        state ? 'text-rich-black' : 'text-hairline-strong',
      )}
    >
      {state === 'asc' ? '↑' : state === 'desc' ? '↓' : '↕'}
    </span>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  loading = false,
  skeletonRows = 6,
  empty,
  stickyHeader = true,
  dense = false,
  sort,
  onSortChange,
  bordered = false,
  className,
}: DataTableProps<T>) {
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const selected = selectedIds ?? [];
  const selectedSet = new Set(selected);
  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(rowKey(row)));
  const someSelected = rows.some((row) => selectedSet.has(rowKey(row)));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const totalCols = columns.length + (selectable ? 1 : 0);
  // Rows land on ~44px, dense on ~36px — a work tool, tighter than a marketing table.
  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3';
  const headPad = dense ? 'px-3 py-2.5' : 'px-4 py-2.5';

  function toggleAll() {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : rows.map(rowKey));
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    onSelectionChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  function sortStateOf(key: string): SortDirection | null {
    return sort && sort.key === key ? sort.direction : null;
  }

  function handleSort(key: string) {
    if (!onSortChange) return;
    onSortChange(key, sortStateOf(key) === 'asc' ? 'desc' : 'asc');
  }

  return (
    /*
      `overflow-x: auto` promotes the computed `overflow-y` from `visible` to `auto`, so
      this wrapper — not `main` — is already the nearest scrollport for the sticky heads.
      It only behaves like one once it has a height to overflow, hence the cap: without it
      `top: 0` resolves against a box that never moves and the heads scroll away.
    */
    <div
      className={cx(
        'ku-scrollbar w-full overflow-x-auto bg-white',
        stickyHeader ? 'max-h-[calc(100vh-16rem)] overflow-y-auto' : '',
        bordered ? 'border border-hairline' : '',
        className,
      )}
    >
      {loading ? <span className="sr-only">Loading ledger rows</span> : null}

      <table className="w-full border-collapse text-body-s">
        <thead>
          {/* One 2px navy rule runs under the whole head — the ledger's ruled margin. */}
          <tr className={ROW_RULE}>
            {selectable ? (
              <th
                scope="col"
                className={cx(
                  'w-10 bg-white text-left align-middle',
                  headPad,
                  stickyHeader ? HEAD_STICKY : HEAD_RULE,
                )}
              >
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className={CHECKBOX}
                  checked={allSelected}
                  onChange={toggleAll}
                  onClick={stop}
                  aria-label={allSelected ? 'Clear selection' : 'Select all rows'}
                  disabled={rows.length === 0}
                />
              </th>
            ) : null}

            {columns.map((col) => {
              const align = alignOf(col);
              const state = sortStateOf(col.key);
              const canSort = Boolean(col.sortable && onSortChange);

              return (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={
                    canSort
                      ? state === 'asc'
                        ? 'ascending'
                        : state === 'desc'
                          ? 'descending'
                          : 'none'
                      : undefined
                  }
                  className={cx(
                    // ku-narrow: Archivo condensed. Column heads are cramped by definition.
                    'ku-narrow bg-white align-bottom',
                    'text-micro font-semibold uppercase text-meta',
                    headPad,
                    ALIGN[align],
                    stickyHeader ? HEAD_STICKY : HEAD_RULE,
                    col.className,
                  )}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cx(
                        'ku-narrow inline-flex w-full items-center gap-1.5 uppercase',
                        'transition-colors duration-150 hover:text-rich-black',
                        JUSTIFY[align],
                      )}
                    >
                      {col.header}
                      <SortCaret state={state} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            // Skeletons take the real column widths, so nothing jumps when data lands.
            Array.from({ length: Math.max(1, skeletonRows) }).map((_, r) => (
              <tr
                key={`skeleton-${r}`}
                aria-hidden="true"
                className={cx('border-b border-b-hairline last:border-b-0', ROW_RULE)}
              >
                {selectable ? (
                  <td className={cx('align-middle', cellPad)}>
                    <Skeleton className="h-4 w-4" />
                  </td>
                ) : null}
                {columns.map((col, c) => (
                  <td key={col.key} className={cx('align-middle', cellPad)}>
                    <Skeleton
                      className={cx(
                        'h-3',
                        alignOf(col) === 'right' ? 'ml-auto w-16' : c === 0 ? 'w-4/5' : 'w-3/5',
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr className={ROW_RULE}>
              <td colSpan={totalCols} className="p-0">
                {empty ?? (
                  <EmptyState
                    eyebrow="No rows"
                    title="Nothing matches these filters"
                    description="Widen the date or amount range, or clear the filters to bring the full ledger back."
                  />
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const id = rowKey(row);
              const isSelected = selectedSet.has(id);
              return (
                /*
                  `onRowClick` is a pointer convenience only. A focusable `<tr>` is still
                  announced as a row — no name, no hint that it does anything — and it
                  doubles the tab stops on every table that already ships a labelled
                  control in a cell. The keyboard path is that control (the row's Review
                  button, its docket link, its "Open claim" icon), which carries the
                  identity in its own accessible name.
                */
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  data-selected={selectable && isSelected ? 'true' : undefined}
                  className={cx(
                    // No zebra. A hairline under every entry, and the orange left rule
                    // follows the pointer down the page like a finger on a ledger line.
                    'border-b border-b-hairline last:border-b-0 border-l-3',
                    'transition-colors duration-150 hover:bg-canvas hover:border-l-orangy',
                    isSelected ? 'border-l-darkey-bluey bg-canvas' : 'border-l-transparent bg-white',
                    onRowClick ? 'cursor-pointer' : '',
                  )}
                >
                  {selectable ? (
                    <td className={cx('align-middle', cellPad)}>
                      <input
                        type="checkbox"
                        className={CHECKBOX}
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                        onClick={stop}
                        aria-label={isSelected ? 'Deselect row' : 'Select row'}
                      />
                    </td>
                  ) : null}

                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cx(
                        'align-middle text-light-black',
                        cellPad,
                        ALIGN[alignOf(col)],
                        // Every figure in the system is set on the instrument voice.
                        isNumeric(col) ? 'ku-fig text-rich-black' : '',
                        col.className,
                      )}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
