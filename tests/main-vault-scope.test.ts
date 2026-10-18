/* ==========================================================
   Welche Dateien eine Aenderung im Vault zur Neuberechnung machen:
   die Notizen im Tages- und im Wochenordner (Segmentregeln aus dem Kit,
   `folder-scope`). Ein Ordner mit Schraegstrich am Ende ist derselbe Ordner.
   ========================================================== */
import { TFile } from 'obsidian';
import KuroPlugin from '../src/main';

/** Das Mock-`TFile` nimmt den Pfad; die echten Typen kennen den Konstruktor nicht. */
const mdFile = (path: string): TFile => new (TFile as unknown as new (p: string) => TFile)(path);

async function boot(settings: Record<string, unknown>) {
  const plugin = new (KuroPlugin as any)();
  plugin.app = {
    vault: { on: () => ({}) },
    workspace: { onLayoutReady: () => {}, getLeavesOfType: () => [], getRightLeaf: () => null, revealLeaf: () => {} },
    internalPlugins: { getPluginById: () => null },
  };
  plugin.loadData = async () => ({ onboardingShown: true, settings });
  await plugin.onload();
  const refresh = jest.fn();
  plugin.debouncedRefresh = refresh;
  return { plugin, refresh };
}

describe('KuroPlugin — Vault-Aenderung im Tages-/Wochenordner', () => {
  it('eine Tagesnotiz im Tagesordner loest die Neuberechnung aus', async () => {
    const { plugin, refresh } = await boot({ dailyFolder: 'Journal/Daily', weeklyFolder: 'Weekly' });
    plugin.onVaultChange(mdFile('Journal/Daily/2026-10-18.md'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ein Ordner mit Schraegstrich am Ende ist derselbe Ordner', async () => {
    const { plugin, refresh } = await boot({ dailyFolder: 'Journal/Daily/', weeklyFolder: 'Weekly' });
    plugin.onVaultChange(mdFile('Journal/Daily/2026-10-18.md'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ein Nachbarordner mit gleichem Namensanfang zaehlt nicht', async () => {
    const { plugin, refresh } = await boot({ dailyFolder: 'Journal/Daily', weeklyFolder: 'Weekly' });
    plugin.onVaultChange(mdFile('Journal/Daily-Archiv/2026-10-18.md'));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ein leerer Ordner haelt nichts (kein stilles „alle Dateien“)', async () => {
    const { plugin, refresh } = await boot({ dailyFolder: '', weeklyFolder: '' });
    plugin.onVaultChange(mdFile('2026-10-18.md'));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('eine Wochennotiz im Wochenordner loest aus, eine fremde Datei nicht', async () => {
    const { plugin, refresh } = await boot({ dailyFolder: 'Daily', weeklyFolder: 'Weekly' });
    plugin.onVaultChange(mdFile('Weekly/2026-W42.md'));
    expect(refresh).toHaveBeenCalledTimes(1);
    plugin.onVaultChange(mdFile('Weekly/notizen.md'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
