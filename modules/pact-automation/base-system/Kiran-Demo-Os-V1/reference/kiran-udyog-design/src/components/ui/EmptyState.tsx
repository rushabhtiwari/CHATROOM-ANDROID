import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cx } from '@/lib/format';

/**
 * An empty surface is an invitation to act, not an apology. So it is set like the head of
 * a blank ledger page: an orange tick, a stamped eyebrow, one true sentence about what
 * lands here, then the control that puts something there. Left-aligned — a centred icon
 * in a grey box is the thing this redesign exists to remove.
 */
export function EmptyState({
  icon: Icon = Inbox,
  eyebrow = 'Nothing on file',
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  /** The stamped label above the headline. Keep it two or three words. */
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex w-full flex-col items-start text-left',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <span aria-hidden="true" className={cx('block bg-orangy', compact ? 'h-0.5 w-5' : 'h-0.5 w-7')} />

      <div className={cx('flex items-center gap-2', compact ? 'mt-2.5' : 'mt-3.5')}>
        <Icon aria-hidden="true" size={13} className="shrink-0 text-hairline-strong" />
        <span className="ku-eyebrow">{eyebrow}</span>
      </div>

      <p
        className={cx(
          'ku-wide mt-2 font-display font-semibold leading-tight text-rich-black',
          compact ? 'text-body' : 'text-h3',
        )}
      >
        {title}
      </p>

      {description ? (
        <p className="mt-2 max-w-[54ch] text-body-s leading-relaxed text-meta">{description}</p>
      ) : null}

      {action ? (
        <div className={cx('flex flex-wrap items-center gap-2', compact ? 'mt-4' : 'mt-6')}>
          {action}
        </div>
      ) : null}
    </div>
  );
}
