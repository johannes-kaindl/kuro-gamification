/* ==========================================================
   Fresh-install language seeding: on first load, adopt the
   Obsidian UI language; never change an existing install's
   stored language.
   ========================================================== */
import KuroPlugin from '../src/main';

/** In-memory localStorage stub on globalThis (Obsidian runs in Electron, where it exists). */
const store: Record<string, string> = {};
const localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
beforeAll(() => { (globalThis as any).localStorage = localStorage; });
afterAll(() => { (globalThis as any).localStorage = undefined; });

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
  afterEach(() => localStorage.removeItem('language'));

  it('adopts German on a fresh vault when Obsidian UI is German', async () => {
    localStorage.setItem('language', 'de');
    const plugin = await boot(null);
    expect(plugin.data.settings.language).toBe('de');
  });

  it('adopts English on a fresh vault when Obsidian UI is English', async () => {
    localStorage.setItem('language', 'en');
    const plugin = await boot(null);
    expect(plugin.data.settings.language).toBe('en');
  });

  it("keeps an existing install's stored language", async () => {
    localStorage.setItem('language', 'en');
    const plugin = await boot({ onboardingShown: true, settings: { language: 'de' } });
    expect(plugin.data.settings.language).toBe('de');
  });
});
