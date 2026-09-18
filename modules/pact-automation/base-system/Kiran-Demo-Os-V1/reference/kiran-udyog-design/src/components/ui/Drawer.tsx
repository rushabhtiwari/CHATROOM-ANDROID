import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cx } from '@/lib/format';
import { IconButton } from '@/components/ui/Button';

const WIDTHS: Record<'md' | 'lg' | 'xl', number> = { md: 480, lg: 640, xl: 800 };

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Right-side review panel: scrim, Escape, focus trap and body scroll lock.
 * Hard corners, a 3px navy rule along the top edge, a ruled head and a ruled action
 * tray — the panel reads as a plate laid over the page, not a floating card.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  docket,
  width = 'lg',
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Small stamped label above the title — what kind of thing is under review. */
  eyebrow?: string;
  /** A claim / payout identifier, set in the docket face beside the title. */
  docket?: string;
  width?: 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape closes. Separate from the focus effect because `onClose` is usually an inline
  // arrow in the caller, so this effect re-runs on every render of the page.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Focus moves into the panel, stays trapped inside it, and returns where it came from.
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('keydown', onTab);
      returnTo?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-rich-black/60" />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width: WIDTHS[width] }}
        className={cx(
          'absolute inset-y-0 right-0 flex max-w-full flex-col bg-white',
          'border-l border-hairline border-t-3 border-t-darkey-bluey',
          'animate-slide-in-right focus:outline-none',
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline bg-white px-6 py-4">
          <div className="min-w-0">
            {eyebrow ? <p className="ku-eyebrow mb-1.5">{eyebrow}</p> : null}
            <h2
              id={titleId}
              className="ku-wide font-display text-h3 font-semibold leading-tight text-rich-black"
            >
              {title}
            </h2>
            {docket ? <p className="ku-docket mt-1.5">{docket}</p> : null}
            {subtitle ? <p className="mt-1.5 text-body-s text-meta">{subtitle}</p> : null}
          </div>
          <IconButton icon={X} label="Close panel" size="sm" onClick={onClose} />
        </header>

        <div className="ku-scrollbar flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-hairline bg-canvas px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
