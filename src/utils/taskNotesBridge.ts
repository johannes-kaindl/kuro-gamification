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
  return s && typeof s === 'object' ? s : null;
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

export interface PomodoroSession {
  kind: 'work' | 'break';
  /** ISO-Zeitpunkt, wenn TaskNotes einen mitliefert — sonst null. */
  completedAt: string | null;
}

export interface CompletedTask {
  path: string;
  completedAt: string | null;
}

/** Kuros EIGENE Aufgaben-Regel, aus den Einstellungen gebaut. */
export interface TaskRule {
  matchField: string;
  matchValue: string;
  statusField: string;
  doneValues: string[];
}

/** Baut die Regel aus den Einstellungen. Leere Felder ⇒ Quelle aus (s. Diagnose). */
export function taskRuleFromSettings(s: {
  taskMatchField: string; taskMatchValue: string;
  taskStatusField: string; taskDoneValues: string;
}): TaskRule {
  return {
    matchField: s.taskMatchField.trim(),
    matchValue: s.taskMatchValue.trim(),
    statusField: s.taskStatusField.trim() || 'status',
    doneValues: s.taskDoneValues.split(',').map((v) => v.trim()).filter((v) => v !== ''),
  };
}

/**
 * Liest TaskNotes' Pomodoro-Historie aus dessen Plugin-Speicher.
 *
 * Unterscheidet zwei Zustaende, die der Aufrufer NICHT verwechseln darf:
 *   null → keine lesbare Historie (Plugin weg, Feld fehlt, Form unerwartet)
 *   []   → Historie ist da und leer (noch keine Session abgeschlossen)
 * Die Diagnose macht daraus `is-error` bzw. `is-warning`.
 */
export async function readPomodoroSessions(
  app: App | null | undefined,
): Promise<PomodoroSession[] | null> {
  try {
    const plugin = (app as unknown as {
      plugins?: { plugins?: Record<string, { loadData?: () => Promise<unknown> }> };
    } | null | undefined)?.plugins?.plugins?.tasknotes;
    if (typeof plugin?.loadData !== 'function') return null;

    const data = await plugin.loadData() as { pomodoroHistory?: unknown } | null;
    const raw = data?.pomodoroHistory;
    if (!Array.isArray(raw)) return null;

    const out: PomodoroSession[] = [];
    for (const entry of raw) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (e.completed !== true) continue;
      const type = typeof e.type === 'string' ? e.type : '';
      const kind: PomodoroSession['kind'] | null =
        type === 'work' ? 'work'
          : (type === 'short-break' || type === 'long-break') ? 'break'
            : null;
      if (!kind) continue;
      out.push({ kind, completedAt: typeof e.endTime === 'string' ? e.endTime : null });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Sammelt abgeschlossene Aufgaben aus dem VAULT nach Kuros eigener Regel — nicht
 * aus dem Fremdplugin. Der Vault ist die belastbarere Quelle: er ueberlebt eine
 * Deaktivierung von TaskNotes, und Kuro liest ihn ohnehin.
 */
export function readCompletedTasks(app: App | null | undefined, rule: TaskRule): CompletedTask[] {
  try {
    if (!rule.matchField || !rule.matchValue || rule.doneValues.length === 0) return [];
    const a = app as unknown as {
      vault?: { getMarkdownFiles?: () => { path: string }[] };
      metadataCache?: { getCache?: (p: string) => { frontmatter?: Record<string, unknown> } | null };
    } | null | undefined;
    const files = a?.vault?.getMarkdownFiles?.();
    const cache = a?.metadataCache;
    if (!Array.isArray(files) || typeof cache?.getCache !== 'function') return [];

    const out: CompletedTask[] = [];
    for (const file of files) {
      const fm = cache.getCache(file.path)?.frontmatter;
      if (!fm) continue;
      if (!fieldHas(fm[rule.matchField], rule.matchValue)) continue;
      const status = fm[rule.statusField];
      if (typeof status !== 'string' || !rule.doneValues.includes(status.trim())) continue;
      out.push({ path: file.path, completedAt: completedAtOf(fm) });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Trifft der Wert? Ein Listenfeld (`tags: [aufgabe, brand]`) trifft, wenn EIN
 * Eintrag passt; ein Skalarfeld (`type: 💪 Aufgabe`) muss uebereinstimmen.
 * Dieselbe Regel deckt damit TaskNotes' tags/task UND ein type/-Schema ab, ohne
 * dass der Nutzer zwischen zwei Modi waehlen muss.
 */
function fieldHas(value: unknown, wanted: string): boolean {
  if (Array.isArray(value)) return value.some((v) => typeof v === 'string' && v.trim() === wanted);
  if (typeof value === 'string') {
    return value.trim() === wanted || value.split(/[,\s]+/).some((v) => v.trim() === wanted);
  }
  return false;
}

/** Erledigt-Datum, wenn eines der ueblichen Felder eines traegt — sonst null. */
function completedAtOf(fm: Record<string, unknown>): string | null {
  for (const key of ['completedDate', 'erledigt_am', 'completed']) {
    const v = fm[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return null;
}

export type TaskNotesEventKind = 'session' | 'task';

interface MinimalEmitter {
  on: (name: string, cb: (payload: unknown) => void) => unknown;
  offref: (ref: unknown) => void;
}

/**
 * Meldet sich an TaskNotes' Ereignisbus an. Rueckgabe ist die Abmeldung — sie MUSS
 * in onunload laufen, sonst haelt ein entladenes Kuro Handler auf einem fremden
 * Emitter.
 *
 * `task-updated` feuert bei JEDER Beruehrung einer Aufgabe. Gemeldet wird nur der
 * UEBERGANG (originalTask.status !== updatedTask.status), sonst laeuft die
 * Rueckmeldung bei jedem Tippen im Aufgaben-Frontmatter los.
 *
 * `pomodoro-interrupt` und `task-deleted` loesen Neuberechnung aus, aber nie einen
 * positiven Zuwachs — sie stehen hier, damit die Anzeige nach einem Abbruch stimmt,
 * nicht um zu bestrafen.
 */
export function subscribeTaskNotes(
  app: App | null | undefined,
  onEvent: (kind: TaskNotesEventKind) => void,
): () => void {
  const noop = () => { /* nichts angemeldet */ };
  try {
    const emitter = (app as unknown as {
      plugins?: { plugins?: Record<string, { emitter?: MinimalEmitter }> };
    } | null | undefined)?.plugins?.plugins?.tasknotes?.emitter;
    if (typeof emitter?.on !== 'function' || typeof emitter?.offref !== 'function') return noop;

    const refs: unknown[] = [
      emitter.on('pomodoro-complete', () => onEvent('session')),
      emitter.on('pomodoro-interrupt', () => onEvent('session')),
      emitter.on('task-deleted', () => onEvent('task')),
      emitter.on('task-updated', (payload: unknown) => {
        const p = payload as {
          originalTask?: { status?: unknown }; updatedTask?: { status?: unknown };
        } | null;
        if (!p) return;
        if (p.originalTask?.status === p.updatedTask?.status) return;
        onEvent('task');
      }),
    ];

    return () => {
      for (const ref of refs) {
        try { emitter.offref(ref); } catch { /* Anbieter schon weg */ }
      }
    };
  } catch {
    return noop;
  }
}
