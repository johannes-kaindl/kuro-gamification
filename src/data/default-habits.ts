/* ==========================================================
   Kuro generic starter habits — neutral, low-pressure defaults
   seeded into settings.habits on a fresh install (per language).
   Users edit/replace them; existing installs keep their own.
   ========================================================== */
import type { KuroHabit, Lang } from '../types';

export const DEFAULT_HABITS_EN: KuroHabit[] = [
  { key: 'water',   label: '💧 Drink water',         xp: 10 },
  { key: 'move',    label: '🚶 Move 10 min',         xp: 10 },
  { key: 'outside', label: '🌳 Fresh air',           xp: 10 },
  { key: 'tidy',    label: '🧹 Tidy 5 min',          xp: 10 },
  { key: 'connect', label: '💬 Reach out to someone', xp: 10 },
];

export const DEFAULT_HABITS_DE: KuroHabit[] = [
  { key: 'water',   label: '💧 Wasser trinken',      xp: 10 },
  { key: 'move',    label: '🚶 10 Min bewegen',       xp: 10 },
  { key: 'outside', label: '🌳 Frische Luft',         xp: 10 },
  { key: 'tidy',    label: '🧹 5 Min aufräumen',      xp: 10 },
  { key: 'connect', label: '💬 Bei jemandem melden',   xp: 10 },
];

/** Deep-copied generic habit set for the given UI language (safe to mutate). */
export function defaultHabits(lang: Lang): KuroHabit[] {
  const src = lang === 'de' ? DEFAULT_HABITS_DE : DEFAULT_HABITS_EN;
  return src.map((h) => ({ ...h }));
}
