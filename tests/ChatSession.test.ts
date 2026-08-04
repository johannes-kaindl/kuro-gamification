import { ChatSession, type ChatEntry } from '../src/llm/ChatSession';

describe('ChatSession', () => {
  it('starts empty and idle', () => {
    const s = new ChatSession();
    expect(s.entries).toEqual([]);
    expect(s.busy).toBe(false);
    expect(s.streaming).toBeNull();
  });

  it('keeps entries in order', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    s.append({ role: 'assistant', text: 'antwort' });
    expect(s.entries.map((e) => e.text)).toEqual(['frage', 'antwort']);
  });

  it('excludes error lines from the prompt history', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    s.append({ role: 'error', text: 'Verbindung verweigert', detail: 'ECONNREFUSED' });
    s.append({ role: 'assistant', text: 'antwort' });
    expect(s.historyForPrompt()).toEqual([
      { role: 'user', content: 'frage' },
      { role: 'assistant', content: 'antwort' },
    ]);
  });

  it('clears everything on reset', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    s.streaming = 'halb';
    s.busy = true;
    s.reset();
    expect(s.entries).toEqual([]);
    expect(s.streaming).toBeNull();
    expect(s.busy).toBe(false);
  });

  it('does not expose a mutable entry list', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'a' });
    (s.entries as ChatEntry[]).push({ role: 'user', text: 'b' });
    expect(s.entries).toHaveLength(1);
  });
});
