---
paths:
  - "scripts/gui-smoke.ts"
  - "scripts/shots.ts"
  - "docs/SMOKE.md"
  - "scripts/**"
---

# CDP-Treiber dieses Repos

Gotchas zu `scripts/gui-smoke.ts` und `scripts/shots.ts`; die allgemeinen Treiberregeln stehen im Dach (`.claude/rules/gui-smoke-treiber.md`, `obsidian-instanz.md`, `cdp-lock.md`).

- **Zwei CDP-Treiber unter `scripts/`** (`gui-smoke.ts`, `shots.ts`) arbeiten gegen ein laufendes
  Obsidian. Die Brücke dazu wird **importiert, nicht vendored**: `../tools/obsidian-cdp/` im Dach.
  Fehlt ihr etwas, wird sie **dort** ergänzt (als Parameter, nicht als Sonderfall) — eine lokale
  `scripts/lib/cdp.ts` meldet `tools/template_drift_check.py` als Rückstand. Beide Treiber laufen
  nie in CI; `typecheck:scripts` überspringt sich ohne Dach-Checkout selbst.
  **Beide brechen ab, wenn der Build im Vault nicht der gebaute Repo-Stand ist**
  (`requireEigenerBuild`, seit 2026-09-02) — Abhilfe ist immer `npm run deploy`, nicht ein
  Flag. Anlass: der Lauf 16/16 vom 28.08. lief gegen die Store-Installation 1.3.0, und
  `manifest.version` ist dagegen strukturell blind, weil beide Builds dieselbe Nummer tragen.
  ⚠️ **Die Versionszeile im Protokoll ist kein Herkunftsbeleg:** `enablePlugin` lädt den Code
  neu, das Manifest nicht (Obsidian liest es beim Vault-Start) — gemessen 1.3.0 im Speicher
  gegen 1.4.0 auf Platte. Der sha1-Vergleich ist die einzige Aussage.
