/* ==========================================================
   Die Kontextzeile des Chats folgt der Tagesnotiz.

   Gemessen 2026-09-25 (Quicktask „Das geht an Kuro — Nichts, obwohl …"): refreshStatus()
   las `lastDailyText` neu, zeichnete aber nur den Status-Tab neu. Ein offener Chat-Tab
   zeigte den Stand seiner letzten eigenen Aktion.
   ========================================================== */
import KuroPlugin from '../src/main';
import { KuroSidebarView } from '../src/views/KuroSidebarView';

function makeFakeApp(leaves: unknown[]) {
  return {
    vault: { on: () => ({}) },
    workspace: {
      onLayoutReady: () => {},
      getLeavesOfType: () => leaves,
      getRightLeaf: () => null,
      revealLeaf: () => {},
    },
  };
}

describe('KuroPlugin.refreshStatus — Chat-Kontext', () => {
  it('zieht die Kontextzeile eines offenen Chat-Tabs nach, ohne den Tab neu zu zeichnen', async () => {
    const view = Object.create(KuroSidebarView.prototype) as KuroSidebarView;
    const calls = { context: 0, chat: 0 };
    view.refreshChatContext = () => { calls.context++; };
    view.renderChat = () => { calls.chat++; };
    view.renderSnapshot = () => {};

    const plugin: any = new (KuroPlugin as any)();
    plugin.app = makeFakeApp([{ view }]);
    await plugin.onload();
    plugin.data.settings.enableChat = true;

    let raw = '- [ ] eins';
    plugin.vaultReader = {
      readDailies: async () => [],
      readWeeklies: async () => [],
      readDailyRaw: async () => raw,
    };
    plugin.collectTaskNotesInput = async () => null;

    await plugin.refreshStatus(true);
    expect(plugin.lastDailyText).toBe('- [ ] eins');
    expect(calls.context).toBe(1);

    raw = '- [ ] eins\n- [ ] zwei';
    await plugin.refreshStatus(false);
    expect(plugin.lastDailyText).toContain('zwei');
    expect(calls.context).toBe(2);
    expect(calls.chat).toBe(0);
  });
});
