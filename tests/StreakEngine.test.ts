import { StreakEngine } from '../src/engine/StreakEngine';
import { DEFAULT_SETTINGS } from '../src/types';

/** ISO dates from `from` for `n` consecutive days (local calendar, DST-safe). */
function run(from: string, n: number): string[] {
  const [y, m, d] = from.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = new Date(y, m - 1, d + i);
    out.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`);
  }
  return out;
}

describe('StreakEngine.compute', () => {
  const today = new Date(2026, 3, 24); // April 24, a Friday
  const base = { today, settings: DEFAULT_SETTINGS };

  it('returns 0 when no qualifying dates', () => {
    const r = StreakEngine.compute({ ...base, qualifyingDates: new Set() });
    expect(r.streak).toBe(0);
    expect(r.bonus).toBe(0);
    expect(r.tokensLeft).toBe(DEFAULT_SETTINGS.streakFreezeTokensPerMonth);
  });

  it('counts continuous streak ending today', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(['2026-04-22', '2026-04-23', '2026-04-24']),
    });
    expect(r.streak).toBe(3);
    // 3-day tier → 5xp/day → 15
    expect(r.bonus).toBe(15);
  });

  it('treats the running day as neutral: yesterday and the day before still count', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(['2026-04-22', '2026-04-23']),
    });
    expect(r.streak).toBe(2);
    expect(r.freezeUsed).toBe(0);
    expect(r.tokensLeft).toBe(DEFAULT_SETTINGS.streakFreezeTokensPerMonth);
  });

  it('bridges only as many gaps as there are tokens (one token, three gaps)', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(['2026-04-20']),
      settings: { ...DEFAULT_SETTINGS, streakFreezeTokensPerMonth: 1 },
    });
    // 04-20 starts a streak of 1; 04-21..23 are three gaps, one token bridges the first, the rest breaks it
    expect(r.streak).toBe(0);
    expect(r.freezeUsed).toBe(1);
  });

  it('uses a freeze token exactly once per gap and reports what is left', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(['2026-04-24', '2026-04-22']), // 4-23 missing
      settings: { ...DEFAULT_SETTINGS, streakFreezeTokensPerMonth: 1 },
    });
    expect(r.streak).toBe(2);
    expect(r.freezeUsed).toBe(1);
    expect(r.tokensLeft).toBe(0);
  });

  it('runs out of tokens and the streak starts over', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(['2026-04-24', '2026-04-21']), // 4-22, 4-23 missing
      settings: { ...DEFAULT_SETTINGS, streakFreezeTokensPerMonth: 1 },
    });
    expect(r.streak).toBe(1); // 04-21 streak broken at 04-23, 04-24 starts a new one
    expect(r.freezeUsed).toBe(1);
  });

  it('resets tokens on the first of each month (no carry-over)', () => {
    // gap on 03-31 uses a March token, gap on 04-01 uses a fresh April token
    const r = StreakEngine.compute({
      today: new Date(2026, 3, 2),
      qualifyingDates: new Set(['2026-03-30', '2026-04-02']),
      settings: { ...DEFAULT_SETTINGS, streakFreezeTokensPerMonth: 1 },
    });
    expect(r.streak).toBe(2);
    expect(r.freezeUsed).toBe(2);
  });

  it('keeps the bonus of an ended streak', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(run('2026-03-15', 20)), // 03-15 … 04-03, then ten days of nothing
    });
    expect(r.streak).toBe(0);
    expect(r.bonus).toBe(300);
  });

  it('keeps the bonus of an ended streak beyond the old 365-day window', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(run('2024-01-01', 20)),
    });
    expect(r.streak).toBe(0);
    expect(r.bonus).toBe(300);
  });

  it('credits the same total as the old bonusFor(L) for an unbroken streak', () => {
    const tiers = DEFAULT_SETTINGS.streakBonus;
    for (const [len, expected] of [[7, 70], [14, 210], [30, 600], [400, 8000]] as const) {
      const r = StreakEngine.compute({
        ...base,
        qualifyingDates: new Set(run(formatBack(today, len - 1), len)),
      });
      expect(r.streak).toBe(len);
      expect(r.bonus).toBe(expected);
      expect(r.bonus).toBe(StreakEngine.bonusFor(len, tiers));
    }
  });

  it('five days ending yesterday: streak 5, bonus 25', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(run('2026-04-19', 5)),
    });
    expect(r.streak).toBe(5);
    expect(r.bonus).toBe(25);
  });

  it('is deterministic: recomputing pays the same gap never twice', () => {
    const inp = {
      ...base,
      qualifyingDates: new Set(['2026-04-24', '2026-04-22']),
      settings: { ...DEFAULT_SETTINGS, streakFreezeTokensPerMonth: 1 },
    };
    expect(StreakEngine.compute(inp)).toEqual(StreakEngine.compute(inp));
  });

  it('returns 0 when streaks disabled', () => {
    const r = StreakEngine.compute({
      ...base,
      qualifyingDates: new Set(['2026-04-24']),
      settings: { ...DEFAULT_SETTINGS, enableStreaks: false },
    });
    expect(r.streak).toBe(0);
    expect(r.bonus).toBe(0);
  });
});

describe('StreakEngine.compute — working days', () => {
  const today = new Date(2026, 3, 24); // Friday
  const noWeekend = { ...DEFAULT_SETTINGS, streakDaySat: false, streakDaySun: false, streakFreezeTokensPerMonth: 0 };

  it('default (all seven days active) keeps today\'s behaviour: a weekend gap breaks the streak', () => {
    const r = StreakEngine.compute({
      today,
      qualifyingDates: new Set(['2026-04-17', '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24']),
      settings: { ...DEFAULT_SETTINGS, streakFreezeTokensPerMonth: 0 },
    });
    expect(r.streak).toBe(5); // Sat/Sun 04-18/19 gap breaks, Mon-Fri counted
  });

  it('an inactive weekday without a note is neutral: counts nothing, breaks nothing, costs no token', () => {
    const r = StreakEngine.compute({
      today,
      qualifyingDates: new Set(['2026-04-16', '2026-04-17', '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24']),
      settings: { ...noWeekend, streakFreezeTokensPerMonth: 2 },
    });
    expect(r.streak).toBe(7);
    expect(r.freezeUsed).toBe(0);
    expect(r.tokensLeft).toBe(2);
  });

  it('a qualifying note on an inactive weekday counts', () => {
    const r = StreakEngine.compute({
      today: new Date(2026, 3, 20), // Monday
      qualifyingDates: new Set(['2026-04-17', '2026-04-18', '2026-04-20']),
      settings: noWeekend,
    });
    expect(r.streak).toBe(3);
  });

  it('a gap on an active weekday still breaks', () => {
    const r = StreakEngine.compute({
      today,
      qualifyingDates: new Set(['2026-04-20', '2026-04-22', '2026-04-23']), // Tue 04-21 missing
      settings: noWeekend,
    });
    expect(r.streak).toBe(2);
  });

  it('neutralDates (frontmatter) are neutral on active weekdays', () => {
    const r = StreakEngine.compute({
      today,
      qualifyingDates: new Set(['2026-04-22', '2026-04-24']),
      neutralDates: new Set(['2026-04-23']),
      settings: { ...DEFAULT_SETTINGS, streakFreezeTokensPerMonth: 0 },
    });
    expect(r.streak).toBe(2);
    expect(r.freezeUsed).toBe(0);
  });

  it('a qualifying note wins over the neutral marker', () => {
    const r = StreakEngine.compute({
      today,
      qualifyingDates: new Set(['2026-04-22', '2026-04-23', '2026-04-24']),
      neutralDates: new Set(['2026-04-23']),
      settings: DEFAULT_SETTINGS,
    });
    expect(r.streak).toBe(3);
  });
});

function formatBack(from: Date, days: number): string {
  const c = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days);
  return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
}

describe('StreakEngine.bonusFor', () => {
  const tiers = DEFAULT_SETTINGS.streakBonus;

  it('returns 0 below first threshold', () => {
    expect(StreakEngine.bonusFor(2, tiers)).toBe(0);
  });
  it('returns 5xp/day at 3-6', () => {
    expect(StreakEngine.bonusFor(3, tiers)).toBe(15);
    expect(StreakEngine.bonusFor(6, tiers)).toBe(30);
  });
  it('returns 10xp/day at 7-13', () => {
    expect(StreakEngine.bonusFor(7,  tiers)).toBe(70);
    expect(StreakEngine.bonusFor(13, tiers)).toBe(130);
  });
  it('returns 15xp/day at 14-29', () => {
    expect(StreakEngine.bonusFor(14, tiers)).toBe(210);
    expect(StreakEngine.bonusFor(29, tiers)).toBe(435);
  });
  it('returns 20xp/day at 30+', () => {
    expect(StreakEngine.bonusFor(30, tiers)).toBe(600);
    expect(StreakEngine.bonusFor(100, tiers)).toBe(2000);
  });
});

describe('StreakEngine.regenFreezeTokens', () => {
  const today = new Date(2026, 3, 24);

  it('regenerates when month changes', () => {
    const r = StreakEngine.regenFreezeTokens(0, '2026-03', today, DEFAULT_SETTINGS);
    expect(r.tokens).toBe(DEFAULT_SETTINGS.streakFreezeTokensPerMonth);
    expect(r.lastRegen).toBe('2026-04');
  });

  it('does not regenerate within same month', () => {
    const r = StreakEngine.regenFreezeTokens(0, '2026-04', today, DEFAULT_SETTINGS);
    expect(r.tokens).toBe(0);
    expect(r.lastRegen).toBe('2026-04');
  });

  it('initializes when no last regen recorded', () => {
    const r = StreakEngine.regenFreezeTokens(0, '', today, DEFAULT_SETTINGS);
    expect(r.tokens).toBe(DEFAULT_SETTINGS.streakFreezeTokensPerMonth);
  });
});

describe('StreakEngine.labelKey', () => {
  it('maps streak length to label key', () => {
    expect(StreakEngine.labelKey(0)).toBe('streak.label.0');
    expect(StreakEngine.labelKey(3)).toBe('streak.label.3');
    expect(StreakEngine.labelKey(7)).toBe('streak.label.7');
    expect(StreakEngine.labelKey(14)).toBe('streak.label.14');
    expect(StreakEngine.labelKey(30)).toBe('streak.label.30');
    expect(StreakEngine.labelKey(99)).toBe('streak.label.30');
  });
});
