/* ==========================================================
   LootEngine — deterministic loot picks + tier resolution.
   Pure functions only.
   ========================================================== */
import type { KuroLootDrop, KuroLootTier, KuroSettings } from '../types';
import { defaultLootPool } from '../data/default-loot-pool';
import { seededShuffle } from '../utils/seededRandom';

export class LootEngine {
  /** How many drops the user has earned vs. redeemed. */
  static availableDrops(currentLevel: number, redeemedDrops: number): number {
    // 1 drop per level after L1. Floor at 0.
    return Math.max(0, (currentLevel - 1) - redeemedDrops);
  }

  static tierForLevel(level: number, settings: KuroSettings): KuroLootTier {
    return settings.tierByLevel[level] ?? 'common';
  }

  /** Returns null if loot disabled, no level reached, or pool empty. */
  static pickOptions(
    currentLevel: number,
    redeemedDrops: number,
    settings: KuroSettings,
  ): { tier: KuroLootTier; options: KuroLootDrop[] } | null {
    if (!settings.enableLoot) return null;
    const available = LootEngine.availableDrops(currentLevel, redeemedDrops);
    if (available <= 0) return null;

    const tier = LootEngine.tierForLevel(currentLevel, settings);
    const pool = LootEngine.poolFor(tier, settings);
    if (pool.length === 0) return null;

    // Deterministic seed: stable until next redeem
    const seed = currentLevel * 1000 + redeemedDrops * 37 + pool.length;
    const count = Math.max(1, Math.min(settings.lootOptionsCount, pool.length));
    const options = seededShuffle(pool, seed).slice(0, count);
    return { tier, options };
  }

  static poolFor(tier: KuroLootTier, settings: KuroSettings): KuroLootDrop[] {
    if (settings.customLootPool?.[tier]?.length) {
      return settings.customLootPool[tier] as KuroLootDrop[];
    }
    return defaultLootPool(settings.language)[tier] ?? [];
  }
}
