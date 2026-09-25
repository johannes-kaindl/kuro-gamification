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
import { createStableWriter, type StableMarkdownWriter } from '../vendor/kit-obsidian/stable-writer';

export interface ChatPanelCallbacks {
  onAsk(question: string): void;
  onAbort(): void;
  onClear(): void;
  contextInfo(): DailyExtract;
  openSettings(): void;
  /** Rendert Markdown in ein Element (Obsidians `MarkdownRenderer` — braucht `App` und eine
   *  Component, beides gehört der View, nicht diesem Panel). Fehlt der Callback, bleibt es
   *  beim Rohtext. */
  renderMarkdown?: (el: HTMLElement, markdown: string) => Promise<void>;
}

export class KuroChatPanel {
  /** Streaming-Antwortbereich aus dem Kit (UI-STANDARD §8, `buildStreamArea`, Bauart 2:
   *  append-only Rohtext). Kuro hat keinen Gedankenstrom — der Reasoning-Slot des Bausteins
   *  bleibt deshalb ungenutzt (nie `appendReasoning`/`setReasoning` aufgerufen). */
  private area: StreamArea | null = null;
  private inputEl: HTMLInputElement | null = null;
  /** Inkrementeller Markdown-Schreiber auf dem laufenden Absatz (Kit `stable-writer`):
   *  abgeschlossene Absätze werden genau einmal gerendert, der laufende bleibt Rohtext. */
  private writer: StableMarkdownWriter | null = null;
  private ctxSummaryEl: HTMLElement | null = null;
  private ctxBodyEl: HTMLElement | null = null;

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
    this.writer = null;
    this.ctxSummaryEl = null;
    this.ctxBodyEl = null;
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
    // `kuro-chat-log` bleibt als Alias auf dem Kit-Body stehen: der GUI-Smoke-Treiber
    // (scripts/gui-smoke.ts, Schritt 4) und ältere Referenzen suchen strukturell danach,
    // nicht nach dem Kit-eigenen `.okit-stream-body`.
    area.bodyEl.addClass('kuro-chat-log');

    for (const e of this.session.entries) this.renderEntry(area.bodyEl, e);

    this.writer = null;
    if (this.session.streaming !== null) {
      const line = area.bodyEl.createDiv({ cls: 'kuro-chat-line kuro-chat-assistant kuro-chat-streaming' });
      line.createSpan({ cls: 'kuro-chat-who', text: t('chat.kuro', this.lang) });
      const content = line.createDiv({ cls: 'kuro-chat-stream-content' });
      area.tailEl.addClass('kuro-chat-text');
      // `tailEl` liegt nach buildStreamArea() als erstes (einziges) Kind des Bodys — hinter
      // die fertigen Einträge verschieben, statt es dort neu einzufügen (Muster aus
      // lingotuner/src/obsidian/view-render.ts, dort für denselben Zweck).
      content.appendChild(area.tailEl);
      // Der Schreiber legt fertige Blöcke in `area.bodyEl` ab — hier soll das die Inhalts-
      // spalte der laufenden Zeile sein, nicht der ganze Log. Die Handles des Bereichs
      // (Tail, Scrollen) bleiben dieselben; nur der Ablageort der Blöcke wird umgelenkt.
      this.writer = createStableWriter({
        area: { ...area, bodyEl: content },
        render: (el, md) => this.renderMd(el, md),
        blockCls: 'okit-stream-block markdown-rendered',
      });
      this.writer.push(this.session.streaming);
      line.createSpan({ cls: 'kuro-chat-cursor', text: '▮' });
    } else {
      area.bodyEl.appendChild(area.tailEl);
    }

    this.renderInputRow(draft);
    area.followTail();
  }

  /** Laufenden Text fortschreiben, statt pro Token neu zu zeichnen. */
  appendToken(token: string): void {
    if (this.area === null || this.writer === null) { this.render(); return; }
    this.writer.push(token);
  }

  private contextLabel(info: DailyExtract): string {
    return info.mode === 'none'
      ? t('chat.contextNone', this.lang)
      : info.mode === 'full'
        ? t('chat.contextFull', this.lang)
        : t('chat.contextToggle', this.lang, {
            tasks: info.tasks.length,
            habits: info.habits.length,
          });
  }

  private contextBody(info: DailyExtract): string {
    const body = renderDailyExtract(info);
    return body === '' ? t('set.chatDailyContext.previewEmpty', this.lang) : body;
  }

  private renderContextLine(): void {
    const info = this.cb.contextInfo();
    const details = this.host.createEl('details', { cls: 'kuro-chat-context' });
    this.ctxSummaryEl = details.createEl('summary', {
      cls: 'kuro-chat-context-summary',
      text: this.contextLabel(info),
    });
    this.ctxBodyEl = details.createEl('pre', {
      cls: 'kuro-chat-context-body',
      text: this.contextBody(info),
    });
  }

  /** Kontextzeile und Vorschau aus dem aktuellen Stand neu schreiben — ohne den Chat neu
   *  zu zeichnen (Verlauf, Scrollposition und ein laufender Stream bleiben stehen, und der
   *  Ausklapper behält seinen Zustand). No-op, solange kein Chat gezeichnet ist. */
  refreshContext(): void {
    if (this.ctxSummaryEl === null || this.ctxBodyEl === null) return;
    const info = this.cb.contextInfo();
    this.ctxSummaryEl.setText(this.contextLabel(info));
    this.ctxBodyEl.setText(this.contextBody(info));
  }

  /** Markdown in ein Element; ohne Renderer der Rohtext. */
  private renderMd(el: HTMLElement, markdown: string): Promise<void> {
    const r = this.cb.renderMarkdown;
    if (r === undefined) { el.setText(markdown); return Promise.resolve(); }
    return r(el, markdown);
  }

  private renderEntry(container: HTMLElement, e: ChatEntry): void {
    const line = container.createDiv({ cls: `kuro-chat-line kuro-chat-${e.role}` });

    if (e.role !== 'error') {
      line.createSpan({
        cls: 'kuro-chat-who',
        text: e.role === 'user' ? t('chat.you', this.lang) : t('chat.kuro', this.lang),
      });
    }
    if (e.role === 'assistant' && this.cb.renderMarkdown !== undefined) {
      // Nur Kuros Antworten sind Markdown; die eigene Frage und Fehlertexte bleiben Rohtext.
      const box = line.createDiv({ cls: 'kuro-chat-text kuro-chat-md markdown-rendered' });
      this.renderMd(box, e.text).catch(() => { box.setText(e.text); });
    } else {
      line.createSpan({ cls: 'kuro-chat-text', text: e.text });
    }

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
