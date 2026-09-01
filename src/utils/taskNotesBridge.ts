/* ==========================================================
   Die einzige Stelle im Repo, die das TaskNotes-Plugin kennt.

   TaskNotes gibt KEINEN Vertrag: kein `apiVersion`, keine Zusage
   ueber die Form von `settings` oder Plugin-Speicher. Deshalb gilt
   hier die Konsumenten-Regel aus REGISTRY § Plugin-zu-Plugin in
   ihrer defensiven Auspraegung — bei jedem Zugriff frisch lesen,
   Form pruefen statt Existenz, nie werfen.

   Verwandt, aber bewusst getrennt: ../utils/taskNotesPomodoro.ts
   traegt den Frontmatter-Fallback und bleibt unveraendert.
   ========================================================== */
import type { App } from 'obsidian';

export type TaskIdentification =
  | { method: 'tag'; tag: string }
  | { method: 'property'; property: string; value: string };

export interface TaskNotesConfig {
  identification: TaskIdentification;
  statusField: string;
  completedDateField: string;
  /** Alle Statuswerte mit `isCompleted: true`. Es gibt KEINEN kanonischen Wert. */
  completedStatusValues: string[];
  pomodoroStorageLocation: string;
}

interface RawSettings {
  taskIdentificationMethod?: unknown;
  taskTag?: unknown;
  taskPropertyName?: unknown;
  taskPropertyValue?: unknown;
  fieldMapping?: { status?: unknown; completedDate?: unknown };
  customStatuses?: unknown;
  pomodoroStorageLocation?: unknown;
}

/** Frisch lesen, nie cachen: das Nachbarplugin kann mitten in der Sitzung weg sein. */
function rawSettings(app: App | null | undefined): RawSettings | null {
  const plugins = (app as unknown as {
    plugins?: { plugins?: Record<string, { settings?: unknown }> };
  } | null | undefined)?.plugins;
  const s = plugins?.plugins?.tasknotes?.settings;
  return s && typeof s === 'object' ? (s as RawSettings) : null;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback;
}

/**
 * Liest TaskNotes' Konfiguration, oder null, wenn das Plugin fehlt oder eine
 * unerwartete Form hat. Wirft nie.
 *
 * ⚠️ Das Ergebnis ist ein VORSCHLAG, keine Wahrheit. Woran Kuro eine Aufgabe
 * erkennt, steht in Kuros eigenen Einstellungen (`taskRuleFromSettings`) —
 * gemessen am 2026-09-01 passte TaskNotes' Konfiguration auf 17 Notizen im
 * Vault, waehrend 1194 Aufgaben nach einem anderen Schema danebenlagen. Wer
 * hier die Wahrheit vermutet, baut eine Quelle, die korrekt rechnet und nichts
 * findet.
 *
 * Genutzt wird das Ergebnis fuer zwei Dinge: den Uebernahme-Vorschlag im
 * Herkunfts-Panel und `pomodoroStorageLocation` (Sessions-Diagnose).
 */
export function readTaskNotesConfig(app: App | null | undefined): TaskNotesConfig | null {
  try {
    const s = rawSettings(app);
    if (!s) return null;

    const statuses = Array.isArray(s.customStatuses) ? s.customStatuses : null;
    if (!statuses) return null;
    const completedStatusValues = statuses
      .filter((e): e is { value: string; isCompleted: true } =>
        typeof e === 'object' && e !== null
        && (e as Record<string, unknown>).isCompleted === true
        && typeof (e as Record<string, unknown>).value === 'string')
      .map((e) => e.value);
    if (completedStatusValues.length === 0) return null;

    const identification: TaskIdentification = s.taskIdentificationMethod === 'property'
      ? {
        method: 'property',
        property: str(s.taskPropertyName, 'kind'),
        value: str(s.taskPropertyValue, 'task'),
      }
      : { method: 'tag', tag: str(s.taskTag, 'task') };

    return {
      identification,
      statusField: str(s.fieldMapping?.status, 'status'),
      completedDateField: str(s.fieldMapping?.completedDate, 'completedDate'),
      completedStatusValues,
      pomodoroStorageLocation: str(s.pomodoroStorageLocation, 'plugin'),
    };
  } catch {
    return null;
  }
}
