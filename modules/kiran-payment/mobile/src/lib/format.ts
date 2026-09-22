/**
 * Phone-sized formatting.
 *
 * The console has room to spell things out. A 390pt list row does not, so
 * these are deliberately terser than `@/lib/time` and `@/modules/rts/format`,
 * which stay in use wherever the width allows.
 */

const DAY = 86_400_000;

/** "09:42", "Yesterday", "Mon", "14 Aug" — whichever is shortest and unambiguous. */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);

  if (timestamp >= startOfToday) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (timestamp >= startOfToday - DAY) return 'Yesterday';
  if (timestamp >= startOfToday - 6 * DAY) {
    return date.toLocaleDateString('en-IN', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Indian-format currency, abbreviated.
 *
 * Order values here run to crores. Writing 48,50,000 into a card that also has
 * to carry a customer name and a product costs more width than the extra
 * precision is worth, so anything above a lakh is abbreviated.
 */
export function compactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

/** Quantities run to hundreds of thousands of metres. */
export function compactQty(value: number, uom?: string): string {
  const formatted =
    Math.abs(value) >= 100_000
      ? `${(value / 1000).toFixed(0)}k`
      : value.toLocaleString('en-IN');
  return uom ? `${formatted} ${uom}` : formatted;
}

/** "25 Aug" / "25 Aug 2026" when the year is not the current one. */
export function shortDate(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
