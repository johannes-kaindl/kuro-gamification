import {
  sourceStateClass, sourceStateIcon, taskRuleSuggestion,
} from '../src/engine/TaskNotesXp';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';

describe('Abbildung Zustand → UI-STANDARD §8-Vokabel', () => {
  it('nutzt ausschliesslich die vier erlaubten Klassen', () => {
    expect(sourceStateClass('ok')).toBe('is-ok');
    expect(sourceStateClass('off')).toBe('is-warning');
    expect(sourceStateClass('empty')).toBe('is-warning');
    expect(sourceStateClass('unavailable')).toBe('is-error');
  });

  it('nutzt ausschliesslich die feste Icon-Vokabel', () => {
    expect(sourceStateIcon('ok')).toBe('circle-check');
    expect(sourceStateIcon('off')).toBe('alert-triangle');
    expect(sourceStateIcon('empty')).toBe('alert-triangle');
    expect(sourceStateIcon('unavailable')).toBe('circle-x');
  });
});

describe('i18n-Deckung der Diagnose-Codes', () => {
  it('hat fuer jeden reason-Code einen Text in beiden Sprachen', () => {
    for (const c of ['counting', 'rate-zero', 'no-tasks', 'no-sessions',
      'no-rule', 'no-history', 'storage-plugin', 'superseded']) {
      expect(Object.keys(de)).toContain(`src.reason.${c}`);
      expect(Object.keys(en)).toContain(`src.reason.${c}`);
    }
  });

  it('hat fuer jede Quelle einen Namen', () => {
    for (const id of ['tasks', 'work', 'break', 'frontmatterPomodoro']) {
      expect(Object.keys(de)).toContain(`src.${id}`);
      expect(Object.keys(en)).toContain(`src.${id}`);
    }
  });
});

describe('taskRuleSuggestion', () => {
  const CFG = {
    identification: { method: 'tag' as const, tag: 'task' },
    statusField: 'status', completedDateField: 'completedDate',
    completedStatusValues: ['done'], pomodoroStorageLocation: 'plugin',
  };

  it('schweigt, wenn die eigene Regel schon dasselbe sagt', () => {
    expect(taskRuleSuggestion(CFG, {
      matchField: 'tags', matchValue: 'task', statusField: 'status', doneValues: ['done'],
    })).toBeNull();
  });

  it('schweigt, wenn TaskNotes nichts hergibt', () => {
    expect(taskRuleSuggestion(null, {
      matchField: 'type', matchValue: 'x', statusField: 'status', doneValues: ['y'],
    })).toBeNull();
  });

  it('schlaegt vor, wenn die eigene Regel abweicht', () => {
    expect(taskRuleSuggestion(CFG, {
      matchField: 'type', matchValue: '💪 Aufgabe',
      statusField: 'status', doneValues: ['6_erledigt_✅'],
    })).toEqual({
      field: 'tags', value: 'task', statusField: 'status', doneValues: 'done',
    });
  });

  it('uebersetzt die property-Identifikation ins eigene Feldpaar', () => {
    expect(taskRuleSuggestion({
      ...CFG, identification: { method: 'property', property: 'kind', value: 'aufgabe' },
    }, {
      matchField: 'tags', matchValue: 'task', statusField: 'status', doneValues: ['done'],
    })).toMatchObject({ field: 'kind', value: 'aufgabe' });
  });
});
