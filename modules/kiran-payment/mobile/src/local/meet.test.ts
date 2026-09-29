import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch } from '~/local/core';
import { calendarRoutes, type CalendarEvent } from '~/local/calendar';
import { meetRoutes, resetMeetState, sha256Hex } from '~/local/meet';

/** Which Google credentials the build "has": flipped per test. */
const google = vi.hoisted(() => ({ calendar: false, meet: false }));

vi.mock('./config', () => ({
  DEFAULT_TIME_ZONE: 'Asia/Kolkata',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALENDAR_REFRESH_TOKEN: 'calendar-refresh',
  GOOGLE_MEET_REFRESH_TOKEN: 'meet-refresh',
  googleConfigured: (kind: 'calendar' | 'meet' = 'calendar') => google[kind],
}));

interface Sent {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** A canned Google: `answer` picks the reply for each outbound request, which is recorded. */
function stubGoogle(answer: (request: Sent) => { status?: number; json: unknown }) {
  const sent: Sent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const request: Sent = {
        url: new URL(input),
        method: init.method ?? 'GET',
        headers: (init.headers ?? {}) as Record<string, string>,
        body: init.body as string | undefined,
      };
      sent.push(request);
      const { status = 200, json } = answer(request);
      return new Response(JSON.stringify(json), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return sent;
}

const TOKEN = { access_token: 'access-1', expires_in: 3599, token_type: 'Bearer' };
const isToken = (r: Sent) => r.url.href === 'https://oauth2.googleapis.com/token';
const isInsert = (r: Sent) =>
  r.method === 'POST' &&
  r.url.origin + r.url.pathname ===
    'https://www.googleapis.com/calendar/v3/calendars/primary/events';

const post = async (body: unknown) => {
  const response = await dispatch(meetRoutes, 'POST', '/api/meet', body);
  return { status: response.status, headers: response.headers, data: await response.json() };
};

const calendarEvents = async () => {
  const response = await dispatch(calendarRoutes, 'GET', '/api/calendar/events', undefined);
  return (await response.json()).events as CalendarEvent[];
};

/** Python's `_event_id`, computed independently. */
const pythonEventId = (seed: string) =>
  `meet${seed
    .toLowerCase()
    .replace(/[^a-v0-9]/g, '')
    .slice(0, 28)}${createHash('sha256').update(seed, 'utf8').digest('hex')}`.slice(0, 64);

const HOUR = 3_600_000;
const startAt = Date.UTC(2031, 0, 15, 4, 30); // 10:00 IST
const endAt = startAt + HOUR;

const scheduled = (overrides: Record<string, unknown> = {}) => ({
  kind: 'scheduled',
  requestId: 'meeting-abc123',
  roomId: 'room-ops',
  title: 'Q3 review',
  description: 'Pricing & stock',
  startAt,
  endAt,
  timeZone: 'Asia/Kolkata',
  organizer: { id: 'u1', name: 'Suresh Menon', email: 'suresh@example.com' },
  attendees: [
    { id: 'u2', name: 'Priya Nair', email: 'priya@example.com' },
    { id: 'u3', name: 'Vikram Shah', email: ' vikram@example.com ' },
    // The same person twice, differently cased: invited once.
    { id: 'u2b', name: 'Priya again', email: 'PRIYA@example.com' },
  ],
  ...overrides,
});

beforeEach(() => {
  resetMeetState();
  google.calendar = false;
  google.meet = false;
});

describe('sha256Hex', () => {
  it('matches hashlib for short, multi-block and non-ASCII input', () => {
    for (const input of ['', 'abc', 'x'.repeat(55), 'y'.repeat(64), 'z'.repeat(200), 'कैलेंडर €']) {
      expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
    }
  });
});

describe('GET /api/meet/status', () => {
  it('reports which Google credentials are configured', async () => {
    google.calendar = true;
    const response = await dispatch(meetRoutes, 'GET', '/api/meet/status', undefined);
    expect(await response.json()).toEqual({
      calendar: true,
      meet: false,
      timeZone: 'Asia/Kolkata',
    });
  });
});

describe('an instant meeting', () => {
  it('answers with a placeholder link when Google is not configured', async () => {
    const sent = stubGoogle(() => ({ json: {} }));
    const { status, data } = await post({ roomId: 'room-1' });
    expect(status).toBe(200);
    expect(data).toEqual({
      meetingUri: 'https://meet.google.com/new',
      meetingCode: 'new',
      demo: true,
    });
    expect(sent).toHaveLength(0);
  });

  it('mints a token and creates a Meet space when configured', async () => {
    google.meet = true;
    const sent = stubGoogle((request) =>
      isToken(request)
        ? { json: TOKEN }
        : {
            json: {
              name: 'spaces/abc',
              meetingUri: 'https://meet.google.com/abc-defg-hij',
              meetingCode: 'abc-defg-hij',
            },
          },
    );
    const { status, data } = await post({ roomId: 'room-1' });
    expect(status).toBe(200);
    expect(data).toEqual({
      meetingUri: 'https://meet.google.com/abc-defg-hij',
      meetingCode: 'abc-defg-hij',
      demo: false,
    });

    const [token, space] = sent;
    expect(token!.method).toBe('POST');
    expect(token!.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(new URLSearchParams(token!.body))).toEqual({
      grant_type: 'refresh_token',
      client_id: 'client-id',
      client_secret: 'client-secret',
      refresh_token: 'meet-refresh',
    });
    expect(space!.url.href).toBe('https://meet.googleapis.com/v2/spaces');
    expect(space!.headers.Authorization).toBe('Bearer access-1');
    expect(space!.body).toBe('{}');

    // The token is cached: a second meeting does not sign in again.
    await post({ roomId: 'room-1' });
    expect(sent.filter(isToken)).toHaveLength(1);
  });

  it('falls back to the placeholder when the credentials are revoked', async () => {
    google.meet = true;
    stubGoogle(() => ({ status: 400, json: { error: 'invalid_grant' } }));
    const { status, data } = await post({ roomId: 'room-1' });
    expect(status).toBe(200);
    expect(data.demo).toBe(true);
  });

  it('passes Google rate limits through with Retry-After', async () => {
    google.meet = true;
    stubGoogle((request) => (isToken(request) ? { json: TOKEN } : { status: 429, json: {} }));
    const { status, headers, data } = await post({ roomId: 'room-1' });
    expect(status).toBe(429);
    expect(headers.get('Retry-After')).toBe('5');
    expect(data).toEqual({ error: 'Google Meet rate limit reached. Try again shortly.' });
  });

  it('allows twelve meetings a minute, then answers 429', async () => {
    for (let i = 0; i < 12; i++) expect((await post({ roomId: 'room-1' })).status).toBe(200);
    const { status, headers, data } = await post({ roomId: 'room-1' });
    expect(status).toBe(429);
    const retry = Number(headers.get('Retry-After'));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(data.error).toBe(`Too many meetings created. Try again in ${retry}s.`);
  });
});

describe('a scheduled meeting', () => {
  it('in demo mode returns a pre-filled Google Calendar link and lands on the in-app calendar', async () => {
    const sent = stubGoogle(() => ({ json: {} }));
    const { status, data } = await post(scheduled());
    expect(status).toBe(200);
    expect(sent).toHaveLength(0);
    expect(data.meetingUri).toBe('https://meet.google.com/new');
    expect(data.eventId).toBe(pythonEventId('meeting-abc123'));
    expect(data.demo).toBe(true);
    // Exactly what urllib.parse.urlencode produces for these values.
    expect(data.calendarUri).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Q3+review' +
        '&dates=20310115T043000Z%2F20310115T053000Z&stz=Asia%2FKolkata&etz=Asia%2FKolkata' +
        '&details=Pricing+%26+stock%0A%0AJoin+Google+Meet%3A+https%3A%2F%2Fmeet.google.com%2Fnew' +
        '&location=https%3A%2F%2Fmeet.google.com%2Fnew' +
        '&add=priya%40example.com&add=vikram%40example.com',
    );

    const event = (await calendarEvents()).find((row) => row.id === 'meeting-abc123');
    expect(event).toMatchObject({
      title: 'Q3 review',
      description: 'Pricing & stock',
      startAt,
      endAt,
      timeZone: 'Asia/Kolkata',
      organizerName: 'Suresh Menon',
      organizerId: 'u1',
      attendeeNames: ['Priya Nair', 'Vikram Shah'],
      attendeeIds: ['u2', 'u3'],
      roomId: 'room-ops',
      location: '',
      meetingUri: 'https://meet.google.com/new',
      calendarUri: data.calendarUri,
      googleEventId: data.eventId,
      demo: true,
      source: 'chat',
    });
  });

  it('derives the event id from the same JSON seed as Python when there is no requestId', async () => {
    stubGoogle(() => ({ json: {} }));
    const { data } = await post(scheduled({ requestId: undefined, title: 'Rückblick' }));
    const seed =
      `{"attendees": ["priya@example.com", "vikram@example.com"], "endAt": ${endAt}, ` +
      `"roomId": "room-ops", "startAt": ${startAt}, "title": "R\\u00fcckblick"}`;
    expect(data.eventId).toBe(pythonEventId(seed));
    // With no request id the calendar row is keyed by the event id.
    expect((await calendarEvents()).some((row) => row.id === data.eventId)).toBe(true);
  });

  it('is idempotent on requestId in demo mode', async () => {
    stubGoogle(() => ({ json: {} }));
    const first = await post(scheduled());
    const second = await post(scheduled({ title: 'Q3 review (moved)' }));
    expect(second.data.eventId).toBe(first.data.eventId);
    const rows = (await calendarEvents()).filter((row) => row.id === 'meeting-abc123');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('Q3 review (moved)');
  });

  it('when configured, inserts a Calendar event with a Meet conference and invitations', async () => {
    google.calendar = true;
    const eventId = pythonEventId('meeting-abc123');
    const created = {
      id: eventId,
      htmlLink: 'https://www.google.com/calendar/event?eid=xyz',
      hangoutLink: 'https://meet.google.com/qrs-tuvw-xyz',
    };
    const sent = stubGoogle((request) => (isToken(request) ? { json: TOKEN } : { json: created }));

    const { status, data } = await post(scheduled({ location: 'Plant 2' }));
    expect(status).toBe(200);
    expect(data).toEqual({
      meetingUri: 'https://meet.google.com/qrs-tuvw-xyz',
      eventId,
      calendarUri: 'https://www.google.com/calendar/event?eid=xyz',
      demo: false,
    });

    expect(new URLSearchParams(sent[0]!.body).get('refresh_token')).toBe('calendar-refresh');
    const insert = sent[1]!;
    expect(isInsert(insert)).toBe(true);
    expect(Object.fromEntries(insert.url.searchParams)).toEqual({
      conferenceDataVersion: '1',
      sendUpdates: 'all',
    });
    expect(insert.headers.Authorization).toBe('Bearer access-1');
    expect(JSON.parse(insert.body!)).toEqual({
      id: eventId,
      summary: 'Q3 review',
      start: { dateTime: '2031-01-15T04:30:00+00:00', timeZone: 'Asia/Kolkata' },
      end: { dateTime: '2031-01-15T05:30:00+00:00', timeZone: 'Asia/Kolkata' },
      attendees: [
        { email: 'priya@example.com', displayName: 'Priya Nair' },
        { email: 'vikram@example.com', displayName: 'Vikram Shah' },
      ],
      conferenceData: {
        createRequest: {
          requestId: 'meeting-abc123',
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: { useDefault: true },
      extendedProperties: { private: { kiranRoomId: 'room-ops' } },
      description: 'Pricing & stock',
      location: 'Plant 2',
    });

    const event = (await calendarEvents()).find((row) => row.id === 'meeting-abc123');
    expect(event).toMatchObject({
      meetingUri: 'https://meet.google.com/qrs-tuvw-xyz',
      calendarUri: 'https://www.google.com/calendar/event?eid=xyz',
      googleEventId: eventId,
      location: 'Plant 2',
      demo: false,
    });
  });

  it('when configured, a repeat of the same requestId reads the existing event back', async () => {
    google.calendar = true;
    const eventId = pythonEventId('meeting-abc123');
    const existing = {
      id: eventId,
      htmlLink: 'https://www.google.com/calendar/event?eid=xyz',
      conferenceData: {
        entryPoints: [
          { entryPointType: 'phone', uri: 'tel:+1-555' },
          { entryPointType: 'video', uri: 'https://meet.google.com/qrs-tuvw-xyz' },
        ],
      },
    };
    let inserts = 0;
    const sent = stubGoogle((request) => {
      if (isToken(request)) return { json: TOKEN };
      if (isInsert(request)) return inserts++ ? { status: 409, json: {} } : { json: existing };
      return { json: existing };
    });

    const first = await post(scheduled());
    const second = await post(scheduled());
    expect(second.data).toEqual(first.data);
    expect(second.data.meetingUri).toBe('https://meet.google.com/qrs-tuvw-xyz');

    const read = sent.at(-1)!;
    expect(read.method).toBe('GET');
    expect(read.url.pathname).toBe(`/calendar/v3/calendars/primary/events/${eventId}`);
    expect(read.url.searchParams.get('fields')).toBe('id,htmlLink,hangoutLink,conferenceData');
    expect(sent.filter(isToken)).toHaveLength(1);
    expect((await calendarEvents()).filter((row) => row.id === 'meeting-abc123')).toHaveLength(1);
  });

  it('when configured, polls until Google attaches the Meet link', async () => {
    google.calendar = true;
    let reads = 0;
    const sent = stubGoogle((request) => {
      if (isToken(request)) return { json: TOKEN };
      if (isInsert(request)) {
        return {
          json: {
            id: 'e1',
            conferenceData: { createRequest: { status: { statusCode: 'pending' } } },
          },
        };
      }
      reads++;
      return {
        json: { id: 'e1', htmlLink: 'h', hangoutLink: 'https://meet.google.com/late-link' },
      };
    });
    const { status, data } = await post(scheduled());
    expect(status).toBe(200);
    expect(data.meetingUri).toBe('https://meet.google.com/late-link');
    expect(reads).toBe(1);
    expect(sent).toHaveLength(3);
  });

  it('falls back to demo when the Calendar credentials are refused', async () => {
    google.calendar = true;
    stubGoogle((request) => (isToken(request) ? { json: TOKEN } : { status: 403, json: {} }));
    const { status, data } = await post(scheduled());
    expect(status).toBe(200);
    expect(data.demo).toBe(true);
    expect(data.calendarUri).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect((await calendarEvents()).some((row) => row.id === 'meeting-abc123')).toBe(true);
  });

  it('refuses a meeting that cannot be scheduled with an { error } body', async () => {
    stubGoogle(() => ({ json: {} }));
    const cases: [Record<string, unknown>, string][] = [
      [{ title: '  ' }, 'Meeting title is required'],
      [{ endAt: undefined }, 'Meeting needs a start and an end time'],
      [
        { startAt: Date.now() - HOUR, endAt: Date.now() },
        'Meeting start time must be in the future',
      ],
      [{ endAt: startAt }, 'Meeting end time must be after its start time'],
      [{ endAt: startAt + 25 * HOUR }, 'Meeting duration cannot exceed 24 hours'],
      [{ attendees: [] }, 'Select at least one attendee'],
    ];
    for (const [overrides, error] of cases) {
      const { status, data } = await post(scheduled(overrides));
      expect(status).toBe(400);
      expect(data).toEqual({ error });
    }
    expect(await calendarEvents()).toHaveLength(5);
  });

  it('rejects malformed bodies with a 422 detail, as pydantic does', async () => {
    const cases: [unknown, string][] = [
      [undefined, 'body: Field required'],
      [{ kind: 'later' }, "body.kind: Input should be 'instant' or 'scheduled'"],
      [
        scheduled({ attendees: [{ id: 'u2', name: 'Priya', email: 'not-an-email' }] }),
        'body.attendees.0.email: Value error, Each attendee needs a valid calendar email',
      ],
      [
        scheduled({ title: 'x'.repeat(121) }),
        'body.title: String should have at most 120 characters',
      ],
      [
        scheduled({ startAt: 'tomorrow' }),
        'body.startAt: Input should be a valid integer, unable to parse string as an integer',
      ],
      [
        scheduled({ organizer: { id: '', name: 'n' } }),
        'body.organizer.id: String should have at least 1 character',
      ],
    ];
    for (const [body, detail] of cases) {
      const { status, data } = await post(body);
      expect(status).toBe(422);
      expect(data).toEqual({ detail });
    }
  });
});
