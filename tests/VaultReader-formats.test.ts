import { TFile, TFolder } from 'obsidian';
import { VaultReader } from '../src/persistence/VaultReader';
import { StreakEngine } from '../src/engine/StreakEngine';
import { DEFAULT_SETTINGS } from '../src/types';

// Der Mock nimmt den Pfad im Konstruktor, die echten Typen nicht.
const makeFolder = (p: string): TFolder => new (TFolder as unknown as new (p: string) => TFolder)(p);
const makeFile = (p: string): TFile => new (TFile as unknown as new (p: string) => TFile)(p);
const logger = { debug() {}, info() {}, warn() {}, error() {} } as never;

/** Vault mit einer Tagesnotiz-Mappe: Namen (ohne `.md`) → Inhalt. */
function vaultWith(folder: string, names: string[]) {
  const root = makeFolder(folder);
  const files = new Map<string, TFile>();
  for (const n of names) {
    const f = makeFile(`${folder}/${n}.md`);
    root.children.push(f);
    files.set(f.path, f);
  }
  const app = {
    vault: {
      getAbstractFileByPath: (p: string) => (p === folder ? root : files.get(p) ?? null),
      cachedRead: async () => '- [x] a\n- [x] b',
    },
    metadataCache: { getFileCache: () => ({ frontmatter: {} }) },
  };
  return new VaultReader(app as never, logger);
}

const DAYS = ['2026-04-22', '2026-04-23', '2026-04-24'];
const toDdMm = (iso: string) => iso.split('-').reverse().join('-');

function streakOf(dates: string[]): number {
  return StreakEngine.compute({
    qualifyingDates: new Set(dates),
    today: new Date(2026, 3, 24),
    settings: DEFAULT_SETTINGS,
  }).streak;
}

describe('VaultReader — Datumsformate der Einstellungen', () => {
  it('liest ISO-Namen wie bisher (Default-Format)', async () => {
    const r = vaultWith('Daily', DAYS);
    const out = await r.readDailies({ dailyFolder: 'Daily', weeklyFolder: 'Weekly' });
    expect(out.map((d) => d.date)).toEqual(DAYS);
  });

  it('erkennt DD-MM-YYYY und rechnet auf den ISO-Schluessel um', async () => {
    const r = vaultWith('Daily', DAYS.map(toDdMm));
    const out = await r.readDailies({ dailyFolder: 'Daily', weeklyFolder: 'Weekly', dailyFormat: 'DD-MM-YYYY' });
    expect(out.map((d) => d.date)).toEqual(DAYS);
  });

  it('Gegenprobe: ohne das Format wuerden DD-MM-YYYY-Namen uebergangen', async () => {
    const r = vaultWith('Daily', DAYS.map(toDdMm));
    const out = await r.readDailies({ dailyFolder: 'Daily', weeklyFolder: 'Weekly' });
    expect(out).toEqual([]);
  });

  it('dieselben Notizen in ISO und in DD-MM-YYYY ergeben dieselbe Streak', async () => {
    const iso = await vaultWith('Daily', DAYS).readDailies({ dailyFolder: 'Daily', weeklyFolder: 'W' });
    const dd = await vaultWith('Daily', DAYS.map(toDdMm)).readDailies({ dailyFolder: 'Daily', weeklyFolder: 'W', dailyFormat: 'DD-MM-YYYY' });
    expect(streakOf(dd.map((d) => d.date))).toBe(streakOf(iso.map((d) => d.date)));
    expect(streakOf(dd.map((d) => d.date))).toBe(3);
  });

  it('ein ungueltiges Datum (13-14-2026) und Fremdnamen zaehlen nicht', async () => {
    const r = vaultWith('Daily', ['13-14-2026', 'Notiz', '22-04-2026']);
    const out = await r.readDailies({ dailyFolder: 'Daily', weeklyFolder: 'W', dailyFormat: 'DD-MM-YYYY' });
    expect(out.map((d) => d.date)).toEqual(['2026-04-22']);
  });

  it('readDaily/readDailyRaw rechnen den Pfad aus dem Format zurueck', async () => {
    const r = vaultWith('Daily', ['23-04-2026']);
    const opts = { dailyFolder: 'Daily', weeklyFolder: 'W', dailyFormat: 'DD-MM-YYYY' };
    expect((await r.readDaily(opts, '2026-04-23'))?.date).toBe('2026-04-23');
    expect(await r.readDailyRaw(opts, '2026-04-23')).toContain('- [x] a');
    expect(await r.readDailyRaw(opts, '2026-04-22')).toBeNull();
  });

  it('Wochen: YYYY-[W]WW wird ueber das ISO-Wochenjahr benannt (Jahreswechsel)', async () => {
    // 2026-W53 gibt es nicht, 2020-W53 schon; 2021-01-01 gehoert zu 2020-W53.
    const r = vaultWith('Weekly', ['2020-W53', '2026-W17', '2026-W99']);
    const out = await r.readWeeklies({ dailyFolder: 'D', weeklyFolder: 'Weekly' });
    expect(out.map((w) => w.weekId)).toEqual(['2020-W53', '2026-W17']);
  });

  it('Wochen mit eigenem Format (Wochennummer zuerst)', async () => {
    const r = vaultWith('Weekly', ['W17 2026']);
    const out = await r.readWeeklies({ dailyFolder: 'D', weeklyFolder: 'Weekly', weeklyFormat: '[W]WW GGGG' });
    expect(out.map((w) => w.weekId)).toEqual(['2026-W17']);
  });
});
