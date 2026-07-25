/* ==========================================================
   ResetDataModal — destructive operation, double-confirm.
   ========================================================== */
import { Modal, type App, Notice } from 'obsidian';
import type KuroPlugin from '../main';
import { DEFAULT_PLUGIN_DATA, type KuroPluginData } from '../types';
import { t } from '../i18n';

export class ResetDataModal extends Modal {
  private firstConfirmed = false;

  constructor(app: App, private readonly plugin: KuroPlugin) {
    super(app);
  }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.reset.title', lang));
    this.render();
  }

  private render(): void {
    const lang = this.plugin.data.settings.language;
    this.contentEl.empty();
    const body = this.contentEl.createEl('p');
    body.setText(t('modal.reset.body', lang, {
      drops: this.plugin.data.redeemedDrops.length,
      adj: this.plugin.data.manualXpAdjustments.length,
      lore: this.plugin.data.unlockedLore.length,
    }));

    const footer = this.contentEl.createDiv({ cls: 'kuro-modal-footer' });
    const cancelBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.redeem.cancel', lang) });
    cancelBtn.addEventListener('click', () => this.close());

    if (!this.firstConfirmed) {
      const okBtn = footer.createEl('button', { cls: 'kuro-btn kuro-btn-warning', text: t('modal.reset.confirm1', lang) });
      okBtn.addEventListener('click', () => {
        this.firstConfirmed = true;
        this.render();
      });
    } else {
      const okBtn = footer.createEl('button', { cls: 'kuro-btn kuro-btn-danger', text: t('modal.reset.confirm2', lang) });
      okBtn.addEventListener('click', () => { void (async () => {
        // copy DEFAULT_PLUGIN_DATA via JSON to avoid shared-array mutations
        const fresh = JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)) as KuroPluginData;
        this.plugin.data = fresh;
        await this.plugin.persist();
        await this.plugin.refreshStatus(true);
        if (this.plugin.data.settings.enableNotices) {
          new Notice(t('modal.reset.success', lang));
        }
        this.close();
      })(); });
    }
  }

  onClose(): void { this.contentEl.empty(); }
}
