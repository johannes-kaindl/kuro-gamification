/* ==========================================================
   AdjustXpModal — manual XP override (positive or negative).
   Supports the autism-friendly "I see why this XP is here"
   transparency goal.
   ========================================================== */
import { Modal, type App, Notice } from 'obsidian';
import type KuroPlugin from '../main';
import { t } from '../i18n';
import { todayIso } from '../utils/dateUtils';

export class AdjustXpModal extends Modal {
  private amount = 0;
  private reason = '';

  constructor(app: App, private readonly plugin: KuroPlugin) {
    super(app);
  }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.adjust.title', lang));
    this.contentEl.empty();

    const wrap = this.contentEl.createDiv({ cls: 'kuro-form' });

    const amtRow = wrap.createDiv({ cls: 'kuro-form-row' });
    amtRow.createEl('label', { text: t('modal.adjust.amount', lang) });
    const amtInput = amtRow.createEl('input', {
      type: 'number',
      attr: { placeholder: '0', step: '1' },
    });
    amtInput.addEventListener('input', () => {
      const n = Number.parseInt(amtInput.value, 10);
      this.amount = Number.isFinite(n) ? n : 0;
    });

    const rsnRow = wrap.createDiv({ cls: 'kuro-form-row' });
    rsnRow.createEl('label', { text: t('modal.adjust.reason', lang) });
    const rsnInput = rsnRow.createEl('textarea', {
      attr: { rows: '3' },
    });
    rsnInput.addEventListener('input', () => { this.reason = rsnInput.value; });

    const footer = this.contentEl.createDiv({ cls: 'kuro-modal-footer' });
    const cancelBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.redeem.cancel', lang) });
    cancelBtn.addEventListener('click', () => this.close());
    const okBtn = footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.adjust.apply', lang) });
    okBtn.addEventListener('click', () => { void (async () => {
      if (this.amount === 0) return;
      this.plugin.data.manualXpAdjustments.push({
        date: todayIso(),
        amount: this.amount,
        reason: this.reason || '(keine Angabe)',
      });
      await this.plugin.persist();
      await this.plugin.refreshStatus(true);
      if (this.plugin.data.settings.enableNotices) {
        new Notice(t('modal.adjust.success', lang, { amount: (this.amount > 0 ? '+' : '') + this.amount }));
      }
      this.close();
    })(); });
  }

  onClose(): void { this.contentEl.empty(); }
}
