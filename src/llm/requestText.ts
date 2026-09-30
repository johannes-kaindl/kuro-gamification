// uebernommen aus lingotuner/src/core/request-text.ts, 2026-09-30 (plus fieldStateText aus lingotuner/src/obsidian/settings-tab.ts, hier pure; Sprache je Aufruf statt global)
/* ==========================================================
   Textbausteine für den Abschnitt „Anfrage“ und die Abweichungs-Notice (Spec § 5.3): eine
   Zuordnung, die Session-Notice UND Statuszeile nutzen — nie zweimal formuliert. Pure.
   ========================================================== */
import { t } from '../i18n';
import type { Lang } from '../types';
import type { Deviation, DeviationKind, FieldExplain } from '../vendor/kit/sampling-profiles';

const KEY: Record<DeviationKind, string> = {
  'thinking-despite-off': 'request.dev.thinkingDespiteOff',
  'empty-by-budget': 'request.dev.emptyByBudget',
  'family-mismatch': 'request.dev.familyMismatch',
  'family-detected': 'request.dev.familyDetected',
  'rejected': 'request.dev.rejected',
};
const DETAIL_VAR: Record<DeviationKind, string> = {
  'thinking-despite-off': 'detail', 'empty-by-budget': 'detail',
  'family-mismatch': 'family', 'family-detected': 'family', 'rejected': 'detail',
};

export function deviationDetail(kind: DeviationKind, lang: Lang, detail?: string): string {
  return t(KEY[kind], lang, detail !== undefined ? { [DETAIL_VAR[kind]]: detail } : {});
}

/** Notice-Text: nur für Abweichungen mit `affectsResult` aufgerufen (Vertrag von
 *  `createRequestSession`). */
export function deviationNotice(d: Deviation, lang: Lang): string {
  return `${deviationDetail(d.kind, lang, d.detail)} ${t('request.dev.seeSettings', lang)}`;
}

/** Beschreibungszeile je Feld: Zustand plus optionale Notiz. */
export function fieldStateText(e: FieldExplain, lang: Lang): string {
  const key = {
    'sent-effective': 'request.state.sentEffective',
    'sent-unproven': 'request.state.sentUnproven',
    'not-sent-ignored': 'request.state.notSentIgnored',
    'not-sent-unsupported': 'request.state.notSentUnsupported',
    'not-sent-unknown-family': 'request.state.notSentUnknownFamily',
    'not-sent-no-value': 'request.state.notSentNoValue',
  }[e.state];
  let s = t(key, lang);
  const noteKey = e.note ? {
    'raised-to-reserve': 'request.note.raisedToReserve',
    'raised-to-thinking-floor': 'request.note.raisedToThinkingFloor',
    'below-thinking-floor': 'request.note.belowThinkingFloor',
    'off-not-possible': 'request.note.offNotPossible',
  }[e.note] : undefined;
  if (noteKey) s += ` ${t(noteKey, lang)}`;
  if (e.field === 'top_p') s += t('request.top_p.hint', lang);
  return s;
}
