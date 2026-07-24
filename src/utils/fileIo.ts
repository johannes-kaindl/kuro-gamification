// src/utils/fileIo.ts
/* ==========================================================
   Browser file I/O for pack import/export. DOM-only glue.
   downloadJson triggers a .json download; readJsonFile opens
   the OS file picker and resolves the chosen file's text.
   ========================================================== */

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Opens the native file dialog and resolves the chosen file's text
 * (null on cancel or read error).
 *
 * The input MUST be attached to the document before click() — a detached
 * <input type="file"> silently does nothing in Obsidian's Electron runtime.
 * Pass the owning Document (e.g. `contentEl.ownerDocument`) so this also
 * works in pop-out windows. Pattern mirrors apple-health's file-picker.
 */
export function readJsonFile(doc: Document): Promise<string | null> {
  return new Promise((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    doc.body.appendChild(input);

    const cleanup = (): void => { input.remove(); };

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      if (!file) { resolve(null); return; }
      file.text().then(resolve).catch(() => resolve(null));
    }, { once: true });

    // Fires when the dialog is dismissed without a choice. Without this the
    // promise would dangle forever on cancel.
    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    }, { once: true });

    input.click();
  });
}
