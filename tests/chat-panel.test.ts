/* ==========================================================
   Der Wirt des Kit-Chat-Fensters (KuroChatPanel) gegen das echte
   Fenster und die echte Modellzeile des Kits, im Fake-DOM des Kits.
   Das Fake-DOM kennt keine CSS-Kaskade: was eine Klasse verbirgt,
   misst der GUI-Smoke.
   ========================================================== */
import { KuroChatPanel, type ChatPanelDeps } from '../src/views/KuroChatPanel';
import type { DailyExtract } from '../src/llm/kuroContext';
import * as chatWindow from '../src/vendor/kit-obsidian/chat-window';
import type { ChatSendHandlers, ChatSendResult } from '../src/vendor/kit-obsidian/chat-window';
import { EMPTY_CHAT, type ChatHistory } from '../src/vendor/kit/chat-history';
import { makeFakeEl } from './vendor/kit/obsidian-mock';
import { installWindowTimers } from './vendor/kit/window-timers';

// Das Kit-Fenster nimmt seine Uhr aus `window` (Renderer); die Testumgebung ist Node.
let restoreWindow: () => void = () => {};
beforeAll(() => { restoreWindow = installWindowTimers({ full: true }); });
afterAll(() => { restoreWindow(); });

const extract = (over: Partial<DailyExtract> = {}): DailyExtract => ({
  tasks: [], habits: [], numbers: [], raw: null, mode: 'tasks', ...over,
});

type Send = (messages: Parameters<ChatPanelDeps['send']>[0], h: ChatSendHandlers) => Promise<ChatSendResult>;

function setup(opts: {
  endpoint?: boolean;
  send?: Send;
  command?: (text: string) => boolean;
  info?: () => DailyExtract;
  initial?: ChatHistory;
  lang?: 'en' | 'de';
} = {}) {
  const flag = { ok: opts.endpoint ?? true };
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>(opts.send ?? (async (_m, h) => { h.onToken('Hi'); return { ok: true, content: 'Antwort' }; }));
  const models = jest.fn(async () => ({ models: ['m1', 'm2'], reachable: true }));
  const setModel = jest.fn(async (_m: string) => {});
  const llm = { models, setModel, modelInUse: () => 'm1', source: () => ({ family: null, model: 'm1', sentModel: 'm1' }) };
  const history: { last: ChatHistory | null } = { last: null };
  const info = { current: opts.info ?? (() => extract()) };
  const deps: ChatPanelDeps = {
    app: { plugins: { plugins: {} } } as never,
    llm: llm as never,
    initial: opts.initial ?? EMPTY_CHAT,
    onChange: (h) => { history.last = h; },
    send,
    handleCommand: opts.command ?? (() => false),
    contextInfo: () => info.current(),
    hasEndpoint: () => flag.ok,
    linkOptions: () => ({ allowObsidianLinks: false, allowLocalImages: false }),
    openSettings: jest.fn(),
    renderMarkdown: jest.fn(async (el: HTMLElement, md: string) => { el.setText(md); }),
  };
  const host = makeFakeEl();
  const panel = new KuroChatPanel(host as never, opts.lang ?? 'en', deps, { domGuard: false });
  panel.build();
  return { panel, host, deps, flag, send, models, setModel, history, info };
}

const all = (host: any, sel: string): any[] => host.querySelectorAll(sel) as any[];
const text = (host: any): string => host.textContent as string;
const waitFor = async (fn: () => void): Promise<void> => {
  let last: unknown;
  for (let i = 0; i < 200; i++) {
    try { fn(); return; } catch (e) { last = e; await new Promise((r) => setTimeout(r, 5)); }
  }
  throw last;
};
const key = (input: any, k: string, mods: Record<string, boolean> = {}) => {
  const ev = { type: 'keydown', key: k, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, isComposing: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...mods };
  input.dispatchEvent(ev);
  return ev;
};

describe('KuroChatPanel (Kit-Fenster)', () => {
  it('baut das Kit-Fenster in den Wirt und markiert den Wirt für die Höhe', () => {
    const s = setup();
    expect(all(s.host, '.okit-chat').length).toBe(1);
    expect(s.host.hasClass('kuro-chat-host')).toBe(true);
    // Die alten Eigenbau-Elemente gibt es nicht mehr.
    expect(all(s.host, '.kuro-chat-input').length).toBe(0);
    expect(all(s.host, '.kuro-chat-inputrow').length).toBe(0);
  });

  it('die Frage geht mit dem Verlauf an send(), Signal und Handler sind die des Fensters', async () => {
    const s = setup();
    await s.panel.submit('erste Frage');
    expect(s.send).toHaveBeenCalledTimes(1);
    const [messages, h] = s.send.mock.calls[0]!;
    expect(messages.map((m) => m.role)).toEqual(['user']);
    expect(messages[0]!.content).toBe('erste Frage');
    expect(h.signal.aborted).toBe(false);
    expect(text(s.host)).toContain('Antwort');
    await s.panel.submit('zweite Frage');
    const second = s.send.mock.calls[1]![0];
    expect(second.map((m) => `${m.role}:${m.content}`)).toEqual(['user:erste Frage', 'assistant:Antwort', 'user:zweite Frage']);
  });

  it('der Verlauf wandert über onChange ins Plugin und kommt über initial zurück', async () => {
    const s = setup();
    await s.panel.submit('Frage');
    expect(s.history.last?.entries.length).toBe(2);
    const again = setup({ initial: s.history.last! });
    expect(text(again.host)).toContain('Frage');
    expect(text(again.host)).toContain('Antwort');
  });

  it('Enter sendet, Umschalt+Enter macht eine neue Zeile', async () => {
    const s = setup();
    const input = all(s.host, '.okit-chat-input')[0];
    input.value = 'Frage per Enter';
    expect(key(input, 'Enter', { shiftKey: true }).defaultPrevented).toBe(false);
    expect(s.send).not.toHaveBeenCalled();
    expect(key(input, 'Enter').defaultPrevented).toBe(true);
    await waitFor(() => { expect(s.send).toHaveBeenCalledTimes(1); });
  });

  describe('„merk dir“ (beforeSubmit)', () => {
    it('ein Befehl geht nicht ans Modell, und der Entwurf ist danach leer', async () => {
      const handled: string[] = [];
      const s = setup({ command: (t) => { handled.push(t); return t.startsWith('merk dir:'); } });
      const input = all(s.host, '.okit-chat-input')[0];
      input.value = 'merk dir: keine Streak-Hinweise';
      key(input, 'Enter');
      await waitFor(() => { expect(handled).toEqual(['merk dir: keine Streak-Hinweise']); });
      expect(s.send).not.toHaveBeenCalled();
      expect(input.value).toBe('');
      expect(s.history.last).toBeNull();
    });

    it('eine gewöhnliche Frage geht durch', async () => {
      const s = setup({ command: () => false });
      await s.panel.submit('womit fange ich an?');
      expect(s.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('Einrichtungs-Hinweis', () => {
    it('ohne Endpunkt: genau ein Knopf, der die Einstellungen öffnet; keine Modellzeile', () => {
      const s = setup({ endpoint: false });
      const empty = all(s.host, '.okit-chat-empty');
      expect(empty.length).toBe(1);
      expect(empty[0].textContent).toContain('Set up chat');
      const cta = empty[0].querySelectorAll('.mod-cta');
      expect(cta.length).toBe(1);
      expect(cta[0].textContent).toBe('Open settings');
      cta[0].click();
      expect(s.deps.openSettings).toHaveBeenCalled();
      expect(all(s.host, '.okit-model-bar').length).toBe(0);
      expect(all(s.host, '.kuro-chat-context').length).toBe(0);
    });

    it('trägt der Nutzer einen Endpunkt ein, wechselt refresh() in den Chat (sonst bliebe der Hinweis stehen)', () => {
      const s = setup({ endpoint: false });
      s.flag.ok = true;
      s.panel.refresh();
      expect(all(s.host, '.okit-model-bar').length).toBe(1);
      expect(all(s.host, '.okit-chat-empty').every((e) => e.hasClass('okit-chat-hidden'))).toBe(true);
    });

    it('und zurück: fällt der Endpunkt weg, kommt der Hinweis wieder', () => {
      const s = setup();
      s.flag.ok = false;
      s.panel.refresh();
      expect(all(s.host, '.okit-chat-empty').some((e) => !e.hasClass('okit-chat-hidden'))).toBe(true);
      expect(all(s.host, '.okit-model-bar').length).toBe(0);
    });
  });

  describe('Linkschutz (Kit-Option domGuard)', () => {
    it('das Fenster bekommt einen Getter, der die Einstellung je Antwort liest (ein Umschalten wirkt ohne Neuaufbau)', () => {
      const real = chatWindow.buildChatWindow;
      let seen: chatWindow.ChatWindowOptions['domGuard'];
      const spy = jest.spyOn(chatWindow, 'buildChatWindow').mockImplementation((parent, o) => {
        seen = o.domGuard;
        // Das Fake-DOM trägt keinen MutationObserver: das echte Fenster ohne Wächter bauen.
        return real(parent, { ...o, domGuard: false });
      });
      try {
        const flags = { obsidian: false, images: false };
        const host = makeFakeEl();
        const panel = new KuroChatPanel(host as never, 'en', {
          ...setup().deps,
          linkOptions: () => ({ allowObsidianLinks: flags.obsidian, allowLocalImages: flags.images }),
        });
        panel.build();
        expect(typeof seen).toBe('function');
        const get = seen as () => unknown;
        expect(get()).toEqual({ allowObsidianLinks: false, allowLocalImages: false });
        flags.obsidian = true;
        expect(get()).toEqual({ allowObsidianLinks: true, allowLocalImages: false });
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('Namenszeile (Kit-Option labels)', () => {
    it('die Frage trägt „You“, die Antwort „Kuro“ — als Name im Turn, in der Sprache des Wirts', async () => {
      const s = setup();
      await s.panel.submit('Frage');
      // Das Fake-DOM kennt keinen Nachfahren-Selektor mit zusammengesetzter Klasse: die Namen in Dokumentreihenfolge (Frage, dann Antwort).
      expect(all(s.host, '.okit-chat-name').map((n) => n.textContent)).toEqual(['You', 'Kuro']);
    });

    it('auf Deutsch heißt die Frage „Du“', async () => {
      const s = setup({ lang: 'de' });
      await s.panel.submit('Frage');
      expect(all(s.host, '.okit-chat-name').map((n) => n.textContent)).toEqual(['Du', 'Kuro']);
    });

    it('der Name steht nicht im Verlauf, der ans Modell geht', async () => {
      const s = setup();
      await s.panel.submit('erste Frage');
      await s.panel.submit('zweite Frage');
      const second = s.send.mock.calls[1]![0];
      expect(second.map((m) => m.content)).toEqual(['erste Frage', 'Antwort', 'zweite Frage']);
    });
  });

  describe('Modellzeile', () => {
    it('steht im Kopf des Fensters, mit dem Namen „Chat“, ohne Denk-Steuerung', () => {
      const s = setup();
      const header = all(s.host, '.okit-chat-header')[0];
      expect(header.querySelectorAll('.okit-model-bar').length).toBe(1);
      expect(header.querySelector('.okit-model-bar-label').textContent).toBe('Chat');
      expect(all(s.host, '.okit-thinking-control').length).toBe(0);
    });

    it('ein Wechsel im Dropdown ruft setModel der Verbindung', async () => {
      const s = setup();
      const select = all(s.host, '.okit-model-bar-select')[0];
      await waitFor(() => { expect(select.querySelectorAll('option').length).toBeGreaterThan(2); });
      select.value = 'm2';
      select.dispatchEvent({ type: 'change' });
      await waitFor(() => { expect(s.setModel).toHaveBeenCalledWith('m2'); });
    });

    it('sperrt sich während eines Laufs und gibt sich danach frei', async () => {
      let release: (r: ChatSendResult) => void = () => {};
      const s = setup({ send: () => new Promise((resolve) => { release = resolve; }) });
      const select = (): any => all(s.host, '.okit-model-bar-select')[0];
      expect(select().disabled ?? false).toBe(false);
      const pending = s.panel.submit('Frage');
      await waitFor(() => { expect(s.send).toHaveBeenCalled(); });
      expect(select().disabled).toBe(true);
      release({ ok: true, content: 'fertig' });
      await pending;
      expect(select().disabled ?? false).toBe(false);
    });

    it('refresh() bei unverändertem Endpunkt-Zustand lässt Fenster, Zeile und Entwurf stehen; mit models lädt es die Liste neu', async () => {
      const s = setup();
      const input = all(s.host, '.okit-chat-input')[0];
      input.value = 'halber Entwurf';
      const bar = all(s.host, '.okit-model-bar')[0];
      await waitFor(() => { expect(s.models).toHaveBeenCalled(); });
      const before = s.models.mock.calls.length;
      s.panel.refresh();
      expect(all(s.host, '.okit-model-bar')[0]).toBe(bar);
      expect(all(s.host, '.okit-chat-input')[0]).toBe(input);
      expect(input.value).toBe('halber Entwurf');
      expect(s.models.mock.calls.length).toBe(before);
      s.panel.refresh({ models: true });
      await waitFor(() => { expect(s.models.mock.calls.length).toBeGreaterThan(before); });
    });
  });

  describe('Kontextzeile', () => {
    it('zeigt Zahl und Auszug aus contextInfo (dieselbe Funktion wie der Prompt)', () => {
      const s = setup({ info: () => extract({ tasks: ['[ ] Steuer'], mode: 'tasks' }) });
      expect(all(s.host, '.kuro-chat-context-summary')[0].textContent).toBe('Kuro currently sees: 1 tasks, 0 habits');
      expect(all(s.host, '.kuro-chat-context-body')[0].textContent).toContain('Steuer');
    });

    it('refreshContext() schreibt Zeile und Auszug neu, ohne das Fenster oder die Zeile neu zu bauen', () => {
      const s = setup();
      const details = all(s.host, '.kuro-chat-context')[0];
      const input = all(s.host, '.okit-chat-input')[0];
      s.info.current = () => extract({ tasks: ['[ ] A', '[ ] B'] });
      s.panel.refreshContext();
      expect(all(s.host, '.kuro-chat-context-summary')[0].textContent).toBe('Kuro currently sees: 2 tasks, 0 habits');
      expect(all(s.host, '.kuro-chat-context')[0]).toBe(details);
      expect(all(s.host, '.okit-chat-input')[0]).toBe(input);
    });

    it('im Leerzustand gibt es keine Kontextzeile, und refreshContext() ist ein No-op', () => {
      const s = setup({ endpoint: false });
      expect(() => { s.panel.refreshContext(); }).not.toThrow();
      expect(all(s.host, '.kuro-chat-context').length).toBe(0);
    });
  });

  describe('Abbruch und Aufräumen', () => {
    const hang: Send = (_m, h) => new Promise((resolve) => { h.signal.addEventListener('abort', () => { resolve({ ok: false, kind: 'aborted' }); }); });

    it('Escape bricht einen laufenden Lauf ab', async () => {
      const s = setup({ send: hang });
      const pending = s.panel.submit('Frage');
      await waitFor(() => { expect(s.send).toHaveBeenCalled(); });
      key(all(s.host, '.okit-chat-input')[0], 'Escape');
      await pending;
      expect(s.send.mock.calls[0]![1].signal.aborted).toBe(true);
    });

    it('„Neu“ (clear) bricht einen laufenden Lauf ab und leert den Verlauf', async () => {
      const s = setup({ send: hang });
      const pending = s.panel.submit('Frage');
      await waitFor(() => { expect(s.send).toHaveBeenCalled(); });
      s.panel.clear();
      await pending;
      expect(s.send.mock.calls[0]![1].signal.aborted).toBe(true);
      expect(s.panel.history()?.entries).toEqual([]);
    });

    it('destroy() bricht einen laufenden Lauf ab', async () => {
      const s = setup({ send: hang });
      const pending = s.panel.submit('Frage');
      await waitFor(() => { expect(s.send).toHaveBeenCalled(); });
      s.panel.destroy();
      await pending;
      expect(s.send.mock.calls[0]![1].signal.aborted).toBe(true);
    });
  });

  it('ein Wurf aus send() (Fehler vor dem Senden) lässt die Eingabe nicht gesperrt und zeigt eine Fehlerzeile', async () => {
    const s = setup({ send: async () => { throw new Error('manager kaputt'); } });
    await s.panel.submit('Frage');
    const input = all(s.host, '.okit-chat-input')[0];
    expect(input.disabled ?? false).toBe(false);
    expect(all(s.host, '.okit-chat-error').length).toBeGreaterThan(0);
  });

  it('eine am Token-Limit abgeschnittene Antwort trägt den Hinweis des Fensters (nicht still)', async () => {
    const s = setup({ send: async () => ({ ok: true, content: 'halb', truncated: true }) });
    await s.panel.submit('Frage');
    expect(text(s.host)).toContain('cut off');
  });

  it('der Text eines Fehlers ohne Endpunkt nennt die Quelle (Wortlaut des Kits, kein Eigenbau)', async () => {
    const s = setup({ send: async () => ({ ok: false, kind: 'no-endpoint', source: { kind: 'local' }, detail: 'no endpoint' }) });
    await s.panel.submit('Frage');
    expect(text(s.host)).toContain('No endpoint');
  });
});
