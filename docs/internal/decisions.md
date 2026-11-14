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

## Warum der Chat das Kit-Fenster trägt (2026-10-24; Namenszeile und Linkschutz am 2026-10-25 nachgezogen)

Der Chat-Tab baut `buildChatWindow` und `buildModelBar` des Kits (UI-STANDARD § 8, Bausteine 12 und 15). Vier Chat-Plugins hatten dasselbe Fenster je für sich gebaut; das Kit trägt jetzt Verlauf, Eingabe, Abbruch, Fehlerzeilen und Markdown, und Kuro hält nur, was Kuro selbst sagt: Prompt und Kontext (`main.sendChat`, `llm/chatRequest`), die Kontextzeile, den Einrichtungs-Hinweis und „merk dir“. Die Namenszeile „Kuro“ über den Antworten gab es im Kit-Fenster zunächst nicht und wurde nicht nachgebaut; seit Kit 0.70.0 kommt sie über die Option `labels` (Welle 27).

Der **Linkschutz** war am 2026-10-24 ein offener Befund, kein Umbau-Schaden (seit Kit 0.70.0 im Fenster, siehe unten): `neutralizeModelMarkdown` plus `MarkdownRenderer.render` kappen `javascript:` und `data:`, nicht `obsidian://`, `file://`, `app://`. Gemessen am echten Fenster und am Tag 1.15.0 mit derselben Sechs-Links-Probe, das Ergebnis ist gleich. Eine eigene Kappung neben dem Kit-Fenster wäre ein Doppelbau (anders als bei settings-assistant, dessen altes Panel einen eigenen Durchgang hatte, der inzwischen ebenfalls im Kit steht); der Schutz kam mit dem Kit-Task „Linkschutz in Modellantworten“. **Stand 2026-10-25:** der `domGuard` des Kit-Fensters kappt `javascript:`, `data:`, `vbscript:`, `file:` und `app:` immer, `obsidian://` und lokale Bilder nur mit den zwei Schaltern „Links und Bilder in Antworten“ (beide aus, Off-by-default wie bei allem, was eskalieren könnte); der Smoke-Punkt `chat/linkschutz-skript-schemata` ist grün, ein Punkt für den Schalter kam dazu.

## Warum der Verlauf vergangener Chats aus ist, der Ordner gemeinsam und die Kontextzeile im Kopf bleibt (2026-11-01, Welle 29)

Mit Kit 0.74.0 trägt das Chat-Fenster die Option `archive`: jedes Gespräch wird als `.json` in einen Vault-Ordner abgelegt, ein Knopf neben Neu öffnet die Liste. **Aufbewahrung 0 (aus) ist die Vorgabe** (Entscheidung Johannes für settings-assistant, vom Master auf alle Chat-Plugins der Welle übertragen): Kuro schreibt nichts in den Vault, was Johannes nicht eingeschaltet hat (Leitprinzip off-by-default); das Gespräch enthält Notizinhalt (Aufgaben, Habits), und der README-Satz „Kuro hat bewusst kein Gedächtnis“ bleibt ohne Einschalten wahr. Ein Wert in `data.json`, der keine Zahl ist, wird 0 (die 50 des Kits würden den Verlauf einschalten). **Der Ordner ist gemeinsam**: die Aufbewahrung ist eine Einstellung des Plugins, nicht des Blatts; jedes Gespräch ist eine eigene Datei, es kollidieren also auch zwei Blätter nicht. Der Verlauf im Fenster bleibt je Blatt (Entscheidung 2026-10-25, Welle 27). **Die Kontextzeile bleibt im Einschub `header`** (über dem Gespräch), die Modellzeile geht in den `composer` (Pflicht seit Kit 0.73.0). Am Bild (390 × 508, Tastatur offen) bleiben 3,6 Zeilen Antwort statt 0,5 vorher; die Kontextzeile kostet davon eine Zeile, den größeren Teil nehmen die Werkzeugleiste (Neu berechnen, Loot einlösen) und die Tab-Leiste der Seitenleiste (rund 160 px), die nicht zum Chat gehören; die Werkzeugleiste blendet sich seit Welle 30 im Chat-Tab auf dem Handy aus (Entscheidung Johannes 2026-11-02, die Knöpfe gehören zum Status; Klasse `is-chat-tab` an der Wurzel, `.is-mobile`-Regel in der `styles.css`, am Desktop bleibt sie), die Tab-Leiste bleibt. Gemessen in der Schublade (390 × 508, Standardmethode, hell und dunkel): 6,0 statt 3,6 Zeilen Antwort.

Den Schalter **„Lokale Bilder anzeigen“** gibt es nicht mehr: Im Kit-Chat-Fenster waren Bilder aus dem Vault schon vorher Text (Kit-MIGRATION 0.70.0 Punkt 3; gemessen in Welle 28, Antworten mit Markdown-Bild und Embed, Schalter aus und an: nie ein `img`), er wirkte also nie. Gespeicherte Werte werden still verworfen. Kommt später ein Kit-Baustein „nur `allowObsidianLinks`“, ist die Frage neu zu stellen.

## Warum die Ansicht am Handy ein Tab im Hauptbereich ist und in `contentEl` baut (2026-11-03, Welle 30)

Entscheidung Johannes 2026-11-02: auf jedem Mobilgerät (`Platform.isMobile`, Handy und Tablet) öffnet Kuro als Tab im Hauptbereich, der Desktop bleibt in der rechten Seitenleiste. Grund: unter der Schublade hängt Obsidians eigene Tab-Auswahl, der Chat endet über der Tastatur, und im Hauptbereich greift der Kit-Abstand zur schwebenden Leiste. Die Wahl steht nicht im Plugin, sondern im Kit (`openChatLeaf`, 0.77.0; vorher hatten vier Plugins Eigenfassungen, drei mit dem Loch, dass ein in der Schublade gespeichertes Blatt dort für immer blieb); `activateSidebar` ruft ihn, `enableSidebar` und das Start-Tor bleiben beim Plugin. **Der Start öffnet am Handy nichts von selbst** (`openSidebarOnStartup` gilt nur am Desktop): ein Tab bei jedem Start ist aufdringlich; Ribbon, Befehl und Statusleiste öffnen ihn ausdrücklich. Beim Schließen eines Schubladen-Blatts bleibt der Verlauf (das Plugin hält ihn im Speicher), der ungesendete Entwurf und eine laufende Antwort gehen verloren; das trifft praktisch nur das erste Öffnen nach dem Update.

**Die Ansicht baut in `contentEl`, nicht in `containerEl`.** Der Kit-Host-Abstand (`markChatHost`, Klasse `okit-chat-host` am `.view-content`) greift nur, wenn es ein `.view-content` gibt; vorher leerte die Ansicht `containerEl` samt Kopfzeile und `.view-content` und baute die Wurzel direkt hinein, `markChatHost` tat dann still nichts. Folge für die Optik: am Handy-Tab steht Obsidians Kopfzeile des Blatts (44,5 px, Titel „Kuro Status“) über der Ansicht, das ist die übliche Obsidian-Gestalt und kostet rund zwei Zeilen; am Desktop-Seitenleiste bleibt sie unsichtbar. Obsidians Innenabstand des `.view-content` (12 px, unten 32 px am Desktop) setzt eine Kuro-Regel auf 0, weil die Wurzel ihren eigenen trägt und die Seitenleiste sonst schmaler und kürzer würde; die Kit-Regel für den unteren Abstand am Handy hat mehr Klassen und gilt weiter. Gemessen: `docs/SMOKE.md` (2026-11-03, Nachtrag Handy-Tab).

## Warum die Statusleiste an ist, obwohl das Plugin „off-by-default“ führt (2026-11-14, Welle 34)

Entscheidung Johannes 2026-11-12 für alle Plugins mit Statusleisten-Eintrag (obsidian-kit `status-bar-item`, UI-STANDARD § 8): Vorgabe **an**, damit ein Update keine genutzte Anzeige abschaltet. Für Kuro heißt das eine bewusste Ausnahme vom Leitprinzip „off-by-default für alles, was eskalieren könnte“: der Eintrag „Lvl X · N XP“ ist passiv (kein Ton, keine Meldung, kein Dialog) und eskaliert nichts; die README sagt es ausdrücklich. Ein gespeicherter Wert gilt weiter (`statusBarEnabled` beim Laden), nur ein fehlender oder ungültiger wird „an“; der Schalter in den Einstellungen bleibt. Der Eintrag ist seither ein Knopf mit Tastatur (`role="button"`, Enter und Leertaste). Messung: `tests/main-status-bar.test.ts` über das echte `onload`, im GUI-Smoke die Sektion „0 · Statusleiste“.

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
