/* ==========================================================
   Checkbox counting — pure markdown, callout-aware.
   Counts both top-level "- [ ]" and callout-nested "> - [ ]".
   ========================================================== */

export interface CheckboxStats {
  total: number;
  done: number;
  pct: number;     // 0..1
}

const TOTAL_RX = /^[ \t>]*[-*+] \[[ xX>~\-/!?]\]/gm;
const DONE_RX  = /^[ \t>]*[-*+] \[[xX]\]/gm;

export function countCheckboxes(content: string): CheckboxStats {
  const total = (content.match(TOTAL_RX) || []).length;
  const done  = (content.match(DONE_RX)  || []).length;
  return { total, done, pct: total > 0 ? done / total : 0 };
}
