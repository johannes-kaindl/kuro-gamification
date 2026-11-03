/* ==========================================================
   Opt-in "open sidebar on startup" — decoupled from enableSidebar.

   Availability (enableSidebar) and auto-open-on-startup
   (openSidebarOnStartup) are two separate concerns: a user may
   want the sidebar reachable via ribbon/command without it
   popping up on every Obsidian launch. The onLayoutReady gate
   must therefore key off openSidebarOnStartup, not enableSidebar.
   (activateSidebar() itself still guards on enableSidebar.)
   ========================================================== */
import KuroPlugin from '../src/main';

/** Fake app whose onLayoutReady callback we can fire on demand. */
function makeFakeApp() {
  let layoutCb: (() => void) | null = null;
  return {
    vault: { on: (_evt: string, _cb: (...a: any[]) => void) => ({}) },
    workspace: {
      onLayoutReady: (cb: () => void) => { layoutCb = cb; },
      getLeavesOfType: () => [],
      getRightLeaf: () => null,
      revealLeaf: () => {},
    },
    __fireLayoutReady: () => { if (layoutCb) layoutCb(); },
  };
}

/** Boot a plugin instance with siblings of the gate stubbed out. */
async function boot(loaded: any) {
  const plugin = new (KuroPlugin as any)();
  const app = makeFakeApp();
  plugin.app = app;
  plugin.loadData = async () => loaded;
  const activateSidebar = jest.fn();
  plugin.activateSidebar = activateSidebar;
  plugin.refreshStatus = jest.fn().mockResolvedValue(undefined);
  (plugin as any).scheduleMidnightTick = () => {};
  await plugin.onload();
  return { plugin, app, activateSidebar };
}

describe('KuroPlugin — sidebar-on-startup gate', () => {
  it('does NOT auto-open on startup when the sidebar is enabled but startup-open is off', async () => {
    const { app, activateSidebar } = await boot({
      onboardingShown: true,
      settings: { enableSidebar: true, openSidebarOnStartup: false },
    });

    app.__fireLayoutReady();

    expect(activateSidebar).not.toHaveBeenCalled();
  });

  it('auto-opens on startup when openSidebarOnStartup is on', async () => {
    const { app, activateSidebar } = await boot({
      onboardingShown: true,
      settings: { enableSidebar: false, openSidebarOnStartup: true },
    });

    app.__fireLayoutReady();

    expect(activateSidebar).toHaveBeenCalledTimes(1);
  });

  it('defaults to off — a fresh vault does not pop the sidebar on first launch', async () => {
    const { app, activateSidebar } = await boot(null); // fresh vault → defaults

    app.__fireLayoutReady();

    expect(activateSidebar).not.toHaveBeenCalled();
  });
});

/* Handy (Welle 30): der Start öffnet auf einem Mobilgerät keinen Tab im Hauptbereich — ein Tab bei jedem Start wäre aufdringlich. Das ausdrückliche Öffnen
   (Ribbon, Befehl, Statusleiste) bleibt; das prüft tests/main-sidebar-leaf.test.ts. */
import { Platform } from 'obsidian';

describe('KuroPlugin — Start auf dem Handy', () => {
  afterEach(() => { (Platform as { isMobile: boolean }).isMobile = false; });

  it('öffnet auf dem Handy auch mit openSidebarOnStartup keinen Tab', async () => {
    (Platform as { isMobile: boolean }).isMobile = true;
    const { app, activateSidebar } = await boot({
      onboardingShown: true,
      settings: { enableSidebar: true, openSidebarOnStartup: true },
    });

    app.__fireLayoutReady();

    expect(activateSidebar).not.toHaveBeenCalled();
  });

  it('Gegenprobe: derselbe Zustand am Desktop öffnet die Seitenleiste', async () => {
    (Platform as { isMobile: boolean }).isMobile = false;
    const { app, activateSidebar } = await boot({
      onboardingShown: true,
      settings: { enableSidebar: true, openSidebarOnStartup: true },
    });

    app.__fireLayoutReady();

    expect(activateSidebar).toHaveBeenCalledTimes(1);
  });
});
