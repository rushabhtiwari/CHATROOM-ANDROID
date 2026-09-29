import React from 'react';
import { cn } from '@/lib/utils';
import { useCloseOnBack } from '~/native/back-button';
import { tap } from '~/native/haptics';

/**
 * A bottom sheet: the phone's menu and its small form.
 *
 * Tapping the dimmed backdrop closes it, as it does everywhere on iOS; taps
 * inside do not fall through. Android's back button closes it too.
 */
export function Sheet({
  onClose,
  title,
  children,
  label,
}: {
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  label?: string;
}) {
  useCloseOnBack(onClose);
  return (
    <div
      className="absolute inset-0 z-40 flex items-end bg-ink/30"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        className="max-h-[85%] w-full animate-sheet-up overflow-y-auto rounded-t-2xl bg-surface pb-safe-bottom"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-slate-200" aria-hidden />
        {title && (
          <h2 className="px-4 pb-1 pt-3 text-center text-[15px] font-semibold text-ink">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}

/** One choice in a sheet. */
export function SheetButton({
  onClick,
  children,
  tone = 'default',
  icon,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'brand' | 'danger';
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        tap();
        onClick();
      }}
      className={cn(
        'flex min-h-touch w-full items-center gap-3 border-t border-line px-4 text-left text-[15px] font-medium active:bg-slate-100 disabled:opacity-40',
        tone === 'brand' && 'text-brand',
        tone === 'danger' && 'text-destructive',
        tone === 'default' && 'text-ink',
      )}
    >
      {icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
}

/** A yes/no question that cannot be undone by accident. */
export function ConfirmSheet({
  title,
  detail,
  confirm,
  onConfirm,
  onClose,
}: {
  title: string;
  detail?: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} title={title}>
      {detail && <p className="px-6 pb-3 text-center text-[13px] text-slate-500">{detail}</p>}
      <SheetButton
        tone="danger"
        onClick={() => {
          onConfirm();
          onClose();
        }}
      >
        <span className="block text-center">{confirm}</span>
      </SheetButton>
      <SheetButton onClick={onClose}>
        <span className="block text-center">Cancel</span>
      </SheetButton>
    </Sheet>
  );
}
