/* ==========================================================
   Chat-Oberfläche — reines Obsidian-DOM (createEl/createDiv),
   kein JSX.

   Verlauf und laufende Antwort liegen in der ChatSession; das
   Eingabefeld ist absichtlich unkontrolliert, damit ein Entwurf
   jedes Neuzeichnen überlebt.

   Die Kontext-Zeile ruft dieselbe Funktion wie der Prompt-Bau
   (renderDailyExtract) — eine nachgebaute Vorschau würde driften
   und beruhigend etwas anderes zeigen, als gesendet wird.
   ========================================================== */
import { setIcon } from 'obsidian';
import type { Lang } from '../types';
import { t } from '../i18n';
import type { ChatEntry, ChatSession } from '../llm/ChatSession';
import { renderDailyExtract, type DailyExtract } from '../llm/kuroContext';
import { buildStreamArea, type StreamArea } from '../vendor/kit-obsidian/stream-area';

export interface ChatPanelCallbacks {
  onAsk(question: string): void;
  onAbort(): void;
  onClear(): void;
  contextInfo(): DailyExtract;
  openSettings(): void;
}

export class KuroChatPanel {
  /** Streaming-Antwortbereich aus dem Kit (UI-STANDARD §8, `buildStreamArea`, Bauart 2:
   *  append-only Rohtext). Kuro hat keinen Gedankenstrom — der Reasoning-Slot des Bausteins
   *  bleibt deshalb ungenutzt (nie `appendReasoning`/`setReasoning` aufgerufen). */
  private area: StreamArea | null = null;
  private inputEl: HTMLInputElement | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly lang: Lang,
    private readonly session: ChatSession,
    private readonly cb: ChatPanelCallbacks,
  ) {}

  /** Hinweis statt Chat, solange kein Endpunkt eingerichtet ist. */
  showSetupHint(): void {
    this.host.empty();
    this.area = null;
    this.inputEl = null;
    const box = this.host.createDiv({ cls: 'kuro-empty' });
    box.createEl('h3', { text: t('chat.setup.title', this.lang) });
    box.createEl('p', { text: t('chat.setup.body', this.lang) });
    const btn = box.createEl('button', {
      cls: 'kuro-btn kuro-btn-primary',
      text: t('chat.setup.openSettings', this.lang),
    });
    btn.addEventListener('click', () => this.cb.openSettings());
  }

  render(): void {
    const draft = this.inputEl?.value ?? '';
    this.host.empty();

    this.renderContextLine();

    // Wurzel bekommt eine eigene Klasse fürs Layout (flex:1 1 auto im kuro-chat-body,
    // s. styles.css) — das Kit stylt nur seine eigenen okit-stream-*-Klassen.
    const area = buildStreamArea(this.host, {
      strings: { reasoning: '' },
      cls: 'kuro-chat-stream',
    });
    this.area = area;

    for (const e of this.session.entries) this.renderEntry(area.bodyEl, e);

    if (this.session.streaming !== null) {
      const line = area.bodyEl.createDiv({ cls: 'kuro-chat-line kuro-chat-assistant kuro-chat-streaming' });
      line.createSpan({ cls: 'kuro-chat-who', text: t('chat.kuro', this.lang) });
      area.tailEl.addClass('kuro-chat-text');
      // `tailEl` liegt nach buildStreamArea() als erstes (einziges) Kind des Bodys — hinter
      // die fertigen Einträge verschieben, statt es dort neu einzufügen (Muster aus
      // lingotuner/src/obsidian/view-render.ts, dort für denselben Zweck).
      line.appendChild(area.tailEl);
      area.setTail(this.session.streaming);
      line.createSpan({ cls: 'kuro-chat-cursor', text: '▮' });
    } else {
      area.bodyEl.appendChild(area.tailEl);
    }

    this.renderInputRow(draft);
    area.followTail();
  }

  /** Laufenden Text fortschreiben, statt pro Token neu zu zeichnen. */
  appendToken(token: string): void {
    if (this.area === null) { this.render(); return; }
    this.area.setTail((this.session.streaming ?? '') + token);
    this.area.followTail();
  }

  private renderContextLine(): void {
    const info = this.cb.contextInfo();
    const label = info.mode === 'none'
      ? t('chat.contextNone', this.lang)
      : info.mode === 'full'
        ? t('chat.contextFull', this.lang)
        : t('chat.contextToggle', this.lang, {
            tasks: info.tasks.length,
            habits: info.habits.length,
          });

    const details = this.host.createEl('details', { cls: 'kuro-chat-context' });
    details.createEl('summary', { text: label });
    const body = renderDailyExtract(info);
    details.createEl('pre', {
      cls: 'kuro-chat-context-body',
      text: body === '' ? t('set.chatDailyContext.previewEmpty', this.lang) : body,
    });
  }

  private renderEntry(container: HTMLElement, e: ChatEntry): void {
    const line = container.createDiv({ cls: `kuro-chat-line kuro-chat-${e.role}` });

    if (e.role !== 'error') {
      line.createSpan({
        cls: 'kuro-chat-who',
        text: e.role === 'user' ? t('chat.you', this.lang) : t('chat.kuro', this.lang),
      });
    }
    line.createSpan({ cls: 'kuro-chat-text', text: e.text });

    if (e.detail !== undefined) {
      line.createDiv({ cls: 'kuro-chat-detail', text: e.detail });
    }
  }

  private renderInputRow(draft: string): void {
    const row = this.host.createDiv({ cls: 'kuro-chat-inputrow' });

    const input = row.createEl('input', {
      cls: 'kuro-chat-input',
      attr: { type: 'text', placeholder: t('chat.placeholder', this.lang) },
    });
    input.value = draft;
    input.disabled = this.session.busy;
    input.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') this.submit();
    });
    this.inputEl = input;

    if (this.session.busy) {
      const stop = row.createEl('button', { cls: 'kuro-btn', text: t('chat.abort', this.lang) });
      stop.addEventListener('click', () => this.cb.onAbort());
    } else {
      const send = row.createEl('button', {
        cls: 'kuro-btn kuro-btn-primary',
        text: t('chat.send', this.lang),
      });
      send.addEventListener('click', () => this.submit());
    }

    const clear = row.createEl('button', {
      cls: 'kuro-btn',
      attr: { 'aria-label': t('chat.clear', this.lang) },
    });
    setIcon(clear, 'eraser');
    clear.addEventListener('click', () => this.cb.onClear());
  }

  private submit(): void {
    const q = this.inputEl?.value.trim() ?? '';
    if (q === '' || this.session.busy) return;
    if (this.inputEl) this.inputEl.value = '';
    this.cb.onAsk(q);
  }
}
