/**
 * Calendar arithmetic.
 *
 * Everything here works in the viewer's own zone and returns plain numbers, so
 * the views can stay declarative. Kept separate from the components because
 * week boundaries and overlap-layout are the two places a calendar actually
 * goes wrong, and they are easier to reason about on their own.
 */

import type { CalendarEvent } from './api';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Monday-first, matching how the business plans its week. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const startOfDay = (value: Date | number): Date => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const endOfDay = (value: Date | number): Date => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

export const startOfWeek = (value: Date | number): Date => {
  const date = startOfDay(value);
  // getDay() is Sunday-first; shift so Monday is 0.
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
};

export const startOfMonth = (value: Date | number): Date => {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
};

export const endOfMonth = (value: Date | number): Date => {
  const date = startOfMonth(value);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return endOfDay(date);
};

export const addDays = (value: Date | number, days: number): Date => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const addMonths = (value: Date | number, months: number): Date => {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date;
};

export const isSameDay = (a: Date | number, b: Date | number): boolean => {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

export const isToday = (value: Date | number) => isSameDay(value, new Date());

/** The six-week grid a month view needs, so the layout never reflows by row. */
export const monthGrid = (month: Date): Date[] => {
  const first = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
};

export const weekDays = (anchor: Date): Date[] => {
  const first = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
};

export const formatTime = (value: number): string =>
  new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatTimeRange = (start: number, end: number): string =>
  `${formatTime(start)} – ${formatTime(end)}`;

export const formatDayLong = (value: Date | number): string =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

export const formatMonth = (value: Date | number): string =>
  new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Events touching a given day, earliest first. */
export const eventsOnDay = (events: CalendarEvent[], day: Date): CalendarEvent[] => {
  const from = startOfDay(day).getTime();
  const to = endOfDay(day).getTime();
  return events
    .filter((event) => event.startAt <= to && event.endAt >= from)
    .sort((a, b) => a.startAt - b.startAt);
};

export interface PositionedEvent {
  event: CalendarEvent;
  /** Fraction of the day grid, 0–1. */
  top: number;
  height: number;
  /** Horizontal share within a cluster of overlapping events. */
  column: number;
  columns: number;
}

/**
 * Lays out one day's events, side by side where they overlap.
 *
 * Events are swept in start order and grouped into clusters that share any
 * overlap; each cluster is then divided into as many columns as its widest
 * simultaneous overlap. This is the standard approach, and it matters here
 * because a day with a double-booking should show both, not hide one.
 */
export const layoutDay = (
  events: CalendarEvent[],
  day: Date,
  dayStartHour = 0,
  dayEndHour = 24,
): PositionedEvent[] => {
  const gridStart = startOfDay(day).getTime() + dayStartHour * HOUR;
  const gridEnd = startOfDay(day).getTime() + dayEndHour * HOUR;
  const span = gridEnd - gridStart;
  if (span <= 0) return [];

  const ordered = eventsOnDay(events, day);
  const positioned: PositionedEvent[] = [];

  let cluster: CalendarEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    // Column assignment: reuse the first column whose last event has ended.
    const columnEnds: number[] = [];
    const assigned = cluster.map((event) => {
      let column = columnEnds.findIndex((end) => end <= event.startAt);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(event.endAt);
      } else {
        columnEnds[column] = event.endAt;
      }
      return { event, column };
    });
    const columns = Math.max(1, columnEnds.length);
    for (const { event, column } of assigned) {
      const start = Math.max(event.startAt, gridStart);
      const end = Math.min(Math.max(event.endAt, start + 15 * MINUTE), gridEnd);
      positioned.push({
        event,
        top: (start - gridStart) / span,
        height: Math.max((end - start) / span, 0.012),
        column,
        columns,
      });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of ordered) {
    if (cluster.length > 0 && event.startAt >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.endAt);
  }
  flush();

  return positioned;
};

/** Whether a colour rail should read as a past, live, or upcoming event. */
export const eventState = (event: CalendarEvent, now = Date.now()): 'past' | 'live' | 'future' => {
  if (event.endAt < now) return 'past';
  if (event.startAt <= now) return 'live';
  return 'future';
};
