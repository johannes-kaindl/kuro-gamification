/* ==========================================================
   Default loot pool follows the UI language: English users get
   an English pool, German users the German one. A user's custom
   loot pool still overrides both regardless of language.
   ========================================================== */
import { LootEngine } from '../src/engine/LootEngine';
import { DEFAULT_LOOT_POOL, DEFAULT_LOOT_POOL_EN, defaultLootPool } from '../src/data/default-loot-pool';
import { DEFAULT_SETTINGS, type KuroSettings } from '../src/types';

function settings(over: Partial<KuroSettings>): KuroSettings {
  return { ...DEFAULT_SETTINGS, ...over };
}

describe('language-aware default loot pool', () => {
  it('poolFor returns the English pool when language is en', () => {
    expect(LootEngine.poolFor('common', settings({ language: 'en', customLootPool: null })))
      .toEqual(DEFAULT_LOOT_POOL_EN.common);
  });

  it('poolFor returns the German pool when language is de', () => {
    expect(LootEngine.poolFor('common', settings({ language: 'de', customLootPool: null })))
      .toEqual(DEFAULT_LOOT_POOL.common);
  });

  it('defaultLootPool selects by language', () => {
    expect(defaultLootPool('en')).toBe(DEFAULT_LOOT_POOL_EN);
    expect(defaultLootPool('de')).toBe(DEFAULT_LOOT_POOL);
  });

  it('a custom loot pool overrides the language default', () => {
    const custom = { common: [{ name: 'Custom reward', cat: 'Test' }] };
    expect(LootEngine.poolFor('common', settings({ language: 'en', customLootPool: custom })))
      .toEqual(custom.common);
  });

  it('English pool has the same tier sizes as the German pool (parity)', () => {
    for (const tier of Object.keys(DEFAULT_LOOT_POOL) as (keyof typeof DEFAULT_LOOT_POOL)[]) {
      expect(DEFAULT_LOOT_POOL_EN[tier].length).toBe(DEFAULT_LOOT_POOL[tier].length);
    }
  });
});
