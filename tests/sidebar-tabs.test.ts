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
  chatSession: { entries: [], streaming: null, busy: false, reset: () => {} },
  lastDailyText: null,
  askKuro: async () => {},
  abortChat: () => {},
  rememberNote: () => {},
});

const openView = async (enableChat: boolean, over: Record<string, unknown> = {}) => {
  const view = new KuroSidebarView({} as never, makePlugin(enableChat, over) as never);
  await view.onOpen();
  return view;
};

describe('KuroSidebarView tabs', () => {
  it('renders no tab bar when the chat is off', async () => {
    const view = await openView(false);
    expect(view.tabBarEl).toBeNull();
    expect(view.chatBodyEl).toBeNull();
    expect(view.statusBodyEl).not.toBeNull();
  });

  it('renders both bodies and the tab bar when the chat is on', async () => {
    const view = await openView(true);
    expect(view.tabBarEl).not.toBeNull();
    expect(view.statusBodyEl).not.toBeNull();
    expect(view.chatBodyEl).not.toBeNull();
  });

  it('starts on the status tab', async () => {
    const view = await openView(true);
    expect(view.activeTab).toBe('status');
    expect(view.statusBodyEl?.hasClass('kuro-hidden')).toBe(false);
    expect(view.chatBodyEl?.hasClass('kuro-hidden')).toBe(true);
  });

  it('switches visibility on showTab', async () => {
    const view = await openView(true);
    view.showTab('chat');
    expect(view.activeTab).toBe('chat');
    expect(view.statusBodyEl?.hasClass('kuro-hidden')).toBe(true);
    expect(view.chatBodyEl?.hasClass('kuro-hidden')).toBe(false);
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

  it('clears both bodies on close', async () => {
    const view = await openView(true);
    await view.onClose();
    expect(view.statusBodyEl).toBeNull();
    expect(view.chatBodyEl).toBeNull();
    expect(view.tabBarEl).toBeNull();
  });
});
