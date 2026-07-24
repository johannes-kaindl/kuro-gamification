import { LootEngine } from '../src/engine/LootEngine';
import { DEFAULT_SETTINGS } from '../src/types';
import { DEFAULT_LOOT_POOL } from '../src/data/default-loot-pool';

describe('LootEngine.availableDrops', () => {
  it('floors at 0 for L1', () => {
    expect(LootEngine.availableDrops(1, 0)).toBe(0);
  });
  it('grants 1 drop per level above 1', () => {
    expect(LootEngine.availableDrops(2, 0)).toBe(1);
    expect(LootEngine.availableDrops(5, 0)).toBe(4);
  });
  it('subtracts already-redeemed drops', () => {
    expect(LootEngine.availableDrops(5, 2)).toBe(2);
    expect(LootEngine.availableDrops(5, 4)).toBe(0);
    expect(LootEngine.availableDrops(5, 99)).toBe(0);
  });
});

describe('LootEngine.tierForLevel', () => {
  it('uses default mapping', () => {
    expect(LootEngine.tierForLevel(2,  DEFAULT_SETTINGS)).toBe('common');
    expect(LootEngine.tierForLevel(4,  DEFAULT_SETTINGS)).toBe('rare');
    expect(LootEngine.tierForLevel(6,  DEFAULT_SETTINGS)).toBe('epic');
    expect(LootEngine.tierForLevel(8,  DEFAULT_SETTINGS)).toBe('legendary');
    expect(LootEngine.tierForLevel(10, DEFAULT_SETTINGS)).toBe('mythic');
  });
  it('falls back to common for unknown level', () => {
    expect(LootEngine.tierForLevel(99, DEFAULT_SETTINGS)).toBe('common');
  });
});

describe('LootEngine.pickOptions', () => {
  it('returns null when loot disabled', () => {
    expect(LootEngine.pickOptions(5, 0, { ...DEFAULT_SETTINGS, enableLoot: false })).toBeNull();
  });
  it('returns null when no drops available', () => {
    expect(LootEngine.pickOptions(1, 0, DEFAULT_SETTINGS)).toBeNull();
    expect(LootEngine.pickOptions(2, 1, DEFAULT_SETTINGS)).toBeNull();
  });
  it('returns deterministic options for same input', () => {
    const a = LootEngine.pickOptions(3, 0, DEFAULT_SETTINGS);
    const b = LootEngine.pickOptions(3, 0, DEFAULT_SETTINGS);
    expect(a).toEqual(b);
  });
  it('changes options when redeemed-count changes', () => {
    const a = LootEngine.pickOptions(3, 0, DEFAULT_SETTINGS);
    const b = LootEngine.pickOptions(3, 1, DEFAULT_SETTINGS);
    expect(a?.options).not.toEqual(b?.options);
  });
  it('honours lootOptionsCount setting', () => {
    const r = LootEngine.pickOptions(3, 0, { ...DEFAULT_SETTINGS, lootOptionsCount: 5 });
    expect(r?.options.length).toBe(5);
  });
  it('uses customLootPool when provided', () => {
    const custom = { common: [{ name: 'x', cat: 'y' }, { name: 'z', cat: 'y' }] };
    const r = LootEngine.pickOptions(2, 0, { ...DEFAULT_SETTINGS, customLootPool: custom });
    expect(r?.options.every((o) => ['x', 'z'].includes(o.name))).toBe(true);
  });
});

describe('Default loot pool integrity', () => {
  for (const tier of ['common', 'rare', 'epic', 'legendary', 'mythic'] as const) {
    it(`tier ${tier} has at least 5 entries`, () => {
      expect(DEFAULT_LOOT_POOL[tier].length).toBeGreaterThanOrEqual(5);
    });
    it(`tier ${tier} has no empty names`, () => {
      for (const drop of DEFAULT_LOOT_POOL[tier]) {
        expect(drop.name.trim().length).toBeGreaterThan(0);
        expect(drop.cat.trim().length).toBeGreaterThan(0);
      }
    });
  }
});
