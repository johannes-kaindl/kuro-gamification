/* ==========================================================
   chatErrors — Text für „kein Endpunkt“ im Companion-Chat.
   Ein Code des LLM Endpoint Managers (`secret-missing`, `disabled`, …) bekommt
   seinen eigenen Text, der die Stelle nennt, an der es zu beheben ist; alles
   andere (etwa eine Konfigurationsmeldung) bleibt beim allgemeinen Satz.
   ========================================================== */
import type { Lang } from '../types';
import { t } from '../i18n';
import {
  isManagerErrorCode,
  LLM_CONNECTION_STRINGS_DE,
  LLM_CONNECTION_STRINGS_EN,
  managerErrorText,
} from '../vendor/kit-obsidian/llm-connection-strings';

/** `sourceKind`: `result.source.kind` — nur ein Grund des MANAGERS hat einen Manager-Text; bei der lokalen Liste bleibt der Satz zur Liste. */
export function noEndpointText(detail: string, lang: Lang, sourceKind: string | undefined): string {
  if (sourceKind !== 'manager' || !isManagerErrorCode(detail)) return t('chat.err.noEndpoint', lang);
  return managerErrorText(lang === 'de' ? LLM_CONNECTION_STRINGS_DE : LLM_CONNECTION_STRINGS_EN, detail);
}
