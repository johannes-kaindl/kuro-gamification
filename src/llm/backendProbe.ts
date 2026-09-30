// uebernommen aus lingotuner/src/obsidian/http.ts (cachedProbe), 2026-09-30
/* ==========================================================
   Backend-Erkennung für die Sampling-Profile (Spec § 3.1) — pure, der Netzweg wird injiziert
   (Obsidians requestUrl läuft in Jest nicht). 30 s je URL zwischengespeichert (dieselbe Regel
   wie der Modelllisten-Cache), bei Änderung der URL verworfen.
   ========================================================== */
import { probeBaseUrl, probeEndpoint, type CapabilityFetch } from '../vendor/kit/capabilities';
import type { BackendId } from '../vendor/kit/sampling-profiles';

export const BACKEND_CACHE_MS = 30_000;

export function createBackendProbe(
  fetchJson: CapabilityFetch,
  now: () => number = Date.now,
): (url: string, model: string) => Promise<BackendId | null> {
  let cache: { url: string; backend: BackendId; at: number } | null = null;
  return async (url, model) => {
    const t = now();
    if (cache && cache.url === url && t - cache.at < BACKEND_CACHE_MS) return cache.backend;
    const { backend } = await probeEndpoint(fetchJson, probeBaseUrl(url), model);
    cache = { url, backend, at: t };
    return backend;
  };
}
