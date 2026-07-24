/* ==========================================================
   WelcomeModal — one-time first-run onboarding. Informational
   only; never enables any escalating feature (off-by-default).
   ========================================================== */
import { Modal, type App } from 'obsidian';
import type KuroPlugin from '../main';
import { t } from '../i18n';

export class WelcomeModal extends Modal {
  constructor(app: App, private readonly plugin: KuroPlugin) { super(app); }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.welcome.title', lang));
    const c = this.contentEl;
    c.empty();
    c.createEl('p', { text: t('modal.welcome.intro', lang) });
    const ul = c.createEl('ul');
    ul.createEl('li', { text: t('modal.welcome.step1', lang) });
    ul.createEl('li', { text: t('modal.welcome.step2', lang) });
    ul.createEl('li', { text: t('modal.welcome.step3', lang) });

    const footer = c.createDiv({ cls: 'kuro-modal-footer' });
    const settingsBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.welcome.openSettings', lang) });
    settingsBtn.addEventListener('click', () => {
      this.plugin.openOwnSettings();
      this.close();
    });
    footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.welcome.close', lang) })
      .addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.plugin.data.onboardingShown) {
      this.plugin.data.onboardingShown = true;
      void this.plugin.persist();
    }
  }
}
