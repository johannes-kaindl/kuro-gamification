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
import { migrateChatEndpoints } from '../llm/migrateChatEndpoints';
import { fillMissingRowModels } from '../vendor/kit/endpoint_config';
import { loadRequestSettings } from '../llm/requestSettings';

export class DataStore {
  /** Pfade des gespeicherten `request`-Blocks, die das letzte `merge` verworfen hat — der
   *  Aufrufer (main.onload) meldet sie (Notice + Log), statt sie still zu schlucken. */
  lastRequestDropped: string[] = [];
  /** Das letzte `merge` hat ein altes globales `chatModel` auf die Zeilen verteilt — der Aufrufer speichert einmal. */
  lastLegacyModelMigrated = false;

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
      kuroNotes: Array.isArray(raw.kuroNotes) ? raw.kuroNotes : [],
      lastSnapshot: raw.lastSnapshot ?? null,
    };
    return this.migrate(merged);
  }

  private mergeSettings(raw: Partial<KuroSettings>): KuroSettings {
    // Sampling-Profile: `request` säubern und das alte `chatSuppressThinking` einmalig nach
    // `request.thinking.companion` migrieren — aus dem ROHEN Bestand; das Altfeld wird danach
    // nicht mehr durchgereicht (sonst schriebe saveData es als Leiche weiter).
    const { request, dropped } = loadRequestSettings(raw);
    this.lastRequestDropped = dropped;
    // `chatModel` (globales Modell, bis 1.9.0) wandert einmal auf jede Zeile ohne eigenes Modell und
    // wird hier aus `rest` herausgenommen: `...rest` hätte es sonst in jedes Speichern mitgetragen,
    // und die Migration füllte eine bewusst geleerte Zeile bei jedem Start wieder auf.
    const { chatSuppressThinking: _legacy, chatModel: legacyModel, ...rest } = raw as Partial<KuroSettings> & {
      chatSuppressThinking?: unknown; chatModel?: unknown;
    };
    this.lastLegacyModelMigrated = legacyModel !== undefined;
    return {
      ...DEFAULT_SETTINGS,
      ...rest,
      request,
      // chatEndpoint/chatApiKey sind Alt-Felder (vor dem Kit-endpoint_config-Umstieg) — im Typ
      // längst weg, aber in gespeicherten data.json-Dateien noch vorhanden. Ohne diese Migration
      // verschwindet ein bestehender API-Schlüssel beim ersten Laden stillschweigend
      // (migrateEndpointList allein trägt nur die URL weiter).
      chatEndpoints: fillMissingRowModels(migrateChatEndpoints(raw), legacyModel),
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
