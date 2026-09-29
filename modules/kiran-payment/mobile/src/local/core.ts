/**
 * The server, inside the app.
 *
 * A standalone build (VITE_STANDALONE=true) has no backend at all. The code it
 * shares with the console still calls `/api/...` with `fetch` and listens on
 * `/api/events` with `EventSource`, exactly as it does against the Python
 * server. Rather than edit every call site, this answers those requests in
 * process: `fetch` and `EventSource` are wrapped once at startup, and relative
 * `/api` paths are routed to handlers ported from the backend. State lives in
 * the app's own durable storage; OpenAI and Google are called directly with
 * keys baked in at build time.
 *
 * Every other request — the app's own assets, absolute URLs, `blob:` and
 * `data:` — passes through untouched.
 */

/** A request as a handler sees it. */
export interface LocalRequest {
  method: string;
  path: string;
  /** `:name` segments of the route pattern. */
  params: Record<string, string>;
  query: URLSearchParams;
  /** Parsed JSON, a FormData, or undefined. */
  body: unknown;
}

/**
 * What a handler returns: a JSON-serialisable body (sent with `status`, 200 by
 * default), or a ready-made Response when it needs full control (streaming).
 */
export type Handler = (request: LocalRequest) => unknown | Promise<unknown>;

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** e.g. `/api/requests/:id/transition` */
  pattern: string;
  status?: number;
  handle: Handler;
}

/** FastAPI's error shape, which every client here already parses: `{ detail }`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
    this.name = 'HttpError';
  }
}

/** A live stream: called with an emitter when an EventSource opens; returns its teardown. */
export type Stream = (emit: (event: string, data: unknown) => void) => () => void;

/* -------------------------------------------------------------------------- */
/* Storage                                                                     */
/* -------------------------------------------------------------------------- */

const PREFIX = 'kiranos-local:';

/**
 * Read a stored value, or build and keep the fallback. `localStorage` is
 * swapped for file-backed storage on a device before anything runs (see
 * native/storage.ts), so this survives restarts and iOS/Android eviction.
 */
export function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* unreadable: start again from the fallback */
  }
  const value = fallback();
  save(key, value);
  return value;
}

export function save(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* full or unavailable: the in-memory copy still serves this session */
  }
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

type Listener = (data: unknown) => void;
const channels = new Map<string, Set<Listener>>();

/** In-process pub/sub: what the backend's SSE fan-out was. */
export function publish(channel: string, data: unknown): void {
  for (const listener of [...(channels.get(channel) ?? [])]) listener(data);
}

export function subscribe(channel: string, listener: Listener): () => void {
  const set = channels.get(channel) ?? new Set<Listener>();
  set.add(listener);
  channels.set(channel, set);
  return () => set.delete(listener);
}

/* -------------------------------------------------------------------------- */
/* Outbound HTTP                                                               */
/* -------------------------------------------------------------------------- */

export interface HttpResult {
  status: number;
  ok: boolean;
  /** Parsed JSON when the response is JSON, otherwise the text. */
  data: unknown;
}

let nativeRequest:
  | ((options: {
      url: string;
      method: string;
      headers: Record<string, string>;
      data?: unknown;
    }) => Promise<{ status: number; data: unknown }>)
  | null = null;

/** Set by the app on a device: Capacitor's native HTTP, which is not bound by CORS. */
export function useNativeHttp(request: typeof nativeRequest): void {
  nativeRequest = request;
}

/**
 * Call an outside service (OpenAI, Google). On a device this goes through the
 * native HTTP stack, so APIs that refuse browser origins still answer; in a
 * browser or a test it is plain fetch. `form` sends
 * application/x-www-form-urlencoded, which Google's token endpoint wants.
 */
export async function http(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    json?: unknown;
    form?: Record<string, string>;
  } = {},
): Promise<HttpResult> {
  const method = options.method ?? (options.json || options.form ? 'POST' : 'GET');
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  let body: string | undefined;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.form).toString();
  }

  if (nativeRequest) {
    const response = await nativeRequest({
      url,
      method,
      headers,
      data: options.json !== undefined ? options.json : body,
    });
    let data = response.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        /* text stays text */
      }
    }
    return { status: response.status, ok: response.status >= 200 && response.status < 300, data };
  }

  const response = await globalThis.fetch(url, { method, headers, body });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* text stays text */
  }
  return { status: response.status, ok: response.ok, data };
}

/* -------------------------------------------------------------------------- */
/* Files                                                                       */
/* -------------------------------------------------------------------------- */

/** An uploaded file, read into memory: what a multipart upload was to the backend. */
export interface LocalFile {
  name: string;
  /** MIME type, e.g. image/png. */
  type: string;
  size: number;
  /** The bytes, base64-encoded (no data: prefix). */
  base64: string;
  /** The same bytes as a data: URL, usable as an <img> src or a link. */
  dataUrl: string;
}

/** Every File under `field` in a multipart body. */
export async function readFiles(form: unknown, field: string): Promise<LocalFile[]> {
  if (!(form instanceof FormData)) return [];
  const files = form.getAll(field).filter((item): item is File => item instanceof File);
  return Promise.all(
    files.map(async (file) => {
      const dataUrl = await toDataUrl(file);
      return {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
        dataUrl,
      };
    }),
  );
}

/** A File or Blob as a data: URL — how uploads are kept without a file server. */
export function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                     */
/* -------------------------------------------------------------------------- */

function compile(pattern: string): (path: string) => Record<string, string> | null {
  const names: string[] = [];
  const source = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const regex = new RegExp(`^${source}/?$`);
  return (path) => {
    const match = regex.exec(path);
    if (!match) return null;
    return Object.fromEntries(
      names.map((name, index) => [name, decodeURIComponent(match[index + 1]!)]),
    );
  };
}

/** The path this app would have sent to the server, or null when the request is not the server's. */
function serverPath(url: string): { path: string; query: URLSearchParams } | null {
  let parsed: URL;
  try {
    parsed = new URL(url, globalThis.location?.href ?? 'http://localhost/');
  } catch {
    return null;
  }
  if (globalThis.location && parsed.origin !== globalThis.location.origin) return null;
  if (!/^\/(api|uploads)(\/|$)/.test(parsed.pathname)) return null;
  return { path: parsed.pathname, query: parsed.searchParams };
}

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Answer one request with the first matching route. Exported for tests. */
export async function dispatch(
  routes: Route[],
  method: string,
  url: string,
  body: unknown,
): Promise<Response> {
  const target = serverPath(url);
  if (!target) return json(404, { detail: 'Not found' });
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = compile(route.pattern)(target.path);
    if (!params) continue;
    try {
      const result = await route.handle({
        method,
        path: target.path,
        params,
        query: target.query,
        body,
      });
      if (result instanceof Response) return result;
      return json(route.status ?? 200, result);
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { detail: error.detail });
      const detail = error instanceof Error ? error.message : 'Something went wrong.';
      return json(500, { detail });
    }
  }
  return json(404, { detail: `No route for ${method} ${target.path}` });
}

async function readBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const raw = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
  if (raw === undefined || raw === null) return undefined;
  if (raw instanceof FormData) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** An EventSource stand-in for in-process streams. */
function makeEventSource(
  streams: Record<string, Stream>,
  Original: typeof EventSource | undefined,
) {
  return class LocalEventSource extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    readonly url: string;
    readonly withCredentials = false;
    readyState = 0;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    private teardown: (() => void) | null = null;
    private inner: EventSource | null = null;

    constructor(url: string | URL, init?: EventSourceInit) {
      super();
      this.url = String(url);
      const target = serverPath(this.url);
      const stream = target ? streams[target.path] : undefined;
      if (!stream) {
        // Not ours: a real EventSource, if the platform has one.
        if (Original) {
          this.inner = new Original(url, init);
          this.inner.onopen = (event) => this.onopen?.(event);
          this.inner.onmessage = (event) => this.onmessage?.(event);
          this.inner.onerror = (event) => this.onerror?.(event);
        }
        return;
      }
      // Open on the next tick, as a real stream would, so listeners attach first.
      setTimeout(() => {
        if (this.readyState === 2) return;
        this.readyState = 1;
        const open = new Event('open');
        this.onopen?.(open);
        this.dispatchEvent(open);
        this.teardown = stream((event, data) => {
          if (this.readyState !== 1) return;
          const message = new MessageEvent(event, { data: JSON.stringify(data) });
          if (event === 'message') this.onmessage?.(message);
          this.dispatchEvent(message);
        });
      }, 0);
    }

    override addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (!listener) return;
      if (this.inner) this.inner.addEventListener(type, listener, options);
      else super.addEventListener(type, listener, options);
    }

    close(): void {
      this.readyState = 2;
      this.inner?.close();
      this.teardown?.();
      this.teardown = null;
    }
  };
}

/**
 * Install the in-app server. Returns a function that removes it (tests); the
 * app installs once for its lifetime.
 */
export function installLocalServer(routes: Route[], streams: Record<string, Stream>): () => void {
  const previousFetch = globalThis.fetch;
  const PreviousEventSource = globalThis.EventSource;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!serverPath(url)) return previousFetch(input, init);
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    return dispatch(routes, method, url, await readBody(input, init));
  };

  globalThis.EventSource = makeEventSource(
    streams,
    PreviousEventSource,
  ) as unknown as typeof EventSource;

  return () => {
    globalThis.fetch = previousFetch;
    globalThis.EventSource = PreviousEventSource;
  };
}
