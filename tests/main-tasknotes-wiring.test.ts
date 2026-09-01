import { XpEngine } from '../src/engine/XpEngine';
import { DEFAULT_SETTINGS } from '../src/types';
import {
  readTaskNotesConfig, readCompletedTasks, taskRuleFromSettings,
} from '../src/utils/taskNotesBridge';

/**
 * Belegt die NAHT, nicht die Teile: was die Bruecke aus einem realistischen
 * App-Stub liest, muss durch aggregate() als XP wieder herauskommen.
 */
describe('Naht Bruecke → Engine', () => {
  const settings = { ...DEFAULT_SETTINGS, xpPerCompletedTask: 7 };

  function appWith(status: (path: string) => string) {
    return {
      plugins: {
        plugins: {
          tasknotes: {
            settings: {
              taskIdentificationMethod: 'tag',
              taskTag: 'task',
              fieldMapping: { status: 'status', completedDate: 'completedDate' },
              customStatuses: [
                { value: 'open', isCompleted: false },
                { value: 'done', isCompleted: true },
              ],
              pomodoroStorageLocation: 'plugin',
            },
          },
        },
      },
      vault: { getMarkdownFiles: () => [{ path: 'T/a.md' }, { path: 'T/b.md' }] },
      metadataCache: {
        getCache: (p: string) => ({ frontmatter: { tags: ['task'], status: status(p) } }),
      },
    } as never;
  }

  it('macht aus einer erledigten Aufgabe genau einen Satz XP', () => {
    const app = appWith((p) => (p === 'T/a.md' ? 'done' : 'open'));
    const config = readTaskNotesConfig(app);
    expect(config).not.toBeNull();
    const rule = taskRuleFromSettings(settings);
    const tasks = readCompletedTasks(app, rule);
    expect(tasks).toHaveLength(1);

    const res = XpEngine.aggregate({
      dailies: [], weeklies: [], manualXp: [], streakBonus: 0, settings,
      taskNotes: { config, rule, sessions: null, tasks, settings },
    });
    expect(res.totalXp).toBe(7);
    expect(res.rows.some((r) => r.source.includes('Aufgaben'))).toBe(true);
  });

  it('GEGENPROBE: ohne erledigten Status kommt nichts an — die Pruefung wirkt wirklich', () => {
    const app = appWith(() => 'open');
    const rule = taskRuleFromSettings(settings);
    const tasks = readCompletedTasks(app, rule);
    expect(tasks).toHaveLength(0);

    const res = XpEngine.aggregate({
      dailies: [], weeklies: [], manualXp: [], streakBonus: 0, settings,
      taskNotes: { config: readTaskNotesConfig(app), rule, sessions: null, tasks, settings },
    });
    expect(res.totalXp).toBe(0);
  });
});
