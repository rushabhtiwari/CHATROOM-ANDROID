/**
 * The calendar's data layer.
 *
 * Meetings scheduled from a conversation are written server-side by the
 * meetings endpoint, so this only ever reads them back and adds the blocks
 * someone types in directly. Two people looking at the same week see the same
 * week, which is the whole reason it is not kept in the browser.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  /** Epoch milliseconds. */
  startAt: number;
  endAt: number;
  timeZone: string;
  location?: string;
  organizerName?: string;
  organizerId?: string;
  attendeeNames?: string[];
  attendeeIds?: string[];
  /** Set when the meeting came out of a conversation. */
  roomId?: string;
  meetingUri?: string;
  calendarUri?: string;
  googleEventId?: string;
  /** True when Google was unreachable and the link is a placeholder. */
  demo?: boolean;
  source?: 'seed' | 'chat' | 'manual';
  createdAt?: number;
}

export interface NewCalendarEvent {
  title: string;
  description?: string;
  startAt: number;
  endAt: number;
  timeZone: string;
  location?: string;
  organizerName?: string;
  attendeeNames?: string[];
  roomId?: string;
  meetingUri?: string;
}

const BASE = '/api/calendar';

export class CalendarError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: init?.body
        ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
        : init?.headers,
    });
  } catch {
    throw new CalendarError('Cannot reach the server. Is the API running on :3001?');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new CalendarError(payload.detail ?? 'The calendar request was refused.');
  }
  return (await response.json()) as T;
}

export async function listEvents(start: number, end: number): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({ start: String(start), end: String(end) });
  const { events } = await request<{ events: CalendarEvent[] }>(`/events?${query}`);
  return events;
}

export async function createEvent(input: NewCalendarEvent): Promise<CalendarEvent> {
  const { event } = await request<{ event: CalendarEvent }>('/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return event;
}

export async function deleteEvent(id: string): Promise<void> {
  await request(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
