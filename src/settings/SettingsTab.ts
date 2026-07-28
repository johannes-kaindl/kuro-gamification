/* ==========================================================
   KuroSettingsTab — Settings UI organized by section.
   Every escalating feature is individually toggleable.

   Dual-mode (Obsidian guideline: getSettingDefinitions() next to a
   display() fallback, no minAppVersion bump — see AGENTS.md "Store-Gate").
   getSettingDefinitions() is the single source of truth (one array of
   groups); display() walks the SAME array with the classic Setting API
   for Obsidian < 1.13, which never calls getSettingDefinitions(). On
   ≥ 1.13 the framework renders declaratively and display() is never
   invoked — its rendering there is flat (no collapsible sections); the
   collapsible/collapsed-by-default UX (deliberate overload-reduction for
   the plugin's neurodivergent audience) is therefore < 1.13-only, a known,
   accepted trade-off against search-discoverability on newer Obsidian.
   ========================================================== */
import {
  type App, PluginSettingTab, Setting, Notice,
  type SettingDefinitionItem, type SettingDefinitionGroup, type SettingControl,
} from 'obsidian';
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
import { confirmAction } from '../vendor/kit-obsidian/confirm';
import { FolderSuggest } from '../vendor/kit-obsidian/folder-suggest';
import { collapsibleSection, type CollapsibleStorage } from '../vendor/kit-obsidian/collapsible';
import { buildUnitPack, resetUnit, type PackUnit } from '../utils/packSections';
import { activeNames, activatePack, canActivatePack, deletePack, resetSection } from '../utils/packLibrary';
import { downloadJson } from '../utils/fileIo';

/** A declarative group, tagged with the section key it was built from —
 *  `_section()` needs the key (i18n + persisted collapse state), which the
 *  Obsidian type itself has no field for. Kept out of the returned
 *  `SettingDefinitionItem[]` structurally (extra properties on a typed
 *  variable, not a literal, so no excess-property error), read back only by
 *  `display()`'s own iteration over `_groups()`. */
type KuroGroup = SettingDefinitionGroup & { key: string };

export class KuroSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: KuroPlugin) {
    super(app, plugin);
  }

  /* ── Declarative settings API (Obsidian ≥ 1.13) ────────── */

  getSettingDefinitions(): SettingDefinitionItem[] {
    return this._groups(this.plugin.data.settings.language);
  }

  getControlValue(key: string): unknown {
    const s = this.plugin.data.settings;
    return (s as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.data.settings;
    switch (key) {
      case 'language':
        s.language = value as Lang;
        await this._save();
        this._refreshUi();
        return;
      case 'reduceAnimations': s.reduceAnimations = Boolean(value); break;
      case 'enableStatusBar':
        s.enableStatusBar = Boolean(value);
        await this._save();
        this.plugin.refreshStatusBar();
        return;
      case 'enableNotices': s.enableNotices = Boolean(value); break;
      case 'statusVerbose': s.statusVerbose = Boolean(value); break;
      case 'enableSidebar':
        s.enableSidebar = Boolean(value);
        await this._save();
        this.plugin.syncSidebar();
        return;
      case 'openSidebarOnStartup': s.openSidebarOnStartup = Boolean(value); break;

      case 'dailyFolder': s.dailyFolder = String(value).trim(); break;
      case 'weeklyFolder': s.weeklyFolder = String(value).trim(); break;
      case 'dailyDateFormat': s.dailyDateFormat = String(value).trim(); break;
      case 'weeklyDateFormat': s.weeklyDateFormat = String(value).trim(); break;

      case 'enableXpFromCheckboxes': s.enableXpFromCheckboxes = Boolean(value); break;
      case 'xpPerCheckbox': s.xpPerCheckbox = clampInt(String(value), 0, 100, DEFAULT_SETTINGS.xpPerCheckbox); break;
      case 'bonusFor50pct': s.bonusFor50pct = clampInt(String(value), 0, 999, DEFAULT_SETTINGS.bonusFor50pct); break;
      case 'bonusFor75pct': s.bonusFor75pct = clampInt(String(value), 0, 999, DEFAULT_SETTINGS.bonusFor75pct); break;
      case 'bonusFor90pct': s.bonusFor90pct = clampInt(String(value), 0, 999, DEFAULT_SETTINGS.bonusFor90pct); break;
      case 'pomodoroFrontmatterKey': s.pomodoroFrontmatterKey = String(value).trim() || DEFAULT_SETTINGS.pomodoroFrontmatterKey; break;
      case 'pomodoroThreshold': s.pomodoroThreshold = clampInt(String(value), 1, 99, DEFAULT_SETTINGS.pomodoroThreshold); break;
      case 'pomodoroBonus': s.pomodoroBonus = clampInt(String(value), 0, 999, DEFAULT_SETTINGS.pomodoroBonus); break;

      case 'enableXpFromWeekly': s.enableXpFromWeekly = Boolean(value); break;
      case 'weeklyReviewKey': s.weeklyReviewKey = String(value).trim() || DEFAULT_SETTINGS.weeklyReviewKey; break;
      case 'weeklyReviewXp': s.weeklyReviewXp = clampInt(String(value), 0, 999, DEFAULT_SETTINGS.weeklyReviewXp); break;
      case 'weeklyPlanningKey': s.weeklyPlanningKey = String(value).trim() || DEFAULT_SETTINGS.weeklyPlanningKey; break;
      case 'weeklyPlanningXp': s.weeklyPlanningXp = clampInt(String(value), 0, 999, DEFAULT_SETTINGS.weeklyPlanningXp); break;

      case 'enableStreaks': s.enableStreaks = Boolean(value); break;
      case 'streakQualifyThreshold': {
        const n = Number.parseFloat(String(value));
        s.streakQualifyThreshold = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : DEFAULT_SETTINGS.streakQualifyThreshold;
        break;
      }
      case 'streakFreezeTokensPerMonth': s.streakFreezeTokensPerMonth = clampInt(String(value), 0, 31, DEFAULT_SETTINGS.streakFreezeTokensPerMonth); break;

      case 'enableLore': s.enableLore = Boolean(value); break;

      case 'enableLoot': s.enableLoot = Boolean(value); break;
      case 'lootOptionsCount': s.lootOptionsCount = clampInt(String(value), 1, 9, DEFAULT_SETTINGS.lootOptionsCount); break;

      case 'enableXpFromHabits': s.enableXpFromHabits = Boolean(value); break;

      case 'logLevel': s.logLevel = value as LogLevel; break;

      default: return;
    }
    await this._save();
  }

  /* ── Imperative fallback (Obsidian < 1.13, which never calls
     getSettingDefinitions()) — walks the SAME group array, rendering each
     group into a collapsible section (unlike the native ≥ 1.13 renderer,
     which has no notion of our collapse behavior). ─────────────────── */

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('kuro-settings');
    const lang = this.plugin.data.settings.language;
    for (const group of this._groups(lang)) {
      const el = this._section(group.key, lang);
      for (const item of group.items ?? []) this._renderItem(el, item);
    }
  }

  private _renderItem(containerEl: HTMLElement, item: SettingDefinitionItem): void {
    const def = item as unknown as {
      name?: string; desc?: string;
      render?: (s: Setting) => void;
      control?: SettingControl;
    };
    const setting = new Setting(containerEl);
    if (def.name) setting.setName(def.name);
    if (def.desc) setting.setDesc(def.desc);
    if (typeof def.render === 'function') { def.render(setting); return; }
    if (def.control) this._renderControl(setting, def.control);
  }

  private _renderControl(setting: Setting, c: SettingControl): void {
    const key = c.key;
    const cur = this.getControlValue(key) as string | number | boolean | undefined;
    const save = (v: unknown): void => { void this.setControlValue(key, v); };
    switch (c.type) {
      case 'toggle':
        setting.addToggle((tg) => tg.setValue(Boolean(cur)).onChange(save));
        break;
      case 'dropdown':
        setting.addDropdown((dd) => {
          for (const [k, v] of Object.entries(c.options ?? {})) dd.addOption(k, v);
          dd.setValue(String(cur ?? '')).onChange(save);
        });
        break;
      case 'number':
        setting.addText((tx) => {
          tx.inputEl.type = 'number';
          tx.setValue(String(cur ?? ''));
          if (c.placeholder) tx.setPlaceholder(c.placeholder);
          tx.onChange(save);
        });
        break;
      case 'folder':
        setting.addText((tx) => {
          if (c.placeholder) tx.setPlaceholder(c.placeholder);
          tx.setValue(String(cur ?? '')).onChange(save);
          new FolderSuggest(this.app, tx.inputEl);
        });
        break;
      default:
        setting.addText((tx) => {
          if ('placeholder' in c && c.placeholder) tx.setPlaceholder(c.placeholder);
          tx.setValue(String(cur ?? '')).onChange(save);
        });
        break;
    }
  }

  /** Re-render the tab. ≥ 1.13 exposes `update()` on the declarative
   *  framework; the < 1.13 fallback has no such method, so re-run
   *  `display()`. The cast keeps `obsidianmd/no-unsupported-api` from
   *  flagging `update` (1.13-only). */
  private _refreshUi(): void {
    const self = this as unknown as { update?: () => void };
    if (typeof self.update === 'function') self.update();
    else this.display();
  }

  private async _save(): Promise<void> {
    await this.plugin.persist();
    await this.plugin.refreshStatus(true);
  }

  /**
   * Renders a collapsible settings section and returns its body container.
   * Only used by the < 1.13 imperative fallback — the native ≥ 1.13
   * renderer draws its own (non-collapsible) group headings.
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

  private get _collapseStore(): CollapsibleStorage {
    const s = this.plugin.data.settings;
    return {
      getCollapsed: (k) => s.uiCollapsed[k],
      setCollapsed: (k, v) => { s.uiCollapsed[k] = v; void this.plugin.persist(); },
    };
  }

  /* ── Group definitions — one per section, single source of truth for
     both the declarative (≥ 1.13) and imperative (< 1.13) render paths. */
  private _groups(lang: Lang): KuroGroup[] {
    return [
      this._generalGroup(lang),
      this._pathsGroup(lang),
      this._xpGroup(lang),
      this._weeklyGroup(lang),
      this._streakGroup(lang),
      this._loreGroup(lang),
      this._lootGroup(lang),
      this._habitsGroup(lang),
      this._packsGroup(lang),
      this._advancedGroup(lang),
      this._aboutGroup(lang),
    ];
  }

  private _heading(key: string, lang: Lang): string { return t(`settings.section.${key}`, lang); }

  /* ── §1 General ───────────────────────────────────────── */
  private _generalGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'general', heading: this._heading('general', lang),
      items: [
        { name: t('set.lang.name', lang), desc: t('set.lang.desc', lang),
          control: { type: 'dropdown', key: 'language', options: { de: 'Deutsch', en: 'English' } } },
        { name: t('set.reduceAnim.name', lang), desc: t('set.reduceAnim.desc', lang),
          control: { type: 'toggle', key: 'reduceAnimations' } },
        { name: t('set.statusBar.name', lang), desc: t('set.statusBar.desc', lang),
          control: { type: 'toggle', key: 'enableStatusBar' } },
        { name: t('set.notices.name', lang), desc: t('set.notices.desc', lang),
          control: { type: 'toggle', key: 'enableNotices' } },
        { name: t('set.statusVerbose.name', lang), desc: t('set.statusVerbose.desc', lang),
          control: { type: 'toggle', key: 'statusVerbose' } },
        { name: t('set.sidebarEnabled.name', lang), desc: t('set.sidebarEnabled.desc', lang),
          control: { type: 'toggle', key: 'enableSidebar' } },
        { name: t('set.sidebarOnStartup.name', lang), desc: t('set.sidebarOnStartup.desc', lang),
          control: { type: 'toggle', key: 'openSidebarOnStartup' } },
      ],
    };
  }

  /* ── §2 Paths ─────────────────────────────────────────── */
  private _pathsGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'paths', heading: this._heading('paths', lang),
      items: [
        { name: t('set.dailyFolder.name', lang), desc: t('set.dailyFolder.desc', lang),
          control: { type: 'folder', key: 'dailyFolder' } },
        { name: t('set.weeklyFolder.name', lang), desc: t('set.weeklyFolder.desc', lang),
          control: { type: 'folder', key: 'weeklyFolder' } },
        { name: t('set.dailyFormat.name', lang), desc: t('set.dailyFormat.desc', lang),
          control: { type: 'text', key: 'dailyDateFormat' } },
        { name: t('set.weeklyFormat.name', lang), desc: t('set.weeklyFormat.desc', lang),
          control: { type: 'text', key: 'weeklyDateFormat' } },
      ],
    };
  }

  /* ── §3 XP sources ────────────────────────────────────── */
  private _xpGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'xp', heading: this._heading('xp', lang),
      items: [
        { name: t('set.xpFromCheckboxes.name', lang), desc: t('set.xpFromCheckboxes.desc', lang),
          control: { type: 'toggle', key: 'enableXpFromCheckboxes' } },
        { name: t('set.xpPerCheckbox.name', lang), control: { type: 'number', key: 'xpPerCheckbox', min: 0, max: 100 } },
        { name: t('set.bonus50.name', lang), control: { type: 'number', key: 'bonusFor50pct', min: 0, max: 999 } },
        { name: t('set.bonus75.name', lang), control: { type: 'number', key: 'bonusFor75pct', min: 0, max: 999 } },
        { name: t('set.bonus90.name', lang), control: { type: 'number', key: 'bonusFor90pct', min: 0, max: 999 } },
        { name: t('set.pomoKey.name', lang), control: { type: 'text', key: 'pomodoroFrontmatterKey' } },
        { name: t('set.pomoThreshold.name', lang), control: { type: 'number', key: 'pomodoroThreshold', min: 1, max: 99 } },
        { name: t('set.pomoBonus.name', lang), control: { type: 'number', key: 'pomodoroBonus', min: 0, max: 999 } },
      ],
    };
  }

  /* ── §4 Weekly ────────────────────────────────────────── */
  private _weeklyGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'weekly', heading: this._heading('weekly', lang),
      items: [
        { name: t('set.xpFromWeekly.name', lang), desc: t('set.xpFromWeekly.desc', lang),
          control: { type: 'toggle', key: 'enableXpFromWeekly' } },
        { name: t('set.weeklyReviewKey.name', lang), control: { type: 'text', key: 'weeklyReviewKey' } },
        { name: t('set.weeklyReviewXp.name', lang), control: { type: 'number', key: 'weeklyReviewXp', min: 0, max: 999 } },
        { name: t('set.weeklyPlanningKey.name', lang), control: { type: 'text', key: 'weeklyPlanningKey' } },
        { name: t('set.weeklyPlanningXp.name', lang), control: { type: 'number', key: 'weeklyPlanningXp', min: 0, max: 999 } },
      ],
    };
  }

  /* ── §5 Streak ────────────────────────────────────────── */
  private _streakGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'streak', heading: this._heading('streak', lang),
      items: [
        { name: t('set.streakEnabled.name', lang), control: { type: 'toggle', key: 'enableStreaks' } },
        { name: t('set.streakThreshold.name', lang), desc: t('set.streakThreshold.desc', lang),
          control: { type: 'number', key: 'streakQualifyThreshold', min: 0, max: 1, step: 'any' } },
        { name: t('set.freezeTokens.name', lang), desc: t('set.freezeTokens.desc', lang),
          control: { type: 'number', key: 'streakFreezeTokensPerMonth', min: 0, max: 31 } },
      ],
    };
  }

  /* ── §6 Lore ──────────────────────────────────────────── */
  private _loreGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'lore', heading: this._heading('lore', lang),
      items: [
        { name: t('set.loreEnabled.name', lang), control: { type: 'toggle', key: 'enableLore' } },
      ],
    };
  }

  /* ── §6b Loot ─────────────────────────────────────────── */
  private _lootGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'loot', heading: this._heading('loot', lang),
      items: [
        { name: t('set.lootEnabled.name', lang), control: { type: 'toggle', key: 'enableLoot' } },
        { name: t('set.lootCount.name', lang), control: { type: 'number', key: 'lootOptionsCount', min: 1, max: 9 } },
      ],
    };
  }

  /* ── §7 Habits — the list itself is dynamic (add/remove rows), so it
     stays a single opaque render block rather than declarative controls;
     only the on/off toggle is a plain control. ─────────────────────── */
  private _habitsGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'habits', heading: this._heading('habits', lang),
      items: [
        { name: t('set.xpFromHabits.name', lang), desc: t('set.xpFromHabits.desc', lang),
          control: { type: 'toggle', key: 'enableXpFromHabits' } },
        { name: t('settings.section.habits', lang),
          render: (setting) => this._renderHabitList(this._hostFor(setting), lang) },
      ],
    };
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
        .addExtraButton((b) => b.setIcon('trash').setTooltip(t('habit.delete', lang)).onClick(async () => { s.habits.splice(idx, 1); await this._save(); this._refreshUi(); }));
    });
    new Setting(containerEl)
      .addButton((b) => b.setButtonText(t('habit.add', lang)).onClick(async () => {
        s.habits.push({ key: 'newhabit', label: t('habit.defaultLabel', lang), xp: 10 });
        await this._save();
        this._refreshUi();
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
    const ok = await confirmAction(this.app, {
      title: t('pack.reset.confirmTitle', lang, { unit: label }),
      message: t(`pack.reset.confirmBody.${unit}`, lang),
      confirmLabel: t('pack.action.reset', lang),
      cancelLabel: t('modal.pack.cancel', lang),
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
    this._refreshUi();
  }

  /* ── §8 Packs library: installed lore/loot packs — fully dynamic
     (variable-length library list + per-unit action rows), so it stays a
     single opaque render block. ────────────────────────────────────── */
  private _packsGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'packs', heading: this._heading('packs', lang),
      items: [
        { name: this._heading('packs', lang),
          render: (setting) => this._renderPacksBody(this._hostFor(setting), lang) },
      ],
    };
  }

  private _renderPacksBody(el: HTMLElement, lang: Lang): void {
    const s = this.plugin.data.settings;
    const names = activeNames(s, lang);

    el.createEl('p', { cls: 'kuro-packs-desc', text: t('set.packs.desc', lang) });
    el.createEl('p', { cls: 'kuro-packs-active', text: t('set.packs.activeHeading', lang, names) });

    new Setting(el)
      .setName(t('set.packs.import.name', lang))
      .setDesc(t('set.packs.import.desc', lang))
      .addButton((b) => b.setButtonText(t('pack.action.import', lang))
        .onClick(() => new ImportPackModal(this.app, this.plugin, () => this._refreshUi()).open()));

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
            this._refreshUi();
          }))
        .addButton((b) => b.setButtonText(t('set.packs.delete', lang)).setWarning().onClick(async () => {
          const ok = await confirmAction(this.app, {
            title: t('modal.pack.delete.title', lang),
            message: t('modal.pack.delete.body', lang, { name: pack.name }),
            confirmLabel: t('modal.pack.delete.confirm', lang),
            cancelLabel: t('modal.pack.delete.cancel', lang),
          });
          if (!ok) return;
          this.plugin.data.settings = deletePack(this.plugin.data.settings, pack.id);
          await this._save();
          if (this.plugin.data.settings.enableNotices) new Notice(t('notice.pack.deleted', lang, { name: pack.name }));
          this._refreshUi();
        }));
    }

    // Per-unit row: export / copy / reset for each unit, in one regular grid.
    // Reset goes through the confirmed path (never a silent destructive click).
    el.createEl('p', { cls: 'kuro-packs-desc', text: t('set.packs.units.desc', lang) });
    for (const unit of ['lore', 'loot', 'habits'] as const) {
      this._unitActions(el, unit, lang);
    }
  }

  /* ── §9 Advanced ──────────────────────────────────────── */
  private _advancedGroup(lang: Lang): KuroGroup {
    return {
      type: 'group', key: 'advanced', heading: this._heading('advanced', lang),
      items: [
        { name: t('set.advanced.showWelcome', lang),
          render: (setting) => { setting.addButton((b) => b.setButtonText(t('set.advanced.showWelcomeBtn', lang))
            .onClick(() => new WelcomeModal(this.app, this.plugin).open())); } },
        { name: t('set.advanced.logLevel.name', lang),
          control: { type: 'dropdown', key: 'logLevel', options: { off: 'off', error: 'error', info: 'info', debug: 'debug' } } },
        // Spells out that export/import/reset below are the whole-state backup, so they
        // don't read as yet another pack import/export (the confusion the Packs hub resolves).
        { name: '', render: (setting) => { this._hostFor(setting).createEl('p', { cls: 'kuro-packs-desc', text: t('set.advanced.dataScope', lang) }); } },
        { name: t('set.advanced.export', lang),
          render: (setting) => { setting.addButton((b) => b.setButtonText(t('btn.export', lang))
            .onClick(() => new ExportDataModal(this.app, this.plugin).open())); } },
        { name: t('set.advanced.import', lang),
          render: (setting) => { setting.addButton((b) => b.setButtonText(t('btn.import', lang))
            .onClick(() => new ImportDataModal(this.app, this.plugin).open())); } },
        { name: t('set.advanced.reset', lang),
          render: (setting) => { setting.addButton((b) => b.setButtonText(t('btn.reset', lang)).setWarning()
            .onClick(() => new ResetDataModal(this.app, this.plugin).open())); } },
      ],
    };
  }

  /* ── §10 About ────────────────────────────────────────── */
  private _aboutGroup(lang: Lang): KuroGroup {
    const v = this.plugin.manifest.version;
    return {
      type: 'group', key: 'about', heading: this._heading('about', lang),
      items: [
        { name: t('set.about.version', lang, { v }),
          render: (setting) => { setting.addButton((b) => b.setButtonText(t('set.about.docs', lang))
            .onClick(() => new HelpModal(this.app, this.plugin).open())); } },
      ],
    };
  }

  /** Makes the row Obsidian hands a `render` callback into a neutral block
   *  container: a render block that draws several rows (habit list, packs
   *  hub) must not end up nested inside the two-column `.setting-item` flex
   *  row. Empties settingEl — the item's own name/desc (already applied by
   *  `_renderItem` before calling `render`) is discarded along with it,
   *  which is fine here since these bodies draw their own headings/text. */
  private _hostFor(setting: Setting): HTMLElement {
    setting.settingEl.empty();
    setting.settingEl.removeClass('setting-item');
    setting.settingEl.addClass('kuro-settings-host');
    return setting.settingEl;
  }
}
