/* ==========================================================
   KuroSidebarView — right-leaf ItemView mit Toolbar, Loot-Knopf
   und Status-Snapshot; optional mit Chat-Tab.

   Tab-Aufbau (load-bearing): Die Tab-Leiste ist der Kit-Hub
   (buildHubInto, „mount-once“): Status- und Chat-Body existieren
   DAUERHAFT im DOM, der Hub blendet den inaktiven nur aus.
   renderSnapshot() leert deshalb ausschliesslich den Status-Body.
   Läge der Chat im selben Container, risse ihn der 800-ms-Refresh
   (vault.modify → refreshStatus) bei jedem Tastendruck in einer
   beliebigen Notiz weg — samt Verlauf und Eingabe-Entwurf.
   ========================================================== */
import { ItemView, MarkdownRenderer, type WorkspaceLeaf, setIcon } from 'obsidian';
import type KuroPlugin from '../main';
import { KuroStatusRenderer } from './KuroStatusRenderer';
import { KuroChatPanel } from './KuroChatPanel';
import { buildDailyExtract } from '../llm/kuroContext';
import { buildHubInto, type HubController, type HubPanel } from '../vendor/kit-obsidian/hub';
import { t } from '../i18n';
import type { Lang } from '../types';

export const VIEW_TYPE_KURO = 'kuro-status-view';

export type KuroTab = 'status' | 'chat';

export class KuroSidebarView extends ItemView {
  statusBodyEl: HTMLElement | null = null;
  chatBodyEl: HTMLElement | null = null;
  /** Wurzel des Hubs (Tab-Leiste + Panels); nur bei aktivem Chat vorhanden. */
  hubEl: HTMLElement | null = null;

  private hub: HubController<KuroTab> | null = null;
  private chatPanel: KuroChatPanel | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: KuroPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_KURO; }
  getDisplayText(): string { return t('sidebar.title', this.plugin.data.settings.language); }
  getIcon(): string { return 'terminal'; }

  get activeTab(): KuroTab { return this.hub?.currentTab() ?? 'status'; }

  async onOpen(): Promise<void> {
    // syncChatUI ruft onOpen() auf einer schon offenen View erneut: das alte Chat-Panel
    // (Timer, Stream) muss vorher weg, sonst bleibt es verwaist.
    this.teardown();
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

    if (chatOn) {
      /* Tab-Leiste = Kit-Hub, nur bei aktivem Chat; sonst sieht die View aus wie bisher.
         Der Hub bekommt ein eigenes Div, damit die Werkzeugleiste darüber stehen bleibt. */
      this.hubEl = root.createDiv({ cls: 'kuro-hub' });
      this.hub = buildHubInto<KuroTab>(this.hubEl, this.makePanels(lang), 'status');
    } else {
      this.statusBodyEl = root.createDiv({ cls: 'kuro-view-body' });
    }

    this.renderSnapshot();
    this.renderChat();
  }

  async onClose(): Promise<void> {
    this.teardown();
    this.containerEl.empty();
  }

  /** Beide Panels bleiben für die Lebensdauer der View gemountet (Kit-Vertrag „mount-once“). */
  private makePanels(lang: Lang): HubPanel<KuroTab>[] {
    const status: HubPanel<KuroTab> = {
      id: 'status',
      get label() { return t('chat.tab.status', lang); },
      icon: 'activity',
      mount: (el) => { this.statusBodyEl = el.createDiv({ cls: 'kuro-view-body' }); },
      destroy: () => {},
    };
    const chat: HubPanel<KuroTab> = {
      id: 'chat',
      get label() { return t('chat.tab.chat', lang); },
      icon: 'message-square',
      mount: (el) => {
        this.chatBodyEl = el.createDiv({ cls: 'kuro-view-body kuro-chat-body' });
        this.chatPanel = new KuroChatPanel(this.chatBodyEl, lang, this.plugin.chatSession, {
          onAsk: (q) => { void this.plugin.askKuro(q); },
          onAbort: () => this.plugin.abortChat(),
          onClear: () => this.plugin.clearChat(),
          contextInfo: () => buildDailyExtract(this.plugin.lastDailyText, this.plugin.data.settings),
          openSettings: () => this.plugin.openOwnSettings(),
          // Die View ist die Component, an der die gerenderten Blöcke hängen: schließt sie, räumt
          // Obsidian deren Listener und eingebettete Kinder mit ab.
          renderMarkdown: (el2, md) => MarkdownRenderer.render(this.app, md, el2, '', this),
        });
      },
      destroy: () => { this.chatPanel?.destroy(); },
    };
    return [status, chat];
  }

  private teardown(): void {
    this.hub?.destroy();
    if (!this.hub) this.chatPanel?.destroy();
    this.hub = null;
    this.hubEl = null;
    this.statusBodyEl = null;
    this.chatBodyEl = null;
    this.chatPanel = null;
  }

  /** Chat-Tab neu zeichnen; ohne eingerichteten Endpunkt der Setup-Hinweis. */
  renderChat(): void {
    if (this.chatPanel === null) return;
    if (!this.plugin.hasChatEndpointSource()) {
      this.chatPanel.showSetupHint();
      return;
    }
    this.chatPanel.render();
  }

  /** Kontextzeile nachziehen, nachdem `plugin.lastDailyText` neu gelesen wurde. */
  refreshChatContext(): void {
    this.chatPanel?.refreshContext();
  }

  /** Laufende Antwort fortschreiben, ohne den ganzen Tab neu zu zeichnen. */
  appendChatToken(token: string): void {
    this.chatPanel?.appendToken(token);
  }

  /** Der bisher gestreamte Text war Denken (Gemma 4 ohne Öffner): die laufende Antwort leeren. */
  resetChatContent(): void {
    this.chatPanel?.resetContent();
  }

  showTab(id: KuroTab): void {
    this.hub?.setTab(id);
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
