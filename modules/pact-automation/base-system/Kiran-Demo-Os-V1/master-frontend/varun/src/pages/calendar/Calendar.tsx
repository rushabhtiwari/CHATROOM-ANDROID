/**
 * The built-in calendar.
 *
 * Every meeting scheduled from a conversation lands here, which is the point:
 * the alternative is leaving the console to check whether a slot is free, and
 * a system people leave in order to use is a system they stop using.
 *
 * Three views, because three questions get asked. Month answers "how busy is
 * this period". Week answers "where does this fit". Agenda answers "what is
 * next". Nothing here is a preference — they are different questions.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquareText,
  Plus,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { PageTabs } from '@/components/common/PageTabs';
import { EmptyState } from '@/components/common/EmptyState';
import {
  createEvent,
  deleteEvent,
  listEvents,
  type CalendarEvent,
  type NewCalendarEvent,
} from '@/modules/calendar/api';
import {
  DAY,
  HOUR,
  MINUTE,
  WEEKDAYS,
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  eventState,
  eventsOnDay,
  formatDayLong,
  formatMonth,
  formatTime,
  formatTimeRange,
  isSameDay,
  isToday,
  layoutDay,
  monthGrid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekDays,
} from '@/modules/calendar/time';

type View = 'month' | 'week' | 'agenda';

/** The band of the day the week grid renders. Nothing is scheduled at 4am. */
const DAY_START = 7;
const DAY_END = 21;

export const Calendar: React.FC = () => {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [composing, setComposing] = useState<Date | null>(null);

  /* The window the current view needs, padded so a month grid's leading and
     trailing days are populated too. */
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (view === 'month') {
      return [
        startOfWeek(startOfMonth(anchor)).getTime(),
        endOfDay(addDays(endOfMonth(anchor), 7)).getTime(),
      ];
    }
    if (view === 'week') {
      return [startOfWeek(anchor).getTime(), endOfDay(addDays(startOfWeek(anchor), 6)).getTime()];
    }
    return [startOfDay(anchor).getTime(), endOfDay(addDays(anchor, 30)).getTime()];
  }, [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await listEvents(rangeStart, rangeEnd));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the calendar.');
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const step = (direction: -1 | 1) =>
    setAnchor((current) =>
      view === 'month'
        ? addMonths(current, direction)
        : addDays(current, direction * (view === 'week' ? 7 : 30)),
    );

  const periodLabel =
    view === 'month'
      ? formatMonth(anchor)
      : view === 'week'
        ? `${startOfWeek(anchor).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(
            startOfWeek(anchor),
            6,
          ).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : `From ${formatDayLong(anchor)}`;

  const upcoming = useMemo(
    () => events.filter((event) => event.endAt >= Date.now()).length,
    [events],
  );

  const handleCreate = async (input: NewCalendarEvent) => {
    const created = await createEvent(input);
    setEvents((current) => [...current, created].sort((a, b) => a.startAt - b.startAt));
    setComposing(null);
  };

  const handleDelete = async (event: CalendarEvent) => {
    await deleteEvent(event.id);
    setEvents((current) => current.filter((row) => row.id !== event.id));
    setSelected(null);
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        actions={
          <>
            <div className="flex items-center rounded-md border border-line bg-surface">
              <button
                onClick={() => step(-1)}
                aria-label="Previous period"
                className="px-2 py-1.5 text-muted transition-colors hover:bg-line-2 hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAnchor(new Date())}
                className="border-x border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-line-2"
              >
                Today
              </button>
              <button
                onClick={() => step(1)}
                aria-label="Next period"
                className="px-2 py-1.5 text-muted transition-colors hover:bg-line-2 hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setComposing(anchor)}
              className="flex items-center gap-1.5 rounded-md bg-kiran px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-kiran-600"
            >
              <Plus className="h-3.5 w-3.5" /> New event
            </button>
          </>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageTabs
            tabs={[
              { id: 'month', label: 'Month' },
              { id: 'week', label: 'Week' },
              { id: 'agenda', label: 'Agenda', count: upcoming },
            ]}
            activeTab={view}
            onChange={(id) => setView(id as View)}
            departmentColor="#00AEEF"
            className="flex-1"
          />
          <span className="font-display text-sm font-semibold text-ink">{periodLabel}</span>
        </div>
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-md border border-strand-red/25 bg-strand-red/5 px-4 py-3 text-[13px] text-strand-red">
          {error}
        </div>
      )}

      <div className="panel relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/70 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-kiran" />
          </div>
        )}

        {view === 'month' && (
          <MonthView
            anchor={anchor}
            events={events}
            onPick={(day) => {
              setAnchor(day);
              setView('week');
            }}
            onSelect={setSelected}
          />
        )}
        {view === 'week' && (
          <WeekView anchor={anchor} events={events} onSelect={setSelected} onCompose={setComposing} />
        )}
        {view === 'agenda' && <AgendaView anchor={anchor} events={events} onSelect={setSelected} />}
      </div>

      {selected && (
        <EventDetail event={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />
      )}
      {composing && (
        <EventComposer day={composing} onClose={() => setComposing(null)} onCreate={handleCreate} />
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Month                                                                      */
/* -------------------------------------------------------------------------- */

const MonthView: React.FC<{
  anchor: Date;
  events: CalendarEvent[];
  onPick: (day: Date) => void;
  onSelect: (event: CalendarEvent) => void;
}> = ({ anchor, events, onPick, onSelect }) => {
  const days = useMemo(() => monthGrid(anchor), [anchor]);
  const month = anchor.getMonth();

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line bg-surface-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-[12px] font-semibold text-muted"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day);
          const outside = day.getMonth() !== month;
          return (
            <button
              key={day.toISOString()}
              onClick={() => onPick(day)}
              className={`min-h-[104px] border-b border-r border-line p-1.5 text-left align-top transition-colors last-in-row:border-r-0 hover:bg-canvas ${
                outside ? 'bg-surface-2/60' : 'bg-surface'
              }`}
            >
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-[12px] font-semibold ${
                  isToday(day)
                    ? 'bg-kiran text-white'
                    : outside
                      ? 'text-slate-300'
                      : 'text-slate-600'
                }`}
              >
                {day.getDate()}
              </span>

              <div className="mt-1 space-y-px">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onSelect(event);
                    }}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key !== 'Enter') return;
                      keyEvent.stopPropagation();
                      onSelect(event);
                    }}
                    className="flex items-center gap-1 truncate rounded-xs px-1 py-0.5 text-[12px] leading-tight text-ink hover:bg-kiran-tint"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        eventState(event) === 'past' ? 'bg-slate-300' : 'bg-strand-teal'
                      }`}
                    />
                    <span className="font-mono text-[12px] text-muted">
                      {formatTime(event.startAt)}
                    </span>
                    <span className="truncate">{event.title}</span>
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1 text-[12px] font-medium text-muted">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Week                                                                       */
/* -------------------------------------------------------------------------- */

const WeekView: React.FC<{
  anchor: Date;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  onCompose: (day: Date) => void;
}> = ({ anchor, events, onSelect, onCompose }) => {
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const hours = useMemo(
    () => Array.from({ length: DAY_END - DAY_START }, (_, index) => DAY_START + index),
    [],
  );

  // A hairline showing the current time, but only when this week is on screen.
  const now = Date.now();
  const showNow = days.some((day) => isSameDay(day, now));
  const nowOffset =
    ((new Date(now).getHours() - DAY_START) * HOUR + new Date(now).getMinutes() * MINUTE) /
    ((DAY_END - DAY_START) * HOUR);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        {/* Day headers */}
        <div className="sticky top-0 z-10 grid grid-cols-[56px_repeat(7,1fr)] border-b border-line bg-surface-2">
          <div />
          {days.map((day) => (
            <div key={day.toISOString()} className="px-2 py-2 text-center">
              <div className="text-[12px] font-semibold text-muted">
                {WEEKDAYS[(day.getDay() + 6) % 7]}
              </div>
              <div
                className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px] font-semibold ${
                  isToday(day) ? 'bg-kiran text-white' : 'text-slate-700'
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
          {/* Hour rail */}
          <div className="border-r border-line">
            {hours.map((hour) => (
              <div key={hour} className="relative h-14">
                <span className="absolute -top-1.5 right-2 font-mono text-[12px] text-muted">
                  {hour === 12 ? '12 pm' : hour > 12 ? `${hour - 12} pm` : `${hour} am`}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const positioned = layoutDay(events, day, DAY_START, DAY_END);
            return (
              <div key={day.toISOString()} className="relative border-r border-line last:border-r-0">
                {hours.map((hour) => (
                  <button
                    key={hour}
                    onClick={() => {
                      const slot = startOfDay(day);
                      slot.setHours(hour, 0, 0, 0);
                      onCompose(slot);
                    }}
                    aria-label={`Add an event at ${hour}:00 on ${formatDayLong(day)}`}
                    className="block h-14 w-full border-b border-line-2 transition-colors hover:bg-kiran-tint/50"
                  />
                ))}

                {positioned.map(({ event, top, height, column, columns }) => {
                  const state = eventState(event);
                  return (
                    <button
                      key={event.id}
                      onClick={() => onSelect(event)}
                      style={{
                        top: `${top * 100}%`,
                        height: `${height * 100}%`,
                        left: `calc(${(column / columns) * 100}% + 2px)`,
                        width: `calc(${(1 / columns) * 100}% - 4px)`,
                      }}
                      className={`absolute overflow-hidden rounded-sm border-l-2 px-1.5 py-1 text-left shadow-xs transition-shadow hover:shadow-card ${
                        state === 'past'
                          ? 'border-l-slate-300 bg-slate-100 text-slate-500'
                          : state === 'live'
                            ? 'border-l-strand-green bg-emerald-50 text-emerald-900'
                            : 'border-l-strand-teal bg-kiran-tint text-ink'
                      }`}
                    >
                      <span className="block truncate text-[12px] font-semibold leading-tight">
                        {event.title}
                      </span>
                      <span className="block truncate font-mono text-[12px] opacity-70">
                        {formatTime(event.startAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {showNow && nowOffset >= 0 && nowOffset <= 1 && (
            <div
              aria-hidden
              className="pointer-events-none absolute left-14 right-0 z-[5] border-t border-strand-red"
              style={{ top: `${nowOffset * 100}%` }}
            >
              <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-strand-red" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Agenda                                                                     */
/* -------------------------------------------------------------------------- */

const AgendaView: React.FC<{
  anchor: Date;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
}> = ({ anchor, events, onSelect }) => {
  const grouped = useMemo(() => {
    const days: Array<{ day: Date; items: CalendarEvent[] }> = [];
    for (let index = 0; index <= 30; index += 1) {
      const day = addDays(anchor, index);
      const items = eventsOnDay(events, day);
      if (items.length > 0) days.push({ day, items });
    }
    return days;
  }, [anchor, events]);

  if (grouped.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={CalendarDays}
          statement="Nothing scheduled in the next month"
          instruction="Meetings scheduled from a conversation appear here automatically."
        />
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      {grouped.map(({ day, items }) => (
        <div key={day.toISOString()} className="flex gap-4 px-5 py-4">
          <div className="w-28 shrink-0">
            <div
              className={`font-display text-sm font-semibold ${
                isToday(day) ? 'text-kiran' : 'text-ink'
              }`}
            >
              {isToday(day) ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'long' })}
            </div>
            <div className="font-mono text-[12px] text-muted">
              {day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {items.map((event) => {
              const state = eventState(event);
              return (
                <button
                  key={event.id}
                  onClick={() => onSelect(event)}
                  className="flex w-full items-start gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-kiran/30 hover:bg-canvas"
                >
                  <span
                    className={`mt-1 h-8 w-0.5 shrink-0 rounded-full ${
                      state === 'past'
                        ? 'bg-slate-300'
                        : state === 'live'
                          ? 'bg-strand-green'
                          : 'bg-strand-teal'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {event.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[12px] text-muted">
                      <span>{formatTimeRange(event.startAt, event.endAt)}</span>
                      {event.attendeeNames && event.attendeeNames.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {event.attendeeNames.length + 1}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" /> {event.location}
                        </span>
                      )}
                    </span>
                  </span>
                  {event.meetingUri && (
                    <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-strand-teal" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

const EventDetail: React.FC<{
  event: CalendarEvent;
  onClose: () => void;
  onDelete: (event: CalendarEvent) => void | Promise<void>;
}> = ({ event, onClose, onDelete }) => {
  const [removing, setRemoving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4 animate-overlay-in"
      role="button"
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(keyEvent) => keyEvent.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-label={event.title}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        className="panel-lift w-full max-w-md animate-dialog-in overflow-hidden"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className="mt-0.5 h-9 w-0.5 shrink-0 rounded-full bg-strand-teal" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-semibold leading-snug text-ink">
              {event.title}
            </h2>
            <p className="mt-0.5 font-mono text-[12px] text-muted">
              {formatDayLong(event.startAt)} · {formatTimeRange(event.startAt, event.endAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted transition-colors hover:bg-line-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          {event.description && (
            <p className="text-[13px] leading-relaxed text-slate-700">{event.description}</p>
          )}

          {event.location && (
            <div className="flex items-center gap-2 text-[12.5px] text-slate-700">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" /> {event.location}
            </div>
          )}

          {(event.organizerName || event.attendeeNames?.length) && (
            <div>
              <p className="label-eyebrow">Attendees</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {event.organizerName && (
                  <span className="rounded-badge bg-kiran-tint px-2 py-0.5 text-[12px] font-medium text-kiran">
                    {event.organizerName} · organiser
                  </span>
                )}
                {event.attendeeNames?.map((name) => (
                  <span
                    key={name}
                    className="rounded-badge bg-line-2 px-2 py-0.5 text-[12px] text-slate-700"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-0.5">
            {event.meetingUri && (
              <a
                href={event.meetingUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-kiran px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-kiran-600"
              >
                <Video className="h-3.5 w-3.5" /> Join Meet
              </a>
            )}
            {event.calendarUri && (
              <a
                href={event.calendarUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-line-2"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Google Calendar
              </a>
            )}
            {event.roomId && (
              <Link
                to="/chat"
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-line-2"
              >
                <MessageSquareText className="h-3.5 w-3.5" /> Open conversation
              </Link>
            )}
          </div>

          {event.demo && (
            <p className="rounded-md bg-strand-amber/10 px-2.5 py-2 text-[12px] leading-relaxed text-strand-amber">
              Google credentials are not configured on this server, so the Meet link is a
              placeholder. The Calendar link opens a real event with everything filled in.
            </p>
          )}
        </div>

        {event.source !== 'seed' && (
          <div className="flex justify-end border-t border-line bg-surface-2 px-5 py-3">
            <button
              onClick={async () => {
                setRemoving(true);
                await onDelete(event);
              }}
              disabled={removing}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-strand-red transition-colors hover:bg-strand-red/8 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove from calendar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Composer                                                                   */
/* -------------------------------------------------------------------------- */

const EventComposer: React.FC<{
  day: Date;
  onClose: () => void;
  onCreate: (input: NewCalendarEvent) => Promise<void>;
}> = ({ day, onClose, onCreate }) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(
    `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
  );
  const [time, setTime] = useState(`${pad(day.getHours() || 10)}:${pad(day.getMinutes())}`);
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const [year, month, dayOfMonth] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const startAt = new Date(year, month - 1, dayOfMonth, hour, minute).getTime();
    if (!Number.isFinite(startAt)) {
      setError('That is not a valid date and time.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        startAt,
        endAt: startAt + duration * MINUTE,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(location.trim() ? { location: location.trim() } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that event.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4 animate-overlay-in"
      role="button"
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(keyEvent) => keyEvent.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-label="New calendar event"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        className="panel-lift w-full max-w-sm animate-dialog-in overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-[15px] font-semibold text-ink">New event</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted transition-colors hover:bg-line-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="label-eyebrow" htmlFor="event-title">
              Title
            </label>
            <input
              id="event-title"
              autoFocus
              value={title}
              onChange={(changeEvent) => setTitle(changeEvent.target.value)}
              placeholder="What is this block for?"
              className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-2 text-[13px] placeholder:text-muted focus:border-kiran focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label-eyebrow" htmlFor="event-date">
                Date
              </label>
              <input
                id="event-date"
                type="date"
                value={date}
                onChange={(changeEvent) => setDate(changeEvent.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-2 font-mono text-[12px] focus:border-kiran focus:outline-none"
              />
            </div>
            <div>
              <label className="label-eyebrow" htmlFor="event-time">
                Start
              </label>
              <input
                id="event-time"
                type="time"
                value={time}
                onChange={(changeEvent) => setTime(changeEvent.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-2 font-mono text-[12px] focus:border-kiran focus:outline-none"
              />
            </div>
          </div>

          <div>
            <span className="label-eyebrow">Duration</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[15, 30, 45, 60, 90].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => setDuration(minutes)}
                  aria-pressed={duration === minutes}
                  className={`rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    duration === minutes
                      ? 'border-kiran bg-kiran-tint text-kiran'
                      : 'border-line bg-surface text-slate-700 hover:bg-line-2'
                  }`}
                >
                  {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-eyebrow" htmlFor="event-location">
              Location
            </label>
            <input
              id="event-location"
              value={location}
              onChange={(changeEvent) => setLocation(changeEvent.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-2 text-[13px] placeholder:text-muted focus:border-kiran focus:outline-none"
            />
          </div>

          {error && <p className="text-[12px] text-strand-red">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-line-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-kiran px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-kiran-600 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add to calendar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
