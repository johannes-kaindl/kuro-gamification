/* ==========================================================
   DOM helpers — typed wrappers for createEl-style construction.
   ========================================================== */

export function createPre(parent: HTMLElement, cls: string, text: string): HTMLPreElement {
  const pre = parent.createEl('pre', { cls, text });
  return pre;
}

export function createButton(
  parent: HTMLElement,
  text: string,
  onClick: () => void,
  cls = 'kuro-btn',
): HTMLButtonElement {
  const btn = parent.createEl('button', { cls, text });
  btn.addEventListener('click', onClick);
  return btn;
}

/** Empty an HTMLElement of all children. */
export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}
