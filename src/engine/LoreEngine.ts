/* ==========================================================
   LoreEngine — fragment lookup by level. Pure.
   ========================================================== */
import type { KuroLoreFragment, KuroSettings } from '../types';
import { defaultLore } from '../data/default-lore';

export class LoreEngine {
  static fragmentForLevel(level: number, settings: KuroSettings): KuroLoreFragment | null {
    if (!settings.enableLore) return null;
    const pool = settings.customLore && settings.customLore.length > 0
      ? settings.customLore
      : defaultLore(settings.language);
    return pool.find((f) => f.level === level) ?? null;
  }

  static allFragmentsUpTo(level: number, settings: KuroSettings): KuroLoreFragment[] {
    if (!settings.enableLore) return [];
    const pool = settings.customLore && settings.customLore.length > 0
      ? settings.customLore
      : defaultLore(settings.language);
    return pool.filter((f) => f.level <= level).sort((a, b) => a.level - b.level);
  }
}
