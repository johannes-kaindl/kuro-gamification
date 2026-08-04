import { KuroChatClient, effectiveSuppress, type SseTransport, type ChatConfig } from '../src/llm/KuroChatClient';

const CFG: ChatConfig = {
  endpoint: 'http://localhost:1234/', apiKey: '', model: 'test-model', suppressThinking: false,
};
const MSGS = [{ role: 'user' as const, content: 'hallo' }];

/** Transport, der vorgegebene Rohstücke ausliefert. */
const fakeTransport = (chunks: string[], status = 200): SseTransport => ({
  async postStream(_url, _body, _headers, onChunk) {
    for (const c of chunks) onChunk(c);
    return status;
  },
});

const sse = (text: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

describe('KuroChatClient.stream', () => {
  it('assembles streamed content and reports each token', async () => {
    const tokens: string[] = [];
    const client = new KuroChatClient(fakeTransport([sse('Hallo'), sse(' Welt')]));
    const out = await client.stream(CFG, MSGS, (t) => tokens.push(t), new AbortController().signal);
    expect(out).toEqual({ ok: true, content: 'Hallo Welt' });
    expect(tokens.join('')).toBe('Hallo Welt');
  });

  it('strips a think block from the visible answer', async () => {
    const client = new KuroChatClient(fakeTransport([sse('<think>grübel</think>Antwort')]));
    const out = await client.stream(CFG, MSGS, () => {}, new AbortController().signal);
    expect(out).toEqual({ ok: true, content: 'Antwort' });
  });

  it('returns aborted without calling the transport when the signal is already aborted', async () => {
    let called = false;
    const t: SseTransport = { async postStream() { called = true; return 200; } };
    const ctrl = new AbortController();
    ctrl.abort();
    const out = await new KuroChatClient(t).stream(CFG, MSGS, () => {}, ctrl.signal);
    expect(called).toBe(false);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.kind).toBe('aborted');
  });

  it('keeps partial content when the stream is aborted mid-flight', async () => {
    const t: SseTransport = {
      async postStream(_u, _b, _h, onChunk) {
        onChunk(sse('halb'));
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
    };
    const out = await new KuroChatClient(t).stream(CFG, MSGS, () => {}, new AbortController().signal);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe('aborted');
      expect(out.partial).toBe('halb');
    }
  });

  it('classifies a non-2xx status as http and caps the error body', async () => {
    const out = await new KuroChatClient(fakeTransport(['x'.repeat(5000)], 500))
      .stream(CFG, MSGS, () => {}, new AbortController().signal);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe('http');
      expect(out.detail).toContain('500');
      expect(out.detail.length).toBeLessThan(2200);
    }
  });

  it('classifies a thrown transport error as network', async () => {
    const t: SseTransport = { async postStream() { throw new Error('connection refused'); } };
    const out = await new KuroChatClient(t).stream(CFG, MSGS, () => {}, new AbortController().signal);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe('network');
      expect(out.detail).toContain('connection refused');
    }
  });

  it('reports a timeout when the transport never returns', async () => {
    const t: SseTransport = {
      postStream(_u, _b, _h, _c, signal) {
        return new Promise<number>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
        });
      },
    };
    const out = await new KuroChatClient(t, 20).stream(CFG, MSGS, () => {}, new AbortController().signal);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.kind).toBe('timeout');
  });

  it('posts to the normalized chat-completions URL with the model and stream flag', async () => {
    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    const t: SseTransport = {
      async postStream(url, body) {
        seenUrl = url;
        seenBody = body as Record<string, unknown>;
        return 200;
      },
    };
    await new KuroChatClient(t).stream(CFG, MSGS, () => {}, new AbortController().signal);
    expect(seenUrl).toBe('http://localhost:1234/v1/chat/completions');
    expect(seenBody.model).toBe('test-model');
    expect(seenBody.stream).toBe(true);
  });

  it('sends an Authorization header only when an api key is set', async () => {
    let seen: Record<string, string> = {};
    const t: SseTransport = {
      async postStream(_u, _b, headers) { seen = headers; return 200; },
    };
    await new KuroChatClient(t).stream(CFG, MSGS, () => {}, new AbortController().signal);
    expect(seen.Authorization).toBeUndefined();

    await new KuroChatClient(t).stream(
      { ...CFG, apiKey: 'geheim' }, MSGS, () => {}, new AbortController().signal,
    );
    expect(seen.Authorization).toBe('Bearer geheim');
  });
});

describe('effectiveSuppress', () => {
  it('is false when the user does not want suppression', () => {
    expect(effectiveSuppress('any-model', false)).toBe(false);
  });
  it('is true for an ordinary model when the user wants it', () => {
    expect(effectiveSuppress('llama-3-8b', true)).toBe(true);
  });
});
