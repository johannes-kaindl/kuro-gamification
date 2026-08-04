/* ==========================================================
   VaultReader — reads daily/weekly notes from the vault and
   produces engine-ready DailyInput[] / WeeklyInput[].
   Wraps Obsidian Vault + MetadataCache APIs.
   ========================================================== */
import { type App, TFile, TFolder, normalizePath } from 'obsidian';
import { countCheckboxes, type CheckboxStats } from '../utils/checkboxes';
import { isIsoDate, isIsoWeek } from '../utils/dateUtils';
import type { DailyInput, WeeklyInput } from '../engine/XpEngine';
import type { Logger } from '../utils/logger';

export interface VaultReadOptions {
  dailyFolder: string;
  weeklyFolder: string;
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
    for (const f of files) {
      if (!isIsoDate(f.basename)) continue;
      const stats = await this.statsFor(f);
      const fm = this.frontmatterFor(f);
      out.push({ date: f.basename, stats, frontmatter: fm });
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
    for (const f of files) {
      if (!isIsoWeek(f.basename)) continue;
      const fm = this.frontmatterFor(f);
      out.push({ weekId: f.basename, frontmatter: fm });
    }
    out.sort((a, b) => a.weekId.localeCompare(b.weekId));
    return out;
  }

  /** Read a single daily note by ISO date. */
  async readDaily(opts: VaultReadOptions, isoDate: string): Promise<DailyInput | null> {
    const folder = this.findFolder(opts.dailyFolder);
    if (!folder) return null;
    const file = this.app.vault.getAbstractFileByPath(
      normalizePath(`${opts.dailyFolder}/${isoDate}.md`),
    );
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
    const file = this.app.vault.getAbstractFileByPath(
      normalizePath(`${opts.dailyFolder}/${isoDate}.md`),
    );
    if (!(file instanceof TFile)) return null;
    return this.app.vault.cachedRead(file);
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
