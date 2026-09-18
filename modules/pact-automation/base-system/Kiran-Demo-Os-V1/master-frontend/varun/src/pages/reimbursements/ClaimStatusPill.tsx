/**
 * The claim status, stamped.
 *
 * The finance module classifies a status into one of five tones; the console
 * has one stamp treatment (LEDGERDESIGNSYSTEM.md §5.4). This is the join
 * between them, kept in one place so a status never renders two different ways
 * on two different screens.
 */

import React from 'react';
import { statusLabel, statusTone } from '@/modules/rts/status';
import type { RequestStatus } from '@/modules/rts/types';
import { TONE } from '@/lib/tone';

export const ClaimStatusPill: React.FC<{ status: RequestStatus; className?: string }> = ({
  status,
  className = '',
}) => (
  <span className={`ku-stamp ${TONE[statusTone(status)].stamp} ${className}`}>
    {statusLabel(status)}
  </span>
);

export default ClaimStatusPill;
