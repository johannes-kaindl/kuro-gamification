/* ==========================================================
   The import modal must notify its opener so an already-open
   Settings tab re-renders — without it, a freshly imported pack
   only appears after a plugin reload (bug 2026-07-24). Tests the
   runtime promise (callback fires + settings applied) directly,
   not through the DOM.
   ========================================================== */
import { ImportPackModal } from '../src/modals/PackIoModal';
import { DEFAULT_SETTINGS } from '../src/types';
import type { KuroPack } from '../src/types';

function fakePlugin() {
  return {
    app: {},
    data: { settings: { ...DEFAULT_SETTINGS } },
    persist: jest.fn().mockResolvedValue(undefined),
    refreshStatus: jest.fn().mockResolvedValue(undefined),
  };
}

const lorePack: KuroPack = { kuroPack: 1, name: 'Testpack', lore: [{ level: 1, title: 'T', text: 'x' }] };

describe('ImportPackModal — re-render notification', () => {
  it('invokes onApplied after a successful import so the opener can re-render', async () => {
    const plugin = fakePlugin();
    const onApplied = jest.fn();
    const modal = new ImportPackModal({} as never, plugin as never, onApplied);

    await (modal as unknown as { _commit(p: KuroPack): Promise<void> })._commit(lorePack);

    expect(plugin.data.settings.packLibrary).toHaveLength(1);
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it('works without a callback (command-palette invocation) — no throw', async () => {
    const plugin = fakePlugin();
    const modal = new ImportPackModal({} as never, plugin as never);

    await expect(
      (modal as unknown as { _commit(p: KuroPack): Promise<void> })._commit(lorePack),
    ).resolves.toBeUndefined();
    expect(plugin.data.settings.packLibrary).toHaveLength(1);
  });
});
