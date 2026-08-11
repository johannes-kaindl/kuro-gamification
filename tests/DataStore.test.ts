import { DataStore } from '../src/persistence/DataStore';
import { DEFAULT_PLUGIN_DATA, DEFAULT_SETTINGS } from '../src/types';
import { GOTHIC_LORE } from '../src/data/default-lore';

describe('DataStore.merge', () => {
  // Build a minimal fake plugin
  const fakePlugin = { loadData: () => Promise.resolve(null), saveData: () => Promise.resolve() } as any;
  const ds = new DataStore(fakePlugin);

  it('produces full defaults from empty input', () => {
    const merged = ds.merge({});
    expect(merged.schemaVersion).toBe(2);
    expect(merged.settings.dailyFolder).toBe(DEFAULT_SETTINGS.dailyFolder);
    expect(merged.redeemedDrops).toEqual([]);
    expect(merged.lastSnapshot).toBeNull();
  });

  it('preserves user-overridden settings', () => {
    const merged = ds.merge({
      settings: {
        ...DEFAULT_SETTINGS,
        dailyFolder: 'foo/bar',
        xpPerCheckbox: 99,
      },
    });
    expect(merged.settings.dailyFolder).toBe('foo/bar');
    expect(merged.settings.xpPerCheckbox).toBe(99);
    // unchanged keys retain default values
    expect(merged.settings.weeklyFolder).toBe(DEFAULT_SETTINGS.weeklyFolder);
  });

  it('preserves redeemed drops history', () => {
    const drops = [
      { date: '2026-04-24', level: 2, tier: 'common' as const, name: 'Tee', cat: 'Küche' },
    ];
    const merged = ds.merge({ redeemedDrops: drops });
    expect(merged.redeemedDrops).toEqual(drops);
  });

  it('initializes habit array if missing', () => {
    const merged = ds.merge({ settings: { ...DEFAULT_SETTINGS, habits: undefined as any } });
    expect(Array.isArray(merged.settings.habits)).toBe(true);
  });

  it('replaces empty levels array with defaults', () => {
    const merged = ds.merge({ settings: { ...DEFAULT_SETTINGS, levels: [] } });
    expect(merged.settings.levels.length).toBe(DEFAULT_SETTINGS.levels.length);
  });

  it('merges custom tierByLevel onto defaults', () => {
    const merged = ds.merge({
      settings: { ...DEFAULT_SETTINGS, tierByLevel: { 99: 'mythic' } },
    });
    expect(merged.settings.tierByLevel[99]).toBe('mythic');
    expect(merged.settings.tierByLevel[2]).toBe('common');
  });
});

describe('DataStore.merge — onboarding guard', () => {
  const fakePlugin = { loadData: () => Promise.resolve(null), saveData: () => Promise.resolve() } as any;
  const ds = new DataStore(fakePlugin);

  it('new install onboards (onboardingShown=false, schemaVersion=2)', () => {
    const merged = ds.merge({});
    expect(merged.onboardingShown).toBe(false);
    expect(merged.schemaVersion).toBe(2);
  });

  it('pre-v2 upgrader is NOT onboarded (onboardingShown forced true, schemaVersion lifted to 2)', () => {
    const merged = ds.merge({ schemaVersion: 1, redeemedDrops: [{ date: '2026-01-01', level: 2, tier: 'common' as const, name: 'x', cat: 'y' }] });
    expect(merged.onboardingShown).toBe(true);
    expect(merged.schemaVersion).toBe(2);
  });

  it('keeps onboardingShown=true once already set', () => {
    const merged = ds.merge({ schemaVersion: 2, onboardingShown: true });
    expect(merged.onboardingShown).toBe(true);
  });
});

describe('DataStore — pack library defaults', () => {
  const makeStore = (raw: unknown) => {
    const fakePlugin = { loadData: () => Promise.resolve(raw), saveData: () => Promise.resolve() } as any;
    return new DataStore(fakePlugin);
  };

  it('fills pack-library fields for legacy data (no packLibrary key)', async () => {
    const store = makeStore({ settings: {} });
    const data = await store.load();
    expect(data.settings.packLibrary).toEqual([]);
    expect(data.settings.activeLorePackId).toBeNull();
    expect(data.settings.activeLootPackId).toBeNull();
  });

  it('migrates legacy customLore into the library on load (superseded by load-time migration)', async () => {
    const store = makeStore({ settings: { customLore: [{ level: 1, title: 'T', text: 'x' }] } });
    const data = await store.load();
    expect(data.settings.packLibrary).toHaveLength(1);
    expect(data.settings.activeLorePackId).toBe('lib-migrated-lore');
  });

  it('guards a malformed packLibrary into the default empty array', async () => {
    const store = makeStore({ settings: { packLibrary: 'nope' } });
    const data = await store.load();
    expect(data.settings.packLibrary).toEqual([]);
  });

  it('migrates a legacy gothic customLore into a named active library entry on load', async () => {
    const raw = { settings: { customLore: [...GOTHIC_LORE], language: 'de' } };
    const store = new DataStore({ loadData: async () => raw, saveData: async () => {} } as never);
    const data = await store.load();
    expect(data.settings.packLibrary).toHaveLength(1);
    expect(data.settings.packLibrary[0].name).toBe('Gothic-Cyberpunk');
    expect(data.settings.activeLorePackId).toBe(data.settings.packLibrary[0].id);
  });
});

describe('DataStore.merge — chat & notes', () => {
  const fakePlugin = { loadData: () => Promise.resolve(null), saveData: () => Promise.resolve() } as any;
  const ds = new DataStore(fakePlugin);

  it('defaults kuroNotes to an empty array when absent', () => {
    expect(ds.merge({}).kuroNotes).toEqual([]);
  });

  it('keeps a stored kuroNotes array', () => {
    expect(ds.merge({ kuroNotes: ['nenn mich nicht Operative'] }).kuroNotes)
      .toEqual(['nenn mich nicht Operative']);
  });

  it('falls back to an empty array when kuroNotes is not an array', () => {
    expect(ds.merge({ kuroNotes: 'kaputt' } as never).kuroNotes).toEqual([]);
  });

  it('defaults the chat settings to off and empty', () => {
    const s = ds.merge({}).settings;
    expect(s.enableChat).toBe(false);
    expect(s.chatEndpoints).toEqual([]);
    expect(s.chatModel).toBe('');
    expect(s.chatDailyContext).toBe('tasks');
    expect(s.chatSuppressThinking).toBe(true);
    expect(s.chatPersonaOverride).toBe('');
  });

  it('preserves user-overridden chat settings', () => {
    const merged = ds.merge({
      settings: { ...DEFAULT_SETTINGS, enableChat: true, chatEndpoints: [{ url: 'http://localhost:1234' }] },
    });
    expect(merged.settings.enableChat).toBe(true);
    expect(merged.settings.chatEndpoints).toEqual([{ url: 'http://localhost:1234' }]);
  });

  it('migrates a pre-endpoint_config data.json (legacy chatEndpoint/chatApiKey) without losing the key', () => {
    // Alte data.json-Form (vor dem Kit-endpoint_config-Umstieg): kein chatEndpoints-Feld,
    // stattdessen die Alt-Felder — im aktuellen KuroSettings-Typ gar nicht mehr deklariert.
    const legacy = { ...DEFAULT_SETTINGS, chatEndpoint: 'http://localhost:1234', chatApiKey: 'sk-secret' } as never;
    const merged = ds.merge({ settings: legacy });
    expect(merged.settings.chatEndpoints).toEqual([{ url: 'http://localhost:1234', apiKey: 'sk-secret' }]);
  });
});
