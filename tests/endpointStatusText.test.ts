/* ==========================================================
   endpointStatusText() — bilingualer Klartext für eine EndpointStatus-
   Diagnose. Der vendored classifyEndpointStatus() liefert nur ein
   deutsches klartext-Feld (dokumentiert Deutsch-only); dieses Plugin
   ist aber EN+DE, also läuft der Nutzer-Text durch die eigene i18n
   statt durch das Kit-Feld.
   ========================================================== */
import { endpointStatusText } from '../src/settings/endpointStatusText';

describe('endpointStatusText', () => {
  it('returns a distinct DE message per status kind', () => {
    const refused = endpointStatusText('refused', 'de');
    const unauthorized = endpointStatusText('unauthorized', 'de');
    expect(refused).not.toBe(unauthorized);
    expect(refused.length).toBeGreaterThan(0);
  });

  it('returns EN text for kind unauthorized, not the vendored German klartext', () => {
    const msg = endpointStatusText('unauthorized', 'en');
    expect(msg).toMatch(/key/i);
    expect(msg).not.toMatch(/Schlüssel/);
  });

  it('covers every non-ok EndpointStatusKind without falling back to the raw key', () => {
    const kinds = ['refused', 'unknown-host', 'timeout', 'not-an-llm-api', 'unauthorized', 'unknown'] as const;
    for (const kind of kinds) {
      expect(endpointStatusText(kind, 'de')).not.toContain('set.chatModel');
      expect(endpointStatusText(kind, 'en')).not.toContain('set.chatModel');
    }
  });
});
