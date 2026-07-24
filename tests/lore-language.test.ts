/* ==========================================================
   Factory-default lore follows the UI language (Plain pack in
   DE/EN). Gothic is an importable pack, not the default. A user's
   custom lore still overrides both.
   ========================================================== */
import { LoreEngine } from '../src/engine/LoreEngine';
import { PLAIN_LORE_DE, PLAIN_LORE_EN, defaultLore } from '../src/data/default-lore';
import { DEFAULT_SETTINGS, type KuroSettings } from '../src/types';

function settings(over: Partial<KuroSettings>): KuroSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

describe('language-aware factory-default lore', () => {
  it('defaultLore selects Plain by language', () => {
    expect(defaultLore('en')).toBe(PLAIN_LORE_EN);
    expect(defaultLore('de')).toBe(PLAIN_LORE_DE);
  });

  it('fragmentForLevel returns the English plain fragment when language is en', () => {
    const f = LoreEngine.fragmentForLevel(1, settings({ language: 'en', customLore: null }));
    expect(f).toEqual(PLAIN_LORE_EN[0]);
  });

  it('fragmentForLevel returns the German plain fragment when language is de', () => {
    const f = LoreEngine.fragmentForLevel(1, settings({ language: 'de', customLore: null }));
    expect(f).toEqual(PLAIN_LORE_DE[0]);
  });

  it('a custom lore overrides the language default', () => {
    const custom = [{ level: 1, title: 'X', text: 'custom' }];
    const f = LoreEngine.fragmentForLevel(1, settings({ language: 'en', customLore: custom }));
    expect(f).toEqual(custom[0]);
  });

  it('German plain pool mirrors the English one level-for-level', () => {
    expect(PLAIN_LORE_DE.map((f) => f.level)).toEqual(PLAIN_LORE_EN.map((f) => f.level));
  });
});
