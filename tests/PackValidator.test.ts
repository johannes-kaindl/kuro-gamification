import { validatePack } from '../src/engine/PackValidator';

describe('validatePack — errors', () => {
  it('rejects a non-object', () => {
    const r = validatePack(42);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'notObject')).toBe(true);
  });

  it('rejects a missing kuroPack version', () => {
    const r = validatePack({ lore: [{ level: 1, title: 'A', text: 'b' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'missingVersion')).toBe(true);
  });

  it('rejects an empty pack (no loot, no lore)', () => {
    const r = validatePack({ kuroPack: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'emptyPack')).toBe(true);
  });

  it('rejects an unknown loot tier with a suggestion', () => {
    const r = validatePack({ kuroPack: 1, loot: { epc: [{ name: 'x', cat: 'y' }] } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.errors.find((e) => e.code === 'unknownTier');
      expect(issue).toBeDefined();
      expect(issue?.vars?.tier).toBe('epc');
    }
  });

  it('rejects a loot item without name/cat', () => {
    const r = validatePack({ kuroPack: 1, loot: { common: [{ name: 'x' }] } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'lootItemInvalid')).toBe(true);
  });

  it('rejects a lore fragment with wrong field types', () => {
    const r = validatePack({ kuroPack: 1, lore: [{ level: 'one', title: 'A', text: 'b' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'loreItemInvalid')).toBe(true);
  });
});

describe('validatePack — success & warnings', () => {
  const fullLore = Array.from({ length: 10 }, (_, i) => ({ level: i + 1, title: `T${i + 1}`, text: 'x' }));

  it('accepts a valid lore-only pack with full coverage (no warnings)', () => {
    const r = validatePack({ kuroPack: 1, lore: fullLore }, { loreLevels: fullLore.map((f) => f.level) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });

  it('accepts a valid loot-only pack', () => {
    const r = validatePack({ kuroPack: 1, loot: { common: [{ name: 'x', cat: 'y' }] } });
    expect(r.ok).toBe(true);
  });

  it('warns when loot omits tiers (they fall back to defaults)', () => {
    const r = validatePack({ kuroPack: 1, loot: { common: [{ name: 'x', cat: 'y' }] } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.some((w) => w.code === 'lootTierUsesDefault')).toBe(true);
  });

  it('warns when lore does not cover all configured levels', () => {
    const r = validatePack({ kuroPack: 1, lore: [{ level: 1, title: 'A', text: 'b' }] }, { loreLevels: [1, 2, 3] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.some((w) => w.code === 'loreIncompleteCoverage')).toBe(true);
  });
});

describe('PackValidator — habits section', () => {
  it('accepts a habits-only pack', () => {
    const r = validatePack({ kuroPack: 1, habits: [{ key: 'x', label: 'X', xp: 5 }] });
    expect(r.ok).toBe(true);
  });
  it('rejects habits that is not an array', () => {
    const r = validatePack({ kuroPack: 1, habits: 'nope' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'habitsNotArray')).toBe(true);
  });
  it('rejects a malformed habit item', () => {
    const r = validatePack({ kuroPack: 1, habits: [{ key: 'x', label: 'X' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'habitItemInvalid')).toBe(true);
  });
  it('rejects a pack with no content sections at all', () => {
    const r = validatePack({ kuroPack: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'emptyPack')).toBe(true);
  });
});

describe('validatePack — persona', () => {
  const withLore = { kuroPack: 1, lore: [{ level: 1, title: 'A', text: 'b' }] };

  it('accepts a pack without persona', () => {
    expect(validatePack(withLore).ok).toBe(true);
  });

  it('accepts a string persona', () => {
    expect(validatePack({ ...withLore, persona: 'Sprich ruhig.' }).ok).toBe(true);
  });

  it('rejects a non-string persona', () => {
    const r = validatePack({ ...withLore, persona: 42 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'personaNotString')).toBe(true);
  });

  it('rejects an over-long persona', () => {
    const r = validatePack({ ...withLore, persona: 'x'.repeat(2001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'personaTooLong')).toBe(true);
  });

  it('accepts a persona exactly at the limit', () => {
    expect(validatePack({ ...withLore, persona: 'x'.repeat(2000) }).ok).toBe(true);
  });

  it('does not make persona alone a valid pack', () => {
    // persona ist ein Zusatzfeld, kein Inhalt — emptyPack bleibt unverändert.
    const r = validatePack({ kuroPack: 1, persona: 'Nur eine Stimme' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'emptyPack')).toBe(true);
  });
});
