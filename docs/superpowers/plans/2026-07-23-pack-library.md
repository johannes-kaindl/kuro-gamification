# Pack-Bibliothek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine gemeinsame Pack-Bibliothek — mehrere Packs installiert, pro Sektion (Lore/Loot) genau eines aktiv, non-destruktiv, einzeln löschbar, aktiver Name sichtbar.

**Architecture:** Neue Settings-Felder `packLibrary` + `activeLorePackId`/`activeLootPackId` in `data.json`. Zeiger sind die Wahrheit; `customLore`/`customLootPool` bleiben abgeleiteter Cache, den pure Funktionen in `src/utils/packLibrary.ts` synchron halten — die Engines bleiben unangetastet. UI ist eine dünne Settings-Sektion, die diese pure Funktionen verdrahtet.

**Tech Stack:** TypeScript (Obsidian-Plugin), jest/ts-jest, biome. 0 Runtime-Deps. Arbeitsverzeichnis `40_src/`.

## Global Constraints

- Arbeitsverzeichnis für alle Commands: `40_src/`. Tests: `npm test` bzw. `npx jest <name>`.
- **0 Runtime-Dependencies.** Keine neuen npm-Deps.
- **Engine↔Obsidian-Grenze nicht aufweichen:** `src/utils/packLibrary.ts` bleibt frei von Obsidian-Imports (nur `types`, `i18n`), damit es in Node testbar ist.
- **Habits sind NICHT Teil der Bibliothek** — `settings.habits` bleibt unverändert.
- **Non-destruktives Aktivieren:** `activatePack` schreibt Zeiger + Cache nur für Sektionen, die das Pack trägt; andere Sektionen unangetastet.
- **Cache↔Zeiger-Invariante** (nach jeder Mutation): `customLore === activeLorePackId ? lib.find(activeLorePackId).lore : null` und analog für Loot.
- **Fortschritt nie anfassen:** keine Mutation berührt XP, Streaks, redeemedDrops, levels.
- **Runtime-Deps injizieren + testen** (LESSONS 2026-07-20): ID via `crypto.randomUUID()` im UI-Layer erzeugt und in `installPack` injiziert; gebündelte Lore-Konstanten als `deps` injiziert. UI-Glue nicht als „untestbar" abhaken — die testbare Logik lebt in pure Funktionen.
- biome-Linter (Formatter aus). Nach jeder Task: `npm run typecheck` + `npm run lint` müssen grün sein.

---

## File Structure

- **Create** `40_src/src/utils/packLibrary.ts` — pure Bibliotheks-Logik (neben `packSections.ts`).
- **Create** `40_src/tests/packLibrary.test.ts` — Unit-Tests der pure Funktionen.
- **Modify** `40_src/src/types.ts` — `InstalledPack`-Interface + 3 Settings-Felder + Defaults.
- **Modify** `40_src/src/persistence/DataStore.ts` — `mergeSettings`-Array-Guard + `migrate`-Hook.
- **Modify** `40_src/tests/DataStore.test.ts` — Merge-/Migrations-Abdeckung.
- **Modify** `40_src/src/i18n/de.ts` + `en.ts` — neue Keys.
- **Modify** `40_src/src/modals/PackIoModal.ts` — Import = install + activate.
- **Modify** `40_src/src/settings/SettingsTab.ts` — neue einklappbare „📚 Packs"-Sektion.
- **Modify** `40_src/styles.css` — Pack-Zeilen/Badges (minimal).
- **Modify** `40_src/docs/{manual,customization}.{de,en}.md` — Bibliothek erwähnen.

---

### Task 1: Datenmodell — `InstalledPack` + Settings-Felder + Merge-Guard

**Files:**
- Modify: `40_src/src/types.ts` (nach `interface KuroPack`, in `KuroSettings`, in `DEFAULT_SETTINGS`)
- Modify: `40_src/src/persistence/DataStore.ts:37-50` (`mergeSettings`)
- Test: `40_src/tests/DataStore.test.ts`

**Interfaces:**
- Produces: `InstalledPack { id: string; name: string; lore?: KuroLoreFragment[]; loot?: Partial<Record<KuroLootTier, KuroLootDrop[]>> }`; `KuroSettings.packLibrary: InstalledPack[]`; `KuroSettings.activeLorePackId: string | null`; `KuroSettings.activeLootPackId: string | null`.

- [ ] **Step 1: Write the failing test** in `tests/DataStore.test.ts` (append):

```ts
import { DataStore } from '../src/persistence/DataStore';

describe('DataStore — pack library defaults', () => {
  const makeStore = (raw: unknown) =>
    new DataStore({ loadData: async () => raw, saveData: async () => {} } as never);

  it('fills pack-library fields for legacy data (no packLibrary key)', async () => {
    const store = makeStore({ settings: { customLore: [{ level: 1, title: 'T', text: 'x' }] } });
    const data = await store.load();
    expect(data.settings.packLibrary).toEqual([]);
    expect(data.settings.activeLorePackId).toBeNull();
    expect(data.settings.activeLootPackId).toBeNull();
  });

  it('guards a malformed packLibrary into the default empty array', async () => {
    const store = makeStore({ settings: { packLibrary: 'nope' } });
    const data = await store.load();
    expect(data.settings.packLibrary).toEqual([]);
  });
});
```

> Note: mirror the existing `DataStore.test.ts` construction pattern if it differs (check how the suite instantiates `DataStore` — reuse that exact helper instead of the inline `makeStore` above).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest DataStore -t "pack library defaults"`
Expected: FAIL — `packLibrary` is `undefined` (field not yet defined).

- [ ] **Step 3: Add the interface and settings fields** in `src/types.ts`.

After the `KuroPack` interface (around line 48) add:

```ts
/** One installed pack in the library. Carries the sections it was imported with. */
export interface InstalledPack {
  id: string;
  name: string;
  lore?: KuroLoreFragment[];
  loot?: Partial<Record<KuroLootTier, KuroLootDrop[]>>;
}
```

In `interface KuroSettings`, in the `/* Levels & loot */` block after `customLore` (line 123) add:

```ts
  /** Installed packs (library). Content lives here; customLore/customLootPool are the applied cache. */
  packLibrary: InstalledPack[];
  /** Id of the pack whose lore is active, or null = factory default. */
  activeLorePackId: string | null;
  /** Id of the pack whose loot is active, or null = factory default. */
  activeLootPackId: string | null;
```

In `DEFAULT_SETTINGS`, after `customLore: null,` (line 232) add:

```ts
  packLibrary: [],
  activeLorePackId: null,
  activeLootPackId: null,
```

- [ ] **Step 4: Add the merge guard** in `src/persistence/DataStore.ts` `mergeSettings` return object (after the `tierByLevel` line, before the closing brace):

```ts
      packLibrary: Array.isArray(raw.packLibrary) ? raw.packLibrary : DEFAULT_SETTINGS.packLibrary,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest DataStore -t "pack library"`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint + commit**

```bash
npm run typecheck && npm run lint
git add src/types.ts src/persistence/DataStore.ts tests/DataStore.test.ts
git commit -m "feat(packs): pack-library data model (InstalledPack + active pointers)"
```

---

### Task 2: `sameLore` + `resolvePackName` (pure)

**Files:**
- Create: `40_src/src/utils/packLibrary.ts`
- Test: `40_src/tests/packLibrary.test.ts`

**Interfaces:**
- Consumes: `InstalledPack`, `KuroPack`, `KuroSettings`, `KuroLoreFragment`, `Lang` from `../types`; `t` from `../i18n`.
- Produces:
  - `sameLore(a: KuroLoreFragment[] | undefined, b: KuroLoreFragment[] | undefined): boolean`
  - `interface NameDeps { gothicLore: KuroLoreFragment[]; cozyLore: KuroLoreFragment[]; lang: Lang }`
  - `resolvePackName(pack: KuroPack, deps: NameDeps): string`

- [ ] **Step 1: Write the failing test** `tests/packLibrary.test.ts`:

```ts
import { resolvePackName, sameLore } from '../src/utils/packLibrary';
import { GOTHIC_LORE, COZY_LORE } from '../src/data/default-lore';

const deps = { gothicLore: GOTHIC_LORE, cozyLore: COZY_LORE, lang: 'de' as const };

describe('sameLore', () => {
  it('is true for structurally equal lore and false otherwise', () => {
    expect(sameLore(GOTHIC_LORE, GOTHIC_LORE)).toBe(true);
    expect(sameLore(GOTHIC_LORE, COZY_LORE)).toBe(false);
    expect(sameLore(GOTHIC_LORE, undefined)).toBe(false);
  });
});

describe('resolvePackName', () => {
  it('prefers an explicit trimmed name', () => {
    expect(resolvePackName({ kuroPack: 1, name: '  My Pack ' }, deps)).toBe('My Pack');
  });
  it('matches bundled lore by content', () => {
    expect(resolvePackName({ kuroPack: 1, lore: GOTHIC_LORE }, deps)).toBe('Gothic-Cyberpunk');
    expect(resolvePackName({ kuroPack: 1, lore: COZY_LORE }, deps)).toBe('Cozy');
  });
  it('falls back to the localized generic name', () => {
    expect(resolvePackName({ kuroPack: 1, lore: [{ level: 1, title: 'X', text: 'y' }] }, deps)).toBe('Importiertes Pack');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest packLibrary`
Expected: FAIL — module not found / functions undefined.

- [ ] **Step 3: Create `src/utils/packLibrary.ts`** with:

```ts
/* ==========================================================
   Pure pack-library logic. Free of Obsidian imports (Node-
   testable). Pointers (activeLore/LootPackId) are the truth;
   customLore/customLootPool are the applied cache these
   functions keep in sync.
   ========================================================== */
import type { InstalledPack, KuroLoreFragment, KuroPack, KuroSettings, Lang } from '../types';
import { t } from '../i18n';

/** Structural equality for a lore array (level/title/text per fragment). */
export function sameLore(a: KuroLoreFragment[] | undefined, b: KuroLoreFragment[] | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((f, i) => f.level === b[i].level && f.title === b[i].title && f.text === b[i].text);
}

export interface NameDeps {
  gothicLore: KuroLoreFragment[];
  cozyLore: KuroLoreFragment[];
  lang: Lang;
}

/** Human name for an incoming pack: explicit name > content-match > localized fallback. */
export function resolvePackName(pack: KuroPack, deps: NameDeps): string {
  if (pack.name && pack.name.trim()) return pack.name.trim();
  if (pack.lore) {
    if (sameLore(pack.lore, deps.gothicLore)) return 'Gothic-Cyberpunk';
    if (sameLore(pack.lore, deps.cozyLore)) return 'Cozy';
  }
  return t('pack.name.imported', deps.lang);
}
```

> `t()` does not throw on an unknown key — it returns `dict.en[key] ?? key`. But this test asserts the resolved German string `'Importiertes Pack'`, so the key must exist. **Add it to BOTH sides now** (i18n parity is enforced by `i18n.test.ts` — `Object.keys(en) === Object.keys(de)`): in `src/i18n/de.ts` add `'pack.name.imported': 'Importiertes Pack',` and in `src/i18n/en.ts` add `'pack.name.imported': 'Imported pack',`. Task 9 adds the remaining keys.

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest packLibrary`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
npm run typecheck && npm run lint
git add src/utils/packLibrary.ts tests/packLibrary.test.ts src/i18n/de.ts src/i18n/en.ts
git commit -m "feat(packs): resolvePackName + sameLore (content-match naming)"
```

---

### Task 3: `installPack` (pure)

**Files:**
- Modify: `40_src/src/utils/packLibrary.ts`
- Test: `40_src/tests/packLibrary.test.ts`

**Interfaces:**
- Consumes: `NameDeps`, `resolvePackName` (Task 2).
- Produces: `installPack(settings: KuroSettings, pack: KuroPack, id: string, deps: NameDeps): KuroSettings` — appends an `InstalledPack` (does NOT activate).

- [ ] **Step 1: Write the failing test** (append to `packLibrary.test.ts`):

```ts
import { installPack } from '../src/utils/packLibrary';
import { DEFAULT_SETTINGS } from '../src/types';

describe('installPack', () => {
  it('appends an entry with resolved name and carried sections, without activating', () => {
    const pack = { kuroPack: 1, name: 'P', lore: [{ level: 1, title: 'T', text: 'x' }] };
    const next = installPack(DEFAULT_SETTINGS, pack, 'id-1', deps);
    expect(next.packLibrary).toHaveLength(1);
    expect(next.packLibrary[0]).toEqual({ id: 'id-1', name: 'P', lore: pack.lore });
    expect(next.activeLorePackId).toBeNull();      // not activated
    expect(next.customLore).toBeNull();
  });
  it('omits sections the pack does not carry', () => {
    const next = installPack(DEFAULT_SETTINGS, { kuroPack: 1, loot: { common: [] } }, 'id-2', deps);
    expect(next.packLibrary[0].lore).toBeUndefined();
    expect(next.packLibrary[0].loot).toEqual({ common: [] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest packLibrary -t installPack`
Expected: FAIL — `installPack` undefined.

- [ ] **Step 3: Implement** (append to `packLibrary.ts`):

```ts
/** Add a pack to the library. Does not activate it. */
export function installPack(settings: KuroSettings, pack: KuroPack, id: string, deps: NameDeps): KuroSettings {
  const entry: InstalledPack = { id, name: resolvePackName(pack, deps) };
  if (pack.lore !== undefined) entry.lore = pack.lore;
  if (pack.loot !== undefined) entry.loot = pack.loot;
  return { ...settings, packLibrary: [...settings.packLibrary, entry] };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest packLibrary -t installPack`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint
git add src/utils/packLibrary.ts tests/packLibrary.test.ts
git commit -m "feat(packs): installPack (append to library, no activation)"
```

---

### Task 4: `activatePack` (pure, non-destructive + invariant)

**Files:**
- Modify: `40_src/src/utils/packLibrary.ts`
- Test: `40_src/tests/packLibrary.test.ts`

**Interfaces:**
- Produces: `activatePack(settings: KuroSettings, id: string): KuroSettings` — for each section the pack carries, sets pointer + cache; unknown id → settings unchanged.

- [ ] **Step 1: Write the failing test**:

```ts
import { activatePack } from '../src/utils/packLibrary';

describe('activatePack', () => {
  const withLib = {
    ...DEFAULT_SETTINGS,
    packLibrary: [
      { id: 'lore-1', name: 'L', lore: [{ level: 1, title: 'T', text: 'x' }] },
      { id: 'both-1', name: 'B', lore: [{ level: 1, title: 'B', text: 'b' }], loot: { common: [{ name: 'n', cat: 'c' }] } },
    ],
  };

  it('activates only the sections the pack carries and syncs the cache', () => {
    const next = activatePack(withLib, 'lore-1');
    expect(next.activeLorePackId).toBe('lore-1');
    expect(next.customLore).toEqual(withLib.packLibrary[0].lore);
    expect(next.activeLootPackId).toBeNull();   // loot untouched
    expect(next.customLootPool).toBeNull();
  });

  it('activates both sections for a combined pack', () => {
    const next = activatePack(withLib, 'both-1');
    expect(next.activeLorePackId).toBe('both-1');
    expect(next.activeLootPackId).toBe('both-1');
    expect(next.customLootPool).toEqual(withLib.packLibrary[1].loot);
  });

  it('leaves the other section active when a lore-only pack is activated over it', () => {
    const base = activatePack(withLib, 'both-1');   // both active
    const next = activatePack(base, 'lore-1');       // lore swaps, loot stays
    expect(next.activeLorePackId).toBe('lore-1');
    expect(next.activeLootPackId).toBe('both-1');
  });

  it('returns settings unchanged for an unknown id', () => {
    expect(activatePack(withLib, 'nope')).toBe(withLib);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest packLibrary -t activatePack`
Expected: FAIL — `activatePack` undefined.

- [ ] **Step 3: Implement**:

```ts
/** Apply a pack: set pointer + cache for each section it carries; others untouched. */
export function activatePack(settings: KuroSettings, id: string): KuroSettings {
  const entry = settings.packLibrary.find((p) => p.id === id);
  if (!entry) return settings;
  const next: KuroSettings = { ...settings };
  if (entry.lore !== undefined) { next.customLore = entry.lore; next.activeLorePackId = id; }
  if (entry.loot !== undefined) { next.customLootPool = entry.loot; next.activeLootPackId = id; }
  return next;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest packLibrary -t activatePack`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint
git add src/utils/packLibrary.ts tests/packLibrary.test.ts
git commit -m "feat(packs): activatePack (non-destructive per-section apply)"
```

---

### Task 5: `deletePack` (pure, active → factory)

**Files:**
- Modify: `40_src/src/utils/packLibrary.ts`
- Test: `40_src/tests/packLibrary.test.ts`

**Interfaces:**
- Produces: `deletePack(settings: KuroSettings, id: string): KuroSettings` — removes the entry; if it was active for a section, that section reverts to factory (pointer + cache null).

- [ ] **Step 1: Write the failing test**:

```ts
import { deletePack } from '../src/utils/packLibrary';

describe('deletePack', () => {
  it('removes the entry and reverts an active section to factory', () => {
    const s = activatePack(
      { ...DEFAULT_SETTINGS, packLibrary: [{ id: 'a', name: 'A', lore: [{ level: 1, title: 'T', text: 'x' }] }] },
      'a',
    );
    const next = deletePack(s, 'a');
    expect(next.packLibrary).toHaveLength(0);
    expect(next.activeLorePackId).toBeNull();
    expect(next.customLore).toBeNull();
  });

  it('leaves active pointers alone when deleting a non-active pack', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      packLibrary: [
        { id: 'a', name: 'A', lore: [{ level: 1, title: 'T', text: 'x' }] },
        { id: 'b', name: 'B', lore: [{ level: 1, title: 'U', text: 'y' }] },
      ],
      activeLorePackId: 'a',
      customLore: [{ level: 1, title: 'T', text: 'x' }],
    };
    const next = deletePack(s, 'b');
    expect(next.packLibrary.map((p) => p.id)).toEqual(['a']);
    expect(next.activeLorePackId).toBe('a');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest packLibrary -t deletePack`
Expected: FAIL — `deletePack` undefined.

- [ ] **Step 3: Implement**:

```ts
/** Remove a pack. If it was active for a section, that section reverts to factory. */
export function deletePack(settings: KuroSettings, id: string): KuroSettings {
  const next: KuroSettings = { ...settings, packLibrary: settings.packLibrary.filter((p) => p.id !== id) };
  if (next.activeLorePackId === id) { next.activeLorePackId = null; next.customLore = null; }
  if (next.activeLootPackId === id) { next.activeLootPackId = null; next.customLootPool = null; }
  return next;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest packLibrary -t deletePack`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint
git add src/utils/packLibrary.ts tests/packLibrary.test.ts
git commit -m "feat(packs): deletePack (active section reverts to factory)"
```

---

### Task 6: `resetSection` (pure)

**Files:**
- Modify: `40_src/src/utils/packLibrary.ts`
- Test: `40_src/tests/packLibrary.test.ts`

**Interfaces:**
- Produces: `resetSection(settings: KuroSettings, section: 'lore' | 'loot'): KuroSettings` — clears pointer + cache for that section; library untouched.

- [ ] **Step 1: Write the failing test**:

```ts
import { resetSection } from '../src/utils/packLibrary';

describe('resetSection', () => {
  it('clears the lore pointer + cache and leaves loot + library untouched', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      packLibrary: [{ id: 'a', name: 'A', lore: [{ level: 1, title: 'T', text: 'x' }] }],
      activeLorePackId: 'a',
      customLore: [{ level: 1, title: 'T', text: 'x' }],
      activeLootPackId: 'a',
      customLootPool: { common: [] },
    };
    const next = resetSection(s, 'lore');
    expect(next.activeLorePackId).toBeNull();
    expect(next.customLore).toBeNull();
    expect(next.activeLootPackId).toBe('a');        // loot untouched
    expect(next.packLibrary).toHaveLength(1);       // library untouched
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest packLibrary -t resetSection`
Expected: FAIL — `resetSection` undefined.

- [ ] **Step 3: Implement**:

```ts
/** Revert one section to factory default: clear its pointer + cache. Library untouched. */
export function resetSection(settings: KuroSettings, section: 'lore' | 'loot'): KuroSettings {
  const next: KuroSettings = { ...settings };
  if (section === 'lore') { next.customLore = null; next.activeLorePackId = null; }
  else { next.customLootPool = null; next.activeLootPackId = null; }
  return next;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest packLibrary -t resetSection`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint
git add src/utils/packLibrary.ts tests/packLibrary.test.ts
git commit -m "feat(packs): resetSection (section back to factory)"
```

---

### Task 7: `activeNames` (pure)

**Files:**
- Modify: `40_src/src/utils/packLibrary.ts`
- Test: `40_src/tests/packLibrary.test.ts`

**Interfaces:**
- Produces: `activeNames(settings: KuroSettings, lang: Lang): { lore: string; loot: string }` — active pack name per section, or the localized factory label.

- [ ] **Step 1: Write the failing test**:

```ts
import { activeNames } from '../src/utils/packLibrary';

describe('activeNames', () => {
  it('returns the active pack name per section, factory label otherwise', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      packLibrary: [{ id: 'a', name: 'Gothic-Cyberpunk', lore: [{ level: 1, title: 'T', text: 'x' }] }],
      activeLorePackId: 'a',
      activeLootPackId: null,
    };
    expect(activeNames(s, 'de')).toEqual({ lore: 'Gothic-Cyberpunk', loot: 'Factory-Default' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest packLibrary -t activeNames`
Expected: FAIL — `activeNames` undefined (and/or `pack.name.factory` key missing until Task 9; add the stub key like in Task 2 if `t()` throws).

- [ ] **Step 3: Implement** (append to `packLibrary.ts`):

```ts
/** Active pack name per section, or the localized factory-default label. */
export function activeNames(settings: KuroSettings, lang: Lang): { lore: string; loot: string } {
  const nameOf = (pid: string | null): string =>
    pid ? (settings.packLibrary.find((p) => p.id === pid)?.name ?? t('pack.name.factory', lang))
        : t('pack.name.factory', lang);
  return { lore: nameOf(settings.activeLorePackId), loot: nameOf(settings.activeLootPackId) };
}
```

> This test asserts the resolved string `'Factory-Default'`, so add the key to BOTH sides now (parity-enforced): `'pack.name.factory': 'Factory-Default'` (de) / `'Factory default'` (en). Task 9 finalizes all keys.

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest packLibrary -t activeNames`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm run lint
git add src/utils/packLibrary.ts tests/packLibrary.test.ts src/i18n/de.ts src/i18n/en.ts
git commit -m "feat(packs): activeNames (active label per section)"
```

---

### Task 8: `migrateToLibrary` (pure) + DataStore wiring

**Files:**
- Modify: `40_src/src/utils/packLibrary.ts`
- Modify: `40_src/src/persistence/DataStore.ts` (`migrate`, around line 52)
- Test: `40_src/tests/packLibrary.test.ts` + `40_src/tests/DataStore.test.ts`

**Interfaces:**
- Consumes: `resolvePackName` (Task 2), `GOTHIC_LORE`/`COZY_LORE` from `../data/default-lore`.
- Produces: `migrateToLibrary(settings: KuroSettings, deps: NameDeps): KuroSettings` — one-time seed of the library from a pre-feature `customLore`/`customLootPool`. Idempotent (no-op once the library is non-empty).

- [ ] **Step 1: Write the failing pure test** (append to `packLibrary.test.ts`):

```ts
import { migrateToLibrary } from '../src/utils/packLibrary';

describe('migrateToLibrary', () => {
  it('seeds a named, active lore entry from a legacy customLore (content-matched)', () => {
    const s = { ...DEFAULT_SETTINGS, customLore: GOTHIC_LORE };
    const next = migrateToLibrary(s, deps);
    expect(next.packLibrary).toHaveLength(1);
    expect(next.packLibrary[0].name).toBe('Gothic-Cyberpunk');
    expect(next.activeLorePackId).toBe(next.packLibrary[0].id);
    expect(next.customLore).toBe(GOTHIC_LORE);   // cache unchanged
  });

  it('seeds a loot entry too when customLootPool is present', () => {
    const s = { ...DEFAULT_SETTINGS, customLore: GOTHIC_LORE, customLootPool: { common: [{ name: 'n', cat: 'c' }] } };
    const next = migrateToLibrary(s, deps);
    expect(next.packLibrary).toHaveLength(2);
    expect(next.activeLootPackId).not.toBeNull();
  });

  it('is a no-op when the library is already non-empty (idempotent)', () => {
    const s = { ...DEFAULT_SETTINGS, customLore: GOTHIC_LORE };
    const once = migrateToLibrary(s, deps);
    const twice = migrateToLibrary(once, deps);
    expect(twice).toBe(once);
  });

  it('is a no-op on a clean factory state', () => {
    expect(migrateToLibrary(DEFAULT_SETTINGS, deps)).toBe(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest packLibrary -t migrateToLibrary`
Expected: FAIL — `migrateToLibrary` undefined.

- [ ] **Step 3: Implement** (append to `packLibrary.ts`):

```ts
/** One-time: seed the library from a pre-feature customLore/customLootPool. Idempotent. */
export function migrateToLibrary(settings: KuroSettings, deps: NameDeps): KuroSettings {
  if (settings.packLibrary.length > 0) return settings;
  if (settings.customLore == null && settings.customLootPool == null) return settings;
  const lib: InstalledPack[] = [];
  const next: KuroSettings = { ...settings };
  if (settings.customLore != null) {
    const name = resolvePackName({ kuroPack: 1, lore: settings.customLore }, deps);
    lib.push({ id: 'lib-migrated-lore', name, lore: settings.customLore });
    next.activeLorePackId = 'lib-migrated-lore';
  }
  if (settings.customLootPool != null) {
    lib.push({ id: 'lib-migrated-loot', name: t('pack.name.importedLoot', deps.lang), loot: settings.customLootPool });
    next.activeLootPackId = 'lib-migrated-loot';
  }
  next.packLibrary = lib;
  return next;
}
```

> This seeds the loot entry's name via `pack.name.importedLoot` — the pure test above doesn't assert that string, so a stub is optional here, but add it to BOTH sides anyway (`'Importierter Loot'` de / `'Imported loot'` en) to keep parity green on any full `npm test`. Task 9 finalizes it.

- [ ] **Step 4: Run the pure test**

Run: `npx jest packLibrary -t migrateToLibrary`
Expected: PASS.

- [ ] **Step 5: Wire into `DataStore.migrate`.** Add imports at the top of `src/persistence/DataStore.ts`:

```ts
import { migrateToLibrary } from '../utils/packLibrary';
import { GOTHIC_LORE, COZY_LORE } from '../data/default-lore';
```

In `private migrate(d: KuroPluginData): KuroPluginData`, before `return d;`, add:

```ts
    d.settings = migrateToLibrary(d.settings, {
      gothicLore: GOTHIC_LORE, cozyLore: COZY_LORE, lang: d.settings.language,
    });
```

- [ ] **Step 6: Add a DataStore integration test** (append to `tests/DataStore.test.ts`):

```ts
it('migrates a legacy gothic customLore into a named active library entry on load', async () => {
  const raw = { settings: { customLore: [...GOTHIC_LORE], language: 'de' } };
  const store = new DataStore({ loadData: async () => raw, saveData: async () => {} } as never);
  const data = await store.load();
  expect(data.settings.packLibrary).toHaveLength(1);
  expect(data.settings.packLibrary[0].name).toBe('Gothic-Cyberpunk');
  expect(data.settings.activeLorePackId).toBe(data.settings.packLibrary[0].id);
});
```

Add `import { GOTHIC_LORE } from '../src/data/default-lore';` to that test file if not present. Use the suite's existing `DataStore` construction helper if it differs.

- [ ] **Step 7: Run the suites**

Run: `npx jest packLibrary DataStore`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
npm run typecheck && npm run lint
git add src/utils/packLibrary.ts src/persistence/DataStore.ts tests/packLibrary.test.ts tests/DataStore.test.ts
git commit -m "feat(packs): migrateToLibrary + DataStore load-time seeding"
```

---

### Task 9: i18n keys (finalize)

**Files:**
- Modify: `40_src/src/i18n/de.ts`, `40_src/src/i18n/en.ts`
- Test: `40_src/tests/i18n.test.ts` (must stay green — key parity)

**Interfaces:**
- Produces the following keys in BOTH `de.ts` and `en.ts` (replace any Task-2/7/8 stubs with the final set; keep the exact key names).

- [ ] **Step 1: Add keys** (group them near the existing `modal.pack.*` block). German (`de.ts`):

```ts
  'pack.name.factory': 'Factory-Default',
  'pack.name.imported': 'Importiertes Pack',
  'pack.name.importedLoot': 'Importierter Loot',
  'set.packs.name': '📚 Packs',
  'set.packs.desc': 'Installierte Loot-/Lore-Packs — eines pro Sektion aktiv.',
  'set.packs.activeHeading': 'Aktiv — Lore: {lore} · Loot: {loot}',
  'set.packs.empty': 'Noch keine Packs installiert. Importiere eins über „Importieren".',
  'set.packs.activate': 'Aktivieren',
  'set.packs.delete': 'Löschen',
  'set.packs.resetLore': 'Lore auf Factory',
  'set.packs.resetLoot': 'Loot auf Factory',
  'set.packs.badge.active': 'aktiv',
  'modal.pack.delete.title': 'Pack löschen',
  'modal.pack.delete.body': 'Pack „{name}" aus der Bibliothek entfernen? War es aktiv, greift wieder der Factory-Default. XP und Fortschritt bleiben unberührt.',
  'modal.pack.delete.confirm': 'Löschen',
  'modal.pack.delete.cancel': 'Abbrechen',
  'notice.pack.activated': 'Pack aktiviert: {name}.',
  'notice.pack.deleted': 'Pack gelöscht: {name}.',
```

English (`en.ts`):

```ts
  'pack.name.factory': 'Factory default',
  'pack.name.imported': 'Imported pack',
  'pack.name.importedLoot': 'Imported loot',
  'set.packs.name': '📚 Packs',
  'set.packs.desc': 'Installed loot/lore packs — one active per section.',
  'set.packs.activeHeading': 'Active — Lore: {lore} · Loot: {loot}',
  'set.packs.empty': 'No packs installed yet. Import one via "Import".',
  'set.packs.activate': 'Activate',
  'set.packs.delete': 'Delete',
  'set.packs.resetLore': 'Lore to factory',
  'set.packs.resetLoot': 'Loot to factory',
  'set.packs.badge.active': 'active',
  'modal.pack.delete.title': 'Delete pack',
  'modal.pack.delete.body': 'Remove pack "{name}" from the library? If it was active, the factory default applies again. XP and progress are untouched.',
  'modal.pack.delete.confirm': 'Delete',
  'modal.pack.delete.cancel': 'Cancel',
  'notice.pack.activated': 'Pack activated: {name}.',
  'notice.pack.deleted': 'Pack deleted: {name}.',
```

- [ ] **Step 2: Run i18n parity test**

Run: `npx jest i18n`
Expected: PASS (de/en key sets match). If it reports missing keys on one side, add them.

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add src/i18n/de.ts src/i18n/en.ts
git commit -m "feat(packs): i18n keys for the pack library + delete modal"
```

---

### Task 10: Import = install + activate (`PackIoModal`)

**Files:**
- Modify: `40_src/src/modals/PackIoModal.ts:71-81` (`_commit`)
- Test: `40_src/tests/packLibrary.test.ts` (logic path — the modal wiring stays thin)

**Interfaces:**
- Consumes: `installPack`, `activatePack` (Tasks 3/4), `GOTHIC_LORE`/`COZY_LORE`.

- [ ] **Step 1: Write a failing test** for the install+activate logic path (append to `packLibrary.test.ts`):

```ts
describe('import flow (install then activate)', () => {
  it('installs the pack and activates its sections in one pass', () => {
    const pack = { kuroPack: 1, name: 'Gothic-Cyberpunk', lore: GOTHIC_LORE };
    const installed = installPack(DEFAULT_SETTINGS, pack, 'id-x', deps);
    const active = activatePack(installed, 'id-x');
    expect(active.packLibrary).toHaveLength(1);
    expect(active.activeLorePackId).toBe('id-x');
    expect(active.customLore).toBe(GOTHIC_LORE);
  });
});
```

- [ ] **Step 2: Run to verify it passes already** (Tasks 3+4 make this green — this test locks the composition the modal will use)

Run: `npx jest packLibrary -t "import flow"`
Expected: PASS.

- [ ] **Step 3: Rewire `_commit`** in `src/modals/PackIoModal.ts`. Replace the `applyPack` import usage. Update the imports at the top:

```ts
import { validatePack, type PackIssue } from '../engine/PackValidator';
import { installPack, activatePack } from '../utils/packLibrary';
import { GOTHIC_LORE, COZY_LORE } from '../data/default-lore';
```

(Remove `applyPack` from the import if it is no longer referenced elsewhere in this file.)

Replace the body of `_commit`:

```ts
  private async _commit(pack: KuroPack): Promise<void> {
    const lang = this.plugin.data.settings.language;
    const id = crypto.randomUUID();
    const deps = { gothicLore: GOTHIC_LORE, cozyLore: COZY_LORE, lang };
    this.plugin.data.settings = activatePack(installPack(this.plugin.data.settings, pack, id, deps), id);
    await this.plugin.persist();
    await this.plugin.refreshStatus(true);
    if (this.plugin.data.settings.enableNotices) {
      const units = detectUnits(pack).join(', ');
      new Notice(t('modal.pack.import.successUnits', lang, { units }));
    }
    this.close();
  }
```

- [ ] **Step 4: Full suite + build**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS. (`applyPack` remains defined in `PackValidator` for `activatePack`'s conceptual role and any other callers; leave it.)

- [ ] **Step 5: Commit**

```bash
git add src/modals/PackIoModal.ts tests/packLibrary.test.ts
git commit -m "feat(packs): import installs into the library and activates it"
```

---

### Task 11: Settings — „📚 Packs" section (UI)

**Files:**
- Modify: `40_src/src/settings/SettingsTab.ts` (add a new collapsible section; move pack import/export buttons here)
- Modify: `40_src/styles.css` (pack row + badge styling, minimal)
- Verify: build + manual smoke (UI-glue; the mutating logic is covered by Tasks 3–7)

**Interfaces:**
- Consumes: `activeNames`, `activatePack`, `deletePack`, `resetSection` (Tasks 4–7); `confirmModal` from `../modals/ConfirmModal`; existing collapsible-section helper used elsewhere in `SettingsTab`.

- [ ] **Step 1: Locate the existing collapsible-section pattern** in `SettingsTab.ts` (search for how `uiCollapsed` and the existing Lore/Loot/Habits sections are built). Reuse that exact helper for a new section keyed `'packs'`.

- [ ] **Step 2: Render the section.** Add a `renderPacksSection(container)` method and call it in the tab's `display()` alongside the other sections. Body:

```ts
private renderPacksSection(root: HTMLElement): void {
  const s = this.plugin.data.settings;
  const lang = s.language;
  const names = activeNames(s, lang);

  new Setting(root).setName(t('set.packs.name', lang)).setDesc(t('set.packs.desc', lang)).setHeading();
  root.createEl('p', { cls: 'kuro-packs-active', text: t('set.packs.activeHeading', lang, names) });

  if (s.packLibrary.length === 0) {
    root.createEl('p', { cls: 'kuro-packs-empty', text: t('set.packs.empty', lang) });
  }

  for (const pack of s.packLibrary) {
    const isLoreActive = s.activeLorePackId === pack.id;
    const isLootActive = s.activeLootPackId === pack.id;
    const badge = [isLoreActive ? 'lore' : null, isLootActive ? 'loot' : null].filter(Boolean).join(' + ');
    const label = badge ? `${pack.name} — ${t('set.packs.badge.active', lang)}: ${badge}` : pack.name;
    new Setting(root)
      .setName(label)
      .addButton((b) => b.setButtonText(t('set.packs.activate', lang)).onClick(async () => {
        this.plugin.data.settings = activatePack(this.plugin.data.settings, pack.id);
        await this.plugin.persist();
        await this.plugin.refreshStatus(true);
        if (this.plugin.data.settings.enableNotices) new Notice(t('notice.pack.activated', lang, { name: pack.name }));
        this.display();
      }))
      .addButton((b) => b.setButtonText(t('set.packs.delete', lang)).setWarning().onClick(async () => {
        const ok = await confirmModal(this.app, {
          title: t('modal.pack.delete.title', lang),
          body: t('modal.pack.delete.body', lang, { name: pack.name }),
          confirmText: t('modal.pack.delete.confirm', lang),
          cancelText: t('modal.pack.delete.cancel', lang),
        });
        if (!ok) return;
        this.plugin.data.settings = deletePack(this.plugin.data.settings, pack.id);
        await this.plugin.persist();
        await this.plugin.refreshStatus(true);
        if (this.plugin.data.settings.enableNotices) new Notice(t('notice.pack.deleted', lang, { name: pack.name }));
        this.display();
      }));
  }

  new Setting(root)
    .addButton((b) => b.setButtonText(t('set.packs.resetLore', lang)).onClick(async () => {
      this.plugin.data.settings = resetSection(this.plugin.data.settings, 'lore');
      await this.plugin.persist(); await this.plugin.refreshStatus(true); this.display();
    }))
    .addButton((b) => b.setButtonText(t('set.packs.resetLoot', lang)).onClick(async () => {
      this.plugin.data.settings = resetSection(this.plugin.data.settings, 'loot');
      await this.plugin.persist(); await this.plugin.refreshStatus(true); this.display();
    }));
}
```

Add imports to `SettingsTab.ts`: `import { activeNames, activatePack, deletePack, resetSection } from '../utils/packLibrary';`, `import { confirmModal } from '../modals/ConfirmModal';`, and `Notice` from `obsidian` if not already imported. Wire the existing Import/Export pack buttons into this section (move them from their current Lore/Loot location).

- [ ] **Step 3: Minimal styling** in `styles.css`:

```css
.kuro-packs-active { font-size: var(--font-ui-small); color: var(--text-muted); margin: 0 0 var(--size-4-2); }
.kuro-packs-empty { color: var(--text-muted); font-style: italic; }
```

- [ ] **Step 4: Build + typecheck + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors. (Confirms the UI compiles and the tsc gate passes.)

- [ ] **Step 5: Manual smoke** (deploy to the production test vault, back up `data.json` first):

```bash
cp "<vault>/.obsidian/plugins/kuro-gamification/data.json" \
   "<vault>/.obsidian/plugins/kuro-gamification/data.json.bak"
OBSIDIAN_PLUGIN_DIR="<vault>/.obsidian/plugins/kuro-gamification" npm run deploy
```

Smoke checklist (in Obsidian, reload plugin): the „📚 Packs" section shows Jay's migrated „Gothic-Cyberpunk" as active lore; import a second pack → appears + activates; activate the first → swaps; delete a pack → confirm dialog → reverts to factory if it was active; „Loot auf Factory" works. XP/level unchanged throughout.

- [ ] **Step 6: Commit**

```bash
git add src/settings/SettingsTab.ts styles.css
git commit -m "feat(packs): 📚 Packs settings section (activate/delete/reset, active names)"
```

---

### Task 12: Docs — mention the library

**Files:**
- Modify: `40_src/docs/manual.de.md`, `40_src/docs/manual.en.md` (Pack-Import section)
- Modify: `40_src/docs/customization.de.md`, `40_src/docs/customization.en.md` (import section)

**Interfaces:** none (docs).

- [ ] **Step 1: Update the manual pack sections.** In both `manual.de.md` and `manual.en.md`, in the „Pack-Import und -Export" / "Pack import and export" section, add one sentence after the import paragraph:

DE: `Importierte Packs landen in der **Pack-Bibliothek** (Einstellungen → 📚 Packs). Dort siehst du, welches Pack pro Sektion (Lore/Loot) aktiv ist, kannst zwischen mehreren installierten Packs wechseln, einzelne löschen und pro Sektion auf den Factory-Default zurück.`

EN: `Imported packs land in the **pack library** (Settings → 📚 Packs). There you can see which pack is active per section (lore/loot), switch between several installed packs, delete individual ones, and reset a section to the factory default.`

- [ ] **Step 2: Update the customization import sections** (`customization.de.md` §4 / `customization.en.md` §4) with the same one-sentence pointer (translated to match each file's tone).

- [ ] **Step 3: Commit**

```bash
git add docs/manual.de.md docs/manual.en.md docs/customization.de.md docs/customization.en.md
git commit -m "docs(packs): document the pack library (activate/switch/delete)"
```

---

## Self-Review

**Spec coverage:**
- Speicherort/Datenmodell (spec ①) → Task 1. ✓
- Verhalten pure Funktionen (spec ②) → Tasks 2–7 (`resolvePackName`, `installPack`, `activatePack`, `deletePack`, `resetSection`, `activeNames`). ✓
- Import = install + activate (spec ②) → Task 10. ✓
- UI-Fläche „📚 Packs" (spec ③) → Task 11. ✓
- Migration (spec ④) → Task 8. ✓
- Löschen mit Confirm (spec ⑤) → Task 11 (`confirmModal`). ✓
- Habits außen vor → nichts berührt `settings.habits`. ✓
- Full-State-Export nimmt `packLibrary` automatisch mit (Teil von `settings`) → keine Task nötig; im Task-11-Smoke mit verifizierbar. ✓
- Cache↔Zeiger-Invariante → getestet in Tasks 4/5/8. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code. Test steps show real assertions. The i18n stub notes in Tasks 2/7/8 are explicit interim keys finalized in Task 9 (not placeholders). ✓

**Type consistency:** `NameDeps` defined in Task 2, reused in Tasks 3/8/10. `InstalledPack` defined in Task 1, used throughout. Function names stable: `installPack`/`activatePack`/`deletePack`/`resetSection`/`activeNames`/`migrateToLibrary`/`resolvePackName`/`sameLore`. Settings fields `packLibrary`/`activeLorePackId`/`activeLootPackId` consistent across tasks. ✓

**Notes for the implementer:**
- `DataStore.test.ts` constructs the store as `new DataStore(fakePlugin as any)` where `fakePlugin = { loadData: () => Promise.resolve(null), saveData: () => Promise.resolve() }` — with `loadData` hardcoded to `null`. For the new tests, build a per-test `fakePlugin` whose `loadData` returns the test `raw` (as the Task 1/8 test code shows), keeping the `as any`/`as never` cast the suite uses.
- `t()` does not throw on unknown keys (returns `dict.en[key] ?? key`), but `i18n.test.ts` enforces `Object.keys(en) === Object.keys(de)`. So every interim stub key in Tasks 2/7/8 MUST be added to BOTH `de.ts` and `en.ts`, and the tests that assert resolved strings (`'Importiertes Pack'`, `'Factory-Default'`) need those keys defined at that point — they are not optional.
