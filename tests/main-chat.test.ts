/* ==========================================================
   Zusammenspiel der Chat-Bausteine, wie das Plugin sie dem Kit-Fenster reicht:
   `sendChat` (Prompt-Bau und Verbindung) und `handleChatCommand` („merk dir“),
   dazu das echte Fenster, damit Fehlertexte und Fristen so ankommen, wie sie
   gezeigt werden (das Fenster formuliert sie, nicht mehr das Plugin).
   Der onload-Pfad selbst ist in main-onload.test.ts abgedeckt.
   ========================================================== */
import { addNote, extractNoteFromMessage, MAX_NOTES } from '../src/llm/kuroNotes';
import { KuroChatPanel } from '../src/views/KuroChatPanel';
import { EMPTY_CHAT, type ChatHistory } from '../src/vendor/kit/chat-history';
import type { ChatSendHandlers } from '../src/vendor/kit-obsidian/chat-window';
import { Notice } from 'obsidian';
import { makePlugin, recordingTransport, sse, useTransport } from './helpers/connection';
import { makeFakeEl } from './vendor/kit/obsidian-mock';
import { installWindowTimers } from './vendor/kit/window-timers';
import type { SseTransport } from '../src/vendor/kit-obsidian/chat-client';

let restoreWindow: () => void = () => {};
beforeAll(() => { restoreWindow = installWindowTimers({ full: true }); });
afterAll(() => { restoreWindow(); });

async function plugin(transport: SseTransport) {
  const p = await makePlugin();
  p.logger = { error: jest.fn(), info: () => {} };
  useTransport(p, transport);
  p.data.settings.chatEndpoints = [{ url: 'http://x' }];
  return p;
}

/** Handler wie das Fenster sie reicht, mit Mitschrift. */
function handlers(): { h: ChatSendHandlers; calls: string[]; controller: AbortController } {
  const calls: string[] = [];
  const controller = new AbortController();
  const h: ChatSendHandlers = {
    signal: controller.signal,
    onToken: (t) => { calls.push(`+${t}`); },
    onReasoning: (t) => { calls.push(`~${t}`); },
    onContentReset: () => { calls.push('reset'); },
    answerId: 1,
    setMeta: () => {},
  };
  return { h, calls, controller };
}

/** Das echte Fenster vor `plugin.sendChat`: so sehen Nutzer, was `sendChat` liefert. */
function window_(p: any) {
  const host = makeFakeEl();
  let history: ChatHistory = EMPTY_CHAT;
  const panel = new KuroChatPanel(host as never, 'en', {
    app: p.app,
    // Die Modellzeile fragt die Verbindung nach der Modell-Liste (Netz, Fristen-Timer); getestet wird sie in chat-panel.test.ts.
    llm: { models: async () => ({ models: [], reachable: true }), setModel: async () => {}, modelInUse: () => '', source: () => ({ family: null, model: '', sentModel: '' }) } as never,
    initial: EMPTY_CHAT,
    onChange: (h) => { history = h; },
    send: (m, h) => p.sendChat(m, h),
    handleCommand: (t) => p.handleChatCommand(t),
    contextInfo: () => ({ tasks: [], habits: [], numbers: [], raw: null, mode: 'none' }),
    hasEndpoint: () => p.hasChatEndpointSource(),
    linkOptions: () => ({ allowObsidianLinks: false, allowLocalImages: false }),
    openSettings: () => {},
    renderMarkdown: async (el, md) => { el.setText(md); },
  }, { domGuard: false });
  panel.build();
  return { panel, host, history: () => history };
}

describe('sendChat', () => {
  it('streams the tokens to the window handlers and returns the finished answer', async () => {
    const p = await plugin(recordingTransport([sse('Ant'), sse('wort')]).transport);
    const { h, calls } = handlers();
    const r = await p.sendChat([{ role: 'user', content: 'Frage' }], h);
    expect(r).toMatchObject({ ok: true, content: 'Antwort' });
    expect(calls).toEqual(['+Ant', '+wort']);
  });

  it('sends the persona, the previous turns and the question — once, last, trimmed', async () => {
    const rec = recordingTransport([sse('ok')]);
    const p = await plugin(rec.transport);
    await p.sendChat([
      { role: 'user', content: 'erste Frage' },
      { role: 'assistant', content: 'erste Antwort' },
      { role: 'user', content: '  zweite Frage \n' },
    ], handlers().h);
    const msgs = rec.sent[0]!.body.messages as Array<{ role: string; content: string }>;
    expect(msgs[0]!.role).toBe('system');
    expect(msgs.slice(1).map((m) => `${m.role}:${m.content}`)).toEqual(['user:erste Frage', 'assistant:erste Antwort', 'user:zweite Frage']);
  });

  it('does not ask the model for reasoning display: no onReasoning reaches the connection', async () => {
    const p = await plugin(recordingTransport([sse('Antwort')]).transport);
    const seen: Array<Record<string, unknown>> = [];
    const real = p.llm.complete.bind(p.llm);
    p.llm.complete = (req: unknown, handlers2: Record<string, unknown>) => { seen.push(handlers2); return real(req, handlers2); };
    await p.sendChat([{ role: 'user', content: 'Frage' }], handlers().h);
    expect(seen[0]).toBeDefined();
    expect(seen[0]!.onReasoning).toBeUndefined();
  });

  it('Gemma 4 ohne Öffner: das Denken vor <channel|> wird aus der laufenden Antwort genommen (onContentReset)', async () => {
    const p = await plugin(recordingTransport([sse('Ich wäge ab'), sse('<channel|>'), sse('Die fertige '), sse('Antwort.')]).transport);
    p.data.settings.chatEndpoints = [{ url: 'http://x', model: 'google/gemma-4-e4b' }];
    const { h, calls } = handlers();
    const r = await p.sendChat([{ role: 'user', content: 'Frage' }], h);
    expect(calls).toEqual(['+Ich wäge ab', 'reset', '+Die fertige ', '+Antwort.']);
    expect(r).toMatchObject({ ok: true, content: 'Die fertige Antwort.' });
  });

  it('a failure is returned (not thrown) and logged', async () => {
    const p = await plugin({ async postStream() { throw new Error('refused'); } });
    const r = await p.sendChat([{ role: 'user', content: 'Frage' }], handlers().h);
    expect(r.ok).toBe(false);
    expect(p.logger.error).toHaveBeenCalledWith('chat failed', r.kind, r.detail);
  });

  it('wirft die Verbindung vor dem Senden, wird der Wurf geloggt und weitergereicht (das Fenster zeigt die Fehlerzeile)', async () => {
    const p = await makePlugin();
    p.logger = { error: jest.fn(), info: () => {} };
    p.llm = { complete: async () => { throw new Error('manager kaputt'); } };
    await expect(p.sendChat([{ role: 'user', content: 'Frage' }], handlers().h)).rejects.toThrow('manager kaputt');
    expect(p.logger.error).toHaveBeenCalledWith('chat failed before sending', 'manager kaputt');
  });
});

describe('Fehlerzeilen im Fenster (Wortlaut des Kits)', () => {
  it('ohne Endpunkt: die Fehlerzeile nennt die Einrichtung', async () => {
    const p = await makePlugin();
    p.logger = { error: () => {}, info: () => {} };
    useTransport(p, recordingTransport([]).transport);
    const w = window_(p);
    await w.panel.submit('Frage');
    expect(w.host.textContent).toContain('No endpoint');
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
    p.logger = { error: () => {}, info: () => {} };
    const w = window_(p);
    await w.panel.submit('Frage');
    expect(w.host.textContent).toContain(part);
  });

  it('Fristfehler nennen die Frist in ganzen Sekunden statt einer festen Zahl', async () => {
    const p = await makePlugin();
    p.logger = { error: () => {}, info: () => {} };
    p.data.settings.chatEndpoints = [{ url: 'http://x' }];
    const silent: SseTransport = {
      postStream: (_u, _b, _h, _c, signal) => new Promise<number>((_res, reject) => {
        signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }, { once: true });
      }),
    };
    // Kurze Frist für den ersten Chunk, sonst wartete der Test 600 s.
    useTransport(p, silent, { timeouts: { firstChunkMs: 1500 } });
    const w = window_(p);
    await w.panel.submit('Frage');
    // Seit Kit 0.70.0 rundet das Fenster die Frist auf ganze Sekunden (mindestens 1); ein Detail steht bei einem Fristfehler nicht mehr dabei.
    expect(w.host.textContent).toContain('for 2 s');
    expect(w.host.textContent).not.toContain('600');
  });

  it('der Fehler eines Fehlschlags bleibt aus dem nächsten Prompt (Regel von chat-history)', async () => {
    const rec = recordingTransport([sse('ok')]);
    const p = await plugin({ async postStream() { throw new Error('refused'); } });
    const w = window_(p);
    await w.panel.submit('erste Frage');
    useTransport(p, rec.transport);
    p.data.settings.chatEndpoints = [{ url: 'http://x' }];
    (w.panel as any).deps.send = (m: never, h: never) => p.sendChat(m, h);
    await w.panel.submit('zweite Frage');
    const msgs = rec.sent[0]!.body.messages as Array<{ content: string }>;
    expect(msgs.some((m) => m.content === 'erste Frage')).toBe(false);
    expect(msgs[msgs.length - 1]!.content).toBe('zweite Frage');
  });
});

describe('handleChatCommand („merk dir“)', () => {
  it('ein Merkzettel-Eintrag geht nicht ans Modell, und der Merkzettel wächst', async () => {
    const rec = recordingTransport([sse('ok')]);
    const p = await plugin(rec.transport);
    p.persist = jest.fn(async () => {});
    const w = window_(p);
    await w.panel.submit('merk dir: keine Streak-Hinweise');
    expect(rec.sent).toHaveLength(0);
    expect(p.data.kuroNotes).toEqual(['keine Streak-Hinweise']);
    expect(w.history().entries).toEqual([]);
  });

  it('eine gewöhnliche Frage ist kein Befehl', async () => {
    const p = await plugin(recordingTransport([sse('ok')]).transport);
    expect(p.handleChatCommand('womit fange ich an?')).toBe(false);
    expect(p.data.kuroNotes).toEqual([]);
  });

  it('ist der Merkzettel voll, sagt eine Notice es, und nichts wird still verworfen', async () => {
    const p = await plugin(recordingTransport([sse('ok')]).transport);
    p.data.kuroNotes = Array.from({ length: MAX_NOTES }, (_, i) => `n${i}`);
    const shown = (Notice as unknown as { instances: string[] }).instances;
    shown.length = 0;
    expect(p.handleChatCommand('merk dir: noch einer')).toBe(true);
    expect(p.data.kuroNotes).toHaveLength(MAX_NOTES);
    expect(p.data.kuroNotes).not.toContain('noch einer');
    expect(shown.some((m) => m.includes(String(MAX_NOTES)))).toBe(true);
  });
});

describe('Verbindung → Modellzeile', () => {
  it('jede Änderung, die die Verbindung speichert, lässt die Chat-Fenster nachziehen (Endpunkt, Wahl, Modell, Anfrage)', async () => {
    // Mit Manager speichert ein Modellwechsel die Wahl sofort (`choice`) — über die Optionen aus onload, wie jede Änderung der Verbindung.
    const api = {
      version: 1, list: () => [], get: () => null, models: async () => [],
      resolve: async () => ({ error: 'no-endpoint' }), materialize: async () => ({ error: 'not-found' }),
      importEndpoints: async () => ({ added: [], merged: [], skipped: [] }), on: () => () => {},
    };
    const p = await makePlugin(api);
    const calls: Array<{ models?: boolean } | undefined> = [];
    p.syncChat = (o?: { models?: boolean }) => { calls.push(o); };
    p.persist = jest.fn(async () => {});
    await p.llm.setModel('m2');
    expect(p.data.settings.chatChoice).toMatchObject({ model: 'm2' });
    expect(p.persist).toHaveBeenCalled();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c?.models === true)).toBe(true);
  });
});

describe('Bausteine des Merkzettels', () => {
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
