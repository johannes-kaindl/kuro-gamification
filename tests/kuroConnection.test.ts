/* Kuros Anbindung über `createLlmConnection` (obsidian-kit 0.51.2) mit den ECHTEN Optionen des
   Plugins (`kuroConnectionOptions`) und eingespritztem Transport. Was der Kit-Client selbst kann —
   Abbruch, Fristen, Fehlerkörper, Fallback — ist im Kit abgedeckt. Hier steht, was DIESES Plugin
   daraus macht: welche Parameter es schickt (goldene Requests, Rezept 8), wie die Settings-Namen
   abgebildet werden und was am Token-Limit passiert.
   Modus companion = Temperatur 0.7, Denken-Default aus; mit Denken hebt die Familie das Budget
   auf ihre Reserve (2048), wo eine Reserve bekannt ist (Werte abgelesen aus code-kit
   sampling-profiles, Stand Kit 0.15.0). */
import { makePlugin, recordingTransport, sse, sseReasoning, sseFinish, useTransport } from './helpers/connection';
import type { BackendId, ThinkingLevel } from '../src/vendor/kit/sampling-profiles';

type Row = [string | null, BackendId, ThinkingLevel, Record<string, number | string>];

/* Familienname → Modellname, an dem das Kit die Familie erkennt (null = unbekanntes Modell). */
const MODEL_OF: Record<string, string> = {
  'qwen3.8': 'qwen3.8-27b', 'qwen3.6': 'qwen3.6-35b-a3b', gemma4: 'gemma-4-26b-a4b', 'gpt-oss': 'gpt-oss-20b',
};

const EXPECTED: Row[] = [
  ['qwen3.8', 'lmstudio', 'off', {'temperature':0.7,'top_p':0.8,'top_k':20,'min_p':0,'reasoning_effort':'none','max_tokens':1024}],
  ['qwen3.8', 'lmstudio', 'medium', {'temperature':0.7,'top_p':0.95,'top_k':20,'min_p':0,'reasoning_effort':'medium','max_tokens':2048}],
  ['qwen3.8', 'openwebui', 'off', {'temperature':0.7,'top_p':0.8,'top_k':20,'min_p':0,'presence_penalty':1.5,'reasoning_effort':'none','max_tokens':1024}],
  ['qwen3.8', 'openwebui', 'medium', {'temperature':0.7,'top_p':0.95,'top_k':20,'min_p':0,'reasoning_effort':'medium','max_tokens':2048}],
  ['qwen3.8', 'unknown', 'off', {'temperature':0.7,'top_p':0.8,'reasoning_effort':'none','max_tokens':1024}],
  ['qwen3.8', 'unknown', 'medium', {'temperature':0.7,'top_p':0.95,'reasoning_effort':'medium','max_tokens':2048}],
  ['qwen3.6', 'lmstudio', 'off', {'temperature':0.7,'top_p':0.95,'top_k':20,'reasoning_effort':'none','max_tokens':1024}],
  ['qwen3.6', 'lmstudio', 'medium', {'temperature':0.7,'top_p':0.95,'top_k':20,'reasoning_effort':'medium','max_tokens':2048}],
  ['qwen3.6', 'openwebui', 'off', {'temperature':0.7,'top_p':0.95,'top_k':20,'reasoning_effort':'none','max_tokens':1024}],
  ['qwen3.6', 'openwebui', 'medium', {'temperature':0.7,'top_p':0.95,'top_k':20,'reasoning_effort':'medium','max_tokens':2048}],
  ['qwen3.6', 'unknown', 'off', {'temperature':0.7,'top_p':0.95,'reasoning_effort':'none','max_tokens':1024}],
  ['qwen3.6', 'unknown', 'medium', {'temperature':0.7,'top_p':0.95,'reasoning_effort':'medium','max_tokens':2048}],
  ['gemma4', 'lmstudio', 'off', {'temperature':0.7,'top_p':0.95,'top_k':64,'reasoning_effort':'low','max_tokens':1024}],
  ['gemma4', 'lmstudio', 'medium', {'temperature':0.7,'top_p':0.95,'top_k':64,'reasoning_effort':'medium','max_tokens':2048}],
  ['gemma4', 'openwebui', 'off', {'temperature':0.7,'top_p':0.95,'top_k':64,'reasoning_effort':'none','max_tokens':1024}],
  ['gemma4', 'openwebui', 'medium', {'temperature':0.7,'top_p':0.95,'top_k':64,'reasoning_effort':'medium','max_tokens':2048}],
  ['gemma4', 'unknown', 'off', {'temperature':0.7,'top_p':0.95,'reasoning_effort':'none','max_tokens':1024}],
  ['gemma4', 'unknown', 'medium', {'temperature':0.7,'top_p':0.95,'reasoning_effort':'medium','max_tokens':2048}],
  ['gpt-oss', 'lmstudio', 'off', {'temperature':0.7,'top_p':1,'reasoning_effort':'minimal','max_tokens':1024}],
  ['gpt-oss', 'lmstudio', 'medium', {'temperature':0.7,'top_p':1,'reasoning_effort':'medium','max_tokens':2048}],
  ['gpt-oss', 'openwebui', 'off', {'temperature':0.7,'top_p':1,'reasoning_effort':'minimal','max_tokens':1024}],
  ['gpt-oss', 'openwebui', 'medium', {'temperature':0.7,'top_p':1,'reasoning_effort':'medium','max_tokens':2048}],
  ['gpt-oss', 'unknown', 'off', {'temperature':0.7,'top_p':1,'reasoning_effort':'minimal','max_tokens':1024}],
  ['gpt-oss', 'unknown', 'medium', {'temperature':0.7,'top_p':1,'reasoning_effort':'medium','max_tokens':2048}],
  [null, 'lmstudio', 'off', {'temperature':0.7,'reasoning_effort':'none','max_tokens':1024}],
  [null, 'lmstudio', 'medium', {'temperature':0.7,'reasoning_effort':'medium','max_tokens':1024}],
  [null, 'openwebui', 'off', {'temperature':0.7,'reasoning_effort':'none','max_tokens':1024}],
  [null, 'openwebui', 'medium', {'temperature':0.7,'reasoning_effort':'medium','max_tokens':1024}],
  [null, 'unknown', 'off', {'temperature':0.7,'max_tokens':1024}],
];

const BODY_ONLY = new Set(['model', 'messages', 'stream', 'stream_options']);
const paramsOf = (body: Record<string, any>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(body).filter(([k]) => !BODY_ONLY.has(k)));

async function ask(opts: {
  model: string; backend: BackendId; thinking?: ThinkingLevel; overrides?: Record<string, number>;
}) {
  const plugin = await makePlugin();
  const { transport, sent } = recordingTransport([sse('ok')]);
  useTransport(plugin, transport, {}, opts.backend);
  const s = plugin.data.settings;
  s.chatEndpoints = [{ url: 'http://lokal:1234', model: opts.model }];
  if (opts.thinking) s.request.thinking = { companion: opts.thinking };
  if (opts.overrides) s.request.overrides = { companion: { [opts.model.startsWith('qwen3.6') ? 'qwen3.6' : 'unknown']: opts.overrides } };
  const res = await plugin.llm.complete({ messages: [{ role: 'user', content: 'hallo' }] });
  return { res, sent, plugin };
}

describe('Verbindung — goldene Requests (Modus companion)', () => {
  it.each(EXPECTED)('Familie %s × Backend %s × Denken %s', async (family, backend, thinking, params) => {
    const { res, sent } = await ask({ model: family ? MODEL_OF[family] : 'mystery-model-7b', backend, thinking });
    expect(res.ok).toBe(true);
    expect(paramsOf(sent[0].body)).toEqual(params);
  });

  it('Überschreibung gewinnt vor Modus- und Familien-Wert', async () => {
    const { sent } = await ask({ model: 'qwen3.6-35b-a3b', backend: 'lmstudio', thinking: 'off', overrides: { temperature: 1.1 } });
    expect(sent[0].body.temperature).toBe(1.1);
  });

  // gpt-oss/harmony lehnt Thinking-Suppress-Felder mit HTTP 400 ab — auch mit Denken „aus“ dürfen sie nicht
  // im Body stehen; das entscheidet die Familien-Tabelle (`canTurnOff`).
  it('gpt-oss: Denken aus sendet keine Suppress-Felder (lehnt chat_template_kwargs/reasoning_budget ab)', async () => {
    const { sent } = await ask({ model: 'gpt-oss-20b', backend: 'lmstudio', thinking: 'off' });
    expect(sent[0].body).not.toHaveProperty('chat_template_kwargs');
    expect(sent[0].body).not.toHaveProperty('reasoning_budget');
    expect(sent[0].body.reasoning_effort).not.toBe('none');
  });
});

describe('Verbindung — was das Plugin dazutut', () => {
  it('sendet das Modell der lokalen Liste, den Stream und den Schlüssel als Bearer', async () => {
    const plugin = await makePlugin();
    const { transport, sent } = recordingTransport([sse('Hallo'), sse(' Welt')]);
    useTransport(plugin, transport);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1234/', apiKey: 'geheim', model: 'zeile' }];
    const tokens: string[] = [];
    const res = await plugin.llm.complete({ messages: [{ role: 'user', content: 'hallo' }] }, { onToken: (t: string) => tokens.push(t) });
    expect(res).toMatchObject({ ok: true, content: 'Hallo Welt', truncated: false });
    expect(tokens.join('')).toBe('Hallo Welt');
    expect(sent[0].url).toBe('http://lokal:1234/v1/chat/completions');
    expect(sent[0].body).toMatchObject({ model: 'zeile', stream: true });
    expect(sent[0].headers.Authorization).toBe('Bearer geheim');
  });

  it('zeigt Reasoning nie: kein onReasoning, Denkblock fehlt im sichtbaren Text', async () => {
    const plugin = await makePlugin();
    const { transport } = recordingTransport([sseReasoning('grübel'), sse('<think>mehr</think>Antwort')]);
    useTransport(plugin, transport);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    const tokens: string[] = [];
    const res = await plugin.llm.complete({ messages: [] }, { onToken: (t: string) => tokens.push(t) });
    expect(res).toMatchObject({ ok: true, content: 'Antwort' });
    expect(tokens.join('')).toBe('Antwort');
  });

  it('am Token-Limit mit Text: ok mit truncated-Flag', async () => {
    const plugin = await makePlugin();
    useTransport(plugin, recordingTransport([sse('abgeschn'), sseFinish('length')]).transport);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    expect(await plugin.llm.complete({ messages: [] })).toMatchObject({ ok: true, content: 'abgeschn', truncated: true });
  });

  it('am Token-Limit ohne Text: eigene Fehlerart „truncated“ (nicht als leere Antwort durchgereicht)', async () => {
    const plugin = await makePlugin();
    useTransport(plugin, recordingTransport([sseReasoning('nur gedacht'), sseFinish('length')]).transport);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    expect(await plugin.llm.complete({ messages: [] })).toMatchObject({ ok: false, kind: 'truncated' });
  });

  it('der Servertext einer abgelehnten Anfrage steht im Detail', async () => {
    const plugin = await makePlugin();
    useTransport(plugin, recordingTransport(['{"error":{"message":"model not loaded"}}'], 400).transport);
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    const res = await plugin.llm.complete({ messages: [] });
    expect(res).toMatchObject({ ok: false, kind: 'http' });
    if (!res.ok) expect(res.detail).toContain('model not loaded');
  });

  it('ohne Endpunkt: kind „no-endpoint“ mit Grund', async () => {
    const plugin = await makePlugin();
    useTransport(plugin, recordingTransport([]).transport);
    const res = await plugin.llm.complete({ messages: [] });
    expect(res).toMatchObject({ ok: false, kind: 'no-endpoint' });
  });

  it('Schwärzung: ein Bearer-Token geht als Platzhalter hinaus und kommt im Ergebnis im Original zurück', async () => {
    const plugin = await makePlugin();
    const token = 'Bearer abcdefghijklmnop1234567890';
    // Der Fake-Endpunkt spiegelt den empfangenen Nutzertext in die Antwort.
    const sent: Record<string, any>[] = [];
    useTransport(plugin, {
      async postStream(_u, body, _h, onChunk) {
        sent.push(body as Record<string, any>);
        const last = (body as any).messages.at(-1).content as string;
        onChunk(sse(`echo: ${last}`));
        return 200;
      },
    });
    plugin.data.settings.chatEndpoints = [{ url: 'http://lokal:1' }];
    const res = await plugin.llm.complete({ messages: [{ role: 'user', content: `mein ${token} bitte` }] });
    expect(JSON.stringify(sent[0])).not.toContain('abcdefghijklmnop1234567890');
    expect(res.ok && res.content).toContain('abcdefghijklmnop1234567890');
  });

  it('persist() schreibt die Zuordnung synchron in die chat…-Felder', async () => {
    const plugin = await makePlugin();
    const saved: unknown[] = [];
    plugin.persist = async () => { saved.push(JSON.stringify(plugin.data.settings.chatEndpoints)); };
    const { kuroConnectionOptions } = await import('../src/llm/kuroConnection');
    const opts = kuroConnectionOptions({ app: plugin.app, pluginId: 'x', settings: () => plugin.data.settings, persist: () => plugin.persist() });
    const p = opts.persist({ endpoints: [{ url: 'http://neu:1' }], choice: { endpointId: 'e' } });
    expect(plugin.data.settings.chatEndpoints).toEqual([{ url: 'http://neu:1' }]);
    expect(plugin.data.settings.chatChoice).toEqual({ endpointId: 'e' });
    await p;
    expect(saved).toHaveLength(1);
  });
});
