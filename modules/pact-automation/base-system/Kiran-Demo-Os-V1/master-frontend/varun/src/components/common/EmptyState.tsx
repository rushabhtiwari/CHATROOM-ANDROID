import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from '../ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  statement: string;
  instruction?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * An empty surface is an invitation, not an apology — LEDGERDESIGNSYSTEM.md §5.10.
 *
 * Left-aligned and set like the head of a blank ledger page: an accent tick, a
 * small mono label, then the instruction. A centred icon in a grey circle,
 * inside a dashed box, is the exact thing this system exists to remove.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  statement,
  instruction,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div className={`flex w-full flex-col items-start px-6 py-14 text-left ${className}`}>
      <span aria-hidden className="block h-0.5 w-7 origin-left animate-rule-in bg-accent" />

      <div className="mt-3.5 flex items-center gap-2">
        <Icon aria-hidden size={13} className="shrink-0 text-hairline-strong" />
        <span className="ku-eyebrow">Nothing on file</span>
      </div>

      <p className="mt-2 font-display text-h3 font-semibold text-ink">{statement}</p>

      {instruction && (
        <p className="mt-2 max-w-[54ch] text-body-s leading-relaxed text-meta">{instruction}</p>
      )}

      {actionLabel && onAction && (
        <div className="mt-6">
          <Button type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
