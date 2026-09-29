/**
 * The in-app calendar: a port of backend/app/calendar_store.py and
 * backend/app/routers/calendar.py.
 *
 * Every meeting scheduled from a conversation lands here (through meet.ts),
 * which is what lets the console show a real calendar instead of sending
 * people to Google. The store keeps the Python shape exactly — one JSON list of
 * events — so the console's calendar reads it without knowing which side
 * answered.
 */
import { HttpError, load, save, type LocalRequest, type Route } from './core';
import { DEFAULT_TIME_ZONE } from './config';

/** One calendar entry. Extra keys (organizerId, googleEventId, ...) ride along as in Python. */
export interface CalendarEvent {
  id: string;
  title: string;
  /** Epoch milliseconds. */
  startAt: number;
  endAt: number;
  timeZone: string;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Request validation                                                          */
/* -------------------------------------------------------------------------- */

/*
 * FastAPI rejects a body pydantic cannot validate with a 422 whose `detail` is
 * a list of errors. The clients here only ever show `detail` as text, so these
 * helpers raise the first error, with pydantic's own wording, as
 * `"<loc>: <msg>"` (e.g. `body.title: String should have at least 1 character`).
 * Deliberate difference: pydantic reports every failing field at once.
 */

export type Loc = (string | number)[];
export type Obj = Record<string, unknown>;

export function invalid(loc: Loc, message: string): never {
  throw new HttpError(422, `${loc.join('.')}: ${message}`);
}

/** Python counts code points, not UTF-16 units. */
const length = (value: string) => [...value].length;
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A request body or nested model: must be a JSON object. */
export function object(value: unknown, loc: Loc, model?: string): Obj {
  if (value === undefined) invalid(loc, 'Field required');
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(
      loc,
      model
        ? `Input should be a valid dictionary or instance of ${model}`
        : 'Input should be a valid dictionary or object to extract fields from',
    );
  }
  return value as Obj;
}

/** A `str` value with pydantic's min_length/max_length. */
export function checkText(value: unknown, at: Loc, max: number, min = 0): string {
  if (typeof value !== 'string') invalid(at, 'Input should be a valid string');
  const n = length(value);
  if (n < min) invalid(at, `String should have at least ${count(min, 'character')}`);
  if (n > max) invalid(at, `String should have at most ${count(max, 'character')}`);
  return value;
}

/** A `str` field: required when `fallback` is undefined. */
export function text(
  o: Obj,
  key: string,
  loc: Loc,
  max: number,
  options: { min?: number; fallback?: string } = {},
): string {
  const value = o[key];
  if (value === undefined) {
    if (options.fallback !== undefined) return options.fallback;
    invalid([...loc, key], 'Field required');
  }
  return checkText(value, [...loc, key], max, options.min);
}

/** An `Optional[str]` field, default None. */
export function optionalText(o: Obj, key: string, loc: Loc, max: number): string | null {
  const value = o[key];
  if (value === undefined || value === null) return null;
  return checkText(value, [...loc, key], max);
}

/** Pydantic's lax `int`: integers, whole floats, integer strings and bools. */
export function toInt(value: unknown, at: Loc): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      invalid(at, 'Input should be a valid integer, got a number with a fractional part');
    }
    return value;
  }
  if (typeof value === 'string') {
    if (/^\s*[-+]?\d+\s*$/.test(value)) return Number(value);
    invalid(at, 'Input should be a valid integer, unable to parse string as an integer');
  }
  invalid(at, 'Input should be a valid integer');
}

/** A required `int` field. */
export function integer(o: Obj, key: string, loc: Loc): number {
  if (o[key] === undefined) invalid([...loc, key], 'Field required');
  return toInt(o[key], [...loc, key]);
}

/** An `Optional[int]` field, default None. */
export function optionalInteger(o: Obj, key: string, loc: Loc): number | null {
  const value = o[key];
  if (value === undefined || value === null) return null;
  return toInt(value, [...loc, key]);
}

/** A `list[...]` field defaulting to an empty list. */
export function list(o: Obj, key: string, loc: Loc): unknown[] {
  const value = o[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) invalid([...loc, key], 'Input should be a valid list');
  return value;
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

const KEY = 'calendar';
const MINUTE = 60_000;
/** The seeds are wall-clock times in IST (fixed +05:30), as in Python. */
const IST_OFFSET = (5 * 60 + 30) * MINUTE;

const nowMs = () => Date.now();

/** A wall-clock time in IST, `dayOffset` days from today. */
function at(dayOffset: number, hour: number, minute = 0): number {
  const ist = new Date(nowMs() + IST_OFFSET);
  return (
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + dayOffset, hour, minute) -
    IST_OFFSET
  );
}

/**
 * A working week, so the calendar is never shown empty to a client: the
 * meetings this company actually runs rather than placeholder blocks.
 */
function seed(): CalendarEvent[] {
  return [
    {
      id: 'cal-seed-standup',
      title: 'Production planning standup',
      description: 'Line loading for the week, and any HDPE stock risks.',
      startAt: at(0, 9, 30),
      endAt: at(0, 9, 30) + 30 * MINUTE,
      timeZone: DEFAULT_TIME_ZONE,
      organizerName: 'Suresh Menon',
      attendeeNames: ['Anjali Rao', 'Vikram Shah', 'Priya Nair'],
      roomId: 'room-operations',
      location: 'Plant 2 — Conference room',
      source: 'seed',
      demo: false,
      createdAt: nowMs(),
    },
    {
      id: 'cal-seed-vendor',
      title: 'Vendor negotiation — Suraj Polymers',
      description: 'Q3 pricing on HDPE granules against the revised RFQ.',
      startAt: at(0, 15, 0),
      endAt: at(0, 15, 0) + 45 * MINUTE,
      timeZone: DEFAULT_TIME_ZONE,
      organizerName: 'Vikram Shah',
      attendeeNames: ['Suresh Menon'],
      roomId: 'room-purchase',
      meetingUri: 'https://meet.google.com/new',
      source: 'seed',
      demo: true,
      createdAt: nowMs(),
    },
    {
      id: 'cal-seed-mis',
      title: 'Monthly MIS review',
      description: 'Receivables ageing, department budget utilisation, AI spend.',
      startAt: at(1, 11, 0),
      endAt: at(1, 11, 0) + 90 * MINUTE,
      timeZone: DEFAULT_TIME_ZONE,
      organizerName: 'Priya Nair',
      attendeeNames: ['Anjali Rao', 'Suresh Menon', 'Vikram Shah'],
      roomId: 'room-finance',
      location: 'Head office — Boardroom',
      source: 'seed',
      demo: false,
      createdAt: nowMs(),
    },
    {
      id: 'cal-seed-reimbursement',
      title: 'Reimbursement clearing — August cycle',
      description: 'HR and Accounts to clear the pending August claims together.',
      startAt: at(2, 16, 0),
      endAt: at(2, 16, 0) + 60 * MINUTE,
      timeZone: DEFAULT_TIME_ZONE,
      organizerName: 'Anjali Rao',
      attendeeNames: ['Priya Nair'],
      roomId: 'room-hr',
      source: 'seed',
      demo: false,
      createdAt: nowMs(),
    },
    {
      id: 'cal-seed-dispatch',
      title: 'Dispatch readiness — Bharat Metro order',
      description: "Confirm the packing list and the ASN before Friday's pickup.",
      startAt: at(3, 10, 0),
      endAt: at(3, 10, 0) + 45 * MINUTE,
      timeZone: DEFAULT_TIME_ZONE,
      organizerName: 'Suresh Menon',
      attendeeNames: ['Vikram Shah', 'Anjali Rao'],
      roomId: 'room-operations',
      source: 'seed',
      demo: false,
      createdAt: nowMs(),
    },
  ];
}

/**
 * The stored list, seeded on first use. Read from storage on every call rather
 * than cached: the store is small, and it keeps one source of truth.
 */
function events(): CalendarEvent[] {
  const stored = load<unknown>(KEY, seed);
  if (Array.isArray(stored)) return stored as CalendarEvent[];
  // Python reseeds when the snapshot is not a list.
  const fresh = seed();
  save(KEY, fresh);
  return fresh;
}

function randomHex(digits: number): string {
  const bytes = new Uint8Array(Math.ceil(digits / 2));
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, digits);
}

/** Events overlapping the window, earliest first. */
export function listEvents(start?: number | null, end?: number | null): CalendarEvent[] {
  let rows = [...events()];
  if (start !== undefined && start !== null) rows = rows.filter((row) => row.endAt >= start);
  if (end !== undefined && end !== null) rows = rows.filter((row) => row.startAt <= end);
  // Array.prototype.sort is stable, like Python's sorted.
  return rows.sort((a, b) => a.startAt - b.startAt);
}

/**
 * Adds an event, or merges into the existing one when the id repeats.
 *
 * Meetings scheduled from a conversation carry the client's request id, so a
 * retry after an ambiguous failure updates the same row rather than putting a
 * second copy of the meeting on everyone's calendar.
 */
export function addEvent(event: Record<string, unknown>): CalendarEvent {
  const rows = events();
  // Python's setdefault: fill only keys that are absent.
  if (!('id' in event)) event.id = `cal-${randomHex(12)}`;
  if (!('createdAt' in event)) event.createdAt = nowMs();
  if (!('timeZone' in event)) event.timeZone = DEFAULT_TIME_ZONE;
  if (!('source' in event)) event.source = 'chat';

  const index = rows.findIndex((existing) => existing.id === event.id);
  if (index >= 0) {
    const merged = { ...rows[index], ...event } as CalendarEvent;
    rows[index] = merged;
    save(KEY, rows);
    return merged;
  }
  rows.push(event as CalendarEvent);
  save(KEY, rows);
  return event as CalendarEvent;
}

export function deleteEvent(eventId: string): boolean {
  const rows = events();
  const kept = rows.filter((row) => row.id !== eventId);
  const removed = kept.length !== rows.length;
  if (removed) save(KEY, kept);
  return removed;
}

/** Back to the seeded week. */
export function resetCalendar(): CalendarEvent[] {
  const fresh = seed();
  save(KEY, fresh);
  return [...fresh];
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

/** The router's EventInput model. */
function parseEventInput(raw: unknown): Record<string, unknown> {
  const loc: Loc = ['body'];
  const body = object(raw, loc);
  // Fields are checked, and keys laid out, in the model's order, as model_dump() does.
  return {
    title: text(body, 'title', loc, 140, { min: 1 }),
    description: text(body, 'description', loc, 1_000, { fallback: '' }),
    startAt: integer(body, 'startAt', loc),
    endAt: integer(body, 'endAt', loc),
    timeZone: text(body, 'timeZone', loc, 100, { fallback: DEFAULT_TIME_ZONE }),
    location: text(body, 'location', loc, 200, { fallback: '' }),
    organizerName: text(body, 'organizerName', loc, 160, { fallback: '' }),
    attendeeNames: names(body, loc),
    roomId: text(body, 'roomId', loc, 160, { fallback: '' }),
    meetingUri: text(body, 'meetingUri', loc, 500, { fallback: '' }),
  };
}

/** `attendeeNames: list[str] = Field(max_length=50)`. */
function names(body: Obj, loc: Loc): string[] {
  const values = list(body, 'attendeeNames', loc).map((name, index) =>
    checkText(name, [...loc, 'attendeeNames', index], Infinity),
  );
  if (values.length > 50) {
    invalid(
      [...loc, 'attendeeNames'],
      `List should have at most 50 items after validation, not ${values.length}`,
    );
  }
  return values;
}

/** `?start=`/`?end=` as FastAPI's `Optional[int]` query parameters. */
function queryInt(request: LocalRequest, name: string): number | null {
  const value = request.query.get(name);
  return value === null ? null : toInt(value, ['query', name]);
}

export const calendarRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/api/calendar/events',
    handle: (request) => ({
      events: listEvents(queryInt(request, 'start'), queryInt(request, 'end')),
    }),
  },
  {
    method: 'POST',
    pattern: '/api/calendar/events',
    status: 201,
    handle: ({ body }) => {
      const input = parseEventInput(body);
      if ((input.endAt as number) <= (input.startAt as number)) {
        throw new HttpError(400, 'The end time must be after the start time.');
      }
      return { event: addEvent({ ...input, source: 'manual', demo: false }) };
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/calendar/events/:id',
    handle: ({ params }) => {
      if (!deleteEvent(params.id)) {
        throw new HttpError(404, 'That event is no longer on the calendar.');
      }
      return { deleted: params.id };
    },
  },
  {
    method: 'POST',
    pattern: '/api/calendar/reset',
    handle: () => ({ events: resetCalendar() }),
  },
];
