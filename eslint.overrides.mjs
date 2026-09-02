// Repo-eigene ESLint-Abweichungen — der EINZIGE Ort dafuer. Der Kern
// (eslint.config.mjs) ist template-verwaltet, Inline-disables blockt das Lint-Gate.
// Jeder Override braucht eine Begruendung im Kommentar.
//
// Zwei Klassen, zwei Preise (Details: _docs/docs/obsidian-plugin-publishing.md):
// - Kosmetik-/Benennungsregeln (z. B. ui/sentence-case bei Eigennamen/API-Namen):
//   Override ist die richtige Antwort und kostet nichts — der Scanner hat keinen
//   Mangel gefunden, sondern eine Konvention falsch angelegt.
// - Faehigkeitsregeln (z. B. settings-tab/prefer-setting-definitions): der Scanner
//   bewertet den Mangel, nicht die Begruendung — ein Override hier ist gestundete
//   Schuld und kostet die Store-Wertung ("Satisfactory" statt "Passed").
//   Marker fuer solche Faelle: `// STORE-SCHULD:` + wo die Abloesung geplant ist.
export default [
  {
    // Type-aware Linting braucht das Build-tsconfig des Repos. Achtung Falle
    // (json_viewer 1.9.0): ein obsidian→Mock-paths-Alias im referenzierten tsconfig
    // laesst die type-aware Regeln auf einen losen Mock aufloesen → no-unsafe-*-Kaskade.
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.build.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // KIT-SCHULD: `effectiveModel` ist seit code-kit 0.5.0 `@deprecated` — nicht als Defekt,
    // sondern als terminierte Migrationskruecke. Die Deprecation gilt der STRUKTUR (globales
    // Modellfeld + Override je Zeile ist dieselbe Information an zwei Orten plus Vorrangregel),
    // nicht dem Aufruf; sie inline auszuschreiben waere Umgehung, keine Abloesung.
    //
    // Fundstelle: src/main.ts:378 — die EINZIGE Nutzung im Repo (`grep -rn effectiveModel src`).
    // Gemessen 2026-09-02 beim Vendor-Nachzug auf code-kit 0.5.0 / obsidian-kit 0.29.0.
    //
    // KEINE Store-Schuld: `@typescript-eslint/no-deprecated` gehoert nicht zu `obsidianmd/*`,
    // der Store-Scanner sieht sie nicht. Die lokale Vorschau bleibt fuer alle Store-Regeln scharf.
    //
    // ABLOESUNG (dann faellt dieser Block ersatzlos weg): `chatModel` als globales Feld
    // entfernen, Modell nur noch je Endpunkt-Zeile, `globalModel`-Callback in
    // `EndpointListOptions` weglassen (seit obsidian-kit 0.29.0 optional). Braucht eine
    // Settings-Migration fuer Bestandsnutzer — `chatModel` auf jede Zeile ohne eigenes Modell
    // mappen, exakt die Falle, die bei `chatApiKey` dokumentiert ist. Eigene Task.
    // Kuro ist einer von fuenf genannten Konsumenten (obsidian-transmute,
    // markdown-presentation, image-to-markdown, kuro-gamification, vim-dojo); code-kit
    // entfernt die Funktion erst, wenn alle fuenf durch sind.
    //
    // GEGENPROBE vor dem Entfernen dieses Blocks (REGISTRY: ein Override ohne Fundstelle
    // schaltet die Regel nur fuer kuenftigen Code ab): Block herausnehmen, `npx eslint src`
    // fahren — meldet er nichts, unterdrueckte er nichts.
    files: ["src/main.ts"],
    rules: { "@typescript-eslint/no-deprecated": "off" },
  },
];
