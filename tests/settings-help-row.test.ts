/* ==========================================================
   Hilfe-Zeile (UI-STANDARD §8): erstes Element von getSettingDefinitions(), vor jeder Gruppe,
   mit Doku-Index und Issues dieses Repos. Tab und Zeile sprechen dieselbe Sprache (DE/EN).
   ========================================================== */
import { KuroSettingsTab } from '../src/settings/SettingsTab';
import { DEFAULT_PLUGIN_DATA } from '../src/types';

function makeTab(lang: 'en' | 'de') {
  const data = JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA));
  data.settings.language = lang;
  return new KuroSettingsTab({} as any, { app: {}, data, manifest: { version: '0.0.0' } } as any);
}

/** Faengt Name, Beschreibung, Knopftext und die Klick-Handler der Zeile ab. */
function fakeSetting() {
  const seen = { name: '', buttonText: '', clicks: [] as Array<() => void> };
  const chain: any = {
    setName: (v: string) => { seen.name = v; return chain; },
    setDesc: () => chain,
    addButton: (cb: (b: any) => void) => {
      const b: any = {
        setButtonText: (v: string) => { seen.buttonText = v; return b; },
        onClick: (h: () => void) => { seen.clicks.push(h); return b; },
      };
      cb(b);
      return chain;
    },
    addExtraButton: (cb: (b: any) => void) => {
      const b: any = {
        setIcon: () => b,
        setTooltip: () => b,
        onClick: (h: () => void) => { seen.clicks.push(h); return b; },
      };
      cb(b);
      return chain;
    },
  };
  return { chain, seen };
}

describe('KuroSettingsTab: Hilfe-Zeile', () => {
  it('is the first definition and opens the docs index and the issue tracker of this repo', () => {
    const first = makeTab('en').getSettingDefinitions()[0] as any;
    expect(first.name).toBe('Help');
    const { chain, seen } = fakeSetting();
    const open = jest.fn();
    (globalThis as any).window = { open };
    first.render(chain);
    expect(seen.buttonText).toBe('Open documentation');
    for (const h of seen.clicks) h();
    expect(open.mock.calls.map((c) => c[0])).toEqual([
      'https://github.com/johannes-kaindl/kuro-gamification/blob/main/docs/README.md',
      'https://github.com/johannes-kaindl/kuro-gamification/issues',
    ]);
    (globalThis as any).window = undefined;
  });

  it('speaks the language of the tab (German)', () => {
    const first = makeTab('de').getSettingDefinitions()[0] as any;
    expect(first.name).toBe('Hilfe');
    const { chain, seen } = fakeSetting();
    first.render(chain);
    expect(seen.buttonText).toBe('Dokumentation öffnen');
  });
});
