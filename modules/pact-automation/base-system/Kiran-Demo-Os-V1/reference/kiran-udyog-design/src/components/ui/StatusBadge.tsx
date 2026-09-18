import type { ReactNode } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import type { PayoutStatus, RequestStatus, Stage } from '@/lib/types';
import type { StatusTone } from '@/lib/status';
import { PAYOUT_META, STAGE_LABEL, TONE_CLASSES, statusMeta } from '@/lib/status';
import { cx, slaState } from '@/lib/format';

/*
  Status is a stamp, not a pill.

  A claim in this system is cleared or refused by a person who, on paper, reaches
  for a rubber stamp. So it renders as one: a hard 2px outline on a transparent
  ground, uppercase IBM Plex Mono, widely tracked. No tint wash sits behind it --
  outline and letters are the one ink, the way a rubber stamp actually prints, and
  the word itself carries the meaning, so the treatment stays legible in greyscale,
  in print, and on the canvas-tinted rows where a washed rule would disappear.

  `sm` is the table/list stamp. `md` is the heavier stamp used once at the head of
  a record. The angled, oversized `Stamp` at the bottom of this file is the
  struck version, reserved for a page's own settled or void artifact.
*/

type BadgeSize = 'sm' | 'md';

const DOT_SIZE: Record<BadgeSize, string> = { sm: 'h-1.5 w-1.5', md: 'h-2 w-2' };

/** Every stamped tone in the app funnels through here so a tone is never hand-rolled. */
function stampClasses(tone: StatusTone, size: BadgeSize): string {
  return cx('ku-stamp', size === 'md' && 'ku-stamp-lg', TONE_CLASSES[tone].stamp);
}

/**
 * The dot is off by default: in a dense table the stamp text already says
 * "HR CLEARED", and a second colour-only marker in every row is noise. Pass
 * `showDot` where a run of stamps genuinely needs an at-a-glance colour anchor.
 */
export function StatusBadge({
  status,
  size = 'sm',
  showDot = false,
  className,
}: {
  status: RequestStatus;
  size?: BadgeSize;
  showDot?: boolean;
  className?: string;
}) {
  const meta = statusMeta(status);
  return (
    <span className={cx(stampClasses(meta.tone, size), className)} title={meta.hint}>
      {showDot ? (
        <span aria-hidden="true" className={cx('shrink-0', DOT_SIZE[size], TONE_CLASSES[meta.tone].dot)} />
      ) : null}
      {meta.label}
    </span>
  );
}

/** The same stamp, for the facts that are not a workflow status: category, method, a flag. */
export function Badge({
  children,
  tone = 'grey',
  size = 'sm',
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  size?: BadgeSize;
  className?: string;
}) {
  return <span className={cx(stampClasses(tone, size), className)}>{children}</span>;
}

/**
 * A stage is a position on the pipeline, not a verdict, so it never takes a
 * status colour. It reads as a neutral marker with a 3px orange rule down its
 * leading edge -- the "you are here" tick on the track.
 *
 * The frame is `border-meta`, not a hairline: like the status stamps, the outline
 * is the whole form of this component, so it has to hold 3:1 against white and
 * against the canvas rows it sits on.
 */
export function StagePill({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span
      className={cx(
        'ku-stamp border-meta border-l-3 border-l-orangy text-rich-black',
        className,
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** Payout state, stamped. Sits in a dense payouts table, so no dot. */
export function PayoutBadge({ status, size = 'sm' }: { status: PayoutStatus; size?: BadgeSize }) {
  const meta = PAYOUT_META[status];
  return <span className={stampClasses(meta.tone, size)}>{meta.label}</span>;
}

/**
 * Renders nothing when the request carries no SLA date. The icon is the one
 * mark that earns its keep here: it separates "running late" from "still on
 * time" without relying on colour alone.
 */
export function SlaChip({ dueOn, className }: { dueOn?: string; className?: string }) {
  const sla = slaState(dueOn);
  if (!sla) return null;

  const Icon = sla.overdue ? AlertTriangle : Clock;
  return (
    <span
      className={cx(stampClasses(sla.tone, 'sm'), 'tnum', sla.overdue && 'font-bold', className)}
      title={sla.overdue ? 'Past the review SLA for this desk' : 'Review SLA for this desk'}
    >
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      {sla.label}
    </span>
  );
}

/**
 * The struck stamp: 3px rule, angled, landing on the page as it mounts.
 *
 * This is the loudest mark in the system, so a page gets at most one -- on its
 * own primary artifact, once that artifact has settled (credited) or gone void
 * (rejected, failed). Anything else uses `StatusBadge`.
 */
export function Stamp({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  return (
    <span className={cx('ku-stamp-struck animate-stamp-in', TONE_CLASSES[tone].stamp, className)}>
      {label}
    </span>
  );
}
