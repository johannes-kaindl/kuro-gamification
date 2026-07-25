# CORE-GIT-01 — Forge-Migration: kuro auf Sibling-Form + Release-Pipeline

**Datum:** 2026-07-24
**Status:** Design (genehmigt) — Ausführung folgt als eigene Session
**Betrifft:** `obsidian-plugins/kuro-gamification`
**Voraussetzung erfüllt:** Submission-Gate (`SubmissionGate.ts`, Commit `56c4ab6`) ist grün.

## Problem

kuro soll für die Obsidian-Community-Einreichung ein öffentliches Repo mit
Releases bekommen (Codeberg kanonisch + GitHub-Mirror; der Store-Bot zieht
`main.js`/`manifest.json`/`styles.css` aus einem GitHub-Release, dessen Tag der
`manifest.json`-Version entspricht).

kuro ist aber das **einzige** der 14 Plugins unter `obsidian-plugins/`, das nicht
wie ein publizierbares Plugin-Repo geformt ist:

1. **Plugin-Code liegt in `40_src/`**, nicht am Repo-Root. Der Store-Bot und alle
   Sibling-Tools erwarten `manifest.json`/`main.js`/`README.md` am **Root**.
2. **`node_modules/` ist bewusst getrackt** (lokal-only Workflow-Archiv) — darf
   nie auf ein öffentliches Repo.
3. **Container-Workflow-Ordner** `10_discovery … 90_workflow-log` + `50_build` —
   privates Arbeitsmaterial, gehört nicht in ein öffentliches Plugin-Repo.

Die 13 Sibling-Plugins sind dagegen saubere Root-Repos mit einer erprobten,
geteilten `release.mjs`-Pipeline (PROF-OBS-09).

## Entscheidungen (genehmigt)

| Frage | Entscheidung |
|-------|-------------|
| Struktur | **An Sibling-Form angleichen** — Plugin-Source an den Repo-Root. |
| Historie | **Frische, saubere Historie ab `v1.0.0`.** Container mit voller Historie bleibt LOKAL als Archiv, wird nie gepusht. |
| Name / `id` | **„Kuro Gamification" / `kuro-gamification` behalten** (permanent nach erstem Store-Listing — LESSONS.md:238; jetzt bewusst festgezurrt). |
| Remotes | `origin` = `codeberg.org/jkaindl/kuro-gamification` · Mirror = `github.com/johannes-kaindl/kuro-gamification`. |
| Release-Tag | = `manifest.json`-Version → `1.0.0`. |
| Session-Scope | Nur **Spec + Plan** hier; invasiver Umbau + Forge-Anlage als eigene Session. |

## Ziel-Layout (neues flaches Repo)

Ersetzt den kanonischen Pfad `obsidian-plugins/kuro-gamification/` (Deploy-Target,
Cockpit-`repo_pfad`, alle Referenzen bleiben dadurch stabil):

```
manifest.json  main.js(gitignored)  styles.css  versions.json
package.json  package-lock.json  tsconfig.json  tsconfig.build.json
esbuild.config.mjs  biome.json  jest.config.js
src/  tests/  docs/
scripts/  .github/workflows/release.yml
LICENSE  LICENSE-DOCS  LICENSING.md  CLA.md
README.md  README.de.md  CHANGELOG.md  CONTRIBUTING.md  SECURITY.md
AGENTS.md(neu: flach, kein 40_src)  .gitignore  .editorconfig
```

Inhalt: alles aus heutigem `40_src/` (außer `node_modules/`), plus die neuen
Meta-Dateien aus der Sibling-Vorlage.

## Komponenten

### 1. Archiv-Umzug (lokal, non-destruktiv)
- Aktuelles Container-Repo → umbenennen zu `kuro-gamification-container/`
  (Geschwister-Ordner unter `obsidian-plugins/`). Behält volle Historie,
  `10_discovery…90_workflow-log`, `50_build/`, getrackte `node_modules/`.
- Wird **nie** mit einem Remote verbunden / gepusht.

### 2. Neues flaches Repo
- Am kanonischen Pfad `obsidian-plugins/kuro-gamification/`.
- Inhalt aus **zwei Quellen** im Archiv zusammenführen:
  - `kuro-gamification-container/40_src/` → `src/`, `tests/`, `docs/images/`,
    Build-Configs, `manifest.json`, `styles.css`, `versions.json`, README/LICENSE
    (ohne `node_modules/`).
  - `kuro-gamification-container/docs/superpowers/{specs,plans}/` (liegt am
    **Container-Root**, nicht in `40_src/`) → `docs/superpowers/` im neuen Repo.
- `git init` + ein Commit `v1.0.0`.
- `.gitignore` (Sibling-Muster): `node_modules/`, `main.js`, `data.json`,
  `.claude/`, `.DS_Store`. **Anders als der Container: `node_modules` wird hier
  NICHT getrackt** — die AGENTS.md-Regel „node_modules bewusst getrackt" gilt nur
  fürs Archiv und wird in der neuen AGENTS.md nicht übernommen.

### 3. Release-Pipeline (aus Sibling kopiert, für kuro angepasst)
- `scripts/release.mjs` + `scripts/version-bump.mjs` + `scripts/lib/codeberg-release.mjs`
  (Ein-Befehl-Release: bump → changelog → commit → tag → Codeberg-Push → build →
  Codeberg-Release → GitHub-Mirror).
- **kuro-Anpassungen:** Das Pre-Release-Gate ruft **`npm test`** (inkl.
  `SubmissionGate` ✓) + **`biome check`** + **`typecheck`** — NICHT eslint
  (kuro ist biome-only) und NICHT vitest (kuro nutzt jest). Sibling-Vorlagen
  referenzieren eslint/vitest; diese Stellen ersetzen.
- `.github/workflows/release.yml`: GitHub-Tag → Store-Release-Artefakte.
- **Dual-Push-Verifikation** (LESSONS.md:1158, slide-deck-Störfall): nach dem Push
  `git ls-remote <mirror>` — Tag muss (peeled) auf dem Release-Commit stehen, der
  Default-Branch muss ihn enthalten (`git merge-base --is-ancestor`).

### 4. Neue Meta-Dateien
- `CHANGELOG.md` (Start bei 1.0.0), `CONTRIBUTING.md`, `SECURITY.md` — aus
  Sibling-Vorlage adaptiert.
- `AGENTS.md` neu geschrieben: flache Struktur, kein `40_src`, kein
  getracktes-node_modules-Gotcha; deploy-Script vereinfacht
  (`cp main.js manifest.json styles.css $OBSIDIAN_PLUGIN_DIR/`).

### 5. Löst ③ nebenbei
`readme_lint.py`-`error` (README.md fehlt am Root) verschwindet, weil im flachen
Repo `README.md` am Root liegt.

## Ausführungs-Grenze (load-bearing)

- **Autonom (lokal):** Archiv-Umzug, `git init`, Datei-Migration, Pipeline-Setup,
  neue AGENTS.md, lokaler Build + volle Test-/Lint-/Typecheck-Verifikation,
  Deploy-Test gegen das produktive Test-Vault.
- **Handover an Jay (nach außen / Auth):** Repos auf Codeberg + GitHub anlegen,
  `~/.codeberg-token` bereitstellen, erster Push (`origin` + Mirror), erster
  Release-Lauf. Der Plan markiert diese Schritte klar als Handover — **kein
  Auto-Push**.

## Risiken / Gotchas

- **Vault-Deploy-Kontinuität:** Der Deploy-Target-Pfad
  `.obsidian/plugins/kuro-gamification/` bleibt gleich (id unverändert) → die
  bestehende Vault-Installation + `data.json` bleiben gültig, keine Migration.
- **`package-lock.json` / `node_modules`:** Im neuen Repo `npm install` frisch,
  `package-lock.json` committen; `node_modules` gitignored.
- **Kein Datenverlust beim Archiv-Umzug:** reines `mv` des Verzeichnisses; der
  Container bleibt vollständig erhalten, bis Jay ihn explizit freigibt.
- **Sibling-Vorlage nicht blind kopieren:** eslint/vitest-Referenzen in
  `release.mjs` / CI müssen auf biome/jest umgeschrieben werden (sonst bricht das
  Gate oder läuft ins Leere — vgl. apple-health-Lektion „Gate, das die Datei nie
  sieht").

## Definition of Done (für die Ausführungs-Session)

- [ ] Container als `kuro-gamification-container/` archiviert, unangetastet.
- [ ] Flaches Repo am kanonischen Pfad, `git init` + `v1.0.0`-Commit.
- [ ] `npm install` + Build + `npm test` + `biome check` + `typecheck` grün.
- [ ] `readme_lint.py` grün (README am Root).
- [ ] Release-Pipeline lokal `--dry-run`-verifiziert (biome/jest, kein eslint).
- [ ] Deploy gegen das produktive Test-Vault getestet, Plugin lädt, `data.json` intakt.
- [ ] Handover-Note für Jay: Forge-Anlage + Token + erster Push/Release.
```
