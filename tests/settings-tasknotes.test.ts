import { DEFAULT_SETTINGS } from '../src/types';

describe('TaskNotes-XP-Einstellungen', () => {
  it('liefert alle drei XP-Saetze als 0 aus (off-by-default)', () => {
    expect(DEFAULT_SETTINGS.xpPerCompletedTask).toBe(0);
    expect(DEFAULT_SETTINGS.xpPerWorkSession).toBe(0);
    expect(DEFAULT_SETTINGS.xpPerBreakSession).toBe(0);
  });

  it('hat die Rueckmeldung an, weil sie nichts veraendert sondern nur zeigt', () => {
    expect(DEFAULT_SETTINGS.notifyXpGain).toBe(true);
  });

  it('belegt die Aufgaben-Erkennung mit TaskNotes-Standardwerten vor', () => {
    expect(DEFAULT_SETTINGS.taskMatchField).toBe('tags');
    expect(DEFAULT_SETTINGS.taskMatchValue).toBe('task');
    expect(DEFAULT_SETTINGS.taskStatusField).toBe('status');
    expect(DEFAULT_SETTINGS.taskDoneValues).toBe('done');
  });
});
