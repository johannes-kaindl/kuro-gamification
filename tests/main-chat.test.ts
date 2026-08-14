/* ==========================================================
   Zusammenspiel der Chat-Bausteine, wie askKuro() es herstellt.
   Der onload-Pfad selbst ist in main-onload.test.ts abgedeckt.
   ========================================================== */
import { ChatSession } from '../src/llm/ChatSession';
import { KuroChatClient, type SseTransport } from '../src/llm/KuroChatClient';
import { addNote, extractNoteFromMessage, MAX_NOTES } from '../src/llm/kuroNotes';
import { buildMessages, resolvePersona } from '../src/llm/kuroPrompt';
import { buildContext } from '../src/llm/kuroContext';
import { DEFAULT_SETTINGS } from '../src/types';
import type { ClockPort } from '../src/vendor/kit-obsidian/clock';

const nodeClock: ClockPort = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
};

const CFG = { endpoint: 'http://x', apiKey: '', model: 'm', suppressThinking: false };

const sse = (t: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`;

describe('chat round trip', () => {
  it('records question and answer in the session', async () => {
    const session = new ChatSession();
    const transport: SseTransport = {
      async postStream(_u, _b, _h, onChunk) { onChunk(sse('Antwort')); return 200; },
    };
    session.append({ role: 'user', text: 'Frage' });
    session.busy = true;
    const out = await new KuroChatClient(transport, 120_000, nodeClock)
      .stream(CFG, session.historyForPrompt(), () => {}, new AbortController().signal);
    session.busy = false;
    if (out.ok) session.append({ role: 'assistant', text: out.content });
    expect(session.entries.map((e) => e.text)).toEqual(['Frage', 'Antwort']);
  });

  it('records an error line that stays out of the prompt history', async () => {
    const session = new ChatSession();
    const transport: SseTransport = { async postStream() { throw new Error('refused'); } };
    session.append({ role: 'user', text: 'Frage' });
    const out = await new KuroChatClient(transport, 120_000, nodeClock)
      .stream(CFG, session.historyForPrompt(), () => {}, new AbortController().signal);
    if (!out.ok) session.append({ role: 'error', text: 'Fehler', detail: out.detail });
    expect(session.entries).toHaveLength(2);
    expect(session.historyForPrompt()).toHaveLength(1);
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
