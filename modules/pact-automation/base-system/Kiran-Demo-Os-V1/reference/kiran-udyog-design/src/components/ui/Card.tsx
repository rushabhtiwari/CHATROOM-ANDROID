import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

/**
 * `card` is the ordinary flat surface: white ground, 1px hairline, 0 radius, no shadow.
 * `sheet` is the primary-artifact surface — the same panel with a 3px navy rule across
 * the top, so the thing a page is actually about reads as the docket, not as one more
 * panel among equals. Use it once, on the page's own subject.
 */
export type CardVariant = 'card' | 'sheet' | 'default';

export function Card({
  children,
  className,
  padded = false,
  notch = false,
  variant = 'card',
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  notch?: boolean;
  variant?: CardVariant;
}) {
  return (
    <div
      className={cx(
        variant === 'sheet' ? 'ku-sheet' : 'ku-card',
        notch ? 'ku-notch-sm' : '',
        padded ? 'p-4 sm:px-5 sm:py-4' : '',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Optional stamped line above the title — a section number, a period, a filter state. */
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-hairline-strong px-4 py-3.5 sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="ku-eyebrow mb-1.5">{eyebrow}</p> : null}
        <h3 className="ku-wide font-display text-lead font-semibold leading-tight text-rich-black">
          {title}
        </h3>
        {subtitle ? <p className="mt-1 text-caption text-meta">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('p-4 sm:px-5 sm:py-4', className)}>{children}</div>;
}
