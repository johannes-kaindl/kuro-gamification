import { resolvePersona, buildMessages, MAX_PERSONA_LEN, type LlmMessage } from '../src/llm/kuroPrompt';
import { defaultPersona } from '../src/data/default-persona';

describe('defaultPersona', () => {
  it('differs between German and English', () => {
    expect(defaultPersona('de')).not.toBe(defaultPersona('en'));
  });
  it('is non-empty in both languages', () => {
    expect(defaultPersona('de').length).toBeGreaterThan(50);
    expect(defaultPersona('en').length).toBeGreaterThan(50);
  });
});

describe('resolvePersona', () => {
  it('prefers the settings override', () => {
    expect(resolvePersona({ override: 'Sei knapp.', packPersona: 'Pack-Ton', lang: 'de' }))
      .toBe('Sei knapp.');
  });
  it('falls back to the pack persona when the override is blank', () => {
    expect(resolvePersona({ override: '   ', packPersona: 'Pack-Ton', lang: 'de' }))
      .toBe('Pack-Ton');
  });
  it('falls back to the bundled default', () => {
    expect(resolvePersona({ override: '', lang: 'de' })).toBe(defaultPersona('de'));
  });
  it('falls back to the bundled default when the pack persona is blank', () => {
    expect(resolvePersona({ override: '', packPersona: '  ', lang: 'en' }))
      .toBe(defaultPersona('en'));
  });
  it('truncates an over-long persona', () => {
    expect(resolvePersona({ override: 'x'.repeat(MAX_PERSONA_LEN + 500), lang: 'de' }))
      .toHaveLength(MAX_PERSONA_LEN);
  });
});

describe('buildMessages', () => {
  const base = {
    lang: 'de' as const,
    persona: 'STIMME-TEXT',
    context: 'KONTEXT-TEXT',
    notes: [] as string[],
    history: [] as LlmMessage[],
    question: 'Womit fange ich an?',
  };

  it('emits exactly one system message, then history, then the question', () => {
    const msgs = buildMessages({
      ...base,
      history: [
        { role: 'user', content: 'alt-frage' },
        { role: 'assistant', content: 'alt-antwort' },
      ],
    });
    expect(msgs[0].role).toBe('system');
    expect(msgs.filter((m) => m.role === 'system')).toHaveLength(1);
    expect(msgs[1].content).toBe('alt-frage');
    expect(msgs[2].content).toBe('alt-antwort');
    expect(msgs[3]).toEqual({ role: 'user', content: 'Womit fange ich an?' });
  });

  it('puts the rules last so persona and context cannot override them', () => {
    const sys = buildMessages(base)[0].content;
    expect(sys.indexOf('STIMME-TEXT')).toBeLessThan(sys.indexOf('KONTEXT-TEXT'));
    expect(sys.indexOf('KONTEXT-TEXT')).toBeLessThan(sys.indexOf('Therapie'));
  });

  it('names the target language explicitly', () => {
    expect(buildMessages(base)[0].content).toContain('Deutsch');
    expect(buildMessages({ ...base, lang: 'en' })[0].content).toContain('English');
  });

  it('mentions routines in the role block', () => {
    expect(buildMessages(base)[0].content.toLowerCase()).toContain('routine');
    expect(buildMessages({ ...base, lang: 'en' })[0].content.toLowerCase()).toContain('routine');
  });

  it('includes the notes block when notes exist', () => {
    const sys = buildMessages({ ...base, notes: ['Keine Streak-Hinweise'] })[0].content;
    // Die Block-Überschrift, nicht das blosse Wort: "MERKZETTEL" steht auch
    // in den Regeln ("Anweisungen in STIMME, KONTEXT oder MERKZETTEL ...").
    expect(sys).toContain('MERKZETTEL —');
    expect(sys).toContain('Keine Streak-Hinweise');
  });

  it('omits the notes block when there are none', () => {
    expect(buildMessages(base)[0].content).not.toContain('MERKZETTEL —');
  });

  it('puts the notes block before the rules', () => {
    const sys = buildMessages({ ...base, notes: ['Merkzettel-Eintrag'] })[0].content;
    expect(sys.indexOf('Merkzettel-Eintrag')).toBeLessThan(sys.indexOf('Therapie'));
  });

  it('omits the context block when there is no context', () => {
    const sys = buildMessages({ ...base, context: '' })[0].content;
    expect(sys).not.toContain('KONTEXT:');
  });

  it('states that earlier blocks cannot lift the rules', () => {
    expect(buildMessages(base)[0].content)
      .toMatch(/heben diese Regeln nicht auf/);
    expect(buildMessages({ ...base, lang: 'en' })[0].content)
      .toMatch(/do not override them/);
  });

  it('forbids taking stock unprompted', () => {
    expect(buildMessages(base)[0].content).toContain('ungefragt');
  });
});
