/* ==========================================================
   Statusleiste (Welle 34, Kit `status-bar-item`): Vorgabe AN, ein gespeicherter Wert bleibt,
   der Schalter legt den Eintrag an und hängt ihn ab. Läuft über das echte `onload`.
   ========================================================== */
import KuroPlugin from '../src/main';
import { DEFAULT_SETTINGS } from '../src/types';

async function laden(settings: Record<string, unknown> | undefined): Promise<{ plugin: any; items: any[] }> {
  const app = {
    vault: { on: () => ({}), configDir: '.obsidian', adapter: { exists: async () => false, list: async () => ({ files: [], folders: [] }) } },
    workspace: { onLayoutReady: () => {}, getLeavesOfType: () => [], getRightLeaf: () => null, revealLeaf: () => {} },
    plugins: { plugins: {} },
  };
  const items: any[] = [];
  const plugin: any = new (KuroPlugin as any)();
  plugin.app = app;
  plugin.manifest = { id: 'kuro-gamification', name: 'Kuro Gamification', version: '0' };
  plugin.loadData = async () => (settings === undefined ? null : { settings });
  plugin.saveData = async () => {};
  const vomMock = plugin.addStatusBarItem.bind(plugin);
  plugin.addStatusBarItem = () => { const el = vomMock(); items.push(el); return el; };
  await plugin.onload();
  return { plugin, items };
}

describe('Statusleiste', () => {
  it('die Vorgabe ist an', () => {
    expect(DEFAULT_SETTINGS.enableStatusBar).toBe(true);
  });

  it('frische Installation und alte data.json ohne den Schlüssel: der Eintrag steht in der Leiste', async () => {
    expect((await laden(undefined)).items).toHaveLength(1);
    expect((await laden({})).items).toHaveLength(1);
    expect((await laden({ xpPerCheckbox: 7 })).items).toHaveLength(1);
  });

  it('ein gespeichertes false bleibt aus, ein gespeichertes true bleibt an', async () => {
    expect((await laden({ enableStatusBar: false })).items).toHaveLength(0);
    expect((await laden({ enableStatusBar: true })).items).toHaveLength(1);
  });

  it('ein Wert, der kein Boolean ist, fällt auf die Vorgabe an', async () => {
    const { plugin, items } = await laden({ enableStatusBar: 'nein' });
    expect(items).toHaveLength(1);
    expect(plugin.data.settings.enableStatusBar).toBe(true);
  });

  it('der Schalter hängt den Eintrag ab und legt ihn wieder an, der Text steht danach wieder da', async () => {
    const { plugin, items } = await laden({ enableStatusBar: true });
    plugin.data.lastSnapshot = { currentLevel: { level: 4 }, totalXp: 1234 };
    plugin.refreshStatusBar();
    expect(items[0].text).toContain('Lvl 4');
    plugin.data.settings.enableStatusBar = false;
    plugin.refreshStatusBar();
    expect(plugin.statusBar.shown).toBe(false);
    plugin.data.settings.enableStatusBar = true;
    plugin.refreshStatusBar();
    expect(plugin.statusBar.shown).toBe(true);
    expect(items).toHaveLength(2);
    expect(items[1].text).toContain('Lvl 4');
  });

  it('Klick und Enter öffnen die Seitenleiste', async () => {
    const { plugin, items } = await laden({ enableStatusBar: true });
    const offen = jest.fn(async () => undefined);
    plugin.activateSidebar = offen;
    items[0].dispatchEvent({ type: 'click' });
    items[0].dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => undefined });
    items[0].dispatchEvent({ type: 'keydown', key: 'a', preventDefault: () => undefined });
    expect(offen).toHaveBeenCalledTimes(2);
    expect(items[0].getAttribute('role')).toBe('button');
  });
});
