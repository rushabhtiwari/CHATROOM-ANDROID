import { describe, expect, it } from 'vitest';
import { toServerUrl } from '~/api/origin';

const ORIGIN = 'http://192.168.1.10:3001';

describe('toServerUrl', () => {
  it('sends API and upload paths to the server', () => {
    expect(toServerUrl('/api/state', ORIGIN)).toBe(`${ORIGIN}/api/state`);
    expect(toServerUrl('/api/calendar/events?from=1', ORIGIN)).toBe(
      `${ORIGIN}/api/calendar/events?from=1`,
    );
    expect(toServerUrl('/api', ORIGIN)).toBe(`${ORIGIN}/api`);
    expect(toServerUrl('/uploads/receipt-7.png', ORIGIN)).toBe(`${ORIGIN}/uploads/receipt-7.png`);
  });

  it("leaves the app's own files alone", () => {
    // These are served by the app bundle, from capacitor://localhost. Sending
    // them to the API server would break the app itself.
    expect(toServerUrl('/assets/index-abc.js', ORIGIN)).toBe('/assets/index-abc.js');
    expect(toServerUrl('/fonts/geist-latin.woff2', ORIGIN)).toBe('/fonts/geist-latin.woff2');
    expect(toServerUrl('/', ORIGIN)).toBe('/');
  });

  it('matches whole path segments only', () => {
    expect(toServerUrl('/apiary', ORIGIN)).toBe('/apiary');
    expect(toServerUrl('/uploadsx/a', ORIGIN)).toBe('/uploadsx/a');
  });

  it('never touches an absolute URL', () => {
    expect(toServerUrl('https://example.com/api/state', ORIGIN)).toBe(
      'https://example.com/api/state',
    );
    expect(toServerUrl('blob:capacitor://localhost/1', ORIGIN)).toBe(
      'blob:capacitor://localhost/1',
    );
    expect(toServerUrl('data:image/png;base64,AAAA', ORIGIN)).toBe('data:image/png;base64,AAAA');
  });

  it('does not guess at paths without a leading slash', () => {
    expect(toServerUrl('api/state', ORIGIN)).toBe('api/state');
  });

  it('is a no-op when no server origin is configured', () => {
    // The web build: Vite proxies these on the same origin, exactly as today.
    expect(toServerUrl('/api/state', '')).toBe('/api/state');
  });
});
