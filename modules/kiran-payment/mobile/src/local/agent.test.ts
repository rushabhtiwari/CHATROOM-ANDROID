import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch } from './core';
import { agentRoutes, resetAgentRateLimit } from './agent';

const settings = vi.hoisted(() => ({ key: 'sk-test' }));

vi.mock('./config', () => ({
  get OPENAI_API_KEY() {
    return settings.key;
  },
  OPENAI_BASE_URL: 'https://openai.test/v1',
  OPENAI_MODEL: 'gpt-test',
  OPENAI_EXTRACTION_MODEL: 'gpt-test-vision',
  hasOpenAiKey: () => Boolean(settings.key),
}));

/** Stubs fetch with one canned OpenAI answer and records what was sent. */
function answer(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    }),
  );
  return calls;
}

const completion = (content: string) => ({ choices: [{ message: { content } }] });

const post = (body: unknown) => dispatch(agentRoutes, 'POST', '/api/agent', body);

/**
 * What chat-store.tsx's runAgent does with the response, line for line: a
 * JSON `error` on a failed status, otherwise SSE frames read off the body,
 * where an `error` frame throws and `delta`s are concatenated.
 */
async function readLikeTheChatStore(response: Response): Promise<string> {
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'AI request failed');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let event: { delta?: string; error?: string };
      try {
        event = JSON.parse(payload) as { delta?: string; error?: string };
      } catch {
        continue;
      }
      if (event.error) throw new Error(event.error);
      if (event.delta) text += event.delta;
    }
  }
  return text;
}

const REQUEST = {
  prompt: 'Who owns the dispatch date?',
  context: 'Priya: Approved the Rs 1,20,000 order.\nRavi: I will confirm dispatch by Friday.',
  history: [
    { role: 'user', content: 'What was approved?' },
    { role: 'assistant', content: 'The Rs 1,20,000 order.' },
  ],
  mode: 'chat',
  userName: 'Asha',
  stream: true,
};

beforeEach(() => {
  settings.key = 'sk-test';
  resetAgentRateLimit();
});

afterEach(() => vi.restoreAllMocks());

describe('POST /api/agent', () => {
  it('streams the reply as the server-sent events the chat store reads', async () => {
    const reply =
      'Ravi owns it: he said he will confirm dispatch by Friday.\n\n- Priya approved the order.';
    const calls = answer(200, completion(reply));

    const response = await post(REQUEST);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');

    const raw = await response.clone().text();
    expect(raw.startsWith('data: {"delta": "Ravi owns it: he said "}\n\n')).toBe(true);
    expect(raw.endsWith('data: {"done": true}\n\ndata: [DONE]\n\n')).toBe(true);
    expect(await readLikeTheChatStore(response)).toBe(reply);

    // One non-streaming completion carrying the transcript and who asked.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://openai.test/v1/chat/completions');
    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent.model).toBe('gpt-test');
    expect(sent.max_completion_tokens).toBe(1024);
    expect(sent.stream).toBeUndefined();
    expect(sent.messages[0].role).toBe('system');
    expect(sent.messages[0].content).toMatch(/^You are the assistant inside KiranOS/);
    expect(sent.messages.slice(1)).toEqual([
      ...REQUEST.history,
      {
        role: 'user',
        content:
          '(Asked by Asha.)\n\nRecent messages in this conversation:\n' +
          `<transcript>\n${REQUEST.context}\n</transcript>\n\n` +
          'Who owns the dispatch date?',
      },
    ]);
  });

  it('escapes non-ASCII in frames as Python did, and the client still reads it', async () => {
    answer(200, completion('Total ₹1,20,000 — approved'));
    const response = await post(REQUEST);
    const raw = await response.clone().text();
    expect(raw).toContain('\\u20b9');
    expect(await readLikeTheChatStore(response)).toBe('Total ₹1,20,000 — approved');
  });

  it('uses the summary prompt in summary mode', async () => {
    const calls = answer(200, completion('Where things stand.'));
    await readLikeTheChatStore(await post({ ...REQUEST, mode: 'summary' }));
    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent.messages[0].content).toContain('Summarise the conversation you are given');
  });

  it('answers with JSON when not asked to stream', async () => {
    answer(200, completion('Ravi.'));
    const response = await post({ prompt: 'Who?' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: 'Ravi.' });
  });

  it('sends a model failure as an error frame, which the chat store shows', async () => {
    answer(401, { error: { message: 'Incorrect API key', code: 'invalid_api_key' } });
    const response = await post(REQUEST);
    expect(response.status).toBe(200);
    expect(await response.clone().text()).toBe(
      'data: {"error": "The OpenAI API key was rejected. Check OPENAI_API_KEY in backend/.env."}\n\n',
    );
    await expect(readLikeTheChatStore(response)).rejects.toThrow(
      'The OpenAI API key was rejected. Check OPENAI_API_KEY in backend/.env.',
    );
  });

  it('answers a failed non-streamed call with 502', async () => {
    answer(429, { error: { message: 'Slow down', type: 'rate_limit_exceeded' } });
    const response = await post({ prompt: 'Who?' });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'The model is rate limited right now. Try again shortly.',
    });
  });

  it('rate limits at twelve a minute with a 429 the chat store reports', async () => {
    answer(200, completion('ok'));
    for (let index = 0; index < 12; index += 1) {
      expect((await post({ prompt: 'Hi' })).status).toBe(200);
    }
    const response = await post({ ...REQUEST });
    expect(response.status).toBe(429);
    const wait = Number(response.headers.get('Retry-After'));
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(60);
    await expect(readLikeTheChatStore(response)).rejects.toThrow(
      `Too many requests. Try again in ${wait}s.`,
    );
  });

  it('rejects an invalid body with a 422, before it counts against the limit', async () => {
    const calls = answer(200, completion('ok'));
    const response = await post({ ...REQUEST, prompt: '' });
    expect(response.status).toBe(422);
    const body = await response.clone().json();
    expect(body.detail[0]).toMatchObject({
      type: 'string_too_short',
      loc: ['body', 'prompt'],
      msg: 'String should have at least 1 character',
    });
    await expect(readLikeTheChatStore(response)).rejects.toThrow('AI request failed');

    const tooMany = await post({
      prompt: 'x',
      history: [{ role: 'system', content: 'x' }],
      mode: 'poem',
    });
    expect((await tooMany.json()).detail.map((issue: { loc: unknown[] }) => issue.loc)).toEqual([
      ['body', 'history', 0, 'role'],
      ['body', 'mode'],
    ]);
    expect(calls).toHaveLength(0);
  });

  describe('without a key', () => {
    beforeEach(() => {
      settings.key = '';
    });

    it('streams the transcript back, attributed, and never calls out', async () => {
      const calls = answer(200, completion('unused'));
      const response = await post(REQUEST);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
      const text = await readLikeTheChatStore(response);
      expect(calls).toHaveLength(0);
      expect(text).toBe(
        '**Running without a model key**, so this is the conversation itself rather than an ' +
          'analysis of it.\n\n**In the room:** Priya, Ravi\n\n**Last 2 messages**\n' +
          '- Priya: Approved the Rs 1,20,000 order.\n' +
          '- Ravi: I will confirm dispatch by Friday.\n\n' +
          'Add `OPENAI_API_KEY` to `backend/.env` for a real answer. ',
      );
    });

    it('answers JSON with the demo flag when not streaming', async () => {
      const response = await post({ prompt: 'Anything?' });
      expect(await response.json()).toEqual({
        reply:
          'The assistant is not connected to a model right now, and there are no recent ' +
          'messages in this conversation to work from.\n\n' +
          'Add `OPENAI_API_KEY` to `backend/.env` to turn it on.',
        demo: true,
      });
    });
  });
});

describe('GET /api/agent/status', () => {
  it('reports the model when a key is set', async () => {
    const response = await dispatch(agentRoutes, 'GET', '/api/agent/status', undefined);
    expect(await response.json()).toEqual({
      configured: true,
      provider: 'openai',
      model: 'gpt-test',
    });
  });

  it('reports no model without a key', async () => {
    settings.key = '';
    const response = await dispatch(agentRoutes, 'GET', '/api/agent/status', undefined);
    expect(await response.json()).toEqual({ configured: false, provider: 'openai', model: null });
  });
});
