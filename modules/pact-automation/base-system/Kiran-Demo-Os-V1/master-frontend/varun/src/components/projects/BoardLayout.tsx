/**
 * The Board layout — Kanban over whatever the current grouping is.
 *
 * Columns are the groups `useWorkItems` produced, so this is a board by state
 * by default and a board by assignee, priority, label, cycle or module the
 * moment you change Group by. Dragging a card between columns changes that
 * field, not just the state.
 *
 * Drag uses native HTML5 events rather than a library. The brief asked to try
 * that first, and for a board whose only gesture is "pick up a card, drop it in
 * a column" it is enough: `draggable`, a dataTransfer payload, and a drop
 * handler. What it does not give is a smooth reorder-within-column animation,
 * which this board does not need — order inside a column is driven by the
 * Order by dropdown, not by where you release the card.
 */

import React, { useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import type { DisplayProperties } from '@/modules/projects/constants';
import { UNGROUPED_ID } from '@/modules/projects/constants';
import { displayId, isOverdue } from '@/modules/projects/selectors';
import {
  canDragBetween,
  describeGroupMove,
  patchForGroupMove,
} from '@/modules/projects/groupMutation';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import type { GroupByField, WorkItem, WorkItemGroup } from '@/modules/projects/types';
import { AvatarStack, Dot, LabelChip, PriorityIcon, StateIcon } from './Glyphs';

/** What is being dragged, and which column it came from. */
interface DragPayload {
  itemId: string;
  fromGroupId: string;
}

interface Props {
  groups: WorkItemGroup[];
  groupBy: GroupByField;
  display: DisplayProperties;
  childrenOf: (parentId: string) => WorkItem[];
  onOpen: (itemId: string) => void;
  activeItemId?: string | null;
  onCreateInGroup: (groupId: string) => void;
}

export const BoardLayout: React.FC<Props> = ({
  groups,
  groupBy,
  display,
  childrenOf,
  onOpen,
  activeItemId,
  onCreateInGroup,
}) => {
  const { state, updateWorkItem } = useProjects();
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);

  const draggable = canDragBetween(groupBy);

  const handleDrop = (toGroupId: string) => {
    setOverGroupId(null);
    if (!drag) return;

    const item = state.workItems.byId[drag.itemId];
    setDrag(null);
    if (!item) return;

    const patch = patchForGroupMove(item, drag.fromGroupId, toGroupId, groupBy);
    if (!patch) return;

    updateWorkItem(item.id, patch);

    const label = groups.find((group) => group.id === toGroupId)?.label ?? '';
    // There is no undo on a drop, so the toast says what actually changed.
    toast.success(describeGroupMove(groupBy, label), {
      description: `${displayId(state, item)} · ${item.title}`,
    });
  };

  return (
    <div className="flex h-full gap-3 overflow-x-auto overflow-y-hidden px-4 py-3 bg-surface-container-low/20">
      {groups.map((group) => {
        const isOver = overGroupId === group.id && drag?.fromGroupId !== group.id;

        return (
          <section
            key={group.id}
            onDragOver={(event) => {
              if (!drag) return;
              // Without preventDefault the browser refuses the drop outright.
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (overGroupId !== group.id) setOverGroupId(group.id);
            }}
            onDragLeave={(event) => {
              // dragleave fires when crossing onto a child, so only clear when
              // the pointer has genuinely left the column.
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setOverGroupId((prev) => (prev === group.id ? null : prev));
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(group.id);
            }}
            className={`flex h-full w-[304px] shrink-0 flex-col rounded-xl border p-2 shadow-xs transition-colors ${
              isOver ? 'border-primary bg-surface-container-high/60' : 'border-outline-variant bg-surface-container-low/70'
            }`}
          >
            {/* Column header */}
            <header className="flex shrink-0 items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface-container-lowest/80 shadow-xs mb-2 border border-outline-variant">
              <div className="flex items-center gap-2 min-w-0">
                {group.color ? (
                  <Dot color={group.color} />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full border border-slate-300" />
                )}
                <h3 className="truncate text-xs font-semibold text-on-surface">
                  {group.label}
                </h3>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
                  {group.items.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onCreateInGroup(group.id)}
                title={`Create in ${group.label}`}
                aria-label={`Create work item in ${group.label}`}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </header>

            {/* Cards */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-2">
              {group.items.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  display={display}
                  draggable={draggable}
                  dragging={drag?.itemId === item.id}
                  active={activeItemId === item.id}
                  childCount={childrenOf(item.id).length}
                  itemId={displayId(state, item)}
                  overdue={isOverdue(state, item)}
                  stateName={state.states.byId[item.stateId]?.name ?? ''}
                  stateGroup={state.states.byId[item.stateId]?.group ?? 'backlog'}
                  stateColor={state.states.byId[item.stateId]?.color}
                  labels={item.labelIds.map((id) => state.labels.byId[id]).filter(Boolean)}
                  showState={groupBy !== 'state' && display.state}
                  onOpen={() => onOpen(item.id)}
                  onDragStart={() => setDrag({ itemId: item.id, fromGroupId: group.id })}
                  onDragEnd={() => {
                    setDrag(null);
                    setOverGroupId(null);
                  }}
                />
              ))}

              {group.items.length === 0 && (
                <p
                  className={`rounded-md border border-dashed px-3 py-6 text-center text-[11.5px] transition-colors ${
                    isOver
                      ? 'border-kiran text-kiran'
                      : 'border-line text-muted'
                  }`}
                >
                  {isOver ? 'Drop here' : 'Nothing here'}
                </p>
              )}
            </div>
          </section>
        );
      })}

      {!draggable && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-line bg-white px-3 py-1.5 text-[11.5px] text-muted shadow-card">
          Cards cannot be dragged while grouped by{' '}
          {groupBy === 'none' ? 'nothing' : 'created by'}.
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */

interface CardProps {
  item: WorkItem;
  display: DisplayProperties;
  draggable: boolean;
  dragging: boolean;
  active: boolean;
  childCount: number;
  itemId: string;
  overdue: boolean;
  stateName: string;
  stateGroup: 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';
  stateColor?: string;
  labels: { id: string; name: string; color: string }[];
  showState: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const Card: React.FC<CardProps> = ({
  item,
  display,
  draggable,
  dragging,
  active,
  childCount,
  itemId,
  overdue,
  stateName,
  stateGroup,
  stateColor,
  labels,
  showState,
  onOpen,
  onDragStart,
  onDragEnd,
}) => {
  const assignees = item.assigneeIds
    .map((id) => personById(id))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));

  return (
    <article
      draggable={draggable}
      onDragStart={(event) => {
        // Firefox refuses to start a drag unless dataTransfer carries something.
        event.dataTransfer.setData('text/plain', item.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
      className={`group rounded-lg border bg-surface-container-lowest p-2.5 text-left shadow-xs transition-all ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${dragging ? 'opacity-40' : 'hover:shadow-sm hover:border-outline-variant'} ${
        active ? 'border-primary ring-1 ring-primary/30' : 'border-outline-variant'
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold text-outline">{itemId}</span>
        <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100">
          <GripVertical className="h-3.5 w-3.5 text-outline" />
        </div>
      </div>

      <p
        className={`text-[12.5px] font-medium leading-snug mb-2 line-clamp-2 ${
          stateGroup === 'cancelled' ? 'text-outline line-through' : 'text-on-surface'
        }`}
      >
        {item.title}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-outline-variant">
        <div className="flex flex-wrap items-center gap-1.5">
          {display.priority && <PriorityIcon priority={item.priority} />}
          {showState && (
            <span className="inline-flex items-center gap-1 rounded bg-surface-container px-1.5 py-0.5 text-[10px] text-on-surface-variant font-medium">
              <StateIcon group={stateGroup} color={stateColor} className="h-2.5 w-2.5" />
              {stateName}
            </span>
          )}
          {display.labels &&
            labels.slice(0, 2).map((label) => (
              <LabelChip key={label.id} name={label.name} color={label.color} />
            ))}
          {display.estimate && item.estimate !== null && (
            <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant font-medium">
              {item.estimate}
            </span>
          )}
          {display.dueDate && item.dueDate && (
            <span
              className={`font-mono text-[10.5px] ${
                overdue ? 'font-semibold text-strand-red' : 'text-outline'
              }`}
            >
              {format(parseISO(item.dueDate), 'd MMM')}
            </span>
          )}
        </div>

        {display.assignee && <AvatarStack people={assignees} max={2} size="xs" />}
      </div>
    </article>
  );
};

/** Re-exported so the page can pre-fill the create modal for a column. */
export { UNGROUPED_ID };
