/**
 * What it means to move a work item into a group.
 *
 * The board's columns are whatever the current `groupBy` produces, so dropping
 * a card is not "change the state" — it is "give this item the value that this
 * column stands for". Grouped by assignee, dropping reassigns; grouped by
 * priority, it re-prioritises. Same gesture, different field.
 *
 * Kept separate from `selectors.ts` because this is the only place in the module
 * that turns a *view* concept back into a *data* change, and it is worth being
 * able to find.
 */

import { UNGROUPED_ID } from './constants';
import type { GroupByField, Priority, WorkItem } from './types';
import type { WorkItemPatch } from './store';

/**
 * Fields a card cannot be dragged between.
 *
 * "Created by" is history — you cannot make someone else have created an item —
 * and "none" is a single column with nowhere to drag to.
 */
export const IMMOVABLE_GROUPINGS: GroupByField[] = ['createdBy', 'none'];

export const canDragBetween = (groupBy: GroupByField): boolean =>
  !IMMOVABLE_GROUPINGS.includes(groupBy);

/**
 * The patch that moves `item` out of `fromGroupId` and into `toGroupId`.
 *
 * Returns null when the move is meaningless or not allowed, so the caller can
 * refuse the drop rather than dispatching a no-op that still writes an activity
 * entry.
 */
export function patchForGroupMove(
  item: WorkItem,
  fromGroupId: string,
  toGroupId: string,
  groupBy: GroupByField,
): WorkItemPatch | null {
  if (fromGroupId === toGroupId) return null;
  if (!canDragBetween(groupBy)) return null;

  const target = toGroupId === UNGROUPED_ID ? null : toGroupId;

  switch (groupBy) {
    case 'state':
      // A work item always has a state, so there is no "no state" column to
      // drop into.
      return target ? { stateId: target } : null;

    case 'priority':
      return { priority: (target ?? 'none') as Priority };

    case 'cycle':
      return { cycleId: target };

    case 'module':
      return { moduleId: target };

    /*
     * Assignee and label hold lists, so a move is a swap rather than a
     * replacement: drop the column you came from, add the one you landed on,
     * and leave every other value alone.
     *
     * Replacing the whole list would silently unassign an item's second owner
     * because you dragged it under the first one's name.
     */
    case 'assignee': {
      const without = item.assigneeIds.filter((id) => id !== fromGroupId);
      if (!target) return { assigneeIds: without };
      return {
        assigneeIds: without.includes(target) ? without : [...without, target],
      };
    }

    case 'label': {
      const without = item.labelIds.filter((id) => id !== fromGroupId);
      if (!target) return { labelIds: without };
      return { labelIds: without.includes(target) ? without : [...without, target] };
    }

    default:
      return null;
  }
}

/**
 * The properties a new item should start with when created from a column's `+`.
 *
 * Creating into the "In Progress" column and getting a Todo item is the kind of
 * small dishonesty that makes a board feel untrustworthy.
 */
export function defaultsForGroup(
  groupBy: GroupByField,
  groupId: string,
): Partial<{
  stateId: string;
  priority: Priority;
  assigneeIds: string[];
  labelIds: string[];
  cycleId: string | null;
  moduleId: string | null;
}> {
  if (groupId === UNGROUPED_ID) return {};

  switch (groupBy) {
    case 'state':
      return { stateId: groupId };
    case 'priority':
      return { priority: groupId as Priority };
    case 'assignee':
      return { assigneeIds: [groupId] };
    case 'label':
      return { labelIds: [groupId] };
    case 'cycle':
      return { cycleId: groupId };
    case 'module':
      return { moduleId: groupId };
    default:
      return {};
  }
}

/**
 * A short human name for the change a drop will make, for the toast.
 *
 * Drag-and-drop has no undo here, so the confirmation has to say what actually
 * happened — "moved to In Progress", not "updated".
 */
export function describeGroupMove(groupBy: GroupByField, groupLabel: string): string {
  switch (groupBy) {
    case 'state':
      return `Moved to ${groupLabel}`;
    case 'priority':
      return `Priority set to ${groupLabel}`;
    case 'assignee':
      return `Assigned to ${groupLabel}`;
    case 'label':
      return `Labelled ${groupLabel}`;
    case 'cycle':
      return `Added to ${groupLabel}`;
    case 'module':
      return `Added to ${groupLabel}`;
    default:
      return 'Updated';
  }
}
