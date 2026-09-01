import { readTaskNotesConfig } from '../src/utils/taskNotesBridge';

/** Minimaler App-Stub: nur die Form, die die Bruecke wirklich anfasst. */
function appWith(settings: unknown): never {
  return { plugins: { plugins: { tasknotes: { settings } } } } as never;
}

const VOLLSTAENDIG = {
  taskIdentificationMethod: 'tag',
  taskTag: 'task',
  fieldMapping: { status: 'status', completedDate: 'completedDate' },
  customStatuses: [
    { value: 'open', isCompleted: false },
    { value: 'done', isCompleted: true },
    { value: 'cancelled', isCompleted: true },
  ],
  pomodoroStorageLocation: 'plugin',
};

describe('readTaskNotesConfig', () => {
  it('liest Identifikation, Felder und die als erledigt geltenden Status', () => {
    expect(readTaskNotesConfig(appWith(VOLLSTAENDIG))).toEqual({
      identification: { method: 'tag', tag: 'task' },
      statusField: 'status',
      completedDateField: 'completedDate',
      completedStatusValues: ['done', 'cancelled'],
      pomodoroStorageLocation: 'plugin',
    });
  });

  it('liefert null, wenn TaskNotes gar nicht da ist', () => {
    expect(readTaskNotesConfig({ plugins: { plugins: {} } } as never)).toBeNull();
    expect(readTaskNotesConfig(null)).toBeNull();
  });

  it('liefert null, wenn kein Status als erledigt gilt — dann waere jede Ableitung leer', () => {
    expect(readTaskNotesConfig(appWith({
      ...VOLLSTAENDIG,
      customStatuses: [{ value: 'open', isCompleted: false }],
    }))).toBeNull();
  });

  it('liefert null bei unerwarteter Form statt zu werfen', () => {
    expect(readTaskNotesConfig(appWith({ customStatuses: 'kaputt' }))).toBeNull();
    expect(readTaskNotesConfig(appWith(undefined))).toBeNull();
  });

  it('versteht die property-basierte Identifikation', () => {
    expect(readTaskNotesConfig(appWith({
      ...VOLLSTAENDIG,
      taskIdentificationMethod: 'property',
      taskPropertyName: 'kind',
      taskPropertyValue: 'task',
    }))?.identification).toEqual({ method: 'property', property: 'kind', value: 'task' });
  });
});

import {
  readPomodoroSessions, readCompletedTasks, taskRuleFromSettings,
} from '../src/utils/taskNotesBridge';
import type { TaskRule } from '../src/utils/taskNotesBridge';

const RULE: TaskRule = {
  matchField: 'tags', matchValue: 'task',
  statusField: 'status', doneValues: ['done'],
};

/** Johannes' Schema — der Fall, an dem der erste Entwurf gescheitert waere. */
const RULE_EIGEN: TaskRule = {
  matchField: 'type', matchValue: '💪 Aufgabe',
  statusField: 'status', doneValues: ['6_erledigt_✅'],
};

function appWithHistory(history: unknown): never {
  return {
    plugins: { plugins: { tasknotes: { loadData: async () => ({ pomodoroHistory: history }) } } },
  } as never;
}

describe('readPomodoroSessions', () => {
  it('trennt Arbeit von Pause und ignoriert unfertige Sessions', async () => {
    expect(await readPomodoroSessions(appWithHistory([
      { type: 'work', completed: true, endTime: '2026-09-01T09:00:00Z' },
      { type: 'short-break', completed: true, endTime: '2026-09-01T09:05:00Z' },
      { type: 'long-break', completed: true, endTime: '2026-09-01T10:00:00Z' },
      { type: 'work', completed: false, endTime: '2026-09-01T10:30:00Z' },
    ]))).toEqual([
      { kind: 'work', completedAt: '2026-09-01T09:00:00Z' },
      { kind: 'break', completedAt: '2026-09-01T09:05:00Z' },
      { kind: 'break', completedAt: '2026-09-01T10:00:00Z' },
    ]);
  });

  it('liefert null, wenn es keine lesbare Historie gibt', async () => {
    expect(await readPomodoroSessions(appWithHistory(undefined))).toBeNull();
    expect(await readPomodoroSessions(appWithHistory('kaputt'))).toBeNull();
  });

  it('unterscheidet "keine Historie" von "Historie ist leer"', async () => {
    expect(await readPomodoroSessions(appWithHistory([]))).toEqual([]);
  });
});

describe('readCompletedTasks', () => {
  function appWithNotes(notes: { path: string; tags: string[]; fm: Record<string, unknown> }[]): never {
    return {
      vault: { getMarkdownFiles: () => notes.map((n) => ({ path: n.path })) },
      metadataCache: {
        getCache: (path: string) => {
          const n = notes.find((x) => x.path === path);
          return n ? { frontmatter: { tags: n.tags, ...n.fm } } : null;
        },
      },
    } as never;
  }

  it('zaehlt nur passende Notizen mit erledigtem Status (Listenfeld)', () => {
    expect(readCompletedTasks(appWithNotes([
      { path: 'T/a.md', tags: ['task'], fm: { status: 'done', completedDate: '2026-09-01' } },
      { path: 'T/b.md', tags: ['task'], fm: { status: 'open' } },
      { path: 'N/c.md', tags: ['note'], fm: { status: 'done', completedDate: '2026-09-01' } },
    ]), RULE)).toEqual([{ path: 'T/a.md', completedAt: '2026-09-01' }]);
  });

  it('traegt AUCH ein Skalarfeld — der real gemessene Fall', () => {
    expect(readCompletedTasks(appWithNotes([
      { path: 'A/a.md', tags: ['aufgabe'], fm: { type: '💪 Aufgabe', status: '6_erledigt_✅', erledigt_am: '2026-08-14' } },
      { path: 'A/b.md', tags: ['aufgabe'], fm: { type: '💪 Aufgabe', status: '3_in_arbeit_🏃' } },
    ]), RULE_EIGEN)).toEqual([{ path: 'A/a.md', completedAt: '2026-08-14' }]);
  });

  it('kommt ohne Erledigt-Datum aus', () => {
    expect(readCompletedTasks(appWithNotes([
      { path: 'T/a.md', tags: ['task'], fm: { status: 'done' } },
    ]), RULE)).toEqual([{ path: 'T/a.md', completedAt: null }]);
  });

  it('zaehlt NICHTS, wenn die Regel unvollstaendig ist — statt alles zu zaehlen', () => {
    expect(readCompletedTasks(appWithNotes([
      { path: 'T/a.md', tags: ['task'], fm: { status: 'done' } },
    ]), { matchField: '', matchValue: '', statusField: 'status', doneValues: [] })).toEqual([]);
  });

  it('liefert eine leere Liste statt zu werfen, wenn der Cache nichts hergibt', () => {
    expect(readCompletedTasks({} as never, RULE)).toEqual([]);
  });
});

describe('taskRuleFromSettings', () => {
  it('zerlegt die kommagetrennten Erledigt-Werte und wirft Leeres weg', () => {
    expect(taskRuleFromSettings({
      taskMatchField: 'type', taskMatchValue: '💪 Aufgabe',
      taskStatusField: 'status', taskDoneValues: '6_erledigt_✅, done ,',
    }).doneValues).toEqual(['6_erledigt_✅', 'done']);
  });
});

import { subscribeTaskNotes } from '../src/utils/taskNotesBridge';

describe('subscribeTaskNotes', () => {
  function emitterApp() {
    const handlers: Record<string, ((p: unknown) => void)[]> = {};
    const refs: unknown[] = [];
    const off: unknown[] = [];
    const emitter = {
      on: (ev: string, cb: (p: unknown) => void) => {
        if (!handlers[ev]) handlers[ev] = [];
        handlers[ev].push(cb);
        const ref = { ev };
        refs.push(ref);
        return ref;
      },
      offref: (ref: unknown) => { off.push(ref); },
      trigger: (ev: string, payload?: unknown) => { for (const h of handlers[ev] ?? []) h(payload); },
    };
    return { app: { plugins: { plugins: { tasknotes: { emitter } } } } as never, emitter, refs, off };
  }

  it('meldet sich auf die vier relevanten Ereignisse an', () => {
    const { app, refs } = emitterApp();
    subscribeTaskNotes(app, () => {});
    expect(refs).toHaveLength(4);
  });

  it('ruft den Handler bei einer abgeschlossenen Session', () => {
    const { app, emitter } = emitterApp();
    const seen: string[] = [];
    subscribeTaskNotes(app, (kind) => seen.push(kind));
    emitter.trigger('pomodoro-complete', { session: { type: 'work' } });
    expect(seen).toEqual(['session']);
  });

  it('ruft ihn beim UEBERGANG nach erledigt — nicht bei jeder Beruehrung', () => {
    const { app, emitter } = emitterApp();
    const seen: string[] = [];
    subscribeTaskNotes(app, (kind) => seen.push(kind));
    emitter.trigger('task-updated', { originalTask: { status: 'open' }, updatedTask: { status: 'done' } });
    emitter.trigger('task-updated', { originalTask: { status: 'done' }, updatedTask: { status: 'done' } });
    expect(seen).toEqual(['task']);
  });

  it('meldet alles wieder ab', () => {
    const { app, refs, off } = emitterApp();
    subscribeTaskNotes(app, () => {})();
    expect(off).toEqual(refs);
  });

  it('liefert eine no-op-Abmeldung, wenn TaskNotes fehlt — kein Wurf beim Laden', () => {
    expect(() => subscribeTaskNotes({ plugins: { plugins: {} } } as never, () => {})()).not.toThrow();
  });
});
