import { canActivatePack } from '../src/utils/packLibrary';
import { installPack, resolvePackName, sameLore, activatePack, deletePack, resetSection, activeNames, migrateToLibrary, importPack } from '../src/utils/packLibrary';
import { DEFAULT_SETTINGS } from '../src/types';
import { GOTHIC_LORE, COZY_LORE } from '../src/data/default-lore';

const deps = { gothicLore: GOTHIC_LORE, cozyLore: COZY_LORE, lang: 'de' as const };

describe('sameLore', () => {
  it('is true for structurally equal lore and false otherwise', () => {
    expect(sameLore(GOTHIC_LORE, GOTHIC_LORE)).toBe(true);
    expect(sameLore(GOTHIC_LORE, COZY_LORE)).toBe(false);
    expect(sameLore(GOTHIC_LORE, undefined)).toBe(false);
  });
});

describe('resolvePackName', () => {
  it('prefers an explicit trimmed name', () => {
    expect(resolvePackName({ kuroPack: 1, name: '  My Pack ' }, deps)).toBe('My Pack');
  });
  it('matches bundled lore by content', () => {
    expect(resolvePackName({ kuroPack: 1, lore: GOTHIC_LORE }, deps)).toBe('Gothic-Cyberpunk');
    expect(resolvePackName({ kuroPack: 1, lore: COZY_LORE }, deps)).toBe('Cozy');
  });
  it('falls back to the localized generic name', () => {
    expect(resolvePackName({ kuroPack: 1, lore: [{ level: 1, title: 'X', text: 'y' }] }, deps)).toBe('Importiertes Pack');
  });
});

describe('installPack', () => {
  it('appends an entry with resolved name and carried sections, without activating', () => {
    const pack = { kuroPack: 1, name: 'P', lore: [{ level: 1, title: 'T', text: 'x' }] };
    const next = installPack(DEFAULT_SETTINGS, pack, 'id-1', deps);
    expect(next.packLibrary).toHaveLength(1);
    expect(next.packLibrary[0]).toEqual({ id: 'id-1', name: 'P', lore: pack.lore });
    expect(next.activeLorePackId).toBeNull();      // not activated
    expect(next.customLore).toBeNull();
  });
  it('omits sections the pack does not carry', () => {
    const next = installPack(DEFAULT_SETTINGS, { kuroPack: 1, loot: { common: [] } }, 'id-2', deps);
    expect(next.packLibrary[0].lore).toBeUndefined();
    expect(next.packLibrary[0].loot).toEqual({ common: [] });
  });
});

describe('activatePack', () => {
  const withLib = {
    ...DEFAULT_SETTINGS,
    packLibrary: [
      { id: 'lore-1', name: 'L', lore: [{ level: 1, title: 'T', text: 'x' }] },
      { id: 'both-1', name: 'B', lore: [{ level: 1, title: 'B', text: 'b' }], loot: { common: [{ name: 'n', cat: 'c' }] } },
    ],
  };

  it('activates only the sections the pack carries and syncs the cache', () => {
    const next = activatePack(withLib, 'lore-1');
    expect(next.activeLorePackId).toBe('lore-1');
    expect(next.customLore).toEqual(withLib.packLibrary[0].lore);
    expect(next.activeLootPackId).toBeNull();   // loot untouched
    expect(next.customLootPool).toBeNull();
  });

  it('activates both sections for a combined pack', () => {
    const next = activatePack(withLib, 'both-1');
    expect(next.activeLorePackId).toBe('both-1');
    expect(next.activeLootPackId).toBe('both-1');
    expect(next.customLootPool).toEqual(withLib.packLibrary[1].loot);
  });

  it('leaves the other section active when a lore-only pack is activated over it', () => {
    const base = activatePack(withLib, 'both-1');   // both active
    const next = activatePack(base, 'lore-1');       // lore swaps, loot stays
    expect(next.activeLorePackId).toBe('lore-1');
    expect(next.activeLootPackId).toBe('both-1');
  });

  it('returns settings unchanged for an unknown id', () => {
    expect(activatePack(withLib, 'nope')).toBe(withLib);
  });
});

describe('deletePack', () => {
  it('removes the entry and reverts an active section to factory', () => {
    const s = activatePack(
      { ...DEFAULT_SETTINGS, packLibrary: [{ id: 'a', name: 'A', lore: [{ level: 1, title: 'T', text: 'x' }] }] },
      'a',
    );
    const next = deletePack(s, 'a');
    expect(next.packLibrary).toHaveLength(0);
    expect(next.activeLorePackId).toBeNull();
    expect(next.customLore).toBeNull();
  });

  it('leaves active pointers alone when deleting a non-active pack', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      packLibrary: [
        { id: 'a', name: 'A', lore: [{ level: 1, title: 'T', text: 'x' }] },
        { id: 'b', name: 'B', lore: [{ level: 1, title: 'U', text: 'y' }] },
      ],
      activeLorePackId: 'a',
      customLore: [{ level: 1, title: 'T', text: 'x' }],
    };
    const next = deletePack(s, 'b');
    expect(next.packLibrary.map((p) => p.id)).toEqual(['a']);
    expect(next.activeLorePackId).toBe('a');
  });
});

describe('resetSection', () => {
  it('clears the lore pointer + cache and leaves loot + library untouched', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      packLibrary: [{ id: 'a', name: 'A', lore: [{ level: 1, title: 'T', text: 'x' }] }],
      activeLorePackId: 'a',
      customLore: [{ level: 1, title: 'T', text: 'x' }],
      activeLootPackId: 'a',
      customLootPool: { common: [] },
    };
    const next = resetSection(s, 'lore');
    expect(next.activeLorePackId).toBeNull();
    expect(next.customLore).toBeNull();
    expect(next.activeLootPackId).toBe('a');        // loot untouched
    expect(next.packLibrary).toHaveLength(1);       // library untouched
  });
});

describe('activeNames', () => {
  it('returns the active pack name per section, factory label otherwise', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      packLibrary: [{ id: 'a', name: 'Gothic-Cyberpunk', lore: [{ level: 1, title: 'T', text: 'x' }] }],
      activeLorePackId: 'a',
      activeLootPackId: null,
    };
    expect(activeNames(s, 'de')).toEqual({ lore: 'Gothic-Cyberpunk', loot: 'Factory-Default' });
  });
});

describe('import flow (install then activate)', () => {
  it('installs the pack and activates its sections in one pass', () => {
    const pack = { kuroPack: 1, name: 'Gothic-Cyberpunk', lore: GOTHIC_LORE };
    const installed = installPack(DEFAULT_SETTINGS, pack, 'id-x', deps);
    const active = activatePack(installed, 'id-x');
    expect(active.packLibrary).toHaveLength(1);
    expect(active.activeLorePackId).toBe('id-x');
    expect(active.customLore).toBe(GOTHIC_LORE);
  });
});

describe('migrateToLibrary', () => {
  it('seeds a named, active lore entry from a legacy customLore (content-matched)', () => {
    const s = { ...DEFAULT_SETTINGS, customLore: GOTHIC_LORE };
    const next = migrateToLibrary(s, deps);
    expect(next.packLibrary).toHaveLength(1);
    expect(next.packLibrary[0].name).toBe('Gothic-Cyberpunk');
    expect(next.activeLorePackId).toBe(next.packLibrary[0].id);
    expect(next.customLore).toBe(GOTHIC_LORE);   // cache unchanged
  });

  it('seeds a loot entry too when customLootPool is present', () => {
    const s = { ...DEFAULT_SETTINGS, customLore: GOTHIC_LORE, customLootPool: { common: [{ name: 'n', cat: 'c' }] } };
    const next = migrateToLibrary(s, deps);
    expect(next.packLibrary).toHaveLength(2);
    expect(next.activeLootPackId).not.toBeNull();
  });

  it('is a no-op when the library is already non-empty (idempotent)', () => {
    const s = { ...DEFAULT_SETTINGS, customLore: GOTHIC_LORE };
    const once = migrateToLibrary(s, deps);
    const twice = migrateToLibrary(once, deps);
    expect(twice).toBe(once);
  });

  it('is a no-op on a clean factory state', () => {
    expect(migrateToLibrary(DEFAULT_SETTINGS, deps)).toBe(DEFAULT_SETTINGS);
  });
});

describe('importPack', () => {
  it('lore-only pack: creates one library entry, activates it, leaves habits unchanged', () => {
    const pack = { kuroPack: 1, name: 'P', lore: [{ level: 1, title: 'T', text: 'x' }] };
    const next = importPack(DEFAULT_SETTINGS, pack, 'id-1', deps);
    expect(next.packLibrary).toHaveLength(1);
    expect(next.activeLorePackId).toBe('id-1');
    expect(next.customLore).toEqual(pack.lore);
    expect(next.habits).toBe(DEFAULT_SETTINGS.habits);
  });

  it('habits-only pack: creates NO library entry, applies habits directly, pointers stay null', () => {
    const habits = [{ key: 'h', label: 'H', xp: 1 }];
    const pack = { kuroPack: 1, name: 'Habits', habits };
    const next = importPack(DEFAULT_SETTINGS, pack, 'id-2', deps);
    expect(next.packLibrary).toHaveLength(0);
    expect(next.habits).toBe(habits);
    expect(next.activeLorePackId).toBeNull();
    expect(next.activeLootPackId).toBeNull();
  });

  it('combined lore+loot+habits pack: library entry with both sections active AND habits applied', () => {
    const habits = [{ key: 'h', label: 'H', xp: 1 }];
    const pack = {
      kuroPack: 1,
      name: 'Combo',
      lore: [{ level: 1, title: 'T', text: 'x' }],
      loot: { common: [{ name: 'n', cat: 'c' }] },
      habits,
    };
    const next = importPack(DEFAULT_SETTINGS, pack, 'id-3', deps);
    expect(next.packLibrary).toHaveLength(1);
    expect(next.activeLorePackId).toBe('id-3');
    expect(next.activeLootPackId).toBe('id-3');
    expect(next.customLore).toEqual(pack.lore);
    expect(next.customLootPool).toEqual(pack.loot);
    expect(next.habits).toBe(habits);
  });
});

describe('canActivatePack', () => {
  const loreOnly = { id: 'l', name: 'L', lore: [{ level: 1, title: 'T', text: 'x' }] };
  const combined = { id: 'c', name: 'C', lore: [{ level: 1, title: 'U', text: 'y' }], loot: { common: [{ name: 'n', cat: 'k' }] } };
  const base = { ...DEFAULT_SETTINGS, packLibrary: [loreOnly, combined] };

  it('is true when nothing of the pack is active yet', () => {
    expect(canActivatePack(base, loreOnly)).toBe(true);
  });

  it('is false when every section the pack carries is already active', () => {
    const s = { ...base, activeLorePackId: 'l' };
    expect(canActivatePack(s, loreOnly)).toBe(false);
  });

  it('stays true for a combined pack when only one of its sections is active', () => {
    const s = { ...base, activeLorePackId: 'c' };   // loot still elsewhere
    expect(canActivatePack(s, combined)).toBe(true);
  });

  it('is false for a combined pack once both its sections are active', () => {
    const s = { ...base, activeLorePackId: 'c', activeLootPackId: 'c' };
    expect(canActivatePack(s, combined)).toBe(false);
  });

  it('is false for a pack carrying neither lore nor loot (nothing to activate)', () => {
    expect(canActivatePack(base, { id: 'e', name: 'E' })).toBe(false);
  });
});
