import { BACKEND_CACHE_MS, createBackendProbe } from '../src/llm/backendProbe';

describe('createBackendProbe', () => {
  const lmStudio = (calls: string[]) => async (req: { url: string }) => {
    calls.push(req.url);
    // LM Studio v0 beantwortet /api/v0/models mit einer Modell-Liste.
    return req.url.endsWith('/api/v0/models') ? { json: { data: [{ id: 'm', state: 'loaded', max_context_length: 4096 }] } } : null;
  };

  it('erkennt LM Studio und fragt je URL nur einmal innerhalb der Frist', async () => {
    const calls: string[] = [];
    let now = 1_000;
    const probe = createBackendProbe(lmStudio(calls), () => now);
    expect(await probe('http://h:1234/v1', 'm')).toBe('lmstudio');
    const n = calls.length;
    now += BACKEND_CACHE_MS - 1;
    expect(await probe('http://h:1234/v1', 'm')).toBe('lmstudio');
    expect(calls.length).toBe(n);
  });

  it('fragt nach Ablauf der Frist und bei anderer URL erneut', async () => {
    const calls: string[] = [];
    let now = 1_000;
    const probe = createBackendProbe(lmStudio(calls), () => now);
    await probe('http://h:1234', 'm');
    const n = calls.length;
    now += BACKEND_CACHE_MS;
    await probe('http://h:1234', 'm');
    expect(calls.length).toBeGreaterThan(n);
    const m = calls.length;
    await probe('http://anders:1234', 'm');
    expect(calls.length).toBeGreaterThan(m);
  });
});
