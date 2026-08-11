/* ==========================================================
   Sprachfreie Kit-Ableitungen (EndpointStatusKind, EndpointRole,
   Warn-Regel) auf i18n-Schlüssel abbilden. Das Kit formuliert bewusst
   nicht selbst — endpoint_diagnostics.klartext ist hart deutsch,
   dieses Plugin ist EN+DE.
   ========================================================== */
import type { EndpointStatusKind } from '../vendor/kit/endpoint_diagnostics';
import type { EndpointRole } from '../vendor/kit/endpoint_config';

export function statusKindKey(kind: EndpointStatusKind): string {
  return `set.epStatus.${kind}`;
}

export function warnRuleKey(rule: string): string {
  return `set.epWarn.${rule}`;
}

export function roleKindKey(role: EndpointRole): string {
  return `set.epRole.${role.kind}`;
}
