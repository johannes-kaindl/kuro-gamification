/* ==========================================================
   KuroSidebarView — right-leaf ItemView mit Toolbar, Loot-Knopf
   und Status-Snapshot; optional mit Chat-Tab.

   Tab-Aufbau (load-bearing): Status- und Chat-Body existieren
   DAUERHAFT im DOM, der inaktive ist nur versteckt.
   renderSnapshot() leert deshalb ausschliesslich den Status-Body.
   Läge der Chat im selben Container, risse ihn der 800-ms-Refresh
   (vault.modify → refreshStatus) bei jedem Tastendruck in einer
   beliebigen Notiz weg — samt Verlauf und Eingabe-Entwurf.
   ========================================================== */
import { ItemView, type WorkspaceLeaf, setIcon } from 'obsidian';
import type KuroPlugin from '../main';
import { KuroStatusRenderer } from './KuroStatusRenderer';
import { t } from '../i18n';

export const VIEW_TYPE_KURO = 'kuro-status-view';

export type KuroTab = 'status' | 'chat';

export class KuroSidebarView extends ItemView {
  statusBodyEl: HTMLElement | null = null;
  chatBodyEl: HTMLElement | null = null;
  tabBarEl: HTMLElement | null = null;
  activeTab: KuroTab = 'status';

  private tabButtons: Record<KuroTab, HTMLElement> | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: KuroPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_KURO; }
  getDisplayText(): string { return t('sidebar.title', this.plugin.data.settings.language); }
  getIcon(): string { return 'terminal'; }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    const lang = this.plugin.data.settings.language;
    const chatOn = this.plugin.data.settings.enableChat;
    const root = this.containerEl.createDiv({ cls: 'kuro-view-root' });

    /* toolbar */
    const toolbar = root.createDiv({ cls: 'kuro-toolbar' });
    const refreshBtn = toolbar.createEl('button', { cls: 'kuro-btn', attr: { 'aria-label': t('sidebar.refresh', lang) } });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.appendText(` ${t('sidebar.refresh', lang)}`);
    refreshBtn.addEventListener('click', () => { void this.plugin.refreshStatus(true); });

    const redeemBtn = toolbar.createEl('button', { cls: 'kuro-btn kuro-btn-primary' });
    setIcon(redeemBtn, 'gift');
    redeemBtn.appendText(` ${t('sidebar.redeem', lang)}`);
    redeemBtn.addEventListener('click', () => this.plugin.openRedeemModal());

    /* Tab-Leiste — nur bei aktivem Chat; sonst sieht die View aus wie bisher. */
    if (chatOn) {
      const bar = root.createDiv({ cls: 'kuro-tabbar' });
      this.tabBarEl = bar;
      const mkTab = (id: KuroTab, label: string): HTMLElement => {
        const btn = bar.createEl('button', { cls: 'kuro-tab', text: label });
        btn.addEventListener('click', () => this.showTab(id));
        return btn;
      };
      this.tabButtons = {
        status: mkTab('status', t('chat.tab.status', lang)),
        chat: mkTab('chat', t('chat.tab.chat', lang)),
      };
    }

    /* Bodies — beide bleiben für die Lebensdauer der View bestehen. */
    this.statusBodyEl = root.createDiv({ cls: 'kuro-view-body' });
    this.chatBodyEl = chatOn ? root.createDiv({ cls: 'kuro-view-body kuro-chat-body' }) : null;

    this.showTab('status');
    this.renderSnapshot();
  }

  async onClose(): Promise<void> {
    this.containerEl.empty();
    this.statusBodyEl = null;
    this.chatBodyEl = null;
    this.tabBarEl = null;
    this.tabButtons = null;
  }

  showTab(id: KuroTab): void {
    this.activeTab = id;
    this.statusBodyEl?.toggleClass('kuro-hidden', id !== 'status');
    this.chatBodyEl?.toggleClass('kuro-hidden', id !== 'chat');
    this.tabButtons?.status.toggleClass('kuro-tab-active', id === 'status');
    this.tabButtons?.chat.toggleClass('kuro-tab-active', id === 'chat');
  }

  /** Zeichnet den STATUS-Body neu. Fasst den Chat-Body nie an — s. Dateikopf. */
  renderSnapshot(): void {
    if (!this.statusBodyEl) return;
    const snap = this.plugin.data.lastSnapshot;
    const lang = this.plugin.data.settings.language;
    if (!snap) {
      this.statusBodyEl.empty();
      const empty = this.statusBodyEl.createDiv({ cls: 'kuro-empty' });
      empty.createEl('h3', { text: t('sidebar.empty.setup.title', lang) });
      const ul = empty.createEl('ul');
      ul.createEl('li', { text: t('sidebar.empty.setup.dailyFolder', lang, { path: this.plugin.data.settings.dailyFolder }) });
      ul.createEl('li', { text: t('sidebar.empty.setup.xp', lang) });
      ul.createEl('li', { text: t('sidebar.empty.setup.checkbox', lang) });
      const btn = empty.createEl('button', { cls: 'kuro-btn kuro-btn-primary', text: t('sidebar.empty.setup.openSettings', lang) });
      btn.addEventListener('click', () => this.plugin.openOwnSettings());
      return;
    }
    KuroStatusRenderer.render(this.statusBodyEl, snap, this.plugin.data.settings, {
      mode: 'full',
      showLoot: true,
      showLore: true,
      showBreakdown: this.plugin.data.settings.statusVerbose,
    });
  }
}
