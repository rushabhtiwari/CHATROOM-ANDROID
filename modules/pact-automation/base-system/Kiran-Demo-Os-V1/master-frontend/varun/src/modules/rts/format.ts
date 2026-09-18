// Single source of truth for number, currency and date presentation.
// Never call toLocaleString / new Intl.* directly inside a component.

/** Fixed "today" so the demo's relative dates never drift. */
export const DEMO_TODAY = new Date('2026-08-31T10:30:00+05:30');

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrCompactGroups = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** `formatCurrency(124500)` -> `₹1,24,500` (Indian digit grouping). */
export function formatCurrency(value: number): string {
  return inr.format(Math.round(value)).replace(/\s/g, '');
}

/** Amount without the symbol, e.g. `1,24,500`. Use inside a column that already shows ₹. */
export function formatAmount(value: number): string {
  return inrCompactGroups.format(Math.round(value));
}

/** `formatCompactCurrency(1245000)` -> `₹12.45L`. For KPI tiles and axis ticks. */
export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2).replace(/\.00$/, '')}Cr`;
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2).replace(/\.00$/, '')}L`;
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return formatCurrency(value);
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** `formatDate('2026-08-14')` -> `14 Aug 2026`. */
export function formatDate(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** `formatDateShort('2026-08-14')` -> `14 Aug`. */
export function formatDateShort(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** `formatDateTime(...)` -> `14 Aug 2026, 4:20 PM`. */
export function formatDateTime(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(d)}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

/** `formatDateRange({from,to})` -> `12 – 15 Aug 2026`. */
export function formatDateRange(range?: { from: string; to: string }): string {
  if (!range) return '—';
  const from = toDate(range.from);
  const to = toDate(range.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '—';
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `${from.getDate()} – ${formatDate(to)}`
    : `${formatDate(from)} – ${formatDate(to)}`;
}

/** `formatRelative(...)` -> `2h ago`, `Yesterday`, `4d ago`, `on 12 Jul 2026`. */
export function formatRelative(value: string | Date, now: Date = DEMO_TODAY): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `on ${formatDate(d)}`;
}

/** Whole days from `now` until `value`. Negative when the date has passed. */
export function daysUntil(value: string | Date, now: Date = DEMO_TODAY): number {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return 0;
  const startOf = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((startOf(d) - startOf(now)) / 86400000);
}

export interface SlaState {
  label: string;
  tone: 'grey' | 'blue' | 'amber' | 'red' | 'green';
  overdue: boolean;
}

/** SLA chip copy: `Overdue by 2d` / `Due today` / `Due in 3d`. */
export function slaState(dueOn?: string, now: Date = DEMO_TODAY): SlaState | null {
  if (!dueOn) return null;
  const days = daysUntil(dueOn, now);
  if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, tone: 'red', overdue: true };
  if (days === 0) return { label: 'Due today', tone: 'amber', overdue: false };
  if (days === 1) return { label: 'Due tomorrow', tone: 'amber', overdue: false };
  return { label: `Due in ${days}d`, tone: 'blue', overdue: false };
}

/** `initials('Rohan Deshmukh')` -> `RD`. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** `formatPercent(0.436)` -> `44%`. Input is a 0–1 ratio. */
export function formatPercent(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** `formatFileSize(1480)` -> `1.4 MB`. Input is kilobytes. */
export function formatFileSize(sizeKb: number): string {
  return sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${Math.round(sizeKb)} KB`;
}

/**
 * Defence-in-depth: never render a full account number even if seed data slips.
 * `maskAccount('50100244317417')` -> `XXXX XXXX 7417`.
 */
export function maskAccount(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return value;
  return `XXXX XXXX ${digits.slice(-4)}`;
}

/** Joins truthy class names. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
