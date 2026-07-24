/* ==========================================================
   Fresh-install seeding: adopt the vault's core "Daily notes"
   folder/format on first load, but never override a folder the
   user (or an existing install) already configured.
   ========================================================== */
import KuroPlugin from '../src/main';

function makeFakeApp(dailyNotesOptions: any | null) {
  return {
    vault: { on: () => ({}) },
    workspace: {
      onLayoutReady: (_cb: () => void) => {}, // do not fire post-load path
      getLeavesOfType: () => [],
      getRightLeaf: () => null,
      revealLeaf: () => {},
    },
    internalPlugins: {
      getPluginById: (id: string) =>
        id === 'daily-notes' && dailyNotesOptions
          ? { instance: { options: dailyNotesOptions } }
          : null,
    },
  };
}

async function boot(loaded: any, dailyNotesOptions: any | null) {
  const plugin = new (KuroPlugin as any)();
  plugin.app = makeFakeApp(dailyNotesOptions);
  plugin.loadData = async () => loaded;
  await plugin.onload();
  return plugin;
}

describe('KuroPlugin — fresh-install daily-folder seeding', () => {
  it('adopts the core daily-notes folder and format on a fresh vault', async () => {
    const plugin = await boot(null, { folder: 'Journal/Daily', format: 'DD-MM-YYYY' });

    expect(plugin.data.settings.dailyFolder).toBe('Journal/Daily');
    expect(plugin.data.settings.dailyDateFormat).toBe('DD-MM-YYYY');
  });

  it('leaves the folder empty when no core daily-notes plugin is configured', async () => {
    const plugin = await boot(null, null);

    expect(plugin.data.settings.dailyFolder).toBe('');
  });

  it('never overrides a folder an existing install already has', async () => {
    const plugin = await boot(
      { onboardingShown: true, settings: { dailyFolder: 'MyDaily' } },
      { folder: 'Journal/Daily', format: 'YYYY-MM-DD' },
    );

    expect(plugin.data.settings.dailyFolder).toBe('MyDaily');
  });
});
