import { DEFAULT_HABITS_DE, DEFAULT_HABITS_EN, defaultHabits } from '../src/data/default-habits';

describe('defaultHabits', () => {
  it('returns the German set for de', () => {
    expect(defaultHabits('de')).toEqual(DEFAULT_HABITS_DE);
  });
  it('returns the English set for en', () => {
    expect(defaultHabits('en')).toEqual(DEFAULT_HABITS_EN);
  });
  it('returns fresh deep copies (not the shared constant)', () => {
    const a = defaultHabits('en');
    expect(a).not.toBe(DEFAULT_HABITS_EN);
    a[0].xp = 999;
    expect(DEFAULT_HABITS_EN[0].xp).toBe(10);
  });
  it('ships five generic starter habits with neutral keys', () => {
    expect(DEFAULT_HABITS_EN.map((h) => h.key)).toEqual(['water', 'move', 'outside', 'tidy', 'connect']);
    expect(DEFAULT_HABITS_DE.map((h) => h.key)).toEqual(['water', 'move', 'outside', 'tidy', 'connect']);
  });
});
