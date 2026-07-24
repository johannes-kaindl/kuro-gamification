/* ==========================================================
   ASCII progress bar — used inside <pre class="kuro-status">.
   ========================================================== */

export function progressBar(pct: number, width = 22): string {
  const clamped = Math.max(0, Math.min(1, pct));
  const filled = Math.round(clamped * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** Format integer with German thousand-grouping. */
export function fmtNum(n: number): string {
  return n.toLocaleString('de');
}
