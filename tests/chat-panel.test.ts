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
    // Und sie traegt den Kit-Tail direkt als Kind (nicht nur irgendwo im Baum).
    expect((streamLine.children as any[]).some((c) => c.classes?.has('okit-stream-tail'))).toBe(true);
  });

  it('idle nach dem Streaming: kein Cursor, Tail bleibt leer im Bereich', () => {
    const { panel, host } = makePanel(new ChatSession());
    panel.render();
    expect(findAll(host, 'kuro-chat-cursor')).toHaveLength(0);
    expect(findAll(host, 'okit-stream-tail')).toHaveLength(1);
  });
});
