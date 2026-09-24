import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installServerOrigin } from '~/api/install';

const ORIGIN = 'http://192.168.1.10:3001';

describe('installServerOrigin', () => {
  let calls: Array<{ url: string; init?: RequestInit }>;
  let sources: Array<{ url: string; init?: EventSourceInit }>;
  let restore: () => void;

  beforeEach(() => {
    calls = [];
    sources = [];
    // Stand-ins for the platform: record what reaches the network.
    const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push({
        url,
        init: input instanceof Request ? { credentials: input.credentials } : init,
      });
      return new Response('{}');
    });
    class FakeEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        sources.push({ url: String(url), init });
      }
      close() {}
    }
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubGlobal('EventSource', FakeEventSource);
    restore = installServerOrigin(ORIGIN);
  });

  afterEach(() => {
    restore();
    vi.unstubAllGlobals();
  });

  it('redirects a relative API fetch and sends credentials', async () => {
    await fetch('/api/agent', { method: 'POST' });
    expect(calls[0]!.url).toBe(`${ORIGIN}/api/agent`);
    expect(calls[0]!.init?.method).toBe('POST');
    // Cross-origin requests drop cookies unless told otherwise.
    expect(calls[0]!.init?.credentials).toBe('include');
  });

  it('leaves app-bundle fetches alone, credentials included', async () => {
    await fetch('/assets/data.json');
    expect(calls[0]!.url).toBe('/assets/data.json');
    expect(calls[0]!.init?.credentials).toBeUndefined();
  });

  it('respects an explicit credentials choice', async () => {
    await fetch('/api/state', { credentials: 'omit' });
    expect(calls[0]!.init?.credentials).toBe('omit');
  });

  it('redirects a URL object', async () => {
    // jsdom resolves relative URLs against its own origin, so a relative path
    // arrives here as an absolute same-origin URL.
    await fetch(new URL('/api/state', window.location.origin));
    expect(calls[0]!.url).toBe(`${ORIGIN}/api/state`);
  });

  // jsdom supplies its own AbortSignal while Request comes from Node, so
  // copying a Request fails a cross-realm `instanceof` check that no browser
  // has — WKWebView is one realm. This path is exercised against the real
  // backend in a browser instead (see the verification notes in the commit).
  it.skip('redirects a Request built from a relative path', async () => {
    await fetch(new Request(new URL('/api/state', window.location.origin)));
    expect(calls[0]!.url).toBe(`${ORIGIN}/api/state`);
  });

  it('redirects the live-update stream with credentials', () => {
    new EventSource('/api/events');
    expect(sources[0]).toEqual({ url: `${ORIGIN}/api/events`, init: { withCredentials: true } });
  });

  it('rewrites a tapped receipt link, and nothing else', () => {
    document.body.innerHTML =
      '<a id="r" href="/uploads/receipt-7.png">receipt</a><a id="h" href="/orders/SO-1">order</a>';
    const receipt = document.getElementById('r')!;
    const order = document.getElementById('h')!;
    // jsdom does not navigate; stop it from trying so the test stays quiet.
    const stop = (event: Event) => event.preventDefault();
    document.addEventListener('click', stop);
    receipt.click();
    order.click();
    document.removeEventListener('click', stop);
    expect(receipt.getAttribute('href')).toBe(`${ORIGIN}/uploads/receipt-7.png`);
    expect(order.getAttribute('href')).toBe('/orders/SO-1');
  });

  it('restores the originals', async () => {
    restore();
    await fetch('/api/state');
    expect(calls[0]!.url).toBe('/api/state');
    restore = () => {};
  });
});

describe('installServerOrigin with no origin', () => {
  it('installs nothing', () => {
    const before = globalThis.fetch;
    const restore = installServerOrigin('');
    expect(globalThis.fetch).toBe(before);
    restore();
  });
});
