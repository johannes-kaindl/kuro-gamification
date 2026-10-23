/* ==========================================================
   Zahlenfelder im Notiz-Kopf der Tagesnotiz (z. B. "aufgaben: 10") — pure.
   Eine Regel für zwei Leser: der Kontext-Auszug (Chat) und die XP-Rechnung
   lesen dieselbe Einstellung (`parseNumberFields`) und denselben Zahlenleser
   (`parseNumeric` aus code-kit `num`, vendort unter `src/vendor/kit/num.ts`).
   ========================================================== */

export interface NumberField {
  /** Frontmatter field name (e.g. "aufgaben"). */
  key: string;
  /** Anzeigename im Kontext-Auszug; ohne Angabe der Feldname. */
  label: string;
}

/**
 * Die Einstellung ist ein Text: Einträge durch Komma oder Zeilenumbruch getrennt, je
 * Eintrag `feld` oder `feld=Anzeigename`. Leere Einträge und ein wiederholtes Feld fallen weg.
 */
export function parseNumberFields(text: string): NumberField[] {
  const out: NumberField[] = [];
  const seen = new Set<string>();
  for (const item of text.split(/[,\n]/)) {
    const eq = item.indexOf('=');
    const key = (eq < 0 ? item : item.slice(0, eq)).trim();
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    const label = eq < 0 ? '' : item.slice(eq + 1).trim();
    out.push({ key, label: label === '' ? key : label });
  }
  return out;
}
