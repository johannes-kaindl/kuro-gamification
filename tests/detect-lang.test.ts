/* ==========================================================
   detectLang — map Obsidian's UI language (getLanguage())
   to a supported Kuro language, English as fallback.
   ========================================================== */
import { detectLang } from '../src/i18n';
import { __setMockLanguage } from 'obsidian';

describe('detectLang', () => {
  afterEach(() => __setMockLanguage('en'));

  it('returns de when Obsidian UI is German', () => {
    __setMockLanguage('de');
    expect(detectLang()).toBe('de');
  });

  it('returns en when Obsidian UI is English', () => {
    __setMockLanguage('en');
    expect(detectLang()).toBe('en');
  });

  it('defaults to en when no language is set', () => {
    __setMockLanguage('');
    expect(detectLang()).toBe('en');
  });

  it('maps regional variants by prefix (de-DE -> de, pt-BR -> en)', () => {
    __setMockLanguage('de-DE');
    expect(detectLang()).toBe('de');
    __setMockLanguage('pt-BR');
    expect(detectLang()).toBe('en');
  });
});
