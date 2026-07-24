import KuroPlugin from '../src/main';
import { DEFAULT_HABITS_DE } from '../src/data/default-habits';

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
    workspace: { onLayoutReady: () => {}, getLeavesOfType: () => [], getRightLeaf: () => null, revealLeaf: () => {} },
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

describe('KuroPlugin — fresh-install habit seeding', () => {
  afterEach(() => localStorage.removeItem('language'));

  it('seeds generic habits (in the UI language) on a fresh vault', async () => {
    localStorage.setItem('language', 'de');
    const plugin = await boot(null);
    expect(plugin.data.settings.habits).toEqual(DEFAULT_HABITS_DE);
  });

  it('never overrides an existing install with its own habits', async () => {
    const plugin = await boot({ onboardingShown: true, settings: { habits: [{ key: 'mine', label: 'Mine', xp: 3 }] } });
    expect(plugin.data.settings.habits).toEqual([{ key: 'mine', label: 'Mine', xp: 3 }]);
  });
});
