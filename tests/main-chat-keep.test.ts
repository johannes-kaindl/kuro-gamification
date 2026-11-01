/* ==========================================================
   Aufbewahrung der vergangenen Chats beim Laden: der Verlauf ist in diesem
   Plugin als Vorgabe AUS (Aufbewahrung 0, Entscheidung Johannes für alle
   Chat-Fenster der Welle 29). `clampChatKeep` des Kits macht aus einem Wert,
   der keine Zahl ist, die 50 des Kits: ein kaputter Eintrag in data.json darf
   den Verlauf nie einschalten (er schreibt Chats in den Vault).
   ========================================================== */
import KuroPlugin from '../src/main';

async function laden(settings: Record<string, unknown> | undefined): Promise<any> {
  const app = {
    vault: { on: () => ({}), configDir: '.obsidian', adapter: { exists: async () => false, list: async () => ({ files: [], folders: [] }) } },
    workspace: { onLayoutReady: () => {}, getLeavesOfType: () => [], getRightLeaf: () => null, revealLeaf: () => {} },
    plugins: { plugins: {} },
  };
  const plugin: any = new (KuroPlugin as any)();
  plugin.app = app;
  plugin.manifest = { id: 'kuro-gamification', name: 'Kuro Gamification', version: '0' };
  plugin.loadData = async () => (settings === undefined ? null : { settings });
  plugin.saveData = async () => {};
  await plugin.onload();
  return plugin;
}

describe('Aufbewahrung der vergangenen Chats beim Laden', () => {
  it('ohne Eintrag ist der Verlauf aus', async () => {
    expect((await laden(undefined)).data.settings.chatKeep).toBe(0);
    expect((await laden({})).data.settings.chatKeep).toBe(0);
  });

  it('ein Eintrag, der keine Zahl ist, schaltet ihn nicht ein (nicht die 50 des Kits)', async () => {
    expect((await laden({ chatKeep: 'viel' })).data.settings.chatKeep).toBe(0);
    expect((await laden({ chatKeep: null })).data.settings.chatKeep).toBe(0);
    expect((await laden({ chatKeep: Number.NaN })).data.settings.chatKeep).toBe(0);
  });

  it('eine gültige Zahl bleibt, eine zu große wird auf 500 begrenzt, eine negative auf 0', async () => {
    expect((await laden({ chatKeep: 12 })).data.settings.chatKeep).toBe(12);
    expect((await laden({ chatKeep: 9999 })).data.settings.chatKeep).toBe(500);
    expect((await laden({ chatKeep: -3 })).data.settings.chatKeep).toBe(0);
  });

  it('ein Ordner, der kein Text ist, wird zur Vorgabe (leer)', async () => {
    expect((await laden({ chatFolder: 42 })).data.settings.chatFolder).toBe('');
    expect((await laden({ chatFolder: 'Eigene/Chats' })).data.settings.chatFolder).toBe('Eigene/Chats');
  });
});
