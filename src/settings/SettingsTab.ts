/* ==========================================================
   KuroSettingsTab — Settings UI organized by section.
   Every escalating feature is individually toggleable.
   ========================================================== */
import { type App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type KuroPlugin from '../main';
import { DEFAULT_SETTINGS } from '../types';
import { clampInt } from '../vendor/kit/num';
import type { Lang, LogLevel } from '../types';
import { t } from '../i18n';
import { ExportDataModal, ImportDataModal } from '../modals/DataIoModal';
import { ImportPackModal } from '../modals/PackIoModal';
import { ResetDataModal } from '../modals/ResetDataModal';
import { WelcomeModal } from '../modals/WelcomeModal';
import { HelpModal } from '../modals/HelpModal';
import { confirmModal } from '../modals/ConfirmModal';
import { FolderSuggest } from '../vendor/kit/folder-suggest';
import { collapsibleSection, type CollapsibleStorage } from '../vendor/kit-obsidian/collapsible';
import { buildUnitPack, resetUnit, type PackUnit } from '../utils/packSections';
import { activeNames, activatePack, canActivatePack, deletePack, resetSection } from '../utils/packLibrary';
import { downloadJson } from '../utils/fileIo';

export class KuroSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: KuroPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('kuro-settings');
    const lang = this.plugin.data.settings.language;

    this._renderGeneral(lang);
    this._renderPaths(lang);
    this._renderXp(lang);
    this._renderWeekly(lang);
    this._renderStreak(lang);
    this._renderCustomization(lang);
    this._renderPacks(lang);
    this._renderAdvanced(lang);
    this._renderAbout(lang);
  }

  /**
   * Renders a collapsible settings section and returns its body container.
   * `key` doubles as the i18n suffix (`settings.section.<key>`) and the
   * persisted collapse key, so every section behaves the same way.
   */
  private _section(key: string, lang: Lang): HTMLElement {
    return collapsibleSection(this.containerEl, {
      title: t(`settings.section.${key}`, lang),
      key,
      storage: this._collapseStore,
    });
  }

  private async _save(): Promise<void> {
    await this.plugin.persist();
    await this.plugin.refreshStatus(true);
  }

  private get _collapseStore(): CollapsibleStorage {
    const s = this.plugin.data.settings;
    return {
      getCollapsed: (k) => s.uiCollapsed[k],
      setCollapsed: (k, v) => { s.uiCollapsed[k] = v; void this.plugin.persist(); },
    };
  }

  /* ── §1 General ───────────────────────────────────────── */
  private _renderGeneral(lang: Lang): void {
    const el = this._section('general', lang);
    const s = this.plugin.data.settings;

    new Setting(el)
      .setName(t('set.lang.name', lang))
      .setDesc(t('set.lang.desc', lang))
      .addDropdown((dd) => {
        dd.addOption('de', 'Deutsch');
        dd.addOption('en', 'English');
        dd.setValue(s.language);
        dd.onChange(async (val) => {
          s.language = val as Lang;
          await this._save();
          this.display();
        });
      });

    new Setting(el)
      .setName(t('set.reduceAnim.name', lang))
      .setDesc(t('set.reduceAnim.desc', lang))
      .addToggle((tg) => tg.setValue(s.reduceAnimations).onChange(async (v) => {
        s.reduceAnimations = v;
        await this._save();
      }));

    new Setting(el)
      .setName(t('set.statusBar.name', lang))
      .setDesc(t('set.statusBar.desc', lang))
      .addToggle((tg) => tg.setValue(s.enableStatusBar).onChange(async (v) => {
        s.enableStatusBar = v;
        await this._save();
        this.plugin.refreshStatusBar();
      }));

    new Setting(el)
      .setName(t('set.notices.name', lang))
      .setDesc(t('set.notices.desc', lang))
      .addToggle((tg) => tg.setValue(s.enableNotices).onChange(async (v) => {
        s.enableNotices = v;
        await this._save();
      }));

    new Setting(el)
      .setName(t('set.statusVerbose.name', lang))
      .setDesc(t('set.statusVerbose.desc', lang))
      .addToggle((tg) => tg.setValue(s.statusVerbose).onChange(async (v) => {
        s.statusVerbose = v;
        await this._save();
      }));

    new Setting(el)
      .setName(t('set.sidebarEnabled.name', lang))
      .setDesc(t('set.sidebarEnabled.desc', lang))
      .addToggle((tg) => tg.setValue(s.enableSidebar).onChange(async (v) => {
        s.enableSidebar = v;
        await this._save();
        this.plugin.syncSidebar();
      }));

    new Setting(el)
      .setName(t('set.sidebarOnStartup.name', lang))
      .setDesc(t('set.sidebarOnStartup.desc', lang))
      .addToggle((tg) => tg.setValue(s.openSidebarOnStartup).onChange(async (v) => {
        s.openSidebarOnStartup = v;
        await this._save();
      }));
  }

  /* ── §2 Paths ─────────────────────────────────────────── */
  private _renderPaths(lang: Lang): void {
    const el = this._section('paths', lang);
    const s = this.plugin.data.settings;

    new Setting(el)
      .setName(t('set.dailyFolder.name', lang))
      .setDesc(t('set.dailyFolder.desc', lang))
      .addText((tx) => {
        new FolderSuggest(this.app, tx.inputEl);
        tx.setValue(s.dailyFolder).onChange(async (v) => {
          s.dailyFolder = v.trim();
          await this._save();
        });
      });

    new Setting(el)
      .setName(t('set.weeklyFolder.name', lang))
      .setDesc(t('set.weeklyFolder.desc', lang))
      .addText((tx) => {
        new FolderSuggest(this.app, tx.inputEl);
        tx.setValue(s.weeklyFolder).onChange(async (v) => {
          s.weeklyFolder = v.trim();
          await this._save();
        });
      });

    new Setting(el)
      .setName(t('set.dailyFormat.name', lang))
      .setDesc(t('set.dailyFormat.desc', lang))
      .addText((tx) => tx.setValue(s.dailyDateFormat).onChange(async (v) => {
        s.dailyDateFormat = v.trim();
        await this._save();
      }));

    new Setting(el)
      .setName(t('set.weeklyFormat.name', lang))
      .setDesc(t('set.weeklyFormat.desc', lang))
      .addText((tx) => tx.setValue(s.weeklyDateFormat).onChange(async (v) => {
        s.weeklyDateFormat = v.trim();
        await this._save();
      }));
  }

  /* ── §3 XP sources ────────────────────────────────────── */
  private _renderXp(lang: Lang): void {
    const el = this._section('xp', lang);
    const s = this.plugin.data.settings;

    new Setting(el)
      .setName(t('set.xpFromCheckboxes.name', lang))
      .setDesc(t('set.xpFromCheckboxes.desc', lang))
      .addToggle((tg) => tg.setValue(s.enableXpFromCheckboxes).onChange(async (v) => {
        s.enableXpFromCheckboxes = v; await this._save();
      }));

    new Setting(el)
      .setName(t('set.xpPerCheckbox.name', lang))
      .addText((tx) => tx.setValue(String(s.xpPerCheckbox)).onChange(async (v) => {
        s.xpPerCheckbox = clampInt(v, 0, 100, DEFAULT_SETTINGS.xpPerCheckbox);
        await this._save();
      }));

    new Setting(el)
      .setName(t('set.bonus50.name', lang))
      .addText((tx) => tx.setValue(String(s.bonusFor50pct)).onChange(async (v) => {
        s.bonusFor50pct = clampInt(v, 0, 999, DEFAULT_SETTINGS.bonusFor50pct);
        await this._save();
      }));
    new Setting(el)
      .setName(t('set.bonus75.name', lang))
      .addText((tx) => tx.setValue(String(s.bonusFor75pct)).onChange(async (v) => {
        s.bonusFor75pct = clampInt(v, 0, 999, DEFAULT_SETTINGS.bonusFor75pct);
        await this._save();
      }));
    new Setting(el)
      .setName(t('set.bonus90.name', lang))
      .addText((tx) => tx.setValue(String(s.bonusFor90pct)).onChange(async (v) => {
        s.bonusFor90pct = clampInt(v, 0, 999, DEFAULT_SETTINGS.bonusFor90pct);
        await this._save();
      }));

    new Setting(el)
      .setName(t('set.pomoKey.name', lang))
      .addText((tx) => tx.setValue(s.pomodoroFrontmatterKey).onChange(async (v) => {
        s.pomodoroFrontmatterKey = v.trim() || DEFAULT_SETTINGS.pomodoroFrontmatterKey;
        await this._save();
      }));
    new Setting(el)
      .setName(t('set.pomoThreshold.name', lang))
      .addText((tx) => tx.setValue(String(s.pomodoroThreshold)).onChange(async (v) => {
        s.pomodoroThreshold = clampInt(v, 1, 99, DEFAULT_SETTINGS.pomodoroThreshold);
        await this._save();
      }));
    new Setting(el)
      .setName(t('set.pomoBonus.name', lang))
      .addText((tx) => tx.setValue(String(s.pomodoroBonus)).onChange(async (v) => {
        s.pomodoroBonus = clampInt(v, 0, 999, DEFAULT_SETTINGS.pomodoroBonus);
        await this._save();
      }));
  }

  /* ── §5 Weekly ────────────────────────────────────────── */
  private _renderWeekly(lang: Lang): void {
    const el = this._section('weekly', lang);
    const s = this.plugin.data.settings;

    new Setting(el)
      .setName(t('set.xpFromWeekly.name', lang))
      .setDesc(t('set.xpFromWeekly.desc', lang))
      .addToggle((tg) => tg.setValue(s.enableXpFromWeekly).onChange(async (v) => {
        s.enableXpFromWeekly = v; await this._save();
      }));
    new Setting(el)
      .setName(t('set.weeklyReviewKey.name', lang))
      .addText((tx) => tx.setValue(s.weeklyReviewKey).onChange(async (v) => {
        s.weeklyReviewKey = v.trim() || DEFAULT_SETTINGS.weeklyReviewKey;
        await this._save();
      }));
    new Setting(el)
      .setName(t('set.weeklyReviewXp.name', lang))
      .addText((tx) => tx.setValue(String(s.weeklyReviewXp)).onChange(async (v) => {
        s.weeklyReviewXp = clampInt(v, 0, 999, DEFAULT_SETTINGS.weeklyReviewXp);
        await this._save();
      }));
    new Setting(el)
      .setName(t('set.weeklyPlanningKey.name', lang))
      .addText((tx) => tx.setValue(s.weeklyPlanningKey).onChange(async (v) => {
        s.weeklyPlanningKey = v.trim() || DEFAULT_SETTINGS.weeklyPlanningKey;
        await this._save();
      }));
    new Setting(el)
      .setName(t('set.weeklyPlanningXp.name', lang))
      .addText((tx) => tx.setValue(String(s.weeklyPlanningXp)).onChange(async (v) => {
        s.weeklyPlanningXp = clampInt(v, 0, 999, DEFAULT_SETTINGS.weeklyPlanningXp);
        await this._save();
      }));
  }

  /* ── §6 Streak ────────────────────────────────────────── */
  private _renderStreak(lang: Lang): void {
    const el = this._section('streak', lang);
    const s = this.plugin.data.settings;

    new Setting(el)
      .setName(t('set.streakEnabled.name', lang))
      .addToggle((tg) => tg.setValue(s.enableStreaks).onChange(async (v) => {
        s.enableStreaks = v; await this._save();
      }));

    new Setting(el)
      .setName(t('set.streakThreshold.name', lang))
      .setDesc(t('set.streakThreshold.desc', lang))
      .addText((tx) => tx.setValue(String(s.streakQualifyThreshold)).onChange(async (v) => {
        const n = Number.parseFloat(v);
        s.streakQualifyThreshold = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : DEFAULT_SETTINGS.streakQualifyThreshold;
        await this._save();
      }));

    new Setting(el)
      .setName(t('set.freezeTokens.name', lang))
      .setDesc(t('set.freezeTokens.desc', lang))
      .addText((tx) => tx.setValue(String(s.streakFreezeTokensPerMonth)).onChange(async (v) => {
        s.streakFreezeTokensPerMonth = clampInt(v, 0, 31, DEFAULT_SETTINGS.streakFreezeTokensPerMonth);
        await this._save();
      }));
  }

  /* ── §7 Customization: Lore/Loot/Habits ───────────────────
     Content settings only. Every pack action (import/export/copy/
     reset) lives once, centrally, in the Packs section — see
     `_renderPacks`. Scattering them here as well is what made the
     surface confusing (five sections carrying import/export buttons).
     ──────────────────────────────────────────────────────── */
  private _renderCustomization(lang: Lang): void {
    const s = this.plugin.data.settings;

    // ── Lore ──
    const lore = this._section('lore', lang);
    new Setting(lore)
      .setName(t('set.loreEnabled.name', lang))
      .addToggle((tg) => tg.setValue(s.enableLore).onChange(async (v) => { s.enableLore = v; await this._save(); }));

    // ── Loot ──
    const loot = this._section('loot', lang);
    new Setting(loot)
      .setName(t('set.lootEnabled.name', lang))
      .addToggle((tg) => tg.setValue(s.enableLoot).onChange(async (v) => { s.enableLoot = v; await this._save(); }));
    new Setting(loot)
      .setName(t('set.lootCount.name', lang))
      .addText((tx) => tx.setValue(String(s.lootOptionsCount)).onChange(async (v) => {
        s.lootOptionsCount = clampInt(v, 1, 9, DEFAULT_SETTINGS.lootOptionsCount);
        await this._save();
      }));

    // ── Habits ──
    const habits = this._section('habits', lang);
    new Setting(habits)
      .setName(t('set.xpFromHabits.name', lang))
      .setDesc(t('set.xpFromHabits.desc', lang))
      .addToggle((tg) => tg.setValue(s.enableXpFromHabits).onChange(async (v) => { s.enableXpFromHabits = v; await this._save(); }));
    this._renderHabitList(habits, lang);
  }

  private _renderHabitList(containerEl: HTMLElement, lang: Lang): void {
    const s = this.plugin.data.settings;
    s.habits.forEach((habit, idx) => {
      const setting = new Setting(containerEl);
      setting.controlEl.addClass('kuro-habit-row');
      setting
        .addText((tx) => tx.setPlaceholder(t('habit.key', lang)).setValue(habit.key).onChange(async (v) => { habit.key = v.trim(); await this._save(); }))
        .addText((tx) => tx.setPlaceholder(t('habit.label', lang)).setValue(habit.label).onChange(async (v) => { habit.label = v; await this._save(); }))
        .addText((tx) => tx.setPlaceholder(t('habit.xp', lang)).setValue(String(habit.xp)).onChange(async (v) => { habit.xp = clampInt(v, 0, 999, 0); await this._save(); }))
        .addExtraButton((b) => b.setIcon('trash').setTooltip(t('habit.delete', lang)).onClick(async () => { s.habits.splice(idx, 1); await this._save(); this.display(); }));
    });
    new Setting(containerEl)
      .addButton((b) => b.setButtonText(t('habit.add', lang)).onClick(async () => {
        s.habits.push({ key: 'newhabit', label: t('habit.defaultLabel', lang), xp: 10 });
        await this._save();
        this.display();
      }));
  }

  /**
   * One row per unit inside the Packs hub: export / copy / reset for that
   * unit. Import is NOT here — it is generic (auto-detects which sections a
   * pack carries) and exists exactly once, above the library.
   */
  private _unitActions(containerEl: HTMLElement, unit: PackUnit, lang: Lang): void {
    new Setting(containerEl)
      .setName(t(`settings.section.${unit}`, lang))
      .addButton((b) => b.setButtonText(t('pack.action.export', lang))
        .onClick(() => {
          const pack = buildUnitPack(unit, this.plugin.data.settings);
          downloadJson(containerEl.ownerDocument, `kuro-${unit}.kuro.json`, pack);
        }))
      .addButton((b) => b.setButtonText(t('pack.action.copy', lang))
        .onClick(async () => {
          const pack = buildUnitPack(unit, this.plugin.data.settings);
          try { await navigator.clipboard.writeText(JSON.stringify(pack, null, 2)); new Notice(t('modal.pack.export.copied', lang)); } catch { /* clipboard unavailable */ }
        }))
      .addButton((b) => b.setButtonText(t('pack.action.reset', lang)).setWarning()
        .onClick(() => { void this._resetUnitConfirmed(unit, lang); }));
  }

  /**
   * Reset one unit to factory. Confirms first (destructive, no undo — a
   * habits reset replaces the user's own list) and reports the outcome,
   * so the click is never a silent no-op.
   */
  private async _resetUnitConfirmed(unit: PackUnit, lang: Lang): Promise<void> {
    const label = t(`settings.section.${unit}`, lang);
    const ok = await confirmModal(this.app, {
      title: t('pack.reset.confirmTitle', lang, { unit: label }),
      body: t(`pack.reset.confirmBody.${unit}`, lang),
      confirmText: t('pack.action.reset', lang),
      cancelText: t('modal.pack.cancel', lang),
    });
    if (!ok) return;
    // Lore/Loot are pack-library backed: cache AND pointer must be cleared
    // together, or the Packs section keeps showing a stale "active" badge.
    // Habits has no pointer, so it stays on the plain cache reset.
    this.plugin.data.settings = unit === 'habits'
      ? resetUnit(this.plugin.data.settings, unit)
      : resetSection(this.plugin.data.settings, unit);
    await this._save();
    new Notice(t('pack.reset.done', lang, { unit: label }));
    this.display();
  }

  /* ── §7b Packs library: installed lore/loot packs ─────── */
  private _renderPacks(lang: Lang): void {
    const el = this._section('packs', lang);
    const s = this.plugin.data.settings;
    const names = activeNames(s, lang);

    el.createEl('p', { cls: 'kuro-packs-desc', text: t('set.packs.desc', lang) });
    el.createEl('p', { cls: 'kuro-packs-active', text: t('set.packs.activeHeading', lang, names) });

    new Setting(el)
      .setName(t('set.packs.import.name', lang))
      .setDesc(t('set.packs.import.desc', lang))
      .addButton((b) => b.setButtonText(t('pack.action.import', lang))
        .onClick(() => new ImportPackModal(this.app, this.plugin, () => this.display()).open()));

    if (s.packLibrary.length === 0) {
      el.createEl('p', { cls: 'kuro-packs-empty', text: t('set.packs.empty', lang) });
    }

    for (const pack of s.packLibrary) {
      const isLoreActive = s.activeLorePackId === pack.id;
      const isLootActive = s.activeLootPackId === pack.id;
      const badge = [isLoreActive ? 'lore' : null, isLootActive ? 'loot' : null].filter(Boolean).join(' + ');
      const label = badge ? `${pack.name} — ${t('set.packs.badge.active', lang)}: ${badge}` : pack.name;
      new Setting(el)
        .setName(label)
        .addButton((b) => b.setButtonText(t('set.packs.activate', lang))
          // Nothing left to activate → greyed out. The handler re-checks the
          // same predicate, so a stale DOM click can never apply a no-op.
          .setDisabled(!canActivatePack(s, pack))
          .onClick(async () => {
            if (!canActivatePack(this.plugin.data.settings, pack)) return;
            this.plugin.data.settings = activatePack(this.plugin.data.settings, pack.id);
            await this._save();
            if (this.plugin.data.settings.enableNotices) new Notice(t('notice.pack.activated', lang, { name: pack.name }));
            this.display();
          }))
        .addButton((b) => b.setButtonText(t('set.packs.delete', lang)).setWarning().onClick(async () => {
          const ok = await confirmModal(this.app, {
            title: t('modal.pack.delete.title', lang),
            body: t('modal.pack.delete.body', lang, { name: pack.name }),
            confirmText: t('modal.pack.delete.confirm', lang),
            cancelText: t('modal.pack.delete.cancel', lang),
          });
          if (!ok) return;
          this.plugin.data.settings = deletePack(this.plugin.data.settings, pack.id);
          await this._save();
          if (this.plugin.data.settings.enableNotices) new Notice(t('notice.pack.deleted', lang, { name: pack.name }));
          this.display();
        }));
    }

    // Per-unit row: export / copy / reset for each unit, in one regular grid.
    // Reset goes through the confirmed path (never a silent destructive click).
    el.createEl('p', { cls: 'kuro-packs-desc', text: t('set.packs.units.desc', lang) });
    for (const unit of ['lore', 'loot', 'habits'] as const) {
      this._unitActions(el, unit, lang);
    }
  }

  /* ── §8 Advanced ──────────────────────────────────────── */
  private _renderAdvanced(lang: Lang): void {
    const el = this._section('advanced', lang);
    const s = this.plugin.data.settings;

    new Setting(el)
      .setName(t('set.advanced.showWelcome', lang))
      .addButton((b) => b.setButtonText(t('set.advanced.showWelcomeBtn', lang))
        .onClick(() => new WelcomeModal(this.app, this.plugin).open()));

    new Setting(el)
      .setName(t('set.advanced.logLevel.name', lang))
      .addDropdown((dd) => {
        for (const lvl of ['off', 'error', 'info', 'debug'] as LogLevel[]) {
          dd.addOption(lvl, lvl);
        }
        dd.setValue(s.logLevel);
        dd.onChange(async (v) => { s.logLevel = v as LogLevel; await this._save(); });
      });

    // Spells out that this is the whole-state backup, so it doesn't read as
    // yet another pack import/export (the confusion the Packs hub resolves).
    el.createEl('p', { cls: 'kuro-packs-desc', text: t('set.advanced.dataScope', lang) });

    new Setting(el)
      .setName(t('set.advanced.export', lang))
      .addButton((b) => b.setButtonText(t('btn.export', lang)).onClick(() => new ExportDataModal(this.app, this.plugin).open()));

    new Setting(el)
      .setName(t('set.advanced.import', lang))
      .addButton((b) => b.setButtonText(t('btn.import', lang)).onClick(() => new ImportDataModal(this.app, this.plugin).open()));

    new Setting(el)
      .setName(t('set.advanced.reset', lang))
      .addButton((b) => b.setButtonText(t('btn.reset', lang)).setWarning().onClick(() => new ResetDataModal(this.app, this.plugin).open()));
  }

  /* ── §9 About ─────────────────────────────────────────── */
  private _renderAbout(lang: Lang): void {
    const el = this._section('about', lang);
    const v = this.plugin.manifest.version;
    new Setting(el)
      .setName(t('set.about.version', lang, { v }))
      .addButton((b) => b.setButtonText(t('set.about.docs', lang))
        .onClick(() => new HelpModal(this.app, this.plugin).open()));
  }
}
