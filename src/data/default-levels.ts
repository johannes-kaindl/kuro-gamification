/* ==========================================================
   Kuro Levels — gothic-cyberpunk progression curve.
   Linear-quadratic — no exponential spike (ADHD-friendly).
   Override via Settings → Level & Loot.
   ========================================================== */
import type { KuroLevel, KuroLootTier } from '../types';

export const DEFAULT_LEVELS: KuroLevel[] = [
  { level: 1,  title: 'SIGNAL LOST',        xp: 0     },
  { level: 2,  title: 'PHOSPHOR FLICKER',   xp: 200   },
  { level: 3,  title: 'SHADOW LINK',        xp: 500   },
  { level: 4,  title: 'CIPHER RUNNER',      xp: 1000  },
  { level: 5,  title: 'NEON WRAITH',        xp: 1800  },
  { level: 6,  title: 'CHROME RAVEN',       xp: 3000  },
  { level: 7,  title: 'VOID ARCHITECT',     xp: 5000  },
  { level: 8,  title: 'BLACK ICE',          xp: 8000  },
  { level: 9,  title: 'NEVERMORE PROTOCOL', xp: 12000 },
  { level: 10, title: 'K U R O',            xp: 18000 },
];

export const DEFAULT_TIER_BY_LEVEL: Record<number, KuroLootTier> = {
  2: 'common',  3: 'common',
  4: 'rare',    5: 'rare',
  6: 'epic',    7: 'epic',
  8: 'legendary', 9: 'legendary',
  10: 'mythic',
};

export const TIER_EMOJI: Record<KuroLootTier, string> = {
  common: '🟢',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡',
  mythic: '⚫',
};
