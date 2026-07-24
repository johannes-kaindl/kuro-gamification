import { countCheckboxes } from '../src/utils/checkboxes';
import { progressBar, fmtNum } from '../src/utils/progressBar';
import { seededShuffle } from '../src/utils/seededRandom';
import { isIsoDate, isIsoWeek, formatIso, formatYearMonth, subDays } from '../src/utils/dateUtils';

describe('countCheckboxes', () => {
  it('counts plain markdown checkboxes', () => {
    const md = '- [ ] foo\n- [x] bar\n- [ ] baz';
    expect(countCheckboxes(md)).toEqual({ total: 3, done: 1, pct: 1 / 3 });
  });
  it('counts uppercase X', () => {
    expect(countCheckboxes('- [X] yes').done).toBe(1);
  });
  it('counts callout-nested checkboxes', () => {
    const md = '> [!focus]+ today\n> - [ ] foo\n> - [x] bar';
    expect(countCheckboxes(md)).toEqual({ total: 2, done: 1, pct: 0.5 });
  });
  it('counts mixed list markers', () => {
    const md = '* [ ] foo\n+ [x] bar\n- [ ] baz';
    expect(countCheckboxes(md)).toEqual({ total: 3, done: 1, pct: 1 / 3 });
  });
  it('returns 0/0/0 for empty content', () => {
    expect(countCheckboxes('')).toEqual({ total: 0, done: 0, pct: 0 });
  });
});

describe('progressBar', () => {
  it('renders empty bar at 0%', () => {
    expect(progressBar(0, 5)).toBe('░░░░░');
  });
  it('renders full bar at 100%', () => {
    expect(progressBar(1, 5)).toBe('█████');
  });
  it('renders half bar at 50%', () => {
    expect(progressBar(0.5, 4)).toBe('██░░');
  });
  it('clamps over 100%', () => {
    expect(progressBar(99, 3)).toBe('███');
  });
});

describe('fmtNum', () => {
  it('formats with German thousands separator', () => {
    expect(fmtNum(1234)).toMatch(/^1[.\s\u202f]234$/);
  });
});

describe('seededShuffle', () => {
  it('produces same output for same seed', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(seededShuffle(arr, 42)).toEqual(seededShuffle(arr, 42));
  });
  it('differs across seeds', () => {
    const arr = [1, 2, 3, 4, 5];
    const a = seededShuffle(arr, 1);
    const b = seededShuffle(arr, 99999);
    expect(a).not.toEqual(b);
  });
  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = seededShuffle(arr, 7).sort();
    expect(out).toEqual([1, 2, 3, 4, 5]);
  });
  it('does not mutate input', () => {
    const arr = [1, 2, 3];
    seededShuffle(arr, 1);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('date utils', () => {
  it('isIsoDate matches YYYY-MM-DD', () => {
    expect(isIsoDate('2026-04-24')).toBe(true);
    expect(isIsoDate('2026-4-24')).toBe(false);
    expect(isIsoDate('today')).toBe(false);
  });
  it('isIsoWeek matches YYYY-Www', () => {
    expect(isIsoWeek('2026-W17')).toBe(true);
    expect(isIsoWeek('2026-W7')).toBe(false);
  });
  it('formatIso pads month and day', () => {
    expect(formatIso(new Date(2026, 3, 4))).toBe('2026-04-04');
  });
  it('formatYearMonth pads month', () => {
    expect(formatYearMonth(new Date(2026, 0, 24))).toBe('2026-01');
  });
  it('subDays subtracts days correctly', () => {
    const d = new Date(2026, 3, 24);
    expect(formatIso(subDays(d, 5))).toBe('2026-04-19');
  });
});
