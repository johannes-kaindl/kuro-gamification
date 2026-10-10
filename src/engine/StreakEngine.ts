/* ==========================================================
   StreakEngine — qualifying-day detection + freeze-token
   absorption. Pure: takes a Set of qualifying ISO dates.
   ========================================================== */
import type { KuroSettings, KuroStreakBonusTier } from '../types';
import { formatIso, formatYearMonth, parseIso } from '../utils/dateUtils';

export interface StreakInput {
  qualifyingDates: ReadonlySet<string>;
  /** Days the user marked as "no work" in the daily note (frontmatter). Neutral unless they qualify. */
  neutralDates?: ReadonlySet<string>;
  /** Today's date — pinned for testability. */
  today: Date;
  settings: KuroSettings;
}

export interface StreakResult {
  /** Current streak length (0 once a gap could not be bridged). */
  streak: number;
  /** Freeze tokens spent over the whole history. */
  freezeUsed: number;
  /** Bonus XP credited over the whole history; an ended streak keeps it. */
  bonus: number;
  /** Freeze tokens left in the current month. */
  tokensLeft: number;
}

/** `Date.getDay()` order, 0 = Sunday. */
const WEEKDAY_KEYS = [
  'streakDaySun', 'streakDayMon', 'streakDayTue', 'streakDayWed',
  'streakDayThu', 'streakDayFri', 'streakDaySat',
] as const;

export class StreakEngine {
  /**
   * Forward replay from the first qualifying day to today — no stored state, so a
   * recompute never pays the same gap twice. Per day:
   *  - qualifying: streak +1, credit bonusFor(L) − bonusFor(L−1) (the sum of an
   *    unbroken streak equals bonusFor(L); an ended streak keeps it);
   *  - neutral (inactive weekday, marked day, or the running day): nothing happens;
   *  - otherwise a gap: a freeze token bridges it, else the streak starts over.
   * Tokens reset to the monthly allowance on the first of each month.
   */
  static compute(inp: StreakInput): StreakResult {
    const perMonth = inp.settings.streakFreezeTokensPerMonth;
    const none: StreakResult = { streak: 0, freezeUsed: 0, bonus: 0, tokensLeft: perMonth };
    if (!inp.settings.enableStreaks || inp.qualifyingDates.size === 0) return none;

    const first = [...inp.qualifyingDates].sort()[0];
    const start = parseIso(first);
    if (!start) return none;

    const todayIso = formatIso(inp.today);
    const tiers = inp.settings.streakBonus;
    let streak = 0;
    let bonus = 0;
    let freezeUsed = 0;
    let tokens = perMonth;
    let month = formatYearMonth(start);

    // Calendar steps via setDate, not +86 400 000 ms: DST days are 23/25 h long.
    for (
      let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      formatIso(cursor) <= todayIso;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    ) {
      const ym = formatYearMonth(cursor);
      if (ym !== month) {
        month = ym;
        tokens = perMonth;
      }
      const ds = formatIso(cursor);
      if (inp.qualifyingDates.has(ds)) {
        streak++;
        bonus += StreakEngine.bonusFor(streak, tiers) - StreakEngine.bonusFor(streak - 1, tiers);
      } else if (ds === todayIso) {
        // the running day is neutral until midnight
      } else if (inp.neutralDates?.has(ds) || !inp.settings[WEEKDAY_KEYS[cursor.getDay()]]) {
        // marked "no work" or an inactive weekday: neither counts nor breaks nor costs a token
      } else if (streak >= 1 && tokens > 0) {
        tokens--;
        freezeUsed++;
      } else {
        streak = 0;
      }
    }

    return { streak, freezeUsed, bonus, tokensLeft: tokens };
  }

  static bonusFor(streak: number, tiers: readonly KuroStreakBonusTier[]): number {
    if (streak <= 0) return 0;
    const sorted = [...tiers].sort((a, b) => b.from - a.from);
    for (const t of sorted) {
      if (streak >= t.from) return streak * t.xpPerDay;
    }
    return 0;
  }

  /** Returns the streak-label key for a given streak length. */
  static labelKey(streak: number): string {
    if (streak >= 30) return 'streak.label.30';
    if (streak >= 14) return 'streak.label.14';
    if (streak >= 7)  return 'streak.label.7';
    if (streak >= 3)  return 'streak.label.3';
    return 'streak.label.0';
  }

  /**
   * Regenerate freeze tokens at the start of each month.
   * Returns the new (current, lastRegenYearMonth) tuple.
   */
  static regenFreezeTokens(
    current: number,
    lastRegen: string,
    today: Date,
    settings: KuroSettings,
  ): { tokens: number; lastRegen: string } {
    const ym = formatYearMonth(today);
    if (ym !== lastRegen) {
      return { tokens: settings.streakFreezeTokensPerMonth, lastRegen: ym };
    }
    return { tokens: current, lastRegen };
  }
}
