/* ==========================================================
   Einstellungszeilen „Links und Bilder in Antworten“ (Kit link-settings):
   zwei Schalter, beide aus; ein Umlegen schreibt in die Einstellungen und
   speichert. Das Chat-Fenster liest sie je Antwort (Test in chat-panel.test.ts).
   ========================================================== */
import { KuroSettingsTab } from '../src/settings/SettingsTab';
import { DEFAULT_PLUGIN_DATA } from '../src/types';

function makeFakePlugin() {
  return {
    app: {},
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

function linkRows(plugin: ReturnType<typeof makeFakePlugin>) {
  const tab = new KuroSettingsTab({} as any, plugin as any);
  const groups = tab.getSettingDefinitions() as any[];
  const chat = groups.find((g) => g.type === 'group' && g.items?.some((i: any) => i.name === 'Allow obsidian:// links'));
  const rows = chat.items.filter((i: any) => i.name === 'Allow obsidian:// links' || i.name === 'Show local images from the vault');
  return rows.map((row: any) => { const f = fakeSetting(); row.render(f.setting); return f.rec; });
}

describe('Einstellungszeilen „Links und Bilder in Antworten“', () => {
  it('beide Schalter stehen im Chat-Abschnitt und sind standardmäßig aus', () => {
    const [obsidian, images] = linkRows(makeFakePlugin());
    expect(obsidian!.value).toBe(false);
    expect(images!.value).toBe(false);
  });

  it('der erste Schalter schreibt chatAllowObsidianLinks und speichert', async () => {
    const plugin = makeFakePlugin();
    const [obsidian] = linkRows(plugin);
    obsidian!.onChange!(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(plugin.data.settings.chatAllowObsidianLinks).toBe(true);
    expect(plugin.data.settings.chatAllowLocalImages).toBe(false);
    expect(plugin.persist).toHaveBeenCalled();
  });

  it('der zweite Schalter schreibt chatAllowLocalImages', async () => {
    const plugin = makeFakePlugin();
    const [, images] = linkRows(plugin);
    images!.onChange!(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(plugin.data.settings.chatAllowLocalImages).toBe(true);
    expect(plugin.data.settings.chatAllowObsidianLinks).toBe(false);
  });
});
