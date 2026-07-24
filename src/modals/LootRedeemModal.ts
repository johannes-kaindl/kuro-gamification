/* ==========================================================
   LootRedeemModal — picks one of the deterministic 3 options
   and writes a KuroDropEntry to plugin data.
   ========================================================== */
import { Modal, type App, Notice, setIcon } from 'obsidian';
import type KuroPlugin from '../main';
import { TIER_EMOJI } from '../data/default-levels';
import { LootEngine } from '../engine/LootEngine';
import { t } from '../i18n';
import { todayIso } from '../utils/dateUtils';

export class LootRedeemModal extends Modal {
  private selectedIdx: number | null = null;

  constructor(app: App, private readonly plugin: KuroPlugin) {
    super(app);
  }

  onOpen(): void {
    const lang = this.plugin.data.settings.language;
    const snap = this.plugin.data.lastSnapshot;
    this.titleEl.setText(t('modal.redeem.title', lang));
    this.contentEl.empty();

    if (!snap || !snap.lootOptions || !snap.lootTier || snap.availableDrops <= 0) {
      this.contentEl.createEl('p', { text: t('sidebar.no-loot', lang) });
      const closeBtn = this.contentEl.createEl('button', { cls: 'kuro-btn', text: t('modal.redeem.cancel', lang) });
      closeBtn.addEventListener('click', () => this.close());
      return;
    }

    const lootTier = snap.lootTier;
    const intro = this.contentEl.createEl('p');
    intro.setText(t('modal.redeem.choose', lang));

    const list = this.contentEl.createDiv({ cls: 'kuro-loot-list' });
    snap.lootOptions.forEach((opt, i) => {
      const row = list.createDiv({ cls: 'kuro-loot-option' });
      const radio = row.createEl('input', {
        type: 'radio',
        attr: { name: 'kuro-loot-pick', value: String(i), id: `kuro-loot-${i}` },
      });
      radio.addEventListener('change', () => { this.selectedIdx = i; });
      const label = row.createEl('label', {
        attr: { for: `kuro-loot-${i}` },
        cls: 'kuro-loot-option-label',
      });
      label.createSpan({ cls: 'kuro-loot-emoji', text: TIER_EMOJI[lootTier] });
      label.createSpan({ cls: 'kuro-loot-name', text: ` ${opt.name} ` });
      label.createSpan({ cls: 'kuro-loot-cat', text: `[${opt.cat}]` });
    });

    const footer = this.contentEl.createDiv({ cls: 'kuro-modal-footer' });
    const cancelBtn = footer.createEl('button', { cls: 'kuro-btn', text: t('modal.redeem.cancel', lang) });
    cancelBtn.addEventListener('click', () => this.close());
    const okBtn = footer.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('modal.redeem.confirm', lang) });
    setIcon(okBtn, 'check');
    okBtn.appendText(` ${t('modal.redeem.confirm', lang)}`);
    okBtn.addEventListener('click', async () => {
      if (this.selectedIdx === null) return;
      await this.applyRedeem(this.selectedIdx);
      this.close();
    });
  }

  private async applyRedeem(idx: number): Promise<void> {
    const snap = this.plugin.data.lastSnapshot;
    const lang = this.plugin.data.settings.language;
    if (!snap || !snap.lootOptions || !snap.lootTier) return;
    const opt = snap.lootOptions[idx];
    if (!opt) return;
    this.plugin.data.redeemedDrops.push({
      date: todayIso(),
      level: snap.currentLevel.level,
      tier: snap.lootTier,
      name: opt.name,
      cat: opt.cat,
    });
    await this.plugin.persist();
    await this.plugin.refreshStatus(true);
    if (this.plugin.data.settings.enableNotices) {
      new Notice(t('modal.redeem.success', lang, { name: opt.name }));
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
