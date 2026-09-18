/**
 * The Timeline layout — a Gantt over the current grouping.
 *
 * Bars run from start date to due date, grouped by whatever Group by is set to,
 * with a scrollable date axis and a today marker. Dragging a bar moves both
 * dates; dragging either edge resizes that end.
 *
 * Drag here is pointer events rather than HTML5 drag-and-drop. HTML5 drag is
 * built for "pick this up and drop it on that", and gives no usable coordinate
 * stream while dragging — which is exactly what a Gantt needs, because the bar
 * has to follow the cursor and snap to days as it goes. Pointer capture gives
 * that in a dozen lines.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isFirstDayOfMonth,
  isWeekend,
  parseISO,
  startOfDay,
} from 'date-fns';
import { toast } from 'sonner';
import { displayId, timelineBars } from '@/modules/projects/selectors';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import type { WorkItem, WorkItemGroup } from '@/modules/projects/types';
import { AvatarStack, PriorityIcon } from './Glyphs';

/** Pixels per day. Wide enough that a one-day bar is still grabbable. */
const DAY_WIDTH = 26;
const ROW_HEIGHT = 32;
const LABEL_WIDTH = 268;

type DragMode = 'move' | 'start' | 'end';

interface DragState {
  itemId: string;
  mode: DragMode;
  /** Cursor x when the drag began. */
  originX: number;
  /** The bar's dates when the drag began. */
  fromStart: string;
  fromEnd: string;
  /** Days shifted so far, snapped. */
  deltaDays: number;
}

interface Props {
  groups: WorkItemGroup[];
  projectId: string;
  onOpen: (itemId: string) => void;
  activeItemId?: string | null;
}

const iso = (date: Date): string => format(date, 'yyyy-MM-dd');

export const TimelineLayout: React.FC<Props> = ({ groups, onOpen, activeItemId }) => {
  const { state, updateWorkItem } = useProjects();
  const [drag, setDrag] = useState<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ---------------- the date axis ---------------- */

  const { days, axisStart } = useMemo(() => {
    const all = groups.flatMap((group) => timelineBars(group.items));
    const today = startOfDay(new Date());

    if (all.length === 0) {
      const start = addDays(today, -14);
      return {
        days: eachDayOfInterval({ start, end: addDays(today, 30) }),
        axisStart: start,
      };
    }

    // A fortnight of padding at each end, so a bar is never flush against the
    // edge and there is somewhere to drag it to.
    const earliest = all.reduce((min, bar) => (bar.start < min ? bar.start : min), all[0].start);
    const latest = all.reduce((max, bar) => (bar.end > max ? bar.end : max), all[0].end);

    const start = addDays(parseISO(earliest), -14);
    const end = addDays(parseISO(latest), 14);

    return { days: eachDayOfInterval({ start, end }), axisStart: start };
  }, [groups]);

  const dayIndex = useCallback(
    (isoDay: string) => differenceInCalendarDays(parseISO(isoDay), axisStart),
    [axisStart],
  );

  const todayOffset = differenceInCalendarDays(startOfDay(new Date()), axisStart);

  /*
   * Open on today rather than on the far left of the axis.
   *
   * The axis spans every dated item in the project, which for a programme that
   * began in June means the first thing you see is two months of empty track.
   * Today is what someone opening a Gantt is looking for.
   */
  /*
   * Set when a drag actually moved the bar, and cleared by the click that
   * follows it.
   *
   * A bar is both draggable and clickable, and the browser fires `click` after
   * `pointerup` regardless. Checking the drag state is not enough because it has
   * already been cleared by then — so finishing a drag would also open the peek
   * panel for the item you were only trying to reschedule.
   */
  const justDragged = useRef(false);

  const scrolledOnce = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledOnce.current || todayOffset < 0) return;
    scrolledOnce.current = true;
    el.scrollLeft = Math.max(0, todayOffset * DAY_WIDTH - el.clientWidth / 3);
  }, [todayOffset]);

  /* ---------------- dragging ---------------- */

  const beginDrag = (event: React.PointerEvent, item: WorkItem, mode: DragMode, bar: { start: string; end: string }) => {
    event.stopPropagation();
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({
      itemId: item.id,
      mode,
      originX: event.clientX,
      fromStart: bar.start,
      fromEnd: bar.end,
      deltaDays: 0,
    });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    // Snap to whole days as the cursor moves; a Gantt bar that lands between
    // two days is not a date.
    const deltaDays = Math.round((event.clientX - drag.originX) / DAY_WIDTH);
    if (deltaDays !== drag.deltaDays) setDrag({ ...drag, deltaDays });
  };

  const endDrag = () => {
    if (!drag) return;
    const { itemId, mode, fromStart, fromEnd, deltaDays } = drag;
    setDrag(null);
    if (deltaDays === 0) return;
    justDragged.current = true;

    const item = state.workItems.byId[itemId];
    if (!item) return;

    const shifted = (value: string) => iso(addDays(parseISO(value), deltaDays));

    if (mode === 'move') {
      updateWorkItem(itemId, { startDate: shifted(fromStart), dueDate: shifted(fromEnd) });
      toast.success(`Moved ${deltaDays > 0 ? 'forward' : 'back'} ${Math.abs(deltaDays)}d`, {
        description: `${displayId(state, item)} · ${item.title}`,
      });
      return;
    }

    if (mode === 'start') {
      const next = shifted(fromStart);
      // Refuse to drag the start past the end rather than silently swapping them.
      if (next > fromEnd) return;
      updateWorkItem(itemId, { startDate: next });
    } else {
      const next = shifted(fromEnd);
      if (next < fromStart) return;
      updateWorkItem(itemId, { dueDate: next });
    }

    toast.success('Dates updated', {
      description: `${displayId(state, item)} · ${item.title}`,
    });
  };

  /** The bar's live geometry, including any in-flight drag. */
  const geometry = (item: WorkItem, bar: { start: string; end: string }) => {
    let startIndex = dayIndex(bar.start);
    let endIndex = dayIndex(bar.end);

    if (drag?.itemId === item.id) {
      if (drag.mode === 'move') {
        startIndex += drag.deltaDays;
        endIndex += drag.deltaDays;
      } else if (drag.mode === 'start') {
        startIndex = Math.min(startIndex + drag.deltaDays, endIndex);
      } else {
        endIndex = Math.max(endIndex + drag.deltaDays, startIndex);
      }
    }

    return {
      left: startIndex * DAY_WIDTH,
      width: Math.max(DAY_WIDTH, (endIndex - startIndex + 1) * DAY_WIDTH),
    };
  };

  const axisWidth = days.length * DAY_WIDTH;
  const hasBars = groups.some((group) => timelineBars(group.items).length > 0);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div style={{ minWidth: LABEL_WIDTH + axisWidth }} className="relative">
        {/* Date axis */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-canvas">
          <div
            style={{ width: LABEL_WIDTH }}
            className="sticky left-0 z-10 shrink-0 border-r border-line bg-canvas px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted"
          >
            Work item
          </div>
          <div className="flex">
            {days.map((day, index) => (
              <div
                key={index}
                style={{ width: DAY_WIDTH }}
                className={`shrink-0 border-r py-1.5 text-center ${
                  isWeekend(day) ? 'bg-line-2/60' : ''
                } ${isFirstDayOfMonth(day) ? 'border-slate-300' : 'border-line-2'}`}
              >
                {isFirstDayOfMonth(day) && (
                  <div className="whitespace-nowrap text-[9.5px] font-semibold text-slate-600">
                    {format(day, 'MMM')}
                  </div>
                )}
                <div className="text-[9.5px] text-muted">{format(day, 'd')}</div>
              </div>
            ))}
          </div>
        </div>

        {!hasBars && (
          <p className="px-6 py-12 text-center text-[12.5px] text-muted">
            No work items in this view have a start or due date, so there is nothing to plot.
          </p>
        )}

        {/* Rows */}
        {groups.map((group) => {
          const bars = timelineBars(group.items);
          if (bars.length === 0) return null;

          return (
            <section key={group.id}>
              <div className="flex border-b border-line bg-canvas/70">
                <div
                  style={{ width: LABEL_WIDTH }}
                  className="sticky left-0 z-10 shrink-0 bg-canvas/95 px-3 py-1.5 text-[11.5px] font-semibold text-ink"
                >
                  {group.label}
                  <span className="ml-1.5 font-mono text-[10.5px] text-muted">{bars.length}</span>
                </div>
                <div style={{ width: axisWidth }} />
              </div>

              {bars.map(({ item, start, end }) => {
                const { left, width } = geometry(item, { start, end });
                const itemState = state.states.byId[item.stateId];
                const assignees = item.assigneeIds
                  .map((id) => personById(id))
                  .filter((person): person is NonNullable<typeof person> => Boolean(person));
                const dragging = drag?.itemId === item.id;

                return (
                  <div
                    key={item.id}
                    style={{ height: ROW_HEIGHT }}
                    className={`flex border-b border-line-2 ${
                      activeItemId === item.id ? 'bg-kiran-tint' : 'bg-white'
                    }`}
                  >
                    <div
                      style={{ width: LABEL_WIDTH }}
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-line bg-inherit px-3"
                    >
                      <PriorityIcon priority={item.priority} />
                      <span className="shrink-0 font-mono text-[10.5px] text-muted">
                        {displayId(state, item)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpen(item.id)}
                        className="min-w-0 flex-1 truncate text-left text-[12px] text-ink hover:text-kiran"
                      >
                        {item.title}
                      </button>
                      <AvatarStack people={assignees} max={2} size="xs" />
                    </div>

                    {/* The track */}
                    <div style={{ width: axisWidth }} className="relative">
                      <div
                        onPointerDown={(event) =>
                          beginDrag(event, item, 'move', { start, end })
                        }
                        onClick={() => {
                          if (justDragged.current) {
                            justDragged.current = false;
                            return;
                          }
                          onOpen(item.id);
                        }}
                        style={{
                          left,
                          width,
                          backgroundColor: itemState?.color ?? '#6E7F96',
                          top: 5,
                          height: ROW_HEIGHT - 12,
                        }}
                        title={`${item.title} · ${start} → ${end}`}
                        className={`absolute flex cursor-grab items-center rounded px-1.5 text-white transition-shadow active:cursor-grabbing ${
                          dragging ? 'opacity-80 shadow-raised' : 'hover:shadow-card'
                        }`}
                      >
                        {/* Resize handles. Wide enough to hit, narrow enough
                            not to eat the whole bar on a one-day item. */}
                        <span
                          onPointerDown={(event) =>
                            beginDrag(event, item, 'start', { start, end })
                          }
                          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l bg-black/15"
                        />
                        <span className="truncate text-[10px] font-medium">
                          {width > 64 ? item.title : ''}
                        </span>
                        <span
                          onPointerDown={(event) =>
                            beginDrag(event, item, 'end', { start, end })
                          }
                          className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r bg-black/15"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}

        {/* Today marker, drawn over the rows */}
        {todayOffset >= 0 && todayOffset < days.length && (
          <div
            aria-hidden
            style={{ left: LABEL_WIDTH + todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
            className="pointer-events-none absolute inset-y-0 z-[15] w-px bg-strand-red/70"
          />
        )}
      </div>
    </div>
  );
};
