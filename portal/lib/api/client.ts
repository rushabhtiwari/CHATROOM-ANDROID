/** HTTP client for the identity service. Pure: dependencies are injected so it is unit-testable. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ValidationItem = { loc?: (string | number)[]; msg?: string };

export function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return (detail as ValidationItem[])
      .map((item) => {
        const field = item.loc?.filter((part) => part !== "body").join(".");
        const msg = (item.msg ?? "is invalid").replace(/^Value error, /, "");
        return field ? `${field}: ${msg}` : msg;
      })
      .join("; ");
  }
  return `The identity service returned an error (${status}).`;
}

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string>;
  onUnauthorized: () => never;
  fetch?: typeof fetch;
};

export type Query = Record<string, string | number | undefined | null>;

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? fetch;

  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const url = new URL(path, options.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await doFetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await options.getAccessToken()}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 401) options.onUnauthorized();
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, payload));
    return payload as T;
  }

  /** PUT multipart form data; the browser-style boundary header is set by fetch. */
  async function upload<T>(path: string, form: FormData): Promise<T> {
    const response = await doFetch(new URL(path, options.baseUrl), {
      method: "PUT",
      headers: { Authorization: `Bearer ${await options.getAccessToken()}` },
      body: form,
      cache: "no-store",
    });
    if (response.status === 401) options.onUnauthorized();
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, payload));
    return payload as T;
  }

  /** GET without parsing, for passing bytes through (e.g. logos). Only 401 is handled here. */
  async function raw(path: string): Promise<Response> {
    const response = await doFetch(new URL(path, options.baseUrl), {
      headers: { Authorization: `Bearer ${await options.getAccessToken()}` },
      cache: "no-store",
    });
    if (response.status === 401) options.onUnauthorized();
    return response;
  }

  return {
    upload,
    raw,
    get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
    put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
    patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
    delete: (path: string) => request<void>("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
