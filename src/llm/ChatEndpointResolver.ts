/* ==========================================================
   Cached resolveActiveEndpointConfig() vor jedem Chat-Stream. Ohne Cache
   würde jede Nachricht im Gespräch den ganzen Fallback-Durchlauf neu
   pingen. Muster: obsidian-transmute src/obsidian/endpoint.ts.
   ========================================================== */
import { resolveActiveEndpointConfig, type EndpointConfig } from '../vendor/kit/endpoint_config';

export class ChatEndpointResolver {
  private cached: EndpointConfig | null = null;
  /** Laufender Resolve, geteilt — gleichzeitige Aufrufer pingen nicht mehrfach. */
  private pending: Promise<EndpointConfig | null> | null = null;

  constructor(
    private readonly getEndpoints: () => EndpointConfig[],
    private readonly ping: (cfg: EndpointConfig) => Promise<boolean>,
  ) {}

  /** Erster erreichbarer Endpunkt samt Schlüssel, gecacht bis invalidate().
   *  Ein Fehlschlag (null) wird NICHT gecacht — der nächste Versuch probiert erneut. */
  async resolve(): Promise<EndpointConfig | null> {
    if (this.cached !== null) return this.cached;
    if (this.pending) return this.pending;
    this.pending = resolveActiveEndpointConfig(this.getEndpoints(), this.ping)
      .then((ep) => {
        this.cached = ep;
        return ep;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  invalidate(): void {
    this.cached = null;
  }
}
