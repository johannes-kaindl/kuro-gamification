/* ==========================================================
   Modell-Liste + Erreichbarkeits-Diagnose eines Chat-Endpunkts —
   pure, kein Obsidian-Import. Der Transport wird injiziert (Obsidians
   requestUrl lässt sich in Jest nicht ausführen), analog zu
   KuroChatClient/SseTransport.

   Ersetzt den bisherigen main.ts-Pfad, der jeden Fehler in [] ertränkte:
   classifyEndpointStatus() (bereits vendored, bis dahin ungenutzt) liefert
   einen benannten Grund statt eines stillen Leer-Ergebnisses.
   ========================================================== */
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { classifyEndpointStatus, type EndpointStatus, type ProbeInput } from '../vendor/kit/endpoint_diagnostics';
import { parseModelList } from './modelList';

export interface ModelsTransport {
  get(url: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }>;
}

export interface ProbeModelsResult {
  status: EndpointStatus;
  models: string[];
}

export async function probeModels(
  cfg: { endpoint: string; apiKey: string },
  transport: ModelsTransport,
): Promise<ProbeModelsResult> {
  const url = `${normalizeEndpoint(cfg.endpoint)}/v1/models`;
  const headers: Record<string, string> = {};
  if (cfg.apiKey !== '') headers.Authorization = `Bearer ${cfg.apiKey}`;

  let input: ProbeInput;
  try {
    const res = await transport.get(url, headers);
    input = { kind: 'response', status: res.status, body: res.body };
  } catch (e) {
    input = { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }

  const status = classifyEndpointStatus(input);
  const models = status.reachable && input.kind === 'response' ? parseModelList(input.body) : [];
  return { status, models };
}
