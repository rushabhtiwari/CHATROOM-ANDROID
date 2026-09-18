/**
 * The claim status, in the console's pill.
 *
 * The finance module classifies a status into one of five tones; the console
 * has one pill treatment. This is the join between them, kept in one place so
 * a status never renders two different ways on two different screens.
 */

import React from 'react';
import { statusLabel, statusTone, type StatusTone } from '@/modules/rts/status';
import type { RequestStatus } from '@/modules/rts/types';

const TONE: Record<StatusTone, { pill: string; dot: string }> = {
  grey: { pill: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  blue: { pill: 'bg-kiran-tint text-kiran border-kiran/20', dot: 'bg-kiran' },
  amber: { pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-strand-amber' },
  red: { pill: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-strand-red' },
  green: { pill: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-strand-green' },
};

export const ClaimStatusPill: React.FC<{ status: RequestStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const tone = TONE[statusTone(status)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${tone.pill} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {statusLabel(status)}
    </span>
  );
};

export default ClaimStatusPill;
