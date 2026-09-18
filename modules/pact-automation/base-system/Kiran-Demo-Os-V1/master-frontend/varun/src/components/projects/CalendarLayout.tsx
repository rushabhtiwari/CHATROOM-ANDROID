/**
 * The Calendar layout — a month grid, items placed on their due date.
 *
 * Dragging an item to another day changes its due date. Items with no due date
 * cannot be placed, so their count is surfaced in the toolbar rather than being
 * silently dropped: a calendar that quietly hides a third of the backlog is how
 * a demo becomes a lie.
 */

import React, { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { displayId, isOverdue } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import type { WorkItem } from '@/modules/projects/types';
import { PriorityIcon, StateIcon } from './Glyphs';

/** ISO day for a Date, in local time — `toISOString` would shift the day. */
const isoDay = (date: Date): string => format(date, 'yyyy-MM-dd');

interface Props {
  items: WorkItem[];
  projectId: string;
  onOpen: (itemId: string) => void;
  activeItemId?: string | null;
}

export const CalendarLayout: React.FC<Props> = ({ items, onOpen, activeItemId }) => {
  const { state, updateWorkItem } = useProjects();
  const [cursor, setCursor] = useState<Date>(new Date());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  // A month grid always shows whole weeks, so it spills into the neighbouring
  // months at both ends.
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      }),
    [cursor],
  );

  /** Items bucketed by due date, so each cell is one map lookup. */
  const byDay = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const item of items) {
      if (!item.dueDate) continue;
      const list = map.get(item.dueDate);
      if (list) list.push(item);
      else map.set(item.dueDate, [item]);
    }
    return map;
  }, [items]);

  const drop = (iso: string) => {
    setOverDay(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;

    const item = state.workItems.byId[id];
    if (!item || item.dueDate === iso) return;

    updateWorkItem(id, { dueDate: iso });
    toast.success(`Due ${format(parseISO(iso), 'd MMM yyyy')}`, {
      description: `${displayId(state, item)} · ${item.title}`,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Month navigation */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
        <button
          type="button"
          onClick={() => setCursor((prev) => subMonths(prev, 1))}
          aria-label="Previous month"
          className="rounded p-1 text-slate-500 transition-colors hover:bg-canvas hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="min-w-[9rem] text-center font-display text-[13.5px] font-semibold text-ink">
          {format(cursor, 'MMMM yyyy')}
        </h3>
        <button
          type="button"
          onClick={() => setCursor((prev) => addMonths(prev, 1))}
          aria-label="Next month"
          className="rounded p-1 text-slate-500 transition-colors hover:bg-canvas hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCursor(new Date())}
          className="ml-1 rounded-md border border-line bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-canvas"
        >
          Today
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid shrink-0 grid-cols-7 border-b border-line bg-canvas">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div
            key={label}
            className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted"
          >
            {label}
          </div>
        ))}
      </div>

      {/* The grid */}
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
        {days.map((day) => {
          const iso = isoDay(day);
          const dayItems = byDay.get(iso) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const isOver = overDay === iso;

          return (
            <div
              key={iso}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (overDay !== iso) setOverDay(iso);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setOverDay((prev) => (prev === iso ? null : prev));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                drop(iso);
              }}
              className={`min-h-[92px] border-b border-r border-line-2 p-1 transition-colors ${
                isOver ? 'bg-kiran-tint' : inMonth ? 'bg-white' : 'bg-canvas/60'
              }`}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span
                  className={`text-[11px] ${
                    today
                      ? 'flex h-[18px] w-[18px] items-center justify-center rounded-full bg-kiran font-bold text-white'
                      : inMonth
                        ? 'text-slate-600'
                        : 'text-slate-300'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {dayItems.length > 3 && (
                  <span className="font-mono text-[9.5px] text-muted">{dayItems.length}</span>
                )}
              </div>

              <div className="space-y-0.5">
                {dayItems.slice(0, 4).map((item) => {
                  const itemState = state.states.byId[item.stateId];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', item.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDragId(item.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverDay(null);
                      }}
                      onClick={() => onOpen(item.id)}
                      title={`${displayId(state, item)} · ${item.title}`}
                      className={`flex w-full cursor-grab items-center gap-1 rounded border px-1 py-[2px] text-left active:cursor-grabbing ${
                        dragId === item.id ? 'opacity-40' : ''
                      } ${
                        activeItemId === item.id
                          ? 'border-kiran bg-kiran-tint'
                          : isOverdue(state, item)
                            ? 'border-red-200 bg-red-50'
                            : 'border-line bg-canvas hover:bg-line-2'
                      }`}
                    >
                      <PriorityIcon priority={item.priority} title={false} className="h-2.5 w-2.5" />
                      <StateIcon
                        group={itemState?.group ?? 'backlog'}
                        color={itemState?.color}
                        className="h-2.5 w-2.5"
                      />
                      <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink">
                        {item.title}
                      </span>
                    </button>
                  );
                })}

                {dayItems.length > 4 && (
                  <p className="px-1 text-[9.5px] text-muted">+{dayItems.length - 4} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Exported for the toolbar's "n undated" note. */
export const isSameDayExport = isSameDay;
