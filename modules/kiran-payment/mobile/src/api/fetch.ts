/**
 * The app's one call into the server.
 *
 * Two things this adds over bare `fetch`:
 *
 *  - the origin, so a relative path written the way the console writes it
 *    still reaches the API from inside a Capacitor container;
 *  - credentials, because a cross-origin request drops cookies unless it is
 *    told not to. The backend has to answer with an explicit origin and
 *    Access-Control-Allow-Credentials for this to work — a wildcard is
 *    refused by the browser once credentials are in play.
 */
import { IS_CROSS_ORIGIN, serverUrl } from './origin';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(serverUrl(path), {
    ...init,
    credentials: IS_CROSS_ORIGIN ? 'include' : init.credentials,
  });
  if (!response.ok) {
    throw new ApiError(`${init.method ?? 'GET'} ${path} failed`, response.status);
  }
  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  return (await response.json()) as T;
}
