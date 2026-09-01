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
