# Public-Adoption-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kuro Gamification genuinely usable by *other* neurodivergent people before the Obsidian-community submission — via LLM-assisted custom loot/lore packs, lightweight onboarding, and bilingual documentation.

**Architecture:** A pure-function `PackValidator` (no Obsidian imports, Node-testable, fits the existing engine pattern) validates a small `KuroPack` JSON and `applyPack` merges it surgically into `settings.customLootPool` / `settings.customLore` — leaving XP/progress untouched. A dedicated `PackIoModal` (separate from the existing full-state backup `DataIoModal`) wraps it with a template picker over bundled example packs. Onboarding is a one-time `WelcomeModal` + a guided sidebar empty-state. Documentation gets EN+DE parity plus a customization guide with ready-made LLM prompts.

**Tech Stack:** TypeScript (Obsidian plugin), esbuild, jest (ts-jest, node env), biome. 0 runtime deps. Working dir for all `npm` commands: `40_src/`.

**Spec:** `docs/superpowers/specs/2026-06-15-public-adoption-readiness-design.md`

**Commit convention:** Every commit message must end with the trailer
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (omitted from the per-step examples below for brevity).

**Verification reality:** This codebase unit-tests only pure logic (`tests/*.test.ts` → engines, DataStore, utils, i18n). UI (modals/views/settings) is verified via `npm run build` + `npm run lint` + manual smoke. Tasks reflect that split: pure logic = TDD; UI = build/lint/manual.

---

## File Structure

**Create:**
- `40_src/src/engine/PackValidator.ts` — pure `validatePack()` + `applyPack()` + `PackIssue`/`PackValidation` types.
- `40_src/src/data/example-packs.ts` — bundled `EXAMPLE_PACKS` (Gothic/Plain/Cozy), lore-only.
- `40_src/src/modals/PackIoModal.ts` — `ImportPackModal` + `ExportPackModal`.
- `40_src/src/modals/WelcomeModal.ts` — one-time onboarding modal.
- `40_src/tests/PackValidator.test.ts` — validator + applyPack tests.
- `40_src/tests/example-packs.test.ts` — integrity: every bundled pack validates clean.
- `40_src/docs/customization.de.md`, `customization.en.md` — pack schema + LLM prompts + walkthrough.
- `40_src/docs/getting-started.de.md`, `getting-started.en.md` — install → first XP → first loot.
- `40_src/docs/philosophy.de.md`, `philosophy.en.md` — consolidated "why".
- `40_src/docs/manual.en.md` — English peer of `manual.de.md`.

**Modify:**
- `40_src/src/types.ts` — add `KuroPack`; add `onboardingShown` to `KuroPluginData` + `DEFAULT_PLUGIN_DATA`; bump `schemaVersion` to `2`.
- `40_src/src/persistence/DataStore.ts` — `migrate()` onboarding guard for upgraders.
- `40_src/tests/DataStore.test.ts` — update schemaVersion assertion; add onboarding-guard tests.
- `40_src/src/i18n/en.ts`, `40_src/src/i18n/de.ts` — new keys (commands, pack modal, issue codes, welcome, empty-state).
- `40_src/src/commands/registerCommands.ts` — `import-pack` / `export-pack` commands.
- `40_src/src/settings/SettingsTab.ts` — pack import/export buttons in `_renderLootLore`.
- `40_src/src/main.ts` — open `WelcomeModal` on first run.
- `40_src/src/views/KuroSidebarView.ts` — guided empty-state.
- `40_src/README.md`, `40_src/README.de.md` — link the new docs.

---

## Task 1: Data model — `KuroPack` type, `onboardingShown`, schemaVersion bump

**Files:**
- Modify: `40_src/src/types.ts`

- [ ] **Step 1: Add the `KuroPack` interface**

In `40_src/src/types.ts`, directly after the `KuroLoreFragment` interface (currently ends at line 34), add:

```ts
/** A shareable, LLM-friendly customization pack. Both content fields optional. */
export interface KuroPack {
  /** Pack format version. */
  kuroPack: number;
  /** Optional human label. */
  name?: string;
  /** Maps onto KuroSettings.customLootPool (per-tier merge with defaults). */
  loot?: Partial<Record<KuroLootTier, KuroLootDrop[]>>;
  /** Maps onto KuroSettings.customLore (replaces default lore wholesale). */
  lore?: KuroLoreFragment[];
}
```

- [ ] **Step 2: Add `onboardingShown` to `KuroPluginData`**

In the `KuroPluginData` interface (line 117), add the field right after `schemaVersion`:

```ts
export interface KuroPluginData {
  schemaVersion: number;
  /** True once the first-run welcome modal has been shown (or for pre-v2 upgraders). */
  onboardingShown: boolean;
  redeemedDrops: KuroDropEntry[];
  // … rest unchanged …
```

- [ ] **Step 3: Update `DEFAULT_PLUGIN_DATA` (bump schemaVersion, add onboardingShown)**

Change the `DEFAULT_PLUGIN_DATA` block (line 220) to:

```ts
export const DEFAULT_PLUGIN_DATA: KuroPluginData = {
  schemaVersion: 2,
  onboardingShown: false,
  redeemedDrops: [],
  freezeTokens: 2,
  freezeTokensLastRegen: '',
  manualXpAdjustments: [],
  unlockedLore: [],
  lastSnapshot: null,
  settings: DEFAULT_SETTINGS,
};
```

- [ ] **Step 4: Verify it compiles**

Run: `cd 40_src && npm run typecheck`
Expected: PASS (no errors). `KuroPack` is exported and `onboardingShown` is required on `KuroPluginData`.

- [ ] **Step 5: Commit**

```bash
cd 40_src && git add src/types.ts
git commit -m "feat(types): add KuroPack + onboardingShown, bump schemaVersion to 2"
```

---

## Task 2: `validatePack()` — pure validation (TDD)

**Files:**
- Create: `40_src/src/engine/PackValidator.ts`
- Test: `40_src/tests/PackValidator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `40_src/tests/PackValidator.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd 40_src && npx jest tests/PackValidator.test.ts`
Expected: FAIL — `Cannot find module '../src/engine/PackValidator'`.

- [ ] **Step 3: Write the implementation**

Create `40_src/src/engine/PackValidator.ts`:

```ts
/* ==========================================================
   PackValidator — pure validation + apply for KuroPack.
   No Obsidian imports. Node-testable. Issues carry stable
   `code`s; the UI layer localizes them via i18n.
   ========================================================== */
import type { KuroLootTier, KuroPack } from '../types';

export interface PackIssue {
  /** Dotted path into the pack, e.g. "loot.epc" or "lore[2].title". */
  path: string;
  /** Stable code; UI maps to i18n key `pack.issue.<code>`. */
  code: string;
  vars?: Record<string, string | number>;
}

export type PackValidation =
  | { ok: true; pack: KuroPack; warnings: PackIssue[] }
  | { ok: false; errors: PackIssue[] };

export interface ValidateOpts {
  /** Configured level numbers; enables the lore-coverage warning when provided. */
  loreLevels?: number[];
}

const TIERS: KuroLootTier[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStr(v: unknown): v is string { return typeof v === 'string'; }

export function validatePack(raw: unknown, opts: ValidateOpts = {}): PackValidation {
  const errors: PackIssue[] = [];
  const warnings: PackIssue[] = [];

  if (!isObj(raw)) {
    return { ok: false, errors: [{ path: '', code: 'notObject' }] };
  }
  if (typeof raw.kuroPack !== 'number') {
    errors.push({ path: 'kuroPack', code: 'missingVersion' });
  }

  const hasLoot = raw.loot !== undefined;
  const hasLore = raw.lore !== undefined;
  if (!hasLoot && !hasLore) {
    errors.push({ path: '', code: 'emptyPack' });
  }

  // ── loot ──
  if (hasLoot) {
    if (!isObj(raw.loot)) {
      errors.push({ path: 'loot', code: 'lootNotObject' });
    } else {
      for (const [tier, items] of Object.entries(raw.loot)) {
        if (!TIERS.includes(tier as KuroLootTier)) {
          errors.push({ path: `loot.${tier}`, code: 'unknownTier', vars: { tier, allowed: TIERS.join(', ') } });
          continue;
        }
        if (!Array.isArray(items)) {
          errors.push({ path: `loot.${tier}`, code: 'tierNotArray', vars: { tier } });
          continue;
        }
        items.forEach((it, i) => {
          if (!isObj(it) || !isStr(it.name) || !isStr(it.cat)) {
            errors.push({ path: `loot.${tier}[${i}]`, code: 'lootItemInvalid', vars: { tier, index: i } });
          }
        });
      }
      const present = Object.keys(raw.loot).filter((t) => TIERS.includes(t as KuroLootTier));
      const missing = TIERS.filter((t) => !present.includes(t));
      if (missing.length > 0 && missing.length < TIERS.length) {
        warnings.push({ path: 'loot', code: 'lootTierUsesDefault', vars: { tiers: missing.join(', ') } });
      }
    }
  }

  // ── lore ──
  if (hasLore) {
    if (!Array.isArray(raw.lore)) {
      errors.push({ path: 'lore', code: 'loreNotArray' });
    } else {
      const seen = new Set<number>();
      raw.lore.forEach((f, i) => {
        if (!isObj(f) || typeof f.level !== 'number' || !isStr(f.title) || !isStr(f.text)) {
          errors.push({ path: `lore[${i}]`, code: 'loreItemInvalid', vars: { index: i } });
          return;
        }
        if (seen.has(f.level)) {
          errors.push({ path: `lore[${i}].level`, code: 'loreLevelDup', vars: { level: f.level } });
        }
        seen.add(f.level);
      });
      if (opts.loreLevels && opts.loreLevels.length > 0) {
        const missing = opts.loreLevels.filter((lv) => !seen.has(lv));
        if (missing.length > 0) {
          warnings.push({ path: 'lore', code: 'loreIncompleteCoverage', vars: { levels: missing.join(', ') } });
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  // Runtime-validated above; the double cast is required because `raw` is an index-signature object, not KuroPack.
  return { ok: true, pack: raw as unknown as KuroPack, warnings };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd 40_src && npx jest tests/PackValidator.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
cd 40_src && git add src/engine/PackValidator.ts tests/PackValidator.test.ts
git commit -m "feat(engine): add pure validatePack with localizable issue codes"
```

---

## Task 3: `applyPack()` — pure surgical merge into settings (TDD)

**Files:**
- Modify: `40_src/src/engine/PackValidator.ts`
- Modify: `40_src/tests/PackValidator.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `40_src/tests/PackValidator.test.ts`:

```ts
import { applyPack } from '../src/engine/PackValidator';
import { DEFAULT_SETTINGS } from '../src/types';

describe('applyPack', () => {
  it('sets customLootPool from pack.loot only', () => {
    const pack = { kuroPack: 1, loot: { common: [{ name: 'x', cat: 'y' }] } };
    const next = applyPack(DEFAULT_SETTINGS, pack);
    expect(next.customLootPool).toEqual(pack.loot);
    expect(next.customLore).toBe(DEFAULT_SETTINGS.customLore); // untouched
  });

  it('sets customLore from pack.lore only', () => {
    const lore = [{ level: 1, title: 'A', text: 'b' }];
    const next = applyPack(DEFAULT_SETTINGS, { kuroPack: 1, lore });
    expect(next.customLore).toEqual(lore);
    expect(next.customLootPool).toBe(DEFAULT_SETTINGS.customLootPool); // untouched
  });

  it('does not mutate the input settings', () => {
    const before = JSON.stringify(DEFAULT_SETTINGS);
    applyPack(DEFAULT_SETTINGS, { kuroPack: 1, lore: [{ level: 1, title: 'A', text: 'b' }] });
    expect(JSON.stringify(DEFAULT_SETTINGS)).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd 40_src && npx jest tests/PackValidator.test.ts -t applyPack`
Expected: FAIL — `applyPack is not a function`.

- [ ] **Step 3: Write the implementation**

First, extend the import at the top of `40_src/src/engine/PackValidator.ts` to add `KuroSettings`:

```ts
import type { KuroLootTier, KuroPack, KuroSettings } from '../types';
```

Then append to `40_src/src/engine/PackValidator.ts`:

```ts
/** Returns a NEW settings object with the pack's custom fields applied. Pure. */
export function applyPack(settings: KuroSettings, pack: KuroPack): KuroSettings {
  const next: KuroSettings = { ...settings };
  if (pack.loot !== undefined) next.customLootPool = pack.loot;
  if (pack.lore !== undefined) next.customLore = pack.lore;
  return next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd 40_src && npx jest tests/PackValidator.test.ts`
Expected: PASS (validator + applyPack all green).

- [ ] **Step 5: Commit**

```bash
cd 40_src && git add src/engine/PackValidator.ts tests/PackValidator.test.ts
git commit -m "feat(engine): add pure applyPack (surgical, non-mutating merge into settings)"
```

---

## Task 4: Bundled example packs (Gothic / Plain / Cozy) + integrity test

**Files:**
- Create: `40_src/src/data/example-packs.ts`
- Test: `40_src/tests/example-packs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `40_src/tests/example-packs.test.ts`:

```ts
import { EXAMPLE_PACKS } from '../src/data/example-packs';
import { validatePack } from '../src/engine/PackValidator';
import { DEFAULT_LEVELS } from '../src/data/default-levels';

describe('EXAMPLE_PACKS integrity', () => {
  const levels = DEFAULT_LEVELS.map((l) => l.level);

  it('ships at least gothic/plain/cozy', () => {
    const ids = EXAMPLE_PACKS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['gothic', 'plain', 'cozy']));
  });

  for (const ex of EXAMPLE_PACKS) {
    it(`pack "${ex.id}" validates with zero warnings against default levels`, () => {
      const r = validatePack(ex.pack, { loreLevels: levels });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd 40_src && npx jest tests/example-packs.test.ts`
Expected: FAIL — `Cannot find module '../src/data/example-packs'`.

- [ ] **Step 3: Write the implementation**

Create `40_src/src/data/example-packs.ts`. The Gothic pack reuses `DEFAULT_LORE` (no duplication); Plain and Cozy are complete 10-level lore sets:

```ts
/* ==========================================================
   Bundled example theme-packs for the Import-Pack template
   picker. Lore-only (loot defaults are already generic).
   ========================================================== */
import type { KuroLoreFragment, KuroPack } from '../types';
import { DEFAULT_LORE } from './default-lore';

export interface ExamplePack {
  id: string;
  label: string;
  pack: KuroPack;
}

const PLAIN_LORE: KuroLoreFragment[] = [
  { level: 1,  title: 'FIRST LIGHT', text: 'You showed up. That alone counts today.' },
  { level: 2,  title: 'STEADY',      text: 'Two days. Steady beats fast.' },
  { level: 3,  title: 'ROOTS',       text: 'Three days in. Something is taking root.' },
  { level: 4,  title: 'FLOW',        text: "It's getting easier to begin." },
  { level: 5,  title: 'HALFWAY',     text: 'Halfway up. Look how far that is.' },
  { level: 6,  title: 'STRONGER',    text: 'The habit is carrying some of the weight now.' },
  { level: 7,  title: 'CLEAR',       text: 'You can see the shape of your days more clearly.' },
  { level: 8,  title: 'SOLID',       text: 'This is solid ground now, not a sprint.' },
  { level: 9,  title: 'ALMOST',      text: 'Almost at the top. No rush.' },
  { level: 10, title: 'ARRIVED',     text: 'You built this, one ordinary day at a time.' },
];

const COZY_LORE: KuroLoreFragment[] = [
  { level: 1,  title: 'THE KETTLE',    text: 'You put the kettle on. The day can start gently.' },
  { level: 2,  title: 'OPEN WINDOW',   text: 'A little fresh air, a little light. Good.' },
  { level: 3,  title: 'WARM CORNER',   text: "You've found your warm corner. Settle in." },
  { level: 4,  title: 'SLOW MORNING',  text: 'No hurry. The tea is still warm.' },
  { level: 5,  title: 'BLANKET FORT',  text: 'Halfway, wrapped in something soft.' },
  { level: 6,  title: 'GARDEN',        text: 'Small things are growing because you tended them.' },
  { level: 7,  title: 'LANTERN LIGHT', text: 'The evenings feel kinder now.' },
  { level: 8,  title: 'BREAD RISING',  text: 'Patience is doing its quiet work.' },
  { level: 9,  title: 'LAST CHAPTER',  text: 'Almost at the end of this cozy book.' },
  { level: 10, title: 'HEARTH',        text: 'Home. You made a warm place out of ordinary days.' },
];

export const EXAMPLE_PACKS: ExamplePack[] = [
  { id: 'gothic', label: 'Gothic-Cyberpunk (Default)', pack: { kuroPack: 1, name: 'Gothic-Cyberpunk', lore: DEFAULT_LORE } },
  { id: 'plain',  label: 'Plain / Calm',               pack: { kuroPack: 1, name: 'Plain / Calm',      lore: PLAIN_LORE } },
  { id: 'cozy',   label: 'Cozy',                        pack: { kuroPack: 1, name: 'Cozy',              lore: COZY_LORE } },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd 40_src && npx jest tests/example-packs.test.ts`
Expected: PASS. (Requires `DEFAULT_LEVELS` to define levels 1..10 — it does; gothic/plain/cozy each cover 1..10.)

- [ ] **Step 5: Commit**

```bash
cd 40_src && git add src/data/example-packs.ts tests/example-packs.test.ts
git commit -m "feat(data): bundle Gothic/Plain/Cozy example lore packs"
```

---

## Task 5: i18n keys (EN + DE) for pack modal, commands, issues, welcome, empty-state

**Files:**
- Modify: `40_src/src/i18n/en.ts`
- Modify: `40_src/src/i18n/de.ts`

No TDD (string maps). Verified by `npm run typecheck` + the existing `tests/i18n.test.ts` (key-parity check, if present).

- [ ] **Step 1: Add keys to `en.ts`**

In `40_src/src/i18n/en.ts`, insert before the closing `};` (after the `notice.noLore` line):

```ts
  // ── Pack import/export ──
  'cmd.importPack': 'Kuro: Import loot/lore pack (JSON)…',
  'cmd.exportPack': 'Kuro: Export current loot/lore as a pack (JSON)',
  'modal.pack.import.title': 'Import a loot/lore pack',
  'modal.pack.import.intro': 'Paste a pack JSON, or start from a built-in template. Your XP and progress are not touched.',
  'modal.pack.import.templates': 'Start from a template:',
  'modal.pack.import.apply': 'Import',
  'modal.pack.import.applyAnyway': 'Import anyway',
  'modal.pack.import.success': 'Pack imported.',
  'modal.pack.import.errorsHeading': 'This pack has problems — nothing was imported:',
  'modal.pack.import.warningsHeading': 'Heads up:',
  'modal.pack.import.parseError': 'That is not valid JSON: {err}',
  'modal.pack.export.title': 'Export as a pack',
  'modal.pack.export.intro': 'This is your current loot + lore as a shareable pack (defaults if you have no custom set).',
  'modal.pack.export.copy': 'Copy to clipboard',
  'modal.pack.export.copied': 'Copied to clipboard.',
  'modal.pack.cancel': 'Cancel',
  'modal.pack.close': 'Close',
  // pack validator issue codes (path is appended by the modal)
  'pack.issue.notObject': 'The pack must be a JSON object.',
  'pack.issue.missingVersion': 'Missing "kuroPack" version number.',
  'pack.issue.emptyPack': 'The pack has neither "loot" nor "lore".',
  'pack.issue.lootNotObject': '"loot" must be an object keyed by tier.',
  'pack.issue.unknownTier': 'Unknown loot tier "{tier}". Allowed: {allowed}.',
  'pack.issue.tierNotArray': 'Loot tier "{tier}" must be an array.',
  'pack.issue.lootItemInvalid': 'Loot item {index} in "{tier}" needs string "name" and "cat".',
  'pack.issue.loreNotArray': '"lore" must be an array.',
  'pack.issue.loreItemInvalid': 'Lore fragment {index} needs numeric "level" and string "title" + "text".',
  'pack.issue.loreLevelDup': 'Duplicate lore for level {level}.',
  'pack.issue.lootTierUsesDefault': 'Tiers not in this pack keep the built-in rewards: {tiers}.',
  'pack.issue.loreIncompleteCoverage': 'No lore for level(s) {levels} — those levels will show nothing.',
  // ── Onboarding ──
  'modal.welcome.title': 'Welcome to Kuro Gamification',
  'modal.welcome.intro': 'Turn your daily notes into a calm, off-by-default leveling game — XP, loot, streaks with freeze tokens, and lore. Three steps to your first XP:',
  'modal.welcome.step1': '1. Check the daily-notes folder in settings matches where your notes live.',
  'modal.welcome.step2': '2. Tick a checkbox in today\'s daily note.',
  'modal.welcome.step3': '3. Open the Kuro sidebar and hit Recompute — XP starts flowing.',
  'modal.welcome.openSettings': 'Open settings',
  'modal.welcome.close': 'Got it',
  'sidebar.empty.setup.title': "Let's get you set up",
  'sidebar.empty.setup.dailyFolder': 'Daily-notes folder: {path} — change it in settings if your notes live elsewhere.',
  'sidebar.empty.setup.xp': 'Make sure at least one XP source is on (checkboxes are on by default).',
  'sidebar.empty.setup.checkbox': 'Tick a checkbox in today\'s daily note, then hit Recompute (↻ above).',
  'sidebar.empty.setup.openSettings': 'Open Kuro settings',
```

- [ ] **Step 2: Add the same keys to `de.ts`**

In `40_src/src/i18n/de.ts`, insert the German values before the closing `};`:

```ts
  // ── Pack-Import/-Export ──
  'cmd.importPack': 'Kuro: Loot-/Lore-Pack importieren (JSON)…',
  'cmd.exportPack': 'Kuro: Aktuelles Loot/Lore als Pack exportieren (JSON)',
  'modal.pack.import.title': 'Loot-/Lore-Pack importieren',
  'modal.pack.import.intro': 'Füge ein Pack-JSON ein oder starte von einer Vorlage. Dein XP und Fortschritt bleiben unangetastet.',
  'modal.pack.import.templates': 'Von einer Vorlage starten:',
  'modal.pack.import.apply': 'Importieren',
  'modal.pack.import.applyAnyway': 'Trotzdem importieren',
  'modal.pack.import.success': 'Pack importiert.',
  'modal.pack.import.errorsHeading': 'Dieses Pack hat Probleme — es wurde nichts importiert:',
  'modal.pack.import.warningsHeading': 'Hinweis:',
  'modal.pack.import.parseError': 'Das ist kein gültiges JSON: {err}',
  'modal.pack.export.title': 'Als Pack exportieren',
  'modal.pack.export.intro': 'Dein aktuelles Loot + Lore als teilbares Pack (Defaults, falls kein eigenes Set gesetzt ist).',
  'modal.pack.export.copy': 'In die Zwischenablage',
  'modal.pack.export.copied': 'In die Zwischenablage kopiert.',
  'modal.pack.cancel': 'Abbrechen',
  'modal.pack.close': 'Schließen',
  'pack.issue.notObject': 'Das Pack muss ein JSON-Objekt sein.',
  'pack.issue.missingVersion': '„kuroPack"-Versionsnummer fehlt.',
  'pack.issue.emptyPack': 'Das Pack enthält weder „loot" noch „lore".',
  'pack.issue.lootNotObject': '„loot" muss ein nach Tier benanntes Objekt sein.',
  'pack.issue.unknownTier': 'Unbekanntes Loot-Tier „{tier}". Erlaubt: {allowed}.',
  'pack.issue.tierNotArray': 'Loot-Tier „{tier}" muss ein Array sein.',
  'pack.issue.lootItemInvalid': 'Loot-Eintrag {index} in „{tier}" braucht String-„name" und -„cat".',
  'pack.issue.loreNotArray': '„lore" muss ein Array sein.',
  'pack.issue.loreItemInvalid': 'Lore-Fragment {index} braucht numerisches „level" und String-„title" + „text".',
  'pack.issue.loreLevelDup': 'Doppelte Lore für Level {level}.',
  'pack.issue.lootTierUsesDefault': 'Nicht enthaltene Tiers behalten die Standard-Belohnungen: {tiers}.',
  'pack.issue.loreIncompleteCoverage': 'Keine Lore für Level {levels} — diese Level zeigen nichts an.',
  // ── Onboarding ──
  'modal.welcome.title': 'Willkommen bei Kuro Gamification',
  'modal.welcome.intro': 'Verwandle deine Daily Notes in ein ruhiges, off-by-default Level-Spiel — XP, Loot, Streaks mit Freeze-Tokens und Lore. Drei Schritte zum ersten XP:',
  'modal.welcome.step1': '1. Prüfe in den Einstellungen, ob der Daily-Notes-Ordner stimmt.',
  'modal.welcome.step2': '2. Hake eine Checkbox in der heutigen Daily Note ab.',
  'modal.welcome.step3': '3. Öffne die Kuro-Sidebar und klicke „Neu berechnen" — XP fließt.',
  'modal.welcome.openSettings': 'Einstellungen öffnen',
  'modal.welcome.close': 'Verstanden',
  'sidebar.empty.setup.title': 'Lass uns einrichten',
  'sidebar.empty.setup.dailyFolder': 'Daily-Notes-Ordner: {path} — in den Einstellungen ändern, falls deine Notizen woanders liegen.',
  'sidebar.empty.setup.xp': 'Mindestens eine XP-Quelle sollte an sein (Checkboxen sind standardmäßig an).',
  'sidebar.empty.setup.checkbox': 'Hake eine Checkbox in der heutigen Daily Note ab, dann „Neu berechnen" (↻ oben).',
  'sidebar.empty.setup.openSettings': 'Kuro-Einstellungen öffnen',
```

- [ ] **Step 3: Verify typecheck + existing i18n tests**

Run: `cd 40_src && npm run typecheck && npx jest tests/i18n.test.ts`
Expected: PASS. (If `tests/i18n.test.ts` asserts EN/DE key parity, both maps now have identical new keys.)

- [ ] **Step 4: Commit**

```bash
cd 40_src && git add src/i18n/en.ts src/i18n/de.ts
git commit -m "i18n: add pack/onboarding/empty-state keys (EN+DE)"
```

---

## Task 6: `PackIoModal` — Import (with template picker) + Export

**Files:**
- Create: `40_src/src/modals/PackIoModal.ts`

UI task — verified by `npm run build` + `npm run lint` + manual smoke (Task 11).

- [ ] **Step 1: Write the implementation**

Create `40_src/src/modals/PackIoModal.ts`:

```ts
/* ==========================================================
   PackIoModal — import/export a focused KuroPack (loot/lore).
   Separate from DataIoModal (full-state backup): this never
   touches XP/progress, only settings.customLootPool/customLore.
   ========================================================== */
import { Modal, type App, Notice } from 'obsidian';
import type KuroPlugin from '../main';
import { t } from '../i18n';
import { validatePack, applyPack, type PackIssue } from '../engine/PackValidator';
import { EXAMPLE_PACKS } from '../data/example-packs';
import { DEFAULT_LOOT_POOL } from '../data/default-loot-pool';
import { DEFAULT_LORE } from '../data/default-lore';
import type { KuroPack, Lang } from '../types';

export class ImportPackModal extends Modal {
  constructor(app: App, private readonly plugin: KuroPlugin) { super(app); }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.pack.import.title', lang));
    const c = this.contentEl;
    c.empty();
    c.createEl('p', { text: t('modal.pack.import.intro', lang) });

    // Template picker
    c.createEl('p', { text: t('modal.pack.import.templates', lang), cls: 'kuro-pack-templates-label' });
    const picker = c.createDiv({ cls: 'kuro-pack-templates' });
    const ta = c.createEl('textarea', { cls: 'kuro-data-io', attr: { rows: '14', spellcheck: 'false' } });
    for (const ex of EXAMPLE_PACKS) {
      const b = picker.createEl('button', { cls: 'kuro-btn', text: ex.label });
      b.addEventListener('click', () => { ta.value = JSON.stringify(ex.pack, null, 2); });
    }

    const msg = c.createDiv({ cls: 'kuro-pack-msg' });

    const footer = c.createDiv({ cls: 'kuro-modal-footer' });
    footer.createEl('button', { cls: 'kuro-btn', text: t('modal.pack.cancel', lang) })
      .addEventListener('click', () => this.close());
    const apply = footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.pack.import.apply', lang) });
    apply.addEventListener('click', () => this._tryApply(ta.value, msg, false));
  }

  private _tryApply(text: string, msg: HTMLElement, force: boolean): void {
    const lang = this.plugin.data.settings.language;
    msg.empty();
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch (err) {
      msg.createEl('p', { cls: 'kuro-pack-error', text: t('modal.pack.import.parseError', lang, { err: String(err) }) });
      return;
    }
    const levels = this.plugin.data.settings.levels.map((l) => l.level);
    const res = validatePack(parsed, { loreLevels: levels });
    if (!res.ok) {
      msg.createEl('p', { cls: 'kuro-pack-error', text: t('modal.pack.import.errorsHeading', lang) });
      const ul = msg.createEl('ul');
      for (const e of res.errors) ul.createEl('li', { text: this._fmt(e, lang) });
      return;
    }
    if (res.warnings.length > 0 && !force) {
      msg.createEl('p', { cls: 'kuro-pack-warn', text: t('modal.pack.import.warningsHeading', lang) });
      const ul = msg.createEl('ul');
      for (const w of res.warnings) ul.createEl('li', { text: this._fmt(w, lang) });
      const anyway = msg.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.pack.import.applyAnyway', lang) });
      anyway.addEventListener('click', () => this._tryApply(text, msg, true));
      return;
    }
    void this._commit(res.pack);
  }

  private async _commit(pack: KuroPack): Promise<void> {
    const lang = this.plugin.data.settings.language;
    this.plugin.data.settings = applyPack(this.plugin.data.settings, pack);
    await this.plugin.persist();
    await this.plugin.refreshStatus(true);
    if (this.plugin.data.settings.enableNotices) new Notice(t('modal.pack.import.success', lang));
    this.close();
  }

  private _fmt(issue: PackIssue, lang: Lang): string {
    const body = t(`pack.issue.${issue.code}`, lang, issue.vars ?? {});
    return issue.path ? `${issue.path}: ${body}` : body;
  }

  onClose(): void { this.contentEl.empty(); }
}

export class ExportPackModal extends Modal {
  constructor(app: App, private readonly plugin: KuroPlugin) { super(app); }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    const s = this.plugin.data.settings;
    this.titleEl.setText(t('modal.pack.export.title', lang));
    const c = this.contentEl;
    c.empty();
    c.createEl('p', { text: t('modal.pack.export.intro', lang) });

    const pack: KuroPack = {
      kuroPack: 1,
      name: 'My Kuro Pack',
      loot: s.customLootPool ?? DEFAULT_LOOT_POOL,
      lore: s.customLore ?? DEFAULT_LORE,
    };
    const ta = c.createEl('textarea', { cls: 'kuro-data-io', attr: { rows: '14', readonly: 'readonly', spellcheck: 'false' } });
    ta.value = JSON.stringify(pack, null, 2);

    const footer = c.createDiv({ cls: 'kuro-modal-footer' });
    const copy = footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.pack.export.copy', lang) });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ta.value); new Notice(t('modal.pack.export.copied', lang)); }
      catch { ta.select(); }
    });
    footer.createEl('button', { cls: 'kuro-btn', text: t('modal.pack.close', lang) })
      .addEventListener('click', () => this.close());
  }

  onClose(): void { this.contentEl.empty(); }
}
```

- [ ] **Step 2: Verify build + lint**

Run: `cd 40_src && npm run build && npm run lint`
Expected: PASS (tsc gate clean, esbuild bundles, biome no errors).

- [ ] **Step 3: Commit**

```bash
cd 40_src && git add src/modals/PackIoModal.ts
git commit -m "feat(modals): PackIoModal — import (with template picker) + export, progress-safe"
```

---

## Task 7: DataStore onboarding-guard for upgraders (TDD)

**Files:**
- Modify: `40_src/src/persistence/DataStore.ts`
- Modify: `40_src/tests/DataStore.test.ts`

- [ ] **Step 1: Update the existing assertion + write new failing tests**

In `40_src/tests/DataStore.test.ts`, change the line `expect(merged.schemaVersion).toBe(1);` (line 11) to:

```ts
    expect(merged.schemaVersion).toBe(2);
```

Then append a new describe block:

```ts
describe('DataStore.merge — onboarding guard', () => {
  const fakePlugin = { loadData: () => Promise.resolve(null), saveData: () => Promise.resolve() } as any;
  const ds = new DataStore(fakePlugin);

  it('new install onboards (onboardingShown=false, schemaVersion=2)', () => {
    const merged = ds.merge({});
    expect(merged.onboardingShown).toBe(false);
    expect(merged.schemaVersion).toBe(2);
  });

  it('pre-v2 upgrader is NOT onboarded (onboardingShown forced true, schemaVersion lifted to 2)', () => {
    const merged = ds.merge({ schemaVersion: 1, redeemedDrops: [{ date: '2026-01-01', level: 2, tier: 'common' as const, name: 'x', cat: 'y' }] });
    expect(merged.onboardingShown).toBe(true);
    expect(merged.schemaVersion).toBe(2);
  });

  it('keeps onboardingShown=true once already set', () => {
    const merged = ds.merge({ schemaVersion: 2, onboardingShown: true });
    expect(merged.onboardingShown).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd 40_src && npx jest tests/DataStore.test.ts`
Expected: FAIL — pre-v2 upgrader expects `onboardingShown === true` but migrate doesn't set it yet.

- [ ] **Step 3: Update `migrate()`**

In `40_src/src/persistence/DataStore.ts`, replace the `migrate` method (lines 52-56) with:

```ts
  private migrate(d: KuroPluginData): KuroPluginData {
    // Pre-v2 installs predate onboarding — don't pop the welcome modal for existing users.
    if (d.schemaVersion < 2) {
      d.onboardingShown = true;
      d.schemaVersion = 2;
    }
    return d;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd 40_src && npx jest tests/DataStore.test.ts`
Expected: PASS (all merge tests, including the new guard cases).

- [ ] **Step 5: Commit**

```bash
cd 40_src && git add src/persistence/DataStore.ts tests/DataStore.test.ts
git commit -m "feat(persistence): onboarding migrate guard — pre-v2 users skip the welcome modal"
```

---

## Task 8: `WelcomeModal` + first-run trigger

**Files:**
- Create: `40_src/src/modals/WelcomeModal.ts`
- Modify: `40_src/src/main.ts`

UI task — build/lint + manual smoke.

- [ ] **Step 1: Create the modal**

Create `40_src/src/modals/WelcomeModal.ts`:

```ts
/* ==========================================================
   WelcomeModal — one-time first-run onboarding. Informational
   only; never enables any escalating feature (off-by-default).
   ========================================================== */
import { Modal, type App } from 'obsidian';
import type KuroPlugin from '../main';
import { t } from '../i18n';

export class WelcomeModal extends Modal {
  constructor(app: App, private readonly plugin: KuroPlugin) { super(app); }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.welcome.title', lang));
    const c = this.contentEl;
    c.empty();
    c.createEl('p', { text: t('modal.welcome.intro', lang) });
    const ul = c.createEl('ul');
    ul.createEl('li', { text: t('modal.welcome.step1', lang) });
    ul.createEl('li', { text: t('modal.welcome.step2', lang) });
    ul.createEl('li', { text: t('modal.welcome.step3', lang) });

    const footer = c.createDiv({ cls: 'kuro-modal-footer' });
    const settingsBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.welcome.openSettings', lang) });
    settingsBtn.addEventListener('click', () => {
      this.plugin.openOwnSettings();
      this.close();
    });
    footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.welcome.close', lang) })
      .addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.plugin.data.onboardingShown) {
      this.plugin.data.onboardingShown = true;
      void this.plugin.persist();
    }
  }
}
```

- [ ] **Step 2: Add `openOwnSettings()` helper + first-run trigger in `main.ts`**

In `40_src/src/main.ts`, add the import right after the `LootRedeemModal` import (line 20):

```ts
import { WelcomeModal } from './modals/WelcomeModal';
```

In `onLayoutReady` (lines 64-68), add the welcome trigger as the last statement inside the callback:

```ts
    this.app.workspace.onLayoutReady(() => {
      if (this.data.settings.enableSidebar) this.activateSidebar();
      this.refreshStatus(true);
      this.scheduleMidnightTick();
      if (!this.data.onboardingShown) new WelcomeModal(this.app, this).open();
    });
```

Add this public helper method to the `KuroPlugin` class (e.g. right after `openRedeemModal()`, line 213). The `setting` API is runtime-present but absent from the public `obsidian` types, so it is accessed via a narrow cast:

```ts
  /** Open this plugin's own settings tab. */
  openOwnSettings(): void {
    const setting = (this.app as unknown as {
      setting?: { open(): void; openTabById(id: string): void };
    }).setting;
    setting?.open();
    setting?.openTabById(this.manifest.id);
  }
```

- [ ] **Step 3: Verify build + lint**

Run: `cd 40_src && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd 40_src && git add src/modals/WelcomeModal.ts src/main.ts
git commit -m "feat(onboarding): one-time WelcomeModal on first run + openOwnSettings helper"
```

---

## Task 9: Pack commands + settings buttons + guided empty-state

**Files:**
- Modify: `40_src/src/commands/registerCommands.ts`
- Modify: `40_src/src/settings/SettingsTab.ts`
- Modify: `40_src/src/views/KuroSidebarView.ts`

UI task — build/lint + manual smoke.

- [ ] **Step 1: Register the pack commands**

In `40_src/src/commands/registerCommands.ts`, add the import after the `DataIoModal` import (line 10):

```ts
import { ImportPackModal, ExportPackModal } from '../modals/PackIoModal';
```

Add two commands after the `import-data` command block (after line 78):

```ts
  plugin.addCommand({
    id: 'import-pack',
    name: t('cmd.importPack', lang()),
    callback: () => new ImportPackModal(plugin.app, plugin).open(),
  });

  plugin.addCommand({
    id: 'export-pack',
    name: t('cmd.exportPack', lang()),
    callback: () => new ExportPackModal(plugin.app, plugin).open(),
  });
```

- [ ] **Step 2: Add pack buttons to the Loot/Lore settings section**

In `40_src/src/settings/SettingsTab.ts`, add the import after the `DataIoModal` import (line 10):

```ts
import { ImportPackModal, ExportPackModal } from '../modals/PackIoModal';
```

In `_renderLootLore` (lines 327-332), after the existing lore-enabled toggle `new Setting(...)` block, add:

```ts
    new Setting(this.containerEl)
      .setName(t('modal.pack.import.title', lang))
      .setDesc(t('modal.pack.import.intro', lang))
      .addButton((b) => b.setButtonText(t('modal.pack.import.apply', lang))
        .onClick(() => new ImportPackModal(this.app, this.plugin).open()))
      .addButton((b) => b.setButtonText(t('modal.pack.export.copy', lang))
        .onClick(() => new ExportPackModal(this.app, this.plugin).open()));
```

- [ ] **Step 3: Replace the sidebar empty-state with the guided version**

In `40_src/src/views/KuroSidebarView.ts`, replace the empty-state branch inside `renderSnapshot()` (lines 53-58) with:

```ts
    if (!snap) {
      this.contentEl_.empty();
      const lang = this.plugin.data.settings.language;
      const empty = this.contentEl_.createDiv({ cls: 'kuro-empty' });
      empty.createEl('h3', { text: t('sidebar.empty.setup.title', lang) });
      const ul = empty.createEl('ul');
      ul.createEl('li', { text: t('sidebar.empty.setup.dailyFolder', lang, { path: this.plugin.data.settings.dailyFolder }) });
      ul.createEl('li', { text: t('sidebar.empty.setup.xp', lang) });
      ul.createEl('li', { text: t('sidebar.empty.setup.checkbox', lang) });
      const btn = empty.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('sidebar.empty.setup.openSettings', lang) });
      btn.addEventListener('click', () => this.plugin.openOwnSettings());
      return;
    }
```

- [ ] **Step 4: Verify build + lint + full test suite**

Run: `cd 40_src && npm run build && npm run lint && npm test`
Expected: PASS. All prior tests + the new pure tests green; build/lint clean.

- [ ] **Step 5: Commit**

```bash
cd 40_src && git add src/commands/registerCommands.ts src/settings/SettingsTab.ts src/views/KuroSidebarView.ts
git commit -m "feat(ui): pack commands + settings buttons + guided sidebar empty-state"
```

---

## Task 10: Bilingual documentation — customization guide + LLM prompts

**Files:**
- Create: `40_src/docs/customization.de.md`, `40_src/docs/customization.en.md`

Prose task. The LLM prompt below is load-bearing and must appear verbatim in both files (the rest of each file follows the section outline in the chosen language). The prompt stays in **English in both files** — do not translate it; it instructs the LLM about a fixed JSON schema.

- [ ] **Step 1: Write `customization.en.md` (and the DE peer)**

Each file must contain these sections:
1. **What you can customize** — loot rewards and lore fragments, without editing source, via a JSON "pack".
2. **The pack format** — show the schema (copy the `KuroPack` shape from Task 1: `kuroPack`, optional `name`, optional `loot` keyed by the 5 tiers, optional `lore` array of `{level,title,text}`). State the rules: loot tiers you omit keep the built-in defaults; lore replaces ALL default lore, so cover every level 1–10 or omit `lore`.
3. **Generate a pack with an LLM** — paste this prompt verbatim into Claude/ChatGPT/etc.:

````text
You are generating a customization "pack" for the Obsidian plugin **Kuro Gamification**.
Output ONLY a single valid JSON object — no prose, no markdown fences — matching exactly:

{
  "kuroPack": 1,
  "name": "<short theme name>",
  "lore": [
    { "level": 1, "title": "<ALL-CAPS short title>", "text": "<2–4 short lines, use \n between lines>" }
    // ... one object for EACH level 1 through 10 ...
  ],
  "loot": {
    "common":    [ { "name": "<reward doable in <=30 min>", "cat": "<short category>" } /* >=5 items */ ],
    "rare":      [ /* >=5 items */ ],
    "epic":      [ /* >=5 items */ ],
    "legendary": [ /* >=5 items */ ],
    "mythic":    [ /* >=5 items */ ]
  }
}

Rules:
- "lore" MUST cover every level 1..10 (one object each), or omit "lore" entirely.
- Allowed loot tier keys: common, rare, epic, legendary, mythic. Omit a tier to keep its built-in rewards.
- THEME: <describe your theme — e.g. "cozy cottagecore", "deep-space sci-fi", "calm and plain, no fiction">.
- Rewards must be low-pressure and neurodivergence-friendly: no obligations, no guilt, no streak pressure.
- Return ONLY the JSON object.
````

   Add a note: for a lore-only or loot-only pack, tell the LLM to include just that key.
4. **Import it** — Settings → Levels & loot → Import, or command palette → "Kuro: Import loot/lore pack". Paste, or pick a built-in template (Gothic/Plain/Cozy) to start from. Validation runs before anything is applied; your XP/progress is never touched.
5. **Share / back up** — "Kuro: Export current loot/lore as a pack" gives you the JSON to share; others import it the same way.

- [ ] **Step 2: Verify links resolve**

Run: `cd 40_src && ls docs/customization.en.md docs/customization.de.md`
Expected: both files exist.

- [ ] **Step 3: Commit**

```bash
cd 40_src && git add docs/customization.en.md docs/customization.de.md
git commit -m "docs: bilingual customization guide with ready-made LLM pack prompts"
```

---

## Task 11: Bilingual documentation — getting-started, philosophy, manual.en + README links

**Files:**
- Create: `40_src/docs/getting-started.de.md`, `getting-started.en.md`
- Create: `40_src/docs/philosophy.de.md`, `philosophy.en.md`
- Create: `40_src/docs/manual.en.md`
- Modify: `40_src/README.md`, `40_src/README.de.md`

- [ ] **Step 1: Write `getting-started.{en,de}.md`**

Sections (both languages):
1. **Install** — community plugins or manual (`main.js`/`manifest.json`/`styles.css` into `<vault>/.obsidian/plugins/kuro-gamification/`).
2. **Point it at your daily notes** — Settings → Paths → daily-notes folder + date format. Explicitly state: the default `30_Chronos/10_Tage` is the author's vault — change it to yours.
3. **Earn your first XP** — tick a checkbox in today's daily note; open the sidebar (ribbon terminal icon); Recompute.
4. **First loot at level 2** — what a drop is, how to redeem.
5. **Make it yours** — link to `customization.md` (loot/lore packs).
6. **No pressure** — note the off-by-default philosophy + link to `philosophy.md`.

- [ ] **Step 2: Write `philosophy.{en,de}.md`**

Consolidate the scattered "why" (currently across README "Why this exists", `manual.de.md` intro, `30_design/architecture.md` Grundprinzipien). Sections:
1. **Why this exists** — neurodivergence-friendly gamification (ADHD/autism), motivation without obligation.
2. **Off-by-default** — nothing that could escalate is on without consent; you opt in.
3. **Freeze tokens** — streaks that forgive missed days, so a slip is not a collapse.
4. **Deterministic loot** — same options stay until you redeem; no slot-machine variable-reward pressure.
5. **Transparent XP** — verbose breakdown; you always see why a number is what it is.
6. **Your themes, your tone** — the gothic-cyberpunk default is one voice; swap it (link to `customization.md`).

- [ ] **Step 3: Write `manual.en.md`**

Port `40_src/docs/manual.de.md` to English at full parity (quick-start, XP-sources table, habit setup, streak/freeze mechanics, loot, lore, packs, troubleshooting, performance, export/import). Add the pack import/export + template picker to the loot/lore and export/import sections.

- [ ] **Step 4: Link the docs from both READMEs**

In `40_src/README.md`, add a "Documentation" section linking the `.en.md` files; in `40_src/README.de.md`, the same linking the `.de.md` files. Concrete format for `README.md`:

```markdown
## Documentation
- [Getting Started](docs/getting-started.en.md) · ([DE](docs/getting-started.de.md))
- [Manual](docs/manual.en.md) · ([DE](docs/manual.de.md))
- [Customization — loot/lore packs & LLM prompts](docs/customization.en.md) · ([DE](docs/customization.de.md))
- [Design Philosophy](docs/philosophy.en.md) · ([DE](docs/philosophy.de.md))
```

- [ ] **Step 5: Verify all docs exist + build still clean**

Run: `cd 40_src && ls docs/*.md && npm run build`
Expected: all expected docs present; build clean (docs don't affect the bundle).

- [ ] **Step 6: Commit**

```bash
cd 40_src && git add docs/getting-started.*.md docs/philosophy.*.md docs/manual.en.md README.md README.de.md
git commit -m "docs: bilingual getting-started + philosophy + English manual + README links"
```

---

## Task 12: Final verification + manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Full automated gate**

Run: `cd 40_src && npm run lint && npm run typecheck && npm test`
Expected: biome clean; tsc clean; all tests green (the original 79 + the new PackValidator/example-packs/DataStore-guard tests).

- [ ] **Step 2: Production build**

Run: `cd 40_src && npm run build`
Expected: `../50_build/kuro-gamification/main.js` updated, no errors.

- [ ] **Step 3: Manual smoke test in Obsidian**

Deploy to a test vault and verify by hand (no automated DOM tests in this project):

```bash
cd 40_src && OBSIDIAN_PLUGIN_DIR=/Users/Shared/10_ObsidianVaults/Y3_ProtoVault/.obsidian/plugins/kuro-gamification npm run deploy
```

Then in Obsidian (reload the plugin), confirm:
1. **Onboarding:** On a fresh `data.json` (or a vault where the plugin is new), the Welcome modal appears once; "Open settings" works; it does not reappear after closing/reload. On the existing Y3 install (with progress), it does NOT appear.
2. **Guided empty-state:** With no snapshot, the sidebar shows the setup checklist with the configured daily folder + a working "Open Kuro settings" button.
3. **Pack import — template:** Settings → Levels & loot → Import → click "Plain / Calm" → textarea fills → Import → lore changes to the plain set; XP/level unchanged.
4. **Pack import — errors:** Paste `{"kuroPack":1,"loot":{"epc":[]}}` → Import → inline error naming the unknown tier; nothing applied.
5. **Pack import — warnings:** Paste a lore pack covering only levels 1-3 → warning about missing levels + "Import anyway".
6. **Pack export:** "Export current loot/lore as a pack" → valid JSON containing your current (or default) loot+lore; copy works.

- [ ] **Step 4: Update the cockpit + commit any doc touch-ups**

Note completion in the spec/cockpit per your workflow. If the manual smoke surfaced copy fixes, commit them:

```bash
cd 40_src && git add -A && git commit -m "fix(adoption): manual-smoke touch-ups"
```

---

## Self-Review (run by the plan author after writing)

- **Spec coverage:** Säule 1 (pack format + validate + apply + import/export + picker) → Tasks 1-6, 9; Säule 2 (welcome + empty-state + migrate guard) → Tasks 7-9; Säule 3 (bilingual docs) → Tasks 10-11; Säule 4 (validation + example packs + default-sanity note) → Tasks 2, 4, 10-11. D-1 (validator in `engine/`) ✓ Task 2. D-2 (lore replace + coverage warning) ✓ Task 2. D-3 (welcome always first run) ✓ Task 8. D-4 (no NeuroVim, bundled packs, picker, no theme-switcher) ✓ Tasks 4, 6, 9.
- **Type consistency:** `KuroPack`/`PackIssue`/`PackValidation`/`validatePack(raw,opts)`/`applyPack(settings,pack)`/`ExamplePack`/`EXAMPLE_PACKS`/`onboardingShown`/`openOwnSettings()` are defined once and referenced identically across tasks.
- **Known deviation from spec:** guided empty-state uses one "Open settings" button + instructional lines (not a per-section deep-link or auto-create-today's-note) — Obsidian's public API can't deep-link to a settings section, and file-creation is out of scope for v1. Documented here intentionally.
