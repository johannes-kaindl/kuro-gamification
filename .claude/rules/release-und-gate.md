---
paths:
  - "src/engine/SubmissionGate.ts"
  - "tests/submission-gate.test.ts"
  - ".github/workflows/release.yml"
  - "package.json"
  - "manifest.json"
  - "versions.json"
---

# Release-Tooling und Submission-Gate

Gotchas zum zentralen Release-Tooling und zum Submission-Gate (`src/engine/SubmissionGate.ts`); der Ablauf eines Releases steht im Dach (`.claude/rules/release-und-store.md`).

- **Release-Tooling ist zentral** (`../tools/release/{release,version-bump,preflight}.mjs`) — kein
  vendored `scripts/release.mjs` mehr im Repo. Voraussetzung: dieses Repo muss im Dach-Verzeichnis
  `obsidian-plugins/` neben `tools/` liegen (ein Clone ohne Dach ist nicht release-fähig, die
  npm-Scripts prüfen das und brechen mit klarer Fehlermeldung ab). `preflight.mjs` deckt die
  Store-Checkliste release-seitig ab; `SubmissionGate.ts`/`tests/submission-gate.test.ts` deckt
  dieselben Checks test-seitig ab (`npm test`) — bewusste Teil-Doppelung, nicht redundant
  (verschiedene Zeitpunkte). Migriert 2026-07-25, s. `_docs/LESSONS.md` (2026-07-25).
- **Submission-Gate:** `SubmissionGate`
  (`src/engine/SubmissionGate.ts`, verdrahtet über
  `tests/submission-gate.test.ts`) deckt ergänzend `manifest.json`/`LICENSE` test-seitig ab — die
  echten Dateien laufen durchs Gate, ein kaputtes Manifest failt `npm test`.
