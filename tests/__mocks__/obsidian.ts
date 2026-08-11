/* Minimal Obsidian mock for unit tests. Add only what's used. */

export class TFile {
  path: string;
  basename: string;
  extension = 'md';
  constructor(path: string) {
    this.path = path;
    this.basename = path.split('/').pop()!.replace('.md', '');
  }
}

export class TFolder {
  path: string;
  children: any[] = [];
  constructor(path: string) {
    this.path = path;
  }
}

export class TAbstractFile {
  path = '';
}

export class Plugin {
  app: any;
  manifest: any = { version: '1.0.0' };
  constructor() { this.app = {}; }
  loadData(): Promise<any> { return Promise.resolve(null); }
  saveData(_d: any): Promise<void> { return Promise.resolve(); }
  registerEvent(_e: any): void {}
  registerView(_t: any, _f: any): void {}
  registerMarkdownCodeBlockProcessor(_a: any, _b: any): void {}
  addCommand(_c: any): void {}
  addRibbonIcon(_a: any, _b: any, _c: any): void {}
  addStatusBarItem(): any { return { setText() {}, addClass() {}, addEventListener() {}, detach() {} }; }
  addSettingTab(_t: any): void {}
}

export class Modal {
  app: any;
  contentEl: any = makeFakeEl();
  titleEl: any = makeFakeEl();
  constructor(app: any) { this.app = app; }
  open() {}
  close() {}
}

export class Notice {
  constructor(_msg: string) {}
}

export class AbstractInputSuggest<T> {
  constructor(_app: any, _el: any) {}
  setValue(_v: string): void {}
  close(): void {}
}

export class Setting {
  constructor(_el: any) {}
  setName(_n: string) { return this; }
  setDesc(_d: string) { return this; }
  addToggle(_cb: any) { return this; }
  addText(_cb: any) { return this; }
  addDropdown(_cb: any) { return this; }
  addButton(_cb: any) { return this; }
  addExtraButton(_cb: any) { return this; }
}

export class PluginSettingTab {
  app: any;
  containerEl: any = makeFakeEl();
  constructor(_app: any, _plugin: any) {}
  display(): void {}
}

export class ItemView {
  app: any;
  containerEl: any = makeFakeEl();
  leaf: any;
  constructor(leaf: any) { this.leaf = leaf; }
}

export const setIcon = (_el: any, _name: string) => {};
export const normalizePath = (s: string) => s;
/** Tests overwrite this with their own jest.fn() per case (no shared jest dep in this mock file). */
export let requestUrl: (req: any) => Promise<any> = () => Promise.reject(new Error('requestUrl not mocked'));
export function __setMockRequestUrl(fn: (req: any) => Promise<any>): void { requestUrl = fn; }
export function debounce<T extends (...args: any[]) => any>(fn: T, _ms: number, _i: boolean): T {
  return fn;
}

/** Mutable stub for `getLanguage()` — tests set it via `__setMockLanguage`. */
let mockLanguage = 'en';
export function getLanguage(): string { return mockLanguage; }
export function __setMockLanguage(lang: string): void { mockLanguage = lang; }

function makeFakeEl(): any {
  const el: any = {
    children: [] as any[],
    classes: new Set<string>(),
    style: {},
    text: '',
  };
  el.firstChild = null;
  el.firstElementChild = null;
  el.empty = () => { el.children = []; };
  el.setText = (s: string) => { el.text = s; };
  el.appendText = (s: string) => { el.text += s; };
  el.addClass = (c: string) => { el.classes.add(c); };
  el.removeClass = (c: string) => { el.classes.delete(c); };
  el.hasClass = (c: string) => el.classes.has(c);
  el.toggleClass = (c: string, on: boolean) => {
    if (on) el.classes.add(c); else el.classes.delete(c);
  };
  el.setAttr = (_k: string, _v: string) => {};
  el.createEl = (_tag: string, opts?: any) => {
    const child = makeFakeEl();
    if (opts?.text) child.setText(opts.text);
    // `cls` darf mehrere Klassen tragen ("a b") — wie im echten DOM einzeln ablegen.
    if (opts?.cls) child.classes = new Set(String(opts.cls).split(/\s+/).filter(Boolean));
    el.children.push(child);
    return child;
  };
  el.createDiv = (opts?: any) => el.createEl('div', opts);
  el.createSpan = (opts?: any) => el.createEl('span', opts);
  el.appendChild = (c: any) => { el.children.push(c); };
  el.removeChild = (_c: any) => { el.children.shift(); };
  el.addEventListener = (_e: string, _fn: any) => {};
  return el;
}

export class MarkdownView {}
export class WorkspaceLeaf {}
export type MarkdownPostProcessorContext = any;
export type App = any;
