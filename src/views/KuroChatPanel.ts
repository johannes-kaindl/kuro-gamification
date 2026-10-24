/* ==========================================================
   Der Wirt des Chat-Fensters (obsidian-kit `buildChatWindow`,
   UI-STANDARD §8 Baustein 12) und der Modellzeile (`buildModelBar`,
   Baustein 15) im Chat-Tab der Sidebar.

   Hier steht nur, was Kuro selbst sagt: die Kontextzeile, der
   Einrichtungs-Hinweis und das Anbinden von Senden, Verlauf und
   „merk dir“. Verlauf, Eingabe, Abbruch, Fehlerzeile, Kopieren und
   Markdown (Neutralisierung, Stream-Schreiber) trägt das Kit.

   Die Kontext-Zeile ruft dieselbe Funktion wie der Prompt-Bau
   (renderDailyExtract) — eine nachgebaute Vorschau würde driften
   und beruhigend etwas anderes zeigen, als gesendet wird.
   ========================================================== */
import type { App } from 'obsidian';
import type { Lang } from '../types';
import { t } from '../i18n';
import { renderDailyExtract, type DailyExtract } from '../llm/kuroContext';
import type { ChatHistory, ChatModelMessage } from '../vendor/kit/chat-history';
import {
  buildChatWindow,
  type ChatSendHandlers,
  type ChatSendResult,
  type ChatWindow,
} from '../vendor/kit-obsidian/chat-window';
import { buildModelBar, type ModelBar, type ModelBarConnection } from '../vendor/kit-obsidian/model-bar';

export interface ChatPanelDeps {
  app: App;
  /** Teilmenge der Verbindung, die die Modellzeile braucht (Modelle, Wechsel, laufendes Modell). */
  llm: ModelBarConnection;
  /** Der Verlauf lebt im Plugin (Speicher, nie auf Platte); das Fenster bekommt ihn beim Bau zurück. */
  initial: ChatHistory;
  onChange(history: ChatHistory): void;
  send(messages: readonly ChatModelMessage[], h: ChatSendHandlers): Promise<ChatSendResult>;
  /** „merk dir: …“ ist ein Merkzettel-Eintrag, keine Frage ans Modell: `true`, wenn die Nachricht damit erledigt ist. */
  handleCommand(text: string): boolean;
  contextInfo(): DailyExtract;
  /** Gibt es eine Quelle für Chat-Endpunkte (Manager oder lokale Zeile)? Ohne zeigt das Fenster den Einrichtungs-Hinweis. */
  hasEndpoint(): boolean;
  openSettings(): void;
  /** Rendert Markdown in ein Element (Obsidians `MarkdownRenderer` — braucht `App` und eine Component, beides gehört der View). */
  renderMarkdown(el: HTMLElement, markdown: string): Promise<void>;
}

/** Naht für Tests: das Fake-DOM trägt keinen MutationObserver. Produktiv bleibt der dom-guard des Kit-Schreibers an. */
export interface ChatPanelOptions {
  domGuard?: boolean;
}

export class KuroChatPanel {
  private win: ChatWindow | null = null;
  private bar: ModelBar | null = null;
  private ctxSummaryEl: HTMLElement | null = null;
  private ctxBodyEl: HTMLElement | null = null;
  /** Zustand von `hasEndpoint()` beim letzten Zeichnen: nur ein Wechsel zeichnet das Fenster neu (`refresh()` baut den Kopf neu). */
  private endpointOk = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly lang: Lang,
    private readonly deps: ChatPanelDeps,
    private readonly opts: ChatPanelOptions = {},
  ) {}

  /** Baut das Fenster in den Wirt; ein zweiter Aufruf baut neu (der Verlauf kommt aus `deps.initial`). */
  build(): void {
    this.win?.destroy();
    this.bar?.destroy();
    this.win = null;
    this.bar = null;
    this.host.empty();
    // Der Wirt braucht eine begrenzte Höhe, sonst rollt der Verlauf nicht (Kit-Falle); die Regel steht in der styles.css.
    this.host.addClass('kuro-chat-host');
    this.endpointOk = this.deps.hasEndpoint();
    const d = this.deps;
    this.win = buildChatWindow(this.host, {
      cls: 'kuro-chat',
      strings: { lang: this.lang, placeholder: t('chat.placeholder', this.lang) },
      send: (messages, h) => this.send(messages, h),
      render: (el, markdown) => d.renderMarkdown(el, markdown),
      header: (el) => { this.drawHeader(el); },
      beforeSubmit: (text) => this.beforeSubmit(text),
      empty: {
        when: () => !this.endpointOk,
        title: t('chat.setup.title', this.lang),
        text: t('chat.setup.body', this.lang),
        cta: { label: t('chat.setup.openSettings', this.lang), onClick: () => { d.openSettings(); } },
      },
      initial: d.initial,
      onChange: (h) => {
        d.onChange(h);
        // Die Zeile sperrt sich während eines Laufs und gibt sich danach frei.
        this.bar?.update();
      },
      ...(this.opts.domGuard === undefined ? {} : { domGuard: this.opts.domGuard }),
    });
  }

  /** Läuft eine Antwort? Das Kit-Fenster hat kein `running()`, aber `startAnswer` läuft vor `send`, also zeigt der Verlauf den Lauf. */
  private running(): boolean {
    return this.win?.history().entries.some((e) => e.kind === 'assistant' && e.state === 'streaming') ?? false;
  }

  private send(messages: readonly ChatModelMessage[], h: ChatSendHandlers): Promise<ChatSendResult> {
    // `startAnswer` ist vor `send` gelaufen: ab hier ist der Lauf im Verlauf sichtbar, die Zeile sperrt sich.
    this.bar?.update();
    return this.deps.send(messages, h);
  }

  private beforeSubmit(text: string): boolean {
    if (!this.deps.handleCommand(text)) return true;
    // Der Entwurf bliebe sonst stehen („merk dir …“ im Feld); hier, vor dem `false`, ist das Fenster noch beteiligt.
    this.win?.setDraft('');
    return false;
  }

  private drawHeader(el: HTMLElement): void {
    // `refresh()` ruft den Einschub erneut; die alte Zeile gibt das Kit nicht frei (kein Abmelde-Hook), also hier.
    this.bar?.destroy();
    this.bar = null;
    this.ctxSummaryEl = null;
    this.ctxBodyEl = null;
    // Im Leerzustand blendet das Kit den Kopf nicht aus: keinen bauen.
    if (!this.endpointOk) return;
    this.bar = buildModelBar({
      app: this.deps.app,
      containerEl: el,
      llm: this.deps.llm,
      label: t('chat.tab.chat', this.lang),
      strings: { lang: this.lang },
      disabled: () => this.running(),
    });
    this.drawContextLine(el);
  }

  private contextLabel(info: DailyExtract): string {
    return info.mode === 'none'
      ? t('chat.contextNone', this.lang)
      : info.mode === 'full'
        ? t('chat.contextFull', this.lang)
        : info.numbers.length > 0
          ? t('chat.contextToggleNumbers', this.lang, {
              tasks: info.tasks.length,
              habits: info.habits.length,
              numbers: info.numbers.length,
            })
          : t('chat.contextToggle', this.lang, {
              tasks: info.tasks.length,
              habits: info.habits.length,
            });
  }

  private contextBody(info: DailyExtract): string {
    const body = renderDailyExtract(info);
    return body === '' ? t('set.chatDailyContext.previewEmpty', this.lang) : body;
  }

  private drawContextLine(el: HTMLElement): void {
    const info = this.deps.contextInfo();
    const details = el.createEl('details', { cls: 'kuro-chat-context' });
    this.ctxSummaryEl = details.createEl('summary', {
      cls: 'kuro-chat-context-summary',
      text: this.contextLabel(info),
    });
    this.ctxBodyEl = details.createEl('pre', {
      cls: 'kuro-chat-context-body',
      text: this.contextBody(info),
    });
  }

  /** Kontextzeile und Vorschau aus dem aktuellen Stand neu schreiben — ohne das Fenster neu zu zeichnen (Verlauf, Scrollposition,
   *  ein laufender Stream und der Zustand des Ausklappers bleiben stehen; `win.refresh()` baut den Kopf neu). */
  refreshContext(): void {
    if (this.ctxSummaryEl === null || this.ctxBodyEl === null) return;
    const info = this.deps.contextInfo();
    this.ctxSummaryEl.setText(this.contextLabel(info));
    this.ctxBodyEl.setText(this.contextBody(info));
  }

  /** Nach Änderungen an Endpunkt, Modell oder Einstellungen. Wechselt der Endpunkt-Zustand (Einrichtung ↔ Chat), zeichnet das Fenster
   *  neu; sonst genügt die Modellzeile. `models`: auch die Modell-Liste neu laden (Endpunkt oder Liste der Endpunkte hat sich geändert). */
  refresh(opts: { models?: boolean } = {}): void {
    const now = this.deps.hasEndpoint();
    if (now !== this.endpointOk) {
      this.endpointOk = now;
      this.win?.refresh();
      return;
    }
    this.bar?.update();
    if (opts.models === true) void this.bar?.refresh();
    this.refreshContext();
  }

  /** Sendet eine Frage wie die Eingabe (Treiber und Test); ohne Text die Eingabe. */
  async submit(text?: string): Promise<void> {
    await this.win?.submit(text);
  }

  /** „Neu“ des Fensters: leert den Verlauf und bricht einen laufenden Lauf ab. */
  clear(): void {
    this.win?.clear();
  }

  abort(): void {
    this.win?.abort();
  }

  history(): ChatHistory | null {
    return this.win?.history() ?? null;
  }

  /** Bricht einen laufenden Lauf ab und trennt Fenster und Modellzeile; die View ruft es beim Schließen. */
  destroy(): void {
    this.win?.destroy();
    this.bar?.destroy();
    this.win = null;
    this.bar = null;
    this.ctxSummaryEl = null;
    this.ctxBodyEl = null;
  }
}
