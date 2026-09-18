import { cloneElement, forwardRef, Fragment, isValidElement, useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { cx } from '@/lib/format';

// Styled but deliberately non-functional form primitives — this is a UI shell, so
// nothing here validates, submits or persists.

/*
  A control here is a ruled line you write on, not a soft box: quiet sides, a heavy
  bottom rule that carries the state. That bottom rule is the only thing telling a
  reader this white ground is writable — the surfaces underneath (.ku-card, .ku-sheet,
  FilterBar) are white too — so it has to clear 3:1 against white on its own
  (WCAG 1.4.11). `meta` #5C6975 is 5.63:1; the old `hairline-strong` was 2.14:1.
  Focus deepens that rule to rich-black rather than swapping in orange, which at 2.34:1
  would have made the focused field harder to find than the resting one; the global 2px
  orange focus ring is what announces focus. An invalid field rules in red throughout.
*/
const CONTROL =
  'w-full min-w-0 border border-b-2 bg-white px-3 py-2 text-body text-rich-black ' +
  'placeholder:text-meta transition-colors duration-150 ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-meta';

// Kept apart from CONTROL so the two never collide: Tailwind resolves conflicting
// border-colour utilities by stylesheet order, not by the order written here.
const CONTROL_RULE =
  'border-hairline-strong border-b-meta hover:border-b-rich-black ' +
  'focus:border-b-rich-black disabled:border-b-hairline';

const CONTROL_RULE_INVALID =
  'border-washed border-b-washed hover:border-b-washed ' +
  'focus:border-washed focus:border-b-washed';

/** Value types that are figures, and so must be set in the mono instrument face. */
const FIGURE_TYPES = new Set([
  'number',
  'tel',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

function controlClass(invalid?: boolean, numeric?: boolean, className?: string): string {
  return cx(
    CONTROL,
    invalid ? CONTROL_RULE_INVALID : CONTROL_RULE,
    numeric ? 'ku-fig' : '',
    className,
  );
}

export function Label({
  htmlFor,
  children,
  required,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cx('block ku-eyebrow text-rich-black', className)}>
      {children}
      {required && (
        // link-on-light, not orangy: the marker has to survive on a white ground.
        <span aria-hidden="true" className="ml-1 text-link-on-light">
          *
        </span>
      )}
    </label>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; numeric?: boolean }
>(function Input({ className, invalid, numeric, ...props }, ref) {
  // Amounts, dates, phone numbers and UTRs are read as figures, never as prose.
  const isFigure =
    numeric ??
    (FIGURE_TYPES.has(String(props.type)) ||
      props.inputMode === 'numeric' ||
      props.inputMode === 'decimal');

  return (
    <input
      ref={ref}
      aria-invalid={invalid ? true : undefined}
      className={controlClass(invalid, isFigure, className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid ? true : undefined}
      className={controlClass(invalid, false, cx('min-h-[96px] resize-y', className))}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode; invalid?: boolean }
>(function Select({ className, children, invalid, ...props }, ref) {
  // The wrapper must carry a width, otherwise the `w-full` control collapses to its
  // minimum inside a flex row. Callers size the Select by sizing its container.
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        aria-invalid={invalid ? true : undefined}
        className={controlClass(invalid, false, cx('appearance-none pr-11', className))}
        {...props}
      >
        {children}
      </select>
      {/* The chevron sits behind its own keyline, the way a plate control is divided. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-px right-px flex w-9 items-center justify-center border-l border-hairline-strong text-meta"
      >
        <ChevronDown className="h-4 w-4" />
      </span>
    </div>
  );
});

/** The subset of the child's props the field wires up on the caller's behalf. */
type WiredControlProps = { id?: string; 'aria-describedby'?: string };

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  /** What went wrong and what to do about it — shown in place of the hint. */
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  /*
    The label used to point wherever the caller told it to, which meant that a caller who
    said nothing shipped a control with no accessible name at all — a screen reader on the
    HR and Accounts filter bars heard five unlabelled combo boxes. So the field names the
    control itself: `htmlFor` is now a caller's override, not a requirement. An id already
    on the child always wins, so a caller who wires it up by hand is never fought with.
  */
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const messageId = error || hint ? `${fieldId}-msg` : undefined;

  // A fragment holds no attributes, so it is the one element shape that cannot be wired.
  const wirable = isValidElement(children) && children.type !== Fragment;
  const childProps = wirable ? (children.props as WiredControlProps) : null;
  const wired: WiredControlProps = {};
  if (childProps) {
    // Only mint an id when the caller has not named the control — where `htmlFor` is
    // explicit the target may be nested (an input inside a prefix wrapper), and stamping
    // the same id on the wrapper would put a duplicate in the document.
    if (htmlFor === undefined && childProps.id === undefined) wired.id = fieldId;
    if (messageId && childProps['aria-describedby'] === undefined) {
      wired['aria-describedby'] = messageId;
    }
  }
  const control =
    wirable && (wired.id || wired['aria-describedby'])
      ? cloneElement(children as ReactElement<WiredControlProps>, wired)
      : children;

  return (
    <div className={cx('space-y-1.5', className)}>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      {control}
      {error ? (
        <p
          id={messageId}
          className="flex items-start gap-1.5 text-caption font-medium text-st-red-ink"
        >
          <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-caption text-meta">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
