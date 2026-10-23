---
paths:
  - "src/utils/taskNotesBridge.ts"
  - "src/utils/taskNotesPomodoro.ts"
  - "src/engine/TaskNotesXp.ts"
  - "src/engine/XpEngine.ts"
  - "src/engine/StreakEngine.ts"
  - "src/persistence/VaultReader.ts"
  - "src/settings/SettingsTab.ts"
  - "src/types.ts"
  - "tests/TaskNotesXp.test.ts"
  - "tests/StreakEngine.test.ts"
  - "tests/taskNotesBridge.test.ts"
---

# TaskNotes-Quellen, XP und Streak

Gotchas zur XP-Ableitung aus TaskNotes und zum Streak (`src/utils/taskNotesBridge.ts`, `src/engine/`).

- **TaskNotes-Quellen (seit 1.4.0):** `src/utils/taskNotesBridge.ts` ist die **einzige** Stelle,
  die `app.plugins.plugins.tasknotes` kennt. TaskNotes gibt keinen Vertrag (kein `apiVersion`),
  deshalb gilt dort die defensive Konsumenten-Regel: bei jedem Zugriff frisch lesen, Form prüfen
  statt Existenz, nie werfen.
  - **Aufgaben kommen aus dem Vault, Sessions aus TaskNotes' Speicher.** Der Vault überlebt eine
    Deaktivierung des Nachbarplugins; `pomodoroHistory` ist internes Feld ohne Zusage.
  - **Woran eine Aufgabe erkannt wird, ist Kuros EIGENE Einstellung** (`taskMatchField`/-`Value`,
    `taskStatusField`, `taskDoneValues`) — TaskNotes' Konfiguration ist nur ein Übernahme-Vorschlag.
    Der Grund ist gemessen: am 2026-09-01 fand TaskNotes' Standard (`tags: task`, Status `done`) im
    Vault des Maintainers **4** erledigte Aufgaben, das tatsächlich genutzte Schema
    (`type: 💪 Aufgabe`, `6_erledigt_✅`) **340**. Wer dem Fremdplugin folgt, baut eine Quelle, die
    korrekt rechnet und nichts findet.
  - **`diagnoseSources` (`src/engine/TaskNotesXp.ts`) ist die einzige Wahrheit** darüber, welche
    Quelle zählt: Rechnung UND Herkunfts-Panel lesen sie. Eine zweite Beurteilung driftet.
  - **Das Panel hängt bewusst nicht hinter `statusVerbose`.** Anlass war ein Pomodoro-Bonus, der
    bei `pomodoroStorageLocation: "plugin"` strukturell nie feuern konnte, ohne dass es jemand sah.
    Diagnose ist immer sichtbar, Buchhaltung bleibt schaltbar.
  - **XP wird abgeleitet, nicht gezählt.** Das Ereignis vom Emitter löst Neuberechnung und
    Rückmeldung aus; die Zahl kommt aus gelesenem Zustand. Deshalb kosten doppelte Ereignisse
    nichts und Idempotenz entsteht nicht als Problem. Ein Ereignis-Journal in `data.json` wäre ein
    zweiter, nicht rekonstruierbarer Zustand — nicht einführen.
  - **Streak wird vorwärts nachgespielt, nicht gespeichert.** `StreakEngine.compute` läuft vom frühesten qualifizierenden Tag bis heute (Kalenderschritt, kein Fenster): der laufende Tag ist neutral, ein Freeze-Token überbrückt je Lücke einmal (Reset am Monatsersten), der Bonus ist `bonusFor(L) − bonusFor(L−1)` je Streak-Tag und bleibt nach dem Ende. `data.freezeTokens` und `regenFreezeTokensIfNeeded` sind nur noch Altbestand; die Anzeige liest `tokensLeft`. Tage ohne Arbeit (sieben `streakDay*`-Schalter, `streakSkipKey`/`streakSkipValues`) sind neutral und machen nie einen Tag aktiv. Verbrauchte Tokens oder gutgeschriebene Boni in `data.json` zu persistieren wäre ein zweiter, nicht rekonstruierbarer Zustand — nicht einführen.
