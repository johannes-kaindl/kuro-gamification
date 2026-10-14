/* Jeder Diagnose-Grund muss mit seinen Fakten einen Text ohne offene Platzhalter ergeben —
   in beiden Sprachen. Anlass: der Frontmatter-Bonus zeigte „{rate} XP je Stück, {count} bisher“ roh. */
import { diagnoseSources } from '../src/engine/TaskNotesXp';
import type { TaskNotesInput } from '../src/engine/TaskNotesXp';
import { DEFAULT_SETTINGS } from '../src/types';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { t } from '../src/i18n';

const CFG = (loc: string) => ({
  identification: { method: 'tag' as const, tag: 'task' },
  statusField: 'status', completedDateField: 'completedDate',
  completedStatusValues: ['done'], pomodoroStorageLocation: loc,
});
const RULES = {
  full: { matchField: 'tags', matchValue: 'task', statusField: 'status', doneValues: ['done'] },
  incomplete: { matchField: '', matchValue: '', statusField: 'status', doneValues: [] },
};
const SESSIONS = { null: null, empty: [], work: [{ kind: 'work' as const, completedAt: null }] };

function scenarios(): TaskNotesInput[] {
  const out: TaskNotesInput[] = [];
  for (const loc of [null, 'plugin', 'daily-notes'])
    for (const sess of Object.values(SESSIONS))
      for (const rate of [0, 10])
        for (const rule of Object.values(RULES))
          for (const tasks of [[], [{ path: 'a.md', completedAt: null }]])
            out.push({
              config: loc === null ? null : CFG(loc),
              rule, sessions: sess, tasks,
              settings: { ...DEFAULT_SETTINGS, xpPerCompletedTask: rate, xpPerWorkSession: rate, xpPerBreakSession: rate },
            });
  return out;
}

describe('src.reason.* — Platzhalter', () => {
  it.each(['en', 'de'] as const)('füllt in %s jede Kombination aus Grund und Fakten vollständig', (lang) => {
    for (const inp of scenarios()) {
      for (const d of diagnoseSources(inp)) {
        const text = t(`src.reason.${d.reason}`, lang, d.facts);
        expect(text).not.toMatch(/\{\w+\}/);
        expect(text).not.toBe(`src.reason.${d.reason}`);
      }
    }
  });

  it('jeder src.reason.*-Schlüssel wird von mindestens einem Szenario erzeugt', () => {
    const produced = new Set<string>();
    for (const inp of scenarios()) for (const d of diagnoseSources(inp)) produced.add(d.reason);
    const defined = Object.keys(en).filter((k) => k.startsWith('src.reason.')).map((k) => k.slice(11));
    expect(defined.sort()).toEqual([...produced].sort());
    expect(Object.keys(de).filter((k) => k.startsWith('src.reason.')).length).toBe(defined.length);
  });
});

describe('Sessions in der Tagesnotiz (pomodoroStorageLocation: daily-notes)', () => {
  const base = (rate: number): TaskNotesInput => ({
    config: CFG('daily-notes'), rule: RULES.full, sessions: null, tasks: [],
    settings: { ...DEFAULT_SETTINGS, xpPerWorkSession: rate, xpPerBreakSession: rate },
  });
  const row = (d: ReturnType<typeof diagnoseSources>, id: string) => d.find((x) => x.id === id);

  it('Satz 0: ein Hinweis, keine Fehlerzeile', () => {
    const d = diagnoseSources(base(0));
    expect(row(d, 'work')).toMatchObject({ state: 'off', reason: 'in-daily-notes' });
    expect(row(d, 'break')).toMatchObject({ state: 'off', reason: 'in-daily-notes' });
  });

  it('Satz > 0: bleibt ein Fehler, weil der Satz nie greift', () => {
    expect(row(diagnoseSources(base(10)), 'work')).toMatchObject({ state: 'unavailable', reason: 'no-history' });
  });

  it('ohne lesbare TaskNotes-Konfiguration bleibt es unavailable, sobald ein Satz gesetzt ist', () => {
    const inp = { ...base(10), config: null };
    expect(row(diagnoseSources(inp), 'work')).toMatchObject({ state: 'unavailable', reason: 'no-history' });
  });

  it('Frontmatter-Bonus nennt Schlüssel, Schwelle und Satz', () => {
    const d = row(diagnoseSources(base(0)), 'frontmatterPomodoro');
    expect(d).toMatchObject({ state: 'ok', reason: 'counting-daily' });
    expect(d?.facts).toEqual({
      key: DEFAULT_SETTINGS.pomodoroFrontmatterKey,
      threshold: DEFAULT_SETTINGS.pomodoroThreshold,
      rate: DEFAULT_SETTINGS.pomodoroBonus,
    });
  });
});

describe('Quelle nicht lesbar, aber Satz 0 — ein Hinweis, keine Fehlerzeile', () => {
  const inp = (over: Partial<TaskNotesInput>): TaskNotesInput => ({
    config: null, rule: RULES.incomplete, sessions: null, tasks: [],
    settings: { ...DEFAULT_SETTINGS, xpPerCompletedTask: 0, xpPerWorkSession: 0, xpPerBreakSession: 0 },
    ...over,
  });
  const byId = (i: TaskNotesInput, id: string) => diagnoseSources(i).find((d) => d.id === id)!;

  it('Arbeitssessions und Pausen ohne TaskNotes: off statt unavailable', () => {
    for (const id of ['work', 'break']) {
      const d = byId(inp({}), id);
      expect(d.state).toBe('off');
      expect(d.reason).toBe('no-history-rate-zero');
    }
  });
  it('Aufgaben mit unvollständiger Regel und Satz 0: off statt unavailable', () => {
    const d = byId(inp({}), 'tasks');
    expect(d.state).toBe('off');
    expect(d.reason).toBe('no-rule-rate-zero');
  });
  it('Gegenprobe: mit Satz > 0 bleibt dieselbe Lage ein Fehler', () => {
    const s = { ...DEFAULT_SETTINGS, xpPerWorkSession: 10, xpPerBreakSession: 10, xpPerCompletedTask: 10 };
    for (const id of ['work', 'break', 'tasks']) {
      expect(byId(inp({ settings: s }), id).state).toBe('unavailable');
    }
  });
});
