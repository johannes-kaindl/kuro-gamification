/* ==========================================================
   LoreRevealModal — shows a single lore fragment.
   Triggered manually (command) or auto on level-up.
   ========================================================== */
import { Modal, type App } from 'obsidian';
import type KuroPlugin from '../main';
import type { KuroLoreFragment } from '../types';
import { t } from '../i18n';

export class LoreRevealModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: KuroPlugin,
    private readonly fragment: KuroLoreFragment,
  ) {
    super(app);
  }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    this.titleEl.setText(t('modal.lore.title', lang));
    this.contentEl.empty();
    this.contentEl.addClass('kuro-lore-modal');

    const header = this.contentEl.createDiv({ cls: 'kuro-lore-header' });
    header.createEl('h2', {
      text: t('sidebar.lore.heading', lang, {
        n: String(this.fragment.level).padStart(2, '0'),
        title: this.fragment.title,
      }),
    });

    const body = this.contentEl.createDiv({ cls: 'kuro-lore-body' });
    for (const line of this.fragment.text.split('\n')) {
      body.createEl('p', { text: line });
    }

    const footer = this.contentEl.createDiv({ cls: 'kuro-modal-footer' });
    const closeBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.lore.close', lang) });
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
