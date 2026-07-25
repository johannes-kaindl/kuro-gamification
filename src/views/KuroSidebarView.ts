/* ==========================================================
   KuroSidebarView — right-leaf ItemView with refresh button,
   redeem-loot button, and status snapshot rendering.
   ========================================================== */
import { ItemView, type WorkspaceLeaf, setIcon } from 'obsidian';
import type KuroPlugin from '../main';
import { KuroStatusRenderer } from './KuroStatusRenderer';
import { t } from '../i18n';

export const VIEW_TYPE_KURO = 'kuro-status-view';

export class KuroSidebarView extends ItemView {
  private contentEl_: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: KuroPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_KURO; }
  getDisplayText(): string { return t('sidebar.title', this.plugin.data.settings.language); }
  getIcon(): string { return 'terminal'; }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    const root = this.containerEl.createDiv({ cls: 'kuro-view-root' });

    /* toolbar */
    const toolbar = root.createDiv({ cls: 'kuro-toolbar' });
    const refreshBtn = toolbar.createEl('button', { cls: 'kuro-btn', attr: { 'aria-label': t('sidebar.refresh', this.plugin.data.settings.language) } });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.appendText(` ${t('sidebar.refresh', this.plugin.data.settings.language)}`);
    refreshBtn.addEventListener('click', () => { void this.plugin.refreshStatus(true); });

    const redeemBtn = toolbar.createEl('button', { cls: 'kuro-btn kuro-btn-primary' });
    setIcon(redeemBtn, 'gift');
    redeemBtn.appendText(` ${t('sidebar.redeem', this.plugin.data.settings.language)}`);
    redeemBtn.addEventListener('click', () => this.plugin.openRedeemModal());

    /* content body */
    this.contentEl_ = root.createDiv({ cls: 'kuro-view-body' });
    this.renderSnapshot();
  }

  async onClose(): Promise<void> {
    this.containerEl.empty();
    this.contentEl_ = null;
  }

  /** Re-render the body from the plugin's current snapshot. */
  renderSnapshot(): void {
    if (!this.contentEl_) return;
    const snap = this.plugin.data.lastSnapshot;
    if (!snap) {
      this.contentEl_.empty();
      const lang = this.plugin.data.settings.language;
      const empty = this.contentEl_.createDiv({ cls: 'kuro-empty' });
      empty.createEl('h3', { text: t('sidebar.empty.setup.title', lang) });
      const ul = empty.createEl('ul');
      ul.createEl('li', { text: t('sidebar.empty.setup.dailyFolder', lang, { path: this.plugin.data.settings.dailyFolder }) });
      ul.createEl('li', { text: t('sidebar.empty.setup.xp', lang) });
      ul.createEl('li', { text: t('sidebar.empty.setup.checkbox', lang) });
      const btn = empty.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('sidebar.empty.setup.openSettings', lang) });
      btn.addEventListener('click', () => this.plugin.openOwnSettings());
      return;
    }
    KuroStatusRenderer.render(this.contentEl_, snap, this.plugin.data.settings, {
      mode: 'full',
      showLoot: true,
      showLore: true,
      showBreakdown: this.plugin.data.settings.statusVerbose,
    });
  }
}
