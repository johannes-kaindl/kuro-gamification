# AGENTS.md

> **Workspace-Standards:** Die verbindliche Leitkonvention steht in `_docs/CONVENTIONS.md`
> (am Workspace-Root `/Users/Shared/code/`), Modell comply-or-explain. Offene Punkte für
> dieses Repo siehe Abschnitt "Offene Konventions-Punkte".

Conventions for AI agents (Claude Code, Codex, …) working on this repository.

## Project character
**Kuro Gamification** — ein neurodivergenz-freundliches Obsidian-Plugin: Gamification
(XP, Level, Streaks mit Freeze-Tokens, deterministische Loot-Drops, gothic-cyberpunk Lore).
Leitprinzip: **off-by-default** für alles, was eskalieren könnte. Plugin-Code liegt am
**Repo-Root** (`src/`, `tests/`); `main.js` wird gebaut, nicht getrackt.

> **Historie/Archiv:** Vor v1.0.0 lebte dieses Plugin in einem verschachtelten Container-Repo
> (`40_src/`, bewusst getrackte `node_modules`, Workflow-Ordner `10_discovery…90_workflow-log`).
> Bei der Öffentlich-Machung (CORE-GIT-01, 2026-07-24) auf flache Sibling-Form migriert, frische
> Historie ab v1.0.0. Die volle Vor-1.0.0-Historie liegt lokal im Archiv
> `../kuro-gamification-container` (nie gepusht).

## Architecture principles
Pure-Function-Engines (`src/engine/`) bleiben frei von Obsidian-Imports und in Node testbar
(`XpEngine`, `StreakEngine`, `LootEngine`, `LoreEngine`, plus `PackValidator`/`SubmissionGate`).
UI/Views/Modals kapseln die Obsidian-API. **Die Schichtengrenze Engine ↔ Obsidian-API nicht
aufweichen.**

## Commands
Arbeitsverzeichnis: **Repo-Root**.
- install: `npm install`
- dev: `npm run dev` (esbuild watch)
- build: `npm run build` (tsc-Gate + esbuild production)
- test: `npm test` (jest) · watch: `npm run test:watch`
- lint: `npm run lint` (biome check)
- lint:obsidian: `npm run lint:obsidian` (eslint-plugin-obsidianmd, additiver Store-Guideline-Gate über `src/`)
- typecheck: `npm run typecheck` (tsc auf `tsconfig.build.json`)
- version-bump: `npm run version-bump <ver>` (3-File-Sync package/manifest/versions)
- release: `npm run release <ver>` (Ein-Befehl-Release: bump → changelog → preflight → commit →
  tag → Codeberg-Push → build → GitHub-Mirror + Verifikation → Codeberg-Release; `--dry-run`
  zum Prüfen)
- preflight: `npm run preflight <ver>` (Store-Checkliste standalone, ohne Release auszulösen)
- deploy: `OBSIDIAN_PLUGIN_DIR=<vault>/.obsidian/plugins/kuro-gamification npm run deploy`
  (Standard-Test-Target: das produktive Test-Vault
  `<vault>/.obsidian/plugins/kuro-gamification/`. Bei echten
  Daten: **`data.json` vor Build-Wechseln sichern** (`cp data.json data.json.bak`), falls eine
  Schema-Migration schiefgeht.)

## Conventions
Projektspezifische Konventionen hier. Workspace-weite Standards: siehe `_docs/CONVENTIONS.md`.
Profile dieses Repos: **ts-node · obsidian-plugin**.
- Linter: **biome** (Linter only, Formatter bewusst aus — kein Massen-Reformat des Release-Stands).
  Deaktivierte Regeln mit Begründung: `complexity/noStaticOnlyClass` (statisch-only Engines sind
  bewusstes Architektur-Pattern), `complexity/noUselessConstructor` nur in `tests/**`
  (Mock-Konstruktoren spiegeln Obsidian-API-Signaturen).
- **Store-Gate:** biome bleibt Formatter/Haupt-Linter; zusätzlich läuft `eslint-plugin-obsidianmd`
  additiv über `src/**/*.ts` (`npm run lint:obsidian`, `eslint.config.mjs`, Muster wie
  json_viewer/vault-crews) — genau die Guideline-Regeln, die der echte Community-Store-Scanner
  prüft (2026-07-25 eingeführt, nachdem ein manueller Review-Auftrag reale Findings zutage
  förderte, die biome/SubmissionGate blind waren: doppeltes Command-Präfix, `minAppVersion` zu
  niedrig für tatsächlich genutzte APIs, `globalThis`/`console.info`/`element.style`-Verstöße).
  `setWarning()` ist in `eslint.config.mjs` für `SettingsTab.ts`/`ConfirmModal.ts` bewusst von
  `no-deprecated` ausgenommen — die Alternative `setDestructive()` verlangt `minAppVersion` 1.13+,
  was `preflight.mjs` als "Catalyst-only"-Floor explizit verbietet. `getSettingDefinitions()` ist
  dagegen **implementiert** (2026-07-25): `SettingsTab.ts` hat eine einzige deklarative
  Gruppen-Definition (`_groups()`), die sowohl `getSettingDefinitions()` (Obsidian ≥ 1.13, native
  Rendering + Auffindbarkeit über die globale Settings-Suche) als auch `display()` (< 1.13, läuft
  über dieselben Gruppen mit der klassischen `Setting`-API) speist — kein zweiter
  Wahrheits-Baum, `minAppVersion` bleibt 1.8.7 (nur die `obsidian`-Types wurden auf 1.13.1
  angehoben, rein Compile-Zeit, kein Laufzeit-Effekt). **Bewusster Trade-off:** der native
  ≥ 1.13-Renderer kennt unsere Collapsible-Sections nicht — dort erscheinen alle 11 Abschnitte
  flach & aufgeklappt statt eingeklappt (Overload-Reduktion für die ADHS/Autismus-Zielgruppe
  geht auf neueren Obsidian-Versionen zugunsten der Auffindbarkeit verloren). `SubmissionGate`
  (`src/engine/SubmissionGate.ts`, verdrahtet über
  `tests/submission-gate.test.ts`) deckt ergänzend `manifest.json`/`LICENSE` test-seitig ab — die
  echten Dateien laufen durchs Gate, ein kaputtes Manifest failt `npm test`.
- Commits: Conventional Commits; **nur berührte Dateien stagen, nie `git add -A`**; AI-Trailer
  `Co-Authored-By: …` bei substanziellem AI-Beitrag. Details: `CONTRIBUTING.md`.

## Gotchas
- **Release-Tooling ist zentral** (`../tools/release/{release,version-bump,preflight}.mjs`) — kein
  vendored `scripts/release.mjs` mehr im Repo. Voraussetzung: dieses Repo muss im Dach-Verzeichnis
  `obsidian-plugins/` neben `tools/` liegen (ein Clone ohne Dach ist nicht release-fähig, die
  npm-Scripts prüfen das und brechen mit klarer Fehlermeldung ab). `preflight.mjs` deckt die
  Store-Checkliste release-seitig ab; `SubmissionGate.ts`/`tests/submission-gate.test.ts` deckt
  dieselben Checks test-seitig ab (`npm test`) — bewusste Teil-Doppelung, nicht redundant
  (verschiedene Zeitpunkte). Migriert 2026-07-25, s. `_docs/LESSONS.md` (2026-07-25).
- **Pure-Logik in `src/engine/`** (Node-testbar); UI ist dünner Glue über der Obsidian-API.
- **Vault-reactive:** `vault.modify` ist 800 ms debounced.
- **`onload`-Reihenfolge (load-bearing):** Debounced Fns (`debouncedSave`/`debouncedRefresh`)
  müssen **vor** jeder Methode zugewiesen werden, die sie aufrufen kann — speziell
  `regenFreezeTokensIfNeeded()`. Sonst Fresh-Vault-only Ladecrash (`this.debouncedSave is not a
  function`), für Engine/DataStore-Tests unsichtbar. Abgesichert durch `tests/main-onload.test.ts`.
- **Pack-I/O:** `📚 Packs` (SettingsTab) ist DER Ort für alle Pack-Operationen; die
  Einheiten-Sektionen tragen nur Inhalts-Einstellungen. Pure-Logik in `src/utils/packLibrary.ts`.
- **CRT/Phosphor-Optik** (`docs/aesthetic-css.{en,de}.md`) wird **nicht** mit dem Plugin
  gebündelt — der User installiert es als Vault-CSS-Snippet. Bewusst als Markdown-Codeblock
  gepflegt, nicht als getrackte `.css`-Datei: eine `assets/kuro-gamification.css` wurde vom
  Store-Review-CSS-Lint gescannt (obwohl nie geshippt/referenziert), was auf `!important`
  (strukturell nötig, um beliebige Host-Themes zu überschreiben) und `clip-path` Warnings warf.
  Als Markdown-Doc bekommt es nie eine `.css`-Endung im Repo und wird so nicht mehr gescannt.

## Memory
Projekt-Memory unter `~/.claude/projects/<slug>/memory/` (Index: `MEMORY.md`).
Session-Handoff unter `.remember/` (gitignored).

## Offene Konventions-Punkte

- [x] CORE-GIT-01 (2026-07-25) — Codeberg-`origin`
      (`codeberg.org/jkaindl/kuro-gamification`) + GitHub-Mirror
      (`github.com/johannes-kaindl/kuro-gamification`) eingerichtet; Release `1.0.0`
      dual-gepusht, GitHub-`release.yml` grün (attestierte Assets), Store-Release live.
- [x] Developer-Dashboard-Review-Status (2026-07-25) — nach drei Runden Submission-Readiness-
      Fixes (bis Release 1.0.6) von **Satisfactory** auf **Passed** gesprungen. Bestätigt:
      Zero-Warnings-Ziel erreicht, keine offenen Dashboard-Findings mehr.
- [x] CORE-META-10 — Forge-Beschreibung + Topics auf Codeberg **und** GitHub gesetzt.
- [x] CORE-META-02 (2026-07-25) — Release-Badge von statisch auf dynamischen
      Codeberg-Gitea-Badge umgestellt (`img.shields.io/gitea/v/release/...`), EN+DE.
- [x] CORE-META-01 (2026-07-25) — README (EN+DE) um die 4 fehlenden Pflicht-Sektionen
      ergänzt (Requirements / Usage / Configuration / How it works); `readme_lint.py`
      meldet jetzt „keine Befunde".
- [x] Release-Tooling-Migration (2026-07-25) — vendored `scripts/release.mjs` (stale, ohne
      preflight/push-order-fix) durch Delegation an zentrales `../tools/release/` ersetzt;
      s. `_docs/LESSONS.md` (2026-07-25).

Erledigt (Konventions-Sweep 2026-06-10 + Submission-Readiness 2026-07-24):
CORE-META-01/02/05/07/08 (README EN+DE, Badges, LICENSE am Root, AGPL, LICENSE-DOCS),
PROF-TS-01/04, PROF-OBS-02, CORE-AGENT-03/04/06, sowie das Store-Submission-Gate.

## Abweichungen von der Leitkonvention

- PROF-OBS-01 — manifest-`id` bleibt `kuro-gamification`: Der Name ist fachlich (Produktname
  „Kuro Gamification"), die Übereinstimmung mit dem Repo-Slug ist koinzidentell. **Vor dem ersten
  Store-Release bewusst festgezurrt** (id/Name sind nach dem Listing permanent).

## Dach-Kontext (obsidian-plugins)

Dieses Repo liegt unter dem Koordinations-Dach `/Users/Shared/code/obsidian-plugins/`.
**Vor dem Lösen eines Problems:** `../AGENTS.md` (Kit-first-Regel) und `../REGISTRY.md`
(Lösungs-Registry) prüfen — viele Probleme sind in Nachbar-Plugins oder im `obsidian-kit`
bereits gelöst.

**Vor jeder UI-Arbeit** (Views, Modals, Settings-Tabs, CSS): `../UI-STANDARD.md` ist
verbindlich (Obsidian-nativ first, ein Frontend pro Plugin, nur Theme-CSS-Variablen).
