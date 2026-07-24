# Contributing to Kuro Gamification

Thanks for your interest in improving **Kuro Gamification** — a neurodivergence-friendly gamification plugin for Obsidian (XP, levels, streaks with freeze tokens, deterministic loot drops, gothic-cyberpunk lore; off-by-default).

Contributions of all sizes are welcome: bug reports, fixes, docs, and features. Before you start, please skim [`AGENTS.md`](AGENTS.md) in the repo root — it holds the architecture, module layout, and the detailed engineering conventions. This document is the contributor-facing summary. The conventions follow the workspace's leading **comply-or-explain** convention: deviate when you have a good reason, and say why in the PR.

## Branch model

- `main` is always green — it must build, pass tests, and typecheck at every commit.
- Do feature work on a `feat/<name>` branch.
- Merge into `main` with `--no-ff` so the history keeps the merge structure.
- Direct pushes to `main` happen only with explicit authorization.

## Commits

- Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat|fix|docs|chore|refactor|test(scope): …`. The description itself may be written in German.
- Stage **only the files you actually touched**. Never use `git add -A`.
- When an AI tool made a substantial contribution to a commit, add a trailer:

  ```
  Co-Authored-By: Claude Opus <Version> (1M context) <noreply@anthropic.com>
  ```

## Tags and remotes

- Releases are tagged with [SemVer](https://semver.org/) **without** a `v` prefix — e.g. `1.2.3`, not `v1.2.3`.
- [Codeberg](https://codeberg.org/jkaindl/kuro-gamification) is the canonical, primary remote (`origin`).
- The [GitHub repository](https://github.com/johannes-kaindl/kuro-gamification) is a **mirror** only (used for the community plugin registry and release CI). Open your contributions against Codeberg.

## Quality gate

Run these locally before you commit, and make sure they're green:

- **Tests:** `npm test` — the suite is test-driven (Jest), currently 209 tests. This includes the submission gate (`tests/submission-gate.test.ts`), which validates `manifest.json` / `LICENSE` against the Obsidian store checks — a broken manifest fails the suite.
- **Lint:** `npm run lint` — biome, must be clean.
- **Typecheck:** `npm run typecheck` — must be clean.

The project is test-driven, so new behavior should arrive with tests. Pure logic lives in Obsidian-free, Node-testable engines under `src/engine/` — keep the engine ↔ Obsidian-API boundary intact.

All user-facing strings (UI labels, commands, notices) go through the i18n module with English canonical + German translation; never hard-code UI text.

## Where to work

- File issues and open pull requests on **Codeberg**: <https://codeberg.org/jkaindl/kuro-gamification>. (GitHub is a mirror, not the place for contributions.)
- For larger features, work through **brainstorm → spec → plan → TDD**, and keep the resulting artefacts under `docs/superpowers/`. Smaller fixes can go straight to a `feat/<name>` branch with tests.

## License of contributions

This project is dual-licensed by content type:

- **Code** is licensed under **AGPL-3.0-or-later** (see [`LICENSE`](LICENSE)). By contributing code, you agree that your contribution is licensed under AGPL-3.0-or-later.
- **Documentation and other text** is licensed under **CC BY-SA 4.0** (see [`LICENSE-DOCS`](LICENSE-DOCS)). By contributing docs, you agree that your contribution is licensed under CC BY-SA 4.0.

A commercial dual-license is available on request for users for whom the AGPL copyleft is not a fit (see [`LICENSING.md`](LICENSING.md)).
