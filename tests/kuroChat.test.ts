/* Kuros Chat-Aufruf über den Kit-Client (`createChatClient`). Was der Client selbst kann —
   Abbruch, Fristen, Fehlerkörper, Fallback ohne Stream — ist im Kit abgedeckt (MIGRATION 0.42.0,
   Punkt 5). Hier steht, was DIESES Plugin daraus macht: welche Parameter es schickt, was es
   vom Ergebnis anzeigt und wie es Kit-Ergebnisse in Anzeigefälle übersetzt. */
import { createChatClient, type SseTransport } from '../src/vendor/kit-obsidian/chat-client';
import type { ClockPort } from '../src/vendor/kit-obsidian/clock';
import { effectiveSuppress, kuroChatParams, streamKuro, type KuroChatConfig } from '../src/llm/kuroChat';

const nodeClock: ClockPort = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
};

const CFG: KuroChatConfig = {
  endpoint: { url: 'http://localhost:1234/', apiKey: '' }, model: 'test-model', suppressThinking: false,
};
const MSGS = [{ role: 'user' as const, content: 'hallo' }];

const clientOf = (transport: SseTransport, idleTimeoutMs?: number) =>
  createChatClient({ transport, clock: nodeClock, ...(idleTimeoutMs !== undefined ? { idleTimeoutMs } : {}) });

const fake = (chunks: string[], status = 200): SseTransport => ({
  async postStream(_u, _b, _h, onChunk) { for (const c of chunks) onChunk(c); return status; },
});
const sse = (text: string): string => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
const sseReasoning = (text: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: text } }] })}\n\n`;

describe('streamKuro', () => {
  it('assembles streamed content and reports each token', async () => {
    const tokens: string[] = [];
    const out = await streamKuro(clientOf(fake([sse('Hallo'), sse(' Welt')])), CFG, MSGS, (t) => tokens.push(t), new AbortController().signal);
    expect(out).toMatchObject({ ok: true, content: 'Hallo Welt', truncated: false });
    expect(tokens.join('')).toBe('Hallo Welt');
  });

  it('strips a think block from the visible answer and never shows reasoning', async () => {
    const tokens: string[] = [];
    const out = await streamKuro(
      clientOf(fake([sseReasoning('grübel'), sse('<think>mehr</think>Antwort')])),
      CFG, MSGS, (t) => tokens.push(t), new AbortController().signal,
    );
    expect(out).toMatchObject({ ok: true, content: 'Antwort' });
    expect(tokens.join('')).toBe('Antwort');
  });

  it('sends the companion sampling values and the model as params in the body', async () => {
    let seen: Record<string, unknown> = {};
    let seenUrl = '';
    const t: SseTransport = { async postStream(url, body) { seenUrl = url; seen = body as Record<string, unknown>; return 200; } };
    await streamKuro(clientOf(t), CFG, MSGS, () => {}, new AbortController().signal);
    expect(seenUrl).toBe('http://localhost:1234/v1/chat/completions');
    expect(seen).toMatchObject({ model: 'test-model', stream: true, temperature: 0.7, max_tokens: 1024 });
  });

  it('sends an Authorization header only when an api key is set', async () => {
    let seen: Record<string, string> = {};
    const t: SseTransport = { async postStream(_u, _b, headers) { seen = headers; return 200; } };
    await streamKuro(clientOf(t), CFG, MSGS, () => {}, new AbortController().signal);
    expect(seen.Authorization).toBeUndefined();
    await streamKuro(clientOf(t), { ...CFG, endpoint: { url: 'http://x', apiKey: 'geheim' } }, MSGS, () => {}, new AbortController().signal);
    expect(seen.Authorization).toBe('Bearer geheim');
  });

  it('a healthy stream longer than the idle timeout does not time out', async () => {
    const t: SseTransport = {
      async postStream(_u, _b, _h, onChunk) {
        for (let i = 0; i < 4; i += 1) {
          onChunk(sse(`t${i} `));
          await new Promise((r) => setTimeout(r, 30));
        }
        return 200;
      },
    };
    const out = await streamKuro(clientOf(t, 80), CFG, MSGS, () => {}, new AbortController().signal);
    expect(out).toMatchObject({ ok: true, content: 't0 t1 t2 t3 ' });
  });

  it('a silent server ends with timeout once the idle timeout passes', async () => {
    const t: SseTransport = {
      postStream(_u, _b, _h, _c, signal) {
        return new Promise<number>((_res, reject) => {
          signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }, { once: true });
        });
      },
    };
    const out = await streamKuro(clientOf(t, 20), CFG, MSGS, () => {}, new AbortController().signal);
    expect(out).toMatchObject({ ok: false, kind: 'timeout' });
  });

  it('puts the server message into detail on an HTTP error', async () => {
    const out = await streamKuro(
      clientOf(fake(['{"error":{"message":"model not loaded"}}'], 400)),
      CFG, MSGS, () => {}, new AbortController().signal,
    );
    expect(out).toMatchObject({ ok: false, kind: 'http' });
    if (!out.ok) expect(out.detail).toContain('model not loaded');
  });

  it('keeps partial text when the stream is aborted mid-flight', async () => {
    const t: SseTransport = {
      async postStream(_u, _b, _h, onChunk) { onChunk(sse('halb')); const e = new Error('aborted'); e.name = 'AbortError'; throw e; },
    };
    const out = await streamKuro(clientOf(t), CFG, MSGS, () => {}, new AbortController().signal);
    expect(out).toMatchObject({ ok: false, kind: 'aborted', partial: 'halb' });
  });

  it('reports truncated text as ok with the truncated flag set', async () => {
    const finish = `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }] })}\n\n`;
    const out = await streamKuro(clientOf(fake([sse('abgeschn'), finish])), CFG, MSGS, () => {}, new AbortController().signal);
    expect(out).toMatchObject({ ok: true, content: 'abgeschn', truncated: true });
  });
});

describe('kuroChatParams / effectiveSuppress', () => {
  it('always carries the fixed companion values', () => {
    expect(kuroChatParams('llama-3-8b', false)).toEqual({ temperature: 0.7, max_tokens: 1024 });
  });
  it('adds suppress parameters only when wanted and the model can', () => {
    expect(Object.keys(kuroChatParams('llama-3-8b', true)).length).toBeGreaterThan(2);
  });
  it('effectiveSuppress is false when the user does not want it, true for an ordinary model', () => {
    expect(effectiveSuppress('any-model', false)).toBe(false);
    expect(effectiveSuppress('llama-3-8b', true)).toBe(true);
  });
});
