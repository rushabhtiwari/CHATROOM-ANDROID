import type { CSSProperties } from 'react';
import { cx } from '@/lib/format';

/**
 * Loading placeholders. Depth comes from tint + the shimmer sweep only — never a shadow.
 * The gradient below is tuned to the `animate-shimmer` keyframes in tailwind.config.js
 * (background-position runs -400px -> 400px, so the tile is 400px wide and repeats).
 *
 * The two stops are tokens, not eyeballed greys: `canvas-deep` #DBE2E7 sweeping through
 * `canvas` #E9EDF0 and back, over the `bg-hairline` base on the element. Keep them in step
 * with tailwind.config.js — an inline style is invisible to a palette audit.
 *
 * The shapes here mirror the shapes they stand in for: a ledger cell with a tone rule on
 * top, and ruled rows on a 44px pitch. A skeleton that does not match its result is just
 * a second layout the eye has to learn.
 */
const shimmerStyle: CSSProperties = {
  backgroundImage: 'linear-gradient(90deg, #DBE2E7 0px, #E9EDF0 200px, #DBE2E7 400px)',
  backgroundSize: '400px 100%',
  backgroundRepeat: 'repeat',
};

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-shimmer bg-hairline', className)} style={shimmerStyle} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const count = Math.max(1, lines);
  return (
    <div aria-hidden="true" className={cx('flex flex-col gap-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cx('h-3', i === count - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/**
 * Stands in for one ledger cell: the 3px tone rule, the eyebrow, the anchor figure and
 * the quiet meta line underneath, in that order.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('border border-hairline border-t-3 border-t-hairline-strong bg-white p-4', className)}
    >
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-4 h-8 w-36" />
      <Skeleton className="mt-3 h-2.5 w-24" />
    </div>
  );
}

/**
 * Stands in for a ruled table: condensed heads over a 2px navy rule, then hairline rows.
 * `DataTable` draws its own skeleton inside the real `<table>` so column widths hold;
 * this one is for tables rendered outside that primitive.
 */
export function SkeletonTable({
  rows = 5,
  cols = 4,
  dense = false,
}: {
  rows?: number;
  cols?: number;
  dense?: boolean;
}) {
  const columnCount = Math.max(1, cols);
  const grid: CSSProperties = { gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` };
  const pad = dense ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div role="status" aria-live="polite" className="w-full bg-white">
      <span className="sr-only">Loading ledger rows</span>

      <div
        aria-hidden="true"
        className={cx('grid items-end gap-4 border-b-2 border-b-darkey-bluey', pad)}
        style={grid}
      >
        {Array.from({ length: columnCount }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-16" />
        ))}
      </div>

      {Array.from({ length: Math.max(1, rows) }).map((_, r) => (
        <div
          key={r}
          aria-hidden="true"
          className={cx(
            'grid items-center gap-4 border-b border-hairline last:border-b-0',
            dense ? 'min-h-[36px]' : 'min-h-[44px]',
            pad,
          )}
          style={grid}
        >
          {Array.from({ length: columnCount }).map((_, c) => (
            <Skeleton key={c} className={cx('h-3', c === 0 ? 'w-4/5' : 'w-3/5')} />
          ))}
        </div>
      ))}
    </div>
  );
}
