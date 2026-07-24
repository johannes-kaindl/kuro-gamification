/* ==========================================================
   SubmissionGate — pure validation of manifest.json / LICENSE
   against the Obsidian Community store's submission checks.
   No Obsidian imports. Node-testable. Issues carry stable
   `code`s (like PackValidator); a non-empty result = a gate
   failure the community bot would also reject on.

   WHY THIS EXISTS (LESSONS.md, apple-health 2026-07-20):
   `biome check .` never looks at manifest.json or LICENSE —
   exactly the files the store bot rejects on. Every sibling
   plugin gets this coverage from eslint-plugin-obsidianmd's
   `validate-manifest` / `validate-license`; kuro is biome-only,
   so it needs an equivalent gate. The `submission-gate.test.ts`
   guard runs the real shipped files through this, so a broken
   manifest fails `npm test` (exit != 0), not only the bot.

   CALIBRATION vs. the raw obsidianmd rules (deliberate; sibling
   plugins likewise dial back over-strict obsidianmd rules, e.g.
   `ui/sentence-case`):
     - Forbidden words `obsidian`/`plugin` are enforced on `name`
       and `id` only (the hard Obsidian guideline), NOT on
       `description` — countless shipped plugins say "for Obsidian"
       in their description and the real review does not reject it.
     - The description charset check (raw rule forbids anything
       outside [A-Za-z0-9\s.,!?'"-], i.e. bans em-dash & emoji) is
       DROPPED — the real review accepts an em-dash. Length,
       leading-capital and trailing-period checks are kept.
     - Duplicate-key detection is intentionally omitted: this gate
       validates a JSON.parse'd object (dupes already collapsed),
       not the raw AST. Hand-maintained manifests don't dupe keys.
   ========================================================== */

export interface GateIssue {
  /** Which manifest key / location the issue is about ('' = whole doc). */
  path: string;
  /** Stable code; UI (if ever surfaced) maps to i18n key `submission.<code>`. */
  code: string;
  vars?: Record<string, string | number>;
}

/** Required keys and their JSON type. */
const REQUIRED: Record<string, 'string' | 'boolean'> = {
  id: 'string',
  name: 'string',
  version: 'string',
  minAppVersion: 'string',
  description: 'string',
  author: 'string',
  isDesktopOnly: 'boolean',
};

/** Optional keys and their allowed type(s). */
const OPTIONAL: Record<string, ('string' | 'object')[]> = {
  authorUrl: ['string'],
  fundingUrl: ['string', 'object'],
};

const FORBIDDEN_WORDS = ['obsidian', 'plugin'];
/** Calibrated: forbidden words enforced on these keys only (not description). */
const FORBIDDEN_WORD_KEYS = ['name', 'id'];

function jsonType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v; // 'string' | 'boolean' | 'number' | 'object' | ...
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkFundingUrl(value: unknown, issues: GateIssue[]): void {
  if (typeof value === 'string') {
    if (value.length === 0) {
      issues.push({ path: 'fundingUrl', code: 'emptyFundingUrl' });
    }
    return;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      issues.push({ path: 'fundingUrl', code: 'emptyFundingUrl' });
      return;
    }
    for (const [k, v] of entries) {
      if (typeof v !== 'string') {
        issues.push({ path: `fundingUrl.${k}`, code: 'invalidFundingUrl', vars: { key: k } });
      } else if (v.length === 0) {
        issues.push({ path: `fundingUrl.${k}`, code: 'emptyFundingUrl', vars: { key: k } });
      }
    }
  }
}

function checkDescription(value: string, issues: GateIssue[]): void {
  if (value.length < 10 || value.length > 250) {
    issues.push({ path: 'description', code: 'descriptionLength', vars: { length: value.length } });
  }
  if (!/^[A-Z]/.test(value)) {
    issues.push({ path: 'description', code: 'descriptionCapital' });
  }
  if (!value.endsWith('.')) {
    issues.push({ path: 'description', code: 'descriptionPeriod' });
  }
  // NB: charset check deliberately omitted — see CALIBRATION header.
}

function checkForbiddenWords(key: string, value: string, issues: GateIssue[]): void {
  if (!FORBIDDEN_WORD_KEYS.includes(key)) return;
  const lower = value.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lower.includes(word)) {
      issues.push({ path: key, code: 'forbiddenWord', vars: { key, word } });
    }
  }
}

export function validateManifest(raw: unknown): GateIssue[] {
  if (!isPlainObject(raw)) {
    return [{ path: '', code: 'notObject' }];
  }
  const issues: GateIssue[] = [];
  const allowed = { ...REQUIRED, ...OPTIONAL };

  // Missing required keys.
  for (const key of Object.keys(REQUIRED)) {
    if (!(key in raw)) {
      issues.push({ path: key, code: 'missingKey', vars: { key } });
    }
  }

  // Present keys: disallowed / wrong type / per-field rules.
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in allowed)) {
      issues.push({ path: key, code: 'disallowedKey', vars: { key } });
      continue;
    }
    const expected: string[] = key in REQUIRED ? [REQUIRED[key]] : OPTIONAL[key];
    const actual = jsonType(value);
    if (!expected.includes(actual)) {
      issues.push({
        path: key,
        code: 'invalidType',
        vars: { key, expected: expected.join(' or '), actual },
      });
      continue;
    }
    if (key === 'fundingUrl') {
      checkFundingUrl(value, issues);
    } else if (typeof value === 'string') {
      checkForbiddenWords(key, value, issues);
      if (key === 'description') checkDescription(value, issues);
    }
  }

  return issues;
}

export interface LicenseOpts {
  /** Current year to validate the copyright year against. */
  currentYear?: number;
}

// e.g. "Copyright (C) 2020-2025 by Dynalist Inc."
const COPYRIGHT_RE = /^[ \t]*Copyright \(C\) (\d{4})(?:-(\d{4}))? by (.+)$/;

export function validateLicense(text: string, opts: LicenseOpts = {}): GateIssue[] {
  const issues: GateIssue[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(COPYRIGHT_RE);
    if (!m) continue;
    const endYear = m[2] ? Number.parseInt(m[2], 10) : Number.parseInt(m[1], 10);
    const holder = m[3].trim();
    if (holder === 'Dynalist Inc.') {
      issues.push({ path: 'LICENSE', code: 'licenseUnchangedHolder' });
    }
    if (opts.currentYear !== undefined && endYear < opts.currentYear) {
      issues.push({
        path: 'LICENSE',
        code: 'licenseStaleYear',
        vars: { actual: endYear, expected: opts.currentYear },
      });
    }
  }
  return issues;
}
