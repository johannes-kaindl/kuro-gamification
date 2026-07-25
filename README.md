# Kuro Gamification

> 🇬🇧 English · [🇩🇪 Deutsch](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/README.de.md)

**Neurodivergence-friendly gamification for Obsidian — XP, levels, streaks with freeze tokens, deterministic loot drops, and optional lore, with everything that could escalate off by default.**

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/LICENSE)
[![Docs: CC BY-SA 4.0](https://img.shields.io/badge/docs-CC%20BY--SA%204.0-lightgrey.svg)](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/LICENSE-DOCS)
[![Release](https://img.shields.io/gitea/v/release/jkaindl/kuro-gamification?gitea_url=https%3A%2F%2Fcodeberg.org&label=release)](https://codeberg.org/jkaindl/kuro-gamification/releases)
![Platform](https://img.shields.io/badge/platform-Obsidian%20%E2%89%A5%201.5.0-7c3aed)

![Kuro Gamification](https://codeberg.org/jkaindl/kuro-gamification/raw/branch/main/docs/images/hero.svg)

## Requirements

- **Obsidian ≥ 1.5.0**, desktop or mobile (`isDesktopOnly: false`).
- No external services, accounts, or network access — all XP/streak/loot/lore logic runs locally against your vault's daily notes.
- No runtime dependencies.

## Install

### Community Plugins

Search for **Kuro Gamification** in **Settings → Community plugins → Browse**, then click **Install** and **Enable**.

### Manual install

1. Download `main.js`, `manifest.json`, `styles.css`, `versions.json` from the [latest release](https://codeberg.org/jkaindl/kuro-gamification/releases) and copy them into `<vault>/.obsidian/plugins/kuro-gamification/`
2. Settings → Community plugins → Reload plugins
3. Settings → Community plugins → Kuro Gamification → enable
4. (Optional) Install the `kuro-gamification.css` snippet for the full CRT/phosphor aesthetic — see "Aesthetic CSS" below

## Usage

### Quick start (3 clicks)

1. Open the **Kuro Status** sidebar via the ribbon icon (terminal) or `Cmd+P` → "Open status sidebar"
2. Tick a checkbox in your daily note → sidebar refreshes within ~1 second
3. Once you reach Level 2 (200 XP), click the **🎲 Redeem loot** button to redeem your first reward

### Ongoing use

- Ticked checkboxes in your daily note earn XP automatically as you save — no manual logging.
- Add your own habits (frontmatter toggles like `qigong: true`) in Settings → Habits, each with its own XP value.
- Set `review_done: true` / `planung_done: true` in a weekly note's frontmatter for the weekly review/planning bonus.
- Embed a `kuro-status` code block (see [Status code block](#status-code-block) below) in any note for a live status view without opening the sidebar.
- Missed a day? A freeze token absorbs it automatically — no action needed, no streak lost.
- Use **Manual XP adjustment** (command palette) for offline activities, corrections, or gifts.

## Why this exists

Most gamification plugins for note apps are built for neurotypical brains: hard streaks that punish you for missing one day, exponential XP curves that reward consistency over actual life, push notifications that nag you. This one was built for ADHD and autism:

- **Freeze tokens absorb gaps.** A missed day doesn't break your streak.
- **Linear-quadratic XP curve.** No exponential spike that gates progress behind weekend marathons.
- **Transparent calculation.** Optional verbose breakdown shows exactly *why* each XP came from.
- **Every escalating feature off-by-default.** No status-bar nag, no toast spam, no audio.
- **Pause individual features.** XP from checkboxes? Off. Streaks? Off. Lore? Off. All independently.
- **Deterministic loot.** Same options stay until you redeem one. No "reload for better picks" pattern.

## Features

- **XP from your daily notes** — 2 XP per ticked checkbox + completion bonuses (50/75/90 %)
- **User-defined habits** — frontmatter toggles `qigong: true` etc., XP per habit configurable
- **Weekly review/planning bonus** — 50/30 XP on `review_done` / `planung_done` frontmatter
- **Streaks with freeze tokens** — 2 free skip-days per month (configurable). Streak-bonus tiers at 3/7/14/30 days
- **10-level progression** — `SIGNAL LOST` → `K U R O`, all titles + thresholds editable in Settings
- **Deterministic loot drops** — 1 drop per level above 1, 5 tiers (Common → Mythic), 50+ default rewards. Custom pool supported
- **Lore reveal** — 10 narrative fragments, one per level. Ships with calm plain-language lore by default; ready-made **gothic-cyberpunk** and **cozy** packs are in the repo's `packs/` folder, or import your own
- **Sidebar status widget** + **status code-block** (`` ```kuro-status `` embed in any note)
- **Manual XP adjustment** — for offline activities, gifts, mistakes
- **Export / import / reset** — full data portability via JSON, plus loot/lore **pack** import/export
- **Bilingual** — English and German; follows your Obsidian UI language on first launch

## Aesthetic CSS

This plugin works without external styling — it ships with sane structural CSS. For the full **gothic-cyberpunk CRT terminal aesthetic** (phosphor green, scanlines, flicker), copy the bundled snippet `kuro-gamification.css` (in this repo's `assets/`) into `<vault>/.obsidian/snippets/` and enable it via Settings → Appearance → CSS Snippets.

The snippet styles `pre.kuro-status`, `pre.kuro-loot`, and the `[!kuro]`, `[!levelup]`, `[!spoiler]`, `[!streak]` callouts. It has no hard dependency on the Kuro theme (works under any theme that respects CSS custom properties).

## Configuration

| Section | What it controls |
|---|---|
| 🎮 General | Language (DE/EN), reduce-animations, status-bar item, action notices, verbose breakdown, sidebar enable/disable |
| 📁 Paths | Daily/weekly folder paths + date formats |
| ⚡ XP sources | XP per checkbox, completion bonuses, pomodoro key/threshold/bonus |
| 🎯 Habits | Add/edit/remove your own habit list (frontmatter key + label + XP) |
| 📅 Weekly | Review/planning frontmatter keys + XP |
| 🔥 Streaks | Day-qualification threshold, monthly freeze tokens |
| 📊 Levels & loot | Loot enable/disable, options per drop |
| 📜 Lore | Lore reveal enable/disable |
| 📚 Packs | Install/switch/delete loot·lore packs; per-unit export/copy/reset to factory |
| 🛠 Advanced | Log level; whole-state data export/import/reset (incl. XP) |
| ℹ️ About | Version, link to in-vault docs |

## Status code block

Embed your status anywhere:

```markdown
```kuro-status
mode: full          # full | compact | minimal
loot: show          # show | hide
lore: show          # show | hide
breakdown: hide     # show | hide
```
```

## Recommended habits (example for an ADHD-friendly daily)

In your daily note frontmatter:

```yaml
qigong: true
peloton: false
draussen: true
haushalt: false
pomodoros: 4
```

Then in Settings → Habits, add e.g.:
- `qigong` → `🧘 Qi Gong` → 10 XP
- `peloton` → `🚴 Peloton` → 15 XP
- `draussen` → `🌳 Draußen` → 10 XP
- `haushalt` → `🏠 Haushalt` → 10 XP

Pomodoros bonus is automatic when `pomodoros >= threshold` (default ≥ 4 → +10 XP).

## How it works

The plugin watches `vault.modify` events (800 ms debounced) on your daily/weekly notes. On each trigger it re-reads the relevant notes' checkboxes and frontmatter, and pure-function engines compute the result from scratch — XP totals, level, streak state, and (once a new level is reached) a deterministic loot drop:

- **`XpEngine`** sums XP from ticked checkboxes, completion-percentage bonuses, configured habits, and the weekly review/planning bonus, then derives the level from the linear-quadratic curve.
- **`StreakEngine`** checks whether "today" met the day-qualification threshold, consumes a freeze token on a missed day instead of resetting, and applies streak-tier bonuses (3/7/14/30 days).
- **`LootEngine`** picks a deterministic reward per level-up above 1 (seeded by level + save count, so a drop doesn't change on reload) from a 5-tier pool that's user-replaceable via **packs**.
- **`LoreEngine`** reveals the narrative fragment tied to the new level, from whichever lore pack is active.

All four engines live under `src/engine/`, are free of Obsidian imports, and run in plain Node under jest — the UI layer (sidebar, status code-block, modals, settings tab) is a thin layer over these pure computations and the Obsidian API. Data is persisted to `data.json` via Obsidian's plugin data API; export/import/reset in Settings → Erweitert operate on that same JSON.

### Architecture

- TypeScript strict, ES2018 target, no runtime dependencies
- ~87 KB bundled (esbuild)
- 209 unit tests (engines, data store, submission gate, i18n, utils, main lifecycle)
- Pure-function engines — easy to test, no Obsidian-API coupling
- Vault-reactive: `vault.modify` debounced 800ms triggers refresh

## Credits

- Design seed by Jay (`v6t2b9`), 2026-03 to 2026-04
- Codified into a plugin in 2026-04

## Documentation

- [Getting Started](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/docs/getting-started.en.md) · ([DE](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/docs/getting-started.de.md))
- [Manual](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/docs/manual.en.md) · ([DE](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/docs/manual.de.md))
- [Customization — loot/lore packs & LLM prompts](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/docs/customization.en.md) · ([DE](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/docs/customization.de.md))
- [Design Philosophy](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/docs/philosophy.en.md) · ([DE](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/docs/philosophy.de.md))

## License

Code: **AGPL-3.0-or-later** — see [`LICENSE`](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/LICENSE).
Documentation: **CC BY-SA 4.0** — see [`LICENSE-DOCS`](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/LICENSE-DOCS).

A commercial license is available for uses incompatible with the AGPL — see [`LICENSING.md`](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/LICENSING.md). Contributions are accepted under the [CLA](https://codeberg.org/jkaindl/kuro-gamification/src/branch/main/CLA.md).
