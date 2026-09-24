/**
 * Point the console's server calls at the real server, from outside the console.
 *
 * The code this app shares with the console reaches the API through relative
 * paths in six places across three files — `fetch('/api/agent')` and
 * `/api/meet` in the chat store, every call in `modules/rts/api.ts` and
 * `modules/calendar/api.ts`, and the live-update stream opened with
 * `new EventSource('/api/events')`. On a device every one of those resolves to
 * `capacitor://localhost`, which is the app bundle, not the server.
 *
 * Editing each call site would mean changing the console for the phone's
 * sake, and would miss the next one someone adds. This instead wraps `fetch`
 * and `EventSource` once, at startup, and rewrites only relative `/api` and
 * `/uploads` paths (see `toServerUrl`). Everything else — the app's own
 * assets, absolute URLs, `blob:` and `data:` — passes through untouched.
 *
 * With no origin configured nothing is installed at all, so the web build
 * behaves exactly as the console does.
 */
import { toServerUrl } from '~/api/origin';

/** A same-origin absolute URL back to the path the console wrote. */
function relativeIfLocal(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    /* already relative, or not a URL at all */
  }
  return url;
}

/** The rewritten URL, or null when the request is not the server's. */
function redirect(url: string, origin: string): string | null {
  const local = relativeIfLocal(url);
  const target = toServerUrl(local, origin);
  return target === local ? null : target;
}

/**
 * Install the redirect. Returns a function that removes it — used by tests;
 * the app installs once for its lifetime.
 */
export function installServerOrigin(origin: string): () => void {
  if (!origin) return () => {};

  const originalFetch = globalThis.fetch;
  const OriginalEventSource = globalThis.EventSource;

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const target = redirect(url, origin);
    if (!target) return originalFetch(input, init);

    // A cross-origin request drops cookies unless it asks for them. An
    // explicit choice by the caller still wins.
    const credentials = init?.credentials ?? 'include';
    if (input instanceof Request) {
      return originalFetch(new Request(new Request(target, input), { credentials }), init);
    }
    return originalFetch(target, { ...init, credentials });
  };

  if (OriginalEventSource) {
    globalThis.EventSource = class extends OriginalEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        const target = redirect(String(url), origin);
        super(target ?? url, target ? { withCredentials: true, ...init } : init);
      }
    } as typeof EventSource;
  }

  // Receipt links arrive from the server as `/uploads/...` and are rendered as
  // plain anchors. Rewritten, Capacitor sees a navigation to a host outside the
  // app and opens it in Safari, rather than replacing the app with a file.
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const target = redirect(anchor.getAttribute('href') ?? '', origin);
    if (target) anchor.setAttribute('href', target);
  };
  document.addEventListener('click', onClick, true);

  return () => {
    globalThis.fetch = originalFetch;
    if (OriginalEventSource) globalThis.EventSource = OriginalEventSource;
    document.removeEventListener('click', onClick, true);
  };
}
