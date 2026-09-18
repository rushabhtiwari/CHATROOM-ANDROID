/**
 * The whole issue surface: header controls, the five layouts, the peek panel,
 * the analytics panel and the create modal.
 *
 * Extracted from the items page because the cycle and module screens show
 * exactly the same thing over a narrower set. Passing a scope rather than
 * copying the page is what guarantees a cycle's board behaves identically to
 * the project's board — including the filters, the grouping and every
 * keyboard shortcut.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DEFAULT_COLLAPSED_GROUPS, LAYOUTS } from '@/modules/projects/constants';
import { defaultsForGroup } from '@/modules/projects/groupMutation';
import { statesForProject } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import { useWorkItems } from '@/modules/projects/useWorkItems';
import type { WorkItemScope } from '@/modules/projects/useWorkItems';
import type { LayoutKind } from '@/modules/projects/types';
import { WorkItemToolbar } from './WorkItemToolbar';
import { ListLayout } from './ListLayout';
import { BoardLayout } from './BoardLayout';
import { TableLayout } from './TableLayout';
import { CalendarLayout } from './CalendarLayout';
import { TimelineLayout } from './TimelineLayout';
import { WorkItemPeek } from './WorkItemPeek';
import { AnalyticsPanel } from './AnalyticsPanel';
import { CreateWorkItemModal } from './CreateWorkItemModal';

interface Props {
  scope: WorkItemScope;
  /** Rendered above the layout — the cycle burndown sits here. */
  banner?: React.ReactNode;
  /** Layouts this screen offers. Defaults to all five. */
  available?: LayoutKind[];
}

export const WorkItemsView: React.FC<Props> = ({ scope, banner, available }) => {
  const { projectId, cycleId, moduleId } = scope;
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, createWorkItem } = useProjects();

  const view = useWorkItems(scope);

  /* ---------------- group and sub-item expansion ---------------- */

  // Cancelled work starts collapsed: worth being able to find, not worth two
  // screens of scroll on the way to the work that is live.
  const initialCollapsed = useMemo(() => {
    const cancelled = statesForProject(state, projectId)
      .filter((entry) => DEFAULT_COLLAPSED_GROUPS.includes(entry.group))
      .map((entry) => entry.id);
    return new Set(cancelled);
  }, [state, projectId]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(initialCollapsed);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  /**
   * Create-modal state. `null` is closed; a string is the group whose `+` was
   * pressed, so a new item lands in the column you clicked. The empty string
   * means opened from the keyboard or the Add Issue button, with no column.
   */
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  useEffect(() => {
    setCollapsedGroups(view.groupBy === 'state' ? initialCollapsed : new Set());
  }, [view.groupBy, initialCollapsed]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  /* ---------------- peek panel ---------------- */

  // The open item lives in the query string, so a peeked item is linkable and
  // survives a reload with the layout still scrolled where it was.
  const peekId = searchParams.get('peek');

  const openItem = useCallback(
    (itemId: string) => {
      setAnalyticsOpen(false);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('peek', itemId);
        return next;
      });
    },
    [setSearchParams],
  );

  const closePeek = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('peek');
      return next;
    });
  }, [setSearchParams]);

  /*
   * The command palette reaches this screen through the URL: `?create=1` opens
   * the create modal and `?layout=board` switches layout. Each is consumed and
   * removed, so a reload does not replay it.
   */
  useEffect(() => {
    const create = searchParams.get('create');
    const layout = searchParams.get('layout') as LayoutKind | null;
    if (!create && !layout) return;

    if (create) setCreatingIn('');
    if (layout && LAYOUTS.some((entry) => entry.id === layout)) view.setLayout(layout);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        next.delete('layout');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, view]);

  /* ---------------- creating ---------------- */

  const scopeDefaults = useMemo(
    () => ({
      ...(cycleId ? { cycleId } : {}),
      ...(moduleId ? { moduleId } : {}),
    }),
    [cycleId, moduleId],
  );

  /*
   * Memoised: the create modal resets its draft whenever this object's identity
   * changes, so a fresh object each render would clear the title on every
   * keystroke and make the modal untypeable.
   */
  const createDefaults = useMemo(() => {
    const fromGroup = creatingIn ? defaultsForGroup(view.groupBy, creatingIn) : {};
    const merged = { ...scopeDefaults, ...fromGroup };
    return Object.keys(merged).length > 0 ? merged : undefined;
  }, [creatingIn, view.groupBy, scopeDefaults]);

  /** The inline "+ New Issue" row under a group: one title, straight in. */
  const quickCreate = useCallback(
    (groupId: string | null, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      createWorkItem({
        projectId,
        title: trimmed,
        ...scopeDefaults,
        ...(groupId ? defaultsForGroup(view.groupBy, groupId) : {}),
      });
      toast.success('Issue created', { description: trimmed });
    },
    [createWorkItem, projectId, scopeDefaults, view.groupBy],
  );

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (typing) {
        if (event.key === 'Escape') target.blur();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (creatingIn !== null) return;

      const layoutIndex = ['1', '2', '3', '4', '5'].indexOf(event.key);
      if (layoutIndex >= 0) {
        const next = LAYOUTS[layoutIndex].id;
        if (available && !available.includes(next)) return;
        event.preventDefault();
        view.setLayout(next);
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        const search = document.querySelector<HTMLInputElement>('[data-projects-search]');
        if (search) search.focus();
        else document.querySelector<HTMLButtonElement>('[aria-label="Search issues"]')?.click();
        return;
      }

      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setCreatingIn('');
        return;
      }

      if (event.key === 'Escape') {
        if (peekId) closePeek();
        else if (analyticsOpen) setAnalyticsOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, peekId, closePeek, available, creatingIn, analyticsOpen]);

  const layoutProps = {
    groups: view.groups,
    groupBy: view.groupBy,
    display: view.display,
    childrenOf: view.childrenOf,
    onOpen: openItem,
    activeItemId: peekId,
    onCreateInGroup: setCreatingIn,
    onQuickCreate: quickCreate,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkItemToolbar
        projectId={projectId}
        view={view}
        available={available}
        onCreate={() => setCreatingIn('')}
        analyticsOpen={analyticsOpen}
        onToggleAnalytics={() => setAnalyticsOpen((prev) => !prev)}
      />

      {banner}

      <div className="relative min-h-0 flex-1">
        {view.layout === 'list' && (
          <ListLayout
            {...layoutProps}
            collapsedGroups={collapsedGroups}
            toggleGroup={toggleGroup}
            expandedItems={expandedItems}
            toggleItem={toggleItem}
          />
        )}

        {view.layout === 'board' && <BoardLayout {...layoutProps} />}

        {view.layout === 'table' && (
          <TableLayout {...layoutProps} projectId={projectId} items={view.items} />
        )}

        {view.layout === 'calendar' && (
          <CalendarLayout
            items={view.items}
            projectId={projectId}
            onOpen={openItem}
            activeItemId={peekId}
          />
        )}

        {view.layout === 'timeline' && (
          <TimelineLayout
            groups={view.groups}
            projectId={projectId}
            onOpen={openItem}
            activeItemId={peekId}
          />
        )}

        {analyticsOpen && !peekId && (
          <AnalyticsPanel projectId={projectId} items={view.items} onClose={() => setAnalyticsOpen(false)} />
        )}

        <WorkItemPeek itemId={peekId} onClose={closePeek} />
      </div>

      {/* Bottom Workspace Status & Shortcut Footer */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-outline-variant bg-surface-container-lowest px-4 text-outline select-none text-[11.5px]">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 font-medium text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-st-green-ink animate-pulse" />
            All workstreams synced
          </span>
          <span className="text-outline-variant">•</span>
          <span className="text-slate-500 font-mono text-[11px]">{view.items.length} work items active</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant bg-surface-container-low px-1 py-0.5 text-[10px] text-on-surface">J</kbd>
            <kbd className="rounded border border-outline-variant bg-surface-container-low px-1 py-0.5 text-[10px] text-on-surface">K</kbd>
            <span>Navigate</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant bg-surface-container-low px-1 py-0.5 text-[10px] text-on-surface">X</kbd>
            <span>Select</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant bg-surface-container-low px-1 py-0.5 text-[10px] text-on-surface">Space</kbd>
            <span>Preview</span>
          </span>
        </div>
      </div>

      <CreateWorkItemModal
        projectId={projectId}
        open={creatingIn !== null}
        defaults={createDefaults}
        onClose={() => setCreatingIn(null)}
      />
    </div>
  );
};
