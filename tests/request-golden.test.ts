/* Goldene Requests des Plugins (Rezept 8): erzeugt über den Wrapper `buildKuroParams` (fester
   Modus companion, Budget 1024), nicht über `resolveRequestParams` direkt — sonst prüfte der Test
   das Kit statt das Plugin. Die Werte stehen hier als Tabelle (abgelesen aus der code-kit-Tabelle
   sampling-profiles, Stand Kit 0.7.0): eine Änderung dort bricht diesen Test sichtbar.
   Modus companion = Temperatur 0.7, Denken-Default aus; mit Denken hebt die Familie das Budget
   auf ihre Reserve (2048), wo eine Reserve bekannt ist. */
import { buildKuroParams } from '../src/llm/kuroChat';
import type { BackendId, FamilyId, ThinkingLevel } from '../src/vendor/kit/sampling-profiles';

type Row = [FamilyId | null, BackendId, ThinkingLevel, Record<string, number | string>];

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
  ['gemma4', 'lmstudio', 'off', {'temperature':0.7,'top_p':0.95,'top_k':64,'reasoning_effort':'none','max_tokens':1024}],
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
  [null, 'unknown', 'medium', {'temperature':0.7,'max_tokens':1024}],
];

describe('buildKuroParams — goldene Requests (Modus companion)', () => {
  it.each(EXPECTED)('Familie %s × Backend %s × Denken %s', (family, backend, thinking, params) => {
    expect(buildKuroParams({ family, backend, thinking }).params).toEqual(params);
  });

  it('Überschreibung gewinnt vor Modus- und Familien-Wert', () => {
    const { params } = buildKuroParams({ family: 'qwen3.6', backend: 'lmstudio', thinking: 'off', overrides: { temperature: 1.1 } });
    expect(params.temperature).toBe(1.1);
  });

  // gpt-oss/harmony lehnt Thinking-Suppress-Felder mit HTTP 400 ab — auch mit Denken „aus“
  // dürfen sie nicht im Body stehen (früher `effectiveSuppress`, jetzt die Familien-Tabelle).
  it('gpt-oss: Denken aus sendet keine Suppress-Felder (lehnt chat_template_kwargs/reasoning_budget ab)', () => {
    const { params } = buildKuroParams({ family: 'gpt-oss', backend: 'lmstudio', thinking: 'off' });
    expect(params).not.toHaveProperty('chat_template_kwargs');
    expect(params).not.toHaveProperty('reasoning_budget');
    expect(params.reasoning_effort).not.toBe('none');
  });
});
