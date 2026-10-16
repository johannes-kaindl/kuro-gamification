/* ==========================================================
   Zusammenspiel der Chat-Bausteine, wie askKuro() es herstellt.
   Der onload-Pfad selbst ist in main-onload.test.ts abgedeckt.
   ========================================================== */
import { addNote, extractNoteFromMessage, MAX_NOTES } from '../src/llm/kuroNotes';
import { buildMessages, resolvePersona } from '../src/llm/kuroPrompt';
import { buildContext } from '../src/llm/kuroContext';
import { ChatSession } from '../src/llm/ChatSession';
import { DEFAULT_SETTINGS } from '../src/types';
import { makePlugin, recordingTransport, sse, useTransport } from './helpers/connection';
import type { SseTransport } from '../src/vendor/kit-obsidian/chat-client';

async function plugin(transport: SseTransport) {
  const p = await makePlugin();
  p.chatSession = new ChatSession();
  p.logger = { error: () => {}, info: () => {} };
  useTransport(p, transport);
  p.data.settings.chatEndpoints = [{ url: 'http://x' }];
  return p;
}

describe('chat round trip (askKuro)', () => {
  it('records question and answer in the session', async () => {
    const p = await plugin(recordingTransport([sse('Antwort')]).transport);
    await p.askKuro('Frage');
    expect(p.chatSession.entries.map((e: { text: string }) => e.text)).toEqual(['Frage', 'Antwort']);
    expect(p.chatSession.busy).toBe(false);
  });

  it('records an error line that stays out of the prompt history', async () => {
    const p = await plugin({ async postStream() { throw new Error('refused'); } });
    await p.askKuro('Frage');
    expect(p.chatSession.entries).toHaveLength(2);
    expect(p.chatSession.entries[1]).toMatchObject({ role: 'error' });
    expect(p.chatSession.historyForPrompt()).toHaveLength(1);
  });

  it('ohne Endpunkt: Einrichtungs-Fehlerzeile mit dem Grund des Managers', async () => {
    const p = await makePlugin();
    p.chatSession = new ChatSession();
    p.logger = { error: () => {}, info: () => {} };
    useTransport(p, recordingTransport([]).transport);
    await p.askKuro('Frage');
    expect(p.chatSession.entries[1]).toMatchObject({ role: 'error', text: expect.stringContaining('No endpoint') });
  });

  it.each([
    ['secret-missing', 'API key'],
    ['disabled', 'switched off'],
    ['no-endpoint', 'no usable endpoint'],
  ] as const)('Manager ohne Endpunkt (%s): die Fehlerzeile nennt die Stelle des Managers', async (code, part) => {
    const api = {
      version: 1, list: () => [], get: () => null, models: async () => [],
      resolve: async () => ({ error: code }), materialize: async () => ({ error: 'not-found' }),
      importEndpoints: async () => ({ added: [], merged: [], skipped: [] }), on: () => () => {},
    };
    const p = await makePlugin(api);
    p.chatSession = new ChatSession();
    p.logger = { error: () => {}, info: () => {} };
    await p.askKuro('Frage');
    expect(p.chatSession.entries[1]).toMatchObject({ role: 'error', text: expect.stringContaining(part) });
  });

  it('Gemma 4 ohne Öffner: das Denken vor <channel|> wird aus der laufenden Antwort genommen (onContentReset)', async () => {
    const p = await plugin(recordingTransport([sse('Ich wäge ab'), sse('<channel|>'), sse('Die fertige '), sse('Antwort.')]).transport);
    p.data.settings.chatEndpoints = [{ url: 'http://x', model: 'google/gemma-4-e4b' }];
    const calls: string[] = [];
    p.chatViews = () => [{ appendChatToken: (t: string) => calls.push(`+${t}`), resetChatContent: () => calls.push('reset'), renderChat: () => {}, refreshChatContext: () => {} }];
    await p.askKuro('Frage');
    expect(calls).toEqual(['+Ich wäge ab', 'reset', '+Die fertige ', '+Antwort.']);
    expect(p.chatSession.entries.map((e: { text: string }) => e.text)).toEqual(['Frage', 'Die fertige Antwort.']);
  });

  it('wirft die Verbindung vor dem Senden, bleibt die Eingabe nicht gesperrt', async () => {
    const p = await makePlugin();
    p.chatSession = new ChatSession();
    p.logger = { error: () => {}, info: () => {} };
    p.llm = { complete: async () => { throw new Error('manager kaputt'); } };
    await p.askKuro('Frage');
    expect(p.chatSession.busy).toBe(false);
    expect(p.chatSession.streaming).toBeNull();
    expect(p.chatSession.entries[1]).toMatchObject({ role: 'error', detail: 'manager kaputt' });
  });

  it('Fristfehler nennen die Sekunden aus dem Kit-Detail statt einer festen Zahl', async () => {
    const p = await makePlugin();
    p.chatSession = new ChatSession();
    p.logger = { error: () => {}, info: () => {} };
    p.data.settings.chatEndpoints = [{ url: 'http://x' }];
    const silent: SseTransport = {
      postStream: (_u, _b, _h, _c, signal) => new Promise<number>((_res, reject) => {
        signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }, { once: true });
      }),
    };
    // Kurze Frist für den ersten Chunk, sonst wartete der Test 600 s.
    useTransport(p, silent, { timeouts: { firstChunkMs: 1500 } });
    await p.askKuro('Frage');
    expect(p.chatSession.entries[1].text).toContain('for 2 seconds');
    expect(p.chatSession.entries[1].text).not.toContain('120');
  });

  it('sends the previous turns but not the current question twice', () => {
    const session = new ChatSession();
    session.append({ role: 'user', text: 'erste Frage' });
    session.append({ role: 'assistant', text: 'erste Antwort' });
    // askKuro liest die History VOR dem Anhängen der neuen Frage.
    const history = session.historyForPrompt();
    session.append({ role: 'user', text: 'zweite Frage' });

    const msgs = buildMessages({
      lang: 'de',
      persona: resolvePersona({ override: '', lang: 'de' }),
      context: buildContext(null, null, DEFAULT_SETTINGS),
      notes: [],
      history,
      question: 'zweite Frage',
    });
    const asked = msgs.filter((m) => m.content === 'zweite Frage');
    expect(asked).toHaveLength(1);
    expect(msgs[msgs.length - 1].content).toBe('zweite Frage');
  });

  it('routes a remember-prefixed message to the notes instead of the model', () => {
    expect(extractNoteFromMessage('merk dir: keine Streak-Hinweise')).not.toBeNull();
    expect(extractNoteFromMessage('womit fange ich an?')).toBeNull();
  });

  it('bounds remembering by the note limit', () => {
    let notes: string[] = [];
    for (let i = 0; i < MAX_NOTES + 5; i++) notes = addNote(notes, `n${i}`);
    expect(notes).toHaveLength(MAX_NOTES);
    expect(notes[0]).toBe('n0');
  });
});
