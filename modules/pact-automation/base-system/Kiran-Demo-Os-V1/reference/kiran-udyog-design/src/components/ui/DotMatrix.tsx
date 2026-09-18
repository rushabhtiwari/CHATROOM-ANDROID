import { cx } from '@/lib/format';

/**
 * The dot-matrix texture from design.md §7 — a brand device, used at most once per page,
 * on that page's own primary artifact. It is a texture, never a graphic: it must read as
 * a faint tone on the paper, so it defaults to 7% and never renders at full strength.
 *
 * `.ku-dots` paints dots in `currentColor` at a 24px pitch, so callers set the colour with
 * `text-*` and the size and position with their own className — e.g.
 * `className="absolute right-0 top-0 h-24 w-40 text-darkey-bluey"`.
 *
 * Opacity resolution, in order: the `opacity` prop wins; otherwise an `opacity-*` class in
 * `className` is left to govern; otherwise the quiet 0.07 default applies. Purely
 * decorative, so it is hidden from assistive technology.
 */
export function DotMatrix({ className, opacity }: { className?: string; opacity?: number }) {
  const hasOpacityClass = className ? /(^|\s)opacity-/.test(className) : false;
  const resolved = opacity ?? (hasOpacityClass ? undefined : 0.07);

  return (
    <div
      aria-hidden="true"
      className={cx('ku-dots pointer-events-none select-none', className)}
      style={resolved === undefined ? undefined : { opacity: resolved }}
    />
  );
}
