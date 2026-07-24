/* ==========================================================
   DataIoModal — export/import plugin data via clipboard JSON.
   No filesystem access required.
   ========================================================== */
import { Modal, type App, Notice } from 'obsidian';
import type KuroPlugin from '../main';
import { t } from '../i18n';

export class ExportDataModal extends Modal {
  constructor(app: App, private readonly plugin: KuroPlugin) {
    super(app);
  }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.export.title', lang));
    this.contentEl.empty();
    const ta = this.contentEl.createEl('textarea', {
      cls: 'kuro-data-io',
      attr: { rows: '14', readonly: 'readonly', spellcheck: 'false' },
    });
    ta.value = JSON.stringify(this.plugin.data, null, 2);

    const footer = this.contentEl.createDiv({ cls: 'kuro-modal-footer' });
    const copyBtn = footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.export.copy', lang) });
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(ta.value);
        new Notice(t('modal.export.copied', lang));
      } catch {
        ta.select();
      }
    });
    const closeBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.lore.close', lang) });
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose(): void { this.contentEl.empty(); }
}

export class ImportDataModal extends Modal {
  constructor(app: App, private readonly plugin: KuroPlugin) {
    super(app);
  }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.import.title', lang));
    this.contentEl.empty();
    this.contentEl.createEl('p', { text: t('modal.import.paste', lang) });
    const ta = this.contentEl.createEl('textarea', {
      cls: 'kuro-data-io',
      attr: { rows: '14', spellcheck: 'false' },
    });

    const footer = this.contentEl.createDiv({ cls: 'kuro-modal-footer' });
    const cancelBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.redeem.cancel', lang) });
    cancelBtn.addEventListener('click', () => this.close());
    const okBtn = footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.import.apply', lang) });
    okBtn.addEventListener('click', async () => {
      try {
        const parsed = JSON.parse(ta.value);
        this.plugin.data = this.plugin.dataStore.merge(parsed);
        await this.plugin.persist();
        await this.plugin.refreshStatus(true);
        if (this.plugin.data.settings.enableNotices) {
          new Notice(t('modal.import.success', lang));
        }
        this.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        new Notice(t('modal.import.error', lang, { err: msg }));
      }
    });
  }

  onClose(): void { this.contentEl.empty(); }
}
