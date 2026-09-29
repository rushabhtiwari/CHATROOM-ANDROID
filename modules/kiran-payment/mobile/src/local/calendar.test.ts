import { describe, expect, it } from 'vitest';
import { dispatch } from '~/local/core';
import { addEvent, calendarRoutes, type CalendarEvent } from '~/local/calendar';

const call = async (method: string, url: string, body?: unknown) => {
  const response = await dispatch(calendarRoutes, method, url, body);
  return { status: response.status, data: await response.json() };
};

const HOUR = 3_600_000;
const IST = 5.5 * HOUR;

describe('the in-app calendar', () => {
  it('seeds a working week relative to today, in IST, earliest first', async () => {
    const { status, data } = await call('GET', '/api/calendar/events');
    expect(status).toBe(200);
    const events = data.events as CalendarEvent[];
    expect(events.map((event) => event.id)).toEqual([
      'cal-seed-standup',
      'cal-seed-vendor',
      'cal-seed-mis',
      'cal-seed-reimbursement',
      'cal-seed-dispatch',
    ]);
    const standup = events[0]!;
    const wall = new Date(standup.startAt + IST);
    expect([wall.getUTCHours(), wall.getUTCMinutes()]).toEqual([9, 30]);
    const today = new Date(Date.now() + IST);
    expect(wall.getUTCDate()).toBe(today.getUTCDate());
    expect(standup.endAt - standup.startAt).toBe(30 * 60_000);
    expect(standup.timeZone).toBe('Asia/Kolkata');
    expect(standup.source).toBe('seed');
  });

  it('lists only the events overlapping the requested window', async () => {
    const all = (await call('GET', '/api/calendar/events')).data.events as CalendarEvent[];
    const [, vendor, mis] = all;
    const { data } = await call(
      'GET',
      `/api/calendar/events?start=${vendor!.startAt}&end=${mis!.startAt}`,
    );
    expect(data.events.map((event: CalendarEvent) => event.id)).toEqual([
      'cal-seed-vendor',
      'cal-seed-mis',
    ]);
  });

  it('rejects a window that is not an integer as FastAPI would', async () => {
    const { status, data } = await call('GET', '/api/calendar/events?start=soon');
    expect(status).toBe(422);
    expect(data.detail).toBe(
      'query.start: Input should be a valid integer, unable to parse string as an integer',
    );
  });

  it('creates a manual event with 201 and the model defaults', async () => {
    const startAt = Date.now() + 2 * HOUR;
    const { status, data } = await call('POST', '/api/calendar/events', {
      title: 'Line trial',
      startAt,
      endAt: startAt + HOUR,
      timeZone: 'Asia/Kolkata',
      attendeeNames: ['Priya Nair'],
    });
    expect(status).toBe(201);
    expect(data.event).toMatchObject({
      title: 'Line trial',
      description: '',
      startAt,
      endAt: startAt + HOUR,
      timeZone: 'Asia/Kolkata',
      location: '',
      organizerName: '',
      attendeeNames: ['Priya Nair'],
      roomId: '',
      meetingUri: '',
      source: 'manual',
      demo: false,
    });
    expect(data.event.id).toMatch(/^cal-[0-9a-f]{12}$/);
    expect(typeof data.event.createdAt).toBe('number');

    const listed = (await call('GET', '/api/calendar/events')).data.events as CalendarEvent[];
    expect(listed.some((event) => event.id === data.event.id)).toBe(true);
  });

  it('refuses an end before the start, and a body pydantic would reject', async () => {
    const startAt = Date.now();
    const backwards = await call('POST', '/api/calendar/events', {
      title: 'Backwards',
      startAt,
      endAt: startAt,
    });
    expect(backwards).toEqual({
      status: 400,
      data: { detail: 'The end time must be after the start time.' },
    });

    const untitled = await call('POST', '/api/calendar/events', { title: '', startAt, endAt: 1 });
    expect(untitled.status).toBe(422);
    expect(untitled.data.detail).toBe('body.title: String should have at least 1 character');

    const missing = await call('POST', '/api/calendar/events', { title: 'No times' });
    expect(missing.data.detail).toBe('body.startAt: Field required');

    const fractional = await call('POST', '/api/calendar/events', {
      title: 'x',
      startAt: 1.5,
      endAt: 2,
    });
    expect(fractional.data.detail).toBe(
      'body.startAt: Input should be a valid integer, got a number with a fractional part',
    );
  });

  it('deletes an event once, then answers 404', async () => {
    const first = await call('DELETE', '/api/calendar/events/cal-seed-mis');
    expect(first).toEqual({ status: 200, data: { deleted: 'cal-seed-mis' } });
    const again = await call('DELETE', '/api/calendar/events/cal-seed-mis');
    expect(again).toEqual({
      status: 404,
      data: { detail: 'That event is no longer on the calendar.' },
    });
  });

  it('merges an event whose id repeats instead of adding a copy', () => {
    addEvent({ id: 'meeting-1', title: 'First', startAt: 1, endAt: 2 });
    const merged = addEvent({ id: 'meeting-1', title: 'Second', startAt: 1, endAt: 2 });
    expect(merged.title).toBe('Second');
  });

  it('resets to the seeded week', async () => {
    await call('DELETE', '/api/calendar/events/cal-seed-standup');
    const { status, data } = await call('POST', '/api/calendar/reset');
    expect(status).toBe(200);
    expect(data.events).toHaveLength(5);
    expect(data.events[0].id).toBe('cal-seed-standup');
  });
});
