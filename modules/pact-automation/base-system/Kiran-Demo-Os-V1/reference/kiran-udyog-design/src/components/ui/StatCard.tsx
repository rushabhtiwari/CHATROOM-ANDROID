import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';

export type StatTone = 'default' | 'navy' | 'orange' | 'success' | 'danger';

/**
 * The 3px rule along the top edge of a cell. It is the only colour a cell carries —
 * no tinted icon tiles, no filled chips. Tone reads as a ruling, the way a ledger
 * column is headed.
 */
const TONE_RULE: Record<StatTone, string> = {
  default: 'border-hairline-strong',
  navy: 'border-darkey-bluey',
  orange: 'border-orangy',
  success: 'border-st-green-ink',
  danger: 'border-washed',
};

export type LedgerCols = 2 | 3 | 4 | 5;

/**
 * The band is a single row of cells divided by hairlines (`.ku-ledger` draws the
 * dividers), stacking to one column below `md` — which is exactly where `.ku-ledger`
 * switches its dividers from vertical to horizontal. Never a wrapped 2x2 grid: the
 * band is one ruled row or it is a stack, nothing in between.
 */
const BAND_COLS: Record<LedgerCols, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-5',
};

/**
 * How large the anchor figure can be set before a ten-character amount (₹32,10,000)
 * runs into the hairline. The band tells each cell how much width it actually has;
 * a StatCard standing on its own assumes it has room for the full figure size.
 */
const VALUE_SIZE: Record<LedgerCols | 'solo', string> = {
  solo: 'text-figure',
  2: 'text-figure',
  3: 'text-h2 xl:text-figure',
  4: 'text-h2 md:text-h3 xl:text-figure',
  5: 'text-h2 md:text-h3 2xl:text-figure',
};

/** Lets a cell know it is ruled into a band rather than standing on its own. */
const LedgerBandContext = createContext<LedgerCols | null>(null);

/**
 * Four numbers that belong to one account are one ruled band, not four floating
 * cards in a `gap-4` row. Children are `StatCard`s (or anything cell-shaped).
 */
export function LedgerBand({
  children,
  className,
  cols = 4,
}: {
  children: ReactNode;
  className?: string;
  cols?: LedgerCols;
}): JSX.Element {
  return (
    <LedgerBandContext.Provider value={cols}>
      <div className={cx('ku-ledger', BAND_COLS[cols], className)}>{children}</div>
    </LedgerBandContext.Provider>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = 'default',
  delta,
  footer,
  loading = false,
  className,
}: {
  label: string;
  value: string;
  /**
   * The quiet meta line under the figure. It is prose, so it is set in the sans face —
   * a caller that wants a figure inside it wraps that figure alone in `ku-fig`.
   */
  sublabel?: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  delta?: { value: string; direction: 'up' | 'down' };
  footer?: ReactNode;
  loading?: boolean;
  className?: string;
}): JSX.Element {
  const cols = useContext(LedgerBandContext);
  // Inside a band the surrounding rules are the border; alone, the cell has to draw
  // its own so it still reads as a ledger entry rather than floating text.
  const shell = cols === null ? 'ku-card' : '';

  if (loading) {
    return (
      <div aria-hidden="true" className={cx('px-4 py-4 sm:px-5', shell, className)}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-32" />
        <Skeleton className="mt-3 h-3 w-20" />
      </div>
    );
  }

  return (
    <div className={cx('relative flex min-w-0 flex-col px-4 py-4 sm:px-5', shell, className)}>
      <span
        aria-hidden="true"
        className={cx(
          'absolute inset-x-0 top-0 origin-left animate-rule-in border-t-3',
          TONE_RULE[tone],
        )}
      />

      <div className="flex items-start gap-1.5">
        {Icon ? (
          <Icon size={12} aria-hidden="true" className="mt-px shrink-0 text-hairline-strong" />
        ) : null}
        {/* Two lines of headroom keeps the figures on one baseline across the band. */}
        <p className="ku-eyebrow min-h-7">{label}</p>
      </div>

      {/*
        `tracking-tighter` has to be stated here, not left to `.ku-total`: every step of
        the type scale carries its own letter-spacing, and those utilities are emitted
        after the components layer, so a bare `.ku-total` loses its tracking to
        `text-figure` / `text-h2` / `text-h3`. Set at 34px, untracked mono gives every
        comma in ₹3,21,000 a full monospace cell and the biggest number reads loosest.
      */}
      <p className={cx('ku-total mt-1.5 leading-none tracking-tighter', VALUE_SIZE[cols ?? 'solo'])}>
        {value}
      </p>

      {delta || sublabel ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-caption">
          {delta ? (
            <span
              className={cx(
                'ku-fig font-medium',
                delta.direction === 'up' ? 'text-st-green-ink' : 'text-st-red-ink',
              )}
            >
              {/* Colour is never the only carrier — the caret and the reader text both say it. */}
              <span aria-hidden="true">{delta.direction === 'up' ? '↑ ' : '↓ '}</span>
              <span className="sr-only">{delta.direction === 'up' ? 'up ' : 'down '}</span>
              {delta.value}
            </span>
          ) : null}
          {/*
            The meta line is a sentence, not a reading: "of the sanctioned pool released"
            has no business being set in the instrument face. Any figure it carries is
            wrapped in `ku-fig` by the caller, so mono keeps meaning "this is a number".
          */}
          {sublabel ? <span className="text-meta">{sublabel}</span> : null}
        </p>
      ) : null}

      {footer ? (
        <div className="-mx-4 -mb-4 mt-auto border-t border-hairline px-4 pb-3 pt-4 text-caption text-meta sm:-mx-5 sm:px-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
