# Kuro Gamification

> [🇬🇧 English](README.md) · 🇩🇪 Deutsch

Neurodivergenz-taugliche Gamification für Obsidian — XP, Level, Streaks mit **Freeze-Tokens**, deterministische Loot-Drops und optionale Lore, off-by-default für alles, was eskalieren könnte.

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Docs: CC BY-SA 4.0](https://img.shields.io/badge/docs-CC%20BY--SA%204.0-lightgrey.svg)](LICENSE-DOCS)
[![Release](https://img.shields.io/badge/release-1.0.0-green.svg)](CHANGELOG.md)
![Platform](https://img.shields.io/badge/platform-Obsidian%20%E2%89%A5%201.5.0-7c3aed)

![Kuro Gamification](docs/images/hero.svg)

## Installation

1. `main.js`, `manifest.json`, `styles.css`, `versions.json` nach `<vault>/.obsidian/plugins/kuro-gamification/` kopieren
2. Settings → Community-Plugins → Plugins neu laden
3. Settings → Community-Plugins → Kuro Gamification → aktivieren
4. Optional: `kuro-gamification.css`-Snippet aus `assets/` nach `<vault>/.obsidian/snippets/` kopieren und unter Settings → Appearance → CSS-Snippets aktivieren — für die volle CRT-Phosphor-Optik

## Schnellstart (3 Klicks)

1. Öffne die **Kuro Status**-Sidebar via Ribbon-Icon (Terminal) oder `Cmd+P` → „Kuro: Status-Sidebar öffnen"
2. Hake eine Checkbox in deiner Daily-Note ab → Sidebar refresht binnen ~1 Sekunde
3. Sobald du Level 2 erreichst (200 XP), klick **🎲 Loot einlösen** für deine erste Belohnung

## Warum dieses Plugin?

Die meisten Gamification-Plugins für Note-Apps sind für neurotypische Gehirne gebaut: harte Streaks, die dich für einen verpassten Tag bestrafen, exponentielle XP-Kurven, die Konsistenz statt echtes Leben belohnen, Push-Notifications, die nerven. Dieses Plugin ist für ADHS und Autismus:

- **Freeze-Tokens absorbieren Lücken.** Ein verpasster Tag bricht den Streak nicht.
- **Lineare XP-Kurve.** Kein exponentieller Spike, der Fortschritt hinter Wochenend-Marathons sperrt.
- **Transparente Berechnung.** Optionale Verbose-Aufschlüsselung zeigt genau, *warum* welches XP entstand.
- **Jedes eskalierende Feature off-by-default.** Keine Status-Bar-Nervpolizei, kein Toast-Spam, kein Audio.
- **Features einzeln pausierbar.** XP aus Checkboxen? Aus. Streaks? Aus. Lore? Aus. Alle unabhängig.
- **Deterministische Loot-Auswahl.** Dieselben 3 Optionen bleiben sichtbar, bis du eine einlöst. Kein „Neu laden für bessere Optionen"-Pattern.

## Features

- **XP aus deinen Daily-Notes** — 2 XP pro abgehakter Checkbox + Tagesabschluss-Boni (50/75/90 %)
- **User-definierte Habits** — Frontmatter-Toggles `qigong: true` etc., XP pro Habit konfigurierbar
- **Weekly Review/Planning** — 50/30 XP für `review_done` / `planung_done` im Weekly-Frontmatter
- **Streaks mit Freeze-Tokens** — 2 freie Skip-Tage pro Monat (konfigurierbar). Streak-Bonus ab Tag 3/7/14/30
- **10 Level** — `SIGNAL LOST` → `K U R O`, alle Titel + Schwellen in Settings editierbar
- **Deterministische Loot-Drops** — 1 Drop pro Level über 1, 5 Tiers (Common → Mythic), 50+ Default-Belohnungen. Custom-Pool unterstützt
- **Lore-Reveal** — 10 narrative Fragmente, eines pro Level. Standardmäßig ruhige Klartext-Lore; fertige **Gothic-Cyberpunk**- und **Cozy**-Packs liegen im `packs/`-Ordner des Repos, oder importier dein eigenes
- **Sidebar-Status-Widget** + **Status-Codeblock** (`` ```kuro-status `` in jeder Note einbetten)
- **Manuelle XP-Anpassung** — für Offline-Aktivitäten, Geschenke, Korrekturen
- **Export / Import / Reset** — volle Daten-Portabilität via JSON, plus Loot/Lore-**Pack**-Import/-Export
- **Zweisprachig** — Deutsch und Englisch; folgt beim ersten Start deiner Obsidian-UI-Sprache

## Empfohlenes Habit-Setup (ADHS-tauglich)

Im Daily-Frontmatter:

```yaml
qigong: true
peloton: false
draussen: true
haushalt: false
pomodoros: 4
```

In Settings → Habits hinzufügen:
- `qigong` → `🧘 Qi Gong` → 10 XP
- `peloton` → `🚴 Peloton` → 15 XP
- `draussen` → `🌳 Draußen` → 10 XP
- `haushalt` → `🏠 Haushalt` → 10 XP

Pomodoro-Bonus: automatisch wenn `pomodoros >= threshold` (Default ≥ 4 → +10 XP).

## Dokumentation

- [Erste Schritte](docs/getting-started.de.md) · ([EN](docs/getting-started.en.md))
- [Handbuch](docs/manual.de.md) · ([EN](docs/manual.en.md))
- [Anpassung — Loot/Lore-Packs & LLM-Prompts](docs/customization.de.md) · ([EN](docs/customization.en.md))
- [Design-Philosophie](docs/philosophy.de.md) · ([EN](docs/philosophy.en.md))

## Lizenz

Code: **AGPL-3.0-or-later** — siehe [`LICENSE`](LICENSE).
Dokumentation: **CC BY-SA 4.0** — siehe [`LICENSE-DOCS`](LICENSE-DOCS).

Für AGPL-inkompatible Nutzung gibt es eine kommerzielle Lizenz-Option — siehe [`LICENSING.md`](LICENSING.md). Beiträge werden unter dem [CLA](CLA.md) angenommen.
