/**
 * The status tone map — LEDGERDESIGNSYSTEM.md §2.3.
 *
 * Five tones, each carrying three values with exactly one job each:
 *
 *   stamp  the outline AND the letters of a stamp; the left spine on a row
 *   solid  a 1px-wide solid spine down the leading edge of a list row
 *   bg     a whole-row/whole-block tint for a callout that needs a ground
 *   rule   the 3px cap on a stat cell
 *
 * `-line` is deliberately absent from anything interactive: at ~2:1 it fails
 * WCAG 1.4.11 as the border of a control. It is only ever a soft divider
 * inside an already-tinted block.
 *
 * Everything status-coloured in the console resolves through here, so a status
 * colour is never hand-rolled at a call site again.
 */
export type Tone = 'grey' | 'blue' | 'amber' | 'red' | 'green';

export const TONE = {
  grey:  { stamp: 'border-st-grey-ink text-st-grey-ink',   solid: 'bg-st-grey-ink',   bg: 'bg-st-grey-bg',   line: 'border-st-grey-line',   rule: '' },
  blue:  { stamp: 'border-st-blue-ink text-st-blue-ink',   solid: 'bg-st-blue-ink',   bg: 'bg-st-blue-bg',   line: 'border-st-blue-line',   rule: '' },
  amber: { stamp: 'border-st-amber-ink text-st-amber-ink', solid: 'bg-st-amber-ink',  bg: 'bg-st-amber-bg',  line: 'border-st-amber-line',  rule: '' },
  red:   { stamp: 'border-st-red-ink text-st-red-ink',     solid: 'bg-st-red-ink',    bg: 'bg-st-red-bg',    line: 'border-st-red-line',    rule: '' },
  green: { stamp: 'border-st-green-ink text-st-green-ink', solid: 'bg-st-green-ink',  bg: 'bg-st-green-bg',  line: 'border-st-green-line',  rule: '' },
} as const satisfies Record<Tone, Record<string, string>>;

/**
 * Resolve a free-text operational status to a tone.
 *
 * The console's statuses arrive as human strings from a dozen modules, so the
 * mapping lives here rather than being re-derived per page. Anything unknown
 * falls to `grey` — a status with no verdict attached should not borrow one.
 */
const TONE_BY_STATUS: Record<string, Tone> = {
  // Settled — the record is done and correct.
  'on track': 'green', won: 'green', accepted: 'green', delivered: 'green',
  acknowledged: 'green', matched: 'green', active: 'green', completed: 'green',
  approved: 'green', 'posted to pact': 'green', credited: 'green', settled: 'green',
  paid: 'green', reconciled: 'green', cleared: 'green', resolved: 'green',
  passed: 'green', healthy: 'green', online: 'green', connected: 'green',

  // In motion, or wanting attention that is not yet a failure.
  'at risk': 'amber', 'in production': 'amber', 'under review': 'amber',
  negotiation: 'amber', 'under negotiation': 'amber', 'partially executed': 'amber',
  sent: 'amber', 'sld generated': 'amber', 'asn linked': 'amber',
  'feedback awaited': 'amber', costing: 'amber', warning: 'amber',
  'awaiting approval': 'amber', 'awaiting hod': 'amber', 'pending hod': 'amber',
  'needs review': 'amber', pending: 'amber', 'in flight': 'amber',
  'partially paid': 'amber', hold: 'amber', 'on hold': 'amber',

  // Failed, refused or void.
  overdue: 'red', lost: 'red', rejected: 'red', delayed: 'red',
  'no response - 3 days': 'red', exception: 'red', failed: 'red', blocked: 'red',
  'stop dispatch blocked': 'red', breached: 'red', error: 'red', refused: 'red',
  cancelled: 'red', canceled: 'red', disconnected: 'red', offline: 'red',

  // In progress in the system's own machinery — a position, not a verdict.
  submitted: 'blue', processing: 'blue', 'in progress': 'blue', running: 'blue',
  'in batch': 'blue', open: 'blue', new: 'blue', scheduled: 'blue', synced: 'blue',

  // No verdict yet, or the record is out of play.
  closed: 'grey', draft: 'grey', queued: 'grey', archived: 'grey',
  inactive: 'grey', unknown: 'grey', 'not started': 'grey', backlog: 'grey',
};

/**
 * Sentence case for a status word arriving from the server: "Not An Order" reads
 * "Not an order", "AWAITING ADMIN" reads "Awaiting admin". Short all-caps tokens
 * (PACT, KPAC, PO, OCR) are left alone.
 */
const ACRONYMS = new Set(['PACT', 'KPAC', 'PO', 'OCR', 'PDF', 'SPF', 'DKIM', 'DMARC', 'AI', 'HR', 'ERP', 'GST']);
export const sentenceCase = (label?: string | null): string => {
  const words = String(label ?? '').replace(/_/g, ' ').trim().split(/\s+/);
  return words
    .map((word, index) => {
      if (ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
      const lower = word.toLowerCase();
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
};

export const toneForStatus = (status?: string | null): Tone =>
  TONE_BY_STATUS[String(status ?? '').trim().toLowerCase()] ?? 'grey';
