/* ==========================================================
   KuroLlmClient — probe()/listModels()/ping() gegen einen injizierten
   HTTP-Transport. Ersetzt den alten main.ts-Pfad, der nie den API-Key
   sendete (Endpunkt-Befund 09-08) und jeden Fehler in [] ertraenkte.
   ========================================================== */
import { KuroLlmClient, type KuroLlmHttpJson } from '../src/llm/KuroLlmClient';

describe('KuroLlmClient', () => {
  it('lists models on a reachable endpoint, sorted', async () => {
    const http: KuroLlmHttpJson = async () => ({ status: 200, json: { data: [{ id: 'b' }, { id: 'a' }] } });
    const client = new KuroLlmClient({ url: 'http://localhost:1234' }, http);
    expect(await client.listModels()).toEqual(['a', 'b']);
  });

  it('requests the normalized /v1/models URL', async () => {
    let seenUrl = '';
    const http: KuroLlmHttpJson = async (url) => { seenUrl = url; return { status: 200, json: { data: [] } }; };
    await new KuroLlmClient({ url: 'http://localhost:1234/v1/' }, http).listModels();
    expect(seenUrl).toBe('http://localhost:1234/v1/models');
  });

  it('sends the endpoint apiKey as a Bearer header', async () => {
    let seenHeaders: Record<string, string> = {};
    const http: KuroLlmHttpJson = async (_url, headers) => { seenHeaders = headers; return { status: 200, json: { data: [] } }; };
    await new KuroLlmClient({ url: 'http://host', apiKey: 'secret' }, http).listModels();
    expect(seenHeaders.Authorization).toBe('Bearer secret');
  });

  it('sends no Authorization header without an apiKey', async () => {
    let seenHeaders: Record<string, string> = {};
    const http: KuroLlmHttpJson = async (_url, headers) => { seenHeaders = headers; return { status: 200, json: { data: [] } }; };
    await new KuroLlmClient({ url: 'http://host' }, http).listModels();
    expect(seenHeaders.Authorization).toBeUndefined();
  });

  it('listModels returns [] on a non-200 status instead of throwing', async () => {
    const http: KuroLlmHttpJson = async () => ({ status: 401, json: { error: 'nope' } });
    expect(await new KuroLlmClient({ url: 'http://host' }, http).listModels()).toEqual([]);
  });

  it('listModels returns [] when the transport throws', async () => {
    const http: KuroLlmHttpJson = async () => { throw new Error('boom'); };
    expect(await new KuroLlmClient({ url: 'http://host' }, http).listModels()).toEqual([]);
  });

  it('probe classifies a 401 as unauthorized, not a generic failure', async () => {
    const http: KuroLlmHttpJson = async () => ({ status: 401, json: { error: 'nope' } });
    const status = await new KuroLlmClient({ url: 'http://host' }, http).probe();
    expect(status.kind).toBe('unauthorized');
    expect(status.reachable).toBe(false);
  });

  it('probe classifies a connection-refused transport error as refused', async () => {
    const http: KuroLlmHttpJson = async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:1234'); };
    const status = await new KuroLlmClient({ url: 'http://host' }, http).probe();
    expect(status.kind).toBe('refused');
  });

  it('ping is true exactly when probe is reachable', async () => {
    const ok: KuroLlmHttpJson = async () => ({ status: 200, json: { data: [] } });
    const bad: KuroLlmHttpJson = async () => ({ status: 500, json: null });
    expect(await new KuroLlmClient({ url: 'http://host' }, ok).ping()).toBe(true);
    expect(await new KuroLlmClient({ url: 'http://host' }, bad).ping()).toBe(false);
  });
});
