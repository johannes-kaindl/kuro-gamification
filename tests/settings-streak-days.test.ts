/* Streak-Arbeitstage: jeder neue Schluessel braucht einen case in setControlValue —
   `default: return` speichert sonst nichts (Fehler vom 12.08., settingsTab-enableChat). */
import { KuroSettingsTab } from '../src/settings/SettingsTab';
import { DEFAULT_PLUGIN_DATA, DEFAULT_SETTINGS } from '../src/types';
import { markedDates } from '../src/utils/taskNotesBridge';

function makeTab() {
  const plugin = {
    app: {},
    data: JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)),
    manifest: { version: '0.0.0' },
    persist: jest.fn().mockResolvedValue(undefined),
    refreshStatus: jest.fn().mockResolvedValue(undefined),
  };
  return { plugin, tab: new KuroSettingsTab({} as any, plugin as any) };
}

describe('Streak working-day settings', () => {
  it('default is all seven days active, marker off', () => {
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect((DEFAULT_SETTINGS as any)[`streakDay${d}`]).toBe(true);
    }
    expect(DEFAULT_SETTINGS.streakSkipKey).toBe('');
    expect(DEFAULT_SETTINGS.streakSkipValues).toBe('Wochenende, Feiertag, Frei');
  });

  it.each(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])('streakDay%s is saved', async (d) => {
    const { plugin, tab } = makeTab();
    await tab.setControlValue(`streakDay${d}`, false);
    expect((plugin.data.settings as any)[`streakDay${d}`]).toBe(false);
    expect(plugin.persist).toHaveBeenCalled();
  });

  it('streakSkipKey and streakSkipValues are saved trimmed', async () => {
    const { plugin, tab } = makeTab();
    await tab.setControlValue('streakSkipKey', '  tagestyp ');
    await tab.setControlValue('streakSkipValues', ' Frei, Urlaub ');
    expect(plugin.data.settings.streakSkipKey).toBe('tagestyp');
    expect(plugin.data.settings.streakSkipValues).toBe('Frei, Urlaub');
  });

  it('all keys appear in the streak group definitions', () => {
    const { tab } = makeTab();
    const keys = JSON.stringify(tab.getSettingDefinitions());
    for (const k of ['streakDayMon', 'streakDaySun', 'streakSkipKey', 'streakSkipValues']) {
      expect(keys).toContain(k);
    }
  });
});

describe('markedDates', () => {
  const dailies = [
    { date: '2026-04-18', frontmatter: { tagestyp: 'Wochenende' } },
    { date: '2026-04-19', frontmatter: { tagestyp: ['Arbeit', 'Feiertag'] } },
    { date: '2026-04-20', frontmatter: { tagestyp: 'Arbeit' } },
    { date: '2026-04-21', frontmatter: {} },
    { date: '2026-04-22', frontmatter: { frei: true } },
  ];

  it('marks scalar and list values from the list', () => {
    expect([...markedDates(dailies, 'tagestyp', 'Wochenende, Feiertag, Frei')]).toEqual(['2026-04-18', '2026-04-19']);
  });
  it('empty key = off', () => {
    expect(markedDates(dailies, '', 'Wochenende').size).toBe(0);
  });
  it('compares booleans as text', () => {
    expect([...markedDates(dailies, 'frei', 'true')]).toEqual(['2026-04-22']);
  });
  it('empty value list marks nothing', () => {
    expect(markedDates(dailies, 'tagestyp', ' , ').size).toBe(0);
  });
});
