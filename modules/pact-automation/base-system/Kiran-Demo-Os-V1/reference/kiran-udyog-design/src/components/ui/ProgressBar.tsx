import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Employee } from '@/lib/types';
import { DEMO_TODAY, cx, formatCurrency, formatPercent } from '@/lib/format';

export interface ProgressSegment {
  value: number;
  /** Tailwind background class for this segment. */
  className: string;
  label: string;
}

/**
 * A hard-edged ruled bar: zero radius, hairline gaps between segments, no shadow.
 * Segments draw themselves in from the left the way a pen runs across a ledger line.
 * Pass `figure` to set the reading beside the bar in the mono figure face.
 */
export function ProgressBar({
  segments,
  total,
  height = 10,
  figure,
  className,
}: {
  segments: ProgressSegment[];
  total: number;
  height?: number;
  /** Reading shown beside the bar — always a figure, always mono. */
  figure?: ReactNode;
  className?: string;
}) {
  const safeTotal = total > 0 ? total : 0;
  const summary = segments.map((s) => `${s.label} ${formatCurrency(s.value)}`).join(', ');

  const bar = (
    <div
      role="img"
      aria-label={safeTotal > 0 ? `${summary} of ${formatCurrency(safeTotal)}` : 'Nothing allocated'}
      className={cx('flex w-full gap-px overflow-hidden bg-canvas-deep', figure ? 'flex-1' : '')}
      style={{ height }}
    >
      {safeTotal > 0 &&
        segments.map((segment) => {
          const pct = Math.max(0, Math.min(100, (segment.value / safeTotal) * 100));
          if (pct <= 0) return null;
          return (
            <div
              key={segment.label}
              className={cx('origin-left animate-rule-in', segment.className)}
              style={{ width: `${pct}%` }}
              title={`${segment.label} — ${formatCurrency(segment.value)}`}
            />
          );
        })}
    </div>
  );

  if (!figure) return <div className={cx('w-full', className)}>{bar}</div>;

  return (
    <div className={cx('flex w-full items-center gap-3', className)}>
      {bar}
      <span className="ku-fig shrink-0 text-body-s font-semibold text-rich-black">{figure}</span>
    </div>
  );
}

const MONTH_LABEL = DEMO_TODAY.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/**
 * The employee's monthly pool, read as a ledger page: one anchor figure, one ruled bar,
 * then the three lines that make it up. The low-balance note is a ruled warning, not a
 * tinted card — it tells the employee what is left and what that means for the month.
 */
export function AllowanceCard({
  employee,
  compact,
  className,
}: {
  employee: Employee;
  compact?: boolean;
  className?: string;
}) {
  const { monthlyAllowance, usedThisMonth, pendingAmount } = employee;
  const remaining = Math.max(0, monthlyAllowance - usedThisMonth - pendingAmount);
  const isLow = remaining < 0.2 * monthlyAllowance;

  const legend: ProgressSegment[] = [
    { value: usedThisMonth, className: 'bg-darkey-bluey', label: 'Drawn' },
    { value: pendingAmount, className: 'bg-orangy', label: 'In flight' },
    { value: remaining, className: 'bg-hairline-strong', label: 'Unspent' },
  ];

  return (
    <section className={cx('ku-sheet', className)}>
      <div className={cx(compact ? 'p-4' : 'p-5')}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="ku-eyebrow">Allowance pool</span>
          <span className="ku-fig text-caption text-meta">{MONTH_LABEL}</span>
        </div>

        {/*
          The anchor figure is sized off `compact`, never off the viewport: the widest
          host for this card is a full-width column on a small screen, and the narrowest
          is the ~210px fourth track of the admin ledger at xl. A viewport step grew the
          figure exactly where the column shrank, so `₹40,000` at 46px ran past the sheet.
        */}
        <p className={cx('ku-total mt-3 leading-none', compact ? 'text-h2' : 'text-figure')}>
          {formatCurrency(remaining)}
        </p>
        <p className="mt-2 text-body-s text-meta">
          unspent of <span className="ku-fig text-rich-black">{formatCurrency(monthlyAllowance)}</span>
          {' · '}
          <span className="ku-fig">{formatPercent(usedThisMonth / monthlyAllowance)}</span> drawn
        </p>

        <ProgressBar
          className="mt-4"
          segments={legend}
          total={monthlyAllowance}
          height={compact ? 8 : 12}
        />
      </div>

      <div className="ku-ruled border-t border-hairline">
        {legend.map((item) => (
          <div
            key={item.label}
            className={cx('flex items-baseline gap-3', compact ? 'px-4 py-2' : 'px-5 py-2.5')}
          >
            <span aria-hidden="true" className={cx('h-2.5 w-2.5 shrink-0 self-center', item.className)} />
            <span className="min-w-0 flex-1 truncate text-body-s text-light-black">{item.label}</span>
            <span className="ku-fig text-body-s font-semibold text-rich-black">
              {formatCurrency(item.value)}
            </span>
          </div>
        ))}

        {isLow && (
          <div
            className={cx(
              'flex items-start gap-2.5 border-l-3 border-l-st-amber-line',
              compact ? 'px-4 py-3' : 'px-5 py-3.5',
            )}
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-st-amber-ink" />
            <p className="text-body-s text-st-amber-ink">
              Under a fifth of the {MONTH_LABEL} pool is left. A claim above{' '}
              <span className="ku-fig font-semibold">{formatCurrency(remaining)}</span> will run past
              the allowance and needs Accounts to clear the overrun.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
