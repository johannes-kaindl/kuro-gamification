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
    // display()/setWarning() are deprecated in favor of getSettingDefinitions()/
    // setDestructive() — both @since 1.13.0. kuro deliberately keeps a much
    // lower floor (1.8.7) for reach (preflight.mjs explicitly bans 1.13+
    // "Catalyst-only" floors), so display()/setWarning() stay the correct,
    // wider-compatible choice here, not a defect to migrate away from.
    // confirm.ts is vendored verbatim from obsidian-kit (never hand-edit) and
    // carries the same setWarning() call — it replaced the deleted
    // src/modals/ConfirmModal.ts that used to be listed here.
    files: ["src/settings/SettingsTab.ts", "src/vendor/kit-obsidian/confirm.ts"],
    rules: {
      "@typescript-eslint/no-deprecated": "off",
    },
  },
];
