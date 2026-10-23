# AGENTS.md

> **Workspace-Standards (maintainer-lokal):** Die verbindliche Leitkonvention steht in `_docs/CONVENTIONS.md`
> im Multi-Projekt-Workspace des Maintainers, `../../workspace/_docs` relativ zu diesem Repo — nicht Teil dieses Repos,
> ignorieren falls im Klon nicht vorhanden. Modell comply-or-explain.

Conventions for AI agents (Claude Code, Codex, …) working on this repository.

## Project character
**Kuro Gamification** — ein neurodivergenz-freundliches Obsidian-Plugin: Gamification
(XP, Level, Streaks mit Freeze-Tokens, deterministische Loot-Drops, gothic-cyberpunk Lore).
Leitprinzip: **off-by-default** für alles, was eskalieren könnte. Plugin-Code liegt am
**Repo-Root** (`src/`, `tests/`); `main.js` wird gebaut, nicht getrackt.

## Architecture principles
Pure-Function-Engines (`src/engine/`) bleiben frei von Obsidian-Imports und in Node testbar
(`XpEngine`, `StreakEngine`, `LootEngine`, `LoreEngine`, plus `PackValidator`/`SubmissionGate`).
UI/Views/Modals kapseln die Obsidian-API. **Die Schichtengrenze Engine ↔ Obsidian-API nicht
aufweichen.**

`src/llm/` (Companion-Chat) ist die **zweite pure Zone**: alles darin ist obsidian-frei und in
Node testbar. Der browsernahe XHR-/`requestUrl`-Transport kommt seit dem Kit-Tausch aus `vendor/kit-obsidian/chat-transport.ts` (Kit 0.43.0), nicht mehr aus dieser Zone. `src/engine/` bleibt dem
deterministischen Gamification-Regelwerk vorbehalten; ein LLM-Client dort würde genau die
Bedeutung verwässern, die diese Grenze trägt. Die Chat-Module lesen **nie** selbst aus dem
Vault — Snapshot und Notiztext kommen als Argumente aus `main.ts`.

## Commands
Arbeitsverzeichnis: **Repo-Root**.
- install: `npm install`
- dev: `npm run dev` (esbuild watch)
- build: `npm run build` (tsc-Gate + esbuild production)
- test: `npm test` (jest) · watch: `npm run test:watch`
- lint: `npm run lint` (biome check, mit `--error-on-warnings`)
- lint:obsidian: `npm run lint:obsidian` (eslint-plugin-obsidianmd, additiver Store-Guideline-Gate über `src/`,
  mit `--max-warnings 0`). **Beide Warnungs-Flags sind PROF-TS-05 [MUST]** — ohne sie endet ein Lauf mit
  Warnungen auf Exit 0 und das Gate behauptet Sauberkeit, die es nie geprüft hat. Bei
  `eslint-plugin-obsidianmd` ist das akut: es führt die store-relevanten Regeln als `warning`, und der
  Store-Scanner ist derselbe Linter.
- typecheck: `npm run typecheck` (tsc auf `tsconfig.build.json`)
- typecheck:scripts: `npm run typecheck:scripts` (tsc auf `tsconfig.scripts.json` — die beiden
  CDP-Treiber unter `scripts/`; überspringt sich selbst, wenn das Dach fehlt)
- smoke:gui: `npm run smoke:gui -- --port <Port>` (GUI-Smoke gegen eine **Zweitinstanz** mit eigenem Profil und Port, Port ist Pflicht;
  Rezept in `docs/SMOKE.md` und im Treiberkopf; die reguläre Instanz wird nie angefasst)
- shots: `STAGING_VAULTS_DIR=<dir> npm run shots -- --port <Port>` (README-Bilder aufnehmen; `-- --setup` baut den
  Aufnahme-Vault aus `docs/images/fixture/`, s. `docs/images/README.md`) ·
  `npm run shots:check` prüft Vertrag ↔ Dateien ↔ README
- gate: `npm run gate` (lint → lint:obsidian → typecheck → typecheck:test → typecheck:scripts → test → build; **die** Gate-Definition —
  `.github/workflows/release.yml` ruft nur diesen Befehl, damit lokal und CI nie auseinanderlaufen)
- version-bump: `npm run version-bump <ver>` (3-File-Sync package/manifest/versions)
- release: `npm run release <ver>` (Ein-Befehl-Release: bump → changelog → preflight → commit →
  tag → Forgejo-Push → build → GitHub-Mirror + Verifikation → Forgejo-Release; `--dry-run`
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
- **Store-Gate:** biome bleibt Formatter/Haupt-Linter; zusätzlich läuft `eslint-plugin-obsidianmd` additiv über `src/**/*.ts` (`npm run lint:obsidian`, `eslint.config.mjs`, Muster wie json_viewer/vault-crews) — genau die Guideline-Regeln, die der echte Community-Store-Scanner prüft (das Warum in `docs/internal/decisions.md`).
- Commits: Conventional Commits; **nur berührte Dateien stagen, nie `git add -A`**; AI-Trailer
  `Co-Authored-By: …` bei substanziellem AI-Beitrag. Details: `CONTRIBUTING.md`.

## Gotchas

- **`moment` aus `obsidian` nie direkt aufrufen.** Obsidian typt es als Namespace (`import * as Moment`); lokal lässt die tsconfig den Aufruf durch, der Store-Review nicht, und dort wird jeder Wert daraus `error`-getypt (1.13.0: vier `no-unsafe-*`-Befunde, „Satisfactory“). Einen typisierten Zugriff nehmen: `callableMoment` aus `vendor/kit-obsidian/moment`, umhüllt von `parseStrict` in `src/persistence/VaultReader.ts` (Muster obsidian-kit `daily-notes.ts`). Nachbilden lässt sich der Befund nur mit `esModuleInterop: true`.

## Context index

- Bevor du `src/llm/` oder `src/views/KuroChatPanel.ts` (Companion-Chat: Kontext, Prompt-Reihenfolge, Verbindung, Markdown) änderst: `.claude/rules/companion-chat.md`.
- Bevor du die TaskNotes-Quellen, XP, Streak oder den Notiz-Parser (`src/utils/taskNotesBridge.ts`, `src/engine/`, `src/persistence/VaultReader.ts`) anfasst: `.claude/rules/tasknotes-und-streak.md`.
- Bevor du den Einstellungs-Tab (`src/settings/`) oder die Pack-Ablage änderst: `.claude/rules/settings-tab.md`.
- Bevor du `src/main.ts` (Lade-Reihenfolge, Vault-Ereignisse) änderst: `.claude/rules/onload-und-vault.md`.
- Bevor du `scripts/gui-smoke.ts` oder `scripts/shots.ts` änderst: `.claude/rules/smoke-treiber.md`, `docs/SMOKE.md` und im Dach `../.claude/rules/gui-smoke-treiber.md`, `../.claude/rules/obsidian-instanz.md`, `../.claude/rules/cdp-lock.md`.
- Bevor du `tools/kit-sync.json` oder etwas unter `src/vendor/` änderst (zwei Quellen, nie von Hand): `.claude/rules/vendoring.md`.
- Vor einem Release oder am Submission-Gate (`src/engine/SubmissionGate.ts`): `.claude/rules/release-und-gate.md` und im Dach `../.claude/rules/release-und-store.md`; `npm run release` fährt der Master.
- Bevor du die Optik als Vault-Snippet (`docs/aesthetic-css.*.md`) oder `styles.css` änderst: `.claude/rules/aesthetic-css.md`, dazu im Dach `../.claude/rules/store-css.md`.
- Bevor du eine Altentscheidung übernimmst (Store-Gate, deklarative Einstellungen, Herkunft des Repos): `docs/internal/decisions.md`.

## Memory

Projekt-Memory unter `~/.claude/projects/<slug>/memory/` (Index: `MEMORY.md`).
Session-Handoff unter `.remember/` (gitignored).

- **SDD-Artefakte (seit 2026-07-16): Cockpit, nicht Repo** — Specs, Pläne und Task-Reports leben im Coding-Cockpit des Maintainers (`$VAULT/25_Coding/kuro-gamification/_SDD/`, CORE-META-14, maintainer-lokal); `docs/superpowers/` gibt es im Repo nicht mehr, nichts Neues dort ablegen. Das Repo behält die Design-Essenz in `docs/internal/` und `CHANGELOG.md`.
- **Nie im Repo:** absolute Pfade außerhalb des Repos (`/Users/…`, Vault-Pfade) — Platzhalter nutzen
  (`$VAULT/…`, `~/…`, repo-relativ). Herkunftsnachweise als Repo-Name + `Datei:Zeile` sind dagegen erwünscht.
  Gate: `scripts/check-no-abs-paths.mjs` (Teil von `npm test`).

## Abweichungen von der Leitkonvention

- PROF-OBS-01 — manifest-`id` bleibt `kuro-gamification`: Der Name ist fachlich (Produktname
  „Kuro Gamification"), die Übereinstimmung mit dem Repo-Slug ist koinzidentell. **Vor dem ersten
  Store-Release bewusst festgezurrt** (id/Name sind nach dem Listing permanent).

## Dach-Kontext (obsidian-plugins)

Dieses Repo liegt unter dem Koordinations-Dach `obsidian-plugins/` (das Eltern-Verzeichnis `../` dieses Repos).
**Vor dem Lösen eines Problems:** `../AGENTS.md` (Kit-first-Regel) und `../REGISTRY.md`
(Lösungs-Registry) prüfen — viele Probleme sind in Nachbar-Plugins oder im `obsidian-kit`
bereits gelöst.

**Vor jeder UI-Arbeit** (Views, Modals, Settings-Tabs, CSS): `../UI-STANDARD.md` ist
verbindlich (Obsidian-nativ first, ein Frontend pro Plugin, nur Theme-CSS-Variablen).
