import { KuroChatPanel, type ChatPanelCallbacks } from '../src/views/KuroChatPanel';
import { ChatSession } from '../src/llm/ChatSession';
import type { DailyExtract } from '../src/llm/kuroContext';

/** Minimaler Fake-Host nach dem Muster des Obsidian-Mocks. */
function makeHost(): any {
  const el: any = { children: [] as any[], classes: new Set<string>(), text: '' };
  el.empty = () => { el.children = []; };
  el.setText = (s: string) => { el.text = s; };
  el.createEl = (_tag: string, opts?: any) => {
    const child = makeHost();
    if (opts?.text) child.setText(opts.text);
    if (opts?.cls) child.classes = new Set(String(opts.cls).split(/\s+/).filter(Boolean));
    el.children.push(child);
    return child;
  };
  el.createDiv = (opts?: any) => el.createEl('div', opts);
  el.createSpan = (opts?: any) => el.createEl('span', opts);
  el.addEventListener = () => {};
  return el;
}

/** Alle Elemente des Baums, die eine Klasse tragen. */
function findAll(root: any, cls: string): any[] {
  const out: any[] = [];
  const walk = (n: any): void => {
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
  const calls = { asked: [] as string[], remembered: [] as string[], cleared: 0, aborted: 0 };
  const cb: ChatPanelCallbacks = {
    onAsk: (q) => calls.asked.push(q),
    onAbort: () => { calls.aborted++; },
    onClear: () => { calls.cleared++; },
    onRemember: (txt) => calls.remembered.push(txt),
    canRemember: () => true,
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

  it('offers a pin button only on the user\'s own lines', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    s.append({ role: 'assistant', text: 'antwort' });
    const { panel, host } = makePanel(s);
    panel.render();
    expect(findAll(host, 'kuro-chat-pin')).toHaveLength(1);
  });

  it('disables the pin button when the notes are full', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'frage' });
    const { panel, host } = makePanel(s, { canRemember: () => false });
    panel.render();
    expect(findAll(host, 'kuro-chat-pin')[0].disabled).toBe(true);
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
});
