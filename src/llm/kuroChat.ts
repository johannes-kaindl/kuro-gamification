/* ==========================================================
   Kuros Chat-Aufruf über den Kit-Client (`createChatClient`, obsidian-kit 0.42.0) — pure,
   kein Obsidian-Import. Der Client und seine Transporte kommen aus `vendor/kit-obsidian`;
   hier steht nur, was DIESES Plugin dazutut: die Sampling-Parameter des Modus companion als
   `params` (der Kit-Client schickt keine eigenen) und die Übersetzung von Kuros Nachrichten
   in die Leitungsform.

   Reasoning wird bewusst nicht angezeigt: `onReasoning` bleibt weg.
   ========================================================== */
import {
  resolveRequestParams,
  type BackendId, type FamilyId, type FieldId, type ResolvedRequest, type ThinkingLevel,
} from '../vendor/kit/sampling-profiles';
import type { EndpointConfig } from '../vendor/kit/endpoint_config';
import type { ChatClient, ChatResult } from '../vendor/kit-obsidian/chat-client';
import type { LlmMessage } from './kuroPrompt';
import { MODE } from './requestSettings';

export interface KuroChatConfig {
  endpoint: EndpointConfig;
  /** Das GESENDETE Modell (`endpoint-source` `sentModel`, nach Alias-Auflösung). */
  model: string;
  /** Fertig aufgelöste Sampling-Parameter (`buildKuroParams(...).params`). */
  params: Record<string, number | string>;
}

/** Token-Budget einer Antwort — Plugin-Wert, kein Nutzerwert; geht als `maxTokens` in die
 *  Auflösung (die Familie hebt es bei Bedarf auf ihre Reserve). */
export const COMPANION_MAX_TOKENS = 1024;

/** Die Request-Bau-Funktion DES PLUGINS (Rezept 8): nur sie kennt Kuros festen Modus und das
 *  Budget. Die goldenen Requests laufen dagegen, nicht gegen `resolveRequestParams` direkt —
 *  sonst prüfte der Test das Kit statt das Plugin. gpt-oss/harmony lehnt Thinking-Felder mit
 *  HTTP 400 ab; das entscheidet die Familien-Tabelle (`canTurnOff`), nicht mehr ein Namens-Guard. */
export function buildKuroParams(input: {
  family: FamilyId | null;
  backend: BackendId;
  thinking: ThinkingLevel;
  overrides?: Partial<Record<FieldId, number | string>>;
}): ResolvedRequest {
  return resolveRequestParams({
    family: input.family, mode: MODE, backend: input.backend, thinking: input.thinking,
    maxTokens: COMPANION_MAX_TOKENS,
    ...(input.overrides ? { overrides: input.overrides } : {}),
  });
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
    params: cfg.params,
    onToken,
    signal,
  });
}
