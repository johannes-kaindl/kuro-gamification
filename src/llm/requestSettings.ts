/* ==========================================================
   Sampling-Profile (Modus companion): Laden und Migrieren des `request`-Blocks — pure,
   kein Obsidian-Import. Form nach lingotuner/src/core/settings.ts (Rezept 3).
   ========================================================== */
import { foldLegacyThinking, type LegacyRequestMigration } from '../vendor/kit/sampling-profiles';

/** Modus dieses Plugins in der Sampling-Profile-Tabelle — Kuro ist ein Begleiter im Gespräch
 *  (Spec § 4.1: "companion"). Nur EIN Modus, deshalb fest verdrahtet. */
export const MODE = 'companion';

/** Token-Budget einer Antwort — Plugin-Wert, kein Nutzerwert; geht als `maxTokens` an die Verbindung (die
 *  Familie hebt es bei Bedarf auf ihre Reserve). */
export const COMPANION_MAX_TOKENS = 1024;

/** Der `request`-Block wird mit dem Kit geladen: `loadRequestSettings(raw, REQUEST_MIGRATIONS)`. Das alte
 *  `chatSuppressThinking` wandert dabei einmalig nach `request.thinking.companion` — nur wenn dort noch nichts
 *  explizit gesetzt ist (`true`, der alte Default, wird zu "off", `false` zur Einschalt-Stufe des Modus; die
 *  Regel selbst steht im Kit als `foldLegacyThinking`). Das Altfeld entfernt der Aufrufer selbst. */
export const REQUEST_MIGRATIONS: readonly LegacyRequestMigration[] = [
  (raw, request) => { foldLegacyThinking(request, MODE, raw.chatSuppressThinking); },
];
