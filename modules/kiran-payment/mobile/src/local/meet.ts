/**
 * Google Meet links and Calendar events: a port of backend/app/routers/meet.py.
 *
 * Two shapes of request arrive at POST /api/meet:
 *
 * - `{ roomId }` — an instant Meet space, for "start a call now".
 * - `{ kind: 'scheduled', ... }` — a Calendar event with a Meet link attached,
 *   invitations sent, and the event mirrored into the in-app calendar.
 *
 * Both degrade rather than fail. With no Google credentials the scheduled path
 * still returns a working `calendar.google.com/render` URL pre-filled with the
 * title, time and attendees, and the meeting still appears on the in-app
 * calendar. Google is called directly from the device through core's `http`.
 */
import { http, type HttpResult, type LocalRequest, type Route } from './core';
import {
  DEFAULT_TIME_ZONE,
  GOOGLE_CALENDAR_REFRESH_TOKEN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_MEET_REFRESH_TOKEN,
  googleConfigured,
} from './config';
import {
  addEvent,
  invalid,
  list,
  object,
  optionalInteger,
  optionalText,
  text,
  type Loc,
  type Obj,
} from './calendar';

const RATE_LIMIT = 12;
/** Seconds. */
const RATE_WINDOW = 60;
/** Milliseconds, per request. */
const GOOGLE_TIMEOUT = 10_000;
const MAX_ATTENDEES = 50;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
/** Milliseconds between re-reads while Google mints the Meet link. */
const CONFERENCE_POLL_DELAYS = [250, 500, 1000, 1500];

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SPACES_URL = 'https://meet.googleapis.com/v2/spaces';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const PLACEHOLDER_URI = 'https://meet.google.com/new';

/** Monotonic seconds, like Python's time.monotonic(). */
const monotonic = () => globalThis.performance.now() / 1000;

const hits = new Map<string, number[]>();
/** Cached per refresh token so every meeting does not re-mint a Google token. */
const tokens = new Map<string, { token: string; expires: number }>();

/** Forget rate-limit hits and cached tokens. For tests. */
export function resetMeetState(): void {
  hits.clear();
  tokens.clear();
}

class MeetError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

function rateLimited(key: string): number | null {
  const now = monotonic();
  const window = hits.get(key) ?? [];
  hits.set(key, window);
  while (window.length && now - window[0] > RATE_WINDOW) window.shift();
  if (window.length >= RATE_LIMIT) {
    return Math.max(1, Math.trunc(RATE_WINDOW - (now - window[0])));
  }
  window.push(now);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Request shapes                                                              */
/* -------------------------------------------------------------------------- */

interface Attendee {
  id: string;
  name: string;
  email: string;
}

interface Organizer {
  id: string;
  name: string;
  email: string | null;
}

interface MeetingRequest {
  kind: 'instant' | 'scheduled';
  roomId: string;
  requestId: string | null;
  title: string;
  description: string;
  startAt: number | null;
  endAt: number | null;
  timeZone: string;
  organizer: Organizer | null;
  attendees: Attendee[];
  location: string;
}

function parseAttendee(raw: unknown, loc: Loc): Attendee {
  const o = object(raw, loc, 'Attendee');
  const id = text(o, 'id', loc, 160, { min: 1 });
  const name = text(o, 'name', loc, 160, { min: 1 });
  // Length is checked before the validator strips, as pydantic orders them.
  const email = text(o, 'email', loc, 254, { min: 3 }).trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    invalid([...loc, 'email'], 'Value error, Each attendee needs a valid calendar email');
  }
  return { id, name, email };
}

function parseOrganizer(raw: unknown, loc: Loc): Organizer | null {
  if (raw === undefined || raw === null) return null;
  const o = object(raw, loc, 'Organizer');
  return {
    id: text(o, 'id', loc, 160, { min: 1 }),
    name: text(o, 'name', loc, 160, { min: 1 }),
    email: optionalText(o, 'email', loc, 254),
  };
}

/** The MeetingRequest model: a 422 with pydantic's wording when it does not fit. */
function parseMeetingRequest(raw: unknown): MeetingRequest {
  const loc: Loc = ['body'];
  const body = object(raw, loc);
  const kind = body.kind === undefined ? 'instant' : body.kind;
  if (kind !== 'instant' && kind !== 'scheduled') {
    invalid([...loc, 'kind'], "Input should be 'instant' or 'scheduled'");
  }
  return {
    kind,
    roomId: text(body, 'roomId', loc, 160, { fallback: '' }),
    requestId: optionalText(body, 'requestId', loc, 128),
    title: text(body, 'title', loc, 120, { fallback: '' }),
    description: text(body, 'description', loc, 1_000, { fallback: '' }),
    startAt: optionalInteger(body, 'startAt', loc),
    endAt: optionalInteger(body, 'endAt', loc),
    timeZone: text(body, 'timeZone', loc, 100, { fallback: DEFAULT_TIME_ZONE }),
    organizer: parseOrganizer(body.organizer, [...loc, 'organizer']),
    attendees: list(body, 'attendees', loc).map((item, index) =>
      parseAttendee(item, [...loc, 'attendees', index]),
    ),
    location: text(body, 'location', loc, 200, { fallback: '' }),
  };
}

function validateScheduled(body: MeetingRequest): void {
  if (!body.title.trim()) throw new MeetError('Meeting title is required', 400);
  if (body.startAt === null || body.endAt === null) {
    throw new MeetError('Meeting needs a start and an end time', 400);
  }
  if (body.startAt <= Date.now()) {
    throw new MeetError('Meeting start time must be in the future', 400);
  }
  if (body.endAt <= body.startAt) {
    throw new MeetError('Meeting end time must be after its start time', 400);
  }
  if (body.endAt - body.startAt > MAX_DURATION_MS) {
    throw new MeetError('Meeting duration cannot exceed 24 hours', 400);
  }
  if (!body.attendees.length) throw new MeetError('Select at least one attendee', 400);
  if (body.attendees.length > MAX_ATTENDEES) {
    throw new MeetError(`A meeting can have at most ${MAX_ATTENDEES} attendees`, 400);
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function unique(attendees: Attendee[]): Attendee[] {
  const seen = new Set<string>();
  return attendees.filter((attendee) => {
    const key = attendee.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A string as Python's json.dumps writes it (ensure_ascii: everything past `~` escaped). */
function pyString(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007f-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/**
 * What the event id is derived from. Byte for byte what Python's
 * `json.dumps(..., sort_keys=True)` produces, so the same meeting gets the same
 * Google event id from either server.
 */
function requestSeed(body: MeetingRequest): string {
  if (body.requestId) return body.requestId;
  const emails = unique(body.attendees)
    .map((attendee) => attendee.email.toLowerCase())
    .sort()
    .map(pyString);
  const int = (value: number | null) => (value === null ? 'null' : String(value));
  return (
    `{"attendees": [${emails.join(', ')}], "endAt": ${int(body.endAt)}, ` +
    `"roomId": ${pyString(body.roomId)}, "startAt": ${int(body.startAt)}, ` +
    `"title": ${pyString(body.title)}}`
  );
}

/** Calendar event ids accept only lowercase base32hex characters. */
function eventIdFor(seed: string): string {
  const normalized = seed
    .toLowerCase()
    .replace(/[^a-v0-9]/g, '')
    .slice(0, 28);
  return `meet${normalized}${sha256Hex(seed)}`.slice(0, 64);
}

/** `datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()`. */
function pyIsoUtc(ms: number): string {
  const base = new Date(ms).toISOString().slice(0, 19);
  const fraction = ((ms % 1000) + 1000) % 1000;
  return `${base}${fraction ? `.${String(fraction * 1000).padStart(6, '0')}` : ''}+00:00`;
}

/** `%Y%m%dT%H%M%SZ` in UTC. */
function compactUtc(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

/** urllib's quote_plus: only letters, digits and `_.-~` stay bare; spaces become `+`. */
function quotePlus(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

/**
 * A real Google Calendar "add event" URL, pre-filled. Not a mock: it opens
 * Google Calendar with the title, window, description and guests filled in, and
 * the presenter can save it. It does not create the event on the company
 * calendar — that needs the credentials.
 */
function demoCalendarUri(body: MeetingRequest, meetingUri: string): string {
  const params: [string, string][] = [
    ['action', 'TEMPLATE'],
    ['text', body.title],
    ['dates', `${compactUtc(body.startAt ?? 0)}/${compactUtc(body.endAt ?? 0)}`],
    ['stz', body.timeZone],
    ['etz', body.timeZone],
    ['details', [body.description, `Join Google Meet: ${meetingUri}`].filter(Boolean).join('\n\n')],
    ['location', body.location || meetingUri],
    ...unique(body.attendees).map((attendee): [string, string] => ['add', attendee.email]),
  ];
  const query = params.map(([key, value]) => `${quotePlus(key)}=${quotePlus(value)}`).join('&');
  return `https://calendar.google.com/calendar/render?${query}`;
}

const record = (value: unknown): Obj =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {};

/** Google could not be reached: `timedOut` is httpx's TimeoutException, otherwise HTTPError. */
class Unreachable extends Error {
  constructor(readonly timedOut: boolean) {
    super(timedOut ? 'timeout' : 'network');
  }
}

/** One call to Google, bounded by the same 10 s timeout httpx was given. */
async function google(url: string, options: Parameters<typeof http>[1]): Promise<HttpResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Unreachable(true)), GOOGLE_TIMEOUT);
  });
  try {
    return await Promise.race([http(url, options), timeout]);
  } catch (error) {
    throw error instanceof Unreachable ? error : new Unreachable(false);
  } finally {
    clearTimeout(timer);
  }
}

async function accessToken(refreshToken: string): Promise<string> {
  const cached = tokens.get(refreshToken);
  if (cached && cached.expires > monotonic()) return cached.token;

  let response: HttpResult;
  try {
    response = await google(TOKEN_URL, {
      method: 'POST',
      form: {
        grant_type: 'refresh_token',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
      },
    });
  } catch (error) {
    throw (error as Unreachable).timedOut
      ? new MeetError('Google sign-in took too long. Try again.', 504)
      : new MeetError('Could not reach Google to sign in.', 502);
  }

  if ([400, 401, 403].includes(response.status)) {
    // Never surface the token endpoint body: it can echo credential material.
    throw new MeetError('Google credentials are invalid or the refresh token was revoked.', 401);
  }
  if (response.status === 429) {
    throw new MeetError('Google rate limit reached. Try again shortly.', 429, 5);
  }
  if (response.status >= 400) throw new MeetError('Google rejected the sign-in request.', 502);

  const data = record(response.data);
  const token = data.access_token;
  if (typeof token !== 'string' || !token) {
    throw new MeetError('Google returned no access token.', 502);
  }

  // Refresh a minute early so a token never expires mid-request.
  const expiresIn = Math.trunc(Number(data.expires_in ?? 3600));
  const ttl = Math.max(60, Number.isFinite(expiresIn) ? expiresIn : 3600) - 60;
  tokens.set(refreshToken, { token, expires: monotonic() + ttl });
  return token;
}

function googleError(status: number, service: string): MeetError {
  if (status === 401) {
    tokens.clear();
    return new MeetError('Google credentials are invalid or the refresh token was revoked.', 401);
  }
  if (status === 403)
    return new MeetError(`${service} access is not configured for this project.`, 403);
  if (status === 429)
    return new MeetError(`${service} rate limit reached. Try again shortly.`, 429, 5);
  if (status >= 500) return new MeetError(`${service} is temporarily unavailable.`, 502);
  return new MeetError(`${service} rejected the request.`, 400);
}

/* -------------------------------------------------------------------------- */
/* Google adapters                                                             */
/* -------------------------------------------------------------------------- */

interface InstantResult {
  meetingUri: string;
  meetingCode: string;
  demo: boolean;
}

interface ScheduledResult {
  meetingUri: string;
  eventId: string;
  calendarUri: string;
  demo: boolean;
}

async function instantSpace(token: string): Promise<InstantResult> {
  let response: HttpResult;
  try {
    response = await google(SPACES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      json: {},
    });
  } catch (error) {
    throw (error as Unreachable).timedOut
      ? new MeetError('Google Meet took too long to create a link.', 504)
      : new MeetError('Could not connect to Google Meet.', 502);
  }

  if (response.status >= 400) throw googleError(response.status, 'Google Meet');

  const space = record(response.data);
  if (!space.meetingUri) throw new MeetError('Google Meet returned no meeting link.', 502);
  return {
    meetingUri: String(space.meetingUri),
    meetingCode: String(space.meetingCode ?? ''),
    demo: false,
  };
}

function meetingUriFrom(event: Obj): string | null {
  let candidate = event.hangoutLink;
  if (!candidate) {
    const entryPoints = record(event.conferenceData).entryPoints;
    for (const entry of Array.isArray(entryPoints) ? entryPoints : []) {
      if (record(entry).entryPointType === 'video') {
        candidate = record(entry).uri;
        break;
      }
    }
  }
  if (typeof candidate !== 'string' || !candidate.startsWith('https://meet.google.com/')) {
    return null;
  }
  return candidate;
}

async function getEvent(token: string, eventId: string): Promise<Obj> {
  const query = new URLSearchParams({ fields: 'id,htmlLink,hangoutLink,conferenceData' });
  const response = await google(`${EVENTS_URL}/${eventId}?${query}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status >= 400) throw googleError(response.status, 'Google Calendar');
  return record(response.data);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function scheduledEvent(token: string, body: MeetingRequest): Promise<ScheduledResult> {
  const attendees = unique(body.attendees);
  const eventId = eventIdFor(requestSeed(body));

  const payload: Obj = {
    id: eventId,
    summary: body.title,
    start: { dateTime: pyIsoUtc(body.startAt ?? 0), timeZone: body.timeZone },
    end: { dateTime: pyIsoUtc(body.endAt ?? 0), timeZone: body.timeZone },
    attendees: attendees.map((attendee) => ({ email: attendee.email, displayName: attendee.name })),
    conferenceData: {
      createRequest: {
        requestId: body.requestId || eventId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: { useDefault: true },
    extendedProperties: { private: { kiranRoomId: body.roomId } },
  };
  if (body.description) payload.description = body.description;
  if (body.location) payload.location = body.location;

  let event: Obj;
  try {
    const query = new URLSearchParams({ conferenceDataVersion: '1', sendUpdates: 'all' });
    const response = await google(`${EVENTS_URL}?${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      json: payload,
    });

    if (response.status === 409) {
      // The stable event id turns an ambiguous retry into a read, rather than
      // a second copy of the meeting.
      event = await getEvent(token, eventId);
    } else if (response.status >= 400) {
      throw googleError(response.status, 'Google Calendar');
    } else {
      event = record(response.data);
    }

    // The Meet link is minted asynchronously; poll briefly for it.
    for (const wait of CONFERENCE_POLL_DELAYS) {
      if (meetingUriFrom(event)) break;
      const status = record(record(record(event.conferenceData).createRequest).status);
      if (status.statusCode === 'failure') {
        throw new MeetError(
          'Google Calendar created the event but could not attach a Meet link.',
          502,
        );
      }
      await sleep(wait);
      event = await getEvent(token, eventId);
    }
  } catch (error) {
    if (error instanceof Unreachable) {
      throw error.timedOut
        ? new MeetError('Google Calendar took too long. Retry with the same request.', 504)
        : new MeetError('Could not connect to Google Calendar.', 502);
    }
    throw error;
  }

  const meetingUri = meetingUriFrom(event);
  if (!meetingUri) {
    throw new MeetError(
      'Google Calendar created the event, but its Meet link is still being prepared.',
      503,
      2,
    );
  }

  return {
    meetingUri,
    eventId: 'id' in event ? (event.id as string) : eventId,
    calendarUri: 'htmlLink' in event ? (event.htmlLink as string) : '',
    demo: false,
  };
}

function demoScheduled(body: MeetingRequest): ScheduledResult {
  return {
    meetingUri: PLACEHOLDER_URI,
    eventId: eventIdFor(requestSeed(body)),
    calendarUri: demoCalendarUri(body, PLACEHOLDER_URI),
    demo: true,
  };
}

const demoInstant = (): InstantResult => ({
  meetingUri: PLACEHOLDER_URI,
  meetingCode: 'new',
  demo: true,
});

/** Mirrors the meeting onto the in-app calendar. */
function recordMeeting(body: MeetingRequest, result: ScheduledResult): void {
  const organizer = body.organizer;
  const attendees = unique(body.attendees);
  addEvent({
    id: body.requestId || result.eventId,
    title: body.title,
    description: body.description,
    startAt: body.startAt,
    endAt: body.endAt,
    timeZone: body.timeZone,
    organizerName: organizer ? organizer.name : '',
    organizerId: organizer ? organizer.id : '',
    attendeeNames: attendees.map((attendee) => attendee.name),
    attendeeIds: attendees.map((attendee) => attendee.id),
    roomId: body.roomId,
    location: body.location,
    meetingUri: result.meetingUri,
    calendarUri: result.calendarUri ?? '',
    googleEventId: result.eventId ?? '',
    demo: result.demo ?? false,
    source: 'chat',
  });
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

/** A JSONResponse: meet.py answers errors as `{ error }`, not FastAPI's `{ detail }`. */
function reply(body: unknown, status = 200, retryAfter?: number): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  return new Response(JSON.stringify(body), { status, headers });
}

async function createMeeting(request: LocalRequest): Promise<Response> {
  // FastAPI validates the body before the handler runs, so a 422 comes first.
  const body = parseMeetingRequest(request.body);

  // Python keys the limit by client address; in the app there is one client.
  const retryAfter = rateLimited('local');
  if (retryAfter !== null) {
    return reply(
      { error: `Too many meetings created. Try again in ${retryAfter}s.` },
      429,
      retryAfter,
    );
  }

  const scheduled = body.kind === 'scheduled';
  if (scheduled) {
    try {
      validateScheduled(body);
    } catch (error) {
      if (error instanceof MeetError) return reply({ error: error.message }, error.status);
      throw error;
    }
  }

  const fallback = () => {
    if (!scheduled) return reply(demoInstant());
    const result = demoScheduled(body);
    recordMeeting(body, result);
    return reply(result);
  };

  if (!googleConfigured(scheduled ? 'calendar' : 'meet')) return fallback();

  const refresh = scheduled ? GOOGLE_CALENDAR_REFRESH_TOKEN : GOOGLE_MEET_REFRESH_TOKEN;
  try {
    const token = await accessToken(refresh);
    if (!scheduled) return reply(await instantSpace(token));
    const result = await scheduledEvent(token, body);
    recordMeeting(body, result);
    return reply(result);
  } catch (error) {
    if (!(error instanceof MeetError)) throw error;
    // Bad or revoked credentials should not stop a demonstration: fall back to
    // the same path a device with no credentials at all would take.
    if (error.status === 401 || error.status === 403) return fallback();
    return reply({ error: error.message }, error.status, error.retryAfter);
  }
}

export const meetRoutes: Route[] = [
  { method: 'POST', pattern: '/api/meet', handle: createMeeting },
  {
    method: 'GET',
    pattern: '/api/meet/status',
    handle: () => ({
      calendar: googleConfigured('calendar'),
      meet: googleConfigured('meet'),
      timeZone: DEFAULT_TIME_ZONE,
    }),
  },
];

/* -------------------------------------------------------------------------- */
/* SHA-256                                                                     */
/* -------------------------------------------------------------------------- */

/*
 * The event id needs Python's hashlib.sha256. Web Crypto's digest is async and
 * missing outside secure contexts, so this is the plain FIPS 180-4 algorithm.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** Hex SHA-256 of the UTF-8 bytes of `message`. Exported for tests. */
export function sha256Hex(message: string): string {
  const data = new TextEncoder().encode(message);
  const padded = new Uint8Array((((data.length + 9 + 63) / 64) | 0) * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = data.length * 8;
  view.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(padded.length - 4, bits >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 =
        (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += k;
  }
  return [...h].map((word) => word.toString(16).padStart(8, '0')).join('');
}
