/* ==========================================================
   Hebt die alten Einzel-Chat-Settings (chatEndpoint/chatApiKey) auf die
   Kit-Liste chatEndpoints[]. migrateEndpointList() (Kit) trägt dabei nur
   die URL weiter, nie einen Schlüssel — ohne diesen Wrapper würde ein
   bestehender chatApiKey beim ersten Laden nach dem Umstieg stumm
   verschwinden.
   ========================================================== */
import { migrateEndpointList, type EndpointConfig } from '../vendor/kit/endpoint_config';

export interface LegacyChatSettings {
  chatEndpoint?: unknown;
  chatApiKey?: unknown;
  chatEndpoints?: unknown;
}

export function migrateChatEndpoints(raw: LegacyChatSettings): EndpointConfig[] {
  const rawList = Array.isArray(raw.chatEndpoints)
    ? raw.chatEndpoints as (string | EndpointConfig)[]
    : undefined;
  const legacyUrl = typeof raw.chatEndpoint === 'string' ? raw.chatEndpoint : undefined;
  const migrated = migrateEndpointList(legacyUrl, rawList);

  const usedLegacySingle = !rawList || rawList.length === 0;
  const legacyKey = typeof raw.chatApiKey === 'string' ? raw.chatApiKey.trim() : '';
  if (usedLegacySingle && legacyKey && migrated.length === 1 && !migrated[0].apiKey) {
    return [{ ...migrated[0], apiKey: legacyKey }];
  }
  return migrated;
}
