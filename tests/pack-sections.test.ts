// tests/pack-sections.test.ts
import { buildUnitPack, detectUnits, resetUnit } from '../src/utils/packSections';
import { DEFAULT_SETTINGS } from '../src/types';
import { defaultLootPool } from '../src/data/default-loot-pool';
import { defaultLore } from '../src/data/default-lore';
import { defaultHabits } from '../src/data/default-habits';

describe('buildUnitPack', () => {
  it('builds a lore-only pack from the factory default when no custom lore', () => {
    const p = buildUnitPack('lore', { ...DEFAULT_SETTINGS, language: 'en', customLore: null });
    expect(p.lore).toEqual(defaultLore('en'));
    expect(p.loot).toBeUndefined();
    expect(p.habits).toBeUndefined();
  });
  it('builds a loot-only pack from custom loot when present', () => {
    const custom = { common: [{ name: 'x', cat: 'y' }] };
    const p = buildUnitPack('loot', { ...DEFAULT_SETTINGS, customLootPool: custom });
    expect(p.loot).toEqual(custom);
    expect(p.lore).toBeUndefined();
  });
  it('builds a habits-only pack from settings.habits', () => {
    const p = buildUnitPack('habits', { ...DEFAULT_SETTINGS, habits: [{ key: 'h', label: 'H', xp: 1 }] });
    expect(p.habits).toEqual([{ key: 'h', label: 'H', xp: 1 }]);
  });
  it('falls back to default loot/habits when settings are empty', () => {
    const p = buildUnitPack('habits', { ...DEFAULT_SETTINGS, language: 'de', habits: [] });
    expect(p.habits).toEqual(defaultHabits('de'));
    const l = buildUnitPack('loot', { ...DEFAULT_SETTINGS, language: 'de', customLootPool: null });
    expect(l.loot).toEqual(defaultLootPool('de'));
  });
});

describe('detectUnits', () => {
  it('lists exactly the present sections', () => {
    expect(detectUnits({ kuroPack: 1, lore: [], habits: [] })).toEqual(['lore', 'habits']);
    expect(detectUnits({ kuroPack: 1, loot: {} })).toEqual(['loot']);
  });
});

describe('resetUnit', () => {
  const custom = { common: [{ name: 'x', cat: 'y' }] };
  const lore = [{ level: 1, title: 'T', text: 'x' }];
  const base = {
    ...DEFAULT_SETTINGS,
    language: 'de' as const,
    customLootPool: custom,
    customLore: lore,
    habits: [{ key: 'mine', label: 'Mine', xp: 3 }],
  };

  it('resets only lore, leaving loot and habits untouched', () => {
    const next = resetUnit(base, 'lore');
    expect(next.customLore).toBeNull();
    expect(next.customLootPool).toBe(custom);
    expect(next.habits).toBe(base.habits);
  });

  it('resets only loot, leaving lore and habits untouched', () => {
    const next = resetUnit(base, 'loot');
    expect(next.customLootPool).toBeNull();
    expect(next.customLore).toBe(lore);
    expect(next.habits).toBe(base.habits);
  });

  it('resets habits to the generic set in the UI language', () => {
    const next = resetUnit(base, 'habits');
    expect(next.habits).toEqual(defaultHabits('de'));
    expect(next.customLore).toBe(lore);
    expect(next.customLootPool).toBe(custom);
  });

  it('never touches progress-bearing settings and returns a new object', () => {
    const next = resetUnit(base, 'lore');
    expect(next).not.toBe(base);
    expect(next.levels).toBe(base.levels);
    expect(next.language).toBe(base.language);
  });
});
