/* ==========================================================
   SubmissionGate — reproduces the Obsidian Community store's
   manifest.json / LICENSE checks locally, so a broken manifest
   fails `npm test` (exit != 0) instead of only at the store bot.

   Ported from eslint-plugin-obsidianmd's `validate-manifest` /
   `validate-license`, but CALIBRATED (see SubmissionGate.ts):
   forbidden-word check on name+id only; description charset check
   dropped (em-dash & common punctuation allowed). Structure stays
   strict.  Lesson: apple-health 2026-07-20 (LESSONS.md).
   ========================================================== */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateLicense, validateManifest } from '../src/engine/SubmissionGate';

// A minimal manifest that must pass the gate.
const VALID = {
  id: 'kuro-gamification',
  name: 'Kuro Gamification',
  version: '1.0.0',
  minAppVersion: '1.5.0',
  description: 'Neurodivergence-friendly gamification for your notes.',
  author: 'Jay',
  isDesktopOnly: false,
};

function codes(issues: { code: string }[]): string[] {
  return issues.map((i) => i.code);
}

describe('validateManifest — structure (strict)', () => {
  test('a valid manifest produces no issues', () => {
    expect(validateManifest(VALID)).toEqual([]);
  });

  test('rejects a non-object root', () => {
    expect(codes(validateManifest('nope'))).toContain('notObject');
    expect(codes(validateManifest(['array']))).toContain('notObject');
    expect(codes(validateManifest(null))).toContain('notObject');
  });

  test('reports each missing required key', () => {
    const { description, ...noDesc } = VALID;
    const issues = validateManifest(noDesc);
    expect(codes(issues)).toContain('missingKey');
    expect(issues.find((i) => i.code === 'missingKey')?.vars?.key).toBe('description');
  });

  test('rejects a key that is not in the allowed schema', () => {
    const issues = validateManifest({ ...VALID, wobble: true });
    const dis = issues.find((i) => i.code === 'disallowedKey');
    expect(dis?.vars?.key).toBe('wobble');
  });

  test('allows the optional keys authorUrl and fundingUrl', () => {
    const ok = validateManifest({
      ...VALID,
      authorUrl: 'https://github.com/v6t2b9',
      fundingUrl: 'https://ko-fi.com/x',
    });
    expect(ok).toEqual([]);
  });

  test('rejects a required key of the wrong type', () => {
    const issues = validateManifest({ ...VALID, isDesktopOnly: 'false' });
    const t = issues.find((i) => i.code === 'invalidType');
    expect(t?.vars?.key).toBe('isDesktopOnly');
    expect(t?.vars?.expected).toBe('boolean');
    expect(t?.vars?.actual).toBe('string');
  });
});

describe('validateManifest — fundingUrl', () => {
  test('rejects an empty fundingUrl string (kuro`s current bug)', () => {
    expect(codes(validateManifest({ ...VALID, fundingUrl: '' }))).toContain('emptyFundingUrl');
  });

  test('rejects an empty fundingUrl object', () => {
    expect(codes(validateManifest({ ...VALID, fundingUrl: {} }))).toContain('emptyFundingUrl');
  });

  test('rejects a fundingUrl object with a non-string value', () => {
    const issues = validateManifest({ ...VALID, fundingUrl: { ko: 123 } });
    expect(codes(issues)).toContain('invalidFundingUrl');
  });

  test('accepts a well-formed fundingUrl object', () => {
    expect(validateManifest({ ...VALID, fundingUrl: { 'Buy Me a Coffee': 'https://x' } })).toEqual(
      [],
    );
  });
});

describe('validateManifest — forbidden words (calibrated: name + id only)', () => {
  test('rejects "Obsidian" in the plugin name', () => {
    const issues = validateManifest({ ...VALID, name: 'Obsidian Kuro' });
    const f = issues.find((i) => i.code === 'forbiddenWord');
    expect(f?.vars?.key).toBe('name');
    expect(f?.vars?.word).toBe('obsidian');
  });

  test('rejects "plugin" in the id', () => {
    const issues = validateManifest({ ...VALID, id: 'kuro-plugin' });
    const f = issues.find((i) => i.code === 'forbiddenWord');
    expect(f?.vars?.key).toBe('id');
  });

  test('CALIBRATION: allows "Obsidian" inside the description', () => {
    // The raw obsidianmd rule flags this; the real community review does not.
    const issues = validateManifest({
      ...VALID,
      description: 'Gamification for Obsidian to keep you going.',
    });
    expect(codes(issues)).not.toContain('forbiddenWord');
  });
});

describe('validateManifest — description', () => {
  test('rejects a description shorter than 10 characters', () => {
    expect(codes(validateManifest({ ...VALID, description: 'Short.' }))).toContain(
      'descriptionLength',
    );
  });

  test('rejects a description longer than 250 characters', () => {
    const long = `${'A very long sentence. '.repeat(20)}End.`;
    expect(codes(validateManifest({ ...VALID, description: long }))).toContain('descriptionLength');
  });

  test('rejects a description that does not start with a capital letter', () => {
    expect(codes(validateManifest({ ...VALID, description: 'lowercase start here.' }))).toContain(
      'descriptionCapital',
    );
  });

  test('rejects a description that does not end with a period', () => {
    expect(codes(validateManifest({ ...VALID, description: 'No period at the end' }))).toContain(
      'descriptionPeriod',
    );
  });

  test('CALIBRATION: allows an em-dash and common punctuation in the description', () => {
    const issues = validateManifest({
      ...VALID,
      description: 'XP, levels, streaks — deterministic loot drops, and lore.',
    });
    expect(issues).toEqual([]);
  });
});

describe('validateLicense', () => {
  test('flags the unchanged sample-plugin copyright holder', () => {
    const text = 'MIT License\n\nCopyright (C) 2024 by Dynalist Inc.\n\nPermission...';
    expect(codes(validateLicense(text))).toContain('licenseUnchangedHolder');
  });

  test('flags a stale copyright year against the current year', () => {
    const text = 'Copyright (C) 2020 by Jay Kaindl';
    const issues = validateLicense(text, { currentYear: 2026 });
    const y = issues.find((i) => i.code === 'licenseStaleYear');
    expect(y?.vars?.expected).toBe(2026);
  });

  test('a real AGPL license without a sample copyright line passes', () => {
    const text = 'GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3, 19 November 2007\n...';
    expect(validateLicense(text, { currentYear: 2026 })).toEqual([]);
  });
});

describe('the real shipped files pass the gate (the actual guard)', () => {
  const srcRoot = join(__dirname, '..');

  test('40_src/manifest.json passes validateManifest', () => {
    const manifest = JSON.parse(readFileSync(join(srcRoot, 'manifest.json'), 'utf8'));
    expect(validateManifest(manifest)).toEqual([]);
  });

  test('40_src/LICENSE passes validateLicense', () => {
    const license = readFileSync(join(srcRoot, 'LICENSE'), 'utf8');
    expect(validateLicense(license, { currentYear: 2026 })).toEqual([]);
  });
});
