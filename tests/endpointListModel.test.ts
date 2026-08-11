/* ==========================================================
   Sprachfreie Kit-Ableitungen (EndpointStatusKind, EndpointRole,
   EndpointWarning-Regel) auf i18n-Schlüssel abbilden. Das Kit formuliert
   nicht (endpoint_diagnostics.klartext ist hart deutsch) — dieses Plugin
   ist EN+DE, jede Formulierung läuft über die eigene i18n.
   ========================================================== */
import { statusKindKey, warnRuleKey, roleKindKey } from '../src/settings/endpointListModel';

describe('statusKindKey', () => {
  it('maps every EndpointStatusKind to a distinct i18n key', () => {
    const kinds = ['ok', 'refused', 'unknown-host', 'timeout', 'not-an-llm-api', 'unauthorized', 'unknown'] as const;
    const keys = kinds.map(statusKindKey);
    expect(new Set(keys).size).toBe(kinds.length);
    for (const k of keys) expect(k.startsWith('set.epStatus.')).toBe(true);
  });
});

describe('warnRuleKey', () => {
  it('namespaces the validateEndpointInput rule', () => {
    expect(warnRuleKey('port')).toBe('set.epWarn.port');
  });
});

describe('roleKindKey', () => {
  it('maps every EndpointRole kind to a distinct i18n key', () => {
    expect(roleKindKey({ kind: 'active' })).toBe('set.epRole.active');
    expect(roleKindKey({ kind: 'standby', position: 2 })).toBe('set.epRole.standby');
    expect(roleKindKey({ kind: 'unreachable' })).toBe('set.epRole.unreachable');
    expect(roleKindKey({ kind: 'skipped-model' })).toBe('set.epRole.skipped-model');
  });
});
