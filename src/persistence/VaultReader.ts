/* ==========================================================
   VaultReader — reads daily/weekly notes from the vault and
   produces engine-ready DailyInput[] / WeeklyInput[].
   Wraps Obsidian Vault + MetadataCache APIs.
   ========================================================== */
import { type App, TFile, TFolder, moment, normalizePath } from 'obsidian';
import { countCheckboxes, type CheckboxStats } from '../utils/checkboxes';
import type { DailyInput, WeeklyInput } from '../engine/XpEngine';
import type { Logger } from '../utils/logger';

/** Intern bleiben Tage `YYYY-MM-DD` und Wochen `YYYY-Www` (ISO-Woche); die Formate der Einstellungen
 *  bestimmen nur, wie die Dateinamen im Vault heissen. */
const ISO_DAY = 'YYYY-MM-DD';
const ISO_WEEK = 'GGGG-[W]WW';

export interface VaultReadOptions {
  dailyFolder: string;
  weeklyFolder: string;
  /** moment-Format der Tagesnotizen (Default `YYYY-MM-DD`). */
  dailyFormat?: string;
  /** moment-Format der Wochennotizen (Default `YYYY-[W]WW`). */
  weeklyFormat?: string;
}

/** Name (ohne `.md`) → interner Schluessel, oder `null`, wenn er nicht zum Format passt. Streng:
 *  `13-14-2026` ist kein Datum. Wochen werden ueber das ISO-Wochenjahr (`GGGG`) benannt, damit der
 *  Jahreswechsel nicht in die falsche Woche rutscht. */
function keyFromName(name: string, format: string, internal: string): string | null {
  const m = moment(name, format, true);
  return m.isValid() ? m.format(internal) : null;
}

/** Interner Schluessel → Dateiname (ohne `.md`) im Format des Vaults. */
function nameFromKey(key: string, format: string, internal: string): string {
  return moment(key, internal, true).format(format);
}

export class VaultReader {
  constructor(private readonly app: App, private readonly logger: Logger) {}

  async readDailies(opts: VaultReadOptions): Promise<DailyInput[]> {
    const folder = this.findFolder(opts.dailyFolder);
    if (!folder) {
      this.logger.debug('Daily folder not found:', opts.dailyFolder);
      return [];
    }
    const files = this.markdownFilesIn(folder);
    const out: DailyInput[] = [];
    const format = opts.dailyFormat || ISO_DAY;
    const seen = new Set<string>();
    for (const f of files) {
      const date = this.keyFor(f, folder, format, ISO_DAY);
      if (date === null || seen.has(date)) continue;
      seen.add(date);
      const stats = await this.statsFor(f);
      const fm = this.frontmatterFor(f);
      out.push({ date, stats, frontmatter: fm });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }

  async readWeeklies(opts: VaultReadOptions): Promise<WeeklyInput[]> {
    const folder = this.findFolder(opts.weeklyFolder);
    if (!folder) {
      this.logger.debug('Weekly folder not found:', opts.weeklyFolder);
      return [];
    }
    const files = this.markdownFilesIn(folder);
    const out: WeeklyInput[] = [];
    const format = opts.weeklyFormat || 'YYYY-[W]WW';
    const seen = new Set<string>();
    for (const f of files) {
      const weekId = this.keyFor(f, folder, format, ISO_WEEK);
      if (weekId === null || seen.has(weekId)) continue;
      seen.add(weekId);
      const fm = this.frontmatterFor(f);
      out.push({ weekId, frontmatter: fm });
    }
    out.sort((a, b) => a.weekId.localeCompare(b.weekId));
    return out;
  }

  /** Read a single daily note by ISO date. */
  async readDaily(opts: VaultReadOptions, isoDate: string): Promise<DailyInput | null> {
    const folder = this.findFolder(opts.dailyFolder);
    if (!folder) return null;
    const file = this.dailyFile(opts, isoDate);
    if (!(file instanceof TFile)) return null;
    const stats = await this.statsFor(file);
    const fm = this.frontmatterFor(file);
    return { date: isoDate, stats, frontmatter: fm };
  }

  /**
   * Rohtext einer Tagesnotiz — der einzige zusätzliche Vault-Zugriff, den der
   * Companion-Chat braucht. Die Chat-Module selbst lesen nie aus dem Vault;
   * sie bekommen diesen Text als Argument (Schichtengrenze).
   */
  async readDailyRaw(opts: VaultReadOptions, isoDate: string): Promise<string | null> {
    const file = this.dailyFile(opts, isoDate);
    if (!(file instanceof TFile)) return null;
    return this.app.vault.cachedRead(file);
  }

  private dailyFile(opts: VaultReadOptions, isoDate: string) {
    const name = nameFromKey(isoDate, opts.dailyFormat || ISO_DAY, ISO_DAY);
    return this.app.vault.getAbstractFileByPath(normalizePath(`${opts.dailyFolder}/${name}.md`));
  }

  /** Schluessel einer Notiz: der Pfad unter dem Ordner (Formate mit Unterordnern wie `YYYY/MM/DD`), sonst der Dateiname. */
  private keyFor(f: TFile, folder: TFolder, format: string, internal: string): string | null {
    const prefix = `${folder.path}/`;
    const rel = f.path.startsWith(prefix) ? f.path.slice(prefix.length, -'.md'.length) : f.basename;
    return keyFromName(rel, format, internal) ?? keyFromName(f.basename, format, internal);
  }

  private findFolder(path: string): TFolder | null {
    const af = this.app.vault.getAbstractFileByPath(normalizePath(path));
    return af instanceof TFolder ? af : null;
  }

  private markdownFilesIn(folder: TFolder): TFile[] {
    const out: TFile[] = [];
    const walk = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile && child.extension === 'md') out.push(child);
        else if (child instanceof TFolder) walk(child);
      }
    };
    walk(folder);
    return out;
  }

  private async statsFor(f: TFile): Promise<CheckboxStats> {
    try {
      const content = await this.app.vault.cachedRead(f);
      return countCheckboxes(content);
    } catch (err) {
      this.logger.error('cachedRead failed for', f.path, err);
      return { total: 0, done: 0, pct: 0 };
    }
  }

  private frontmatterFor(f: TFile): Record<string, unknown> {
    const cache = this.app.metadataCache.getFileCache(f);
    return cache?.frontmatter ?? {};
  }
}
