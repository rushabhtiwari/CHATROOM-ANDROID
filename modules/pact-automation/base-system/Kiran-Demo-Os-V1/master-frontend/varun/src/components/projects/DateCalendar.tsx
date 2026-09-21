/**
 * The month picker that opens under a date pill.
 *
 * A native `<input type="date">` is keyboard-accessible and free, but it looks
 * like a form control, and the reference screenshots show a month grid with
 * the selected day filled and today marked — so this is that grid, in about
 * ninety lines of date-fns. Weeks start on Sunday to match them.
 */

import React, { useState } from 'react';
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

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const isoDay = (date: Date): string => format(date, 'yyyy-MM-dd');

export const DateCalendar: React.FC<{
  value: string | null;
  onChange: (iso: string | null) => void;
  /** ISO day; days before it are disabled. */
  min?: string | null;
  /** ISO day; days after it are disabled. */
  max?: string | null;
}> = ({ value, onChange, min, max }) => {
  const selected = value ? parseISO(value) : null;
  const [cursor, setCursor] = useState<Date>(selected ?? new Date());

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  });

  return (
    <div className="w-[248px] px-2.5 pb-2 pt-1.5 text-ink">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[13px] font-semibold">{format(cursor, 'MMMM yyyy')}</span>
        <span className="flex items-center">
          <button
            type="button"
            onClick={() => setCursor((prev) => subMonths(prev, 1))}
            aria-label="Previous month"
            className="rounded p-1 text-slate-500 hover:bg-canvas hover:text-ink"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCursor((prev) => addMonths(prev, 1))}
            aria-label="Next month"
            className="rounded p-1 text-slate-500 hover:bg-canvas hover:text-ink"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((label) => (
          <div key={label} className="py-1 text-center text-[12px] font-semibold text-muted">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const iso = isoDay(day);
          const inMonth = isSameMonth(day, cursor);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const disabled = Boolean((min && iso < min) || (max && iso > max));

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={`relative mx-auto my-[1px] flex h-7 w-7 items-center justify-center rounded-full text-[12px] transition-colors ${
                isSelected
                  ? 'bg-kiran font-semibold text-white'
                  : disabled
                    ? 'cursor-not-allowed text-slate-200'
                    : inMonth
                      ? 'text-ink hover:bg-canvas'
                      : 'text-slate-300 hover:bg-canvas'
              }`}
            >
              {format(day, 'd')}
              {isToday(day) && !isSelected && (
                <span aria-hidden className="absolute bottom-[3px] h-1 w-1 rounded-full bg-kiran" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-line-2 px-1 pt-1.5">
        <button
          type="button"
          onClick={() => onChange(isoDay(new Date()))}
          className="text-[12px] font-medium text-kiran hover:underline"
        >
          Today
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[12px] font-medium text-slate-500 hover:text-strand-red"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
