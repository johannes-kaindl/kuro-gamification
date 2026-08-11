/* ==========================================================
   probeModels() — pure Endpunkt-Probe für die Chat-Modell-Liste.
   Nutzt die bereits vendored, bislang ungenutzte
   classifyEndpointStatus() statt Fehler stillschweigend in [] zu
   ertränken (Endpunkt-Befund 09-08, s. Handover-Note).
   ========================================================== */
import { probeModels, type ModelsTransport } from '../src/llm/probeEndpoint';

describe('probeModels', () => {
  it('returns models on a reachable OpenAI-style endpoint', async () => {
    const transport: ModelsTransport = {
      async get() {
        return { status: 200, body: { data: [{ id: 'b' }, { id: 'a' }] } };
      },
    };
    const result = await probeModels({ endpoint: 'http://localhost:1234', apiKey: '' }, transport);
    expect(result.status.reachable).toBe(true);
    expect(result.status.kind).toBe('ok');
    expect(result.models).toEqual(['a', 'b']);
  });

  it('requests the normalized /v1/models URL', async () => {
    let seenUrl = '';
    const transport: ModelsTransport = {
      async get(url) { seenUrl = url; return { status: 200, body: { data: [] } }; },
    };
    await probeModels({ endpoint: 'http://localhost:1234/v1/', apiKey: '' }, transport);
    expect(seenUrl).toBe('http://localhost:1234/v1/models');
  });

  it('sends an Authorization header when an API key is set', async () => {
    let seenHeaders: Record<string, string> = {};
    const transport: ModelsTransport = {
      async get(_url, headers) { seenHeaders = headers; return { status: 200, body: { data: [] } }; },
    };
    await probeModels({ endpoint: 'http://host', apiKey: 'secret' }, transport);
    expect(seenHeaders.Authorization).toBe('Bearer secret');
  });

  it('sends no Authorization header when the API key is empty', async () => {
    let seenHeaders: Record<string, string> = {};
    const transport: ModelsTransport = {
      async get(_url, headers) { seenHeaders = headers; return { status: 200, body: { data: [] } }; },
    };
    await probeModels({ endpoint: 'http://host', apiKey: '' }, transport);
    expect(seenHeaders.Authorization).toBeUndefined();
  });

  it('classifies a 401 response as unauthorized, not a generic failure', async () => {
    const transport: ModelsTransport = {
      async get() { return { status: 401, body: { error: 'nope' } }; },
    };
    const result = await probeModels({ endpoint: 'http://host', apiKey: 'wrong' }, transport);
    expect(result.status.kind).toBe('unauthorized');
    expect(result.models).toEqual([]);
  });

  it('classifies a connection-refused transport error as refused', async () => {
    const transport: ModelsTransport = {
      async get() { throw new Error('connect ECONNREFUSED 127.0.0.1:1234'); },
    };
    const result = await probeModels({ endpoint: 'http://localhost:1234', apiKey: '' }, transport);
    expect(result.status.kind).toBe('refused');
    expect(result.status.reachable).toBe(false);
    expect(result.models).toEqual([]);
  });

  it('classifies a non-JSON-model response as not-an-llm-api', async () => {
    const transport: ModelsTransport = {
      async get() { return { status: 200, body: '<html>not an api</html>' }; },
    };
    const result = await probeModels({ endpoint: 'http://host', apiKey: '' }, transport);
    expect(result.status.kind).toBe('not-an-llm-api');
    expect(result.models).toEqual([]);
  });
});
