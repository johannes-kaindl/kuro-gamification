/* ==========================================================
   Chat-Endpunkt: Manager-Vorrang, lokale Liste als Rückfall
   (Kit endpoint-source, capability "chat").
   ========================================================== */
import { __setMockRequestUrl } from './__mocks__/obsidian';
import { makePlugin } from './helpers/connection';

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

describe('KuroPlugin.llm.resolve (Chat-Endpunkt)', () => {
  it('nimmt den Endpunkt des Managers, wenn er installiert ist (capability chat, caller kuro-gamification)', async () => {
    const seen: { caller?: string; capability?: string } = {};
    const api = managerApi({
      resolved: { id: 'a', label: 'A', config: { url: 'http://mgr:1', apiKey: 'k' }, defaultModel: 'm-mgr' },
      materialized: { error: 'not-found' },
    }, seen);
    const plugin = await makePlugin(api);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    const r = await plugin.llm.resolve();
    expect(r).toMatchObject({ config: { url: 'http://mgr:1', apiKey: 'k' }, model: 'm-mgr' });
    expect(seen).toEqual({ caller: 'kuro-gamification', capability: 'chat' });
  });

  it('die gemerkte Wahl (Endpunkt + Modell) gewinnt gegenüber dem Standardmodell', async () => {
    const api = managerApi({
      resolved: { error: 'no-endpoint' },
      materialized: { id: 'b', label: 'B', config: { url: 'http://mgr:2' }, defaultModel: 'std' },
    }, {});
    const plugin = await makePlugin(api);
    plugin.data.settings.chatChoice = { endpointId: 'b', model: 'meins' };
    expect((await plugin.llm.resolve()).model).toBe('meins');
  });

  it('Manager da, aber ohne Endpunkt: kein Rückfall auf die lokale Liste — die eine Wahrheit, die eine Meldung', async () => {
    const api = managerApi({ resolved: { error: 'no-endpoint' }, materialized: { error: 'not-found' } }, {});
    const plugin = await makePlugin(api);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    const r = await plugin.llm.resolve();
    expect(r.config).toBeNull();
  });

  // Die lokale Zeile gilt als erreichbar, wenn /v1/models antwortet (Standard-Probe der Verbindung).
  function reachable(models: string[] = ['x']) {
    __setMockRequestUrl(async () => ({ status: 200, json: { data: models.map((id) => ({ id })) }, text: '' }));
  }

  it('ohne Manager läuft die lokale Liste wie bisher (Modell der Zeile)', async () => {
    reachable();
    const plugin = await makePlugin(null);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1', model: 'zeile' }];
    const r = await plugin.llm.resolve();
    expect(r).toMatchObject({ kind: 'local', config: { url: 'http://lokal:1' }, model: 'zeile', sentModel: 'zeile' });
  });

  it('ohne Manager erkennt der lokale Pfad die Modellfamilie aus dem Namen (Sampling-Profile)', async () => {
    reachable();
    const plugin = await makePlugin(null);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1', model: 'qwen/qwen3.6-35b-a3b' }];
    const r = await plugin.llm.resolve();
    expect(r).toMatchObject({ family: 'qwen3.6', familySource: 'name', sentModel: 'qwen/qwen3.6-35b-a3b' });
  });

  it('die gemerkte Manager-Wahl übersteuert ein lokales Modell nicht (choice gilt nur mit Manager)', async () => {
    reachable();
    const plugin = await makePlugin(null);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1', model: 'lokal-modell' }];
    plugin.data.settings.chatChoice = { endpointId: 'alt', model: 'alte-wahl' };
    expect((await plugin.llm.resolve()).model).toBe('lokal-modell');
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
