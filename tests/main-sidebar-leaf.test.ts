/* ==========================================================
   Wo die Kuro-Ansicht aufgeht (Welle 30, Entscheidung Johannes 2026-11-02, alle Mobilgeräte):
   auf dem Handy als Tab im Hauptbereich, am Desktop in der rechten Seitenleiste. Die Wahl trifft `openChatLeaf` aus dem Kit (seit 0.77.0, eigene Tests dort);
   hier steht, dass `activateSidebar` den Kit-Aufruf mit der richtigen Ansicht macht, `enableSidebar` weiter vor ihm gilt und ein in der Schublade gespeichertes Blatt am Handy wandert.
   ========================================================== */
import { Platform } from 'obsidian';
import KuroPlugin from '../src/main';

const VIEW = 'kuro-status-view';

const rootSplit = { name: 'root' };
const drawerSplit = { name: 'drawer' };

function makeLeaf(root: object) {
  return {
    setViewState: jest.fn().mockResolvedValue(undefined),
    detach: jest.fn(),
    getRoot: () => root,
  };
}

function makePlugin(opts: { existing?: ReturnType<typeof makeLeaf>[] } = {}) {
  const tabLeaf = makeLeaf(rootSplit);
  const rightLeaf = makeLeaf(drawerSplit);
  const workspace = {
    rootSplit,
    getLeavesOfType: jest.fn(() => opts.existing ?? []),
    getLeaf: jest.fn((_t?: string) => tabLeaf),
    getRightLeaf: jest.fn((_split: boolean) => rightLeaf),
    revealLeaf: jest.fn().mockResolvedValue(undefined),
  };
  const plugin = new (KuroPlugin as any)();
  plugin.app = { workspace };
  plugin.data = { settings: { enableSidebar: true } };
  return { plugin, workspace, tabLeaf, rightLeaf };
}

describe('KuroPlugin.activateSidebar — Ort der Ansicht', () => {
  afterEach(() => { (Platform as { isMobile: boolean }).isMobile = false; });

  it('Handy: Tab im Hauptbereich, nicht die Schublade', async () => {
    (Platform as { isMobile: boolean }).isMobile = true;
    const { plugin, workspace, tabLeaf } = makePlugin();

    await plugin.activateSidebar();

    expect(workspace.getLeaf).toHaveBeenCalledWith('tab');
    expect(workspace.getRightLeaf).not.toHaveBeenCalled();
    expect(tabLeaf.setViewState).toHaveBeenCalledWith(expect.objectContaining({ type: VIEW }));
    expect(workspace.revealLeaf).toHaveBeenCalledWith(tabLeaf);
  });

  it('Desktop: rechte Seitenleiste wie bisher (Gegenprobe)', async () => {
    const { plugin, workspace, rightLeaf } = makePlugin();

    await plugin.activateSidebar();

    expect(workspace.getRightLeaf).toHaveBeenCalledWith(false);
    expect(workspace.getLeaf).not.toHaveBeenCalled();
    expect(rightLeaf.setViewState).toHaveBeenCalledWith(expect.objectContaining({ type: VIEW }));
  });

  it('Handy: ein in der Schublade gespeichertes Blatt wird geschlossen, die Ansicht geht als Tab auf (das Loch von 1.18.0)', async () => {
    (Platform as { isMobile: boolean }).isMobile = true;
    const stored = makeLeaf(drawerSplit);
    const { plugin, workspace, tabLeaf } = makePlugin({ existing: [stored] });

    await plugin.activateSidebar();

    expect(stored.detach).toHaveBeenCalledTimes(1);
    expect(workspace.getLeaf).toHaveBeenCalledWith('tab');
    expect(tabLeaf.setViewState).toHaveBeenCalledWith(expect.objectContaining({ type: VIEW }));
    expect(workspace.revealLeaf).toHaveBeenCalledWith(tabLeaf);
  });

  it('Handy: ein Blatt im Hauptbereich bleibt; Desktop: ein Blatt in der Seitenleiste bleibt', async () => {
    for (const [mobile, root] of [[true, rootSplit], [false, drawerSplit]] as const) {
      (Platform as { isMobile: boolean }).isMobile = mobile;
      const existing = makeLeaf(root);
      const { plugin, workspace } = makePlugin({ existing: [existing] });

      await plugin.activateSidebar();

      expect(existing.detach).not.toHaveBeenCalled();
      expect(existing.setViewState).not.toHaveBeenCalled();
      expect(workspace.getLeaf).not.toHaveBeenCalled();
      expect(workspace.getRightLeaf).not.toHaveBeenCalled();
      expect(workspace.revealLeaf).toHaveBeenCalledWith(existing);
    }
  });

  it('bleibt aus, wenn die Seitenleiste in den Einstellungen aus ist (auch am Handy)', async () => {
    (Platform as { isMobile: boolean }).isMobile = true;
    const stored = makeLeaf(drawerSplit);
    const { plugin, workspace } = makePlugin({ existing: [stored] });
    plugin.data.settings.enableSidebar = false;

    await plugin.activateSidebar();

    expect(stored.detach).not.toHaveBeenCalled();
    expect(workspace.getLeaf).not.toHaveBeenCalled();
    expect(workspace.revealLeaf).not.toHaveBeenCalled();
  });
});
