/* ==========================================================
   Tab-Umbau der Seitenleiste.

   Der eigentliche Grund für Tabs: vault.modify ist 800 ms debounced
   → refreshStatus() → renderSnapshot(). Läge der Chat im selben
   Container, verlöre er bei jedem Tastendruck in einer beliebigen
   Notiz Verlauf, Scroll-Stand und den Eingabe-Entwurf. Zwei
   dauerhafte Bodies lösen das strukturell.
   ========================================================== */
import { KuroSidebarView } from '../src/views/KuroSidebarView';
import { DEFAULT_PLUGIN_DATA } from '../src/types';
import { EMPTY_CHAT } from '../src/vendor/kit/chat-history';
import { installWindowTimers } from './vendor/kit/window-timers';

// Das Kit-Fenster nimmt seine Uhr aus `window` (Renderer); die Testumgebung ist Node.
let restoreWindow: () => void = () => {};
beforeAll(() => { restoreWindow = installWindowTimers({ full: true }); });
afterAll(() => { restoreWindow(); });

const makePlugin = (enableChat: boolean, over: Record<string, unknown> = {}) => ({
  data: {
    ...JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)),
    settings: {
      ...JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA.settings)),
      enableChat,
      ...over,
    },
  },
  refreshStatus: async () => {},
  openRedeemModal: () => {},
  openOwnSettings: () => {},
  // Das Chat-Panel baut das echte Kit-Fenster und die Modellzeile; die Verbindung genügt als Stub.
  llm: {
    models: async () => ({ models: ['m1'], reachable: true }),
    setModel: async () => {},
    modelInUse: () => 'm1',
    source: () => ({ family: null, model: 'm1', sentModel: 'm1' }),
  },
  chatHistory: EMPTY_CHAT,
  lastDailyText: null,
  hasChatEndpointSource: () => !!(over.chatEndpoints as unknown[] | undefined)?.length,
  sendChat: async () => ({ ok: true, content: '' }),
  handleChatCommand: () => false,
  rememberNote: () => {},
});

const openView = async (enableChat: boolean, over: Record<string, unknown> = {}) => {
  const view = new KuroSidebarView({} as never, makePlugin(enableChat, over) as never);
  await view.onOpen();
  return view;
};

/** Panel-Div eines Tabs im Hub (root.children = [Tab-Leiste, Content]). */
const panelDiv = (view: KuroSidebarView, idx: number): any => (view.hubEl as any).children[1].children[idx];
const tabBtn = (view: KuroSidebarView, idx: number): any => (view.hubEl as any).children[0].children[idx];

describe('KuroSidebarView tabs (Kit-Hub)', () => {
  it('renders no hub when the chat is off', async () => {
    const view = await openView(false);
    expect(view.hubEl).toBeNull();
    expect(view.chatBodyEl).toBeNull();
    expect(view.statusBodyEl).not.toBeNull();
  });

  it('renders hub with both bodies when the chat is on', async () => {
    const view = await openView(true);
    expect(view.hubEl).not.toBeNull();
    expect(view.hubEl?.hasClass('okit-hub-root')).toBe(true);
    expect(view.statusBodyEl).not.toBeNull();
    expect(view.chatBodyEl).not.toBeNull();
    expect(view.chatBodyEl?.hasClass('kuro-chat-body')).toBe(true);
  });

  it('starts on the status tab', async () => {
    const view = await openView(true);
    expect(view.activeTab).toBe('status');
    expect(panelDiv(view, 0).hasClass('is-hidden')).toBe(false);
    expect(panelDiv(view, 1).hasClass('is-hidden')).toBe(true);
  });

  it('switches visibility on showTab and on a tab click', async () => {
    const view = await openView(true);
    view.showTab('chat');
    expect(view.activeTab).toBe('chat');
    expect(panelDiv(view, 0).hasClass('is-hidden')).toBe(true);
    expect(panelDiv(view, 1).hasClass('is-hidden')).toBe(false);
    tabBtn(view, 0).click();
    expect(view.activeTab).toBe('status');
    expect(tabBtn(view, 0).hasClass('is-active')).toBe(true);
  });

  it('keeps the very same chat body across a status refresh', async () => {
    const view = await openView(true);
    const chatBefore = view.chatBodyEl;
    view.renderSnapshot();
    view.renderSnapshot();
    expect(view.chatBodyEl).toBe(chatBefore);
  });

  it('does not empty the chat body when the status refreshes', async () => {
    const view = await openView(true);
    view.chatBodyEl?.createDiv({ cls: 'marker' });
    const childrenBefore = view.chatBodyEl?.children.length;
    view.renderSnapshot();
    expect(view.chatBodyEl?.children.length).toBe(childrenBefore);
  });

  it('builds a fresh hub once the chat is switched on, without a leftover chat panel', async () => {
    const plugin = makePlugin(false);
    const view = new KuroSidebarView({} as never, plugin as never);
    await view.onOpen();
    expect(view.hubEl).toBeNull();
    plugin.data.settings.enableChat = true;
    await view.onOpen();
    expect(view.hubEl).not.toBeNull();
    expect(view.chatBodyEl).not.toBeNull();
  });

  it('tears down the old chat panel when onOpen runs twice (syncChatUI)', async () => {
    const view = await openView(true);
    const first = (view as any).chatPanel;
    const destroy = jest.spyOn(first, 'destroy');
    await view.onOpen();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect((view as any).chatPanel).not.toBe(first);
  });

  it('forwards refreshChat and refreshChatContext to the chat panel, and is a no-op without a chat', async () => {
    const view = await openView(true);
    const panel = (view as any).chatPanel;
    const refresh = jest.spyOn(panel, 'refresh');
    const context = jest.spyOn(panel, 'refreshContext');
    view.refreshChat({ models: true });
    expect(refresh).toHaveBeenCalledWith({ models: true });
    context.mockClear();
    view.refreshChatContext();
    expect(context).toHaveBeenCalledTimes(1);
    const off = await openView(false);
    expect(() => { off.refreshChat(); off.refreshChatContext(); }).not.toThrow();
  });

  it('gives the chat panel the history the plugin holds, so it survives a rebuild', async () => {
    const plugin = makePlugin(true);
    const view = new KuroSidebarView({} as never, plugin as never);
    await view.onOpen();
    const panel = (view as any).chatPanel;
    expect((panel as any).deps.initial).toBe(plugin.chatHistory);
  });

  it('clears everything on close and destroys the chat panel once', async () => {
    const view = await openView(true);
    const destroy = jest.spyOn((view as any).chatPanel, 'destroy');
    await view.onClose();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(view.statusBodyEl).toBeNull();
    expect(view.chatBodyEl).toBeNull();
    expect(view.hubEl).toBeNull();
  });
});
