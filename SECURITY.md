# Security Policy

## Supported Versions

Security updates are provided for the most recently released version of Kuro Gamification. Older versions do not receive backported fixes — please update to the latest release.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public issues.

Instead, report them privately by email to **code@jkaindl.de** (PGP-encrypted mail is welcome). You will receive a prompt acknowledgement, and we will keep you informed as the fix progresses.

## Data Handling / Scope

Kuro Gamification is fully local and offline by design, which is also its core security property:

- **No network access.** The plugin has zero runtime dependencies and makes no network requests — nothing is sent anywhere, no telemetry, no phone-home.
- **All data stays in your vault.** Gamification state lives in the plugin's `data.json`; export/import is a manual, user-initiated clipboard JSON operation.
- **LLM-assisted pack import is external to the plugin.** When you use the documented prompt to have an LLM generate a loot/lore `KuroPack`, that happens in *your* LLM of choice — the plugin only imports and validates the resulting JSON. It never talks to any model itself.
- **Imported packs are validated, not executed.** A `KuroPack` is plain data (loot/lore/habit content) checked by `PackValidator`; it contains no code and is never evaluated.

If you have questions about the plugin's data handling beyond what is described here, the same private contact above applies.
