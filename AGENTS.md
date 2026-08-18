# AGENTS.md

> **Workspace-Standards (maintainer-lokal):** Die verbindliche Leitkonvention steht in `_docs/CONVENTIONS.md`
> im Multi-Projekt-Workspace des Maintainers, `../../_docs` relativ zu diesem Repo — nicht Teil dieses Repos,
> ignorieren falls im Klon nicht vorhanden. Modell comply-or-explain. Offene Punkte für
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

`src/llm/` (Companion-Chat) ist die **zweite pure Zone**: alles darin ist obsidian-frei und in
Node testbar — **einzige Ausnahme `XhrSseTransport.ts`**. `src/engine/` bleibt dem
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
- smoke:gui: `npm run smoke:gui -- --vault <name>` (GUI-Smoke gegen ein **laufendes** Obsidian,
  s. `docs/SMOKE.md`; setzt `--remote-debugging-port=9222` voraus)
- shots: `STAGING_VAULTS_DIR=<dir> npm run shots` (README-Bilder aufnehmen; `-- --setup` baut den
  Aufnahme-Vault aus `docs/images/fixture/`, s. `docs/images/README.md`) ·
  `npm run shots:check` prüft Vertrag ↔ Dateien ↔ README
- gate: `npm run gate` (lint → lint:obsidian → typecheck → typecheck:scripts → test → build; **die** Gate-Definition —
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
- **Store-Gate:** biome bleibt Formatter/Haupt-Linter; zusätzlich läuft `eslint-plugin-obsidianmd`
  additiv über `src/**/*.ts` (`npm run lint:obsidian`, `eslint.config.mjs`, Muster wie
  json_viewer/vault-crews) — genau die Guideline-Regeln, die der echte Community-Store-Scanner
  prüft (2026-07-25 eingeführt, nachdem ein manueller Review-Auftrag reale Findings zutage
  förderte, die biome/SubmissionGate blind waren: doppeltes Command-Präfix, `minAppVersion` zu
  niedrig für tatsächlich genutzte APIs, `globalThis`/`console.info`/`element.style`-Verstöße).
  **Der Einstellungs-Tab ist seit 2026-08-18 rein deklarativ** (`minAppVersion` 1.13.0):
  `getSettingDefinitions()` ist die einzige Wahrheit, `display()` und die ganze imperative
  Fallback-Maschinerie (`_renderItem`/`_renderControl`/`_section`) sind gelöscht. Damit ist
  auch die letzte `no-deprecated`-Ausnahme aus `eslint.overrides.mjs` verschwunden —
  `eslint.overrides.mjs` trägt jetzt nur noch die `parserOptions`.
  **Anlass war eine Messung, keine Meinung:** der Guard in `preflight.mjs` verbot 1.13+ als
  „Catalyst-only"-Floor, aber `latestVersion` im **public** Kanal von `desktop-releases.json`
  stand am 2026-08-18 auf **1.13.7**, identisch mit `beta.latestVersion` — 1.13 war längst
  öffentlich, die hartkodierte Konstante (1.12.7) war schlicht veraltet. Sie ist im Dach
  nachgezogen worden, mitsamt Mess-Datum und Quelle im Kommentar.
  **Was das gekostet hat:** die Collapsible-Sections. Der deklarative Gruppentyp kennt
  `heading`/`cls`/`search`/`visible` — **kein** Collapse. Die eingeklappten Abschnitte
  (Overload-Reduktion für die ADHS/Autismus-Zielgruppe) sind damit endgültig weg. Sie waren
  es faktisch aber schon vorher: auf jedem 1.13-Host ruft das Framework `display()` nie auf,
  sobald `getSettingDefinitions()` ein nichtleeres Array liefert — die Löschung hat niemandem
  etwas genommen, was er noch sah. Wer die Reduktion zurückholen will, muss sie mit den
  Mitteln der API bauen (`search` auf Gruppenebene, `type: 'page'` für Unterseiten), nicht
  mit einem zweiten Renderpfad. Mit `display()` fiel auch das damit tot gewordene Vendoring
  (`collapsible.ts`, `folder-suggest.ts`) und das Settings-Feld `uiCollapsed`; den Ordner-
  Vorschlag zieht jetzt Obsidians eigener `folder`-Control. `SubmissionGate`
  (`src/engine/SubmissionGate.ts`, verdrahtet über
  `tests/submission-gate.test.ts`) deckt ergänzend `manifest.json`/`LICENSE` test-seitig ab — die
  echten Dateien laufen durchs Gate, ein kaputtes Manifest failt `npm test`.
- Commits: Conventional Commits; **nur berührte Dateien stagen, nie `git add -A`**; AI-Trailer
  `Co-Authored-By: …` bei substanziellem AI-Beitrag. Details: `CONTRIBUTING.md`.

## Gotchas
- **Zwei CDP-Treiber unter `scripts/`** (`gui-smoke.ts`, `shots.ts`) arbeiten gegen ein laufendes
  Obsidian. Die Brücke dazu wird **importiert, nicht vendored**: `../tools/obsidian-cdp/` im Dach.
  Fehlt ihr etwas, wird sie **dort** ergänzt (als Parameter, nicht als Sonderfall) — eine lokale
  `scripts/lib/cdp.ts` meldet `tools/template_drift_check.py` als Rückstand. Beide Treiber laufen
  nie in CI; `typecheck:scripts` überspringt sich ohne Dach-Checkout selbst.
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
- **Companion-Chat (`src/llm/`, seit 1.1.0):**
  - **Off-by-default** (`enableChat`). Ist er aus, wird keine Tab-Leiste gezeichnet, kein
    Endpunkt kontaktiert und `lastDailyText` gar nicht erst gelesen.
  - **Vorschau nie nachbauen.** Settings-Vorschau, Chat-Ausklapper und Prompt-Bau rufen
    alle `kuroContext.renderDailyExtract`. Eine zweite Formatierung driftet und zeigt
    beruhigend etwas anderes, als tatsächlich gesendet wird.
  - **Prompt-Blockreihenfolge ist load-bearing:** Rolle → Stimme → Kontext → Merkzettel →
    **Regeln zuletzt**. Stimme (importiertes Pack) und Kontext (eigene Notizen) sind Text,
    den das Plugin nicht kontrolliert; die Regeln sagen ausdrücklich, dass frühere Blöcke
    sie nicht aufheben. Neue Blöcke **vor** den Regeln einfügen, nie danach.
  - **Merkzettel kappt hart** (`kuroNotes`, 20 × 200 Zeichen): bei Erreichen wird der
    Hinzufügen-Knopf deaktiviert, statt still den ältesten Eintrag zu verwerfen. Der
    Gesprächsverlauf wird bewusst **nicht** persistiert.
  - **Timer über den injizierten `ClockPort`** (`vendor/kit-obsidian/clock`), nicht über
    nacktes `setTimeout`: Der Store-Lint verlangt `window.setTimeout`, das es in jests
    node-Umgebung nicht gibt. Ohne den Port wäre der Client entweder lint-widrig oder nur
    mit Obsidian-Mock testbar.
  - **`activePersona` folgt der Lore**, nicht dem Loot — wer die Gothic-Lore aktiviert, will
    auch die Gothic-Stimme.
- **CRT/Phosphor-Optik** (`docs/aesthetic-css.{en,de}.md`) wird **nicht** mit dem Plugin
  gebündelt — der User installiert es als Vault-CSS-Snippet. Bewusst als Markdown-Codeblock
  gepflegt, nicht als getrackte `.css`-Datei: eine `assets/kuro-gamification.css` wurde vom
  Store-Review-CSS-Lint gescannt (obwohl nie geshippt/referenziert), was auf `!important`
  (strukturell nötig, um beliebige Host-Themes zu überschreiben) und `clip-path` Warnings warf.
  Als Markdown-Doc bekommt es nie eine `.css`-Endung im Repo und wird so nicht mehr gescannt.

## Memory

Projekt-Memory unter `~/.claude/projects/<slug>/memory/` (Index: `MEMORY.md`).
Session-Handoff unter `.remember/` (gitignored).

- **SDD-Artefakte (seit 2026-07-16): Cockpit, nicht Repo** — Specs/Plans/Task-Reports leben im
  Coding-Cockpit des Maintainers (`$VAULT/25_Coding/kuro-gamification/_SDD/`, CORE-META-14, maintainer-lokal).
  Sie tragen Arbeitskontext (Vault-Pfade, Schwester-Repo-Interna), der in einem public Repo niemandem nützt.
  Das Repo behält die Design-Essenz in dieser Datei + `CHANGELOG.md`.
- **Alt-Bestand:** `docs/superpowers/{specs,plans}/` ist eingefroren — nichts Neues dort ablegen.
- **Nie im Repo:** absolute Pfade außerhalb des Repos (`/Users/…`, Vault-Pfade) — Platzhalter nutzen
  (`$VAULT/…`, `~/…`, repo-relativ). Herkunftsnachweise als Repo-Name + `Datei:Zeile` sind dagegen erwünscht.
  Gate: `scripts/check-no-abs-paths.mjs` (Teil von `npm test`).

## Offene Konventions-Punkte

- [x] CORE-GIT-01 (2026-07-25) — Forgejo-`origin`
      (`git.jkaindl.de/jkaindl/kuro-gamification`) + GitHub-Mirror
      (`github.com/johannes-kaindl/kuro-gamification`) eingerichtet; Release `1.0.0`
      dual-gepusht, GitHub-`release.yml` grün (attestierte Assets), Store-Release live.
- [x] Developer-Dashboard-Review-Status (2026-07-25) — nach drei Runden Submission-Readiness-
      Fixes (bis Release 1.0.6) von **Satisfactory** auf **Passed** gesprungen. Bestätigt:
      Zero-Warnings-Ziel erreicht, keine offenen Dashboard-Findings mehr.
- [x] CORE-META-10 — Forge-Beschreibung + Topics auf Forgejo **und** GitHub gesetzt.
- [x] CORE-META-02 (2026-07-25) — Release-Badge von statisch auf dynamischen
      Forgejo-Gitea-Badge umgestellt (`img.shields.io/gitea/v/release/...`), EN+DE.
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

Dieses Repo liegt unter dem Koordinations-Dach `obsidian-plugins/` (das Eltern-Verzeichnis `../` dieses Repos).
**Vor dem Lösen eines Problems:** `../AGENTS.md` (Kit-first-Regel) und `../REGISTRY.md`
(Lösungs-Registry) prüfen — viele Probleme sind in Nachbar-Plugins oder im `obsidian-kit`
bereits gelöst.

**Vor jeder UI-Arbeit** (Views, Modals, Settings-Tabs, CSS): `../UI-STANDARD.md` ist
verbindlich (Obsidian-nativ first, ein Frontend pro Plugin, nur Theme-CSS-Variablen).
