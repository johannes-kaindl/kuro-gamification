/* ==========================================================
   Einstellungszeilen „Vergangene Chats“ (Kit chat-archive-settings): Ordner und
   Aufbewahrung. Der Verlauf ist in diesem Plugin als Vorgabe AUS (Aufbewahrung 0).
   Ein Umlegen der Aufbewahrung schreibt in die Einstellungen, speichert und
   lässt die offenen Chat-Fenster den Verlauf-Knopf nachziehen.
   ========================================================== */
import { KuroSettingsTab } from '../src/settings/SettingsTab';
import { DEFAULT_PLUGIN_DATA } from '../src/types';

function makeFakePlugin() {
  return {
    app: { vault: { configDir: '.obsidian', getAllFolders: () => [] } },
    // Ohne `manifest.name` hieße der Vorgabe-Ordner „undefined/Chats“.
    manifest: { version: '0.0.0', id: 'kuro-gamification', name: 'Kuro Gamification' },
    data: JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)),
    persist: jest.fn().mockResolvedValue(undefined),
    refreshStatus: jest.fn().mockResolvedValue(undefined),
    syncChatArchive: jest.fn(),
  };
}

/** Ein Setting, das aufzeichnet: Name, Beschreibung, Textfeld und Schieber geben ihre Rückrufe heraus. */
function fakeSetting() {
  const rec: { desc?: string; text?: { value: string; onChange: (v: string) => void }; slider?: { value: number; onChange: (v: number) => void } } = {};
  const el = (): any => ({ createDiv: () => el(), createSpan: () => el(), classList: { toggle: () => {} }, setAttribute: () => {} });
  const setting: any = {
    descEl: el(),
    setName: () => setting,
    setDesc: (d: string) => { rec.desc = d; return setting; },
    addText: (cb: (t: any) => void) => {
      const t: any = { inputEl: {}, setPlaceholder: () => t, setValue: (v: string) => { rec.text = { value: v, onChange: () => {} }; return t; }, onChange: (f: (v: string) => void) => { rec.text!.onChange = f; return t; } };
      cb(t); return setting;
    },
    addSlider: (cb: (s: any) => void) => {
      const s: any = { setLimits: () => s, setValue: (v: number) => { rec.slider = { value: v, onChange: () => {} }; return s; }, onChange: (f: (v: number) => void) => { rec.slider!.onChange = f; return s; } };
      cb(s); return setting;
    },
  };
  return { setting, rec };
}

function archiveRows(plugin: ReturnType<typeof makeFakePlugin>) {
  const tab = new KuroSettingsTab(plugin.app as any, plugin as any);
  const groups = tab.getSettingDefinitions() as any[];
  const group = groups.find((g) => g.type === 'group' && g.items?.some((i: any) => i.name === 'Chats to keep'));
  const row = (name: string) => { const f = fakeSetting(); group.items.find((i: any) => i.name === name).render(f.setting); return f.rec; };
  return { group, folder: row('Folder for past chats'), keep: row('Chats to keep') };
}

describe('Einstellungen „Vergangene Chats“', () => {
  it('stehen als eigene Gruppe im Tab, Ordner vor Aufbewahrung, Vorgabe-Ordner mit dem Plugin-Namen', () => {
    const { group, folder } = archiveRows(makeFakePlugin());
    expect(group.items.map((i: any) => i.name)).toEqual(['Folder for past chats', 'Chats to keep']);
    expect(folder.desc).toContain('Kuro Gamification/Chats');
  });

  it('die Aufbewahrung steht auf 0, der Verlauf ist als Vorgabe aus', () => {
    expect(archiveRows(makeFakePlugin()).keep.slider!.value).toBe(0);
  });

  it('ein Umlegen der Aufbewahrung schreibt chatKeep, speichert und zieht die offenen Fenster nach', async () => {
    const plugin = makeFakePlugin();
    archiveRows(plugin).keep.slider!.onChange(10);
    await new Promise((r) => setTimeout(r, 0));
    expect(plugin.data.settings.chatKeep).toBe(10);
    expect(plugin.persist).toHaveBeenCalled();
    expect(plugin.syncChatArchive).toHaveBeenCalled();
  });

  it('ein neuer Ordner wird gespeichert, ohne die Fenster neu zu zeichnen', async () => {
    const plugin = makeFakePlugin();
    archiveRows(plugin).folder.text!.onChange('Eigene/Chats');
    await new Promise((r) => setTimeout(r, 0));
    expect(plugin.data.settings.chatFolder).toBe('Eigene/Chats');
    expect(plugin.persist).toHaveBeenCalled();
    expect(plugin.syncChatArchive).not.toHaveBeenCalled();
  });
});
