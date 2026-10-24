---
paths:
  - "src/llm/**"
  - "src/views/KuroChatPanel.ts"
  - "tests/main-chat*.test.ts"
  - "tests/kuroContext.test.ts"
  - "tests/chatRequest.test.ts"
  - "tests/chat-panel.test.ts"
  - "src/views/KuroSidebarView.ts"
  - "src/persistence/DataStore.ts"
  - "tests/DataStore.test.ts"
---

# Companion-Chat (src/llm/)

Gotchas zum Companion-Chat: Kontext, Prompt-Reihenfolge, Verbindung, Chat-Fenster, Markdown (`src/llm/`, `src/views/KuroChatPanel.ts`).

- **Companion-Chat (`src/llm/`, seit 1.1.0):**
  - **Off-by-default** (`enableChat`). Ist er aus, wird keine Tab-Leiste gezeichnet, kein
    Endpunkt kontaktiert und `lastDailyText` gar nicht erst gelesen.
  - **Vorschau nie nachbauen.** Settings-Vorschau, Chat-Ausklapper und Prompt-Bau rufen
    alle `kuroContext.renderDailyExtract`. Eine zweite Formatierung driftet und zeigt
    beruhigend etwas anderes, als tatsächlich gesendet wird.
  - **Prompt-Blockreihenfolge ist load-bearing:** Rolle → Stimme → Kontext → Merkzettel →
    **Regeln zuletzt**. Stimme (importiertes Pack) und Kontext (eigene Notizen) sind Text,
    den das Plugin nicht kontrolliert; die Regeln sagen ausdrücklich, dass frühere Blöcke
    sie nicht aufheben. Neue Blöcke **vor** den Regeln einfügen, nie danach.
  - **Merkzettel kappt hart** (`kuroNotes`, 20 × 200 Zeichen): bei Erreichen wird der
    Hinzufügen-Knopf deaktiviert, statt still den ältesten Eintrag zu verwerfen. Der
    Gesprächsverlauf wird bewusst **nicht** persistiert.
  - **Timer über den injizierten `ClockPort`** (`vendor/kit-obsidian/clock`), nicht über
    nacktes `setTimeout`: Der Store-Lint verlangt `window.setTimeout`, das es in jests
    node-Umgebung nicht gibt. Ohne den Port wäre der Client entweder lint-widrig oder nur
    mit Obsidian-Mock testbar.
  - **`activePersona` folgt der Lore**, nicht dem Loot — wer die Gothic-Lore aktiviert, will
    auch die Gothic-Stimme.
  - **Verbindung (seit Kit 0.51.2): `createLlmConnection` ist der einzige Weg zum Endpunkt und zur Anfrage.** `main.ts` erzeugt sie in `onload()` aus den Optionen von `src/llm/kuroConnection.ts` (Modus companion, Budget, Settings-Namen `chatEndpoints`/`chatChoice`/`request`, `truncated: 'error'`, `transports: { anthropic: true }` = Claude als Endpunkt des Managers); `main.sendChat` ruft `this.llm.complete`, die Einstellungen zeichnet `this.llm.renderSettings`, die Modellliste liefert `this.llm.models()`. Eigener Resolver, Client-Fabrik, Backend-Probe und Abweichungstexte gibt es nicht mehr — ein Neubau davon ist ein Rückstand. Der Manager wird bei jedem Aufruf frisch gelesen (nie gemerkt), die lokale Auflösung bis `invalidate()`; wer `chatEndpoints` am Tab vorbei ändert (Treiber), ruft danach `llm.invalidate()`. `choice` gilt nur mit Manager; das Modell steht allein auf der Zeile der lokalen Liste (`rowModel`), ein globales `chatModel` gibt es seit 1.10.0 nicht mehr — `DataStore.mergeSettings` verteilt den Altwert einmal über `fillMissingRowModels` auf Zeilen ohne Modell und nimmt den Schlüssel danach aus dem gemergten Objekt (sonst füllt jeder Start eine bewusst geleerte Zeile neu; Test für den zweiten Lauf in `tests/DataStore.test.ts`). API-Schlüssel der lokalen Liste liegen im Obsidian-Schlüsselbund, nie in `data.json` (Prüfpunkt `verbindung/kein-apikey-in-data-json`). Gesendete Texte werden geschwärzt; **modellerzeugter Text geht nur über `createStableWriter` oder `neutralizeModelMarkdown` an einen Renderer** — jeder neue direkte `MarkdownRenderer`-Aufruf auf Modelltext braucht das vorher (das Kit-Fenster tut es für alle Antworten; `KuroSidebarView` reicht ihm nur den nackten Renderer).
  - **Chat-Fenster (seit 1.16.0, Kit-Baustein `buildChatWindow` + Modellzeile `buildModelBar`):** `KuroChatPanel` ist nur noch der **Wirt** im Chat-Tab (mount-once im Hub): Kontextzeile (im `header`, unter der Modellzeile), Einrichtungs-Hinweis (`empty.when`), „merk dir“ (`beforeSubmit` + `win.setDraft('')`) und das Anbinden von `send`, Verlauf und Markdown. Verlauf, Eingabe, Abbruch, Fehlerzeilen, Kopieren und das Rendern von Antworten trägt das Kit; **ein Neubau davon ist ein Rückstand** (Namenszeile „Kuro“, Cursor, Eigenbau-Fehlertexte entfielen mit dem Umstieg).
  - **Der Verlauf liegt als `chat-history` (JSON) in `plugin.chatHistory`**, nur im Speicher: das Fenster bekommt ihn per `initial`, `onChange` schreibt ihn zurück. `main.sendChat(messages, h)` baut aus `historyForModel` (nur abgeschlossene Runden; Fehler und Abbrüche gehen nie ans Modell) über `llm/chatRequest.splitChatMessages` und `buildMessages` die Anfrage; es reicht **kein `onReasoning`** (Kuro zeigt Denken bewusst nicht) und wirft Fehler vor dem Senden weiter (das Fenster zeigt die Zeile).
  - **Zeichnen:** `syncChat({ models })` ruft `refresh()` am Panel: wechselt `hasChatEndpointSource()`, zeichnet `win.refresh()` neu (Einrichtungs-Hinweis ↔ Chat), sonst genügt `bar.update()` (und mit `models` `bar.refresh()`). Die Verbindung ruft es nach **jeder** Speicherung (`persist` in `onload`), der Treiber nach einer Änderung am Tab vorbei (`setSetting`). Nie `win.refresh()` ohne Not: es baut Kopf und Bereiche neu und verliert den Zustand der Kontextzeile. `refreshContext()` zieht nur die Kontextzeile nach (`refreshStatus` ruft es bei jeder Notizänderung).
  - **Tests brauchen das Fake-DOM des Kits** (`tests/vendor/kit/obsidian-mock`, `window-timers` mit `installWindowTimers({ full: true })`; `globalThis.window = globalThis` in jest), `domGuard: false` am Wirt, und in `main-chat.test.ts` eine Stub-Verbindung für die Modellzeile (sonst hängen Netz-Timer am Worker).
  - **Linkschutz ist ein bekannter Befund, kein Plugin-Bau:** die Kette Kit-Neutralisierung + `MarkdownRenderer.render` kappt `javascript:` und `data:`, nicht `obsidian://`, `file://`, `app://` (gemessen Welle 26, gleich am Tag 1.15.0). Der Smoke-Punkt `chat/linkschutz-skript-schemata` steht rot, bis der Kit-Task „Linkschutz in Modellantworten“ (Welle 27) den Schutz im Fenster hat; nicht von Hand nachbauen.
