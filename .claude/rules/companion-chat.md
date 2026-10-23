---
paths:
  - "src/llm/**"
  - "src/views/KuroChatPanel.ts"
  - "tests/main-chat*.test.ts"
  - "tests/kuroContext.test.ts"
  - "tests/ChatSession.test.ts"
  - "tests/chat-panel.test.ts"
  - "src/views/KuroSidebarView.ts"
  - "src/persistence/DataStore.ts"
  - "tests/DataStore.test.ts"
---

# Companion-Chat (src/llm/)

Gotchas zum Companion-Chat: Kontext, Prompt-Reihenfolge, Verbindung, Markdown (`src/llm/`, `src/views/KuroChatPanel.ts`).

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
  - **Verbindung (seit Kit 0.51.2): `createLlmConnection` ist der einzige Weg zum Endpunkt und zur Anfrage.** `main.ts` erzeugt sie in `onload()` aus den Optionen von `src/llm/kuroConnection.ts` (Modus companion, Budget, Settings-Namen `chatEndpoints`/`chatChoice`/`request`, `truncated: 'error'`); `askKuro` ruft `this.llm.complete`, die Einstellungen zeichnet `this.llm.renderSettings`, die Modellliste liefert `this.llm.models()`. Eigener Resolver, Client-Fabrik, Backend-Probe und Abweichungstexte gibt es nicht mehr — ein Neubau davon ist ein Rückstand. Der Manager wird bei jedem Aufruf frisch gelesen (nie gemerkt), die lokale Auflösung bis `invalidate()`; wer `chatEndpoints` am Tab vorbei ändert (Treiber), ruft danach `llm.invalidate()`. `choice` gilt nur mit Manager; das Modell steht allein auf der Zeile der lokalen Liste (`rowModel`), ein globales `chatModel` gibt es seit 1.10.0 nicht mehr — `DataStore.mergeSettings` verteilt den Altwert einmal über `fillMissingRowModels` auf Zeilen ohne Modell und nimmt den Schlüssel danach aus dem gemergten Objekt (sonst füllt jeder Start eine bewusst geleerte Zeile neu; Test für den zweiten Lauf in `tests/DataStore.test.ts`). API-Schlüssel der lokalen Liste liegen im Obsidian-Schlüsselbund, nie in `data.json` (Prüfpunkt `verbindung/kein-apikey-in-data-json`). Gesendete Texte werden geschwärzt; **modellerzeugter Text geht nur über `createStableWriter` oder `neutralizeModelMarkdown` an einen Renderer** — jeder neue direkte `MarkdownRenderer`-Aufruf auf Modelltext braucht das vorher (Panel: `KuroChatPanel.renderEntry`).
  - **Markdown im Chat:** `KuroChatPanel` bekommt `renderMarkdown` als Callback (die View liefert `MarkdownRenderer.render(app, …, this)`), damit das Panel weder `App` noch eine Component kennt. Fertige Kuro-Antworten werden gerendert, im Stream schneidet der Kit-`stable-writer` an der Absatzgrenze; eigene Fragen und Fehler bleiben Rohtext. Der Schreiber legt seine Blöcke in `.kuro-chat-stream-content` der laufenden Zeile ab, nicht in den ganzen Log.
