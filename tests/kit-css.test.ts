/* Kit-CSS-Wächter (obsidian-kit MIGRATION § 0.51.0): jede gevendorte `*_CSS`-Konstante steht wortgleich in
   `styles.css` — der Kit-Vertrag verlangt die Kopie, und eine Kopie driftet still. */
import { readFileSync } from 'node:fs';
import { findVendoredCss, missingKitCss } from './vendor/kit/kit-css';

const vendorDir = 'src/vendor/kit-obsidian';

describe('Kit-CSS in styles.css', () => {
  it('findet die gevendorten Konstanten und jede steht wortgleich in styles.css', () => {
    expect(findVendoredCss(vendorDir).length).toBeGreaterThan(0);
    expect(missingKitCss(vendorDir, readFileSync('styles.css', 'utf8'))).toEqual([]);
  });
  it('MODEL_BAR_CSS steht vor CHAT_WINDOW_CSS (Kit 0.73.0, seit 0.74.0 kein Zwang mehr, die Reihenfolge des Piloten bleibt)', () => {
    const css = readFileSync('styles.css', 'utf8');
    const marker = (name: string): number => css.indexOf(`(${name}), obsidian-kit`);
    expect(marker('MODEL_BAR_CSS')).toBeGreaterThan(-1);
    expect(marker('CHAT_WINDOW_CSS')).toBeGreaterThan(-1);
    expect(marker('MODEL_BAR_CSS')).toBeLessThan(marker('CHAT_WINDOW_CSS'));
  });

  it('CHAT_ARCHIVE_CSS ist kopiert, weil das Chat-Fenster den Verlauf zeigt (Option archive)', () => {
    const names = findVendoredCss(vendorDir).map((c) => c.name);
    expect(names).toContain('CHAT_ARCHIVE_CSS');
    expect(missingKitCss(vendorDir, readFileSync('styles.css', 'utf8'))).not.toContain('CHAT_ARCHIVE_CSS');
  });

  it('die alte Regel .okit-chat-buttons ist weg (die Klasse gibt es seit Kit 0.74.0 nicht mehr)', () => {
    expect(readFileSync('styles.css', 'utf8')).not.toMatch(/\.okit-chat-buttons\s*\{/);
  });
});
