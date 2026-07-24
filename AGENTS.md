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
- typecheck: `npm run typecheck` (tsc auf `tsconfig.build.json`)
- version-bump: `npm run version-bump <ver>` (3-File-Sync package/manifest/versions)
- release: `npm run release <ver>` (Ein-Befehl-Release: bump → commit → tag → Codeberg-Push
  → build → Codeberg-Release → GitHub-Mirror; `--dry-run` zum Prüfen)
- deploy: `OBSIDIAN_PLUGIN_DIR=<vault>/.obsidian/plugins/kuro-gamification npm run deploy`
  (Standard-Test-Target: der produktive Pallas-Vault
  `/Users/Shared/10_ObsidianVaults/10_Pallas/.obsidian/plugins/kuro-gamification/`. Bei echten
  Daten: **`data.json` vor Build-Wechseln sichern** (`cp data.json data.json.bak`), falls eine
  Schema-Migration schiefgeht.)

## Conventions
Projektspezifische Konventionen hier. Workspace-weite Standards: siehe `_docs/CONVENTIONS.md`.
Profile dieses Repos: **ts-node · obsidian-plugin**.
- Linter: **biome** (Linter only, Formatter bewusst aus — kein Massen-Reformat des Release-Stands).
  Deaktivierte Regeln mit Begründung: `complexity/noStaticOnlyClass` (statisch-only Engines sind
  bewusstes Architektur-Pattern), `complexity/noUselessConstructor` nur in `tests/**`
  (Mock-Konstruktoren spiegeln Obsidian-API-Signaturen).
- **Store-Gate:** kuro ist biome-only (kein eslint). Die Rolle der
  `eslint-plugin-obsidianmd`-Regeln `validate-manifest`/`validate-license` übernimmt
  `SubmissionGate` (`src/engine/SubmissionGate.ts`), verdrahtet über `tests/submission-gate.test.ts`
  — die echten `manifest.json`/`LICENSE` laufen durchs Gate, ein kaputtes Manifest failt `npm test`.
- Commits: Conventional Commits; **nur berührte Dateien stagen, nie `git add -A`**; AI-Trailer
  `Co-Authored-By: …` bei substanziellem AI-Beitrag. Details: `CONTRIBUTING.md`.

## Gotchas
- **Pure-Logik in `src/engine/`** (Node-testbar); UI ist dünner Glue über der Obsidian-API.
- **Vault-reactive:** `vault.modify` ist 800 ms debounced.
- **`onload`-Reihenfolge (load-bearing):** Debounced Fns (`debouncedSave`/`debouncedRefresh`)
  müssen **vor** jeder Methode zugewiesen werden, die sie aufrufen kann — speziell
  `regenFreezeTokensIfNeeded()`. Sonst Fresh-Vault-only Ladecrash (`this.debouncedSave is not a
  function`), für Engine/DataStore-Tests unsichtbar. Abgesichert durch `tests/main-onload.test.ts`.
- **Pack-I/O:** `📚 Packs` (SettingsTab) ist DER Ort für alle Pack-Operationen; die
  Einheiten-Sektionen tragen nur Inhalts-Einstellungen. Pure-Logik in `src/utils/packLibrary.ts`.
- **`assets/kuro-gamification.css`** (CRT/Phosphor-Optik) wird **nicht** mit dem Plugin gebündelt —
  der User installiert es als Vault-CSS-Snippet.

## Memory
Projekt-Memory unter `~/.claude/projects/<slug>/memory/` (Index: `MEMORY.md`).
Session-Handoff unter `.remember/` (gitignored).

## Offene Konventions-Punkte

- [ ] CORE-GIT-01 (in Ausführung 2026-07-24) — Codeberg-`origin`
      (`codeberg.org/jkaindl/kuro-gamification`) + GitHub-Mirror
      (`github.com/johannes-kaindl/kuro-gamification`) + erster Release-Tag `1.0.0`.
      Lokaler Umbau erledigt; Forge-Anlage + erster Push = Handover an Jay (Auth).
- [ ] CORE-META-10 — Forge-Teil: Beschreibung + Topics auf der Forge setzen (lokaler Teil
      erledigt: `package.json` hat `description`/`keywords`/`author` konsistent mit `manifest.json`).
- [ ] CORE-META-02 — Release-Badge nach dem ersten Release von statisch auf dynamischen
      Forge-Badge umstellen.

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
