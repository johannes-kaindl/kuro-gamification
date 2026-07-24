/* ==========================================================
   StreakEngine — qualifying-day detection + freeze-token
   absorption. Pure: takes a Set of qualifying ISO dates.
   ========================================================== */
import type { KuroSettings, KuroStreakBonusTier } from '../types';
import { formatIso, subDays, formatYearMonth } from '../utils/dateUtils';

export interface StreakInput {
  qualifyingDates: ReadonlySet<string>;
  /** Today's date — pinned for testability. */
  today: Date;
  /** Available freeze tokens (regen monthly). */
  availableFreezeTokens: number;
  settings: KuroSettings;
  /** Cap how far back we walk (defensive — usually 365 days). */
  lookbackDays?: number;
}

export interface StreakResult {
  streak: number;
  freezeUsed: number;
  bonus: number;
}

export class StreakEngine {
  static compute(inp: StreakInput): StreakResult {
    if (!inp.settings.enableStreaks) return { streak: 0, freezeUsed: 0, bonus: 0 };

    const lookback = inp.lookbackDays ?? 365;
    const totalFreeze = inp.availableFreezeTokens;
    let streak = 0;
    let freezeUsed = 0;
    let cursor = new Date(inp.today);

    for (let i = 0; i < lookback; i++) {
      const ds = formatIso(cursor);
      if (inp.qualifyingDates.has(ds)) {
        streak++;
      } else {
        // try to absorb with a freeze token, only if streak already started
        if (streak >= 1 && freezeUsed < totalFreeze) {
          freezeUsed++;
          // streak continues (does NOT increment)
        } else {
          break;
        }
      }
      cursor = subDays(cursor, 1);
    }

    return {
      streak,
      freezeUsed,
      bonus: StreakEngine.bonusFor(streak, inp.settings.streakBonus),
    };
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
