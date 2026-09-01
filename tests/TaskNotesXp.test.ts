import { diagnoseSources } from '../src/engine/TaskNotesXp';
import type { TaskNotesInput } from '../src/engine/TaskNotesXp';
import { DEFAULT_SETTINGS } from '../src/types';

const CFG = {
  identification: { method: 'tag' as const, tag: 'task' },
  statusField: 'status',
  completedDateField: 'completedDate',
  completedStatusValues: ['done'],
  pomodoroStorageLocation: 'plugin',
};

const RULE = { matchField: 'tags', matchValue: 'task', statusField: 'status', doneValues: ['done'] };

function input(over: Partial<TaskNotesInput> = {}): TaskNotesInput {
  return {
    config: CFG,
    rule: RULE,
    sessions: [],
    tasks: [],
    settings: {
      ...DEFAULT_SETTINGS,
      xpPerCompletedTask: 10, xpPerWorkSession: 10, xpPerBreakSession: 5,
    },
    ...over,
  };
}

const stateOf = (d: ReturnType<typeof diagnoseSources>, id: string) => d.find((x) => x.id === id);

describe('diagnoseSources', () => {
  it('meldet ok, wenn Quelle lesbar ist UND der Satz groesser 0', () => {
    const d = diagnoseSources(input({
      tasks: [{ path: 'a.md', completedAt: '2026-09-01' }],
      sessions: [{ kind: 'work', completedAt: null }],
    }));
    expect(stateOf(d, 'tasks')?.state).toBe('ok');
    expect(stateOf(d, 'work')?.state).toBe('ok');
  });

  it('meldet off, wenn die Quelle lesbar ist, der Satz aber 0 — der stille Zustand', () => {
    const d = diagnoseSources(input({
      settings: { ...DEFAULT_SETTINGS, xpPerCompletedTask: 0 },
      tasks: [{ path: 'a.md', completedAt: null }],
    }));
    expect(stateOf(d, 'tasks')).toMatchObject({ state: 'off', reason: 'rate-zero' });
  });

  it('meldet empty, wenn die Quelle da ist, aber noch nichts geliefert hat', () => {
    expect(stateOf(diagnoseSources(input({ sessions: [] })), 'work'))
      .toMatchObject({ state: 'empty', reason: 'no-sessions' });
  });

  it('meldet die Sessions als unavailable, wenn TaskNotes fehlt', () => {
    expect(stateOf(diagnoseSources(input({ config: null, sessions: null })), 'work'))
      .toMatchObject({ state: 'unavailable', reason: 'no-history' });
  });

  it('laesst die Aufgaben-Quelle laufen, auch wenn TaskNotes fehlt — sie liest nur den Vault', () => {
    const d = diagnoseSources(input({
      config: null, sessions: null, tasks: [{ path: 'a.md', completedAt: null }],
    }));
    expect(stateOf(d, 'tasks')?.state).toBe('ok');
  });

  it('meldet unavailable, wenn KUROS Regel unvollstaendig ist', () => {
    const d = diagnoseSources(input({
      rule: { matchField: '', matchValue: '', statusField: 'status', doneValues: [] },
    }));
    expect(stateOf(d, 'tasks')).toMatchObject({ state: 'unavailable', reason: 'no-rule' });
  });

  it('meldet den Frontmatter-Bonus als strukturell tot, wenn TaskNotes im Plugin speichert', () => {
    expect(stateOf(diagnoseSources(input({ sessions: null })), 'frontmatterPomodoro'))
      .toMatchObject({ state: 'unavailable', reason: 'storage-plugin' });
  });

  it('meldet ihn als abgeloest, sobald der Speicher lesbar ist', () => {
    const d = diagnoseSources(input({
      config: { ...CFG, pomodoroStorageLocation: 'daily-notes' },
      sessions: [{ kind: 'work', completedAt: null }],
    }));
    expect(stateOf(d, 'frontmatterPomodoro')).toMatchObject({ state: 'off', reason: 'superseded' });
  });

  it('laesst ihn laufen, wenn es keinen lesbaren Speicher gibt', () => {
    const d = diagnoseSources(input({
      config: { ...CFG, pomodoroStorageLocation: 'daily-notes' }, sessions: null,
    }));
    expect(stateOf(d, 'frontmatterPomodoro')?.state).toBe('ok');
  });

  it('gibt Codes zurueck, nie uebersetzten Text — die Formulierung gehoert dem Aufrufer', () => {
    for (const d of diagnoseSources(input({ config: null, sessions: null }))) {
      expect(d.reason).toMatch(/^[a-z-]+$/);
    }
  });
});
