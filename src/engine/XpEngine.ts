/* ==========================================================
   XpEngine — pure XP arithmetic per daily, per weekly,
   plus aggregation. No I/O — operates on plain data.
   Easy to unit-test.
   ========================================================== */
import type {
  KuroSettings, KuroXpAdjustment, KuroXpBreakdownRow, KuroLevel,
} from '../types';
import type { CheckboxStats } from '../utils/checkboxes';

export interface DailyInput {
  /** YYYY-MM-DD basename of the daily note. */
  date: string;
  stats: CheckboxStats;
  /** Frontmatter cache for the daily file. */
  frontmatter: Record<string, unknown>;
}

export interface WeeklyInput {
  /** YYYY-Www basename of the weekly note. */
  weekId: string;
  frontmatter: Record<string, unknown>;
}

export interface DailyXpResult {
  date: string;
  xp: number;
  rows: KuroXpBreakdownRow[];
}

export interface AggregateInput {
  dailies: readonly DailyInput[];
  weeklies: readonly WeeklyInput[];
  manualXp: readonly KuroXpAdjustment[];
  streakBonus: number;
  settings: KuroSettings;
}

export interface AggregateResult {
  totalXp: number;
  rows: KuroXpBreakdownRow[];
}

export class XpEngine {
  /** Compute a single daily's XP — pure. Returns rows for verbose breakdown. */
  static computeDaily(d: DailyInput, s: KuroSettings): DailyXpResult {
    const rows: KuroXpBreakdownRow[] = [];
    let xp = 0;

    if (s.enableXpFromCheckboxes && d.stats.done > 0) {
      const cb = d.stats.done * s.xpPerCheckbox;
      xp += cb;
      rows.push({
        source: `Daily ${d.date} — Checkboxen`,
        amount: cb,
        reason: `${d.stats.done} ✓ × ${s.xpPerCheckbox} XP`,
      });
    }

    if (s.enableXpFromCheckboxes && d.stats.total > 0) {
      let bonus = 0;
      let label = '';
      if (d.stats.pct >= 0.9)        { bonus = s.bonusFor90pct; label = '90%+'; }
      else if (d.stats.pct >= 0.75)  { bonus = s.bonusFor75pct; label = '75%+'; }
      else if (d.stats.pct >= 0.5)   { bonus = s.bonusFor50pct; label = '50%+'; }
      if (bonus > 0) {
        xp += bonus;
        rows.push({
          source: `Daily ${d.date} — Completion`,
          amount: bonus,
          reason: `${label} Tagesabschluss`,
        });
      }
    }

    if (s.enableXpFromHabits) {
      for (const habit of s.habits) {
        if (d.frontmatter[habit.key] === true) {
          xp += habit.xp;
          rows.push({
            source: `Daily ${d.date} — Habit`,
            amount: habit.xp,
            reason: habit.label,
          });
        }
      }
      const rawPomos = d.frontmatter[s.pomodoroFrontmatterKey];
      const pomos = Array.isArray(rawPomos) ? countCompletedPomodoros(rawPomos) : numFromFm(rawPomos);
      if (pomos !== null && pomos >= s.pomodoroThreshold) {
        xp += s.pomodoroBonus;
        rows.push({
          source: `Daily ${d.date} — Pomodoros`,
          amount: s.pomodoroBonus,
          reason: `${pomos} Pomodoros (Schwelle ${s.pomodoroThreshold})`,
        });
      }
    }

    return { date: d.date, xp, rows };
  }

  /** Compute a weekly's XP — review/planning. Pure. */
  static computeWeekly(w: WeeklyInput, s: KuroSettings): { xp: number; rows: KuroXpBreakdownRow[] } {
    if (!s.enableXpFromWeekly) return { xp: 0, rows: [] };
    const rows: KuroXpBreakdownRow[] = [];
    let xp = 0;
    if (w.frontmatter[s.weeklyReviewKey] === true) {
      xp += s.weeklyReviewXp;
      rows.push({
        source: `Weekly ${w.weekId} — Review`,
        amount: s.weeklyReviewXp,
        reason: `${s.weeklyReviewKey}: true`,
      });
    }
    if (w.frontmatter[s.weeklyPlanningKey] === true) {
      xp += s.weeklyPlanningXp;
      rows.push({
        source: `Weekly ${w.weekId} — Planning`,
        amount: s.weeklyPlanningXp,
        reason: `${s.weeklyPlanningKey}: true`,
      });
    }
    return { xp, rows };
  }

  /** Aggregate everything into a total + breakdown. */
  static aggregate(inp: AggregateInput): AggregateResult {
    const rows: KuroXpBreakdownRow[] = [];
    let total = 0;

    for (const d of inp.dailies) {
      const r = XpEngine.computeDaily(d, inp.settings);
      total += r.xp;
      rows.push(...r.rows);
    }

    for (const w of inp.weeklies) {
      const r = XpEngine.computeWeekly(w, inp.settings);
      total += r.xp;
      rows.push(...r.rows);
    }

    if (inp.streakBonus > 0) {
      total += inp.streakBonus;
      rows.push({
        source: 'Streak-Bonus',
        amount: inp.streakBonus,
        reason: 'aktiver Streak',
      });
    }

    for (const adj of inp.manualXp) {
      total += adj.amount;
      rows.push({
        source: `Manuell ${adj.date}`,
        amount: adj.amount,
        reason: adj.reason,
      });
    }

    return { totalXp: total, rows };
  }

  /** Determine current + next level for a given XP value. */
  static levelForXp(xp: number, levels: readonly KuroLevel[]): {
    current: KuroLevel;
    next: KuroLevel | null;
    xpToNext: number;
    pctToNext: number;
  } {
    if (levels.length === 0) {
      const fallback: KuroLevel = { level: 1, title: 'NULL', xp: 0 };
      return { current: fallback, next: null, xpToNext: 0, pctToNext: 1 };
    }
    const sorted = [...levels].sort((a, b) => a.xp - b.xp);
    let current = sorted[0];
    for (const l of sorted) {
      if (xp >= l.xp) current = l;
      else break;
    }
    const idx = sorted.indexOf(current);
    const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const xpToNext = next ? Math.max(0, next.xp - xp) : 0;
    const pctToNext = next
      ? (xp - current.xp) / Math.max(1, next.xp - current.xp)
      : 1;
    return { current, next, xpToNext, pctToNext };
  }
}

/**
 * Counts completed work sessions in a TaskNotes daily-notes pomodoro session array
 * (`pomodoroStorageLocation: "daily-notes"`). Breaks and interrupted/unfinished
 * sessions don't count.
 */
function countCompletedPomodoros(sessions: unknown[]): number {
  let count = 0;
  for (const entry of sessions) {
    if (
      typeof entry === 'object' && entry !== null
      && (entry as Record<string, unknown>).type === 'work'
      && (entry as Record<string, unknown>).completed === true
    ) {
      count += 1;
    }
  }
  return count;
}

function numFromFm(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
