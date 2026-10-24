# Entscheidungen in kuro-gamification — das Warum

Verdichtete Design-Essenz zu den Regeln im Kern (`AGENTS.md`) und in `.claude/rules/`; die Herleitungen liegen im Coding-Cockpit des Maintainers. Vor dem Übernehmen einer Altentscheidung gilt Johannes' Regel: Grund aufsuchen, messen, ob er heute trägt, Ergebnis melden.

## Der Store-Gate-Lint (2026-07-25)

`eslint-plugin-obsidianmd` läuft seit 2026-07-25 additiv zu biome über `src/**/*.ts` (`npm run lint:obsidian`), nachdem ein manueller Review-Auftrag reale Findings zutage förderte, die biome und `SubmissionGate` nicht sahen: doppeltes Command-Präfix, `minAppVersion` zu niedrig für tatsächlich genutzte APIs, `globalThis`-, `console.info`- und `element.style`-Verstöße.

## Warum die Einstellungen rein deklarativ sind (2026-08-18)

**Anlass war eine Messung, keine Meinung:** der Guard in `preflight.mjs` verbot 1.13+ als
  „Catalyst-only"-Floor, aber `latestVersion` im **public** Kanal von `desktop-releases.json`
  stand am 2026-08-18 auf **1.13.7**, identisch mit `beta.latestVersion` — 1.13 war längst
  öffentlich, die hartkodierte Konstante (1.12.7) war schlicht veraltet. Sie ist im Dach
  nachgezogen worden, mitsamt Mess-Datum und Quelle im Kommentar.

## Warum der Chat das Kit-Fenster trägt und der Linkschutz offen bleibt (2026-10-24)

Der Chat-Tab baut `buildChatWindow` und `buildModelBar` des Kits (UI-STANDARD § 8, Bausteine 12 und 15). Vier Chat-Plugins hatten dasselbe Fenster je für sich gebaut; das Kit trägt jetzt Verlauf, Eingabe, Abbruch, Fehlerzeilen und Markdown, und Kuro hält nur, was Kuro selbst sagt: Prompt und Kontext (`main.sendChat`, `llm/chatRequest`), die Kontextzeile, den Einrichtungs-Hinweis und „merk dir“. Die Namenszeile „Kuro“ über den Antworten gibt es im Kit-Fenster nicht; sie wurde nicht nachgebaut (Entscheidung steht beim Master).

Der **Linkschutz** ist ein offener Befund, kein Umbau-Schaden: `neutralizeModelMarkdown` plus `MarkdownRenderer.render` kappen `javascript:` und `data:`, nicht `obsidian://`, `file://`, `app://`. Gemessen am echten Fenster und am Tag 1.15.0 mit derselben Sechs-Links-Probe, das Ergebnis ist gleich. Eine eigene Kappung neben dem Kit-Fenster wäre ein Doppelbau (anders als bei settings-assistant, dessen altes Panel `stripActiveContent` hatte); der Schutz kommt mit dem Kit-Task „Linkschutz in Modellantworten“. Bis dahin bleibt der Smoke-Punkt `chat/linkschutz-skript-schemata` rot und trägt den Hinweis.

## Herkunft: das Container-Repo vor v1.0.0

Vor v1.0.0 lebte dieses Plugin in einem verschachtelten Container-Repo
(`40_src/`, bewusst getrackte `node_modules`, Workflow-Ordner `10_discovery…90_workflow-log`).
Bei der Öffentlich-Machung (CORE-GIT-01, 2026-07-24) auf flache Sibling-Form migriert, frische
Historie ab v1.0.0. Die volle Vor-1.0.0-Historie liegt lokal im Archiv
`~/Archive/repos/kuro-gamification-container` (seit 2026-09-14; vorher `../kuro-gamification-container`, nur als privates Forgejo-Archiv gesichert).

## Abgeschlossene Konventions-Punkte (Stand 2026-07-25)

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
