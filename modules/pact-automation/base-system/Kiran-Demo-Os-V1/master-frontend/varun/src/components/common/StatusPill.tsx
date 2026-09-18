import React from 'react';
import { StatusVariant } from '../../types';
import { TONE, toneForStatus } from '../../lib/tone';

interface StatusPillProps {
  status: StatusVariant | string;
  /** The heavier stamp, for the head of a record rather than a table row. */
  size?: 'sm' | 'lg';
  /**
   * The colour anchor dot is off by default (§5.4). In a dense table the word
   * already says "REJECTED"; a second colour-only marker on every row is
   * noise. Turn it on only where a run of stamps needs an at-a-glance anchor.
   */
  showDot?: boolean;
  className?: string;
}

/**
 * A status is stamped, not pilled — LEDGERDESIGNSYSTEM.md §5.4.
 *
 * Hard 2px outline, transparent ground, uppercase mono, wide tracking. The
 * outline and the letters are the same ink, which is how a rubber stamp
 * actually prints — and it keeps the mark legible in greyscale, in print, and
 * on tinted rows where a pastel wash would vanish.
 */
export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  size = 'sm',
  showDot = false,
  className = '',
}) => {
  const tone = TONE[toneForStatus(status)];

  return (
    <span
      className={`ku-stamp ${size === 'lg' ? 'ku-stamp-lg' : ''} ${tone.stamp} ${className}`}
    >
      {showDot && (
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.solid}`} />
      )}
      <span className="whitespace-nowrap">{status}</span>
    </span>
  );
};
