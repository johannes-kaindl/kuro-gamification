# Pack-Bibliothek — mehrere installiert, eines aktiv pro Sektion

**Datum:** 2026-07-23
**Status:** Design freigegeben (Brainstorming), Spec zur Review
**Kontext:** Folgt auf Pack-System v2 (`main` @ `a3c7ec9`) und den Pre-1.0-Doku-Sweep
(`2e78cd5`). Baut auf dem dort etablierten `KuroPack`-Format und `applyPack`/`PackValidator`
auf. Ausgelöst durch den v2-Smoke (JK, 2026-07-20): nach einem Import ist nirgends sichtbar,
welches Pack aktiv ist, und man kann nur ein einziges „nacktes" Custom-Set halten.

## Problem

Ein Import schreibt heute nur den **nackten Inhalt** (`customLore` / `customLootPool` /
`habits`) in die Settings. Der Pack-`name` aus der Datei wird **verworfen**. Es gibt kein
Konzept von „installiert" vs. „aktiv":

- Man sieht nirgends, welches Pack gerade wirkt.
- Man kann nicht mehrere Packs vorhalten und zwischen ihnen wechseln.
- Ein neuer Import überschreibt den vorigen ohne Spur.

## Ziel

Eine **gemeinsame Pack-Bibliothek**: mehrere Packs installiert, pro Sektion (Lore, Loot)
**genau eines aktiv**, einzeln löschbar, aktiver Name sichtbar. Aktivieren ist
**non-destruktiv** — es wendet nur die Sektionen an, die das Pack trägt, und lässt andere
Sektionen unangetastet (derselbe Sicherheits-Ethos wie „Import fasst XP/Fortschritt nie an").

## Nicht-Ziele (bewusst später / außen vor)

- **Habits sind nicht Teil der Bibliothek.** Sie sind persönliche, editierbare Settings-Daten,
  kein teilbares „Theme". Sie bleiben Settings-Edit + Full-Backup, unverändert zu heute.
- Packs als Dateien in einem Vault-Ordner (verworfen zugunsten data.json — siehe ①).
- In-Plugin-LLM-Editor, Coach/Uplink, weitere Sprachen jenseits DE/EN.
- Sidebar-Anzeige des aktiven Packs (YAGNI — die Anzeige lebt im Settings-Tab).

## Design

### ① Speicherort & Datenmodell

Die Bibliothek lebt in **`data.json`** (Plugin-Daten), wie `customLore` heute schon — kein
Datei-Management, keine Sync-Konflikte, keine neuen Fehlerquellen. Ein Pack ist ~1–3 KB;
realistisch eine Handvoll → die data.json-Vergrößerung ist unkritisch.

Neue Felder in `KuroSettings`:

```ts
interface InstalledPack {
  id: string;                 // stabile ID (injiziert → testbar, kein Date.now/random im Pure-Core)
  name: string;               // wird nie mehr verworfen
  lore?: KuroLoreFragment[];
  loot?: Partial<Record<KuroLootTier, KuroLootDrop[]>>;
}

// KuroSettings-Ergänzungen:
packLibrary: InstalledPack[];        // Default []
activeLorePackId: string | null;     // null = Factory-Default
activeLootPackId: string | null;     // null = Factory-Default
```

**Zeiger sind die Wahrheit; `customLore`/`customLootPool` bleiben als abgeleiteter Cache**,
den die Engines bereits lesen. Die Mutations-Funktionen halten den Cache synchron — die
Engines bleiben **unangetastet** (die load-bearing Engine↔Obsidian-Grenze wird nicht
berührt). Invariante, test-abgesichert nach jeder Operation:

```
customLore     === activeLorePackId ? lib.find(activeLorePackId).lore : null
customLootPool === activeLootPackId ? lib.find(activeLootPackId).loot : null
```

### ② Verhalten (pure Funktionen, Node-testbar)

Neues Modul `src/utils/packLibrary.ts` (oder `engine/` — im Plan festlegen), **frei von
Obsidian-Imports**:

| Funktion | Wirkung |
|----------|---------|
| `installPack(settings, pack, id)` | legt `InstalledPack` an (Name behalten; fehlt er → `resolvePackName`), **ohne** zu aktivieren. Gibt id-tragende Kopie zurück. |
| `activatePack(settings, id)` | setzt für **jede Sektion, die das Pack trägt**, Zeiger + Cache; andere Sektionen unangetastet. |
| `deletePack(settings, id)` | entfernt aus `packLibrary`; war es für eine Sektion aktiv → diese Sektion auf Factory (Zeiger + Cache → null). |
| `resetSection(settings, 'lore'\|'loot')` | Zeiger + Cache der Sektion → null (Factory-Default greift). |
| `resolvePackName(pack, {gothicLore, cozyLore, lang})` | Content-Match: `lore` deep-equals `GOTHIC_LORE` → „Gothic-Cyberpunk", `COZY_LORE` → „Cozy", sonst lokalisiert „Importiertes Pack". |
| `activeNames(settings, lang)` | `{ lore: string, loot: string }` — Name des aktiven Packs oder lokalisiert „Factory-Default". |
| `migrateToLibrary(settings, {gothicLore, cozyLore, lang})` | siehe ④. |

**Import = installieren + aktivieren** in einem Schritt (behält die heutige UX, wo ein Import
sofort wirkt): validieren (unverändert) → `installPack` → `activatePack`. Der `_commit`-Pfad
im `ImportPackModal` ruft künftig diese beiden statt des flachen `applyPack`.

`applyPack` bleibt als Low-Level-Helfer erhalten (von `activatePack` intern genutzt) — kein
Bruch der v2-Semantik.

### ③ UI-Fläche

Eine eigene, **einklappbare** Settings-Sektion **„📚 Packs"** (Obsidian-native Components,
`UI-STANDARD.md`; Klapp-Zustand an das bestehende `uiCollapsed`-Muster):

- Kopfzeile: **„Aktiv — Lore: `<Name>` · Loot: `<Name>`"** (aus `activeNames`).
- Liste der installierten Packs, je Zeile: Name, Sektions-Badges (welche Sektionen es trägt +
  ob aktiv), Button **`Aktivieren`**, Button **`Löschen`**.
- Pro Sektion ein **`Zurück auf Factory`**.
- Import/Export-Buttons ziehen in diese Sektion (heute unter Loot/Lore verteilt).

### ④ Migration / Rückwärtskompatibilität

Beim Load, **einmalig** wenn `packLibrary === undefined` (Alt-Daten vor diesem Feature):

- Ist `customLore` gesetzt → Bibliothekseintrag anlegen, via `resolvePackName` benennen
  (Jays importierte Gothic-Lore → **„Gothic-Cyberpunk"**), `activeLorePackId` darauf setzen.
- Ist `customLootPool` gesetzt → analog, `activeLootPackId` setzen.
- Ist beides null → leere Bibliothek, beide Zeiger null (reiner Factory-Zustand).

Idempotent (Guard `packLibrary === undefined`), sprachabhängige Fallback-Namen. Kein
`schemaVersion`-Bump nötig (rein additive Felder mit sicheren Defaults). Alte `{loot, lore}`-
und Teil-Packs bleiben unverändert importierbar.

### ⑤ Löschen

Löschen läuft über ein **leichtes ConfirmModal** (das bereits übernommene finance-ledger-
Muster, wie bei `resetUnit`) — Löschen entfernt installierten Inhalt, das rechtfertigt eine
Rückfrage. War das Pack aktiv, fällt die Sektion auf Factory zurück. XP/Fortschritt nie
betroffen.

## Testing

**Pure Funktionen — vollständig TDD:** `installPack`, `activatePack` (jede Sektions-
Kombination; non-carried Sektionen unangetastet), `deletePack` (inkl. „aktives Pack gelöscht →
Sektion auf Factory"), `resetSection`, `resolvePackName` (Content-Match Gothic/Cozy + Fallback),
`activeNames`, `migrateToLibrary` (customLore→benannt+aktiv; leerer Zustand; Idempotenz).

**Invarianten-Test:** nach jeder Mutation gilt die Cache↔Zeiger-Invariante aus ①.

**Bestehende Pack-Tests bleiben grün** (`packs-files.test.ts` inkl. neuem Drift-Guard,
`PackValidator.test.ts`, `pack-sections.test.ts`, `lore-language.test.ts`).

**Runtime-gekoppelte UI wird NICHT als „untestbar" abgehakt** (LESSONS 2026-07-20: zwei Bugs
saßen in v2-Code, den der Plan als „UI-Glue, bleibt untestet" deklariert hatte). Wo ein
Settings-Handler eine pure Mutation aufruft, wird die Verdrahtung über die pure Funktion
getestet; für Dialog-Lifecycle (ConfirmModal beim Löschen) die Abhängigkeit injizieren und
den Callback-Pfad testen — analog `resetUnit`/`main-onload`.

## Offene Punkte für den Plan

- Ablage der pure Funktionen: `src/utils/packLibrary.ts` vs. `src/engine/PackLibrary.ts`
  (Konsistenz mit bestehender Engine-Konvention prüfen).
- ID-Quelle im UI-Layer: `crypto.randomUUID()` (Electron vorhanden) injiziert in `installPack`.
- Exakte i18n-Keys (`set.packs.*`, `modal.pack.delete.*`, Fallback-Namen „Importiertes Pack").
- Ob der volle Full-State-Export (`ExportDataModal`) `packLibrary` mitnimmt — vermutlich ja
  (es ist Teil von `plugin.data.settings`), im Plan verifizieren.
