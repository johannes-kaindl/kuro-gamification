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
});
