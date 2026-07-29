# Pack-System v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei unabhängig teilbare Customization-Einheiten (Lore/Loot/Habits) mit Datei- und Zwischenablage-I/O, Reset-auf-Factory pro Einheit, generischen Starter-Habits und einklappbaren Settings-Bereichen.

**Architecture:** `KuroPack` wird um eine optionale `habits`-Sektion erweitert; alle Sektionen sind optional und werden beim Import per Auto-Detect angewandt. Factory-Defaults (Plain-Lore, generischer Loot, generische Habits) sind sprachabhängig; Habits werden beim Fresh-Install einmalig in die Settings geseedet. Die Settings-UI nutzt die vendored Kit-`collapsibleSection`.

**Tech Stack:** TypeScript, esbuild, jest/ts-jest, biome. Obsidian-Plugin-API. 0 Runtime-Deps.

## Global Constraints

- Arbeitsverzeichnis für alle npm-Befehle: `40_src/`.
- Pure-Function-Engines (`src/engine/`, `src/data/`) bleiben frei von Obsidian-Imports (Node-testbar).
- TDD: kein Produktionscode ohne vorher fehlschlagenden Test. Testbare Logik (data/engine/utils/seeding) wird getestet; Modals/Views/SettingsTab sind UI-Glue und bleiben untestet (konsistent mit dem Bestand).
- i18n: jeder user-sichtbare String über `t()`; en- und de-Dict müssen dieselben Keys haben (Parität-Test `tests/i18n.test.ts`).
- `data.json`-Schema: `schemaVersion` bleibt **2** (keine Migration; neue Felder via Deep-Merge).
- Default-Änderungen betreffen nur neue Installs; bestehende `data.json`-Werte bleiben via `DataStore.mergeSettings` erhalten.
- Verifikation nach jeder Task: `npx jest`, `npm run typecheck`, `npm run lint` — alle grün.
- Vendored Kit-Code: obsidian-gekoppelt → `src/vendor/kit-obsidian/`; pure → `src/vendor/kit/`. Header markiert Herkunft.

---

## File Structure

- Create `src/data/default-habits.ts` — generische Factory-Habits DE/EN + `defaultHabits(lang)`.
- Create `src/utils/packSections.ts` — pure Helper: Unit-Pack bauen + Sektionen erkennen.
- Create `src/utils/fileIo.ts` — Datei-Download + Datei-Auswahl-Lesen (UI-Glue-Wrapper).
- Create `src/vendor/kit-obsidian/collapsible.ts` — vendored Kit-`collapsibleSection`.
- Create `packs/gothic-lore.kuro.json`, `packs/cozy-lore.kuro.json` — verteilbare Beispiel-Packs.
- Modify `src/types.ts` — `KuroPack.habits?`, `KuroSettings.uiCollapsed`.
- Modify `src/engine/PackValidator.ts` — habits validieren + `applyPack` wendet habits an.
- Modify `src/main.ts` — Habits-Seeding im Fresh-Install.
- Modify `src/settings/SettingsTab.ts` — drei einklappbare Bereiche mit je 5 Aktionen + Reset.
- Modify `src/modals/PackIoModal.ts` — per-Unit Export/Import, Datei + Zwischenablage, Paste-mit-Name, Auto-Detect.
- Modify `src/data/example-packs.ts` / `tests/example-packs.test.ts` — Picker entfällt; Gothic/Cozy als Repo-Dateien.
- Modify `src/i18n/{en,de}.ts` — neue Keys (Validierung, Sektionen, Buttons).
- Modify `styles.css` — `COLLAPSIBLE_CSS`.
- Modify `tests/__mocks__/obsidian.ts` — falls collapsible/fileIo Mock-Ergänzungen brauchen.

---

## Task 1: Generische Factory-Habits (Daten)

**Files:**
- Create: `src/data/default-habits.ts`
- Test: `tests/default-habits.test.ts`

**Interfaces:**
- Consumes: `KuroHabit`, `Lang` aus `../types`.
- Produces: `DEFAULT_HABITS_DE`, `DEFAULT_HABITS_EN` (`KuroHabit[]`), `defaultHabits(lang: Lang): KuroHabit[]` (liefert Deep-Copies).

- [ ] **Step 1: Write the failing test**

```ts
// tests/default-habits.test.ts
import { DEFAULT_HABITS_DE, DEFAULT_HABITS_EN, defaultHabits } from '../src/data/default-habits';

describe('defaultHabits', () => {
  it('returns the German set for de', () => {
    expect(defaultHabits('de')).toEqual(DEFAULT_HABITS_DE);
  });
  it('returns the English set for en', () => {
    expect(defaultHabits('en')).toEqual(DEFAULT_HABITS_EN);
  });
  it('returns fresh deep copies (not the shared constant)', () => {
    const a = defaultHabits('en');
    expect(a).not.toBe(DEFAULT_HABITS_EN);
    a[0].xp = 999;
    expect(DEFAULT_HABITS_EN[0].xp).toBe(10);
  });
  it('ships five generic starter habits with neutral keys', () => {
    expect(DEFAULT_HABITS_EN.map((h) => h.key)).toEqual(['water', 'move', 'outside', 'tidy', 'connect']);
    expect(DEFAULT_HABITS_DE.map((h) => h.key)).toEqual(['water', 'move', 'outside', 'tidy', 'connect']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/default-habits.test.ts`
Expected: FAIL — `Cannot find module '../src/data/default-habits'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/default-habits.ts
/* ==========================================================
   Kuro generic starter habits — neutral, low-pressure defaults
   seeded into settings.habits on a fresh install (per language).
   Users edit/replace them; existing installs keep their own.
   ========================================================== */
import type { KuroHabit, Lang } from '../types';

export const DEFAULT_HABITS_EN: KuroHabit[] = [
  { key: 'water',   label: '💧 Drink water',         xp: 10 },
  { key: 'move',    label: '🚶 Move 10 min',         xp: 10 },
  { key: 'outside', label: '🌳 Fresh air',           xp: 10 },
  { key: 'tidy',    label: '🧹 Tidy 5 min',          xp: 10 },
  { key: 'connect', label: '💬 Reach out to someone', xp: 10 },
];

export const DEFAULT_HABITS_DE: KuroHabit[] = [
  { key: 'water',   label: '💧 Wasser trinken',      xp: 10 },
  { key: 'move',    label: '🚶 10 Min bewegen',       xp: 10 },
  { key: 'outside', label: '🌳 Frische Luft',         xp: 10 },
  { key: 'tidy',    label: '🧹 5 Min aufräumen',      xp: 10 },
  { key: 'connect', label: '💬 Bei jemandem melden',   xp: 10 },
];

/** Deep-copied generic habit set for the given UI language (safe to mutate). */
export function defaultHabits(lang: Lang): KuroHabit[] {
  const src = lang === 'de' ? DEFAULT_HABITS_DE : DEFAULT_HABITS_EN;
  return src.map((h) => ({ ...h }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/default-habits.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add 40_src/src/data/default-habits.ts 40_src/tests/default-habits.test.ts
git commit -m "feat(packs): generic factory habits (DE/EN)"
```

---

## Task 2: PackValidator + applyPack — habits-Sektion & Teil-Packs

**Files:**
- Modify: `src/types.ts` (KuroPack.habits)
- Modify: `src/engine/PackValidator.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/de.ts` (issue-Keys)
- Test: `tests/PackValidator.test.ts` (ergänzen)

**Interfaces:**
- Consumes: `KuroHabit` aus `../types`.
- Produces: `validatePack` erkennt/validiert `habits`; `applyPack` setzt `next.habits = pack.habits` wenn vorhanden. Neue Issue-Codes: `habitsNotArray`, `habitItemInvalid`.

- [ ] **Step 1: Add `habits?` to KuroPack (type change, needed by the test)**

In `src/types.ts`, im `KuroPack`-Interface nach `lore?`:

```ts
  /** Maps onto KuroSettings.habits (replaces the habit list wholesale). */
  habits?: KuroHabit[];
```

- [ ] **Step 2: Write the failing tests**

Ans Ende von `tests/PackValidator.test.ts` anfügen:

```ts
import { validatePack, applyPack } from '../src/engine/PackValidator';
import { DEFAULT_SETTINGS } from '../src/types';

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

describe('applyPack — subsets', () => {
  it('applies only the habits section, leaving loot/lore untouched', () => {
    const base = { ...DEFAULT_SETTINGS, customLootPool: { common: [{ name: 'a', cat: 'b' }] }, customLore: [{ level: 1, title: 'T', text: 'x' }] };
    const next = applyPack(base, { kuroPack: 1, habits: [{ key: 'h', label: 'H', xp: 1 }] });
    expect(next.habits).toEqual([{ key: 'h', label: 'H', xp: 1 }]);
    expect(next.customLootPool).toBe(base.customLootPool);
    expect(next.customLore).toBe(base.customLore);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest tests/PackValidator.test.ts`
Expected: FAIL — `emptyPack` fires for the habits-only pack (habits not yet recognized) and `applyPack` doesn't set `habits`.

- [ ] **Step 4: Implement — recognize/validate habits + apply**

In `src/engine/PackValidator.ts`, den Import ergänzen:

```ts
import type { KuroHabit, KuroLootTier, KuroPack, KuroSettings } from '../types';
```

Den Empty-Check erweitern (ersetzt die `hasLoot`/`hasLore`-Zeilen):

```ts
  const hasLoot = raw.loot !== undefined;
  const hasLore = raw.lore !== undefined;
  const hasHabits = raw.habits !== undefined;
  if (!hasLoot && !hasLore && !hasHabits) {
    errors.push({ path: '', code: 'emptyPack' });
  }
```

Nach dem `// ── lore ──`-Block (vor dem `if (errors.length > 0)`):

```ts
  // ── habits ──
  if (hasHabits) {
    if (!Array.isArray(raw.habits)) {
      errors.push({ path: 'habits', code: 'habitsNotArray' });
    } else {
      raw.habits.forEach((h, i) => {
        if (!isObj(h) || !isStr(h.key) || !isStr(h.label) || typeof h.xp !== 'number') {
          errors.push({ path: `habits[${i}]`, code: 'habitItemInvalid', vars: { index: i } });
        }
      });
    }
  }
```

In `applyPack` ergänzen (nach der lore-Zeile):

```ts
  if (pack.habits !== undefined) next.habits = pack.habits;
```

- [ ] **Step 5: Add i18n issue keys (en + de)**

In `src/i18n/en.ts` bei den `pack.issue.*`-Keys:

```ts
  'pack.issue.habitsNotArray': 'The "habits" section must be a list.',
  'pack.issue.habitItemInvalid': 'Habit #{index} is invalid (needs key, label and numeric xp).',
```

In `src/i18n/de.ts` analog:

```ts
  'pack.issue.habitsNotArray': 'Die „habits"-Sektion muss eine Liste sein.',
  'pack.issue.habitItemInvalid': 'Habit #{index} ist ungültig (braucht key, label und numerisches xp).',
```

- [ ] **Step 6: Run tests + typecheck + lint**

Run: `npx jest tests/PackValidator.test.ts && npm run typecheck && npm run lint`
Expected: PASS (new tests green, i18n parity holds).

- [ ] **Step 7: Commit**

```bash
git add 40_src/src/types.ts 40_src/src/engine/PackValidator.ts 40_src/src/i18n/en.ts 40_src/src/i18n/de.ts 40_src/tests/PackValidator.test.ts
git commit -m "feat(packs): validate + apply optional habits pack section"
```

---

## Task 3: Habits-Factory-Seeding beim Fresh-Install

**Files:**
- Modify: `src/main.ts` (`seedFreshInstallDefaults`)
- Test: `tests/main-seed-habits.test.ts`

**Interfaces:**
- Consumes: `defaultHabits` aus `./data/default-habits`.
- Produces: nach `onload` auf einem Fresh-Vault mit leeren Habits enthält `settings.habits` das sprachabhängige generische Set.

- [ ] **Step 1: Write the failing test**

```ts
// tests/main-seed-habits.test.ts
import KuroPlugin from '../src/main';
import { DEFAULT_HABITS_DE } from '../src/data/default-habits';

const store: Record<string, string> = {};
const localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
beforeAll(() => { (globalThis as any).localStorage = localStorage; });
afterAll(() => { (globalThis as any).localStorage = undefined; });

function makeFakeApp() {
  return {
    vault: { on: () => ({}) },
    workspace: { onLayoutReady: () => {}, getLeavesOfType: () => [], getRightLeaf: () => null, revealLeaf: () => {} },
    internalPlugins: { getPluginById: () => null },
  };
}
async function boot(loaded: any) {
  const plugin = new (KuroPlugin as any)();
  plugin.app = makeFakeApp();
  plugin.loadData = async () => loaded;
  await plugin.onload();
  return plugin;
}

describe('KuroPlugin — fresh-install habit seeding', () => {
  afterEach(() => localStorage.removeItem('language'));

  it('seeds generic habits (in the UI language) on a fresh vault', async () => {
    localStorage.setItem('language', 'de');
    const plugin = await boot(null);
    expect(plugin.data.settings.habits).toEqual(DEFAULT_HABITS_DE);
  });

  it('never overrides an existing install with its own habits', async () => {
    const plugin = await boot({ onboardingShown: true, settings: { habits: [{ key: 'mine', label: 'Mine', xp: 3 }] } });
    expect(plugin.data.settings.habits).toEqual([{ key: 'mine', label: 'Mine', xp: 3 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/main-seed-habits.test.ts`
Expected: FAIL — fresh vault seeds no habits yet (`habits` is `[]`).

- [ ] **Step 3: Implement — seed habits in `seedFreshInstallDefaults`**

In `src/main.ts` den Import ergänzen:

```ts
import { defaultHabits } from './data/default-habits';
```

In `seedFreshInstallDefaults()` nach dem `s.language = detectLang();` und vor dem `if (s.dailyFolder === '')`:

```ts
    if (s.habits.length === 0) s.habits = defaultHabits(s.language);
```

- [ ] **Step 4: Run test + full suite**

Run: `npx jest tests/main-seed-habits.test.ts && npx jest`
Expected: PASS (seeding tests green; all other suites still green).

- [ ] **Step 5: Commit**

```bash
git add 40_src/src/main.ts 40_src/tests/main-seed-habits.test.ts
git commit -m "feat(packs): seed generic habits on fresh install"
```

---

## Task 4: Pure Unit-Pack-Builder + Sektions-Erkennung

**Files:**
- Create: `src/utils/packSections.ts`
- Test: `tests/pack-sections.test.ts`

**Interfaces:**
- Consumes: `KuroPack`, `KuroSettings`, `Lang` aus `../types`; `defaultLootPool`, `defaultLore`, `defaultHabits` aus den data-Modulen.
- Produces:
  - `type PackUnit = 'lore' | 'loot' | 'habits'`
  - `buildUnitPack(unit: PackUnit, settings: KuroSettings): KuroPack` — Pack mit genau der Sektion (custom-Wert oder Factory-Default).
  - `detectUnits(pack: KuroPack): PackUnit[]` — welche Sektionen ein Pack enthält.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pack-sections.test.ts
import { buildUnitPack, detectUnits } from '../src/utils/packSections';
import { DEFAULT_SETTINGS } from '../src/types';
import { defaultLootPool } from '../src/data/default-loot-pool';
import { defaultLore } from '../src/data/default-lore';
import { defaultHabits } from '../src/data/default-habits';

describe('buildUnitPack', () => {
  it('builds a lore-only pack from the factory default when no custom lore', () => {
    const p = buildUnitPack('lore', { ...DEFAULT_SETTINGS, language: 'en', customLore: null });
    expect(p.lore).toEqual(defaultLore('en'));
    expect(p.loot).toBeUndefined();
    expect(p.habits).toBeUndefined();
  });
  it('builds a loot-only pack from custom loot when present', () => {
    const custom = { common: [{ name: 'x', cat: 'y' }] };
    const p = buildUnitPack('loot', { ...DEFAULT_SETTINGS, customLootPool: custom });
    expect(p.loot).toEqual(custom);
    expect(p.lore).toBeUndefined();
  });
  it('builds a habits-only pack from settings.habits', () => {
    const p = buildUnitPack('habits', { ...DEFAULT_SETTINGS, habits: [{ key: 'h', label: 'H', xp: 1 }] });
    expect(p.habits).toEqual([{ key: 'h', label: 'H', xp: 1 }]);
  });
  it('falls back to default loot/habits when settings are empty', () => {
    const p = buildUnitPack('habits', { ...DEFAULT_SETTINGS, language: 'de', habits: [] });
    expect(p.habits).toEqual(defaultHabits('de'));
    const l = buildUnitPack('loot', { ...DEFAULT_SETTINGS, language: 'de', customLootPool: null });
    expect(l.loot).toEqual(defaultLootPool('de'));
  });
});

describe('detectUnits', () => {
  it('lists exactly the present sections', () => {
    expect(detectUnits({ kuroPack: 1, lore: [], habits: [] })).toEqual(['lore', 'habits']);
    expect(detectUnits({ kuroPack: 1, loot: {} })).toEqual(['loot']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/pack-sections.test.ts`
Expected: FAIL — `Cannot find module '../src/utils/packSections'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/packSections.ts
/* ==========================================================
   Pure helpers for the per-unit pack export/import UI.
   Builds a KuroPack carrying exactly one section (custom value
   or factory default), and reports which sections a pack has.
   ========================================================== */
import type { KuroPack, KuroSettings } from '../types';
import { defaultLootPool } from '../data/default-loot-pool';
import { defaultLore } from '../data/default-lore';
import { defaultHabits } from '../data/default-habits';

export type PackUnit = 'lore' | 'loot' | 'habits';

export function buildUnitPack(unit: PackUnit, settings: KuroSettings): KuroPack {
  const pack: KuroPack = { kuroPack: 1, name: `Kuro ${unit}` };
  if (unit === 'lore') {
    pack.lore = settings.customLore ?? defaultLore(settings.language);
  } else if (unit === 'loot') {
    pack.loot = settings.customLootPool ?? defaultLootPool(settings.language);
  } else {
    pack.habits = settings.habits.length > 0 ? settings.habits : defaultHabits(settings.language);
  }
  return pack;
}

export function detectUnits(pack: KuroPack): PackUnit[] {
  const units: PackUnit[] = [];
  if (pack.lore !== undefined) units.push('lore');
  if (pack.loot !== undefined) units.push('loot');
  if (pack.habits !== undefined) units.push('habits');
  return units;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/pack-sections.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 40_src/src/utils/packSections.ts 40_src/tests/pack-sections.test.ts
git commit -m "feat(packs): pure unit-pack builder + section detection"
```

---

## Task 5: Kit-`collapsibleSection` vendoren + CSS + `uiCollapsed`

**Files:**
- Create: `src/vendor/kit-obsidian/collapsible.ts`
- Modify: `src/types.ts` (KuroSettings.uiCollapsed + DEFAULT_SETTINGS)
- Modify: `styles.css` (COLLAPSIBLE_CSS)
- Test: `tests/collapsible.test.ts` (nur `resolveCollapsed`, pure)

**Interfaces:**
- Produces: `resolveCollapsed(key, defaultCollapsed, storage?)`, `collapsibleSection(containerEl, opts)`, `COLLAPSIBLE_CSS`, `CollapsibleStorage`, `CollapsibleOptions`. Neues Settings-Feld `uiCollapsed: Record<string, boolean>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/collapsible.test.ts
import { resolveCollapsed } from '../src/vendor/kit-obsidian/collapsible';

describe('resolveCollapsed', () => {
  it('uses the default when no storage', () => {
    expect(resolveCollapsed('lore', true, undefined)).toBe(true);
    expect(resolveCollapsed('lore', false, undefined)).toBe(false);
  });
  it('uses the stored value when present', () => {
    const storage = { getCollapsed: () => false, setCollapsed: () => {} };
    expect(resolveCollapsed('lore', true, storage)).toBe(false);
  });
  it('falls back to default when nothing is stored', () => {
    const storage = { getCollapsed: () => undefined, setCollapsed: () => {} };
    expect(resolveCollapsed('lore', true, storage)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/collapsible.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Vendor the Kit module verbatim**

Create `src/vendor/kit-obsidian/collapsible.ts` mit exakt dem Inhalt von `../obsidian-kit/src/obsidian/collapsible.ts` (Schwester-Repo `obsidian-kit`, verbatim), und diesem Header davor:

```ts
/* VENDORED from obsidian-kit@0.13.0 (src/obsidian/collapsible.ts), REGISTRY §83.
   Obsidian-coupled (imports setIcon) → lives in vendor/kit-obsidian, not vendor/kit.
   COLLAPSIBLE_CSS is copied into styles.css by the consumer. */
```

(Der Rest ist der 1:1-Inhalt der Kit-Datei: `CollapsibleStorage`, `CollapsibleOptions`, `resolveCollapsed`, `collapsibleSection`, `COLLAPSIBLE_CSS`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/collapsible.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `uiCollapsed` to settings**

In `src/types.ts` im `KuroSettings`-Interface (bei den UI-Feldern):

```ts
  /** Collapsed state per settings section key (persisted). */
  uiCollapsed: Record<string, boolean>;
```

In `DEFAULT_SETTINGS` (bei den UI-Defaults):

```ts
  uiCollapsed: {},
```

- [ ] **Step 6: Add the CSS**

Ans Ende von `40_src/styles.css` den Inhalt der `COLLAPSIBLE_CSS`-Konstante anfügen (die `.okit-collapsible-*`-Regeln aus der Kit-Datei, ohne die JS-Backticks):

```css
.okit-collapsible-header {
  display: flex; align-items: center; gap: var(--size-4-2);
  cursor: pointer; padding: var(--size-4-2) 0;
  font-weight: var(--font-semibold); color: var(--text-normal);
  border-bottom: 1px solid var(--background-modifier-border);
}
.okit-collapsible-header:hover { color: var(--text-accent); }
.okit-collapsible-header:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 2px;
  border-radius: var(--radius-s);
}
.okit-collapsible-chevron { display: inline-flex; color: var(--text-muted); }
.okit-collapsible-body { padding-top: var(--size-4-2); }
.okit-collapsible-body.is-collapsed { display: none; }
```

- [ ] **Step 7: Run full suite + typecheck + lint**

Run: `npx jest && npm run typecheck && npm run lint`
Expected: PASS (der obsidian-Mock hat `setIcon` bereits; `collapsibleSection` wird in Tests nicht aufgerufen).

- [ ] **Step 8: Commit**

```bash
git add 40_src/src/vendor/kit-obsidian/collapsible.ts 40_src/src/types.ts 40_src/styles.css 40_src/tests/collapsible.test.ts
git commit -m "feat(settings): vendor Kit collapsibleSection (+ uiCollapsed, CSS)"
```

---

## Task 6: Datei-I/O-Utilities (Download + Auswahl)

**Files:**
- Create: `src/utils/fileIo.ts`

**Interfaces:**
- Produces: `downloadJson(filename: string, data: unknown): void` (Blob-Download via Anchor), `readJsonFile(): Promise<string | null>` (verstecktes `<input type=file>`, resolved mit Dateiinhalt oder `null` bei Abbruch).

**Note:** Reines DOM-UI-Glue (Blob/URL/FileReader/input) — kein Unit-Test (konsistent mit den übrigen UI-Modulen). Verifikation über `npm run build`.

- [ ] **Step 1: Write the implementation**

```ts
// src/utils/fileIo.ts
/* ==========================================================
   Browser file I/O for pack import/export. DOM-only glue.
   downloadJson triggers a .json download; readJsonFile opens
   the OS file picker and resolves the chosen file's text.
   ========================================================== */

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function readJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
    input.click();
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add 40_src/src/utils/fileIo.ts
git commit -m "feat(packs): browser file download + picker utilities"
```

---

## Task 7: PackIoModal — per-Unit Import (Datei + Einfügen-mit-Name, Auto-Detect)

**Files:**
- Modify: `src/modals/PackIoModal.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/de.ts`

**Interfaces:**
- Consumes: `validatePack`, `applyPack` (bestehend); `readJsonFile` aus `../utils/fileIo`; `detectUnits` aus `../utils/packSections`.
- Produces: `ImportPackModal` nimmt beliebiges Pack (auto-detect der Sektionen), zeigt beim Erfolg an, welche Einheiten angewandt wurden. Der bisherige `EXAMPLE_PACKS`-Template-Picker entfällt. Neue Methode `importFromFile()` (liest Datei → in die Textarea) und ein Name-Feld beim Einfügen.

**Note:** UI-Glue. Der Validierungs-/Apply-Kern (`_tryApply`/`_commit`) bleibt und ist über `PackValidator` getestet. Verifikation via `npm run build`.

- [ ] **Step 1: Entferne den Template-Picker, füge Datei-Import + Name-Feld hinzu**

In `src/modals/PackIoModal.ts` den Import ändern:

```ts
import { readJsonFile } from '../utils/fileIo';
import { detectUnits } from '../utils/packSections';
```

Und die Zeile `import { EXAMPLE_PACKS } from '../data/example-packs';` **entfernen**.

In `ImportPackModal.onOpen()` den Picker-Block (`// Template picker` bis zur `for (const ex of EXAMPLE_PACKS)`-Schleife) ersetzen durch einen „Datei wählen"-Button:

```ts
    const bar = c.createDiv({ cls: 'kuro-pack-templates' });
    const ta = c.createEl('textarea', { cls: 'kuro-data-io', attr: { rows: '14', spellcheck: 'false' } });
    const fileBtn = bar.createEl('button', { cls: 'kuro-btn', text: t('modal.pack.import.fromFile', lang) });
    fileBtn.addEventListener('click', async () => {
      const text = await readJsonFile();
      if (text !== null) ta.value = text;
    });
```

- [ ] **Step 2: Erfolgsmeldung nennt die angewandten Einheiten**

In `_commit(pack)` die Notice erweitern:

```ts
  private async _commit(pack: KuroPack): Promise<void> {
    const lang = this.plugin.data.settings.language;
    this.plugin.data.settings = applyPack(this.plugin.data.settings, pack);
    await this.plugin.persist();
    await this.plugin.refreshStatus(true);
    if (this.plugin.data.settings.enableNotices) {
      const units = detectUnits(pack).join(', ');
      new Notice(t('modal.pack.import.successUnits', lang, { units }));
    }
    this.close();
  }
```

- [ ] **Step 3: i18n-Keys ergänzen (en + de)**

`src/i18n/en.ts`:

```ts
  'modal.pack.import.fromFile': 'Choose file…',
  'modal.pack.import.successUnits': 'Pack imported: {units}.',
```

`src/i18n/de.ts`:

```ts
  'modal.pack.import.fromFile': 'Datei wählen…',
  'modal.pack.import.successUnits': 'Pack importiert: {units}.',
```

- [ ] **Step 4: Build + typecheck + lint**

Run: `npm run build && npm run lint`
Expected: PASS (esbuild ok; keine Referenz auf entferntes `EXAMPLE_PACKS`).

- [ ] **Step 5: Commit**

```bash
git add 40_src/src/modals/PackIoModal.ts 40_src/src/i18n/en.ts 40_src/src/i18n/de.ts
git commit -m "feat(packs): file import + auto-detect sections in ImportPackModal"
```

---

## Task 8: SettingsTab — drei einklappbare Bereiche mit je 5 Aktionen + Reset

**Files:**
- Modify: `src/settings/SettingsTab.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/de.ts`

**Interfaces:**
- Consumes: `collapsibleSection`, `CollapsibleStorage` aus `../vendor/kit-obsidian/collapsible`; `buildUnitPack`, `type PackUnit` aus `../utils/packSections`; `downloadJson` aus `../utils/fileIo`; `defaultHabits` aus `../data/default-habits`; `ImportPackModal` (bestehend, jetzt auto-detect).
- Produces: `_renderLootLore` wird durch `_renderCustomization` ersetzt — drei einklappbare Sektionen (Lore, Loot, Habits). Die bisherige `_renderHabits`-Editor-Liste wandert in die Habits-Sektion.

**Note:** UI-Glue. Verifikation via `npm run build` + manuellem Smoke.

- [ ] **Step 1: CollapsibleStorage an settings.uiCollapsed binden**

In `src/settings/SettingsTab.ts` Importe ergänzen:

```ts
import { collapsibleSection, type CollapsibleStorage } from '../vendor/kit-obsidian/collapsible';
import { buildUnitPack, type PackUnit } from '../utils/packSections';
import { downloadJson } from '../utils/fileIo';
import { defaultHabits } from '../data/default-habits';
```

Als privates Feld/Getter eine Storage-Bridge:

```ts
  private get _collapseStore(): CollapsibleStorage {
    const s = this.plugin.data.settings;
    return {
      getCollapsed: (k) => s.uiCollapsed[k],
      setCollapsed: (k, v) => { s.uiCollapsed[k] = v; void this.plugin.persist(); },
    };
  }
```

- [ ] **Step 2: `_renderCustomization` schreiben (ersetzt `_renderLootLore`)**

Ersetze die Methode `_renderLootLore(lang)` und den `_renderHabits(lang)`-Aufruf in `display()` durch eine neue `_renderCustomization(lang)`. In `display()` die Aufrufe `this._renderHabits(lang)` und `this._renderLootLore(lang)` durch `this._renderCustomization(lang)` ersetzen (an der Stelle von `_renderLootLore`; `_renderHabits`-Aufruf entfernen).

Die Toggles `enableLoot`/`lootOptionsCount`/`enableLore`/`enableXpFromHabits` bleiben erhalten und wandern in die jeweilige Sektion. Neue Methode:

```ts
  private _renderCustomization(lang: Lang): void {
    const s = this.plugin.data.settings;

    // ── Lore ──
    const lore = collapsibleSection(this.containerEl, {
      title: t('settings.section.lore', lang), key: 'lore', storage: this._collapseStore,
    });
    new Setting(lore)
      .setName(t('set.loreEnabled.name', lang))
      .addToggle((tg) => tg.setValue(s.enableLore).onChange(async (v) => { s.enableLore = v; await this._save(); }));
    this._packActions(lore, 'lore', lang);

    // ── Loot ──
    const loot = collapsibleSection(this.containerEl, {
      title: t('settings.section.loot', lang), key: 'loot', storage: this._collapseStore,
    });
    new Setting(loot)
      .setName(t('set.lootEnabled.name', lang))
      .addToggle((tg) => tg.setValue(s.enableLoot).onChange(async (v) => { s.enableLoot = v; await this._save(); }));
    new Setting(loot)
      .setName(t('set.lootCount.name', lang))
      .addText((tx) => tx.setValue(String(s.lootOptionsCount)).onChange(async (v) => {
        s.lootOptionsCount = clampInt(v, 1, 9, DEFAULT_SETTINGS.lootOptionsCount);
        await this._save();
      }));
    this._packActions(loot, 'loot', lang);

    // ── Habits ──
    const habits = collapsibleSection(this.containerEl, {
      title: t('settings.section.habits', lang), key: 'habits', storage: this._collapseStore,
    });
    new Setting(habits)
      .setName(t('set.xpFromHabits.name', lang))
      .setDesc(t('set.xpFromHabits.desc', lang))
      .addToggle((tg) => tg.setValue(s.enableXpFromHabits).onChange(async (v) => { s.enableXpFromHabits = v; await this._save(); }));
    this._renderHabitList(habits, lang);
    this._packActions(habits, 'habits', lang);
  }
```

- [ ] **Step 3: Habit-Listen-Editor als eigene Methode auslagern**

Verschiebe den Habit-Zeilen-Editor (die `s.habits.forEach(...)`-Schleife + „Add habit"-Button) aus dem alten `_renderHabits` in eine neue Methode, die in einen gegebenen Container rendert:

```ts
  private _renderHabitList(containerEl: HTMLElement, lang: Lang): void {
    const s = this.plugin.data.settings;
    s.habits.forEach((habit, idx) => {
      const setting = new Setting(containerEl);
      setting.controlEl.addClass('kuro-habit-row');
      setting
        .addText((tx) => tx.setPlaceholder(t('habit.key', lang)).setValue(habit.key).onChange(async (v) => { habit.key = v.trim(); await this._save(); }))
        .addText((tx) => tx.setPlaceholder(t('habit.label', lang)).setValue(habit.label).onChange(async (v) => { habit.label = v; await this._save(); }))
        .addText((tx) => tx.setPlaceholder(t('habit.xp', lang)).setValue(String(habit.xp)).onChange(async (v) => { habit.xp = clampInt(v, 0, 999, 0); await this._save(); }))
        .addExtraButton((b) => b.setIcon('trash').setTooltip(t('habit.delete', lang)).onClick(async () => { s.habits.splice(idx, 1); await this._save(); this.display(); }));
    });
    new Setting(containerEl)
      .addButton((b) => b.setButtonText(t('habit.add', lang)).onClick(async () => {
        s.habits.push({ key: 'newhabit', label: t('habit.defaultLabel', lang), xp: 10 });
        await this._save();
        this.display();
      }));
  }
```

Die alte Methode `_renderHabits` **löschen**.

- [ ] **Step 4: `_packActions` — die 5 Aktionen pro Einheit**

```ts
  private _packActions(containerEl: HTMLElement, unit: PackUnit, lang: Lang): void {
    new Setting(containerEl)
      .setName(t('pack.actions.name', lang))
      .setDesc(t('pack.actions.desc', lang))
      .addButton((b) => b.setButtonText(t('pack.action.import', lang))
        .onClick(() => new ImportPackModal(this.app, this.plugin).open()))
      .addButton((b) => b.setButtonText(t('pack.action.export', lang))
        .onClick(() => {
          const pack = buildUnitPack(unit, this.plugin.data.settings);
          downloadJson(`kuro-${unit}.kuro.json`, pack);
        }))
      .addButton((b) => b.setButtonText(t('pack.action.copy', lang))
        .onClick(async () => {
          const pack = buildUnitPack(unit, this.plugin.data.settings);
          try { await navigator.clipboard.writeText(JSON.stringify(pack, null, 2)); new Notice(t('modal.pack.export.copied', lang)); } catch { /* clipboard unavailable */ }
        }))
      .addButton((b) => b.setButtonText(t('pack.action.reset', lang)).setWarning()
        .onClick(async () => { this._resetUnit(unit); await this._save(); this.display(); }));
  }

  private _resetUnit(unit: PackUnit): void {
    const s = this.plugin.data.settings;
    if (unit === 'lore') s.customLore = null;
    else if (unit === 'loot') s.customLootPool = null;
    else s.habits = defaultHabits(s.language);
  }
```

`Notice` ist bereits in `SettingsTab.ts` importiert? Falls nicht, den Import ergänzen: die Datei importiert aktuell `{ App, PluginSettingTab, Setting }` — **`Notice` hinzufügen**:

```ts
import { type App, PluginSettingTab, Setting, Notice } from 'obsidian';
```

- [ ] **Step 5: i18n-Keys ergänzen (en + de)**

`src/i18n/en.ts`:

```ts
  'pack.actions.name': 'Import / export / reset',
  'pack.actions.desc': 'Import a .json pack, export this section as a file, copy it, or reset to the default.',
  'pack.action.import': 'Import…',
  'pack.action.export': 'Export file',
  'pack.action.copy': 'Copy',
  'pack.action.reset': 'Reset',
```

`src/i18n/de.ts`:

```ts
  'pack.actions.name': 'Import / Export / Reset',
  'pack.actions.desc': 'Ein .json-Pack importieren, diese Sektion als Datei exportieren, kopieren oder auf den Standard zurücksetzen.',
  'pack.action.import': 'Importieren…',
  'pack.action.export': 'Datei exportieren',
  'pack.action.copy': 'Kopieren',
  'pack.action.reset': 'Zurücksetzen',
```

- [ ] **Step 6: Build + typecheck + lint + full suite**

Run: `npm run build && npm run typecheck && npm run lint && npx jest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 40_src/src/settings/SettingsTab.ts 40_src/src/i18n/en.ts 40_src/src/i18n/de.ts
git commit -m "feat(settings): collapsible Lore/Loot/Habits sections with per-unit import/export/reset"
```

---

## Task 9: EXAMPLE_PACKS entfernen + Gothic/Cozy als Repo-Dateien + Doku

**Files:**
- Delete: `src/data/example-packs.ts`, `tests/example-packs.test.ts`
- Create: `packs/gothic-lore.kuro.json`, `packs/cozy-lore.kuro.json`
- Modify: `src/data/default-lore.ts` (COZY_LORE aus example-packs herüberziehen, falls dort noch definiert)
- Modify: `src/i18n/en.ts`, `src/i18n/de.ts` (Help-Text auf packs/ verweisen)
- Test: `tests/packs-files.test.ts` (validiert die ausgelieferten `.json`-Dateien)

**Interfaces:**
- Consumes: `validatePack` (zum Test der Dateien); `GOTHIC_LORE` aus `../src/data/default-lore`.
- Produces: keine gebündelten Picker-Templates mehr; zwei verteilbare Pack-Dateien im Repo-Root unter `packs/`.

- [ ] **Step 1: COZY_LORE nach default-lore.ts ziehen**

`COZY_LORE` ist aktuell in `src/data/example-packs.ts` definiert. Verschiebe die Konstante nach `src/data/default-lore.ts` (als `export const COZY_LORE: KuroLoreFragment[] = [...]`, Inhalt 1:1). `GOTHIC_LORE` ist dort bereits.

- [ ] **Step 2: example-packs löschen**

```bash
git rm 40_src/src/data/example-packs.ts 40_src/tests/example-packs.test.ts
```

- [ ] **Step 3: Sicherstellen, dass nichts mehr example-packs importiert**

Run: `grep -rn "example-packs\|EXAMPLE_PACKS" 40_src/src 40_src/tests`
Expected: keine Treffer (PackIoModal-Import wurde in Task 7 entfernt).

- [ ] **Step 4: Repo-Pack-Dateien erzeugen**

`packs/gothic-lore.kuro.json` — Inhalt: `{ "kuroPack": 1, "name": "Gothic-Cyberpunk", "lore": <GOTHIC_LORE als JSON> }`.
`packs/cozy-lore.kuro.json` — `{ "kuroPack": 1, "name": "Cozy", "lore": <COZY_LORE als JSON> }`.

Erzeuge sie deterministisch aus dem Code statt von Hand (im Repo-Root):

```bash
cd 40_src && node -e '
const { GOTHIC_LORE, COZY_LORE } = require("./dist-tmp/default-lore.js");
' 2>/dev/null || true
```

Falls kein einfacher Node-Require möglich ist (TS): die Arrays aus `src/data/default-lore.ts` per Copy in die JSON-Dateien übernehmen und mit Step 5 gegen den Validator absichern.

- [ ] **Step 5: Test — die ausgelieferten Dateien sind gültige Packs**

```ts
// tests/packs-files.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { validatePack } from '../src/engine/PackValidator';
import { DEFAULT_LEVELS } from '../src/data/default-levels';

const packsDir = path.resolve(__dirname, '../../packs');
const levels = DEFAULT_LEVELS.map((l) => l.level);

describe('distributed pack files', () => {
  for (const file of ['gothic-lore.kuro.json', 'cozy-lore.kuro.json']) {
    it(`${file} is a valid pack with no warnings`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(packsDir, file), 'utf8'));
      const r = validatePack(raw, { loreLevels: levels });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings).toEqual([]);
    });
  }
});
```

- [ ] **Step 6: Run test to verify it fails, then create the files to pass**

Run: `npx jest tests/packs-files.test.ts`
Expected first: FAIL (files missing / invalid). Nach dem Anlegen der JSON-Dateien (Step 4): PASS.

- [ ] **Step 7: Help-Text auf packs/ verweisen**

In `src/i18n/en.ts` den Key `modal.help.step.pack` erweitern:

```ts
  'modal.help.step.pack': 'Want your own flavour? Settings → Loot/Lore/Habits → Export, ask any LLM to rewrite it, then Import. Ready-made packs (Gothic, Cozy) are in the repo\'s packs/ folder.',
```

`src/i18n/de.ts`:

```ts
  'modal.help.step.pack': 'Eigener Stil? Einstellungen → Loot/Lore/Habits → Exportieren, ein LLM umschreiben lassen, dann Importieren. Fertige Packs (Gothic, Cozy) liegen im packs/-Ordner des Repos.',
```

- [ ] **Step 8: Full suite + typecheck + lint + build**

Run: `npx jest && npm run typecheck && npm run lint && npm run build`
Expected: PASS (i18n-Parität hält; keine example-packs-Referenzen; packs-files-Test grün).

- [ ] **Step 9: Commit**

```bash
git add 40_src/src/data/default-lore.ts 40_src/src/i18n/en.ts 40_src/src/i18n/de.ts 40_src/tests/packs-files.test.ts packs/
git rm --cached 40_src/src/data/example-packs.ts 40_src/tests/example-packs.test.ts 2>/dev/null || true
git commit -m "feat(packs): ship Gothic/Cozy as repo files, drop bundled template picker"
```

---

## Task 10: Deploy + Verifikation

**Files:** keine (Build/Deploy).

- [ ] **Step 1: data.json sichern + deployen**

```bash
PLUGDIR="<vault>/.obsidian/plugins/kuro-gamification"
cp "$PLUGDIR/data.json" "$PLUGDIR/data.json.bak"
cd 40_src && OBSIDIAN_PLUGIN_DIR="$PLUGDIR" npm run deploy
```

- [ ] **Step 2: data.json-Integrität prüfen**

Run: `md5 "$PLUGDIR/data.json"` vor/nach — muss identisch sein (Deploy fasst data.json nicht an).

- [ ] **Step 3: Smoke-Checkliste an Jay übergeben** (kein Auto-Test):
  - Settings: drei einklappbare Bereiche (Lore/Loot/Habits), Klapp-Zustand bleibt erhalten.
  - Pro Einheit: Export lädt `.json` herunter; Import (Datei) wendet an; Reset stellt Factory her.
  - Import eines `packs/gothic-lore.kuro.json` setzt die Gothic-Lore.
  - XP/Fortschritt unverändert nach Import/Reset.

---

## Self-Review

**Spec coverage:**
- §① Datenmodell (KuroPack.habits, applyPack optional) → Task 2. ✅
- §② Factory-Defaults (Plain/Loot vorhanden; generische Habits + Seeding) → Tasks 1, 3. ✅
- §③ Import/Export-UX (Datei + Zwischenablage, 5 Aktionen, Reset, einklappbar) → Tasks 4, 5, 6, 7, 8. ✅
- §④ Gebündelte Packs → Repo-Dateien → Task 9. ✅
- §⑤ Migration (kein Schema-Bump, Deep-Merge) → Global Constraints + Tasks 2/3 (nur Fresh-Install-Seeding). ✅
- Testing-Abschnitt → Tasks 1–5, 9 (pure/seeding getestet; UI-Glue untestet, dokumentiert). ✅

**Placeholder scan:** Task 9 Step 4 lässt bewusst zwei Wege offen (Node-Require vs. Copy) — beide sind konkret; Step 5/6 sichern das Ergebnis über den Validator-Test ab. Keine „TODO/TBD".

**Type consistency:** `PackUnit`, `buildUnitPack`, `detectUnits`, `defaultHabits`, `resolveCollapsed`/`collapsibleSection`/`CollapsibleStorage`, `downloadJson`/`readJsonFile`, `applyPack` (habits) — konsistent über Tasks 1–9 verwendet.
