/* ==========================================================
   Bilingualer Klartext für eine EndpointStatus-Diagnose.

   classifyEndpointStatus() (vendored) liefert ein `klartext`-Feld,
   das laut eigenem Kommentar deutsch-only ist — dieses Plugin ist
   aber EN+DE (README: "all user-facing strings via the i18n module"),
   daher läuft der angezeigte Text durch die eigene i18n statt durch
   das Kit-Feld. `klartext` bleibt für den (englischsprachigen)
   Logger-Aufruf brauchbar, geht aber nie in die UI.
   ========================================================== */
import type { EndpointStatusKind } from '../vendor/kit/endpoint_diagnostics';
import type { Lang } from '../types';
import { t } from '../i18n';

const KEY_BY_KIND: Record<Exclude<EndpointStatusKind, 'ok'>, string> = {
  refused: 'set.chatModel.status.refused',
  'unknown-host': 'set.chatModel.status.unknownHost',
  timeout: 'set.chatModel.status.timeout',
  'not-an-llm-api': 'set.chatModel.status.notAnLlmApi',
  unauthorized: 'set.chatModel.status.unauthorized',
  unknown: 'set.chatModel.status.unknown',
};

export function endpointStatusText(kind: Exclude<EndpointStatusKind, 'ok'>, lang: Lang): string {
  return t(KEY_BY_KIND[kind], lang);
}
