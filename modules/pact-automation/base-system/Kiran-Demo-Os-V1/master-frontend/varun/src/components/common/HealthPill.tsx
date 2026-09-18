import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TONE, Tone } from '../../lib/tone';

export type HealthStatus =
  | 'on_track'
  | 'at_risk'
  | 'overdue'
  | 'critical'
  | 'stale'
  | 'neutral'
  | string;

export interface HealthPillProps {
  status: HealthStatus;
  label?: string;
  showPulse?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A health verdict, stamped rather than pilled.
 *
 * §8.3 — colour is never the only carrier. Every non-neutral state ships a
 * glyph as well as its ink, so the mark survives greyscale, print, and a
 * reader who cannot separate the amber from the green.
 */
const STATE: Record<string, { tone: Tone; label: string; Icon?: React.ElementType }> = {
  on_track: { tone: 'green', label: 'On Track', Icon: CheckCircle2 },
  good: { tone: 'green', label: 'Good', Icon: CheckCircle2 },
  healthy: { tone: 'green', label: 'Healthy', Icon: CheckCircle2 },
  active: { tone: 'green', label: 'Active', Icon: CheckCircle2 },
  at_risk: { tone: 'amber', label: 'At Risk', Icon: AlertTriangle },
  warning: { tone: 'amber', label: 'Warning', Icon: AlertTriangle },
  caution: { tone: 'amber', label: 'Caution', Icon: AlertTriangle },
  overdue: { tone: 'red', label: 'Overdue', Icon: AlertCircle },
  critical: { tone: 'red', label: 'Critical', Icon: AlertCircle },
  danger: { tone: 'red', label: 'Critical', Icon: AlertCircle },
  blocked: { tone: 'red', label: 'Blocked', Icon: AlertCircle },
  stale: { tone: 'red', label: 'Stale', Icon: AlertTriangle },
};

export const HealthPill: React.FC<HealthPillProps> = ({
  status,
  label,
  size = 'sm',
  className = '',
}) => {
  const norm = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
  const state = STATE[norm];
  const tone = TONE[state?.tone ?? 'grey'];
  const Icon = state?.Icon;

  return (
    <span
      className={`ku-stamp ${size === 'md' ? 'ku-stamp-lg' : ''} ${tone.stamp} ${className}`}
    >
      {Icon && <Icon aria-hidden size={size === 'md' ? 13 : 11} className="shrink-0" />}
      <span>{label || state?.label || status}</span>
    </span>
  );
};
