/**
 * The Table layout — one row per item, one column per property, every cell
 * editable in place.
 *
 * Columns come from the same Display toggles the other layouts use, so hiding
 * "Estimate" hides it here and on the cards. The header is sticky and the rows
 * are virtualised, because this is the layout people scroll furthest in.
 *
 * Arrow keys move a focus ring between cells and Enter opens that cell's
 * editor. The grid is a roving-tabindex rather than a real `role="grid"`: full
 * ARIA grid semantics would mean managing focus for every dropdown too, which
 * is a lot of machinery for a demo. Marked here as the thing that was skipped.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DisplayProperties } from '@/modules/projects/constants';
import { displayId, isOverdue } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import type { WorkItem, WorkItemGroup } from '@/modules/projects/types';
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

const ROW_HEIGHT = 38;

interface ColumnSpec {
  id: keyof DisplayProperties | 'title';
  label: string;
  width: number;
  /** Title is always shown; the rest follow the Display toggles. */
  always?: boolean;
}

const COLUMNS: ColumnSpec[] = [
  { id: 'itemId', label: 'ID', width: 78 },
  { id: 'title', label: 'Title', width: 380, always: true },
  { id: 'state', label: 'State', width: 132 },
  { id: 'priority', label: 'Priority', width: 116 },
  { id: 'assignee', label: 'Assignee', width: 152 },
  { id: 'labels', label: 'Labels', width: 168 },
  { id: 'dueDate', label: 'Due', width: 140 },
  { id: 'estimate', label: 'Estimate', width: 122 },
  { id: 'cycle', label: 'Cycle', width: 150 },
  { id: 'module', label: 'Module', width: 158 },
];

interface Props {
  projectId: string;
  items: WorkItem[];
  groups: WorkItemGroup[];
  display: DisplayProperties;
  childrenOf: (parentId: string) => WorkItem[];
  onOpen: (itemId: string) => void;
  activeItemId?: string | null;
}

export const TableLayout: React.FC<Props> = ({
  projectId,
  groups,
  display,
  onOpen,
  activeItemId,
}) => {
  const { state, updateWorkItem } = useProjects();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  // Mirror of `focus` for handlers that must read it without re-subscribing.
  const focusRef = useRef(focus);

  // The table ignores grouping and shows one flat, ordered list — a spreadsheet
  // with group headers in it stops being sortable by column.
  const rows = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const columns = useMemo(
    () => COLUMNS.filter((column) => column.always || display[column.id as keyof DisplayProperties]),
    [display],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 14,
  });

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        // Enter opens the focused cell's editor by clicking its trigger, which
        // keeps one code path for mouse and keyboard.
        scrollRef.current
          ?.querySelector<HTMLElement>(`[data-cell="${focusRef.current.row}-${focusRef.current.col}"] button`)
          ?.click();
        event.preventDefault();
        return;
      }

      const deltas: Record<string, [number, number]> = {
        ArrowDown: [1, 0],
        ArrowUp: [-1, 0],
        ArrowRight: [0, 1],
        ArrowLeft: [0, -1],
      };
      const delta = deltas[event.key];
      if (!delta) return;

      event.preventDefault();

      /*
       * Functional update, not `focus` from the closure.
       *
       * Holding an arrow key fires faster than React re-renders, so reading the
       * captured `focus` makes every repeat compute from the same stale cell and
       * the selection stutters instead of travelling.
       */
      setFocus((prev) => {
        const next = {
          row: Math.max(0, Math.min(prev.row + delta[0], rows.length - 1)),
          col: Math.max(0, Math.min(prev.col + delta[1], columns.length - 1)),
        };
        focusRef.current = next;
        virtualizer.scrollToIndex(next.row, { align: 'auto' });
        return next;
      });
    },
    [rows.length, columns.length, virtualizer],
  );

  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-[13px] text-muted">No work items match these filters.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="h-full overflow-auto focus:outline-none"
    >
      <div style={{ minWidth: totalWidth }}>
        {/* Sticky header */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-canvas">
          {columns.map((column) => (
            <div
              key={column.id}
              style={{ width: column.width }}
              className="shrink-0 px-2.5 py-2 text-[12px] font-semibold text-muted"
            >
              {column.label}
            </div>
          ))}
        </div>

        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = rows[virtualRow.index];
            const overdue = isOverdue(state, item);

            return (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  height: ROW_HEIGHT,
                  minWidth: totalWidth,
                }}
                className={`flex border-b border-line-2 ${
                  activeItemId === item.id ? 'bg-kiran-tint' : 'bg-white hover:bg-canvas'
                }`}
              >
                {columns.map((column, colIndex) => {
                  const focused = focus.row === virtualRow.index && focus.col === colIndex;

                  return (
                    <div
                      key={column.id}
                      data-cell={`${virtualRow.index}-${colIndex}`}
                      onMouseDown={() => {
                        const next = { row: virtualRow.index, col: colIndex };
                        focusRef.current = next;
                        setFocus(next);
                      }}
                      style={{ width: column.width }}
                      className={`flex shrink-0 items-center px-1.5 ${
                        focused ? 'ring-1 ring-inset ring-kiran' : ''
                      }`}
                    >
                      <Cell
                        column={column.id}
                        item={item}
                        projectId={projectId}
                        overdue={overdue}
                        onOpen={() => onOpen(item.id)}
                        itemId={displayId(state, item)}
                        onChange={(patch) => updateWorkItem(item.id, patch)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const Cell: React.FC<{
  column: ColumnSpec['id'];
  item: WorkItem;
  projectId: string;
  overdue: boolean;
  itemId: string;
  onOpen: () => void;
  onChange: (patch: Parameters<ReturnType<typeof useProjects>['updateWorkItem']>[1]) => void;
}> = ({ column, item, projectId, overdue, itemId, onOpen, onChange }) => {
  switch (column) {
    case 'itemId':
      return (
        <button
          type="button"
          onClick={onOpen}
          className="font-mono text-[12px] text-muted hover:text-kiran hover:underline"
        >
          {itemId}
        </button>
      );

    case 'title':
      return (
        <button
          type="button"
          onClick={onOpen}
          className="w-full truncate text-left text-[12.5px] text-ink hover:text-kiran"
          title={item.title}
        >
          {item.title}
        </button>
      );

    case 'state':
      return (
        <StatePicker
          projectId={projectId}
          value={item.stateId}
          onChange={(stateId) => onChange({ stateId })}
        />
      );

    case 'priority':
      return <PriorityPicker value={item.priority} onChange={(priority) => onChange({ priority })} />;

    case 'assignee':
      return (
        <AssigneePicker
          projectId={projectId}
          value={item.assigneeIds}
          onChange={(assigneeIds) => onChange({ assigneeIds })}
        />
      );

    case 'labels':
      return (
        <LabelPicker
          projectId={projectId}
          value={item.labelIds}
          onChange={(labelIds) => onChange({ labelIds })}
        />
      );

    case 'dueDate':
      return (
        <DatePicker
          value={item.dueDate}
          overdue={overdue}
          placeholder="—"
          onChange={(dueDate) => onChange({ dueDate })}
        />
      );

    case 'estimate':
      return <EstimatePicker value={item.estimate} onChange={(estimate) => onChange({ estimate })} />;

    case 'cycle':
      return (
        <CyclePicker
          projectId={projectId}
          value={item.cycleId}
          onChange={(cycleId) => onChange({ cycleId })}
        />
      );

    case 'module':
      return (
        <ModulePicker
          projectId={projectId}
          value={item.moduleId}
          onChange={(moduleId) => onChange({ moduleId })}
        />
      );

    default:
      return null;
  }
};
