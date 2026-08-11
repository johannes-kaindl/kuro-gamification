import { XpEngine } from '../src/engine/XpEngine';
import { DEFAULT_SETTINGS } from '../src/types';

describe('XpEngine.computeDaily', () => {
  const baseFm = {};
  const baseSettings = { ...DEFAULT_SETTINGS };

  it('awards 0 XP for empty checkbox stats', () => {
    const r = XpEngine.computeDaily(
      { date: '2026-04-24', stats: { total: 0, done: 0, pct: 0 }, frontmatter: {} },
      baseSettings,
    );
    expect(r.xp).toBe(0);
    expect(r.rows).toHaveLength(0);
  });

  it('awards 2 XP per ticked checkbox', () => {
    const r = XpEngine.computeDaily(
      { date: '2026-04-24', stats: { total: 5, done: 3, pct: 0.6 }, frontmatter: {} },
      baseSettings,
    );
    // 3 * 2 = 6 + 50%-bonus 10 = 16
    expect(r.xp).toBe(16);
  });

  it('escalates completion bonus through 50/75/90 thresholds', () => {
    const r50 = XpEngine.computeDaily(
      { date: 'd', stats: { total: 4, done: 2, pct: 0.5 }, frontmatter: {} },
      baseSettings,
    );
    const r75 = XpEngine.computeDaily(
      { date: 'd', stats: { total: 4, done: 3, pct: 0.75 }, frontmatter: {} },
      baseSettings,
    );
    const r90 = XpEngine.computeDaily(
      { date: 'd', stats: { total: 10, done: 9, pct: 0.9 }, frontmatter: {} },
      baseSettings,
    );
    // 50: 2 ✓ × 2 + 10 = 14
    expect(r50.xp).toBe(14);
    // 75: 3 ✓ × 2 + 20 = 26
    expect(r75.xp).toBe(26);
    // 90: 9 ✓ × 2 + 30 = 48
    expect(r90.xp).toBe(48);
  });

  it('awards habit XP for true habits, ignores false', () => {
    const settings = {
      ...baseSettings,
      habits: [
        { key: 'qigong',  label: 'Qi',  xp: 10 },
        { key: 'peloton', label: 'Pel', xp: 15 },
      ],
    };
    const r = XpEngine.computeDaily(
      {
        date: 'd',
        stats: { total: 0, done: 0, pct: 0 },
        frontmatter: { qigong: true, peloton: false },
      },
      settings,
    );
    expect(r.xp).toBe(10);
  });

  it('awards pomodoro bonus when threshold met', () => {
    const r = XpEngine.computeDaily(
      {
        date: 'd',
        stats: { total: 0, done: 0, pct: 0 },
        frontmatter: { pomodoros: 5 },
      },
      baseSettings,
    );
    expect(r.xp).toBe(baseSettings.pomodoroBonus);
  });

  it('counts completed work sessions from a TaskNotes daily-notes session array', () => {
    const sessions = [
      { type: 'work', completed: true },
      { type: 'work', completed: true },
      { type: 'work', completed: true },
      { type: 'work', completed: true },
    ];
    const r = XpEngine.computeDaily(
      { date: 'd', stats: { total: 0, done: 0, pct: 0 }, frontmatter: { pomodoros: sessions } },
      baseSettings,
    );
    expect(r.xp).toBe(baseSettings.pomodoroBonus);
  });

  it('excludes breaks and interrupted sessions from the pomodoro session-array count', () => {
    const sessions = [
      { type: 'work', completed: true },
      { type: 'work', completed: true },
      { type: 'work', completed: true },
      { type: 'work', completed: false },   // interrupted/unfinished
      { type: 'short-break', completed: true },
      { type: 'long-break', completed: true },
    ];
    // 6 entries total, but only 3 qualifying work sessions — below the default threshold of 4.
    const r = XpEngine.computeDaily(
      { date: 'd', stats: { total: 0, done: 0, pct: 0 }, frontmatter: { pomodoros: sessions } },
      baseSettings,
    );
    expect(r.xp).toBe(0);
  });

  it('does not award pomodoro bonus for a session array below threshold', () => {
    const sessions = [
      { type: 'work', completed: true },
      { type: 'work', completed: true },
    ];
    const r = XpEngine.computeDaily(
      { date: 'd', stats: { total: 0, done: 0, pct: 0 }, frontmatter: { pomodoros: sessions } },
      baseSettings,
    );
    expect(r.xp).toBe(0);
  });

  it('does not award pomodoro bonus for an empty session array', () => {
    const r = XpEngine.computeDaily(
      { date: 'd', stats: { total: 0, done: 0, pct: 0 }, frontmatter: { pomodoros: [] } },
      baseSettings,
    );
    expect(r.xp).toBe(0);
  });

  it('does not award pomodoro bonus when the frontmatter field is absent', () => {
    const r = XpEngine.computeDaily(
      { date: 'd', stats: { total: 0, done: 0, pct: 0 }, frontmatter: {} },
      baseSettings,
    );
    expect(r.xp).toBe(0);
  });

  it('does not award habits when disabled', () => {
    const settings = {
      ...baseSettings,
      enableXpFromHabits: false,
      habits: [{ key: 'qigong', label: 'Qi', xp: 10 }],
    };
    const r = XpEngine.computeDaily(
      { date: 'd', stats: { total: 0, done: 0, pct: 0 }, frontmatter: { qigong: true } },
      settings,
    );
    expect(r.xp).toBe(0);
  });
});

describe('XpEngine.levelForXp', () => {
  it('returns level 1 for 0 XP', () => {
    const r = XpEngine.levelForXp(0, DEFAULT_SETTINGS.levels);
    expect(r.current.level).toBe(1);
    expect(r.next?.level).toBe(2);
    expect(r.xpToNext).toBe(200);
    expect(r.pctToNext).toBe(0);
  });

  it('returns highest level for very large XP', () => {
    const r = XpEngine.levelForXp(99_999, DEFAULT_SETTINGS.levels);
    expect(r.current.level).toBe(10);
    expect(r.next).toBeNull();
  });

  it('returns correct level at exact threshold', () => {
    const r = XpEngine.levelForXp(500, DEFAULT_SETTINGS.levels);
    expect(r.current.level).toBe(3);
  });

  it('returns level just below next threshold', () => {
    const r = XpEngine.levelForXp(499, DEFAULT_SETTINGS.levels);
    expect(r.current.level).toBe(2);
    expect(r.next?.level).toBe(3);
    expect(r.xpToNext).toBe(1);
  });

  it('returns reasonable progress percentage', () => {
    const r = XpEngine.levelForXp(350, DEFAULT_SETTINGS.levels);
    // Between L2(200) and L3(500): (350-200) / (500-200) = 0.5
    expect(r.pctToNext).toBeCloseTo(0.5, 5);
  });
});

describe('XpEngine.aggregate', () => {
  it('sums dailies, weeklies, manual XP, and streak bonus', () => {
    const r = XpEngine.aggregate({
      dailies: [
        { date: '2026-04-22', stats: { total: 3, done: 3, pct: 1 }, frontmatter: {} },
      ],
      weeklies: [],
      manualXp: [{ date: '2026-04-22', amount: 100, reason: 'milestone' }],
      streakBonus: 35,
      settings: DEFAULT_SETTINGS,
    });
    // daily: 3*2 + 30 (90%+) = 36; + streakBonus 35 + manual 100 = 171
    expect(r.totalXp).toBe(171);
    expect(r.rows.length).toBeGreaterThan(0);
  });
});
