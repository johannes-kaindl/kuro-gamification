/* ==========================================================
   readTaskNotesPomodoroInfo / pomodoroFieldMismatch — detect
   when Kuro's pomodoroFrontmatterKey silently mismatches what
   the TaskNotes community plugin actually writes to daily
   notes, so a broken config surfaces as a settings hint instead
   of a bonus that never fires without explanation.

   readTaskNotesPomodoroInfo reads an undocumented cross-plugin
   API (app.plugins.plugins['tasknotes'].settings) defensively —
   same pattern as readCoreDailyNotesConfig for the core API.
   ========================================================== */
import { readTaskNotesPomodoroInfo, pomodoroFieldMismatch } from '../src/utils/taskNotesPomodoro';

/** Fake app exposing TaskNotes as an active community plugin. */
function appWithTaskNotes(settings: any) {
  return {
    plugins: {
      plugins: {
        tasknotes: { settings },
      },
    },
  };
}

describe('readTaskNotesPomodoroInfo', () => {
  it('reads storage location and mapped frontmatter key when TaskNotes is active', () => {
    const app = appWithTaskNotes({
      pomodoroStorageLocation: 'daily-notes',
      fieldMapping: { pomodoros: 'pomodoro' },
    });
    expect(readTaskNotesPomodoroInfo(app)).toEqual({
      storageLocation: 'daily-notes',
      frontmatterKey: 'pomodoro',
    });
  });

  it('returns null when TaskNotes is not installed/enabled', () => {
    expect(readTaskNotesPomodoroInfo({ plugins: { plugins: {} } })).toBeNull();
  });

  it('returns null when storageLocation is missing', () => {
    const app = appWithTaskNotes({ fieldMapping: { pomodoros: 'pomodoro' } });
    expect(readTaskNotesPomodoroInfo(app)).toBeNull();
  });

  it('returns null when the pomodoro field mapping is missing', () => {
    const app = appWithTaskNotes({ pomodoroStorageLocation: 'daily-notes', fieldMapping: {} });
    expect(readTaskNotesPomodoroInfo(app)).toBeNull();
  });

  it('returns null when the internal API is absent entirely (never throws)', () => {
    expect(readTaskNotesPomodoroInfo({})).toBeNull();
    expect(readTaskNotesPomodoroInfo(null)).toBeNull();
    expect(readTaskNotesPomodoroInfo(undefined)).toBeNull();
  });
});

describe('pomodoroFieldMismatch', () => {
  it('suggests the TaskNotes key when it differs and storage is daily-notes', () => {
    const info = { storageLocation: 'daily-notes', frontmatterKey: 'pomodoro' };
    expect(pomodoroFieldMismatch(info, 'pomodoros')).toEqual({ suggestedKey: 'pomodoro' });
  });

  it('returns null when the keys already match', () => {
    const info = { storageLocation: 'daily-notes', frontmatterKey: 'pomodoros' };
    expect(pomodoroFieldMismatch(info, 'pomodoros')).toBeNull();
  });

  it('returns null when TaskNotes uses its own plugin storage, not daily notes', () => {
    // Kuro never reads plugin-storage sessions at all — a field-name mismatch there is moot.
    const info = { storageLocation: 'plugin', frontmatterKey: 'pomodoro' };
    expect(pomodoroFieldMismatch(info, 'pomodoros')).toBeNull();
  });

  it('returns null when TaskNotes info is unavailable', () => {
    expect(pomodoroFieldMismatch(null, 'pomodoros')).toBeNull();
  });
});
