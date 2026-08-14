/* ==========================================================
   migrateChatEndpoints() — hebt die alten Einzel-Settings
   (chatEndpoint/chatApiKey) auf die Kit-Liste chatEndpoints[].

   Die dokumentierte Falle: migrateEndpointList() (Kit) traegt nur die
   URL weiter, nie den Schluessel — ohne diesen Wrapper wuerde ein
   bestehender chatApiKey beim ersten Laden nach dem Umstieg stumm
   verschwinden (Cockpit-Notiz zum endpoint_config-Rollout).
   ========================================================== */
import { migrateChatEndpoints } from '../src/llm/migrateChatEndpoints';

describe('migrateChatEndpoints', () => {
  it('migrates a legacy single endpoint with no key', () => {
    expect(migrateChatEndpoints({ chatEndpoint: 'http://localhost:1234' }))
      .toEqual([{ url: 'http://localhost:1234' }]);
  });

  it('carries the legacy apiKey along — the trap migrateEndpointList alone misses', () => {
    expect(migrateChatEndpoints({ chatEndpoint: 'http://host', chatApiKey: 'sk-secret' }))
      .toEqual([{ url: 'http://host', apiKey: 'sk-secret' }]);
  });

  it('an already-migrated list wins over the legacy fields, untouched', () => {
    const eps = [{ url: 'https://openrouter.ai/api', apiKey: 'sk-x' }];
    expect(migrateChatEndpoints({ chatEndpoint: 'http://old', chatApiKey: 'old-key', chatEndpoints: eps }))
      .toEqual(eps);
  });

  it('no legacy endpoint and no list → empty', () => {
    expect(migrateChatEndpoints({})).toEqual([]);
  });

  it('legacy endpoint empty/whitespace → empty, key is not attached to nothing', () => {
    expect(migrateChatEndpoints({ chatEndpoint: '   ', chatApiKey: 'orphan' })).toEqual([]);
  });

  it('does not overwrite a key already present on the migrated single entry', () => {
    // Defensive: if a future shape ever put the key on chatEndpoints itself, the legacy
    // chatApiKey must never clobber it.
    expect(migrateChatEndpoints({
      chatEndpoint: 'http://host', chatApiKey: 'legacy',
      chatEndpoints: [{ url: 'http://host', apiKey: 'already-there' }],
    })).toEqual([{ url: 'http://host', apiKey: 'already-there' }]);
  });
});
