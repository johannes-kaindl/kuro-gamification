/* ==========================================================
   DataStore — load/save with deep-merge against defaults.
   Forward-compatible: missing keys get default values.
   ========================================================== */
import type { Plugin } from 'obsidian';
import {
  DEFAULT_PLUGIN_DATA, DEFAULT_SETTINGS,
  type KuroPluginData, type KuroSettings,
} from '../types';
import { migrateToLibrary } from '../utils/packLibrary';
import { GOTHIC_LORE, COZY_LORE } from '../data/default-lore';

export class DataStore {
  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<KuroPluginData> {
    const raw = (await this.plugin.loadData()) as Partial<KuroPluginData> | null;
    return this.merge(raw ?? {});
  }

  async save(data: KuroPluginData): Promise<void> {
    await this.plugin.saveData(data);
  }

  /** Deep-merge user-stored data against defaults so new fields always exist. */
  merge(raw: Partial<KuroPluginData>): KuroPluginData {
    const merged: KuroPluginData = {
      ...DEFAULT_PLUGIN_DATA,
      ...raw,
      settings: this.mergeSettings(raw.settings ?? {}),
      redeemedDrops: Array.isArray(raw.redeemedDrops) ? raw.redeemedDrops : [],
      manualXpAdjustments: Array.isArray(raw.manualXpAdjustments) ? raw.manualXpAdjustments : [],
      unlockedLore: Array.isArray(raw.unlockedLore) ? raw.unlockedLore : [],
      lastSnapshot: raw.lastSnapshot ?? null,
    };
    return this.migrate(merged);
  }

  private mergeSettings(raw: Partial<KuroSettings>): KuroSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      habits: Array.isArray(raw.habits) ? raw.habits : DEFAULT_SETTINGS.habits,
      streakBonus: Array.isArray(raw.streakBonus) && raw.streakBonus.length > 0
        ? raw.streakBonus
        : DEFAULT_SETTINGS.streakBonus,
      levels: Array.isArray(raw.levels) && raw.levels.length > 0
        ? raw.levels
        : DEFAULT_SETTINGS.levels,
      tierByLevel: { ...DEFAULT_SETTINGS.tierByLevel, ...(raw.tierByLevel ?? {}) },
      packLibrary: Array.isArray(raw.packLibrary) ? raw.packLibrary : DEFAULT_SETTINGS.packLibrary,
    };
  }

  private migrate(d: KuroPluginData): KuroPluginData {
    // Pre-v2 installs predate onboarding — don't pop the welcome modal for existing users.
    if (d.schemaVersion < 2) {
      d.onboardingShown = true;
      d.schemaVersion = 2;
    }
    d.settings = migrateToLibrary(d.settings, {
      gothicLore: GOTHIC_LORE, cozyLore: COZY_LORE, lang: d.settings.language,
    });
    return d;
  }
}
