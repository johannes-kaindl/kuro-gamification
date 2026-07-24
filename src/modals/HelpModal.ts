/* ==========================================================
   HelpModal — bundled in-plugin getting-started. Self-contained
   (no vault files, no network) so it works in any vault. Opened
   from Settings → About.
   ========================================================== */
import { Modal, type App } from 'obsidian';
import type KuroPlugin from '../main';
import { t } from '../i18n';

export class HelpModal extends Modal {
  constructor(app: App, private readonly plugin: KuroPlugin) { super(app); }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.help.title', lang));
    const c = this.contentEl;
    c.empty();
    c.createEl('p', { text: t('modal.help.intro', lang) });

    const ul = c.createEl('ul');
    for (const key of [
      'modal.help.step.folder',
      'modal.help.step.xp',
      'modal.help.step.loot',
      'modal.help.step.pack',
      'modal.help.step.sidebar',
    ]) {
      ul.createEl('li', { text: t(key, lang) });
    }

    const footer = c.createDiv({ cls: 'kuro-modal-footer' });
    const settingsBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.welcome.openSettings', lang) });
    settingsBtn.addEventListener('click', () => {
      this.plugin.openOwnSettings();
      this.close();
    });
    footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.help.close', lang) })
      .addEventListener('click', () => this.close());
  }

  onClose(): void { this.contentEl.empty(); }
}
