---
paths:
  - "tools/kit-sync.json"
  - "tools/sync-kit.sh"
  - "src/vendor/**"
---

# Kit-Vendoring aus zwei Quellen

Gotchas zum Vendoring aus code-kit und obsidian-kit (`tools/kit-sync.json`, `src/vendor/`).

- **Kit-Vendoring hat ZWEI Quellen** (seit 2026-09-02): `src/vendor/kit/` kommt aus **`code-kit`**
  (plattformneutral), `src/vendor/kit-obsidian/` aus **`obsidian-kit`**. Der Ordnername `kit` ist
  historisch und sagt die Quelle **nicht** — die steht in `VENDOR.json` und im Header jeder Datei.
  Anlass: obsidian-kit hat seine domänenfreie pure-Teilmenge nach code-kit abgegeben
  (`obsidian-kit@2ab1bb5`); von den zehn Modulen liegen sechs im Kit als Vendor-Kopie und
  **vier — `num`, `reasoning`, `sse`, `think-splitter` — gar nicht mehr darin**. Wer nur die
  Kit-Pfade nachzieht, läuft bei diesen vier weiter ins Leere. `tools/sync-kit.sh` liest aus
  `git show "$REF:…"`, nicht aus dem Arbeitsstand des Nachbar-Repos; deshalb braucht es keinen
  Arbeitsstand-Guard mehr. **`^{commit}` beim Pin ist Pflicht, nicht Kür:** code-kit taggt
  annotiert, `rev-parse 0.5.0` liefert dort die SHA des Tag-**Objekts** (`41e96e0`) statt des
  Commits (`efcd456`). Bei obsidian-kit fiel das nie auf, weil dessen Tags leichtgewichtig sind —
  Zufall, kein Schutz. Gegenproben zu jedem Re-Vendor: Idempotenz, Fehlerpfad (unbekannte Ref →
  0 Dateien angefasst), Verbatim-Vergleich gegen die Ref.
