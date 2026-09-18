import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cx } from '@/lib/format';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  loading?: boolean;
}

/**
 * Controls on a plant floor are hard-edged and keylined: a 2px rule holds every
 * button, and the primary carries a rich-black rim around the orange so it reads as a
 * machine control rather than a web pill.
 *
 * design.md §3.3 / §10 finding #1 — NEVER white text on orange. The primary fill
 * carries `text-rich-black` (6.9:1). Hover darkens with `brightness`, which keeps the
 * palette to the five approved brand colours.
 */
const PRIMARY_FILL =
  'border-rich-black bg-orangy text-rich-black hover:brightness-95 active:brightness-90';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: PRIMARY_FILL,
  secondary:
    'border-darkey-bluey bg-darkey-bluey text-white hover:border-navy-600 hover:bg-navy-600 ' +
    'active:border-navy-700 active:bg-navy-700',
  outline:
    'border-hairline-strong bg-white text-rich-black hover:border-rich-black hover:bg-canvas ' +
    'active:bg-canvas-deep',
  ghost: 'border-transparent bg-transparent text-rich-black hover:bg-canvas-deep',
  danger: 'border-washed bg-washed text-white hover:brightness-95 active:brightness-90',
  /*
    On a bill-passing desk the forward action is the brand's action, so `success` is the
    primary control under a second name — not a green-approve/red-reject SaaS pair.
    `st-green-ink` stays a status ink (the settled stamp, a credited row), never a
    button ground: one hue cannot mean both "press this" and "this is done".
    The name is kept because call sites depend on it.
  */
  success: PRIMARY_FILL,
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-body-s',
  md: 'h-10 gap-2 px-4 text-body-s',
  lg: 'h-12 gap-2.5 px-5 text-body',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

const ICON_ONLY_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

/**
 * Shared skeleton for both Button and IconButton. Radius stays at 0 — it is the
 * identity. Labels are sentence case in the sans face: this is a control, not a sign.
 */
const BASE =
  'inline-flex select-none items-center justify-center whitespace-nowrap border-2 font-sans ' +
  'font-semibold leading-none transition-all duration-150 active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0';

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  fullWidth,
  loading,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || Boolean(loading);
  const glyph = ICON_SIZE[size];

  return (
    <button
      type={type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading ? true : undefined}
      className={cx(
        BASE,
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth ? 'w-full' : '',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={glyph} className="animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={glyph} aria-hidden="true" />
      ) : null}
      {children}
      {!loading && IconRight ? <IconRight size={glyph} aria-hidden="true" /> : null}
    </button>
  );
}

/**
 * The full button surface minus `children` — an icon-only control has no text node, but
 * it still has to be able to say what it does: `aria-expanded` on a popover toggle,
 * `aria-controls`, `aria-pressed`, `id`, `form`. Sealing those off is what leaves a
 * bell or a collapse toggle unable to announce its state.
 */
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Icon-only control. Always renders both aria-label and title so it is never unlabelled. */
export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cx(BASE, ICON_ONLY_SIZE[size], VARIANT_CLASSES[variant], className)}
      {...rest}
    >
      <Icon size={ICON_SIZE[size]} aria-hidden="true" />
    </button>
  );
}
