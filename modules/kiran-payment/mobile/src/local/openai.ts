/**
 * OpenAI, called from inside the app: a port of backend/app/openai_client.py.
 *
 * The same calls against Chat Completions — a reply, and one forced function
 * call that returns a receipt as structured data — made through core's `http`,
 * so on a device they go over Capacitor's native HTTP and are not bound by
 * CORS.
 *
 * One deliberate difference: native HTTP hands back a finished body, never a
 * stream. So `streamChat` makes the ordinary, non-streaming request and then
 * yields the finished reply in small pieces. Callers keep the backend's
 * streaming shape; the person waits for the whole reply before the first word.
 */
import { http, type HttpResult } from './core';
import { OPENAI_API_KEY, OPENAI_BASE_URL } from './config';

/** httpx.Timeout(90.0) in the backend. Native HTTP cannot be aborted, so this races it. */
const TIMEOUT_MS = 90_000;

type Json = Record<string, unknown>;

/** A failed call, carrying the HTTP status and OpenAI's own error code. */
export class OpenAIError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly code = '',
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

/**
 * OpenAI could not be reached at all: what httpx's ConnectError and
 * TimeoutException were to the backend, so `readable` can say so.
 */
export class OpenAIConnectionError extends Error {
  constructor(message = 'Could not reach OpenAI.') {
    super(message);
    this.name = 'OpenAIConnectionError';
  }
}

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' };
}

/** POST to Chat Completions; a transport failure or the timeout becomes OpenAIConnectionError. */
async function post(payload: Json): Promise<HttpResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new OpenAIConnectionError('OpenAI did not answer in time.')),
      TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([
      http(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        json: payload,
      }).catch((error: unknown) => {
        throw new OpenAIConnectionError(error instanceof Error ? error.message : undefined);
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The error a >= 400 response stands for. As in the backend, a body that is
 * not JSON reads as "no detail", while a JSON body of the wrong shape is not
 * an OpenAIError at all (it was an AttributeError there), so it reads as the
 * generic failure.
 */
function errorFrom(result: HttpResult): Error {
  let error: unknown = {};
  if (typeof result.data !== 'string') {
    if (!isObject(result.data)) return new Error('Unexpected error body from OpenAI.');
    error = result.data.error || {};
    if (!isObject(error)) return new Error('Unexpected error body from OpenAI.');
  }
  const detail = error as Json;
  return new OpenAIError(
    String(detail.message || `OpenAI returned ${result.status}.`),
    result.status,
    String(detail.code || detail.type || ''),
  );
}

/** The parsed body of a successful response; `response.json()` failing in the backend. */
function body(result: HttpResult): Json {
  if (!isObject(result.data)) throw new Error('OpenAI returned a body that is not a JSON object.');
  return result.data;
}

/** The first choice's message, read as defensively as the backend reads it. */
function firstMessage(result: HttpResult): Json {
  const choices = body(result).choices;
  const list = Array.isArray(choices) && choices.length ? choices : [{}];
  const choice = list[0];
  if (!isObject(choice)) throw new Error('OpenAI returned a malformed choice.');
  const message = choice.message;
  return isObject(message) ? message : {};
}

/** What to tell the person, rather than a stack trace. */
export function readable(error: unknown): string {
  if (error instanceof OpenAIError) {
    if (error.code === 'insufficient_quota') {
      return (
        'The OpenAI account has no credit left, so the model refused the request. ' +
        'Add credit under Billing; the key in backend/.env is fine.'
      );
    }
    if (error.status === 401) {
      return 'The OpenAI API key was rejected. Check OPENAI_API_KEY in backend/.env.';
    }
    if (error.status === 404 || error.code === 'model_not_found') {
      return 'The OpenAI model is not available to this key. Set OPENAI_MODEL in backend/.env.';
    }
    if (error.status === 429) return 'The model is rate limited right now. Try again shortly.';
  }
  if (error instanceof OpenAIConnectionError) {
    return "Could not reach OpenAI. Check the server's network.";
  }
  return 'The assistant could not complete that request.';
}

export interface ChatMessage {
  role: string;
  content: unknown;
}

function chatMessages(system: string, messages: ChatMessage[]): ChatMessage[] {
  return [{ role: 'system', content: system }, ...messages];
}

/** The whole reply at once. */
export async function completeChat(
  model: string,
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const result = await post({
    model,
    messages: chatMessages(system, messages),
    max_completion_tokens: maxTokens,
  });
  if (result.status >= 400) throw errorFrom(result);
  const content = firstMessage(result).content;
  return typeof content === 'string' ? content : content ? String(content) : '';
}

/** Words per yielded piece when a finished reply is replayed as a stream. */
const WORDS_PER_PIECE = 5;

/**
 * The reply's text in pieces. The backend streamed from OpenAI; native HTTP
 * cannot, so this is one non-streaming request whose reply is then split into
 * a few words at a time. Joined, the pieces are exactly the reply.
 */
export async function* streamChat(
  model: string,
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
): AsyncGenerator<string> {
  const text = await completeChat(model, system, messages, maxTokens);
  // Split after every run of whitespace, keeping it, so nothing is lost or added.
  const words = text.match(/\S*\s*/g)?.filter(Boolean) ?? [];
  for (let index = 0; index < words.length; index += WORDS_PER_PIECE) {
    yield words.slice(index, index + WORDS_PER_PIECE).join('');
  }
}

/** One receipt as a message part: an image, or a PDF as a file. */
export function filePart(mediaType: string, dataB64: string, filename: string): Json {
  const url = `data:${mediaType};base64,${dataB64}`;
  if (mediaType === 'application/pdf') {
    return { type: 'file', file: { filename, file_data: url } };
  }
  return { type: 'image_url', image_url: { url } };
}

/** A tool in Anthropic's shape, which the extractor keeps as its one definition. */
export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Json;
  [key: string]: unknown;
}

/**
 * Force one call of `tool` and return its arguments, or null if there were
 * none. `tool` is translated from Anthropic's shape here.
 */
export async function callFunction(
  model: string,
  system: string,
  parts: Json[],
  tool: AnthropicTool,
  maxTokens = 2048,
): Promise<Json | null> {
  const fn = {
    name: tool.name,
    description: tool.description ?? '',
    parameters: tool.input_schema,
  };
  const result = await post({
    model,
    messages: chatMessages(system, [{ role: 'user', content: parts }]),
    tools: [{ type: 'function', function: fn }],
    tool_choice: { type: 'function', function: { name: tool.name } },
    max_completion_tokens: maxTokens,
  });
  if (result.status >= 400) throw errorFrom(result);
  const message = firstMessage(result);
  const calls = message.tool_calls || [];
  if (!Array.isArray(calls)) throw new Error('OpenAI returned malformed tool calls.');
  for (const call of calls) {
    // A call or function that is not an object crashed the backend's reader;
    // the extractor turns that into its generic failure, and so does this.
    if (!isObject(call)) throw new Error('OpenAI returned a malformed tool call.');
    const fnCall = call.function || {};
    if (!isObject(fnCall)) throw new Error('OpenAI returned a malformed tool call.');
    let args: unknown = fnCall.arguments;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        return null;
      }
    }
    if (isObject(args)) return args;
  }
  return null;
}
