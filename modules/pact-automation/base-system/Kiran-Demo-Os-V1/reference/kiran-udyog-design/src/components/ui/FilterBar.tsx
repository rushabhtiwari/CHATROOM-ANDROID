import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/format';

export interface ActiveFilter {
  /** Which control it came from, e.g. `Department`. Stamped, so keep it to one word. */
  label: string;
  /**
   * What the user chose, e.g. `Fabrication` or a typed search string. Set in the sans face,
   * because most of what lands here is prose — a raw query in mono runs ~25% wide and wraps
   * the chip row on a narrow viewport. When the value really is a reading (an amount band, a
   * date), the caller wraps it: `value={<span className="ku-fig">Under ₹5,000</span>}`.
   */
  value: ReactNode;
  onClear?: () => void;
}

/**
 * One applied filter, as a hard-edged chip with its own release. Never a pastel pill.
 */
export function FilterChip({ label, value, onClear }: ActiveFilter) {
  return (
    <span className="inline-flex items-center gap-2 border border-hairline-strong bg-white py-1 pl-2 pr-1">
      <span className="ku-eyebrow">{label}</span>
      <span className="text-caption font-medium text-rich-black">{value}</span>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          title={`Clear ${label} filter`}
          className="inline-flex h-5 w-5 items-center justify-center text-meta transition-colors duration-150 hover:bg-canvas hover:text-st-red-ink"
        >
          <X size={12} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  );
}

/**
 * The ruled toolbar that sits on top of the ledger it filters: a 3px navy rule at the head
 * (the same rule `.ku-sheet` carries), a stamped rail with the reset control, then the
 * controls themselves, then the applied filters as ruled chips. Pass `flush` when the table
 * is welded directly underneath so the two surfaces share one border instead of stacking.
 */
export function FilterBar({
  children,
  onReset,
  filters,
  flush = false,
  className,
}: {
  children: ReactNode;
  onReset?: () => void;
  /** Applied filters, rendered as removable chips on their own ruled line. */
  filters?: ActiveFilter[];
  flush?: boolean;
  className?: string;
}) {
  const applied = filters ?? [];

  return (
    <div
      className={cx(
        'ku-sheet w-full',
        flush ? 'border-b-0' : '',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-1.5">
        <span aria-hidden="true" className="h-2.5 w-0.5 shrink-0 bg-orangy" />
        <span className="ku-eyebrow">Filters</span>
        {applied.length > 0 ? (
          <span className="ku-fig text-micro text-meta">{applied.length} applied</span>
        ) : null}

        {onReset ? (
          <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto">
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3 px-4 py-3">{children}</div>

      {applied.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-canvas px-4 py-2.5">
          {applied.map((filter, i) => (
            <FilterChip
              // A value may now be a node, so the label plus its place in the row is the key.
              key={`${filter.label}:${i}`}
              label={filter.label}
              value={filter.value}
              onClear={filter.onClear}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
