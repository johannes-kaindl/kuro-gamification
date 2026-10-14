import { noEndpointText } from '../src/utils/chatErrors';

describe('noEndpointText', () => {
  it.each([
    ['secret-missing', 'en', 'API key'],
    ['disabled', 'en', 'switched off'],
    ['not-found', 'de', 'existiert im LLM Endpoint Manager nicht mehr'],
    ['unreachable', 'de', 'antwortet nicht'],
    ['no-endpoint', 'en', 'no usable endpoint'],
  ] as const)('Code %s (%s) nennt die Stelle, nicht den allgemeinen Satz', (code, lang, part) => {
    const text = noEndpointText(code, lang, 'manager');
    expect(text).toContain(part);
    expect(text).not.toBe(noEndpointText('irgendeine Konfigurationsmeldung', lang, 'manager'));
  });

  it('eine Konfigurationsmeldung (kein Code) bleibt beim allgemeinen Satz', () => {
    expect(noEndpointText('URL fehlt', 'en', 'manager')).toBe('No endpoint from the list is reachable — check the settings.');
    expect(noEndpointText('URL fehlt', 'de', 'manager')).toBe('Kein Endpunkt aus der Liste ist erreichbar — Einstellungen prüfen.');
  });

  it('Quelle lokal: auch ein Code-förmiger Grund bleibt beim Satz zur Liste (kein Manager im Spiel)', () => {
    expect(noEndpointText('no-endpoint', 'en', 'local')).toBe('No endpoint from the list is reachable — check the settings.');
    expect(noEndpointText('no-endpoint', 'en', undefined)).toBe('No endpoint from the list is reachable — check the settings.');
  });
});
