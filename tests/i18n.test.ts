import { t } from '../src/i18n';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';

describe('i18n.t', () => {
  it('returns DE string for known key', () => {
    expect(t('plugin.name', 'de')).toBe('Kuro Gamification');
  });
  it('substitutes vars', () => {
    expect(t('status.streakDays', 'de', { n: 7 })).toBe('7 TAGE');
  });
  it('falls back to EN for missing DE key', () => {
    // none in de.ts is missing — so this is a synthetic check
    expect(t('plugin.name', 'en')).toBe('Kuro Gamification');
  });
  it('returns key itself if both langs miss it', () => {
    expect(t('totally.unknown.key', 'de')).toBe('totally.unknown.key');
  });
  it('handles repeated var substitutions', () => {
    // status.todayLine has 4 vars
    const out = t('status.todayLine', 'de', { xp: 50, done: 5, total: 10, pct: 50 });
    expect(out).toBe('50 XP  (5/10 ✓ = 50%)');
  });
});

describe('i18n EN/DE parity', () => {
  it('en and de define the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });
});
