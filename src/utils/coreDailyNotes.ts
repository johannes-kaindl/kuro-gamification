/* ==========================================================
   Adapter for Obsidian's built-in "Daily notes" core plugin.
   Lets a fresh install adopt the user's existing daily-note
   folder/format instead of shipping the author's vault paths.

   Uses an undocumented internal API (app.internalPlugins) —
   accessed defensively so a missing or renamed API degrades to
   null rather than crashing plugin load.
   ========================================================== */
import type { App } from 'obsidian';

export interface CoreDailyNotesConfig {
  folder: string;
  format: string;
}

/**
 * Read folder/format from the core "Daily notes" plugin, or null
 * if it (or the internal API) is unavailable. Never throws.
 */
export function readCoreDailyNotesConfig(app: App | null | undefined): CoreDailyNotesConfig | null {
  try {
    const internal = (app as unknown as {
      internalPlugins?: { getPluginById?: (id: string) => { instance?: { options?: unknown } } | null };
    })?.internalPlugins;
    const plugin = internal?.getPluginById?.('daily-notes');
    const options = plugin?.instance?.options as { folder?: string; format?: string } | undefined;
    if (!options) return null;
    return {
      folder: (options.folder ?? '').trim(),
      format: (options.format ?? '').trim(),
    };
  } catch {
    return null;
  }
}
