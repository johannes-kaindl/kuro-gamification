# CORE-GIT-01 Forge-Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** kuro-gamification vom verschachtelten Container-Repo (Plugin in `40_src/`, getrackte `node_modules`) in ein flaches, publizierbares Sibling-Form-Repo überführen — mit Codeberg-`origin` + GitHub-Mirror + Ein-Befehl-Release-Pipeline (Tag = `manifest.json`-Version).

**Architecture:** Der aktuelle Container wird lokal als Archiv beiseitegelegt (nie gepusht, volle Historie erhalten). Am kanonischen Pfad entsteht ein frisches, flaches Repo mit Plugin-Source am Root und frischer Historie ab `v1.0.0`. Die erprobte Sibling-Release-Pipeline (npm-Script-getrieben) wird kopiert; da kuros `package.json` `lint`/`test` bereits auf biome/jest mappt, greift sie ohne eslint/vitest-Anpassung.

**Tech Stack:** TypeScript · esbuild · jest · biome · Node-Scripts (`release.mjs`/`version-bump.mjs`) · GitHub Actions (`release.yml`) · Codeberg + GitHub (Dual-Push).

## Global Constraints

- **Name/id permanent:** `id` = `kuro-gamification`, Display = `Kuro Gamification` — NICHT ändern (nach Store-Listing eingefroren, LESSONS.md:238).
- **manifest.json store-konform:** muss `SubmissionGate.validateManifest` bestehen (kein `fundingUrl:""`, keine Fremd-Keys, `description` 10–250 Z. mit Punkt).
- **`node_modules` im NEUEN Repo untracked** (gitignored). Die Container-Regel „node_modules bewusst getrackt" gilt NUR fürs Archiv.
- **Remotes:** `origin` = `git.jkaindl.de/jkaindl/kuro-gamification` · Mirror `github` = `github.com/johannes-kaindl/kuro-gamification`.
- **Release-Tag ohne `v`-Präfix**, SemVer, = `manifest.json`-Version (erster Release: `1.0.0`).
- **Ausführungs-Grenze:** Forge-Repo-Anlage, `~/.forgejo-token`, erster Push/Release = **Handover an Jay** (Auth). Kein Auto-Push.
- **Kanonischer Pfad bleibt** `<workspace>/obsidian-plugins/kuro-gamification/` (Deploy-Target/Cockpit-Referenz stabil; `<workspace>` = Wurzel des Multi-Projekt-Workspace des Maintainers).

---

### Task 1: Container als lokales Archiv beiseitelegen

**Files:**
- Move: `obsidian-plugins/kuro-gamification/` → `obsidian-plugins/kuro-gamification-container/`

**Interfaces:**
- Produces: Archiv-Verzeichnis `kuro-gamification-container/` mit intakter `.git`-Historie + `40_src/` als Quelle für Task 2.

- [ ] **Step 1: Working-Tree des Containers ist sauber**

Run: `cd <workspace>/obsidian-plugins/kuro-gamification && git status --porcelain`
Expected: leer (alle bisherigen Commits durch → Gate `56c4ab6`, Spec `3fcba23`, Plan committen NICHT nötig, Plan lebt im Archiv). Falls nicht leer: erst committen.

- [ ] **Step 2: Container umbenennen**

```bash
cd <workspace>/obsidian-plugins
mv kuro-gamification kuro-gamification-container
```

- [ ] **Step 3: Archiv-Integrität verifizieren**

Run: `cd <workspace>/obsidian-plugins/kuro-gamification-container && git log --oneline -1 && ls 40_src/manifest.json`
Expected: letzter Commit `3fcba23` sichtbar, `40_src/manifest.json` existiert. Historie unangetastet.

- [ ] **Step 4: Kein Commit** (reines lokales Move, das Archiv-Repo bleibt wie es ist).

---

### Task 2: Flaches Repo befüllen + `git init`

**Files:**
- Create: `obsidian-plugins/kuro-gamification/` (neu, flach)
- Copy from: `kuro-gamification-container/40_src/*` (ohne `node_modules/`)
- Copy from: `kuro-gamification-container/docs/superpowers/{specs,plans}/`

**Interfaces:**
- Consumes: Archiv aus Task 1.
- Produces: flaches Repo mit `src/`, `tests/`, `manifest.json`, `styles.css`, `versions.json`, Build-Configs, `docs/` am Root; noch OHNE Meta-Dateien/Pipeline (Tasks 3–4).

- [ ] **Step 1: Neues Verzeichnis + Inhalt aus 40_src kopieren (node_modules ausgeschlossen)**

```bash
cd <workspace>/obsidian-plugins
mkdir kuro-gamification
rsync -a --exclude 'node_modules' kuro-gamification-container/40_src/ kuro-gamification/
```

- [ ] **Step 2: Container-Root-docs (specs/plans) einhängen**

```bash
cd <workspace>/obsidian-plugins/kuro-gamification
mkdir -p docs/superpowers
rsync -a ../kuro-gamification-container/docs/superpowers/ docs/superpowers/
```

- [ ] **Step 3: Verifizieren, dass die Store-Dateien am Root liegen**

Run: `cd <workspace>/obsidian-plugins/kuro-gamification && ls manifest.json styles.css versions.json package.json src/main.ts README.md LICENSE`
Expected: alle vorhanden, kein Fehler. `ls node_modules 2>&1` → „No such file".

- [ ] **Step 4: `git init` + Placeholder-Commit (wird in Task 7 zum finalen v1.0.0)**

```bash
git init -q
git add -A
git commit -q -m "wip: flat repo scaffold (pre-pipeline)"
```

Hinweis: node_modules ist noch nicht ignoriert → in Task 3 kommt `.gitignore`, dann wird neu gestaged. Solange kein `npm install` lief, ist kein `node_modules/` da.

---

### Task 3: `.gitignore` + Meta-Dateien + neue AGENTS.md

**Files:**
- Create: `.gitignore`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`
- Rewrite: `AGENTS.md` (flach, kein `40_src`)
- Copy from: `../image-to-markdown/{CONTRIBUTING.md,SECURITY.md}` als Vorlage

**Interfaces:**
- Consumes: flaches Repo aus Task 2.
- Produces: `CHANGELOG.md` mit `## [Unreleased]` + `## [1.0.0]`-Block (von `release.mjs`/CI erwartet).

- [ ] **Step 1: `.gitignore` schreiben (Sibling-Muster)**

Create `.gitignore`:
```
node_modules/
main.js
data.json
.claude/
.remember/
.DS_Store
```

- [ ] **Step 2: `CHANGELOG.md` anlegen**

Create `CHANGELOG.md`:
```markdown
# Changelog

Alle nennenswerten Änderungen an diesem Plugin werden hier dokumentiert.
Format nach [Keep a Changelog](https://keepachangelog.com/), Versionierung nach [SemVer](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-07-24

### Added
- Erste öffentliche Version: neurodivergenz-freundliche Gamification — XP, Level,
  Streaks mit Freeze-Tokens, deterministische Loot-Drops, gothic-cyberpunk Lore.
- LLM-assistierter Pack-Import (Gothic/Plain/Cozy), geführtes Onboarding, EN+DE-Doku.
- Off-by-default für alles, was eskalieren könnte.
```

- [ ] **Step 3: CONTRIBUTING.md + SECURITY.md aus Sibling adaptieren**

```bash
cp ../image-to-markdown/CONTRIBUTING.md ./CONTRIBUTING.md
cp ../image-to-markdown/SECURITY.md ./SECURITY.md
```
Dann in beiden `image-to-markdown` → `kuro-gamification` ersetzen und plugin-spezifische Zeilen (Repo-URL, Kontakt) an kuro anpassen (biome/jest statt eslint/vitest in etwaigen Test-/Lint-Hinweisen).

- [ ] **Step 4: AGENTS.md neu schreiben (flach)**

Rewrite `AGENTS.md` — Kernänderungen ggü. der alten Container-Version:
- „Plugin-Code liegt in `40_src/`" ENTFERNEN; Arbeitsverzeichnis = Repo-Root.
- Gotcha „node_modules bewusst getrackt" ENTFERNEN (gilt nur fürs Archiv).
- Commands-Pfade ohne `40_src/`-Prefix; deploy: `cp main.js manifest.json styles.css versions.json "$OBSIDIAN_PLUGIN_DIR"/`.
- Abschnitt „Offene Konventions-Punkte": CORE-GIT-01 auf `[x]` sobald gepusht; Verweis auf Archiv `kuro-gamification-container/` für die Vor-1.0.0-Historie.
- Store-Gate-Hinweis: `SubmissionGate` (jest) prüft manifest/LICENSE — biome-only-Äquivalent zur eslint-obsidianmd-Regel der Nachbarn.

- [ ] **Step 5: Commit**

```bash
git add .gitignore CHANGELOG.md CONTRIBUTING.md SECURITY.md AGENTS.md
git commit -q -m "chore: flat-repo meta files (.gitignore, changelog, contributing, security, agents)"
```

---

### Task 4: Release-Pipeline aus Sibling kopieren + verdrahten

**Files:**
- Create: `scripts/release.mjs`, `scripts/version-bump.mjs`, `scripts/lib/codeberg-release.mjs`
- Create: `.github/workflows/release.yml`
- Modify: `package.json` (Scripts `version-bump`, `release`; `keywords` prüfen)
- Copy from: `../image-to-markdown/scripts/{release.mjs,version-bump.mjs,lib/codeberg-release.mjs}` und `../image-to-markdown/.github/workflows/release.yml`

**Interfaces:**
- Consumes: Meta-Dateien aus Task 3 (CHANGELOG mit `[Unreleased]`).
- Produces: `npm run release <ver>` (Dual-Push) + `npm run version-bump <ver>` (3-File-Sync) + CI-Release bei Tag.

- [ ] **Step 1: Pipeline-Dateien kopieren (NUR diese drei Scripts, nicht die IMG-spezifischen)**

```bash
cd <workspace>/obsidian-plugins/kuro-gamification
mkdir -p scripts/lib .github/workflows
cp ../image-to-markdown/scripts/release.mjs scripts/release.mjs
cp ../image-to-markdown/scripts/version-bump.mjs scripts/version-bump.mjs
cp ../image-to-markdown/scripts/lib/codeberg-release.mjs scripts/lib/codeberg-release.mjs
cp ../image-to-markdown/.github/workflows/release.yml .github/workflows/release.yml
```
NICHT kopieren: `build-pdf-worker.mjs`, `polyfills.mjs`, `codeberg-release.test.ts` (IMG-spezifisch bzw. vitest).

- [ ] **Step 2: Scripts auf eslint/vitest-Reste prüfen**

Run: `grep -rniE "vitest|eslint|pdf-worker|polyfill" scripts/ .github/workflows/release.yml`
Expected: **keine Treffer**. (Die Pipeline ruft `npm run lint`/`test`/`typecheck`/`build` — kuro mappt diese schon auf biome/jest/tsc/esbuild.) Falls doch ein Treffer: die Zeile auf kuros npm-Script umbiegen.

- [ ] **Step 3: `package.json`-Scripts ergänzen**

Modify `package.json` scripts — hinzufügen (bestehende `dev/build/test/lint/typecheck/deploy` bleiben):
```json
"version-bump": "node scripts/version-bump.mjs",
"release": "node scripts/release.mjs"
```
Und `keywords` prüfen/ergänzen (Store-Discoverability): `["obsidian","obsidian-plugin","gamification","xp","streaks","habits","neurodivergent","adhd"]`.

- [ ] **Step 4: version-bump trocken verifizieren (setzt 1.0.0 idempotent)**

Run: `node scripts/version-bump.mjs 1.0.0 && git diff --stat`
Expected: `manifest.json`/`versions.json`/`package.json` bleiben bei 1.0.0 (versions.json bekommt `"1.0.0":"1.5.0"`), keine kaputte Formatierung. `git checkout -- .` falls nur versions.json-Zeile ergänzt wurde und du sie behalten willst → in Task 7 final.

- [ ] **Step 5: Commit**

```bash
git add scripts/ .github/workflows/release.yml package.json versions.json
git commit -q -m "feat(release): Dual-Push-Pipeline (release.mjs, version-bump, CI release.yml)"
```

---

### Task 5: `npm install` + volle grüne Verifikation

**Files:**
- Create: `package-lock.json` (via `npm install`)

**Interfaces:**
- Consumes: komplettes flaches Repo (Tasks 2–4).
- Produces: Beweis, dass Build/Test/Lint/Typecheck/readme_lint grün sind.

- [ ] **Step 1: Frische Installation**

```bash
cd <workspace>/obsidian-plugins/kuro-gamification
npm install
```
Expected: `node_modules/` entsteht (gitignored), `package-lock.json` geschrieben.

- [ ] **Step 2: Volle Gate-Kette**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: typecheck grün · jest **alle** grün (inkl. `submission-gate` 23/23) · biome „No fixes" · esbuild „production build complete". `main.js` entsteht am Root (gitignored).

- [ ] **Step 3: README-Root-Gate (③) grün**

Run: `python3 <workspace>/_docs/readme/readme_lint.py obsidian-plugins/kuro-gamification`
Expected: kein `readme-present`-Error mehr (README.md liegt am Root). Verbleibende Warnungen notieren, nicht-blockierend.

- [ ] **Step 4: Commit lockfile**

```bash
git add package-lock.json
git commit -q -m "chore: package-lock.json (fresh install)"
```

---

### Task 6: Deploy-Test gegen das produktive Test-Vault (Kontinuität der bestehenden Installation)

**Files:** keine (nur Deploy + manuelle Smoke-Notiz)

**Interfaces:**
- Consumes: grüner Build aus Task 5.
- Produces: Bestätigung, dass die bestehende Vault-Installation + `data.json` mit dem flachen Repo weiterläuft (id unverändert → kein Orphan).

- [ ] **Step 1: `data.json` sichern (echter Vault-State)**

```bash
cp "<vault>/.obsidian/plugins/kuro-gamification/data.json" /tmp/kuro-data.bak 2>/dev/null || echo "keine data.json — frische Install ok"
```

- [ ] **Step 2: Deploy aus dem flachen Repo**

Run: `OBSIDIAN_PLUGIN_DIR="<vault>/.obsidian/plugins/kuro-gamification" npm run deploy`
Expected: `main.js`/`manifest.json`/`styles.css`/`versions.json` kopiert, kein Fehler.

- [ ] **Step 3: Deployte Version verifizieren**

Run: `cat "<vault>/.obsidian/plugins/kuro-gamification/manifest.json" | grep -E "version|fundingUrl"`
Expected: `"version": "1.0.0"`, **kein** `fundingUrl`. → Handover-Note vermerkt: Jay lädt das Plugin in Obsidian neu und smoked kurz (Sidebar lädt, `data.json` intakt).

- [ ] **Step 4: Kein Commit** (Deploy fasst das Repo nicht an).

---

### Task 7: Finaler `v1.0.0`-Commit + Handover-Note (Forge-Anlage = Jay)

**Files:**
- Create: `HANDOVER-forge-push.md` (temporär, im Repo-Root oder Scratchpad) — Checkliste für Jay.

**Interfaces:**
- Consumes: verifiziertes flaches Repo (Tasks 5–6).
- Produces: sauberer `1.0.0`-Startpunkt + klare Auth-Handover-Schritte.

- [ ] **Step 1: Historie glätten zu einem `v1.0.0`-Commit (frische Historie)**

```bash
cd <workspace>/obsidian-plugins/kuro-gamification
git reset --soft $(git rev-list --max-parents=0 HEAD)
git commit --amend -q -m "feat: Kuro Gamification 1.0.0 — erste öffentliche Version

Neurodivergenz-freundliche Gamification für Obsidian: XP, Level, Streaks mit
Freeze-Tokens, deterministische Loot-Drops, gothic-cyberpunk Lore. Off-by-default.
LLM-assistierter Pack-Import (Gothic/Plain/Cozy), Onboarding, EN+DE-Doku.

Migriert aus dem lokalen Container-Repo (Archiv: kuro-gamification-container).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
Verify: `git log --oneline` → **genau ein** Commit.

- [ ] **Step 2: Handover-Checkliste für Jay schreiben**

Create `HANDOVER-forge-push.md` mit diesen Schritten (Auth/nach-außen, kein Auto-Push):
```markdown
# Handover: Forge-Anlage + erster Push (CORE-GIT-01)

Voraussetzung: `~/.forgejo-token` existiert (Codeberg → Settings → Applications → Token mit repo-Scope).

1. Repos anlegen (leer, ohne README/gitignore/License):
   - Codeberg: `git.jkaindl.de/jkaindl/kuro-gamification`
   - GitHub:   `github.com/johannes-kaindl/kuro-gamification`
2. Remotes setzen:
   git remote add origin git@git.jkaindl.de:jkaindl/kuro-gamification.git
   git remote add github git@github.com:johannes-kaindl/kuro-gamification.git
3. Ersten Push (Codeberg kanonisch + GitHub-Mirror):
   git push -u origin HEAD
   git push github HEAD
4. Ersten Release (Dual-Push + CI):
   npm run release -- 1.0.0 --dry-run   # erst prüfen
   npm run release 1.0.0                # dann echt
5. Verifizieren (LESSONS.md:1158): GitHub-Default-Branch enthält manifest 1.0.0,
   Tag 1.0.0 steht auf dem Release-Commit; Store-Bot zieht main.js/manifest/styles.
6. Danach: HANDOVER-forge-push.md löschen, AGENTS.md CORE-GIT-01 → [x],
   Cockpit repo_remote aktualisieren.
```

- [ ] **Step 3: Handover NICHT committen** (temporär). Stattdessen Jay im Chat auf die Datei hinweisen.

- [ ] **Step 4: Endzustand melden** — flaches Repo grün, ein `v1.0.0`-Commit, Archiv intakt, wartet auf Jays Forge-Push.

---

## Self-Review

**Spec-Coverage:**
- Struktur (Plugin an Root) → Tasks 1–2 ✓
- Frische Historie ab v1.0.0 → Task 7 Step 1 ✓
- Container-Archiv lokal → Task 1 ✓
- Name/id behalten → Global Constraints + kein Rename-Task ✓
- Release-Pipeline (biome/jest) → Task 4 ✓
- Remotes/Tag → Task 7 Handover ✓
- ③ README-Root → Task 5 Step 3 ✓
- Ausführungs-Grenze (Handover) → Task 7 ✓
- Vault-Deploy-Kontinuität → Task 6 ✓
- docs/ aus zwei Quellen → Task 2 Steps 1–2 ✓

**Placeholder-Scan:** Kopier-Anweisungen zeigen auf reale Sibling-Dateien (konkrete Pfade), keine „TODO/TBD". Neue Dateien (.gitignore, CHANGELOG) sind vollständig ausgeschrieben.

**Typ-Konsistenz:** Script-/Script-Namen (`release.mjs`, `version-bump.mjs`, `codeberg-release.mjs`) durchgängig identisch; npm-Script-Namen (`lint`/`test`/`typecheck`/`build`/`deploy`) matchen kuros bestehende `package.json`.
