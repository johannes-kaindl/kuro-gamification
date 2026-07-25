/* ==========================================================
   Kuro Gamification — main plugin entrypoint.
   ========================================================== */
import {
  Plugin, type WorkspaceLeaf, type TAbstractFile, TFile, debounce, Notice,
} from 'obsidian';

import {
  type KuroPluginData, type KuroSnapshot, DEFAULT_PLUGIN_DATA,
} from './types';
import { DataStore } from './persistence/DataStore';
import { VaultReader } from './persistence/VaultReader';
import { Logger } from './utils/logger';
import { XpEngine } from './engine/XpEngine';
import { StreakEngine } from './engine/StreakEngine';
import { LootEngine } from './engine/LootEngine';
import { LoreEngine } from './engine/LoreEngine';
import { KuroSidebarView, VIEW_TYPE_KURO } from './views/KuroSidebarView';
import { makeKuroCodeBlockProcessor } from './views/KuroStatusCodeBlockProcessor';
import { LootRedeemModal } from './modals/LootRedeemModal';
import { WelcomeModal } from './modals/WelcomeModal';
import { KuroSettingsTab } from './settings/SettingsTab';
import { registerCommands } from './commands/registerCommands';
import { readCoreDailyNotesConfig } from './utils/coreDailyNotes';
import { todayIso, isIsoDate, isIsoWeek } from './utils/dateUtils';
import { fmtNum } from './utils/progressBar';
import { t, detectLang } from './i18n';
import { defaultHabits } from './data/default-habits';

export default class KuroPlugin extends Plugin {
  // public so views/modals/settings can read/mutate
  public data: KuroPluginData = JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)) as KuroPluginData;
  public dataStore!: DataStore;
  public vaultReader!: VaultReader;
  public logger!: Logger;

  private statusBarEl: HTMLElement | null = null;
  private debouncedRefresh!: () => void;
  private debouncedSave!: () => void;
  private midnightTimeout: number | null = null;

  async onload(): Promise<void> {
    this.dataStore = new DataStore(this);
    this.logger = new Logger(() => this.data.settings.logLevel);
    this.vaultReader = new VaultReader(this.app, this.logger);

    this.data = await this.dataStore.load();

    // Must precede regenFreezeTokensIfNeeded(): on a fresh vault the regen
    // branch fires (lastRegen '' → current month) and calls debouncedSave().
    this.debouncedRefresh = debounce(() => this.refreshStatus(false), 800, true);
    this.debouncedSave = debounce(() => { void this.persist(); }, 500, true);

    this.regenFreezeTokensIfNeeded();
    await this.seedFreshInstallDefaults();

    this.registerView(VIEW_TYPE_KURO, (leaf) => new KuroSidebarView(leaf, this));
    this.registerMarkdownCodeBlockProcessor('kuro-status', makeKuroCodeBlockProcessor(this));
    this.registerEvent(this.app.vault.on('modify', (f) => this.onVaultChange(f)));
    this.registerEvent(this.app.vault.on('create', (f) => this.onVaultChange(f)));
    this.registerEvent(this.app.vault.on('delete', (f) => this.onVaultChange(f)));
    this.registerEvent(this.app.vault.on('rename', (f) => this.onVaultChange(f)));

    this.addRibbonIcon('terminal', t('plugin.name', this.data.settings.language), () => {
      void this.activateSidebar();
    });

    registerCommands(this);
    this.addSettingTab(new KuroSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      if (this.data.settings.openSidebarOnStartup) void this.activateSidebar();
      void this.refreshStatus(true);
      this.scheduleMidnightTick();
      if (!this.data.onboardingShown) new WelcomeModal(this.app, this).open();
    });

    this.refreshStatusBar();
    this.logger.info('plugin loaded');
  }

  /**
   * First-run only: adapt defaults to the host vault so a new user
   * doesn't inherit the author's setup. Adopts the Obsidian UI
   * language, and the folder/format from the core "Daily notes"
   * plugin (only while no daily folder is configured yet). Never
   * touches settings an existing install already has.
   */
  private async seedFreshInstallDefaults(): Promise<void> {
    if (this.data.onboardingShown) return; // existing installs keep their settings
    const s = this.data.settings;
    s.language = detectLang();
    if (s.habits.length === 0) s.habits = defaultHabits(s.language);
    if (s.dailyFolder === '') {
      const core = readCoreDailyNotesConfig(this.app);
      if (core?.folder) s.dailyFolder = core.folder;
      if (core?.format) s.dailyDateFormat = core.format;
    }
    await this.persist();
  }

  onunload(): void {
    if (this.midnightTimeout !== null) window.clearTimeout(this.midnightTimeout);
    if (this.statusBarEl) this.statusBarEl.detach();
    this.statusBarEl = null;
    this.logger.info('plugin unloaded');
  }

  /* ── Vault reactivity ─────────────────────────────────── */
  private onVaultChange(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (file.extension !== 'md') return;
    const s = this.data.settings;
    const inDaily = file.path.startsWith(`${s.dailyFolder}/`);
    const inWeekly = file.path.startsWith(`${s.weeklyFolder}/`);
    if (!inDaily && !inWeekly) return;
    if (inDaily && !isIsoDate(file.basename)) return;
    if (inWeekly && !isIsoWeek(file.basename)) return;
    this.debouncedRefresh();
  }

  /* ── Status compute ───────────────────────────────────── */
  async refreshStatus(force: boolean): Promise<void> {
    try {
      const today = new Date();
      const todayStr = todayIso(today);
      this.regenFreezeTokensIfNeeded();

      const opts = {
        dailyFolder: this.data.settings.dailyFolder,
        weeklyFolder: this.data.settings.weeklyFolder,
      };
      const dailies = await this.vaultReader.readDailies(opts);
      const weeklies = await this.vaultReader.readWeeklies(opts);

      // qualifying-day set for streak
      const qualifying = new Set<string>();
      for (const d of dailies) {
        if (d.stats.total > 0 && d.stats.pct >= this.data.settings.streakQualifyThreshold) {
          qualifying.add(d.date);
        }
      }
      const streakRes = StreakEngine.compute({
        qualifyingDates: qualifying,
        today,
        availableFreezeTokens: this.data.freezeTokens,
        settings: this.data.settings,
      });

      const agg = XpEngine.aggregate({
        dailies,
        weeklies,
        manualXp: this.data.manualXpAdjustments,
        streakBonus: streakRes.bonus,
        settings: this.data.settings,
      });

      const lvl = XpEngine.levelForXp(agg.totalXp, this.data.settings.levels);
      const todayDaily = dailies.find((d) => d.date === todayStr) ?? null;
      const todayCalc = todayDaily
        ? XpEngine.computeDaily(todayDaily, this.data.settings)
        : { date: todayStr, xp: 0, rows: [] };

      const lootPick = LootEngine.pickOptions(
        lvl.current.level,
        this.data.redeemedDrops.length,
        this.data.settings,
      );
      const fragment = LoreEngine.fragmentForLevel(lvl.current.level, this.data.settings);

      const snap: KuroSnapshot = {
        computedAt: new Date().toISOString(),
        totalXp: agg.totalXp,
        currentLevel: lvl.current,
        nextLevel: lvl.next,
        xpToNext: lvl.xpToNext,
        pctToNext: lvl.pctToNext,
        streak: streakRes.streak,
        streakBonus: streakRes.bonus,
        freezeTokens: this.data.freezeTokens,
        todayXp: todayCalc.xp,
        todayDone: todayDaily?.stats.done ?? 0,
        todayTotal: todayDaily?.stats.total ?? 0,
        todayPct: todayDaily?.stats.pct ?? 0,
        availableDrops: LootEngine.availableDrops(lvl.current.level, this.data.redeemedDrops.length),
        redeemedDrops: this.data.redeemedDrops.length,
        lootOptions: lootPick?.options ?? null,
        lootTier: lootPick?.tier ?? null,
        loreFragment: fragment,
        breakdown: agg.rows,
      };

      // unlock lore tracking — saved synchronously to avoid debounce coalescing loss
      if (fragment && !this.data.unlockedLore.includes(fragment.level)) {
        this.data.unlockedLore.push(fragment.level);
        await this.persist();
      }

      this.data.lastSnapshot = snap;
      this.debouncedSave();
      this.syncSidebarSnapshot();
      this.refreshStatusBar();

      if (force) this.logger.info('status recomputed', {
        totalXp: agg.totalXp, level: lvl.current.level, streak: streakRes.streak,
      });
    } catch (err) {
      this.logger.error('refreshStatus failed', err);
    }
  }

  private syncSidebarSnapshot(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KURO)) {
      if (leaf.view instanceof KuroSidebarView) leaf.view.renderSnapshot();
    }
  }

  /* ── Sidebar lifecycle ────────────────────────────────── */
  async activateSidebar(): Promise<void> {
    if (!this.data.settings.enableSidebar) return;
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_KURO)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) await leaf.setViewState({ type: VIEW_TYPE_KURO, active: true });
    }
    if (leaf) await workspace.revealLeaf(leaf);
  }

  syncSidebar(): void {
    if (this.data.settings.enableSidebar) {
      void this.activateSidebar();
    } else {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KURO)) leaf.detach();
    }
  }

  /* ── Modals ───────────────────────────────────────────── */
  openRedeemModal(): void {
    new LootRedeemModal(this.app, this).open();
  }

  /** Open this plugin's own settings tab. */
  openOwnSettings(): void {
    const setting = (this.app as unknown as {
      setting?: { open(): void; openTabById(id: string): void };
    }).setting;
    setting?.open();
    setting?.openTabById(this.manifest.id);
  }

  /* ── Persistence ──────────────────────────────────────── */
  async persist(): Promise<void> {
    try {
      await this.dataStore.save(this.data);
    } catch (err) {
      this.logger.error('persist failed', err);
      if (this.data.settings.enableNotices) {
        new Notice(t('notice.saveFailed', this.data.settings.language));
      }
    }
  }

  /* ── Status-bar element ───────────────────────────────── */
  refreshStatusBar(): void {
    if (!this.data.settings.enableStatusBar) {
      if (this.statusBarEl) {
        this.statusBarEl.detach();
        this.statusBarEl = null;
      }
      return;
    }
    if (!this.statusBarEl) {
      this.statusBarEl = this.addStatusBarItem();
      this.statusBarEl.addClass('kuro-status-bar-item');
      // registerDomEvent auto-cleans on plugin unload — no listener leak on toggle
      this.registerDomEvent(this.statusBarEl, 'click', () => this.activateSidebar());
    }
    const snap = this.data.lastSnapshot;
    if (snap) {
      this.statusBarEl.setText(`Lvl ${snap.currentLevel.level} · ${fmtNum(snap.totalXp)} XP`);
    } else {
      this.statusBarEl.setText('Kuro: …');
    }
  }

  /* ── Mid-night refresh ────────────────────────────────── */
  private scheduleMidnightTick(): void {
    if (this.midnightTimeout !== null) window.clearTimeout(this.midnightTimeout);
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 5, 0); // 5 sec past midnight, next day
    const ms = next.getTime() - now.getTime();
    this.midnightTimeout = window.setTimeout(() => {
      this.regenFreezeTokensIfNeeded();
      void this.refreshStatus(true);
      this.scheduleMidnightTick();
    }, ms);
  }

  private regenFreezeTokensIfNeeded(): void {
    const r = StreakEngine.regenFreezeTokens(
      this.data.freezeTokens,
      this.data.freezeTokensLastRegen,
      new Date(),
      this.data.settings,
    );
    if (r.tokens !== this.data.freezeTokens || r.lastRegen !== this.data.freezeTokensLastRegen) {
      this.data.freezeTokens = r.tokens;
      this.data.freezeTokensLastRegen = r.lastRegen;
      this.debouncedSave();
    }
  }
}
