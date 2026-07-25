/* ==========================================================
   readJsonFile — regression test for the silent no-op picker.

   Root cause (2026-07-20): the file input was created but never
   attached to the document. A detached <input type="file"> does
   not open the native dialog in Obsidian's Electron runtime —
   clicking "choose file" did nothing at all. The working
   reference (apple-health/src/obsidian/file-picker.ts) appends
   to doc.body before click(); this test locks that in.
   ========================================================== */
import { readJsonFile } from '../src/utils/fileIo';

/** Minimal fake Document that records whether the input was attached at click time. */
function makeFakeDoc() {
  const listeners: Record<string, Array<() => void>> = {};
  const children: any[] = [];
  let attachedOnClick: boolean | null = null;

  const input: any = {
    type: '',
    accept: '',
    files: null as any,
    addEventListener(ev: string, fn: () => void) {
      if (!listeners[ev]) listeners[ev] = [];
      listeners[ev].push(fn);
    },
    remove() {
      const i = children.indexOf(input);
      if (i >= 0) children.splice(i, 1);
    },
    click() { attachedOnClick = children.includes(input); },
  };

  const doc: any = {
    body: { createEl: (_tag: string, _o?: any) => { children.push(input); return input; } },
  };

  return {
    doc,
    input,
    children,
    fire: (ev: string) => { for (const fn of listeners[ev] ?? []) fn(); },
    attachedOnClick: () => attachedOnClick,
  };
}

describe('readJsonFile', () => {
  it('attaches the input to the document before clicking it (root cause of the silent no-op)', async () => {
    const f = makeFakeDoc();
    void readJsonFile(f.doc);
    expect(f.attachedOnClick()).toBe(true);
  });

  it('resolves the file text when a file is chosen', async () => {
    const f = makeFakeDoc();
    const promise = readJsonFile(f.doc);
    f.input.files = [{ text: async () => '{"kuroPack":1}' }];
    f.fire('change');
    await expect(promise).resolves.toBe('{"kuroPack":1}');
  });

  it('resolves null when the dialog is cancelled (promise must not dangle)', async () => {
    const f = makeFakeDoc();
    const promise = readJsonFile(f.doc);
    f.fire('cancel');
    await expect(promise).resolves.toBeNull();
  });

  it('removes the input from the document after use (no leak)', async () => {
    const f = makeFakeDoc();
    const promise = readJsonFile(f.doc);
    f.input.files = [{ text: async () => '{}' }];
    f.fire('change');
    await promise;
    expect(f.children).toHaveLength(0);
  });
});
