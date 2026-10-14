/* ==========================================================
   Date utilities — ISO YYYY-MM-DD parsing, ISO-week, date math.
   No external moment dependency: all operations on native Date.
   ========================================================== */

import { localDate, localYearMonth } from '../vendor/kit/local-stamp';

export function todayIso(now: Date = new Date()): string {
  return formatIso(now);
}

/** Lokaler Tag `YYYY-MM-DD` / Monat `YYYY-MM` — das Kit (`local-stamp`), nicht `toISOString`, das um Mitternacht den UTC-Vortag nennt. */
export const formatIso = localDate;
export const formatYearMonth = localYearMonth;

/** True if `s` matches YYYY-MM-DD shape. */
export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** True if `s` matches YYYY-Www shape (ISO week). */
export function isIsoWeek(s: string): boolean {
  return /^\d{4}-W\d{2}$/.test(s);
}

/** Parse YYYY-MM-DD → Date in local TZ. Returns null if invalid. */
export function parseIso(s: string): Date | null {
  if (!isIsoDate(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Subtract `n` days from a Date. Returns new Date. */
export function subDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - n);
  return out;
}

/** Difference in whole days (`a - b`). */
export function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / 86_400_000);
}
