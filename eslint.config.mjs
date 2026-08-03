import obsidianmd from "eslint-plugin-obsidianmd";

// ESLint v9 flat config — runs ONLY the official Obsidian plugin guideline
// rules (+ the typescript-eslint rules they build on) over the production
// source. Biome remains the formatter/general linter (npm run lint); this is
// an additive guideline gate (npm run lint:obsidian) that mirrors what the
// real Community Plugin review scanner checks. Pattern adopted from
// json_viewer/vault-crews.
export default [
  {
    ignores: [
      "main.js",
      "coverage/**",
      "node_modules/**",
      "tests/**",
      ".remember/**",
      "docs/**",
      "*.config.mjs",
      "*.config.ts",
      "*.config.js",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        // Type-check against the REAL obsidian types (build config, no mock
        // alias) — otherwise the mock's loose types make every app.* access
        // report as no-unsafe-*.
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
