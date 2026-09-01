import { XpEngine } from '../src/engine/XpEngine';
import { DEFAULT_SETTINGS } from '../src/types';

const S = { ...DEFAULT_SETTINGS, xpPerCompletedTask: 10, enableXpFromHabits: true };
const RULE = { matchField: 'tags', matchValue: 'task', statusField: 'status', doneValues: ['done'] };
const CFG = {
  identification: { method: 'tag' as const, tag: 'task' },
  statusField: 'status', completedDateField: 'completedDate',
  completedStatusValues: ['done'], pomodoroStorageLocation: 'plugin',
};

describe('XpEngine.aggregate mit TaskNotes-Quellen', () => {
  it('addiert die TaskNotes-XP zum Rest', () => {
    const res = XpEngine.aggregate({
      dailies: [], weeklies: [], manualXp: [], streakBonus: 0, settings: S,
      taskNotes: {
        config: CFG, rule: RULE, sessions: null,
        tasks: [{ path: 'a.md', completedAt: null }], settings: S,
      },
    });
    expect(res.totalXp).toBe(10);
    expect(res.rows.some((r) => r.source.includes('Aufgaben'))).toBe(true);
  });

  it('bleibt ohne das Feld unveraendert — Rueckwaertskompatibilitaet', () => {
    expect(XpEngine.aggregate({
      dailies: [], weeklies: [], manualXp: [], streakBonus: 7, settings: S,
    }).totalXp).toBe(7);
  });
});

describe('Vorrang: der Frontmatter-Bonus schweigt, sobald der Speicher zaehlt', () => {
  const daily = {
    date: '2026-09-01',
    stats: { done: 0, total: 0, pct: 0 },
    frontmatter: {
      pomodoros: [
        { type: 'work', completed: true }, { type: 'work', completed: true },
        { type: 'work', completed: true }, { type: 'work', completed: true },
      ],
    },
  };

  it('gibt den Bonus ohne Unterdrueckung', () => {
    expect(XpEngine.computeDaily(daily, S).xp).toBe(S.pomodoroBonus);
  });

  it('gibt ihn NICHT, wenn unterdrueckt — die Gegenprobe daneben beweist, dass der Schalter wirkt', () => {
    const r = XpEngine.computeDaily(daily, S, { suppressPomodoroBonus: true });
    expect(r.xp).toBe(0);
    expect(r.rows).toHaveLength(0);
  });

  it('greift der Vorrang auch durch aggregate hindurch', () => {
    const mit = XpEngine.aggregate({
      dailies: [daily], weeklies: [], manualXp: [], streakBonus: 0, settings: S,
      taskNotes: {
        config: { ...CFG, pomodoroStorageLocation: 'daily-notes' }, rule: RULE,
        sessions: [{ kind: 'work' as const, completedAt: null }], tasks: [], settings: S,
      },
    });
    const ohne = XpEngine.aggregate({
      dailies: [daily], weeklies: [], manualXp: [], streakBonus: 0, settings: S,
    });
    expect(ohne.totalXp).toBe(S.pomodoroBonus);
    expect(mit.totalXp).toBe(0);
  });
});
