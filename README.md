# Kuro Gamification

> 🇬🇧 English · [🇩🇪 Deutsch](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/README.de.md)

**Neurodivergence-friendly gamification for Obsidian — XP, levels, streaks with freeze tokens, deterministic loot drops, and optional lore, with everything that could escalate off by default.**

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/LICENSE)
[![Docs: CC BY-SA 4.0](https://img.shields.io/badge/docs-CC%20BY--SA%204.0-lightgrey.svg)](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/LICENSE-DOCS)
[![Release](https://img.shields.io/gitea/v/release/jkaindl/kuro-gamification?gitea_url=https%3A%2F%2Fgit.jkaindl.de&label=release)](https://git.jkaindl.de/jkaindl/kuro-gamification/releases)
![Platform](https://img.shields.io/badge/platform-Obsidian%20%E2%89%A5%201.8.7-7c3aed)

Your daily notes already record what you did — this plugin reads them and turns that into XP, levels and a streak that survives a missed day. It runs entirely inside your vault: no account, no server, no network access, and nothing that nags you unless you switch it on yourself.

![Kuro Gamification](https://git.jkaindl.de/jkaindl/kuro-gamification/raw/branch/main/docs/images/hero.svg)

## Features

- **XP from your daily notes** — 2 XP per ticked checkbox + completion bonuses (50/75/90 %)
- **User-defined habits** — frontmatter toggles `qigong: true` etc., XP per habit configurable
- **Weekly review/planning bonus** — 50/30 XP on `review_done` / `planung_done` frontmatter
- **Streaks with freeze tokens** — 2 free skip-days per month (configurable). Streak-bonus tiers at 3/7/14/30 days
- **10-level progression** — `SIGNAL LOST` → `K U R O`, all titles + thresholds editable in Settings
- **Deterministic loot drops** — 1 drop per level above 1, 5 tiers (Common → Mythic), 50+ default rewards. Custom pool supported
- **Lore reveal** — 10 narrative fragments, one per level. Ships with calm plain-language lore by default; ready-made **gothic-cyberpunk** and **cozy** packs are in the repo's `packs/` folder, or import your own
- **Sidebar status widget** + **status code-block** (`` ```kuro-status `` embed in any note)
- **"Adjust XP manually…"** — command for offline activities, gifts, mistakes
- **Export / import / reset** — full data portability via JSON, plus loot/lore **pack** import/export
- **Bilingual** — English and German; follows your Obsidian UI language on first launch

## Why this exists

Most gamification plugins for note apps are built for neurotypical brains: hard streaks that punish you for missing one day, exponential XP curves that reward consistency over actual life, push notifications that nag you. This one was built for ADHD and autism:

- **Freeze tokens absorb gaps.** A missed day doesn't break your streak.
- **Linear-quadratic XP curve.** No exponential spike that gates progress behind weekend marathons.
- **Transparent calculation.** Optional verbose breakdown shows exactly *why* each XP came from.
- **Every escalating feature off-by-default.** No status-bar nag, no toast spam, no audio.
- **Pause individual features.** XP from checkboxes? Off. Streaks? Off. Lore? Off. All independently.
- **Deterministic loot.** Same options stay until you redeem one. No "reload for better picks" pattern.

## Requirements

- **Obsidian ≥ 1.8.7**, desktop or mobile (`isDesktopOnly: false`).
- No external services, accounts, or network access — all XP/streak/loot/lore logic runs locally against your vault's daily notes.
- No runtime dependencies.

## Install

### Community Plugins

Search for **Kuro Gamification** in **Settings → Community plugins → Browse**, then click **Install** and **Enable**.

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://git.jkaindl.de/jkaindl/kuro-gamification/releases) and copy them into `<vault>/.obsidian/plugins/kuro-gamification/`
2. Settings → Community plugins → Reload plugins
3. Settings → Community plugins → Kuro Gamification → enable

### From source

```bash
git clone https://git.jkaindl.de/jkaindl/kuro-gamification
cd kuro-gamification && npm install && npm run build
# main.js manifest.json styles.css → <vault>/.obsidian/plugins/kuro-gamification/
```

Optionally install the CRT/phosphor aesthetic CSS snippet afterwards — see [Aesthetic CSS](#aesthetic-css) below.

## Usage

### Quick start (3 clicks)

1. Open the **Kuro Status** sidebar via the ribbon icon (terminal) or the command palette → "Open status sidebar"
2. Tick a checkbox in your daily note → sidebar refreshes within ~1 second
3. Once you reach Level 2 (200 XP), click the **🎲 Redeem loot** button to redeem your first reward

### Ongoing use

- Ticked checkboxes in your daily note earn XP automatically as you save — no manual logging.
- Add your own habits (frontmatter toggles like `qigong: true`) in Settings → Habits, each with its own XP value.
- Set `review_done: true` / `planung_done: true` in a weekly note's frontmatter for the weekly review/planning bonus.
- Embed a `kuro-status` code block (see [Status code block](#status-code-block) below) in any note for a live status view without opening the sidebar.
- Missed a day? A freeze token absorbs it automatically — no action needed, no streak lost.
- Use the **"Adjust XP manually…"** command for offline activities, corrections, or gifts.

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

### Status code block

Embed your status anywhere:

````markdown
```kuro-status
mode: full          # full | compact | minimal
loot: show          # show | hide
lore: show          # show | hide
breakdown: hide     # show | hide
```
````

### Recommended habits (example for an ADHD-friendly daily)

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

Pomodoros bonus is automatic when `pomodoros >= threshold` (default ≥ 4 → +10 XP). The
`pomodoros` field also accepts the session array [TaskNotes](https://github.com/callumalpass/tasknotes)
writes when its `pomodoroStorageLocation` is set to `"daily-notes"` — Kuro counts only
completed work sessions from that array, ignoring breaks and interrupted sessions.

### Aesthetic CSS

This plugin works without external styling — it ships with sane structural CSS. For the full **gothic-cyberpunk CRT terminal aesthetic** (phosphor green, scanlines, flicker), see [Aesthetic CSS](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/aesthetic-css.en.md) · ([DE](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/aesthetic-css.de.md)) for the CSS and install instructions (it's kept as a doc, not a tracked `.css` file, so it isn't bundled and never shows up in CSS linting of the plugin's own source).

The snippet styles `pre.kuro-status`, `pre.kuro-loot`, and the `[!kuro]`, `[!levelup]`, `[!spoiler]`, `[!streak]` callouts. It has no hard dependency on the Kuro theme (works under any theme that respects CSS custom properties).

### Companion chat (optional, off by default)

Kuro can talk to you: ask what to start with, say you're stuck, or think out loud about the
day. It is **off by default** — while `Enable chat` is off, the plugin makes no network
connection at all and the sidebar looks exactly as before.

The chat talks to an **OpenAI-compatible endpoint you configure yourself**. There is no
preset provider and no cloud default; it is meant for a local server such as
[LM Studio](https://lmstudio.ai) (`http://localhost:1234`) or
[Ollama](https://ollama.com) (`http://localhost:11434`).

**What is sent, and when.** Nothing is sent until you ask a question. With each question go:

| Always | Depending on `From today's note` |
|---|---|
| Level, XP, streak, freeze tokens, today's progress, open drops, last unlocked lore title | `Nothing` — no note content at all · `Tasks and habits` (default) — the checkbox lines and your configured habit fields · `The whole note` |
| Your notes list (see below) | |

The default deliberately leaves journal prose out of it. Settings → 💬 Kuro chat shows a
**live preview of exactly what would be sent** from today's note, and the chat tab has the
same preview behind a disclosure triangle — both render through the same function that
builds the prompt, so the preview cannot drift from reality.

**Notes (📌).** Kuro has no memory of past conversations by design — the history is not
saved and is gone when Obsidian closes. What does persist is a short list of sentences you
ask it to remember: *"Don't remind me about streaks unprompted."* Add them by writing
`remember: …` in the chat, with the 📌 button next to your own messages, or directly in
Settings → 📌 Notes, where you can edit and delete them at any time. The list holds 20
entries; when it's full the add button is disabled rather than silently dropping the
oldest one.

**Voice.** The tone comes from the active lore pack (`persona` field) — the Cozy pack speaks
warmly, the Gothic pack darkly — or from your own text in the settings, which overrides it.
Kuro is instructed not to comment on your numbers unless you ask, and not to act as a
therapist.

## How it works

The plugin watches `vault.modify` events (800 ms debounced) on your daily/weekly notes. On each trigger it re-reads the relevant notes' checkboxes and frontmatter, and pure-function engines compute the result from scratch — XP totals, level, streak state, and (once a new level is reached) a deterministic loot drop:

- **`XpEngine`** sums XP from ticked checkboxes, completion-percentage bonuses, configured habits, and the weekly review/planning bonus, then derives the level from the linear-quadratic curve.
- **`StreakEngine`** checks whether "today" met the day-qualification threshold, consumes a freeze token on a missed day instead of resetting, and applies streak-tier bonuses (3/7/14/30 days).
- **`LootEngine`** picks a deterministic reward per level-up above 1 (seeded by level + save count, so a drop doesn't change on reload) from a 5-tier pool that's user-replaceable via **packs**.
- **`LoreEngine`** reveals the narrative fragment tied to the new level, from whichever lore pack is active.

The engines carry no Obsidian imports, so they run in plain Node under jest — the UI layer (sidebar, status code-block, modals, settings tab) is a thin layer over these pure computations and the Obsidian API. Data is persisted to `data.json` via Obsidian's plugin data API; export/import/reset in Settings → Advanced operate on that same JSON. Module layout and the architectural rules behind it are documented in [`AGENTS.md`](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/AGENTS.md).

## Documentation

- [Getting Started](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/getting-started.en.md) · ([DE](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/getting-started.de.md))
- [Manual](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/manual.en.md) · ([DE](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/manual.de.md))
- [Customization — loot/lore packs & LLM prompts](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/customization.en.md) · ([DE](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/customization.de.md))
- [Design Philosophy](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/philosophy.en.md) · ([DE](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/docs/philosophy.de.md))

## Contributing

Issues and pull requests go to [Forgejo](https://git.jkaindl.de/jkaindl/kuro-gamification) (the GitHub repo is a mirror). Development is test-driven — `npm test` must stay green, and the engines are the place where new rules belong. See [`CONTRIBUTING.md`](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/CONTRIBUTING.md) and [`AGENTS.md`](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/AGENTS.md); contributions are accepted under the [CLA](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/CLA.md).

## Credits

- Design seed by Jay (`v6t2b9`), 2026-03 to 2026-04
- Codified into a plugin in 2026-04

## License

Code: **AGPL-3.0-or-later** — see [`LICENSE`](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/LICENSE).
Documentation: **CC BY-SA 4.0** — see [`LICENSE-DOCS`](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/LICENSE-DOCS).

A commercial license is available for uses incompatible with the AGPL — see [`LICENSING.md`](https://git.jkaindl.de/jkaindl/kuro-gamification/src/branch/main/LICENSING.md).

Copyright © 2026 Johannes Kaindl.
