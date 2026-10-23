---
paths:
  - "src/main.ts"
  - "tests/main-onload.test.ts"
---

# Hauptplugin — onload und Vault-Ereignisse

Gotchas zu `src/main.ts` (Lade-Reihenfolge, Vault-Ereignisse).

- **Vault-reactive:** `vault.modify` ist 800 ms debounced.
- **`onload`-Reihenfolge (load-bearing):** Debounced Fns (`debouncedSave`/`debouncedRefresh`)
  müssen **vor** jeder Methode zugewiesen werden, die sie aufrufen kann — speziell
  `regenFreezeTokensIfNeeded()`. Sonst Fresh-Vault-only Ladecrash (`this.debouncedSave is not a
  function`), für Engine/DataStore-Tests unsichtbar. Abgesichert durch `tests/main-onload.test.ts`.
