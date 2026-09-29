/**
 * The in-conversation assistant, inside the app: a port of
 * backend/app/routers/agent.py (mounted under /api).
 *
 * The contract the chat store relies on is unchanged: POST a prompt with the
 * room's recent messages and `stream: true`, get server-sent events back —
 * `data: {"delta": ...}` per chunk, then `data: {"done": true}` and
 * `data: [DONE]`; a failure mid-reply travels as `data: {"error": ...}` in a
 * 200 stream, and a refusal up front (429) as JSON `{ "error" }`.
 *
 * Without a key the endpoint still answers — deterministically, from the
 * context it was handed. A demo that dies because of a missing key is a demo
 * that dies in front of the client.
 *
 * Only the OpenAI provider is ported; the Anthropic path has no key in an app
 * build. OpenAI's reply cannot be streamed over native HTTP, so a streamed
 * reply arrives whole and is then sent on in chunks (see openai.ts).
 */
import type { LocalRequest, Route } from './core';
import { OPENAI_MODEL, hasOpenAiKey } from './config';
import { completeChat, readable, streamChat, type ChatMessage } from './openai';

/*
 * Conversation is cheap, but a runaway client should not be able to spend the
 * key's budget. One request every five seconds, sustained, is generous.
 */
const RATE_LIMIT = 12;
const RATE_WINDOW = 60;
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Request times per client, in seconds. The backend keyed by client address;
 * inside the app there is one client, so there is one key.
 */
const hits = new Map<string, number[]>();
const CLIENT_KEY = 'local';

const monotonic = () =>
  (globalThis.performance?.now ? globalThis.performance.now() : Date.now()) / 1000;

/** Returns the seconds to wait, or null when the request may proceed. */
function rateLimited(key: string): number | null {
  const now = monotonic();
  const window = hits.get(key) ?? [];
  hits.set(key, window);
  while (window.length && now - window[0]! > RATE_WINDOW) window.shift();
  if (window.length >= RATE_LIMIT) {
    return Math.max(1, Math.trunc(RATE_WINDOW - (now - window[0]!)));
  }
  window.push(now);
  return null;
}

/** Forget every request seen so far. For tests; the backend's limiter reset with the process. */
export function resetAgentRateLimit(): void {
  hits.clear();
}

/* -------------------------------------------------------------------------- */
/* The request body, validated as the backend's pydantic model did             */
/* -------------------------------------------------------------------------- */

interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentRequest {
  prompt: string;
  context: string;
  history: HistoryTurn[];
  userName: string;
  mode: 'chat' | 'summary';
  stream: boolean;
}

/** One entry of FastAPI's 422 `detail` list. */
interface ValidationIssue {
  type: string;
  loc: (string | number)[];
  msg: string;
  input: unknown;
  ctx?: Record<string, unknown>;
}

class Validator {
  readonly issues: ValidationIssue[] = [];

  fail(type: string, loc: (string | number)[], msg: string, input: unknown, ctx?: Json): void {
    this.issues.push(ctx ? { type, loc, msg, input, ctx } : { type, loc, msg, input });
  }

  /** A `str` field with length bounds (counted in characters, as Python counts). */
  text(
    value: unknown,
    loc: (string | number)[],
    bounds: { min?: number; max: number },
  ): string | undefined {
    if (typeof value !== 'string') {
      this.fail('string_type', loc, 'Input should be a valid string', value);
      return undefined;
    }
    const length = Array.from(value).length;
    if (bounds.min !== undefined && length < bounds.min) {
      const unit = bounds.min === 1 ? 'character' : 'characters';
      this.fail(
        'string_too_short',
        loc,
        `String should have at least ${bounds.min} ${unit}`,
        value,
        {
          min_length: bounds.min,
        },
      );
      return undefined;
    }
    if (length > bounds.max) {
      this.fail(
        'string_too_long',
        loc,
        `String should have at most ${bounds.max} characters`,
        value,
        {
          max_length: bounds.max,
        },
      );
      return undefined;
    }
    return value;
  }

  literal<T extends string>(value: unknown, loc: (string | number)[], options: T[]): T | undefined {
    if (typeof value === 'string' && (options as string[]).includes(value)) return value as T;
    const expected = options.map((option) => `'${option}'`).join(' or ');
    this.fail('literal_error', loc, `Input should be ${expected}`, value, { expected });
    return undefined;
  }

  /** Pydantic's lax bool: true/false, 0/1, and the usual yes/no spellings. */
  bool(value: unknown, loc: (string | number)[]): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 0 || value === 1) return value === 1;
      this.fail(
        'bool_parsing',
        loc,
        'Input should be a valid boolean, unable to interpret input',
        value,
      );
      return undefined;
    }
    if (typeof value === 'string') {
      const word = value.toLowerCase();
      if (['1', 'on', 't', 'true', 'y', 'yes'].includes(word)) return true;
      if (['0', 'off', 'f', 'false', 'n', 'no'].includes(word)) return false;
      this.fail(
        'bool_parsing',
        loc,
        'Input should be a valid boolean, unable to interpret input',
        value,
      );
      return undefined;
    }
    this.fail('bool_type', loc, 'Input should be a valid boolean', value);
    return undefined;
  }
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The body as AgentRequest, or FastAPI's 422 detail list. */
function parseBody(body: unknown): { value: AgentRequest } | { issues: ValidationIssue[] } {
  const check = new Validator();
  if (body === undefined || body === null || body === '') {
    check.fail('missing', ['body'], 'Field required', null);
    return { issues: check.issues };
  }
  if (typeof body === 'string') {
    // core hands over the raw text when it was not JSON.
    check.fail('json_invalid', ['body', 0], 'JSON decode error', {}, { error: 'Expecting value' });
    return { issues: check.issues };
  }
  if (!isObject(body)) {
    check.fail(
      'model_attributes_type',
      ['body'],
      'Input should be a valid dictionary or object to extract fields from',
      body,
    );
    return { issues: check.issues };
  }

  let prompt: string | undefined;
  if (!('prompt' in body)) check.fail('missing', ['body', 'prompt'], 'Field required', body);
  else prompt = check.text(body.prompt, ['body', 'prompt'], { min: 1, max: 8_000 });

  // Room context can be long, but it is bounded so a client cannot push an
  // arbitrarily large body through the model on the app's key.
  const context =
    'context' in body ? check.text(body.context, ['body', 'context'], { max: 24_000 }) : '';

  const history: HistoryTurn[] = [];
  if ('history' in body) {
    const raw = body.history;
    if (!Array.isArray(raw)) {
      check.fail('list_type', ['body', 'history'], 'Input should be a valid list', raw);
    } else {
      raw.forEach((turn, index) => {
        const loc = ['body', 'history', index];
        if (!isObject(turn)) {
          check.fail(
            'model_type',
            loc,
            'Input should be a valid dictionary or instance of HistoryTurn',
            turn,
            { class_name: 'HistoryTurn' },
          );
          return;
        }
        let role: HistoryTurn['role'] | undefined;
        let content: string | undefined;
        if (!('role' in turn)) check.fail('missing', [...loc, 'role'], 'Field required', turn);
        else role = check.literal(turn.role, [...loc, 'role'], ['user', 'assistant']);
        if (!('content' in turn))
          check.fail('missing', [...loc, 'content'], 'Field required', turn);
        else content = check.text(turn.content, [...loc, 'content'], { min: 1, max: 8_000 });
        if (role && content !== undefined) history.push({ role, content });
      });
      if (raw.length > 12) {
        check.fail(
          'too_long',
          ['body', 'history'],
          `List should have at most 12 items after validation, not ${raw.length}`,
          raw,
          { field_type: 'List', max_length: 12, actual_length: raw.length },
        );
      }
    }
  }

  const userName =
    'userName' in body ? check.text(body.userName, ['body', 'userName'], { max: 120 }) : '';
  const mode =
    'mode' in body ? check.literal(body.mode, ['body', 'mode'], ['chat', 'summary']) : 'chat';
  const stream = 'stream' in body ? check.bool(body.stream, ['body', 'stream']) : false;

  if (check.issues.length) return { issues: check.issues };
  return {
    value: {
      prompt: prompt!,
      context: context!,
      history,
      userName: userName!,
      mode: mode!,
      stream: stream!,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Prompts                                                                     */
/* -------------------------------------------------------------------------- */

const SYSTEM_CHAT = `You are the assistant inside KiranOS, the operations console \
for Kiran Cable Protection Products Private Limited.

You are answering inside a conversation. Your reply is private to the person \
who asked until they choose to share it.

Be direct and specific. Use the conversation you were given as the source of \
truth, and say plainly when it does not contain the answer rather than \
inventing one. Prefer short paragraphs and tight bullet lists. Name people as \
they are named in the transcript. Amounts are Indian rupees; write them as \
Rs 1,20,000 in the Indian digit grouping.

Never open with a restatement of the question or a pleasantry. Answer.`;

const SYSTEM_SUMMARY = `You are the assistant inside KiranOS, the operations \
console for Kiran Cable Protection Products Private Limited.

Summarise the conversation you are given for someone catching up. Structure it as:

- A one-line statement of where things stand.
- **Decisions** — what was settled, and by whom.
- **Open items** — what still needs a decision, and who owns it.

Lead with anything addressed to the person catching up. Omit a section that \
has nothing in it rather than writing "none". Keep the whole thing under 200 \
words. Amounts are Indian rupees, written as Rs 1,20,000.`;

const systemFor = (body: AgentRequest) => (body.mode === 'summary' ? SYSTEM_SUMMARY : SYSTEM_CHAT);

/** The provider key's name, as the backend's messages give it. */
const KEY_NAME = 'OPENAI_API_KEY';

/**
 * Python's `json.dumps` with its defaults: `", "` and `": "` separators, and
 * every non-ASCII character escaped. The client parses the frames as JSON, so
 * this only keeps them byte-for-byte what the backend sent.
 */
function pyDumps(value: unknown): string {
  if (isObject(value)) {
    const entries = Object.entries(value).map(([key, item]) => `${pyDumps(key)}: ${pyDumps(item)}`);
    return `{${entries.join(', ')}}`;
  }
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

const sse = (payload: Json) => `data: ${pyDumps(payload)}\n\n`;

function messages(body: AgentRequest): ChatMessage[] {
  const turns: ChatMessage[] = body.history.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  let prompt = body.prompt;
  if (body.context.trim()) {
    prompt =
      'Recent messages in this conversation:\n' +
      `<transcript>\n${body.context}\n</transcript>\n\n` +
      `${body.prompt}`;
  }
  if (body.userName) prompt = `(Asked by ${body.userName}.)\n\n${prompt}`;

  turns.push({ role: 'user', content: prompt });
  return turns;
}

/** Python's `str.splitlines()`: every line break it knows, no trailing empty line. */
function splitLines(value: string): string[] {
  const lines = value.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * A useful answer built from the transcript when no key is configured. Not a
 * pretend model: it says what it is, then does the one thing it can do without
 * one — show the recent exchange back, attributed.
 */
function offlineReply(body: AgentRequest): string {
  const lines = splitLines(body.context).filter((line) => line.trim());
  if (!lines.length) {
    return (
      'The assistant is not connected to a model right now, and there are ' +
      'no recent messages in this conversation to work from.\n\n' +
      `Add \`${KEY_NAME}\` to \`backend/.env\` to turn it on.`
    );
  }

  const speakers: string[] = [];
  for (const line of lines) {
    const name = line.split(':', 1)[0]!.trim();
    if (name && !speakers.includes(name)) speakers.push(name);
  }

  const recent = lines.slice(-6);
  const bodyText = recent.map((line) => `- ${line}`).join('\n');
  return (
    '**Running without a model key**, so this is the conversation itself ' +
    'rather than an analysis of it.\n\n' +
    `**In the room:** ${speakers.slice(0, 6).join(', ')}\n\n` +
    `**Last ${recent.length} messages**\n${bodyText}\n\n` +
    `Add \`${KEY_NAME}\` to \`backend/.env\` for a real answer.`
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Chunked so the client's streaming renderer is exercised without a key. */
async function* streamOffline(text: string): AsyncGenerator<string> {
  const words = text.split(' ');
  for (let index = 0; index < words.length; index += 5) {
    yield sse({ delta: words.slice(index, index + 5).join(' ') + ' ' });
    await sleep(20);
  }
  yield sse({ done: true });
  yield 'data: [DONE]\n\n';
}

async function* streamOpenAi(body: AgentRequest): AsyncGenerator<string> {
  try {
    for await (const delta of streamChat(
      OPENAI_MODEL,
      systemFor(body),
      messages(body),
      MAX_OUTPUT_TOKENS,
    )) {
      yield sse({ delta });
    }
    yield sse({ done: true });
    yield 'data: [DONE]\n\n';
  } catch (error) {
    // The reply may already be part-sent, so the error travels in the stream.
    yield sse({ error: readable(error) });
  }
}

const SSE_HEADERS = {
  // Starlette adds the charset to every text/* media type.
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};

/** A StreamingResponse: each yielded frame is written as it is produced. */
function streamingResponse(frames: AsyncGenerator<string>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await frames.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(value));
    },
    async cancel() {
      await frames.return(undefined);
    },
  });
  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}

/** A JSONResponse with a status and headers of its own. */
function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function agent(request: LocalRequest): Promise<Response> {
  // FastAPI validates the body before the handler runs, so a malformed
  // request never counts against the rate limit.
  const parsed = parseBody(request.body);
  if ('issues' in parsed) return jsonResponse({ detail: parsed.issues }, 422);
  const body = parsed.value;

  const retryAfter = rateLimited(CLIENT_KEY);
  if (retryAfter !== null) {
    return jsonResponse({ error: `Too many requests. Try again in ${retryAfter}s.` }, 429, {
      'Retry-After': String(retryAfter),
    });
  }

  if (!hasOpenAiKey()) {
    const text = offlineReply(body);
    if (!body.stream) return jsonResponse({ reply: text, demo: true });
    return streamingResponse(streamOffline(text));
  }

  if (!body.stream) {
    try {
      const text = await completeChat(
        OPENAI_MODEL,
        systemFor(body),
        messages(body),
        MAX_OUTPUT_TOKENS,
      );
      return jsonResponse({ reply: text });
    } catch (error) {
      return jsonResponse({ error: readable(error) }, 502);
    }
  }

  return streamingResponse(streamOpenAi(body));
}

/**
 * Whether the assistant is live. The backend reported `anthropic` when no
 * provider was chosen and no OpenAI key was set; an app build only ever has
 * OpenAI, so the provider is always `openai`.
 */
function agentStatus() {
  const configured = hasOpenAiKey();
  return { configured, provider: 'openai', model: configured ? OPENAI_MODEL : null };
}

export const agentRoutes: Route[] = [
  { method: 'POST', pattern: '/api/agent', handle: agent },
  { method: 'GET', pattern: '/api/agent/status', handle: agentStatus },
];
