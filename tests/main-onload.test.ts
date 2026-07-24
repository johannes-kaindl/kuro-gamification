/* ==========================================================
   Regression test for the plugin lifecycle (onload).

   Guards against the fresh-vault load crash where
   `regenFreezeTokensIfNeeded()` ran before `this.debouncedSave`
   was assigned → "TypeError: this.debouncedSave is not a function"
   → Obsidian "could not load extension". Only fresh vaults hit it
   (existing data already has freezeTokensLastRegen === current month,
   so the regen branch that calls debouncedSave never fires).
   ========================================================== */
import KuroPlugin from '../src/main';

/** Minimal Obsidian `app` surface that onload touches before onLayoutReady. */
function makeFakeApp() {
  return {
    vault: { on: (_evt: string, _cb: (...a: any[]) => void) => ({}) },
    workspace: {
      // Defer: do NOT invoke the callback — the post-load path (sidebar,
      // refreshStatus, welcome modal) is out of scope for this regression.
      onLayoutReady: (_cb: () => void) => {},
      getLeavesOfType: () => [],
      getRightLeaf: () => null,
      revealLeaf: () => {},
    },
  };
}

describe('KuroPlugin.onload — fresh vault (no saved data)', () => {
  it('loads without throwing (regression: debouncedSave assigned before first use)', async () => {
    const plugin = new (KuroPlugin as any)();
    plugin.app = makeFakeApp();

    // loadData() resolves to null in the mock → fresh-vault defaults
    // (freezeTokensLastRegen === '') → regen branch fires during onload.
    await expect(plugin.onload()).resolves.toBeUndefined();
  });

  it('actually exercised the freeze-token regen branch (guards against a vacuous pass)', async () => {
    const plugin = new (KuroPlugin as any)();
    plugin.app = makeFakeApp();

    await plugin.onload();

    // The branch that called debouncedSave only runs when lastRegen changes
    // from '' to the current YYYY-MM. If it ran, the field is now populated.
    expect(plugin.data.freezeTokensLastRegen).toMatch(/^\d{4}-\d{2}$/);
    expect(typeof plugin.debouncedSave).toBe('function');
  });
});
