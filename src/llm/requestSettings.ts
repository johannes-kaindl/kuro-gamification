/* ==========================================================
   Sampling-Profile (Modus companion): Laden und Migrieren des `request`-Blocks — pure,
   kein Obsidian-Import. Form nach lingotuner/src/core/settings.ts (Rezept 3).
   ========================================================== */
import { onLevelFor, sanitizeRequestSettings, type RequestSettings } from '../vendor/kit/sampling-profiles';

/** Modus dieses Plugins in der Sampling-Profile-Tabelle — Kuro ist ein Begleiter im Gespräch
 *  (Spec § 4.1: "companion"). Nur EIN Modus, deshalb fest verdrahtet. */
export const MODE = 'companion';

export interface RequestLoadResult { request: RequestSettings; dropped: string[] }

/** Säubert den gespeicherten `request`-Block und migriert das alte `chatSuppressThinking`
 *  einmalig nach `request.thinking.companion` — nur wenn dort noch nichts explizit gesetzt ist.
 *  `true` (der alte Default) wird zu "off", `false` zur Einschalt-Stufe des Modus. `dropped`
 *  meldet der Aufrufer, es wird nicht verworfen (CORE-DATA-01). `raw` ist der gespeicherte
 *  Settings-Block. */
export function loadRequestSettings(raw: unknown): RequestLoadResult {
  const r = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const { settings, dropped } = sanitizeRequestSettings(r.request);
  if (typeof r.chatSuppressThinking === 'boolean' && settings.thinking[MODE] === undefined) {
    settings.thinking[MODE] = r.chatSuppressThinking ? 'off' : onLevelFor(settings, MODE);
  }
  return { request: settings, dropped };
}
