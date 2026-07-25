/* ==========================================================
   Fresh-install language seeding: on first load, adopt the
   Obsidian UI language; never change an existing install's
   stored language.
   ========================================================== */
import KuroPlugin from '../src/main';
import { __setMockLanguage } from 'obsidian';

function makeFakeApp() {
  return {
    vault: { on: () => ({}) },
    workspace: {
      onLayoutReady: (_cb: () => void) => {},
      getLeavesOfType: () => [],
      getRightLeaf: () => null,
      revealLeaf: () => {},
    },
    internalPlugins: { getPluginById: () => null },
  };
}

async function boot(loaded: any) {
  const plugin = new (KuroPlugin as any)();
  plugin.app = makeFakeApp();
  plugin.loadData = async () => loaded;
  await plugin.onload();
  return plugin;
}

describe('KuroPlugin — fresh-install language seeding', () => {
  afterEach(() => __setMockLanguage('en'));

  it('adopts German on a fresh vault when Obsidian UI is German', async () => {
    __setMockLanguage('de');
    const plugin = await boot(null);
    expect(plugin.data.settings.language).toBe('de');
  });

  it('adopts English on a fresh vault when Obsidian UI is English', async () => {
    __setMockLanguage('en');
    const plugin = await boot(null);
    expect(plugin.data.settings.language).toBe('en');
  });

  it("keeps an existing install's stored language", async () => {
    __setMockLanguage('en');
    const plugin = await boot({ onboardingShown: true, settings: { language: 'de' } });
    expect(plugin.data.settings.language).toBe('de');
  });
});
