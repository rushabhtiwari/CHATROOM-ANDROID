/**
 * Where the server is.
 *
 * The console reaches the Python API through same-origin relative paths —
 * `/api` and `/uploads` — because Vite proxies them to :3001. A Capacitor app
 * has neither: it is served from `capacitor://localhost` and there is no proxy
 * in front of it, so a relative `/api/state` resolves to the app bundle and
 * 404s. Every server path in this app goes through here instead.
 *
 * Empty is the correct default. On the web it preserves the console's
 * behaviour exactly. A build destined for a device sets VITE_API_ORIGIN to an
 * absolute origin the phone can actually reach.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN ?? '').replace(/\/$/, '');

/** True when this build talks to a server on a different origin than itself. */
export const IS_CROSS_ORIGIN = API_ORIGIN !== '';

/**
 * An absolute URL for a server path.
 *
 * Paths already carrying a scheme are returned untouched, so a value that
 * arrives from the server as a full URL is not mangled into a double origin.
 */
export function serverUrl(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
