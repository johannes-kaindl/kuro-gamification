import { StreakEngine } from '../src/engine/StreakEngine';
import { DEFAULT_SETTINGS } from '../src/types';

describe('StreakEngine.compute', () => {
  const today = new Date(2026, 3, 24); // April 24

  it('returns 0 when no qualifying dates', () => {
    const r = StreakEngine.compute({
      qualifyingDates: new Set(),
      today,
      availableFreezeTokens: 0,
      settings: DEFAULT_SETTINGS,
    });
    expect(r.streak).toBe(0);
    expect(r.bonus).toBe(0);
  });

  it('counts continuous streak ending today', () => {
    const r = StreakEngine.compute({
      qualifyingDates: new Set(['2026-04-22', '2026-04-23', '2026-04-24']),
      today,
      availableFreezeTokens: 0,
      settings: DEFAULT_SETTINGS,
    });
    expect(r.streak).toBe(3);
    // 3-day tier → 5xp/day → 15
    expect(r.bonus).toBe(15);
  });

  it('breaks immediately when today is missing and no tokens', () => {
    const r = StreakEngine.compute({
      qualifyingDates: new Set(['2026-04-22', '2026-04-23']),
      today,
      availableFreezeTokens: 0,
      settings: DEFAULT_SETTINGS,
    });
    // first iteration: today (4-24) missing, streak=0, no token → break
    expect(r.streak).toBe(0);
  });

  it('does NOT use a freeze token when streak is still 0', () => {
    const r = StreakEngine.compute({
      qualifyingDates: new Set(['2026-04-22']),
      today,
      availableFreezeTokens: 2,
      settings: DEFAULT_SETTINGS,
    });
    // 4-24 missing → streak still 0 → cannot freeze (rule: streak >= 1)
    expect(r.streak).toBe(0);
  });

  it('uses freeze tokens to bridge gaps once streak started', () => {
    const r = StreakEngine.compute({
      qualifyingDates: new Set(['2026-04-24', '2026-04-22']), // 4-23 missing
      today,
      availableFreezeTokens: 1,
      settings: DEFAULT_SETTINGS,
    });
    expect(r.streak).toBe(2);
    expect(r.freezeUsed).toBe(1);
  });

  it('runs out of tokens and stops', () => {
    const r = StreakEngine.compute({
      qualifyingDates: new Set([
        '2026-04-24',
        // 4-23 missing
        // 4-22 missing
        '2026-04-21',
      ]),
      today,
      availableFreezeTokens: 1,
      settings: DEFAULT_SETTINGS,
    });
    expect(r.streak).toBe(1);
    expect(r.freezeUsed).toBe(1);
  });

  it('returns 0 when streaks disabled', () => {
    const r = StreakEngine.compute({
      qualifyingDates: new Set(['2026-04-24']),
      today,
      availableFreezeTokens: 0,
      settings: { ...DEFAULT_SETTINGS, enableStreaks: false },
    });
    expect(r.streak).toBe(0);
  });
});

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
