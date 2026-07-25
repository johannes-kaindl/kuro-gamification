/* ==========================================================
   PackIoModal — import/export a focused KuroPack (loot/lore).
   Separate from DataIoModal (full-state backup): this never
   touches XP/progress, only settings.customLootPool/customLore.
   ========================================================== */
import { Modal, type App, Notice } from 'obsidian';
import type KuroPlugin from '../main';
import { t } from '../i18n';
import { validatePack, type PackIssue } from '../engine/PackValidator';
import { importPack } from '../utils/packLibrary';
import { readJsonFile } from '../utils/fileIo';
import { detectUnits } from '../utils/packSections';
import { defaultLootPool } from '../data/default-loot-pool';
import { defaultLore, GOTHIC_LORE, COZY_LORE } from '../data/default-lore';
import type { KuroPack, Lang } from '../types';

export class ImportPackModal extends Modal {
  /**
   * @param onApplied Called after a successful import so an already-open
   *   Settings tab can re-render — without it a freshly imported pack only
   *   shows after a plugin reload. Absent for the command-palette invocation.
   */
  constructor(app: App, private readonly plugin: KuroPlugin, private readonly onApplied?: () => void) { super(app); }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.pack.import.title', lang));
    const c = this.contentEl;
    c.empty();
    c.createEl('p', { text: t('modal.pack.import.intro', lang) });

    const bar = c.createDiv({ cls: 'kuro-pack-templates' });
    const ta = c.createEl('textarea', { cls: 'kuro-data-io', attr: { rows: '14', spellcheck: 'false' } });
    const fileBtn = bar.createEl('button', { cls: 'kuro-btn', text: t('modal.pack.import.fromFile', lang) });
    fileBtn.addEventListener('click', () => { void (async () => {
      const text = await readJsonFile(this.contentEl.ownerDocument);
      if (text !== null) ta.value = text;
    })(); });

    const msg = c.createDiv({ cls: 'kuro-pack-msg' });

    const footer = c.createDiv({ cls: 'kuro-modal-footer' });
    footer.createEl('button', { cls: 'kuro-btn', text: t('modal.pack.cancel', lang) })
      .addEventListener('click', () => this.close());
    const apply = footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.pack.import.apply', lang) });
    apply.addEventListener('click', () => this._tryApply(ta.value, msg, false));
  }

  private _tryApply(text: string, msg: HTMLElement, force: boolean): void {
    const lang = this.plugin.data.settings.language;
    msg.empty();
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch (err) {
      msg.createEl('p', { cls: 'kuro-pack-error', text: t('modal.pack.import.parseError', lang, { err: String(err) }) });
      return;
    }
    const levels = this.plugin.data.settings.levels.map((l) => l.level);
    const res = validatePack(parsed, { loreLevels: levels });
    if (!res.ok) {
      msg.createEl('p', { cls: 'kuro-pack-error', text: t('modal.pack.import.errorsHeading', lang) });
      const ul = msg.createEl('ul');
      for (const e of res.errors) ul.createEl('li', { text: this._fmt(e, lang) });
      return;
    }
    if (res.warnings.length > 0 && !force) {
      msg.createEl('p', { cls: 'kuro-pack-warn', text: t('modal.pack.import.warningsHeading', lang) });
      const ul = msg.createEl('ul');
      for (const w of res.warnings) ul.createEl('li', { text: this._fmt(w, lang) });
      const anyway = msg.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.pack.import.applyAnyway', lang) });
      anyway.addEventListener('click', () => this._tryApply(text, msg, true));
      return;
    }
    void this._commit(res.pack);
  }

  private async _commit(pack: KuroPack): Promise<void> {
    const lang = this.plugin.data.settings.language;
    const id = crypto.randomUUID();
    const deps = { gothicLore: GOTHIC_LORE, cozyLore: COZY_LORE, lang };
    this.plugin.data.settings = importPack(this.plugin.data.settings, pack, id, deps);
    await this.plugin.persist();
    await this.plugin.refreshStatus(true);
    if (this.plugin.data.settings.enableNotices) {
      const units = detectUnits(pack).join(', ');
      new Notice(t('modal.pack.import.successUnits', lang, { units }));
    }
    this.onApplied?.();
    this.close();
  }

  private _fmt(issue: PackIssue, lang: Lang): string {
    const body = t(`pack.issue.${issue.code}`, lang, issue.vars ?? {});
    return issue.path ? `${issue.path}: ${body}` : body;
  }

  onClose(): void { this.contentEl.empty(); }
}

export class ExportPackModal extends Modal {
  constructor(app: App, private readonly plugin: KuroPlugin) { super(app); }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    const s = this.plugin.data.settings;
    this.titleEl.setText(t('modal.pack.export.title', lang));
    const c = this.contentEl;
    c.empty();
    c.createEl('p', { text: t('modal.pack.export.intro', lang) });

    const pack: KuroPack = {
      kuroPack: 1,
      name: 'My Kuro Pack',
      loot: s.customLootPool ?? defaultLootPool(s.language),
      lore: s.customLore ?? defaultLore(s.language),
      habits: s.habits,
    };
    const ta = c.createEl('textarea', { cls: 'kuro-data-io', attr: { rows: '14', readonly: 'readonly', spellcheck: 'false' } });
    ta.value = JSON.stringify(pack, null, 2);

    const footer = c.createDiv({ cls: 'kuro-modal-footer' });
    const copy = footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.pack.export.copy', lang) });
    copy.addEventListener('click', () => { void (async () => {
      try { await navigator.clipboard.writeText(ta.value); new Notice(t('modal.pack.export.copied', lang)); }
      catch { ta.select(); }
    })(); });
    footer.createEl('button', { cls: 'kuro-btn', text: t('modal.pack.close', lang) })
      .addEventListener('click', () => this.close());
  }

  onClose(): void { this.contentEl.empty(); }
}
