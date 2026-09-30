import { DataStore } from '../src/persistence/DataStore';
import { DEFAULT_SETTINGS } from '../src/types';
import { MODE, loadRequestSettings } from '../src/llm/requestSettings';

describe('loadRequestSettings — Legacy-Migration chatSuppressThinking (Modus companion)', () => {
  it('Modus ist companion', () => { expect(MODE).toBe('companion'); });

  it('true (alter Default) → off, false → Einschalt-Stufe (low)', () => {
    expect(loadRequestSettings({ chatSuppressThinking: true }).request.thinking.companion).toBe('off');
    expect(loadRequestSettings({ chatSuppressThinking: false }).request.thinking.companion).toBe('low');
  });

  it('ohne Altfeld und ohne request bleibt die Stufe ungesetzt (Modus-Default off greift)', () => {
    expect(loadRequestSettings({}).request.thinking.companion).toBeUndefined();
    expect(loadRequestSettings(null).request).toEqual({ overrides: {}, thinking: {}, lastOnLevel: {}, levelPickerInChat: false });
  });

  it('eine schon gesetzte Stufe gewinnt gegen das Altfeld', () => {
    const r = loadRequestSettings({ chatSuppressThinking: true, request: { thinking: { companion: 'high' } } });
    expect(r.request.thinking.companion).toBe('high');
  });

  it('meldet verworfene Pfade statt sie still zu schlucken', () => {
    const r = loadRequestSettings({ request: { overrides: { companion: { unknown: { temperature: 99 } } } } });
    expect(r.dropped.length).toBeGreaterThan(0);
  });
});

describe('DataStore.merge — request-Block', () => {
  const ds = new DataStore({ loadData: () => Promise.resolve(null), saveData: () => Promise.resolve() } as never);

  it('Default: leerer request-Block, Altfeld ist aus dem Modell', () => {
    const s = ds.merge({}).settings;
    expect(s.request).toEqual({ overrides: {}, thinking: {}, lastOnLevel: {}, levelPickerInChat: false });
    expect(DEFAULT_SETTINGS).not.toHaveProperty('chatSuppressThinking');
    expect(s).not.toHaveProperty('chatSuppressThinking');
  });

  it('migriert chatSuppressThinking aus gespeicherten Einstellungen, das Feld ist danach weg', () => {
    const on = ds.merge({ settings: { chatSuppressThinking: true } as never }).settings;
    expect(on.request.thinking.companion).toBe('off');
    expect(on).not.toHaveProperty('chatSuppressThinking');
    const off = ds.merge({ settings: { chatSuppressThinking: false } as never }).settings;
    expect(off.request.thinking.companion).toBe('low');
  });

  it('merkt sich verworfene Pfade für die Meldung beim Laden', () => {
    ds.merge({ settings: { request: { overrides: { companion: { unknown: { temperature: 99 } } } } } as never });
    expect(ds.lastRequestDropped.length).toBeGreaterThan(0);
    ds.merge({});
    expect(ds.lastRequestDropped).toEqual([]);
  });
});
