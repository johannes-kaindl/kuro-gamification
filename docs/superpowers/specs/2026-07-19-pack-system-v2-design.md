# Pack-System v2 — Trennung, Datei-I/O, Factory-Reset

**Datum:** 2026-07-19
**Status:** Design freigegeben (Brainstorming), Spec zur Review
**Kontext:** Folgt auf den Adoption-Polish-Batch (`feat/adoption-polish`). Baut auf den
dort eingeführten sprachabhängigen Factory-Defaults (Plain-Lore, generischer Loot-Pool,
Locale-Seeding) auf.

## Problem

Das aktuelle Customization-System ist zu grob und zu autor-zentriert für eine
Veröffentlichung:

- **Ein gebündeltes Format** (`KuroPack = {loot, lore}`) — Tonalität und Loot lassen sich
  nicht getrennt teilen; Habits sind gar nicht als teilbare Einheit modelliert.
- **Kein echter Datei-I/O** — nur Textarea/Zwischenablage (Copy/Paste).
- **Gebündelte Beispiel-Packs** (Gothic/Plain/Cozy) als Template-Picker im Import-Modal —
  vermischt „Factory-Default" mit „importierbaren Alternativen".
- **Habits-Factory ist leer** (`habits: []`) — ein neuer User sieht eine leere Liste statt
  generischer Starter-Habits.

## Ziel

Drei unabhängig teilbare Einheiten — **Tonalität (Lore)**, **Loot**, **Habits** — jeweils
per Datei **und** Zwischenablage im-/exportierbar, mit **Reset auf Factory** pro Einheit.
Factory-Default ist ausschließlich **Plain** (sprachabhängig DE/EN). Alternative Packs
(Gothic, Cozy) werden als `.json`-Dateien im Repo verteilt, nicht mehr im Plugin gebündelt.

## Nicht-Ziele (bewusst später)

- In-Plugin-LLM-Editor zum Anpassen von Packs.
- Coach/„Uplink"-Feature.
- Weitere Sprachen jenseits DE/EN.

## Design

### ① Datenmodell

`KuroPack` wird erweitert, **alle Content-Sektionen optional**:

```ts
interface KuroPack {
  kuroPack: number;                              // Format-Version (1)
  name?: string;
  lore?: KuroLoreFragment[];                     // → customLore
  loot?: Partial<Record<KuroLootTier, KuroLootDrop[]>>;  // → customLootPool
  habits?: KuroHabit[];                          // → settings.habits (NEU)
}
```

`applyPack(settings, pack)` wendet **nur vorhandene** Sektionen an:

```ts
if (pack.lore   !== undefined) next.customLore     = pack.lore;
if (pack.loot   !== undefined) next.customLootPool = pack.loot;
if (pack.habits !== undefined) next.habits         = pack.habits;
```

Ein Import erkennt automatisch, welche Sektionen ein Pack enthält (Auto-Detect), und wendet
genau diese an. Ein „nur Lore"-Export ist also ein `KuroPack` mit ausschließlich `lore`.

### ② Factory-Defaults (sprachabhängig DE/EN)

| Einheit | Factory | Resolution |
|---------|---------|-----------|
| Lore    | **Plain** (`PLAIN_LORE_DE`/`_EN`) — bereits gebaut | `defaultLore(lang)` bei `customLore == null` |
| Loot    | Generischer Self-Care-Pool (57 Einträge DE/EN) — bereits gebaut | `defaultLootPool(lang)` bei `customLootPool == null` |
| Habits  | **NEU:** generisches Starter-Set (~5), sprachabhängig | einmalig in `settings.habits` geseedet beim Fresh-Install |

Generisches Habit-Set (Default, je 10 XP):
`💧 Wasser trinken · 🚶 10 Min bewegen · 🌳 Frische Luft · 🧹 5 Min aufräumen · 💬 Bei jemandem melden`
(EN: `Drink water · Move 10 min · Fresh air · Tidy 5 min · Reach out to someone`).

Habits sind — anders als Lore/Loot — konkrete, editierbare Settings-Daten (kein
Read-Time-Resolver). Deshalb werden sie beim Fresh-Install **einmalig** in `settings.habits`
geseedet (in `seedFreshInstallDefaults()`, gated auf `!onboardingShown && habits.length === 0`),
in der erkannten UI-Sprache. Bestehende Installs behalten ihre Habits unangetastet.

Neuer Frontmatter-Key-Konvention der generischen Habits: englische, neutrale Keys
(`water`, `move`, `outside`, `tidy`, `connect`).

### ③ Import/Export-UX

Die Settings-Sektion Loot/Lore wird zu drei **einklappbaren** Bereichen (Lore, Loot, Habits)
— übersichtlicher als eine flache Liste. Umgesetzt über die Kit-`collapsibleSection`
(REGISTRY §83, `obsidian-kit@0.13.0`; von vault-rag/yijing/vim-dojo/lig genutzt). Vendoring
mit den dokumentierten Gotchas: obsidian-gekoppeltes Modul in eigene Ablage
(`src/vendor/kit-obsidian/`, nicht `src/vendor/kit/`), `COLLAPSIBLE_CSS` in `styles.css`
übernehmen, Klapp-Zustand an ein neues `settings.uiCollapsed` binden.

Pro Einheit dieselben fünf Aktionen:

| Aktion | Mechanik |
|--------|----------|
| **Datei importieren** | verstecktes `<input type="file" accept=".json">` → Datei lesen → validieren → anwenden |
| **Exportieren** | `Blob`([JSON]) → Download-Anchor `<einheit>-kuro-pack.json` |
| **Einfügen** | Modal mit Textarea: JSON einfügen + Name festlegen → validieren → anwenden |
| **Kopieren** | JSON der Einheit in die Zwischenablage (`navigator.clipboard`) |
| **Reset auf Factory** | setzt `customX = null` (Lore/Loot) bzw. Habits auf generisches Set → Factory greift wieder |

Validierung läuft immer über den (erweiterten) `PackValidator` — auch bei Datei- und
Zwischenablage-Import (progress-safe: XP/Fortschritt werden nie angefasst).

Der **volle Settings-Backup** (`ExportDataModal`/`ImportDataModal`, ganzer `plugin.data`)
bleibt unverändert im Advanced-Tab.

### ④ Gebündelte Packs → Repo-Dateien

Der `EXAMPLE_PACKS`-Template-Picker im Import-Modal **entfällt**. Gothic und Cozy werden zu
fertigen `.json`-Dateien unter `packs/` im Repo (`packs/gothic-lore.kuro.json`,
`packs/cozy-lore.kuro.json`), die ein User herunterlädt und importiert. Plain bleibt der
Factory-Default (kein Import nötig). Der Guide (HelpModal + README) verweist auf `packs/`
und den Export→LLM→Import-Flow.

`GOTHIC_LORE`/`COZY_LORE` bleiben als Datenquelle im Code (zur Generierung der Repo-Dateien),
werden aber nicht mehr im Picker angeboten. Alternativ als reine `.json` ausgelagert — im
Plan zu entscheiden.

### ⑤ Migration / Rückwärtskompatibilität

- Bestehende Installs: `customLootPool` / `customLore` / `habits` bleiben unangetastet
  (Deep-Merge). Kein `schemaVersion`-Bump.
- Alte `{loot, lore}`-Packs bleiben importierbar (fehlende `habits`-Sektion = optional).
- Reset pro Einheit ist verlustfrei bzgl. Fortschritt (setzt nur Content-Settings zurück).

## Testing

- `PackValidator`: `habits`-Sektion (Struktur: `{key, label, xp}`), Teil-Packs (nur eine
  Sektion), leeres Pack, gemischte gültige/ungültige Sektionen.
- `applyPack`: jede Sektion einzeln + Kombinationen; nicht vorhandene Sektionen unangetastet.
- Habits-Factory-Seeding: Fresh-Install seedet generische Habits in erkannter Sprache;
  bestehender Install (habits vorhanden) bleibt unverändert.
- Auto-Detect-Import: erkennt vorhandene Sektionen korrekt.
- Datei-I/O + Modals: UI-Glue, untestet (konsistent mit den übrigen Modals).

## Offene Punkte für den Plan

- Genaue Ablage/Generierung der `packs/`-Dateien (im Code behalten vs. reine JSON).
- Kit-`collapsibleSection` vendoren (§③): Ablage `src/vendor/kit-obsidian/`, `COLLAPSIBLE_CSS`
  in `styles.css`, neues `settings.uiCollapsed`-Feld, `AbstractInputSuggest`-artiger
  Mock-Bedarf prüfen (`setIcon` ist im obsidian-Mock bereits vorhanden).
