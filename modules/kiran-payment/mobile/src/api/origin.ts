/**
 * Where the server is.
 *
 * The console reaches the Python API through same-origin relative paths —
 * `/api` and `/uploads` — because Vite proxies them to :3001. A Capacitor app
 * has neither: it is served from `capacitor://localhost` with no proxy in
 * front of it, so a relative `/api/state` resolves to the app bundle and 404s.
 *
 * Empty is the correct default. On the web it preserves the console's
 * behaviour exactly. A build destined for a device sets VITE_API_ORIGIN to an
 * absolute origin the phone can actually reach.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN ?? '').replace(/\/$/, '');

/** Paths the server owns. Everything else is the app's own bundle. */
const SERVER_PATH = /^\/(api|uploads)(?=[/?#]|$)/;

/**
 * The URL a request should really go to.
 *
 * Only relative paths under `/api` or `/uploads` move — matched as whole
 * segments, so `/apiary` stays put. Absolute URLs (including `blob:` and
 * `data:`) and the app's own files are returned untouched. With no origin
 * configured this is the identity function.
 */
export function toServerUrl(url: string, origin: string = API_ORIGIN): string {
  if (!origin || !SERVER_PATH.test(url)) return url;
  return `${origin}${url}`;
}
