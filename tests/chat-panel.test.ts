import { KuroChatPanel, type ChatPanelCallbacks } from '../src/views/KuroChatPanel';
import { ChatSession } from '../src/llm/ChatSession';
import type { DailyExtract } from '../src/llm/kuroContext';

/** Minimaler Fake-Host nach dem Muster des Obsidian-Mocks (tests/__mocks__/obsidian.ts),
 *  um `buildStreamArea` (obsidian-kit) aufnehmen zu können: addClass + appendChild dazu. */
function makeHost(): any {
  const el: any = { children: [] as any[], classes: new Set<string>(), text: '' };
  el.empty = () => { el.children = []; };
  el.setText = (s: string) => { el.text = s; };
  el.addClass = (c: string) => { el.classes.add(c); };
  el.createEl = (_tag: string, opts?: any) => {
    const child = makeHost();
    if (opts?.text) child.setText(opts.text);
    if (opts?.cls) child.classes = new Set(String(opts.cls).split(/\s+/).filter(Boolean));
    el.children.push(child);
    return child;
  };
  el.createDiv = (opts?: any) => el.createEl('div', opts);
  el.createSpan = (opts?: any) => el.createEl('span', opts);
  // ⚠️ Haengt an statt zu verschieben (echtes DOM verschiebt bei appendChild eines
  // bestehenden Kindes) — dieselbe dokumentierte Mock-Luecke wie
  // lingotuner/tests/view-soft.test.ts:187. Betrifft hier `line.appendChild(area.tailEl)`:
  // der Tail steht danach zweimal im Mock-Baum, im echten DOM einmal. Tests messen deshalb
  // nur Aussagen, die unter BEIDEN Zaehlweisen gelten (z. B. "der letzte Treffer").
  el.appendChild = (c: any) => { el.children.push(c); };
  el.addEventListener = () => {};
  return el;
}

/** Alle Elemente des Baums, die eine Klasse tragen — je Knoten-Identität höchstens einmal.
 *  Noetig wegen der dokumentierten Mock-Luecke bei `appendChild` (s. `makeHost`): ein
 *  verschobener Knoten haengt dort zusaetzlich an statt zu verschieben und wuerde sonst
 *  doppelt gezaehlt, waehrend das echte DOM ihn nur einmal fuehrt. */
function findAll(root: any, cls: string): any[] {
  const out: any[] = [];
  const seen = new Set<any>();
  const walk = (n: any): void => {
    if (seen.has(n)) return;
    seen.add(n);
    if (n.classes?.has(cls)) out.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  return out;
}

const extract = (over: Partial<DailyExtract> = {}): DailyExtract => ({
  tasks: [], habits: [], raw: null, mode: 'tasks', ...over,
});

function makePanel(session: ChatSession, over: Partial<ChatPanelCallbacks> = {}) {
  const host = makeHost();
  const calls = { asked: [] as string[], cleared: 0, aborted: 0 };
  const cb: ChatPanelCallbacks = {
    onAsk: (q) => calls.asked.push(q),
    onAbort: () => { calls.aborted++; },
    onClear: () => { calls.cleared++; },
    contextInfo: () => extract(),
    openSettings: () => {},
    ...over,
  };
  return { panel: new KuroChatPanel(host, 'de', session, cb), host, calls };
}

describe('KuroChatPanel', () => {
  it('renders the setup hint without a log or input', () => {
    const { panel, host } = makePanel(new ChatSession());
    panel.showSetupHint();
    expect(findAll(host, 'kuro-chat-log')).toHaveLength(0);
    expect(findAll(host, 'kuro-chat-input')).toHaveLength(0);
    expect(findAll(host, 'kuro-empty')).toHaveLength(1);
  });

  it('renders one line per entry', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    s.append({ role: 'assistant', text: 'antwort' });
    const { panel, host } = makePanel(s);
    panel.render();
    expect(findAll(host, 'kuro-chat-line')).toHaveLength(2);
  });

  it('shows an error line with its detail', () => {
    const s = new ChatSession();
    s.append({ role: 'error', text: 'Keine Verbindung', detail: 'ECONNREFUSED' });
    const { panel, host } = makePanel(s);
    panel.render();
    expect(findAll(host, 'kuro-chat-error')).toHaveLength(1);
    expect(findAll(host, 'kuro-chat-detail')).toHaveLength(1);
  });

  it('renders no pin button — pinning a raw message text was confusing (removed 2026-08-12, Jay-Feedback)', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    s.append({ role: 'assistant', text: 'antwort' });
    const { panel, host } = makePanel(s);
    panel.render();
    expect(findAll(host, 'kuro-chat-pin')).toHaveLength(0);
  });

  it('shows a cursor while streaming', () => {
    const s = new ChatSession();
    s.streaming = 'halb';
    const { panel, host } = makePanel(s);
    panel.render();
    expect(findAll(host, 'kuro-chat-cursor')).toHaveLength(1);
  });

  it('shows no cursor when idle', () => {
    const { panel, host } = makePanel(new ChatSession());
    panel.render();
    expect(findAll(host, 'kuro-chat-cursor')).toHaveLength(0);
  });

  it('renders the context summary from the same extract the prompt uses', () => {
    const { panel, host } = makePanel(new ChatSession(), {
      contextInfo: () => extract({ tasks: ['[ ] eine Aufgabe'], habits: ['🧘 Qi Gong: ja'] }),
    });
    panel.render();
    const body = findAll(host, 'kuro-chat-context-body')[0];
    expect(body.text).toContain('eine Aufgabe');
    expect(body.text).toContain('Qi Gong');
  });

  it('reports "nothing" for an empty extract', () => {
    const { panel, host } = makePanel(new ChatSession(), {
      contextInfo: () => extract({ mode: 'none' }),
    });
    panel.render();
    expect(findAll(host, 'kuro-chat-context-body')[0].text).toBe('(nichts)');
  });

  it('streamt den laufenden Absatz über den Kit-Antwortbereich (buildStreamArea)', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    s.streaming = '';
    const { panel, host } = makePanel(s);
    panel.render();
    expect(findAll(host, 'okit-stream-tail')).toHaveLength(1);

    panel.appendToken('Hal');
    s.streaming = 'Hal';
    panel.appendToken('lo');
    s.streaming = 'Hallo';

    // Nur der Tail wird fortgeschrieben — kein voller Re-Render, die feste Frage bleibt
    // die einzige weitere Zeile im Log.
    expect(findAll(host, 'kuro-chat-line')).toHaveLength(2);
    expect(findAll(host, 'okit-stream-tail')[0].text).toBe('Hallo');
  });

  it('haengt den Tail in die laufende Zeile, hinter den fertigen Einträgen im Log', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    s.append({ role: 'assistant', text: 'antwort' });
    s.streaming = 'läuft';
    const { panel, host } = makePanel(s);
    panel.render();

    const lines = findAll(host, 'kuro-chat-line');
    expect(lines).toHaveLength(3); // 2 fertige Einträge + die laufende Zeile
    const streamLine = findAll(host, 'kuro-chat-streaming')[0];
    // Die laufende Zeile ist die LETZTE der drei — sie steht hinter den fertigen Einträgen.
    expect(lines[lines.length - 1]).toBe(streamLine);
    // Und sie traegt den Kit-Tail im Inhaltsbereich der Zeile (dort landen auch die
    // fertig gerenderten Markdown-Blöcke, nicht nur der laufende Absatz).
    const content = findAll(streamLine, 'kuro-chat-stream-content')[0];
    expect((content.children as any[]).some((c) => c.classes?.has('okit-stream-tail'))).toBe(true);
  });

  it('idle nach dem Streaming: kein Cursor, Tail bleibt leer im Bereich', () => {
    const { panel, host } = makePanel(new ChatSession());
    panel.render();
    expect(findAll(host, 'kuro-chat-cursor')).toHaveLength(0);
    expect(findAll(host, 'okit-stream-tail')).toHaveLength(1);
  });

  describe('Markdown', () => {
    const md = () => {
      const calls: string[] = [];
      const renderMarkdown = (el: any, text: string): Promise<void> => {
        calls.push(text);
        el.setText(`<md>${text}`);
        return Promise.resolve();
      };
      return { calls, renderMarkdown };
    };

    it('rendert fertige Antworten als Markdown, die eigene Frage bleibt Rohtext', () => {
      const s = new ChatSession();
      s.append({ role: 'user', text: 'eine *Frage*' });
      s.append({ role: 'assistant', text: '**fett**\n\n- a\n- b' });
      const m = md();
      const { panel, host } = makePanel(s, { renderMarkdown: m.renderMarkdown });
      panel.render();
      expect(m.calls).toEqual(['**fett**\n\n- a\n- b']);
      const texts = findAll(host, 'kuro-chat-text');
      expect(texts[0].text).toBe('eine *Frage*');
      expect(texts[1].text).toBe('<md>**fett**\n\n- a\n- b');
      expect(texts[1].classes.has('markdown-rendered')).toBe(true);
    });

    it('zeigt den Rohtext, wenn das Rendern scheitert', async () => {
      const s = new ChatSession();
      s.append({ role: 'assistant', text: '**fett**' });
      const { panel, host } = makePanel(s, {
        renderMarkdown: () => Promise.reject(new Error('kaputt')),
      });
      panel.render();
      await Promise.resolve(); await Promise.resolve();
      expect(findAll(host, 'kuro-chat-text')[0].text).toBe('**fett**');
    });

    it('ohne Renderer bleibt es beim Rohtext (Tests, Einstellungs-Vorschau)', () => {
      const s = new ChatSession();
      s.append({ role: 'assistant', text: '**fett**' });
      const { panel, host } = makePanel(s);
      panel.render();
      expect(findAll(host, 'kuro-chat-text')[0].text).toBe('**fett**');
    });

    it('rendert im Stream nur abgeschlossene Absätze, der laufende bleibt Rohtext', () => {
      const s = new ChatSession();
      s.streaming = '';
      const m = md();
      const { panel, host } = makePanel(s, { renderMarkdown: m.renderMarkdown });
      panel.render();
      panel.appendToken('Erster **Absatz**');
      expect(m.calls).toEqual([]);
      panel.appendToken('\n\nZwei');
      expect(m.calls).toEqual(['Erster **Absatz**\n\n']);
      panel.appendToken('ter');
      // Bereits Gerendertes wird nicht noch einmal gerendert.
      expect(m.calls).toHaveLength(1);
      expect(findAll(host, 'okit-stream-tail')[0].text).toBe('Zweiter');
    });

    it('nach einem Neuzeichnen mitten im Stream steht der Stand des Streams wieder da', () => {
      const s = new ChatSession();
      s.streaming = 'Eins\n\nZw';
      const m = md();
      const { panel, host } = makePanel(s, { renderMarkdown: m.renderMarkdown });
      panel.render();
      expect(m.calls).toEqual(['Eins\n\n']);
      expect(findAll(host, 'okit-stream-tail').pop().text).toBe('Zw');
    });
  });

  describe('Kontextzeile', () => {
    it('refreshContext schreibt Zeile und Vorschau um, ohne den Chat neu zu zeichnen', () => {
      let info = extract({ mode: 'none' });
      const s = new ChatSession();
      s.append({ role: 'user', text: 'frage' });
      const { panel, host } = makePanel(s, { contextInfo: () => info });
      panel.render();
      const lineBefore = findAll(host, 'kuro-chat-line')[0];
      expect(findAll(host, 'kuro-chat-context-body')[0].text).toBe('(nichts)');

      info = extract({ tasks: ['[ ] neu'], habits: [] });
      panel.refreshContext();

      expect(findAll(host, 'kuro-chat-context-body')[0].text).toContain('neu');
      expect(findAll(host, 'kuro-chat-context-summary')[0].text).toContain('1');
      expect(findAll(host, 'kuro-chat-line')[0]).toBe(lineBefore);
    });

    it('refreshContext ohne gezeichneten Chat (Einrichtungs-Hinweis) tut nichts', () => {
      const { panel } = makePanel(new ChatSession());
      panel.showSetupHint();
      expect(() => panel.refreshContext()).not.toThrow();
    });
  });
});
