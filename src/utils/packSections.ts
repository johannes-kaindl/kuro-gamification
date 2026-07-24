/* ==========================================================
   Pure helpers for the per-unit pack export/import UI.
   Builds a KuroPack carrying exactly one section (custom value
   or factory default), and reports which sections a pack has.
   ========================================================== */
import type { KuroPack, KuroSettings } from '../types';
import { defaultLootPool } from '../data/default-loot-pool';
import { defaultLore } from '../data/default-lore';
import { defaultHabits } from '../data/default-habits';

export type PackUnit = 'lore' | 'loot' | 'habits';

export function buildUnitPack(unit: PackUnit, settings: KuroSettings): KuroPack {
  const pack: KuroPack = { kuroPack: 1, name: `Kuro ${unit}` };
  if (unit === 'lore') {
    pack.lore = settings.customLore ?? defaultLore(settings.language);
  } else if (unit === 'loot') {
    pack.loot = settings.customLootPool ?? defaultLootPool(settings.language);
  } else {
    pack.habits = settings.habits.length > 0 ? settings.habits : defaultHabits(settings.language);
  }
  return pack;
}

/**
 * Returns NEW settings with one unit reset to its factory default.
 * Content-only: never touches XP, streaks, redeemed drops or levels.
 */
export function resetUnit(settings: KuroSettings, unit: PackUnit): KuroSettings {
  const next: KuroSettings = { ...settings };
  if (unit === 'lore') next.customLore = null;
  else if (unit === 'loot') next.customLootPool = null;
  else next.habits = defaultHabits(settings.language);
  return next;
}

export function detectUnits(pack: KuroPack): PackUnit[] {
  const units: PackUnit[] = [];
  if (pack.lore !== undefined) units.push('lore');
  if (pack.loot !== undefined) units.push('loot');
  if (pack.habits !== undefined) units.push('habits');
  return units;
}
