import { shouldNotifyGain } from '../src/engine/TaskNotesXp';

describe('shouldNotifyGain', () => {
  it('meldet nur, wenn ein Ereignis anlag UND der Zuwachs positiv ist', () => {
    expect(shouldNotifyGain({ eventPending: true, delta: 10, enabled: true })).toBe(true);
  });
  it('meldet NICHT beim blossen Nachrechnen — der haeufigste Fall', () => {
    expect(shouldNotifyGain({ eventPending: false, delta: 10, enabled: true })).toBe(false);
  });
  it('meldet NICHT bei Zuwachs 0', () => {
    expect(shouldNotifyGain({ eventPending: true, delta: 0, enabled: true })).toBe(false);
  });
  it('meldet NICHT bei negativem Delta (Aufgabe wieder geoeffnet)', () => {
    expect(shouldNotifyGain({ eventPending: true, delta: -10, enabled: true })).toBe(false);
  });
  it('respektiert den Schalter', () => {
    expect(shouldNotifyGain({ eventPending: true, delta: 10, enabled: false })).toBe(false);
  });
});
