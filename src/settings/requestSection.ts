// uebernommen aus lingotuner/src/obsidian/settings-tab.ts (renderRequestSection), 2026-09-30
/* ==========================================================
   Abschnitt „Anfrage“ (Sampling-Profile, Modus companion): dünner Anschluss an das Kit-Modul
   `buildRequestSection`. Formuliert nichts selbst — Texte aus `src/i18n` (Präfix `request.`),
   Abweichungen aus `llm/requestText.ts`.
   ========================================================== */
import type KuroPlugin from '../main';
import { t } from '../i18n';
import type { Lang } from '../types';
import { MODE } from '../llm/requestSettings';
import { deviationDetail, fieldStateText } from '../llm/requestText';
import { buildRequestSection } from '../vendor/kit-obsidian/request-section';
import { BACKENDS, FAMILIES, type BackendId, type FamilyId } from '../vendor/kit/sampling-profiles';

export function renderRequestSection(
  containerEl: HTMLElement, plugin: KuroPlugin, lang: Lang, rerender: () => void,
): void {
  buildRequestSection({
    containerEl,
    modes: [MODE],
    state: () => plugin.requestSectionState(),
    settings: () => plugin.data.settings.request,
    save: (s) => plugin.saveRequestSettings(s),
    maxTokens: () => undefined,
    session: plugin.requestSession,
    rerender,
    strings: {
      title: t('request.title', lang),
      head: (family, familySource, backend, backendSource) => {
        const famLabel = family === '—' ? '—' : (FAMILIES[family as FamilyId]?.label ?? family);
        const backLabel = backend === 'unknown' ? t('request.backend.unknown', lang) : (BACKENDS[backend as BackendId]?.label ?? backend);
        return t('request.head', lang, {
          family: famLabel,
          familySource: t(`request.familySource.${familySource}`, lang),
          backend: backLabel,
          backendSource: t(`request.backendSource.${backendSource}`, lang),
        });
      },
      unknownFamily: t('request.unknownFamily', lang),
      jitWarning: (model, defaultModel) => t('request.jitWarning', lang, { model, defaultModel }),
      sentAs: (model) => t('request.sentAs', lang, { model }),
      modeHeading: (mode) => t(`request.mode.${mode}`, lang),
      fieldName: (field) => t(`request.field.${field}`, lang),
      fieldDesc: (e) => fieldStateText(e, lang),
      reset: t('request.reset', lang),
      thinkingLevel: t('request.thinkingLevel', lang),
      level: (l) => t(`request.level.${l}`, lang),
      levelPicker: t('request.levelPicker', lang),
      levelPickerDesc: t('request.levelPickerDesc', lang),
      dormant: (fam) => t('request.dormant', lang, {
        family: fam === 'unknown' ? t('request.familySource.none', lang) : (FAMILIES[fam]?.label ?? fam),
      }),
      deleteDormant: t('request.deleteDormant', lang),
      lastRequest: t('request.lastRequest', lang),
      lastRequestNone: t('request.lastRequestNone', lang),
      copy: t('request.copy', lang),
      copied: t('request.copied', lang),
      deviationsOk: t('request.deviationsOk', lang),
      deviationsWarn: (n) => t('request.deviationsWarn', lang, { n }),
      deviation: (kind, count, detail) => `${deviationDetail(kind, lang, detail)} (${count}×)`,
    },
  });
}
