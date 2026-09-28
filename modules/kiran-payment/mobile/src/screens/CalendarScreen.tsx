import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  MessageSquareText,
  Plus,
  Users,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '@/lib/chat-store';
import { createEvent, deleteEvent, listEvents, type CalendarEvent } from '@/modules/calendar/api';
import {
  addDays,
  endOfDay,
  eventState,
  eventsOnDay,
  formatDayLong,
  formatTimeRange,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
  weekDays,
} from '@/modules/calendar/time';
import { cn } from '@/lib/utils';
import { Empty, Screen } from '~/components/Screen';
import { ConfirmSheet, Sheet, SheetButton } from '~/components/Sheet';
import { selection, tap } from '~/native/haptics';

const pad = (n: number) => String(n).padStart(2, '0');
const dateInput = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

/** The next half hour, which is when a meeting booked now would start. */
function nextSlot(day: Date): string {
  const now = new Date();
  if (!isSameDay(day, now)) return '10:00';
  const minutes = now.getHours() * 60 + now.getMinutes();
  const next = Math.min(23 * 60 + 30, Math.ceil((minutes + 1) / 30) * 30);
  return `${pad(Math.floor(next / 60))}:${pad(next % 60)}`;
}

/** One event: when, where, who, and the ways into it. */
function EventSheet({
  event,
  onClose,
  onDeleted,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const { rooms, roomTitle } = useChat();
  const [confirming, setConfirming] = useState(false);
  const room = event.roomId ? rooms.find((candidate) => candidate.id === event.roomId) : undefined;
  const state = eventState(event);

  if (confirming) {
    return (
      <ConfirmSheet
        title={`Delete "${event.title}"?`}
        detail="It is removed from the calendar for everyone."
        confirm="Delete event"
        onConfirm={async () => {
          try {
            await deleteEvent(event.id);
            toast.success('Event deleted');
            onDeleted();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not delete it.');
          }
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <Sheet onClose={onClose} title={event.title}>
      <div className="space-y-2 px-4 pb-3 text-[14px] text-slate-600">
        <p className="text-center">
          {formatDayLong(event.startAt)} · {formatTimeRange(event.startAt, event.endAt)}
          {state === 'live' && (
            <span className="ml-2 rounded-full bg-online/15 px-2 py-0.5 text-[12px] font-semibold text-online">
              Now
            </span>
          )}
        </p>
        {event.location && (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-brand" /> {event.location}
          </p>
        )}
        {(event.attendeeNames?.length ?? 0) > 0 && (
          <p className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span>
              {event.organizerName ? `${event.organizerName} (organiser), ` : ''}
              {event.attendeeNames!.join(', ')}
            </span>
          </p>
        )}
        {event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
        {event.demo && (
          <p className="rounded-lg bg-strand-amber/10 px-3 py-2 text-[12px] text-strand-amber">
            Google was not connected when this was booked, so its Meet link is a placeholder.
          </p>
        )}
      </div>
      {event.meetingUri && (
        <SheetButton
          tone="brand"
          icon={<Video className="h-5 w-5" />}
          onClick={() => window.open(event.meetingUri, '_blank', 'noopener')}
        >
          Join Google Meet
        </SheetButton>
      )}
      {event.calendarUri && (
        <SheetButton
          icon={<ExternalLink className="h-5 w-5" />}
          onClick={() => window.open(event.calendarUri, '_blank', 'noopener')}
        >
          Open in Google Calendar
        </SheetButton>
      )}
      {room && (
        <SheetButton
          icon={<MessageSquareText className="h-5 w-5" />}
          onClick={() => navigate(`/chats/${room.id}`)}
        >
          Open {roomTitle(room)}
        </SheetButton>
      )}
      {event.source === 'manual' && (
        <SheetButton tone="danger" onClick={() => setConfirming(true)}>
          Delete event
        </SheetButton>
      )}
    </Sheet>
  );
}

/** A block on the calendar: a title and a time, optionally a Meet link. */
function NewEventSheet({
  day,
  onClose,
  onCreated,
}: {
  day: Date;
  onClose: () => void;
  onCreated: (event: CalendarEvent) => void;
}) {
  const { currentUser } = useChat();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateInput(day));
  const [start, setStart] = useState(nextSlot(day));
  const [minutes, setMinutes] = useState(30);
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);

  const startAt = new Date(`${date}T${start}`).getTime();
  const valid = title.trim() && Number.isFinite(startAt);
  const field =
    'w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-[16px] text-ink outline-none focus:border-brand';

  return (
    <Sheet onClose={onClose} title="New event">
      <div className="space-y-2.5 px-4 pb-3 pt-1">
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          aria-label="Title"
          className={field}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Date"
            className={field}
          />
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            aria-label="Start time"
            className={field}
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[15, 30, 60, 90].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={minutes === value}
              onClick={() => setMinutes(value)}
              className={cn(
                'h-9 rounded-lg text-[13px] font-medium',
                minutes === value ? 'bg-brand text-white' : 'bg-slate-100 text-ink',
              )}
            >
              {value < 60 ? `${value} min` : `${value / 60} h`}
            </button>
          ))}
        </div>
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Location (optional)"
          aria-label="Location"
          className={field}
        />
      </div>
      <SheetButton
        tone="brand"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const event = await createEvent({
              title: title.trim(),
              startAt,
              endAt: startAt + minutes * 60_000,
              timeZone: currentUser.timeZone,
              organizerName: currentUser.name,
              ...(location.trim() ? { location: location.trim() } : {}),
            });
            toast.success('Added to the calendar');
            onCreated(event);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not add it.');
            setBusy(false);
          }
        }}
      >
        Add to calendar
      </SheetButton>
    </Sheet>
  );
}

/**
 * The calendar every conversation schedules into.
 *
 * A week strip to pick a day, and that day's agenda under it: the phone
 * shape of the console's week and agenda views. Meetings booked from a chat
 * carry their Meet link and a way back to the chat.
 */
export function CalendarScreen() {
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [adding, setAdding] = useState(false);

  const week = useMemo(() => weekDays(startOfWeek(day)), [day]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await listEvents(week[0]!.getTime(), endOfDay(addDays(week[0]!, 6)).getTime()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the calendar.');
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = eventsOnDay(events, day).sort((a, b) => a.startAt - b.startAt);

  return (
    <Screen
      title="Calendar"
      subtitle={formatDayLong(day)}
      action={
        <button
          type="button"
          onClick={() => {
            tap();
            setAdding(true);
          }}
          aria-label="New event"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-brand active:bg-slate-100"
        >
          <Plus className="h-6 w-6" />
        </button>
      }
    >
      <div className="border-b border-line bg-surface px-2 pb-2 pt-1">
        <div className="flex items-center justify-between px-1 pb-1">
          <button
            type="button"
            onClick={() => setDay((current) => addDays(current, -7))}
            aria-label="Previous week"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setDay(startOfDay(new Date()))}
            className="text-[13px] font-semibold text-brand"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDay((current) => addDays(current, 7))}
            aria-label="Next week"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="Days">
          {week.map((date) => {
            const active = isSameDay(date, day);
            const busy = eventsOnDay(events, date).length > 0;
            return (
              <button
                key={date.toISOString()}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={formatDayLong(date)}
                onClick={() => {
                  selection();
                  setDay(startOfDay(date));
                }}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl py-1.5',
                  active ? 'bg-brand text-white' : 'text-ink',
                )}
              >
                <span className={cn('text-[11px]', active ? 'text-white/80' : 'text-slate-500')}>
                  {date.toLocaleDateString('en-IN', { weekday: 'narrow' })}
                </span>
                <span
                  className={cn(
                    'text-[16px] font-semibold',
                    !active && isToday(date) && 'text-brand',
                  )}
                >
                  {date.getDate()}
                </span>
                <span
                  className={cn(
                    'h-1 w-1 rounded-full',
                    busy ? (active ? 'bg-white' : 'bg-brand') : 'bg-transparent',
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <Empty title="Could not load the calendar" detail={error} />
      ) : loading && events.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-slate-400">Loading…</p>
      ) : today.length === 0 ? (
        <Empty
          title="Nothing scheduled"
          detail="Meetings booked from a chat appear here. Tap + to add your own."
        />
      ) : (
        <ul className="space-y-2 p-3">
          {today.map((event) => {
            const state = eventState(event);
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => {
                    tap();
                    setSelected(event);
                  }}
                  className={cn(
                    'flex w-full gap-3 rounded-xl border-l-4 bg-surface p-3 text-left shadow-sm active:bg-slate-50',
                    state === 'live' ? 'border-online' : 'border-brand',
                    state === 'past' && 'opacity-60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-slate-500">
                      {formatTimeRange(event.startAt, event.endAt)}
                      {state === 'live' && <span className="ml-2 text-online">Now</span>}
                    </p>
                    <p className="truncate text-[15px] font-semibold text-ink">{event.title}</p>
                    {(event.location || event.attendeeNames?.length) && (
                      <p className="truncate text-[12px] text-slate-500">
                        {event.location ??
                          `${event.attendeeNames!.length} ${event.attendeeNames!.length === 1 ? 'guest' : 'guests'}`}
                      </p>
                    )}
                  </div>
                  {event.meetingUri ? (
                    <Video
                      className="h-5 w-5 shrink-0 self-center text-brand"
                      aria-label="Has a Meet link"
                    />
                  ) : (
                    <CalendarDays className="h-5 w-5 shrink-0 self-center text-slate-300" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <EventSheet
          event={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
      {adding && (
        <NewEventSheet
          day={day}
          onClose={() => setAdding(false)}
          onCreated={(event) => {
            setAdding(false);
            setDay(startOfDay(event.startAt));
            void load();
          }}
        />
      )}
    </Screen>
  );
}
