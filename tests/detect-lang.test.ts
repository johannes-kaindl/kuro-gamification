/* ==========================================================
   detectLang — map Obsidian's UI language (localStorage
   'language') to a supported Kuro language, English as fallback.
   ========================================================== */
import { detectLang } from '../src/i18n';

/** In-memory localStorage stub on globalThis (Obsidian runs in Electron, where it exists). */
const store: Record<string, string> = {};
const localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
beforeAll(() => { (globalThis as any).localStorage = localStorage; });
afterAll(() => { (globalThis as any).localStorage = undefined; });

describe('detectLang', () => {
  afterEach(() => localStorage.removeItem('language'));

  it('returns de when Obsidian UI is German', () => {
    localStorage.setItem('language', 'de');
    expect(detectLang()).toBe('de');
  });

  it('returns en when Obsidian UI is English', () => {
    localStorage.setItem('language', 'en');
    expect(detectLang()).toBe('en');
  });

  it('defaults to en when no language is set', () => {
    localStorage.removeItem('language');
    expect(detectLang()).toBe('en');
  });

  it('maps regional variants by prefix (de-DE -> de, pt-BR -> en)', () => {
    localStorage.setItem('language', 'de-DE');
    expect(detectLang()).toBe('de');
    localStorage.setItem('language', 'pt-BR');
    expect(detectLang()).toBe('en');
  });
});
