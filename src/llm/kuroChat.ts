/* ==========================================================
   Kuros Chat-Aufruf über den Kit-Client (`createChatClient`, obsidian-kit 0.42.0) — pure,
   kein Obsidian-Import. Der Client und seine Transporte kommen aus `vendor/kit-obsidian`;
   hier steht nur, was DIESES Plugin dazutut: die Companion-Sampling-Werte als `params` (der
   Kit-Client schickt keine eigenen) und die Übersetzung von Kuros Nachrichten in die
   Leitungsform.

   Reasoning wird bewusst nicht angezeigt: `onReasoning` bleibt weg.
   ========================================================== */
import { isAlwaysOnThinker, suppressParams } from '../vendor/kit/reasoning';
import type { EndpointConfig } from '../vendor/kit/endpoint_config';
import type { ChatClient, ChatResult } from '../vendor/kit-obsidian/chat-client';
import type { LlmMessage } from './kuroPrompt';

export interface KuroChatConfig {
  endpoint: EndpointConfig;
  /** Das GESENDETE Modell (`endpoint-source` `sentModel` bzw. die Wahl). */
  model: string;
  suppressThinking: boolean;
}

const COMPANION_TEMPERATURE = 0.7;
const COMPANION_MAX_TOKENS = 1024;

/**
 * Unterdrücken nur dann, wenn der Nutzer es will UND das Modell es kann.
 * Ohne dieses Gate gingen Suppress-Parameter auch an Always-on-Thinker.
 */
export function effectiveSuppress(model: string, wanted: boolean): boolean {
  return wanted && !isAlwaysOnThinker(model);
}

/** Sampling-Werte des Companions. Übergangsform nach MIGRATION 0.42.0 Punkt 3 — die Ablösung
 *  durch `resolveRequestParams` (Modus `companion`) ist eine eigene Aufgabe. */
export function kuroChatParams(model: string, suppressWanted: boolean): Record<string, unknown> {
  return {
    temperature: COMPANION_TEMPERATURE,
    max_tokens: COMPANION_MAX_TOKENS,
    ...suppressParams(effectiveSuppress(model, suppressWanted)),
  };
}

export function streamKuro(
  client: ChatClient,
  cfg: KuroChatConfig,
  messages: readonly LlmMessage[],
  onToken: (t: string) => void,
  signal: AbortSignal,
): Promise<ChatResult> {
  return client.complete({
    endpoint: cfg.endpoint,
    model: cfg.model,
    messages,
    params: kuroChatParams(cfg.model, cfg.suppressThinking),
    onToken,
    signal,
  });
}
