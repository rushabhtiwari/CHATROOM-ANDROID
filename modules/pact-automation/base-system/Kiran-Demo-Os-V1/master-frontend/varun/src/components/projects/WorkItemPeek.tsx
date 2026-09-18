/**
 * The peek panel.
 *
 * Slides in from the right over whatever layout is behind it, roughly 45% wide,
 * with the list still visible and still scrolled where you left it. That is the
 * point of a peek rather than a route change: you keep your place.
 *
 * The full-page route at `/projects/:id/items/:itemId` renders the same body
 * for deep links — see `WorkItemPage`.
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';
import { displayId } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import { StateIcon } from './Glyphs';
import { WorkItemDetail } from './WorkItemDetail';

export const WorkItemPeek: React.FC<{
  itemId: string | null;
  onClose: () => void;
}> = ({ itemId, onClose }) => {
  const { state } = useProjects();
  const item = itemId ? state.workItems.byId[itemId] : undefined;
  const itemState = item ? state.states.byId[item.stateId] : undefined;

  // An id in the URL that no longer resolves — a deleted item, a stale link —
  // closes the panel rather than leaving an empty shell open.
  useEffect(() => {
    if (itemId && !item) onClose();
  }, [itemId, item, onClose]);

  if (!item) return null;

  return (
    <>
      {/* Click-catcher backdrop */}
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default bg-on-surface/20 backdrop-blur-[0.5px] transition-opacity"
      />

      <aside
        role="dialog"
        aria-label={`${displayId(state, item)} ${item.title}`}
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[720px] flex-col border-l border-outline-variant bg-surface-container-lowest shadow-2xl md:w-[720px]"
        style={{ animation: 'peek-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4">
          <div className="flex items-center gap-2 min-w-0">
            <StateIcon group={itemState?.group ?? 'backlog'} color={itemState?.color} />
            <span className="font-mono text-xs font-semibold text-primary select-all">
              {displayId(state, item)}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Link copied to clipboard');
              }}
              className="rounded p-1 text-outline hover:bg-surface-container hover:text-on-surface transition-colors"
              title="Copy issue link"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <span className="h-3.5 w-px bg-outline-variant mx-0.5" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant border border-outline-variant">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: itemState?.color ?? '#94A3B8' }} />
              {itemState?.name ?? 'Backlog'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Link
              to={`/projects/${item.projectId}/items/${item.id}`}
              title="Open as full page"
              className="rounded p-1.5 text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="rounded p-1.5 text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {/* Keyed on the item so switching rows resets scroll and local edit
              state rather than carrying one item's draft onto another. */}
          <WorkItemDetail key={item.id} item={item} onClose={onClose} />
        </div>
      </aside>
    </>
  );
};
