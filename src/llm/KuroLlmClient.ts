/* ==========================================================
   Erreichbarkeits-Probe + Modell-Liste eines Chat-Endpunkts — pure,
   kein Obsidian-Import. Der HTTP-Transport wird injiziert (Obsidians
   requestUrl läuft in Jest nicht), analog zu KuroChatClient/SseTransport.

   Trägt den API-Key des Eintrags mit (authHeaders) — anders als der
   frühere main.ts-Pfad, der ihn nie sendete und dadurch jeden Endpunkt
   mit Schlüssel-Pflicht als "nicht erreichbar" meldete, obwohl der Chat
   selbst funktionierte (Endpunkt-Befund 09-08).
   ========================================================== */
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { authHeaders, type EndpointConfig } from '../vendor/kit/endpoint_config';
import {
  classifyEndpointStatus, extractModelIds, type EndpointStatus, type ProbeInput,
} from '../vendor/kit/endpoint_diagnostics';

export type KuroLlmHttpJson =
  (url: string, headers: Record<string, string>) => Promise<{ status: number; json: unknown }>;

export class KuroLlmClient {
  private readonly endpoint: string;
  private readonly auth: Record<string, string>;

  constructor(cfg: EndpointConfig, private readonly http: KuroLlmHttpJson) {
    this.endpoint = normalizeEndpoint(cfg.url);
    this.auth = authHeaders(cfg.apiKey);
  }

  /** Erreichbarkeit mit benanntem Grund. Wirft nie — ein Fehlschlag degradiert
   *  zu einem klassifizierten Status, nie zu einer geworfenen Exception. */
  async probe(): Promise<EndpointStatus> {
    let input: ProbeInput;
    try {
      const res = await this.http(`${this.endpoint}/v1/models`, this.auth);
      input = { kind: 'response', status: res.status, body: res.json };
    } catch (e) {
      input = { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
    return classifyEndpointStatus(input);
  }

  /** Boolesche Erreichbarkeit für resolveActiveEndpointConfig's injizierten ping. */
  async ping(): Promise<boolean> {
    return (await this.probe()).reachable;
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await this.http(`${this.endpoint}/v1/models`, this.auth);
      if (res.status !== 200) return [];
      return extractModelIds(res.json).sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }
}
