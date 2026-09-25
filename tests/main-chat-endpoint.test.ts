/* ==========================================================
   Chat-Endpunkt: Manager-Vorrang, lokale Liste als Rückfall
   (Kit endpoint-source, capability "chat").
   ========================================================== */
import KuroPlugin from '../src/main';

type Fake = { resolved: unknown; materialized: unknown };

function managerApi(fake: Fake, seen: { caller?: string | undefined; capability?: string }) {
  return {
    version: 1,
    list: () => [],
    get: () => null,
    resolve: async (cap: string, opts?: { caller?: string }) => {
      seen.caller = opts?.caller; seen.capability = cap;
      return fake.resolved;
    },
    materialize: async () => fake.materialized,
    models: async () => [],
    importEndpoints: async () => ({ added: [], merged: [], skipped: [] }),
    on: () => () => {},
  };
}

async function makePlugin(manager: unknown) {
  const app = {
    vault: { on: () => ({}) },
    workspace: { onLayoutReady: () => {}, getLeavesOfType: () => [], getRightLeaf: () => null, revealLeaf: () => {} },
    plugins: { plugins: manager ? { 'llm-endpoint-manager': { api: manager } } : {} },
  };
  const plugin: any = new (KuroPlugin as any)();
  plugin.app = app;
  await plugin.onload();
  return plugin;
}

describe('KuroPlugin.resolveChatEndpoint', () => {
  it('nimmt den Endpunkt des Managers, wenn er installiert ist (capability chat, caller kuro-gamification)', async () => {
    const seen: { caller?: string; capability?: string } = {};
    const api = managerApi({
      resolved: { id: 'a', label: 'A', config: { url: 'http://mgr:1', apiKey: 'k' }, defaultModel: 'm-mgr' },
      materialized: { error: 'not-found' },
    }, seen);
    const plugin = await makePlugin(api);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    const r = await plugin.resolveChatEndpoint();
    expect(r).toEqual({ config: { url: 'http://mgr:1', apiKey: 'k' }, model: 'm-mgr' });
    expect(seen).toEqual({ caller: 'kuro-gamification', capability: 'chat' });
  });

  it('die gemerkte Wahl (Endpunkt + Modell) gewinnt gegenüber dem Standardmodell', async () => {
    const api = managerApi({
      resolved: { error: 'no-endpoint' },
      materialized: { id: 'b', label: 'B', config: { url: 'http://mgr:2' }, defaultModel: 'std' },
    }, {});
    const plugin = await makePlugin(api);
    plugin.data.settings.chatChoice = { endpointId: 'b', model: 'meins' };
    expect((await plugin.resolveChatEndpoint())?.model).toBe('meins');
  });

  it('Manager da, aber ohne Endpunkt: kein Rückfall auf die lokale Liste — die eine Wahrheit, die eine Meldung', async () => {
    const api = managerApi({ resolved: { error: 'no-endpoint' }, materialized: { error: 'not-found' } }, {});
    const plugin = await makePlugin(api);
    plugin.logger = { error: () => {}, info: () => {} };
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    expect(await plugin.resolveChatEndpoint()).toBeNull();
  });

  it('ohne Manager läuft die lokale Liste wie bisher (Modell: Zeile vor globalem Modell)', async () => {
    const plugin = await makePlugin(null);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1', model: 'zeile' }];
    plugin.data.settings.chatModel = 'global';
    plugin.endpointResolver.resolve = async () => ({ url: 'http://lokal:1', model: 'zeile' });
    expect(await plugin.resolveChatEndpoint()).toEqual({ config: { url: 'http://lokal:1', model: 'zeile' }, model: 'zeile' });
  });

  it('hasChatEndpointSource: lokale Liste ODER Manager', async () => {
    const plugin = await makePlugin(null);
    expect(plugin.hasChatEndpointSource()).toBe(false);
    plugin.data.settings.chatEndpoints = [{ url: 'http://x' }];
    expect(plugin.hasChatEndpointSource()).toBe(true);
    const withMgr = await makePlugin(managerApi({ resolved: {}, materialized: {} }, {}));
    expect(withMgr.hasChatEndpointSource()).toBe(true);
  });
});
