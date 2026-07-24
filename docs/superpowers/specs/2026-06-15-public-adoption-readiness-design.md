# Design-Spec — Public-Adoption-Readiness für Kuro Gamification

> **Status:** Entwurf zur Freigabe · **Datum:** 2026-06-15 · **Autor:** Claude (mit JK)
> **Kontext-Quelle:** Codebasis-Karte (5-Agent-Sweep `wj6qz230e`, 2026-06-15) + Brainstorming-Session.
> **Nachfolge-Artefakt:** Implementierungsplan via `writing-plans` (noch nicht erstellt).

## 1. Kontext & Ziel

Kuro Gamification ist v1.0.0, technisch sauber, leitkonventions-konform und 79/79 Tests grün —
also **einreichbar**, aber noch nicht **für Fremde wertvoll**. Strategische Richtung (JK, 2026-06-14):
Polish-first & bewusst lokal, Ziel später Obsidian-Community-Submission.

Dieses Vorhaben erweitert „Polish" um **echte Nutzbarkeit für andere neurodivergente Menschen**.
Kernerkenntnis der Codebasis-Karte: **Die schwere Arbeit ist großteils getan** — die Engines sind
bereits daten-getrieben (`customLootPool`, `customLore`, `levels`, `habits`, `xpParams` alle
überschreibbar). Die Lücken liegen an der **Oberfläche**: Anpassung ist hinter einer JSON-Wand
versteckt, es gibt kein Onboarding, und die Doku ist deutsch-first + verstreut.

### Leitentscheidung (Brainstorming)

Anpassung erfolgt **nicht** über Formular-Editoren, sondern über **LLM-assistierten Pack-Import**:
Nutzer:innen lassen sich von einem LLM ihrer Wahl (mit dokumentierten Prompts) ein themen-stimmiges
Loot-/Lore-Set als JSON erzeugen und importieren es. Das ist billiger zu bauen, für diesen Use-Case
sogar *besser* (ein LLM erzeugt ein kohärentes Set in einem Rutsch) und liefert **Sharing gratis**
(der Pack *ist* das teilbare Artefakt).

## 2. Scope & Non-Goals

### In Scope (vier Säulen)
1. **LLM-assistierte Anpassung** — fokussiertes Pack-Format + validierter Import/Export (Approach A).
2. **Leichtes Onboarding** — Welcome-Modal + geführter Empty-State.
3. **Zweisprachige Doku (EN+DE-Parität)** — Getting-Started, Design-Philosophie, Customization-Guide, `manual.en.md`.
4. **Robustheit für Fremde** — Pack-Validierung mit klaren Fehlern; gebündelte Theme-Packs (Gothic/Plain/Cozy) via Picker; Default-Sanity.

### Non-Goals (bewusst YAGNI)
- **Keine** Formular-/UI-Editoren für Loot/Lore (der LLM-Pack-Weg ersetzt sie).
- **Kein** Sharing-Marketplace/-Registry (der Pack als JSON-Datei reicht; Registry wäre verfrüht bei null Usern).
- **Kein** Vault-Datei-basiertes Pack-Loading (`kuro-pack.json` im Vault) — Copy-Paste aus dem LLM-Chat ist für v1 natürlicher.
- **Kein** mehrstufiger Setup-Wizard (Risiko gegen „off-by-default"; leichtes Onboarding genügt).
- **Keine** Änderung der Lore-Replace-Semantik (siehe §9, Entscheidung D-2 — als Future markiert).
- **Kein** Settings-Theme-Schalter / Theme-Manager — der Vorlagen-Picker im Import-Modal genügt (D-4).
- **Keine** Übernahme von NeuroVim-Narrativ und **keine** NeuroVim-artige Content-Build-Pipeline/ContentPort (D-4).
- **Kein** vollständiger Accessibility-Audit (über das bestehende `reduceAnimations` hinaus) — als Future markiert (§11).

## 3. Säule 1 — LLM-assistierte Anpassung

### 3.1 Pack-Format (`KuroPack`)

Ein kleines, versioniertes, **LLM-freundliches** JSON-Format. Beide Inhaltsfelder optional
(nur Loot, nur Lore, oder beides):

```jsonc
{
  "kuroPack": 1,                 // Format-Version (number, Pflicht)
  "name": "Cottagecore",          // optionales Label (string)
  "loot": {                        // optional → mappt auf settings.customLootPool
    "common":    [{ "name": "Tee in der Lieblingstasse", "cat": "Komfort" }],
    "rare":      [ /* … */ ],
    "epic":      [ /* … */ ],
    "legendary": [ /* … */ ],
    "mythic":    [ /* … */ ]
  },
  "lore": [                        // optional → mappt auf settings.customLore
    { "level": 1, "title": "…", "text": "…" }
  ]
}
```

**Mapping (1:1 auf bestehende Typen, keine neuen Engine-Konzepte):**
- `loot` → `KuroSettings.customLootPool: Partial<Record<KuroLootTier, KuroLootDrop[]>>` (types.ts:106)
- `lore` → `KuroSettings.customLore: KuroLoreFragment[]` (types.ts:107)

**Per-Tier-Merge ist bereits gegeben:** `LootEngine.poolFor` (LootEngine.ts:42) prüft pro Tier
`customLootPool?.[tier]?.length` und fällt sonst auf `DEFAULT_LOOT_POOL[tier]` zurück. Ein Pack mit
nur `common` + `rare` lässt `epic/legendary/mythic` also automatisch auf den Defaults — gewollt.

### 3.2 Validierung (Pure Function — Schichtengrenze!)

Neue Datei `40_src/src/engine/PackValidator.ts` (oder `validation/`), **frei von Obsidian-Imports**,
in Node testbar — passt exakt ins bestehende Pure-Engine-Pattern.

```ts
export interface PackIssue { path: string; message: string; suggestion?: string }
export type PackValidation =
  | { ok: true;  pack: KuroPack; warnings: PackIssue[] }
  | { ok: false; errors: PackIssue[] };

export function validatePack(raw: unknown): PackValidation
```

**Fehler (blockierend):**
- Top-Level kein Objekt.
- `kuroPack` fehlt / keine Zahl.
- Weder `loot` noch `lore` vorhanden (leerer Pack).
- `loot`: unbekannter Tier-Key (z.B. `"epc"`) → Fehler **mit Vorschlag** („meintest du `epic`? Erlaubt: common/rare/epic/legendary/mythic").
- `loot`: Tier-Wert kein Array, oder Item ohne `name`/`cat` bzw. Nicht-String.
- `lore`: kein Array, oder Fragment ohne `level`(number)/`title`(string)/`text`(string).

**Warnungen (nicht-blockierend, „trotzdem anwenden"):**
- `loot` vorhanden, aber nicht alle 5 Tiers belegt → „Tier X nutzt weiter die Standard-Belohnungen."
- `lore` vorhanden, deckt aber nicht alle Level aus `settings.levels` ab → „Level ohne eigenes Fragment
  zeigen **kein** Lore (Standard-Lore wird durch Custom-Lore vollständig ersetzt)." (siehe §9 / D-2)

Kein stiller Fallback auf Defaults bei Tippfehlern (heute der Fall, DataIoModal.ts:70-73 zeigt nur
eine generische `Notice`). Fehler werden **inline im Modal** als Liste gerendert, der Import wird
**nicht** angewandt, solange Fehler bestehen.

### 3.3 Import/Export-Mechanik (Approach A — dediziert, getrennt vom Full-State-Backup)

**Wichtig:** Der bestehende `ImportDataModal` (DataIoModal.ts:41) importiert via
`dataStore.merge(parsed)` den **kompletten** Plugin-State — der bleibt unverändert für Backup/Restore.
Der Pack-Import ist **getrennt** und **chirurgisch**: er setzt nur `settings.customLootPool` und/oder
`settings.customLore`, **XP/Fortschritt/andere Settings bleiben unangetastet**.

Neue Datei `40_src/src/modals/PackIoModal.ts`:
- **`ImportPackModal`**
  1. **Vorlagen-Picker** (oben): „Oder wähle eine mitgelieferte Vorlage: [Gothic-Cyberpunk] [Plain/Calm] [Cozy]".
     Auswahl füllt die Textarea mit dem gebündelten Pack — **sichtbar & editierbar**, nicht direkt angewandt — gespeist
     aus `src/data/example-packs.ts` (§5/§7). Kein Theme-Manager, nur Vorbefüllung (D-4).
  2. Textarea für JSON + kurzer Hinweistext + Link zur Customization-Doku.
  3. Bei „Anwenden": `JSON.parse` → `validatePack`.
     - Bei Fehlern: Liste inline rendern, **nicht** anwenden.
     - Bei OK (ggf. mit Warnungen): Warnungen anzeigen + „Trotzdem anwenden"-Bestätigung; dann
       `data.settings.customLootPool` / `data.settings.customLore` aus dem Pack setzen (nur vorhandene Felder),
       `plugin.persist()` + `plugin.refreshStatus(true)`.
- **`ExportPackModal`**
  - Serialisiert das **effektive** Set als `KuroPack`: `customLootPool ?? DEFAULT_LOOT_POOL`,
    `customLore ?? DEFAULT_LORE`. So bekommt man auch ohne eigene Anpassung die **Defaults als editierbare
    Vorlage** (idealer Startpunkt für „lass das LLM das umschreiben").
  - Copy-to-Clipboard analog `ExportDataModal` (DataIoModal.ts:26-33).

**Verdrahtung:**
- `registerCommands.ts`: zwei neue Commands `import-pack`, `export-pack` (Pattern wie Z.68-78).
- `SettingsTab.ts`: zwei Buttons in der bestehenden Loot/Lore-Sektion (`_renderLootLore`) — heute
  gibt es dort keine Custom-Pool-Bedienelemente.
- `i18n/en.ts` + `i18n/de.ts`: neue Keys (`cmd.importPack`, `cmd.exportPack`, `modal.pack.*`,
  Fehler-/Warn-Texte). `t()` (i18n/index.ts:11) unterstützt `{var}`-Interpolation für Vorschläge.

## 4. Säule 2 — Leichtes Onboarding

### 4.1 Welcome-Modal (einmalig)
- Neues Feld `onboardingShown: boolean` in `KuroPluginData` + `DEFAULT_PLUGIN_DATA` (types.ts:220).
  `DataStore.merge` (DataStore.ts:24) spreadet `DEFAULT_PLUGIN_DATA` → Feld existiert forward-compatible.
- **Upgrader nicht belästigen:** In `DataStore.migrate` (DataStore.ts:52) bestehende Installationen
  (erkennbar an vorhandenen `redeemedDrops`/`manualXpAdjustments`/`totalXp`) auf `onboardingShown = true` setzen.
- Neue Datei `modals/WelcomeModal.ts`. In `main.ts` `onLayoutReady` (main.ts:64): wenn `!data.onboardingShown`,
  Modal öffnen; bei Schließen `onboardingShown = true` + `persist()`.
- Inhalt: Was ist das Plugin (1 Absatz) · der 3-Schritt-Pfad (Daily-Note-Pfad prüfen → Habit/Checkbox → XP)
  · Buttons: „Einstellungen öffnen", „Getting-Started lesen" (öffnet Doku-URL), „Eigene Belohnungen?" (öffnet Pack-Import).
- **Off-by-default-treu:** rein informativ, schaltet **nichts** Eskalierendes ein.

### 4.2 Geführter Empty-State
- Erweiterung von `KuroSidebarView.renderSnapshot` Empty-Branch (KuroSidebarView.ts:53-58): statt nur
  Heading+Body eine zustands-reflektierende Mini-Checkliste:
  - `Daily-Note-Ordner: <settings.dailyFolder>` (+ Button → Pfad-Settings)
  - `Mind. eine Habit oder Checkbox-XP aktiv?` (Button → Habits-Settings)
  - `Heutige Checkbox abhaken` (Button → heutige Daily-Note öffnen/erstellen, falls Pfad existiert)
- Strings über i18n (EN+DE). Liest nur vorhandenen Settings-State; keine neuen Daten nötig.

## 5. Säule 3 — Zweisprachige Doku (EN+DE-Parität)

Doku-Baum unter `40_src/docs/` (heute nur `manual.de.md` + `images/`):

```
40_src/docs/
  manual.de.md              (vorhanden)
  manual.en.md              (NEU — Peer, volle Parität)
  getting-started.de.md     (NEU)  Install → erstes XP → erstes Loot, OHNE Daily-Note-Vorwissen
  getting-started.en.md     (NEU)
  philosophy.de.md          (NEU)  konsolidiertes „Warum": Neurodivergenz-Logik, Freeze-Tokens,
  philosophy.en.md          (NEU)        off-by-default, deterministisches Loot — heute verstreut
  customization.de.md       (NEU)  Pack-Schema + fertige LLM-Prompts + Import-Walkthrough
  customization.en.md       (NEU)
```

> **Beispiel-Packs werden NICHT als separate Doku-Dateien dupliziert.** SSOT ist `src/data/example-packs.ts`
> (gebündelte Konstanten), erreichbar über den Vorlagen-Picker im Import-Modal (§3.3). Der Customization-Guide
> *beschreibt* die mitgelieferten Packs und zeigt **ein** Inline-Beispiel — keine Drift zwischen Doku und Code.

- Verlinkung aus `README.md` + `README.de.md`.
- **LLM-Prompts** leben im Customization-Guide: Copy-Paste-Prompt, das dem LLM das exakte `KuroPack`-Schema,
  die 5 Tiers und die Level-Anzahl nennt und **nur valides JSON** als Output verlangt. Mind. zwei Prompts
  (Loot-Theme; Lore-Narrativ).
- **Parität-Disziplin:** Jede künftige Doku-Änderung in EN **und** DE (bewusst gewählt, JK 2026-06-15).

## 6. Säule 4 — Robustheit für Fremde (Kitt)

- Pack-Validierung mit klaren, feld-genauen Fehlern (§3.2) — der Unterschied zwischen „funktioniert im Demo"
  und „funktioniert bei Laien mit LLM".
- **Lore-Ton & -Quelle:** Gothic-Cyberpunk bleibt Flagship-Default (Teil der Identität) — **nicht** genericisieren.
  **NeuroVim-Narrativ wird NICHT übernommen** (Entscheidung D-4): Tonbruch (NeuroVim = Spy-Thriller / externer Konflikt /
  CIPHER-Handler; Kuro = gothic-introspektiv / innere Auflösung). Kuros Original-Lore steht stärker. Geteilt ist nur die
  *visuelle* CRT-Phosphor-Linie, kein Fiktions-Universum.
- **Mitgelieferte Theme-Packs** in `src/data/example-packs.ts`: **Gothic-Cyberpunk** (Default als editierbarer Pack),
  **Plain/Calm** (neutral, kein Narrativ, nur ermutigende Level-Titel), **Cozy** (warm). Über den Vorlagen-Picker
  erreichbar (§3.3); trivial erweiterbar. Der lange Geschmacks-Schwanz läuft über den LLM-Prompt-Weg — **kein Redesign** des Defaults.
- Default-Sanity-Pass: `DEFAULT_SETTINGS.dailyFolder`/`weeklyFolder` (types.ts:173-174) sind heute auf JKs
  Vault-Struktur (`30_Chronos/…`) gesetzt — im Getting-Started klar als „anpassen!" markieren (kein Code-Change nötig,
  aber Doku muss es adressieren).

## 7. Datenmodell-Änderungen (types.ts)

```ts
// NEU
export interface KuroPack {
  kuroPack: number;                 // Format-Version
  name?: string;
  loot?: Partial<Record<KuroLootTier, KuroLootDrop[]>>;
  lore?: KuroLoreFragment[];
}

// KuroPluginData: + onboardingShown
export interface KuroPluginData {
  schemaVersion: number;
  onboardingShown: boolean;         // NEU
  // … unverändert …
}
// DEFAULT_PLUGIN_DATA: onboardingShown: false
```

Keine Änderung an `KuroSettings`, `KuroLootDrop`, `KuroLoreFragment`, `KuroLootTier` — der Pack nutzt sie unverändert.

**Neue Daten-Datei** `src/data/example-packs.ts`: exportiert die gebündelten `KuroPack`-Konstanten
(Gothic-Cyberpunk / Plain / Cozy) für den Vorlagen-Picker. Reine Daten, **kein** Obsidian-Import — analog zu
`data/default-loot-pool.ts` / `data/default-lore.ts`.

## 8. Schichtengrenze & Architektur-Treue

- `PackValidator` = **Pure Function**, keine Obsidian-Imports → in Node testbar (wie `LootEngine`/`LoreEngine`).
- `PackIoModal`, `WelcomeModal`, Empty-State, Commands, SettingsTab = **Obsidian-API-Schicht** (kapseln die API).
- **Die Engine↔Obsidian-Grenze wird nicht aufgeweicht** (AGENTS.md-Kernprinzip). Engines bleiben unverändert
  bis auf evtl. D-2 (Future).

## 9. Offene Detail-Entscheidungen (mit Empfehlung)

- **D-1 — Datei für den Validator:** `engine/PackValidator.ts` (zur restlichen Pure-Logik) **vs.** neues `validation/`.
  → *Empfehlung:* `engine/PackValidator.ts` — passt zum bestehenden Layout, kein neuer Top-Level-Ordner.
- **D-2 — Lore-Merge-Semantik:** Heute ersetzt `customLore` die Defaults **komplett** (LoreEngine.ts:10).
  Per-Level-Merge (analog zu Loot) wäre nutzerfreundlicher, ist aber ein Verhaltens-Change mit eigenen Edge-Cases
  (man könnte Default-Lore dann nicht mehr gezielt *entfernen*).
  → *Empfehlung:* **v1 behält Replace-Semantik**, Validator **warnt** bei unvollständiger Level-Abdeckung; LLM-Prompt
  verlangt ein vollständiges Set. Per-Level-Merge als Future notiert.
- **D-3 — Welcome-Modal-Gate:** immer beim ersten Start **vs.** nur wenn `enableNotices`.
  → *Empfehlung:* **immer beim ersten Start** (Onboarding ist kein „Notice"-Spam, sondern Erstkontakt), aber exakt einmal.
- **D-4 — Lore-Quelle & Theme-Packs** *(entschieden, JK 2026-06-15)*: NeuroVim-Narrativ übernehmen **vs.** original **vs.** generisch.
  → *Entscheidung:* **Original behalten, NeuroVim NICHT übernehmen.** Begründung: Tonbruch (Spy-Thriller/externer Konflikt vs.
  gothic-introspektiv/innere Auflösung); Lizenz/Ownership ist unkritisch (**selber Autor** — beide AGPL/CC-BY-SA), aber inhaltlich
  inkohärent; **kein** geteiltes Fiktions-Universum (nur die visuelle CRT-Linie). Gothic bleibt Default; zusätzlich kleines Set
  gebündelter Theme-Packs (Gothic/Plain/Cozy) via Picker (§3.3). **Kein** Settings-Theme-Schalter (YAGNI). NeuroVims Build-Pipeline/
  ContentPort/Kampagnen-Architektur ist für Kuros 10 Fragmente Overkill und bleibt außen vor.

## 10. Testing (jest, bestehendes Pattern)

- `PackValidator` Pure-Tests: valider Voll-Pack · nur-Loot · nur-Lore · unbekannter Tier-Key (+ Vorschlag) ·
  fehlende/falsch-typisierte Felder · leerer Pack · Nicht-Objekt · Warnungen (unvollständige Tier-/Level-Abdeckung).
- Thin-Apply-Logik (Pack → settings-Felder) ggf. als kleiner Unit-Test über eine extrahierte reine Funktion
  `applyPack(settings, pack): KuroSettings`.
- **Akzeptanz:** bestehende 79 Tests bleiben grün; `npm run build` (tsc-Gate + esbuild) + `npm run lint` (biome) sauber.

## 11. Future (bewusst nach v1)
- Per-Level-Lore-Merge (D-2).
- Vault-Datei-Pack-Loading.
- Accessibility-Audit (Screen-Reader, Kontrast, Keyboard) über `reduceAnimations` hinaus.
- Optional: Pack-„Registry"/Community-Sharing, falls Nutzerbasis entsteht.

## 12. Sequenz (für den Implementierungsplan)
1. **Datenmodell + `PackValidator`** (pure, vollständig getestet) — Fundament.
2. **Pack Import/Export** — `PackIoModal`, Commands, SettingsTab-Buttons, i18n.
3. **Onboarding** — `WelcomeModal` + geführter Empty-State + `onboardingShown` + Migrate-Guard + i18n.
4. **Zweisprachige Doku** — Getting-Started, Philosophy, Customization (inkl. LLM-Prompts), `manual.en.md`,
   Beispiel-Packs, README-Verlinkung.

Säule 4 (Robustheit) realisiert sich innerhalb 1–2; Säule 3 ist Schritt 4.
