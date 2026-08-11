/* ==========================================================
   KuroPlugin.fetchChatModels() — wiring von probeModels() gegen
   Obsidians requestUrl. Root-Cause-Fix für den Endpunkt-Befund
   09-08 (Handover-Note): der alte Pfad fing jeden Fehler in []
   und sendete nie den API-Key mit.
   ========================================================== */
import KuroPlugin from '../src/main';
import { __setMockRequestUrl } from './__mocks__/obsidian';
import { DEFAULT_SETTINGS } from '../src/types';

function makeFakeApp() {
  return {
    vault: { on: () => ({}) },
    workspace: { onLayoutReady: () => {}, getLeavesOfType: () => [], getRightLeaf: () => null, revealLeaf: () => {} },
  };
}

async function makePlugin(): Promise<any> {
  const plugin = new (KuroPlugin as any)();
  plugin.app = makeFakeApp();
  await plugin.onload();
  return plugin;
}

describe('KuroPlugin.fetchChatModels', () => {
  it('returns a specific status instead of a bare empty array on failure', async () => {
    __setMockRequestUrl(() => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:1234')));
    const plugin = await makePlugin();
    plugin.data.settings = { ...DEFAULT_SETTINGS, chatEndpoint: 'http://localhost:1234', chatApiKey: '' };

    const result = await plugin.fetchChatModels();

    expect(result.status.kind).toBe('refused');
    expect(result.models).toEqual([]);
  });

  it('sends the configured API key as a Bearer header', async () => {
    let seenHeaders: Record<string, string> = {};
    __setMockRequestUrl((req) => {
      seenHeaders = req.headers ?? {};
      return Promise.resolve({ status: 200, json: { data: [{ id: 'qwen3' }] } });
    });
    const plugin = await makePlugin();
    plugin.data.settings = { ...DEFAULT_SETTINGS, chatEndpoint: 'http://host', chatApiKey: 'secret' };

    const result = await plugin.fetchChatModels();

    expect(seenHeaders.Authorization).toBe('Bearer secret');
    expect(result.models).toEqual(['qwen3']);
  });

  it('does not probe an empty endpoint', async () => {
    const spy = jest.fn(() => Promise.resolve({ status: 200, json: { data: [] } }));
    __setMockRequestUrl(spy);
    const plugin = await makePlugin();
    plugin.data.settings = { ...DEFAULT_SETTINGS, chatEndpoint: '', chatApiKey: '' };

    const result = await plugin.fetchChatModels();

    expect(spy).not.toHaveBeenCalled();
    expect(result.models).toEqual([]);
  });
});
