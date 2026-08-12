/* ==========================================================
   KuroSettingsTab.setControlValue('enableChat', …) — Regression.

   Root Cause (Jay-Feedback 12.08., Handover.md Feedback Schritt 2):
   der Toggle "Chat aktivieren" wirkte im ≥1.13-Renderer angeklickt,
   schrieb aber nie in die Settings — setControlValue()'s switch hatte
   keinen 'enableChat'-Case und fiel auf `default: return`, ohne zu
   speichern. Nach einem Neustart stand der Endpunkt noch da, der Chat
   aber wieder aus; die Tab-Leiste erschien nie, weil enableChat in den
   Daten nie true wurde.
   ========================================================== */
import { KuroSettingsTab } from '../src/settings/SettingsTab';
import { DEFAULT_PLUGIN_DATA } from '../src/types';

function makeFakePlugin() {
  return {
    app: {},
    data: JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)),
    persist: jest.fn().mockResolvedValue(undefined),
    refreshStatus: jest.fn().mockResolvedValue(undefined),
    syncChatUI: jest.fn(),
  };
}

describe('KuroSettingsTab.setControlValue — enableChat', () => {
  it('actually flips the setting (was silently dropped by the switch default)', async () => {
    const plugin = makeFakePlugin();
    const tab = new KuroSettingsTab({} as any, plugin as any);

    await tab.setControlValue('enableChat', true);

    expect(plugin.data.settings.enableChat).toBe(true);
  });

  it('persists the change', async () => {
    const plugin = makeFakePlugin();
    const tab = new KuroSettingsTab({} as any, plugin as any);

    await tab.setControlValue('enableChat', true);

    expect(plugin.persist).toHaveBeenCalled();
  });

  it('rebuilds any open sidebar tab bar — onOpen() only reads enableChat once', async () => {
    const plugin = makeFakePlugin();
    const tab = new KuroSettingsTab({} as any, plugin as any);

    await tab.setControlValue('enableChat', true);

    expect(plugin.syncChatUI).toHaveBeenCalled();
  });
});
