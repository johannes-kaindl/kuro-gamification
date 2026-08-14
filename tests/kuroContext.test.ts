import { buildDailyExtract, renderDailyExtract, buildContext } from '../src/llm/kuroContext';
import { DEFAULT_SETTINGS, type KuroSettings, type KuroSnapshot } from '../src/types';

const settings = (over: Partial<KuroSettings> = {}): KuroSettings => ({
  ...DEFAULT_SETTINGS,
  habits: [
    { key: 'qigong', label: '🧘 Qi Gong', xp: 10 },
    { key: 'meditation', label: '🧘 Meditation', xp: 10 },
  ],
  ...over,
});

const DAILY = [
  '---',
  'qigong: true',
  'meditation: false',
  '---',
  '# 2026-08-04',
  '## Aufgaben',
  '- [x] Steuerunterlagen sortieren',
  '- [ ] Arzttermin ausmachen',
  '## Journal',
  'Heute war schwer. Das Gespräch mit M. geht mir nach.',
].join('\n');

const SNAP: KuroSnapshot = {
  computedAt: '2026-08-04T10:00:00.000Z',
  totalXp: 1234,
  currentLevel: { level: 5, title: 'FESTER GRUND', xp: 1000 },
  nextLevel: { level: 6, title: 'WEITER', xp: 1500 },
  xpToNext: 266,
  pctToNext: 0.46,
  streak: 12,
  streakBonus: 30,
  freezeTokens: 2,
  todayXp: 40,
  todayDone: 1,
  todayTotal: 2,
  todayPct: 0.5,
  availableDrops: 1,
  redeemedDrops: 3,
  lootOptions: null,
  lootTier: null,
  loreFragment: { level: 5, title: 'FESTER GRUND', text: 'Das ist fester Boden jetzt.' },
  breakdown: [],
};

describe('buildDailyExtract', () => {
  it('returns nothing in none mode', () => {
    const x = buildDailyExtract(DAILY, settings({ chatDailyContext: 'none' }));
    expect(x.tasks).toEqual([]);
    expect(x.habits).toEqual([]);
    expect(x.raw).toBeNull();
  });

  it('extracts checkbox lines and habit fields in tasks mode', () => {
    const x = buildDailyExtract(DAILY, settings({ chatDailyContext: 'tasks' }));
    expect(x.tasks).toEqual(['[x] Steuerunterlagen sortieren', '[ ] Arzttermin ausmachen']);
    expect(x.habits).toEqual(['🧘 Qi Gong: ja', '🧘 Meditation: nein']);
  });

  it('leaves journal prose out in tasks mode', () => {
    const x = buildDailyExtract(DAILY, settings({ chatDailyContext: 'tasks' }));
    expect(renderDailyExtract(x)).not.toContain('Gespräch mit M.');
  });

  it('carries the whole note in full mode', () => {
    const x = buildDailyExtract(DAILY, settings({ chatDailyContext: 'full' }));
    expect(x.raw).toBe(DAILY);
    expect(renderDailyExtract(x)).toContain('Gespräch mit M.');
  });

  it('handles a missing daily note', () => {
    const x = buildDailyExtract(null, settings({ chatDailyContext: 'tasks' }));
    expect(x.tasks).toEqual([]);
    expect(x.habits).toEqual([]);
  });

  it('handles an empty daily note', () => {
    expect(buildDailyExtract('', settings()).tasks).toEqual([]);
  });

  it('ignores habit keys that are absent from the frontmatter', () => {
    const x = buildDailyExtract('---\nqigong: true\n---\n', settings());
    expect(x.habits).toEqual(['🧘 Qi Gong: ja']);
  });

  it('counts callout-nested checkboxes too', () => {
    const x = buildDailyExtract('> - [ ] im Callout', settings());
    expect(x.tasks).toEqual(['[ ] im Callout']);
  });

  it('recognizes asterisk list markers', () => {
    expect(buildDailyExtract('* [ ] mit Stern', settings()).tasks).toEqual(['[ ] mit Stern']);
  });
});

describe('renderDailyExtract', () => {
  it('is empty in none mode', () => {
    expect(renderDailyExtract(buildDailyExtract(DAILY, settings({ chatDailyContext: 'none' }))))
      .toBe('');
  });

  it('lists tasks and habits as bullets', () => {
    const out = renderDailyExtract(buildDailyExtract(DAILY, settings()));
    expect(out).toContain('- [ ] Arzttermin ausmachen');
    expect(out).toContain('- 🧘 Qi Gong: ja');
  });
});

describe('buildContext', () => {
  it('reports level, streak and today progress', () => {
    const out = buildContext(SNAP, DAILY, settings());
    expect(out).toContain('FESTER GRUND');
    expect(out).toContain('12');
    expect(out).toContain('Arzttermin ausmachen');
  });

  it('works without a snapshot', () => {
    expect(buildContext(null, DAILY, settings())).toContain('Arzttermin ausmachen');
  });

  it('omits the daily section entirely in none mode', () => {
    const out = buildContext(SNAP, DAILY, settings({ chatDailyContext: 'none' }));
    expect(out).not.toContain('Arzttermin');
    expect(out).toContain('FESTER GRUND');
  });

  it('returns an empty string when there is nothing at all', () => {
    expect(buildContext(null, null, settings())).toBe('');
  });

  it('handles a maxed-out level without a next level', () => {
    const out = buildContext({ ...SNAP, nextLevel: null }, null, settings());
    expect(out).toContain('FESTER GRUND');
  });
});
