/* ==========================================================
   ChatEndpointResolver — cached resolveActiveEndpointConfig() vor jedem
   Chat-Stream. Ohne Cache würde jede Nachricht im Gespräch den ganzen
   Fallback-Durchlauf neu pingen (Muster: obsidian-transmute EndpointResolver).
   ========================================================== */
import { ChatEndpointResolver } from '../src/llm/ChatEndpointResolver';
import type { EndpointConfig } from '../src/vendor/kit/endpoint_config';

describe('ChatEndpointResolver', () => {
  const local: EndpointConfig = { url: 'http://localhost:1234' };
  const hosted: EndpointConfig = { url: 'https://openrouter.ai/api', apiKey: 'sk-x' };

  it('resolves the first reachable endpoint', async () => {
    // resolveActiveEndpointConfig hands ping() a normalized COPY, never the original
    // reference — compare by URL, not identity.
    const r = new ChatEndpointResolver(() => [local, hosted], async (cfg) => cfg.url === local.url);
    expect(await r.resolve()).toEqual(local);
  });

  it('caches the result — a second resolve does not ping again', async () => {
    let calls = 0;
    const r = new ChatEndpointResolver(() => [local], async () => { calls++; return true; });
    await r.resolve();
    await r.resolve();
    expect(calls).toBe(1);
  });

  it('dedupes concurrent resolves into a single underlying probe', async () => {
    let calls = 0;
    const r = new ChatEndpointResolver(() => [local], async () => {
      calls++;
      await new Promise((res) => setTimeout(res, 5));
      return true;
    });
    const [a, b] = await Promise.all([r.resolve(), r.resolve()]);
    expect(calls).toBe(1);
    expect(a).toEqual(local);
    expect(b).toEqual(local);
  });

  it('invalidate() forces a fresh resolve', async () => {
    let calls = 0;
    const r = new ChatEndpointResolver(() => [local], async () => { calls++; return true; });
    await r.resolve();
    r.invalidate();
    await r.resolve();
    expect(calls).toBe(2);
  });

  it('a failed resolve (null) is not cached — the next call retries', async () => {
    let calls = 0;
    const r = new ChatEndpointResolver(() => [local], async () => { calls++; return false; });
    expect(await r.resolve()).toBeNull();
    expect(await r.resolve()).toBeNull();
    expect(calls).toBe(2);
  });
});
