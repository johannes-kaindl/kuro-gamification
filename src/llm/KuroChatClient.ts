/* ==========================================================
   Ein Streaming-Call gegen /v1/chat/completions — pure, kein
   Obsidian-Import.

   Der Transport wird injiziert: Obsidians requestUrl kann nicht
   streamen, der echte Transport ist XHR-basiert (XhrSseTransport.ts).
   Dadurch ist dieser Client in Node mit einem Fake-Transport
   testbar, ganz ohne Obsidian-Mock.
   ========================================================== */
import { parseSSE } from '../vendor/kit/sse';
import { ThinkSplitter } from '../vendor/kit/think-splitter';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { suppressParams, isAlwaysOnThinker } from '../vendor/kit/reasoning';
import { realClock, type ClockPort } from '../vendor/kit-obsidian/clock';
import type { LlmMessage } from './kuroPrompt';

export interface SseTransport {
  postStream(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    onChunk: (raw: string) => void,
    signal: AbortSignal,
  ): Promise<number>;
}

export interface ChatConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  suppressThinking: boolean;
}

export type StreamOutcome =
  | { ok: true; content: string }
  | { ok: false; kind: 'aborted' | 'http' | 'network' | 'timeout'; detail: string; partial: string };

const ERROR_BODY_CAP = 2048;
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Unterdrücken nur dann, wenn der Nutzer es will UND das Modell es kann.
 * Ohne dieses Gate gingen Suppress-Parameter auch an Always-on-Thinker.
 */
export function effectiveSuppress(model: string, wanted: boolean): boolean {
  return wanted && !isAlwaysOnThinker(model);
}

export class KuroChatClient {
  /**
   * Der Clock wird injiziert, weil `window` in einer reinen Node-Testumgebung
   * fehlt, die Obsidian-Runtime aber `window.setTimeout` verlangt
   * (obsidianmd/prefer-window-timers, Popout-Fenster-Kompatibilität).
   */
  constructor(
    private readonly transport: SseTransport,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private readonly clock: ClockPort = realClock,
  ) {}

  async stream(
    cfg: ChatConfig,
    messages: LlmMessage[],
    onToken: (t: string) => void,
    signal: AbortSignal,
  ): Promise<StreamOutcome> {
    // Ein bereits abgebrochenes Signal würde unseren Listener nie auslösen —
    // vorab prüfen, damit der Transport gar nicht erst startet.
    if (signal.aborted) {
      return { ok: false, kind: 'aborted', detail: 'stream aborted', partial: '' };
    }

    const url = `${normalizeEndpoint(cfg.endpoint)}/v1/chat/completions`;
    const headers: Record<string, string> = {};
    if (cfg.apiKey !== '') headers.Authorization = `Bearer ${cfg.apiKey}`;
    const body = {
      model: cfg.model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
      ...suppressParams(effectiveSuppress(cfg.model, cfg.suppressThinking)),
    };

    // Innerer Controller: ausgelöst vom Aufrufer-Abbruch ODER vom harten Timeout.
    const ctrl = new AbortController();
    let timedOut = false;
    const onCallerAbort = (): void => ctrl.abort();
    signal.addEventListener('abort', onCallerAbort, { once: true });
    const timer = this.clock.setTimeout(() => { timedOut = true; ctrl.abort(); }, this.timeoutMs);

    const splitter = new ThinkSplitter();
    let content = '';
    let rest = '';
    let rawBody = '';

    const emit = (piece: string): void => {
      const parts = splitter.push(piece);
      if (parts.content !== '') {
        content += parts.content;
        onToken(parts.content);
      }
      // Reasoning (<think>-Spannen) wird bewusst verworfen, nicht angezeigt.
    };

    /** Rest aus dem Splitter nachziehen (z. B. ein unfertiges "<th"), damit
     *  Teiltext auf keinem Pfad still verlorengeht. */
    const drain = (): void => {
      const tail = splitter.flush();
      if (tail.content !== '') { content += tail.content; onToken(tail.content); }
    };

    let status: number;
    try {
      status = await this.transport.postStream(url, body, headers, (raw) => {
        if (rawBody.length < ERROR_BODY_CAP) rawBody += raw;
        const parsed = parseSSE(rest + raw);
        rest = parsed.rest;
        for (const delta of parsed.content) emit(delta);
      }, ctrl.signal);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('unknown stream error');
      drain();
      if (err.name === 'AbortError') {
        return timedOut
          ? { ok: false, kind: 'timeout', detail: `no answer within ${this.timeoutMs / 1000}s`, partial: content }
          : { ok: false, kind: 'aborted', detail: 'stream aborted', partial: content };
      }
      return { ok: false, kind: 'network', detail: err.message, partial: content };
    } finally {
      this.clock.clearTimeout(timer);
      signal.removeEventListener('abort', onCallerAbort);
    }

    drain();

    if (status < 200 || status >= 300) {
      return {
        ok: false,
        kind: 'http',
        detail: `HTTP ${status}: ${rawBody.slice(0, ERROR_BODY_CAP)}`,
        partial: content,
      };
    }
    return { ok: true, content };
  }
}
