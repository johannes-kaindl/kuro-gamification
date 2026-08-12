# Changelog

All notable changes to this plugin are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org).

## [Unreleased]

### Added

- **Companion chat (off by default).** Kuro can now talk to you — asking what to start with,
  saying you're stuck, thinking the day through out loud. It adds a body-doubling layer on top
  of the existing scaffolding. Streams from an OpenAI-compatible endpoint you configure
  yourself (built for local servers like LM Studio or Ollama); no preset provider, no cloud
  default. While `Enable chat` is off, the plugin makes no network connection at all and the
  sidebar looks exactly as before.
- The sidebar gained **tabs** (Status · Chat) when the chat is enabled. Both bodies stay in the
  DOM; the 800 ms snapshot refresh only redraws the status one, so an in-flight conversation
  and a half-typed question survive editing any note.
- **Notes (📌)** — a short, persistent list of sentences Kuro keeps in context ("Don't remind
  me about streaks unprompted"). Added via `remember: …` in the chat, a pin button next to
  your own messages, or the settings; editable and deletable there at any time. Capped at 20
  entries, and when full the add button is disabled rather than silently dropping the oldest.
  The conversation history itself is deliberately **not** persisted.
- **Transparency about what is sent.** `From today's note` chooses between nothing, the
  checkbox and habit lines (default), or the whole note; journal prose stays out unless you
  ask for it. Both the settings and the chat tab show a live preview of exactly what would go
  out, rendered by the same function that builds the prompt.
- **`persona` field for packs** — the chat's voice follows the active lore pack (warm for
  Cozy, dark for Gothic) and can be overridden with your own text in the settings. Optional
  and length-capped; the pack format stays at `kuroPack: 1`.
- **Endpoint fallback list.** The single endpoint field is now an ordered list — mix local
  servers (LM Studio, Ollama) and hosted providers, each with its own optional API key and
  model override; the first reachable one wins, and it re-resolves after any edit. Every row
  shows a live status icon, a "in use / reachable, position N / not reachable" line, and a
  connection warning (bad scheme, missing port, placeholder address) as you type — no more
  guessing whether an address was even accepted. One-click presets for LM Studio and Ollama.
  A saved endpoint migrates into the list automatically, key included.

### Fixed

- **Endpoint setup gave no feedback when it failed.** The old model field was a text box plus
  a refresh button that silently picked the first model on success and showed one generic
  "unreachable" message on failure — no way to tell a refused connection from a wrong path
  from a missing API key. The model list fetch also never sent the configured API key, so any
  endpoint that requires one always failed there even though chat itself worked. Fixed by the
  endpoint fallback list above: every row probes with its own key and reports a specific,
  localized reason: refused / timed out / wrong host / unauthorized / not an OpenAI-compatible
  API. The model field is a real dropdown once a list loads, with a manual-entry fallback for a
  model the endpoint doesn't list.
- **"Enable chat" didn't save.** The toggle looked switched on but never actually wrote the
  setting — no case for it existed in the settings-control switch, so the click was silently
  dropped. The chat tab never appeared, and after restarting Obsidian the toggle was back off
  even though the endpoint you'd configured was still there. Present since the very first
  version of the chat feature; only surfaced now because settings rendering can't be
  unit-tested and this was the first real run against Obsidian.
- **The chat panel's input row could scroll off-screen.** A long conversation grew the message
  log without bound instead of scrolling inside its own space, eventually pushing the input
  field and the abort button past the visible area — mid-stream, the abort button became
  unreachable right as you needed it. The message log now scrolls in place; the input row and
  context toggle stay fixed at top/bottom of the chat panel.

## [1.1.0] — 2026-08-11

### Added

- **TaskNotes pomodoro field-mismatch hint.** If the [TaskNotes](https://github.com/callumalpass/tasknotes)
  community plugin is installed and stores pomodoro sessions in daily notes
  (`pomodoroStorageLocation: "daily-notes"`) under a frontmatter key that differs from Kuro's
  `pomodoroFrontmatterKey`, the settings tab now shows a hint with a one-click fix instead of the
  bonus silently never firing. No warning if TaskNotes isn't installed, uses its own plugin
  storage, or the keys already match.

### Changed

- Destructive buttons no longer call the deprecated `setWarning()`. They go through the kit's
  `applyDestructive()`, which uses `setDestructive()` on Obsidian 1.13+ and falls back to the
  native `mod-warning` class below it — so the store review stops flagging it without raising
  `minAppVersion` above 1.8.7. Vendored `confirm.ts` re-copied from obsidian-kit@0.25.0.
- README (EN + DE) restructured to the workspace README gold standard
  (`_docs/templates/README-obsidian-plugin.md`): features first, context paragraph under the
  badge row, install in three ways (Community · Manual · From source), a Contributing section,
  and the `src/`-layout details moved out of the README into `AGENTS.md` (PROF-OBS-05).
- README command references now match the actual command names ("Adjust XP manually…" /
  "XP manuell anpassen…"), and the palette is referenced without a hardcoded hotkey.
- README.de.md brought to parity with the English version — it was still missing the
  Community-Plugins install path, the aesthetic-CSS section and the contributing pointer,
  and described the XP curve as linear rather than linear-quadratic.

### Fixed

- Nested `kuro-status` example in both READMEs was written with a three-backtick outer fence,
  which terminated the block early; it now uses a four-backtick fence.
- **Pomodoro bonus XP was never awarded when [TaskNotes](https://github.com/callumalpass/tasknotes)
  writes its session history to daily notes** (`pomodoroStorageLocation: "daily-notes"`). That
  mode stores an array of session objects in the frontmatter field, but the XP engine only
  understood a plain number there and silently treated the array as "no pomodoros". It now
  counts completed work sessions from that array (breaks and interrupted sessions excluded);
  a plain numeric field still works exactly as before. The two Pomodoro settings that had no
  description at all now explain both accepted formats.

## [1.0.6] — 2026-07-25

### Fixed

- Last remaining CSS-lint warning ("Avoid !important") on the reduce-animations a11y override
  removed — the selectors already carry one extra class (`.kuro-no-animation`, added to an
  ancestor) over the rules they override, so they win on specificity alone without `!important`.

## [1.0.5] — 2026-07-25

### Fixed

- Real Developer Dashboard review findings (from the actual submission scan, beyond what the
  local `eslint-plugin-obsidianmd@0.3.0` could catch): replaced the `builtin-modules` npm
  dependency with Node's built-in `node:module` `builtinModules`; `document.createElement` /
  `el.createEl('div', …)` replaced with `doc.body.createEl(...)` / `el.createDiv(...)` in
  `fileIo.ts` and the codeblock processor; removed the `ui-monospace` CSS value (unsupported by
  Obsidian's baseline).
- The CRT/phosphor aesthetic CSS is no longer a tracked `.css` file in the repo (was
  `assets/kuro-gamification.css`, never bundled with the plugin) — it's now a markdown doc
  (`docs/aesthetic-css.{en,de}.md`) with the same CSS as a code block, so it no longer gets
  swept into the store's CSS lint (`!important`/`clip-path` warnings) despite never shipping.

- Settings tab now implements `getSettingDefinitions()` (Obsidian ≥ 1.13's declarative settings
  API, required for entries to appear in Obsidian's global settings search) alongside the
  existing `display()`, which now walks the same declarative definitions for Obsidian < 1.13 —
  a single source of truth, no behavior change on the pre-1.13 path. `minAppVersion` stays 1.8.7
  (no bump needed; only the TypeScript types moved to a newer `obsidian` devDependency). Known
  trade-off: the native ≥ 1.13 renderer shows all sections flat and expanded — it has no concept
  of the collapsible, collapsed-by-default sections used below 1.13 for overload reduction.

### Internal

- `eslint-plugin-obsidianmd` upgraded 0.3.0 → 0.4.1 — the older version doesn't even implement
  several rules the real scanner enforces (`prefer-create-el`, `settings-tab/prefer-setting-definitions`).
- `tsconfig.json` gained `skipLibCheck: true` — the newer `obsidian` type definitions (1.13.x)
  have an internal inconsistency (`Menu`/`Modal`/`PopoverSuggest` vs. `HistoryHandler`) that only
  surfaces without it; irrelevant to our own source, which is still fully checked.

## [1.0.4] — 2026-07-25

### Fixed

- `minAppVersion` raised from 1.5.0 to 1.8.7 — the actually-lowest floor that covers every API
  the plugin calls (`Workspace.revealLeaf`, `Vault.getAllFolders`, `getLanguage`).
- Every command's display name no longer duplicates the plugin name — Obsidian already prefixes
  command-palette entries with it, so commands used to show up doubled ("Kuro Gamification: Kuro: ...").
- UI language detection now uses Obsidian's `getLanguage()` instead of reading `localStorage`
  directly.
- The "no data yet" message inside an embedded `kuro-status` code block was a hardcoded German
  string, shown regardless of the user's language — now properly localized.
- Popout-window-safe globals: `window`/injected `Document` instead of `globalThis`/global
  `document.createElement`/`element.style.display` in a few remaining spots.
- `console.info` (disallowed by the store guideline) replaced with `console.debug` in the logger.

### Internal

- Added `eslint-plugin-obsidianmd` as an additive guideline gate (`npm run lint:obsidian`) next to
  biome — mirrors the real Community Plugin review scanner locally.

## [1.0.3] — 2026-07-25

## [1.0.2] — 2026-07-25

## [1.0.1] — 2026-07-25

### Documentation

- README (EN+DE) now covers all workspace-required sections: Requirements, Usage, Configuration, How it works.
- Release badge switched from static to a dynamic Codeberg release badge.

### Internal

- Release tooling now delegates to the workspace-central `../tools/release/` (`release`/`version-bump`/`preflight`) instead of a vendored, stale copy in `scripts/`.

## [1.0.0] — 2026-07-25

First public release. Neurodivergence-friendly gamification for your notes —
off-by-default for everything that could escalate.

### Core engines

- **XP engine:** per-checkbox + completion bonuses (50/75/90 %), habit toggles, pomodoro bonus, weekly review/planning bonus, manual adjustments.
- **Streak engine** with monthly-regenerated **freeze tokens** (default 2/month). Streak-bonus tiers at 3/7/14/30 days.
- **10 levels** `SIGNAL LOST` → `K U R O` on a linear-quadratic XP curve (200 … 18000).
- **Deterministic loot:** 5 tiers (Common/Rare/Epic/Legendary/Mythic), seeded shuffle, 50+ default rewards, custom-pool override.
- **Lore reveal:** narrative fragment per level, custom-lore override.
- Pure-function engines with no Obsidian-API coupling.

### Adoptable for others

- **Pack library (`📚 Packs` hub):** install / activate / delete / reset / import loot-, lore- and habit-content packs from one place; activating a pack is a single, progress-safe operation.
- **LLM-assisted pack import:** users generate their own loot/lore `KuroPack` with a documented prompt and their own LLM, then import validated, progress-safe JSON — no form editors. Bundled themes: **Gothic / Plain / Cozy**.
- **Validated import:** `PackValidator` rejects malformed packs with stable, localized issue codes.
- **Guided onboarding:** welcome modal + empty-state guidance; existing users are exempted via a migrate guard.
- **Bilingual:** German (default) + English, all user-facing strings via the i18n module.

### Surfaces

- Sidebar status view, `kuro-status` Markdown code-block processor, 10+ commands in the Command Palette, status-bar item (off-by-default), reduce-animations toggle (a11y).
- Forward-compatible data store (deep-merge against defaults, schemaVersion-tagged), export/import via clipboard JSON.

### Quality & release readiness

- **Submission gate** (`SubmissionGate`): pure `manifest.json` / `LICENSE` validation runs in the test suite, so a store-incompatible manifest fails `npm test` — the biome-only equivalent of the community `eslint-plugin-obsidianmd` manifest/license rules.
- 209 unit tests across engines, data store, i18n, pack library and the submission gate.
- **License:** AGPL-3.0-or-later for code (`LICENSE`), CC BY-SA 4.0 for docs (`LICENSE-DOCS`); dual-licensing documented in `LICENSING.md`, contributions under `CLA.md`.
- TypeScript strict mode, ES2018 target, **zero runtime dependencies**, esbuild bundling, biome linter, `tsc` build gate.

### Notes

- The `assets/kuro-gamification.css` snippet (CRT/phosphor aesthetic) is **not bundled** in the plugin — install it separately as a Vault CSS snippet.
- TaskNotes integration is soft (transparent via `vault.modify`); no hard dependency.
