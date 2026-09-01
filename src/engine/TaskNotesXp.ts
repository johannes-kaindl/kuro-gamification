/* ==========================================================
   XP aus TaskNotes-Ereignissen — pur, kein obsidian-Import.

   Die Diagnose hier ist die EINZIGE Wahrheit darueber, welche
   Quelle zaehlt: sowohl die Rechnung (computeTaskNotesXp) als
   auch das Herkunfts-Panel lesen sie. Zwei getrennte Urteile
   wuerden driften und "beruhigend etwas anderes zeigen, als
   tatsaechlich passiert" (AGENTS.md, Companion-Chat-Regel).
   ========================================================== */
import type { KuroSettings, KuroXpBreakdownRow } from '../types';
import type {
  TaskNotesConfig, TaskRule, PomodoroSession, CompletedTask,
} from '../utils/taskNotesBridge';

export type SourceId = 'tasks' | 'work' | 'break' | 'frontmatterPomodoro';

/**
 * ok          → zaehlt
 * off         → koennte, tut aber bewusst nicht (Satz 0, oder abgeloest)
 * empty       → Quelle da, hat noch nichts geliefert
 * unavailable → kann strukturell nicht zaehlen
 */
export type SourceState = 'ok' | 'off' | 'empty' | 'unavailable';

export interface SourceDiagnosis {
  id: SourceId;
  state: SourceState;
  /** Maschinencode, nie uebersetzter Text. Der Renderer waehlt die Formulierung. */
  reason: string;
  /** Zahlen fuer die Formulierung (Satz, Anzahl) — keine Saetze. */
  facts: Record<string, string | number>;
}

export interface TaskNotesInput {
  /** TaskNotes' Konfiguration — nur fuer den Uebernahme-Vorschlag und den
   *  Pomodoro-Speicherort. NICHT die Wahrheit ueber Aufgaben (s. `rule`). */
  config: TaskNotesConfig | null;
  /** Kuros eigene Aufgaben-Regel. Sie allein entscheidet, was eine Aufgabe ist. */
  rule: TaskRule;
  /** null = keine lesbare Historie; [] = lesbar und leer. Der Unterschied ist tragend. */
  sessions: PomodoroSession[] | null;
  tasks: CompletedTask[];
  settings: KuroSettings;
}

export function diagnoseSources(inp: TaskNotesInput): SourceDiagnosis[] {
  const s = inp.settings;
  const sessionsReadable = inp.sessions !== null;
  const work = (inp.sessions ?? []).filter((x) => x.kind === 'work').length;
  const brk = (inp.sessions ?? []).filter((x) => x.kind === 'break').length;

  // Die Aufgaben-Quelle haengt an KUROS Regel, nicht an TaskNotes: sie liest nur
  // den Vault. Ein deaktiviertes TaskNotes nimmt ihr nichts.
  const ruleComplete = inp.rule.matchField !== '' && inp.rule.matchValue !== ''
    && inp.rule.doneValues.length > 0;

  return [
    rate('tasks', s.xpPerCompletedTask, ruleComplete, inp.tasks.length, 'no-rule', 'no-tasks'),
    rate('work', s.xpPerWorkSession, sessionsReadable, work, 'no-history', 'no-sessions'),
    rate('break', s.xpPerBreakSession, sessionsReadable, brk, 'no-history', 'no-sessions'),
    frontmatterState(inp, sessionsReadable),
  ];
}

/** Ein Zustand pro Quelle, in fester Reihenfolge: erreichbar? → Satz? → Daten? */
function rate(
  id: SourceId, xpRate: number, available: boolean, count: number,
  unavailableReason: string, emptyReason: string,
): SourceDiagnosis {
  if (!available) return { id, state: 'unavailable', reason: unavailableReason, facts: {} };
  if (xpRate <= 0) return { id, state: 'off', reason: 'rate-zero', facts: { count } };
  if (count === 0) return { id, state: 'empty', reason: emptyReason, facts: { rate: xpRate } };
  return { id, state: 'ok', reason: 'counting', facts: { rate: xpRate, count } };
}

/**
 * Der Frontmatter-Bonus hat drei Enden statt zwei — und das mittlere ist der
 * gemessene Defekt: TaskNotes speichert im Plugin, Kuro liest die Tagesnotiz,
 * niemand sagt es.
 */
function frontmatterState(inp: TaskNotesInput, sessionsReadable: boolean): SourceDiagnosis {
  const id: SourceId = 'frontmatterPomodoro';
  if (sessionsReadable) return { id, state: 'off', reason: 'superseded', facts: {} };
  if (inp.config && inp.config.pomodoroStorageLocation !== 'daily-notes') {
    return {
      id, state: 'unavailable', reason: 'storage-plugin',
      facts: { storage: inp.config.pomodoroStorageLocation },
    };
  }
  return { id, state: 'ok', reason: 'counting', facts: { key: inp.settings.pomodoroFrontmatterKey } };
}

/** Beschriftung der Aufschluesselungs-Zeilen. Deutsch wie die uebrigen Zeilen in
 *  XpEngine ("Streak-Bonus", "Manuell …") — die Engine ist pur und kennt kein i18n. */
const ROW_LABEL: Record<string, string> = {
  tasks: 'TaskNotes — Aufgaben',
  work: 'TaskNotes — Arbeitssessions',
  break: 'TaskNotes — Pausen',
};

/**
 * XP aus den TaskNotes-Quellen. Baut ausschliesslich auf `diagnoseSources` auf:
 * gezaehlt wird genau, was dort `ok` ist. Damit kann die Anzeige nie etwas
 * anderes behaupten als die Rechnung.
 */
export function computeTaskNotesXp(inp: TaskNotesInput): { xp: number; rows: KuroXpBreakdownRow[] } {
  const rows: KuroXpBreakdownRow[] = [];
  let xp = 0;

  for (const d of diagnoseSources(inp)) {
    if (d.id === 'frontmatterPomodoro' || d.state !== 'ok') continue;
    const count = Number(d.facts.count ?? 0);
    const perItem = Number(d.facts.rate ?? 0);
    const amount = count * perItem;
    if (amount === 0) continue;
    xp += amount;
    rows.push({
      source: ROW_LABEL[d.id] ?? d.id,
      amount,
      reason: `${count} × ${perItem} XP`,
    });
  }

  return { xp, rows };
}

/** Soll der alte Frontmatter-Pomodoro-Bonus schweigen? Genau dann, wenn ihn etwas abloest. */
export function pomodoroBonusSuppressed(inp: TaskNotesInput | undefined): boolean {
  if (!inp) return false;
  return diagnoseSources(inp).some(
    (d) => d.id === 'frontmatterPomodoro' && d.reason === 'superseded',
  );
}

/**
 * Wann eine Rueckmeldung erscheint. Pur, damit die Regel testbar ist statt in
 * main.ts verstreut: nur nach einem echten Ereignis, nur bei positivem Zuwachs,
 * nie beim blossen Nachrechnen aus anderem Anlass.
 */
export function shouldNotifyGain(
  x: { eventPending: boolean; delta: number; enabled: boolean },
): boolean {
  return x.enabled && x.eventPending && x.delta > 0;
}
