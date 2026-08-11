/* ==========================================================
   Adapter for the TaskNotes community plugin's pomodoro config.
   Detects when Kuro's pomodoroFrontmatterKey silently mismatches
   the frontmatter field TaskNotes actually writes to daily notes
   — the exact shape of the field-name mismatch found in
   REGISTRY.md / the Pomodoro-Bonus-XP array fix: no error, no
   bonus, just a lastingly wrong XP number.

   Uses an undocumented internal API (app.plugins.plugins) —
   accessed defensively so a missing/renamed API degrades to
   null rather than crashing settings render. Same pattern as
   ../utils/coreDailyNotes.ts for Obsidian's core API.
   ========================================================== */
import type { App } from 'obsidian';

export interface TaskNotesPomodoroInfo {
  storageLocation: string;
  frontmatterKey: string;
}

/**
 * Read TaskNotes' pomodoro storage location and mapped frontmatter key, or
 * null if TaskNotes isn't installed/enabled or exposes an unexpected shape.
 * Never throws.
 */
export function readTaskNotesPomodoroInfo(app: App | null | undefined): TaskNotesPomodoroInfo | null {
  try {
    const plugins = (app as unknown as {
      plugins?: { plugins?: Record<string, { settings?: unknown }> };
    })?.plugins;
    const settings = plugins?.plugins?.tasknotes?.settings as {
      pomodoroStorageLocation?: string;
      fieldMapping?: { pomodoros?: string };
    } | undefined;
    const storageLocation = settings?.pomodoroStorageLocation;
    const frontmatterKey = settings?.fieldMapping?.pomodoros;
    if (!storageLocation || !frontmatterKey) return null;
    return { storageLocation, frontmatterKey };
  } catch {
    return null;
  }
}

/**
 * Pure decision: does Kuro's pomodoroFrontmatterKey mismatch what TaskNotes
 * actually writes, in a way that would silently zero out the pomodoro bonus?
 * Only relevant when TaskNotes stores sessions in daily notes — its "plugin"
 * storage mode never reaches Kuro's frontmatter read at all.
 */
export function pomodoroFieldMismatch(
  info: TaskNotesPomodoroInfo | null,
  kuroKey: string,
): { suggestedKey: string } | null {
  if (!info) return null;
  if (info.storageLocation !== 'daily-notes') return null;
  if (info.frontmatterKey === kuroKey.trim()) return null;
  return { suggestedKey: info.frontmatterKey };
}
