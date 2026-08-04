/* ==========================================================
   Kuro Gamification — Type Definitions + Defaults
   ========================================================== */

export type KuroLootTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type Lang = 'de' | 'en';
export type LogLevel = 'off' | 'error' | 'info' | 'debug';
export type StatusBlockMode = 'full' | 'compact' | 'minimal';
/** Wieviel der heutigen Daily-Note in den Chat-Kontext geht. */
export type ChatDailyContext = 'none' | 'tasks' | 'full';

export interface KuroHabit {
  /** Frontmatter field name (e.g. "qigong"). */
  key: string;
  /** Display label (e.g. "🧘 Qi Gong"). */
  label: string;
  /** XP awarded when frontmatter[key] === true. */
  xp: number;
}

export interface KuroLevel {
  level: number;
  title: string;
  xp: number;
}

export interface KuroLootDrop {
  name: string;
  cat: string;
}

export interface KuroLoreFragment {
  level: number;
  title: string;
  text: string;
}

/** A shareable, LLM-friendly customization pack. Both content fields optional. */
export interface KuroPack {
  /** Pack format version. */
  kuroPack: number;
  /** Optional human label. */
  name?: string;
  /** Maps onto KuroSettings.customLootPool (per-tier merge with defaults). */
  loot?: Partial<Record<KuroLootTier, KuroLootDrop[]>>;
  /** Maps onto KuroSettings.customLore (replaces default lore wholesale). */
  lore?: KuroLoreFragment[];
  /** Maps onto KuroSettings.habits (replaces the habit list wholesale). */
  habits?: KuroHabit[];
  /** Optionale Stimme für den Companion-Chat. Max. 2000 Zeichen. */
  persona?: string;
}

/** One installed pack in the library. Carries the sections it was imported with. */
export interface InstalledPack {
  id: string;
  name: string;
  lore?: KuroLoreFragment[];
  loot?: Partial<Record<KuroLootTier, KuroLootDrop[]>>;
  /** Optionale Stimme für den Companion-Chat, aus dem importierten Pack. */
  persona?: string;
}

export interface KuroDropEntry {
  /** ISO date when redeemed. */
  date: string;
  level: number;
  tier: KuroLootTier;
  name: string;
  cat: string;
}

export interface KuroXpAdjustment {
  /** ISO date applied. */
  date: string;
  /** Positive or negative XP delta. */
  amount: number;
  /** Free-text reason. */
  reason: string;
}

export interface KuroStreakBonusTier {
  /** Streak length (inclusive) at which this tier kicks in. */
  from: number;
  /** XP per day in streak. */
  xpPerDay: number;
}

export interface KuroSettings {
  /* Paths */
  dailyFolder: string;
  weeklyFolder: string;
  /** moment-style date format used for daily filenames (e.g. "YYYY-MM-DD"). */
  dailyDateFormat: string;
  /** moment-style date format used for weekly filenames (e.g. "YYYY-[W]WW"). */
  weeklyDateFormat: string;

  /* Feature toggles — every escalating feature off-by-default unless safe */
  enableXpFromCheckboxes: boolean;
  enableXpFromHabits: boolean;
  enableXpFromWeekly: boolean;
  enableStreaks: boolean;
  enableLoot: boolean;
  enableLore: boolean;
  enableSidebar: boolean;
  /** Auto-open the sidebar when Obsidian starts. Off by default — availability (enableSidebar) is separate from auto-open. */
  openSidebarOnStartup: boolean;
  enableStatusBar: boolean;
  enableNotices: boolean;

  /* XP economy */
  xpPerCheckbox: number;
  bonusFor50pct: number;
  bonusFor75pct: number;
  bonusFor90pct: number;

  pomodoroFrontmatterKey: string;
  pomodoroThreshold: number;
  pomodoroBonus: number;

  habits: KuroHabit[];

  weeklyReviewKey: string;
  weeklyReviewXp: number;
  weeklyPlanningKey: string;
  weeklyPlanningXp: number;

  /* Streak */
  streakQualifyThreshold: number;
  streakFreezeTokensPerMonth: number;
  streakBonus: KuroStreakBonusTier[];

  /* Levels & loot */
  levels: KuroLevel[];
  tierByLevel: Record<number, KuroLootTier>;
  customLootPool: Partial<Record<KuroLootTier, KuroLootDrop[]>> | null;
  customLore: KuroLoreFragment[] | null;
  /** Installed packs (library). Content lives here; customLore/customLootPool are the applied cache. */
  packLibrary: InstalledPack[];
  /** Id of the pack whose lore is active, or null = factory default. */
  activeLorePackId: string | null;
  /** Id of the pack whose loot is active, or null = factory default. */
  activeLootPackId: string | null;
  lootOptionsCount: number;

  /* UI */
  language: Lang;
  statusVerbose: boolean;
  reduceAnimations: boolean;
  logLevel: LogLevel;
  /** Collapsed state per settings section key (persisted). */
  uiCollapsed: Record<string, boolean>;

  /* Companion-Chat — off-by-default, gedacht für lokale Endpunkte */
  enableChat: boolean;
  chatEndpoint: string;
  chatApiKey: string;
  chatModel: string;
  chatSuppressThinking: boolean;
  chatDailyContext: ChatDailyContext;
  chatPersonaOverride: string;
}

export interface KuroPluginData {
  schemaVersion: number;
  /** True once the first-run welcome modal has been shown (or for pre-v2 upgraders). */
  onboardingShown: boolean;
  redeemedDrops: KuroDropEntry[];
  freezeTokens: number;
  /** YYYY-MM the freeze tokens were last regenerated. */
  freezeTokensLastRegen: string;
  manualXpAdjustments: KuroXpAdjustment[];
  unlockedLore: number[];
  /** Last-rendered status snapshot — used to render before vault scan completes. */
  lastSnapshot: KuroSnapshot | null;
  /** Merkzettel: kurze Sätze, die Kuro dauerhaft im Chat-Kontext hat. */
  kuroNotes: string[];
  settings: KuroSettings;
}

export interface KuroSnapshot {
  computedAt: string;          // ISO
  totalXp: number;
  currentLevel: KuroLevel;
  nextLevel: KuroLevel | null;
  xpToNext: number;
  pctToNext: number;
  streak: number;
  streakBonus: number;
  freezeTokens: number;
  todayXp: number;
  todayDone: number;
  todayTotal: number;
  todayPct: number;
  availableDrops: number;
  redeemedDrops: number;
  lootOptions: KuroLootDrop[] | null;
  lootTier: KuroLootTier | null;
  loreFragment: KuroLoreFragment | null;
  /** Verbose breakdown for transparency (optional). */
  breakdown: KuroXpBreakdownRow[];
}

export interface KuroXpBreakdownRow {
  source: string;     // e.g. "Daily 2026-04-23 — Checkboxen"
  amount: number;
  reason: string;     // human-readable e.g. "5 ✓ × 2 XP"
}

/* ──────────────────────────────────────────────────────────
   DEFAULTS
   ────────────────────────────────────────────────────────── */

import { DEFAULT_LEVELS, DEFAULT_TIER_BY_LEVEL } from './data/default-levels';

export const DEFAULT_STREAK_BONUS: KuroStreakBonusTier[] = [
  { from: 3, xpPerDay: 5 },
  { from: 7, xpPerDay: 10 },
  { from: 14, xpPerDay: 15 },
  { from: 30, xpPerDay: 20 },
];

export const DEFAULT_SETTINGS: KuroSettings = {
  dailyFolder: '',   // seeded from the core "Daily notes" plugin on first load; else user sets it
  weeklyFolder: '',
  dailyDateFormat: 'YYYY-MM-DD',
  weeklyDateFormat: 'YYYY-[W]WW',

  enableXpFromCheckboxes: true,
  enableXpFromHabits: true,
  enableXpFromWeekly: true,
  enableStreaks: true,
  enableLoot: true,
  enableLore: true,
  enableSidebar: true,
  openSidebarOnStartup: false,   // off-by-default: don't impose auto-open
  enableStatusBar: false,   // off-by-default
  enableNotices: true,

  xpPerCheckbox: 2,
  bonusFor50pct: 10,
  bonusFor75pct: 20,
  bonusFor90pct: 30,

  pomodoroFrontmatterKey: 'pomodoros',
  pomodoroThreshold: 4,
  pomodoroBonus: 10,

  habits: [],   // user-defined; see README for examples

  weeklyReviewKey: 'review_done',
  weeklyReviewXp: 50,
  weeklyPlanningKey: 'planning_done',
  weeklyPlanningXp: 30,

  streakQualifyThreshold: 0.5,
  streakFreezeTokensPerMonth: 2,
  streakBonus: DEFAULT_STREAK_BONUS,

  levels: DEFAULT_LEVELS,
  tierByLevel: DEFAULT_TIER_BY_LEVEL,
  customLootPool: null,
  customLore: null,
  packLibrary: [],
  activeLorePackId: null,
  activeLootPackId: null,
  lootOptionsCount: 3,

  language: 'en',   // neutral default; seeded from Obsidian's UI language on first load
  statusVerbose: false,
  reduceAnimations: false,
  logLevel: 'error',
  uiCollapsed: {},

  enableChat: false,
  chatEndpoint: '',
  chatApiKey: '',
  chatModel: '',
  chatSuppressThinking: true,
  chatDailyContext: 'tasks',
  chatPersonaOverride: '',
};

export const DEFAULT_PLUGIN_DATA: KuroPluginData = {
  schemaVersion: 2,
  onboardingShown: false,
  redeemedDrops: [],
  freezeTokens: 2,
  freezeTokensLastRegen: '',
  manualXpAdjustments: [],
  unlockedLore: [],
  lastSnapshot: null,
  kuroNotes: [],
  settings: DEFAULT_SETTINGS,
};
