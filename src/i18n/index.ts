/* ==========================================================
   i18n — minimal lookup with positional {var} substitution.
   Falls back to English, then to the key itself.
   ========================================================== */
import { getLanguage } from 'obsidian';
import type { Lang } from '../types';
import { de } from './de';
import { en } from './en';

const dict: Record<Lang, Record<string, string>> = { de, en };

export function t(
  key: string,
  lang: Lang,
  vars: Record<string, string | number> = {},
): string {
  let s = dict[lang]?.[key] ?? dict.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/**
 * Detect a supported Kuro language from Obsidian's UI language
 * (`getLanguage()`, requires minAppVersion 1.8.7). Regional variants are
 * matched by prefix; anything unsupported falls back to English.
 */
export function detectLang(): Lang {
  let raw = '';
  try {
    raw = getLanguage().toLowerCase();
  } catch { raw = ''; }
  return raw.startsWith('de') ? 'de' : 'en';
}

export type { Lang };
