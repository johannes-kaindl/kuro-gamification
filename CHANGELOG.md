# Changelog

All notable changes to this plugin are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org).

## [Unreleased]

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
