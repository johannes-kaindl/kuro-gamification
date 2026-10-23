---
paths:
  - "src/settings/**"
  - "eslint.overrides.mjs"
  - "tests/settingsTab-enableChat.test.ts"
  - "src/utils/packLibrary.ts"
  - "src/modals/PackIoModal.ts"
  - "tests/packLibrary.test.ts"
---

# Einstellungs-Tab — rein deklarativ

Gotchas zum Einstellungs-Tab (`src/settings/SettingsTab.ts`, `getSettingDefinitions()`), seit 2026-08-18 mit `minAppVersion` 1.13.0, und zur Pack-Ablage in den Einstellungen.

- **Der Einstellungs-Tab ist seit 2026-08-18 rein deklarativ** (`minAppVersion` 1.13.0):
  `getSettingDefinitions()` ist die einzige Wahrheit, `display()` und die ganze imperative
  Fallback-Maschinerie (`_renderItem`/`_renderControl`/`_section`) sind gelöscht. Damit ist
  auch die letzte `no-deprecated`-Ausnahme aus `eslint.overrides.mjs` verschwunden —
  `eslint.overrides.mjs` trägt jetzt nur noch die `parserOptions`.
  **Was das gekostet hat:** die Collapsible-Sections. Der deklarative Gruppentyp kennt
  `heading`/`cls`/`search`/`visible` — **kein** Collapse. Die eingeklappten Abschnitte
  (Overload-Reduktion für die ADHS/Autismus-Zielgruppe) sind damit endgültig weg. Sie waren
  es faktisch aber schon vorher: auf jedem 1.13-Host ruft das Framework `display()` nie auf,
  sobald `getSettingDefinitions()` ein nichtleeres Array liefert — die Löschung hat niemandem
  etwas genommen, was er noch sah. Wer die Reduktion zurückholen will, muss sie mit den
  Mitteln der API bauen (`search` auf Gruppenebene, `type: 'page'` für Unterseiten), nicht
  mit einem zweiten Renderpfad. Mit `display()` fiel auch das damit tot gewordene Vendoring
  (`collapsible.ts`, `folder-suggest.ts`) und das Settings-Feld `uiCollapsed`; den Ordner-
  Vorschlag zieht jetzt Obsidians eigener `folder`-Control.
- **Pack-I/O:** `📚 Packs` (SettingsTab) ist DER Ort für alle Pack-Operationen; die
  Einheiten-Sektionen tragen nur Inhalts-Einstellungen. Pure-Logik in `src/utils/packLibrary.ts`.
