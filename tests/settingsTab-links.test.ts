/* ==========================================================
   Einstellungszeile „obsidian://-Links erlauben“ (Kit link-settings): ein Schalter,
   aus; ein Umlegen schreibt in die Einstellungen und speichert. Das Chat-Fenster
   liest ihn je Antwort (Test in chat-panel.test.ts). Den zweiten Kit-Schalter
   („Lokale Bilder anzeigen“) gibt es hier nicht: im Kit-Chat-Fenster waren
   Bilder aus dem Vault schon vorher Text (Kit-MIGRATION 0.70.0, Welle 28).
   ========================================================== */
import { KuroSettingsTab } from '../src/settings/SettingsTab';
import { DEFAULT_PLUGIN_DATA } from '../src/types';

function makeFakePlugin() {
  return {
    app: { vault: { configDir: '.obsidian', getAllFolders: () => [] } },
    manifest: { version: '0.0.0', id: 'kuro-gamification' },
    data: JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)),
    persist: jest.fn().mockResolvedValue(undefined),
    refreshStatus: jest.fn().mockResolvedValue(undefined),
  };
}

/** Ein Setting, das nur aufzeichnet: der Schalter bekommt seinen Wert und gibt den Rückruf heraus. */
function fakeSetting() {
  const rec: { value?: boolean; onChange?: (v: boolean) => void } = {};
  const toggle = { setValue(v: boolean) { rec.value = v; return toggle; }, onChange(cb: (v: boolean) => void) { rec.onChange = cb; return toggle; } };
  const setting: any = { setName: () => setting, setDesc: () => setting, addToggle: (cb: (t: typeof toggle) => void) => { cb(toggle); return setting; } };
  return { setting, rec };
}

function chatItems(plugin: ReturnType<typeof makeFakePlugin>): any[] {
  const tab = new KuroSettingsTab(plugin.app as any, plugin as any);
  const groups = tab.getSettingDefinitions() as any[];
  return groups.find((g) => g.type === 'group' && g.items?.some((i: any) => i.name === 'Allow obsidian:// links')).items;
}

function linkRows(plugin: ReturnType<typeof makeFakePlugin>) {
  const rows = chatItems(plugin).filter((i: any) => i.name === 'Allow obsidian:// links');
  return rows.map((row: any) => { const f = fakeSetting(); row.render(f.setting); return f.rec; });
}

describe('Einstellungszeile „obsidian://-Links erlauben“', () => {
  it('der Schalter steht im Chat-Abschnitt und ist standardmäßig aus', () => {
    const [obsidian] = linkRows(makeFakePlugin());
    expect(obsidian!.value).toBe(false);
  });

  it('es gibt genau einen Schalter dieser Gruppe: „Lokale Bilder anzeigen“ ist gestrichen', () => {
    const names = chatItems(makeFakePlugin()).map((i: any) => i.name);
    expect(names).toContain('Allow obsidian:// links');
    expect(names).not.toContain('Show local images from the vault');
    expect(linkRows(makeFakePlugin()).length).toBe(1);
  });

  it('der Schalter schreibt chatAllowObsidianLinks und speichert', async () => {
    const plugin = makeFakePlugin();
    const [obsidian] = linkRows(plugin);
    obsidian!.onChange!(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(plugin.data.settings.chatAllowObsidianLinks).toBe(true);
    expect('chatAllowLocalImages' in plugin.data.settings).toBe(false);
    expect(plugin.persist).toHaveBeenCalled();
  });
});
