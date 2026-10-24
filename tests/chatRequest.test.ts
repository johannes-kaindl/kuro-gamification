import { splitChatMessages } from '../src/llm/chatRequest';
import { addUser, failAnswer, historyForModel, startAnswer, EMPTY_CHAT } from '../src/vendor/kit/chat-history';
import { buildMessages, resolvePersona } from '../src/llm/kuroPrompt';

describe('splitChatMessages', () => {
  it('die letzte Nachricht ist die Frage (getrimmt), davor der Verlauf', () => {
    const r = splitChatMessages([
      { role: 'user', content: 'erste Frage' },
      { role: 'assistant', content: 'erste Antwort' },
      { role: 'user', content: '  zweite Frage \n' },
    ]);
    expect(r.question).toBe('zweite Frage');
    expect(r.history).toEqual([
      { role: 'user', content: 'erste Frage' },
      { role: 'assistant', content: 'erste Antwort' },
    ]);
  });

  it('Werkzeug-Nachrichten gehören nicht in den Verlauf', () => {
    const r = splitChatMessages([
      { role: 'tool', content: 'x', tool_call_id: '1' },
      { role: 'user', content: 'Frage' },
    ]);
    expect(r.history).toEqual([]);
  });

  it('ohne Nachrichten: leere Frage, leerer Verlauf', () => {
    expect(splitChatMessages([])).toEqual({ history: [], question: '' });
  });

  it('eine gescheiterte Runde bleibt aus dem Verlauf (Regel von chat-history), die Frage steht genau einmal im Prompt', () => {
    let h = addUser(EMPTY_CHAT, 'erste Frage').history;
    const a1 = startAnswer(h);
    h = failAnswer(a1.history, a1.id, { kind: 'network' });
    h = addUser(h, 'zweite Frage').history;
    const a2 = startAnswer(h);
    // So steht der Verlauf, wenn das Fenster `send` ruft: die Frage ist drin, die Antwort läuft erst (`startAnswer`).
    const parts = splitChatMessages(historyForModel(a2.history));
    const msgs = buildMessages({
      lang: 'de',
      persona: resolvePersona({ override: '', lang: 'de' }),
      context: '',
      notes: [],
      history: parts.history,
      question: parts.question,
    });
    expect(msgs.filter((m) => m.content === 'zweite Frage')).toHaveLength(1);
    expect(msgs.some((m) => m.content === 'erste Frage')).toBe(false);
    expect(msgs[msgs.length - 1]?.content).toBe('zweite Frage');
  });
});
