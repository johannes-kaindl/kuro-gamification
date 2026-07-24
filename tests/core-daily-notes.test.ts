/* ==========================================================
   readCoreDailyNotesConfig — adapt to the vault by reading the
   folder/format from Obsidian's built-in "Daily notes" core
   plugin, so fresh installs don't start with a foreign path.

   Reads an undocumented internal API defensively: every access
   is optional-chained and wrapped, returning null on anything
   unexpected so a missing/renamed API can never crash onload.
   ========================================================== */
import { readCoreDailyNotesConfig } from '../src/utils/coreDailyNotes';

/** Fake app exposing the core daily-notes plugin via getPluginById. */
function appWithDailyNotes(options: any) {
  return {
    internalPlugins: {
      getPluginById: (id: string) =>
        id === 'daily-notes' ? { instance: { options } } : null,
    },
  };
}

describe('readCoreDailyNotesConfig', () => {
  it('reads folder and format from the core daily-notes plugin', () => {
    const app = appWithDailyNotes({ folder: 'Journal/Daily', format: 'YYYY-MM-DD' });
    expect(readCoreDailyNotesConfig(app)).toEqual({ folder: 'Journal/Daily', format: 'YYYY-MM-DD' });
  });

  it('trims whitespace around folder and format', () => {
    const app = appWithDailyNotes({ folder: '  Daily  ', format: '  YYYY-MM-DD ' });
    expect(readCoreDailyNotesConfig(app)).toEqual({ folder: 'Daily', format: 'YYYY-MM-DD' });
  });

  it('falls back to empty strings when options fields are missing', () => {
    const app = appWithDailyNotes({});
    expect(readCoreDailyNotesConfig(app)).toEqual({ folder: '', format: '' });
  });

  it('returns null when the core plugin is not present', () => {
    const app = { internalPlugins: { getPluginById: () => null } };
    expect(readCoreDailyNotesConfig(app)).toBeNull();
  });

  it('returns null when the internal API is absent entirely (never throws)', () => {
    expect(readCoreDailyNotesConfig({})).toBeNull();
    expect(readCoreDailyNotesConfig(null)).toBeNull();
    expect(readCoreDailyNotesConfig(undefined)).toBeNull();
  });
});
