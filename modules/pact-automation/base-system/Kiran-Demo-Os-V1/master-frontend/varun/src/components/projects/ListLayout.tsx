/**
 * The List layout.
 *
 * Rows under collapsible group headers. A header carries the group's glyph,
 * its name, a count and a `+` on the far right; every group ends in a
 * "+ New Issue" row that turns into an inline title field. A row is the state
 * icon, the item id, the title, and then the property pills right-aligned —
 * every one of them editable in place.
 *
 * Headers, rows, sub-item rows and the quick-add rows are flattened into one
 * virtualised list rather than one virtualiser per group, which is what keeps
 * scrolling smooth when a project has ninety items across six groups.
 */

import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, Plus } from 'lucide-react';
import type { DisplayProperties } from '@/modules/projects/constants';
import { displayId, isOverdue } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import type { GroupByField, WorkItem, WorkItemGroup } from '@/modules/projects/types';
import { GroupGlyph, StateIcon, SubItemCountPill } from './Glyphs';
import { ItemMenu } from './ItemMenu';
import { QuickAddRow } from './QuickAddRow';
import {
  AssigneePicker,
  CyclePicker,
  DatePicker,
  EstimatePicker,
  LabelPicker,
  ModulePicker,
  PriorityPicker,
  StatePicker,
} from './PropertyPickers';

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 36;
const QUICK_ADD_HEIGHT = 32;

type Entry =
  | { kind: 'header'; group: WorkItemGroup; collapsed: boolean }
  | { kind: 'row'; item: WorkItem; depth: number; expanded: boolean; childCount: number }
  | { kind: 'quickadd'; group: WorkItemGroup };

interface Props {
  groups: WorkItemGroup[];
  groupBy: GroupByField;
  childrenOf: (parentId: string) => WorkItem[];
  display: DisplayProperties;
  onOpen: (itemId: string) => void;
  /** Highlighted while its peek panel is open. */
  activeItemId?: string | null;
  collapsedGroups: Set<string>;
  toggleGroup: (groupId: string) => void;
  expandedItems: Set<string>;
  toggleItem: (itemId: string) => void;
  onCreateInGroup: (groupId: string) => void;
  onQuickCreate: (groupId: string | null, title: string) => void;
}

export const ListLayout: React.FC<Props> = ({
  groups,
  groupBy,
  childrenOf,
  display,
  onOpen,
  activeItemId,
  collapsedGroups,
  toggleGroup,
  expandedItems,
  toggleItem,
  onCreateInGroup,
  onQuickCreate,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];

    for (const group of groups) {
      const collapsed = collapsedGroups.has(group.id);
      out.push({ kind: 'header', group, collapsed });
      if (collapsed) continue;

      for (const item of group.items) {
        const children = childrenOf(item.id);
        const expanded = expandedItems.has(item.id);
        out.push({ kind: 'row', item, depth: 0, expanded, childCount: children.length });

        if (expanded) {
          for (const child of children) {
            out.push({ kind: 'row', item: child, depth: 1, expanded: false, childCount: 0 });
          }
        }
      }

      out.push({ kind: 'quickadd', group });
    }

    return out;
  }, [groups, collapsedGroups, expandedItems, childrenOf]);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const entry = entries[index];
      if (entry.kind === 'header') return HEADER_HEIGHT;
      if (entry.kind === 'quickadd') return QUICK_ADD_HEIGHT;
      return ROW_HEIGHT;
    },
    overscan: 12,
  });

  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-16 text-center">
        <div>
          <p className="text-[13px] font-medium text-slate-600">No issues match these filters.</p>
          <p className="mt-1 text-[12px] text-muted">
            Clear a filter above, or press{' '}
            <kbd className="rounded border border-line bg-canvas px-1 font-mono">C</kbd> to create one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const entry = entries[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {entry.kind === 'header' && (
                <GroupHeader
                  group={entry.group}
                  groupBy={groupBy}
                  collapsed={entry.collapsed}
                  onToggle={() => toggleGroup(entry.group.id)}
                  onCreate={() => onCreateInGroup(entry.group.id)}
                />
              )}
              {entry.kind === 'row' && (
                <Row
                  item={entry.item}
                  depth={entry.depth}
                  expanded={entry.expanded}
                  childCount={entry.childCount}
                  display={display}
                  active={activeItemId === entry.item.id}
                  onOpen={() => onOpen(entry.item.id)}
                  onToggleExpand={() => toggleItem(entry.item.id)}
                />
              )}
              {entry.kind === 'quickadd' && (
                <QuickAddRow
                  height={QUICK_ADD_HEIGHT}
                  onCreate={(title) => onQuickCreate(entry.group.id, title)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const GroupHeader: React.FC<{
  group: WorkItemGroup;
  groupBy: GroupByField;
  collapsed: boolean;
  onToggle: () => void;
  onCreate: () => void;
}> = ({ group, groupBy, collapsed, onToggle, onCreate }) => (
  <div
    style={{ height: HEADER_HEIGHT }}
    className="group/header flex w-full items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 hover:bg-surface-container transition-colors select-none"
  >
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
    >
      <ChevronRight
        className={`h-3.5 w-3.5 text-outline transition-transform duration-150 ${
          collapsed ? '' : 'rotate-90'
        }`}
      />
      <span className="flex h-3.5 w-3.5 items-center justify-center">
        <GroupGlyph groupBy={groupBy} group={group} />
      </span>
      <span className="truncate text-[12px] font-semibold text-on-surface-variant font-mono">
        {group.label}
      </span>
      <span className="font-mono text-[12px] text-outline bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant">
        {group.items.length}
      </span>
    </button>
    <button
      type="button"
      onClick={onCreate}
      title={`Add issue to ${group.label}`}
      aria-label={`Add issue to ${group.label}`}
      className="rounded p-1 text-outline hover:bg-surface-container-high hover:text-on-surface transition-colors"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  </div>
);

/* ------------------------------------------------------------------ */

interface RowProps {
  item: WorkItem;
  depth: number;
  expanded: boolean;
  childCount: number;
  display: DisplayProperties;
  active: boolean;
  onOpen: () => void;
  onToggleExpand: () => void;
}

const Row: React.FC<RowProps> = ({
  item,
  depth,
  expanded,
  childCount,
  display,
  active,
  onOpen,
  onToggleExpand,
}) => {
  const { state, updateWorkItem } = useProjects();
  const itemState = state.states.byId[item.stateId];
  const overdue = isOverdue(state, item);
  const patch = (changes: Parameters<typeof updateWorkItem>[1]) => updateWorkItem(item.id, changes);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
      style={{ height: ROW_HEIGHT, paddingLeft: 16 + depth * 20 }}
      className={`group flex cursor-pointer items-center justify-between gap-2 border-b border-outline-variant pr-3 transition-colors ${
        active
          ? 'bg-surface-container-low border-l-2 border-primary'
          : 'bg-surface-container-lowest hover:bg-surface-container-low/70'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <StateIcon group={itemState?.group ?? 'backlog'} color={itemState?.color} />
        </span>

        {display.itemId && (
          <span className="shrink-0 font-mono text-[12px] font-medium text-outline select-none">
            {displayId(state, item)}
          </span>
        )}

      {childCount > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
          aria-label={expanded ? 'Collapse sub-issues' : 'Expand sub-issues'}
          className="-ml-1 rounded p-0.5 text-slate-400 hover:bg-line hover:text-slate-700"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}

        <span
          className={`min-w-0 flex-1 truncate text-[13px] ${
            itemState?.group === 'cancelled' ? 'text-muted line-through' : 'text-on-surface group-hover:text-primary transition-colors'
          }`}
        >
          {item.title}
        </span>
      </div>

      {/* Right-aligned property pills — each swallows its own clicks */}
      <div className="flex shrink-0 items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
        {display.state && (
          <StatePicker projectId={item.projectId} value={item.stateId} variant="pill" onChange={(stateId) => patch({ stateId })} />
        )}
        {display.priority && (
          <PriorityPicker value={item.priority} variant="pill" onChange={(priority) => patch({ priority })} />
        )}
        {display.labels && (
          <LabelPicker projectId={item.projectId} value={item.labelIds} variant="pill" onChange={(labelIds) => patch({ labelIds })} />
        )}
        {display.startDate && (
          <DatePicker kind="start" value={item.startDate} variant="pill" max={item.dueDate} onChange={(startDate) => patch({ startDate })} />
        )}
        {display.dueDate && (
          <DatePicker kind="due" value={item.dueDate} variant="pill" overdue={overdue} min={item.startDate} onChange={(dueDate) => patch({ dueDate })} />
        )}
        {display.assignee && (
          <AssigneePicker projectId={item.projectId} value={item.assigneeIds} variant="pill" onChange={(assigneeIds) => patch({ assigneeIds })} />
        )}
        {display.cycle && (
          <CyclePicker projectId={item.projectId} value={item.cycleId} variant="pill" onChange={(cycleId) => patch({ cycleId })} />
        )}
        {display.module && (
          <ModulePicker projectId={item.projectId} value={item.moduleId} variant="pill" onChange={(moduleId) => patch({ moduleId })} />
        )}
        {display.estimate && (
          <EstimatePicker value={item.estimate} variant="pill" onChange={(estimate) => patch({ estimate })} />
        )}
        {display.subItemCount && childCount > 0 && (
          <SubItemCountPill count={childCount} expanded={expanded} onClick={onToggleExpand} />
        )}
        <ItemMenu item={item} />
      </div>
    </div>
  );
};
