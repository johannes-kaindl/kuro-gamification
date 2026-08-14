/* ==========================================================
   Kontext-Aufbau für den Companion-Chat — pure, kein Obsidian-Import.

   Liest NICHTS selbst: Snapshot und Daily-Text kommen als Argumente
   herein. Vault-Zugriff bleibt in main.ts / VaultReader — die
   Schichtengrenze Engine ↔ Obsidian-API wird nicht aufgeweicht.

   renderDailyExtract() ist die EINE Wahrheit: Prompt-Bau UND die
   Transparenz-Vorschau in Einstellungen und Chat rufen dieselbe
   Funktion. Eine nachgebaute Vorschau würde driften und beruhigend
   etwas anderes zeigen, als tatsächlich gesendet wird.
   ========================================================== */
import type { ChatDailyContext, KuroSettings, KuroSnapshot } from '../types';

export interface DailyExtract {
  /** Checkbox-Zeilen ohne Listen-Marker, z. B. "[ ] Arzttermin ausmachen". */
  tasks: string[];
  /** Habit-Zeilen als "Label: ja|nein". */
  habits: string[];
  /** Rohtext — nur im Modus 'full', sonst null. */
  raw: string | null;
  mode: ChatDailyContext;
}

/** Deckt dieselben Formen ab wie utils/checkboxes.ts (callout-aware). */
const CHECKBOX_RX = /^[ \t>]*[-*+] (\[[ xX>~\-/!?]\].*)$/gm;
const FRONTMATTER_RX = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Frontmatter grob lesen — nur flache "key: value"-Zeilen, mehr braucht es hier nicht. */
function frontmatterOf(text: string): Record<string, string> {
  const m = FRONTMATTER_RX.exec(text);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

export function buildDailyExtract(
  dailyText: string | null,
  settings: KuroSettings,
): DailyExtract {
  const mode = settings.chatDailyContext;
  if (mode === 'none' || dailyText === null || dailyText === '') {
    return { tasks: [], habits: [], raw: null, mode };
  }
  if (mode === 'full') {
    return { tasks: [], habits: [], raw: dailyText, mode };
  }

  const tasks: string[] = [];
  for (const m of dailyText.matchAll(CHECKBOX_RX)) tasks.push(m[1].trim());

  const fm = frontmatterOf(dailyText);
  const habits: string[] = [];
  for (const h of settings.habits) {
    const value = fm[h.key];
    if (value === undefined) continue;
    habits.push(`${h.label}: ${value === 'true' ? 'ja' : 'nein'}`);
  }

  return { tasks, habits, raw: null, mode };
}

/** Die eine Formatierung — für Prompt UND Vorschau. */
export function renderDailyExtract(x: DailyExtract): string {
  if (x.mode === 'none') return '';
  if (x.mode === 'full') return x.raw ?? '';
  const parts: string[] = [];
  if (x.tasks.length > 0) parts.push(x.tasks.map((l) => `- ${l}`).join('\n'));
  if (x.habits.length > 0) parts.push(x.habits.map((l) => `- ${l}`).join('\n'));
  return parts.join('\n');
}

export function buildContext(
  snapshot: KuroSnapshot | null,
  dailyText: string | null,
  settings: KuroSettings,
): string {
  const parts: string[] = [];

  if (snapshot) {
    const s = snapshot;
    const lines = [
      `Level ${s.currentLevel.level} — ${s.currentLevel.title}`,
      `XP gesamt: ${s.totalXp}`,
      s.nextLevel ? `Bis Level ${s.nextLevel.level}: ${s.xpToNext} XP` : 'Höchstes Level erreicht',
      `Streak: ${s.streak} Tage · Freeze-Tokens: ${s.freezeTokens}`,
      `Heute: ${s.todayDone} von ${s.todayTotal} erledigt (${s.todayXp} XP)`,
      `Offene Loot-Drops: ${s.availableDrops}`,
    ];
    if (s.loreFragment) lines.push(`Zuletzt freigeschaltet: „${s.loreFragment.title}"`);
    parts.push(lines.join('\n'));
  }

  const extract = renderDailyExtract(buildDailyExtract(dailyText, settings));
  if (extract !== '') parts.push(`Heutige Notiz:\n${extract}`);

  return parts.join('\n\n');
}
