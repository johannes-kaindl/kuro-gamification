/**
 * @jest-environment @happy-dom/jest-environment
 */
/* Linkschutz-Wächter (`attachDomGuard`, vom Kit gevendort): die Härtungs-Fälle des Kit-Bausteins `dom-guard-probe` gegen die Kopie, die das Plugin ausliefert.
   Die Gegenprobe (ein Wächter, der nichts tut) muss rot werden, sonst misst der erste Test nichts (CORE-TEST-01). */
import { attachDomGuard } from '../src/vendor/kit-obsidian/dom-guard';
import { probeDomGuard } from './vendor/kit/dom-guard-probe';

describe('Linkschutz-Wächter', () => {
  it('hält jeden Fall des Kit-Bausteins', async () => {
    const r = await probeDomGuard(attachDomGuard);
    expect(r.length).toBeGreaterThan(0);
    expect(r.filter((x) => x.state !== 'held')).toEqual([]);
  });

  it('Gegenprobe: ein Wächter, der nichts tut, lässt Fälle durch', async () => {
    const r = await probeDomGuard(() => ({ disconnect() {} }));
    expect(r.filter((x) => x.state === 'leak').length).toBeGreaterThan(0);
  });
});
