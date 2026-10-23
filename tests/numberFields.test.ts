import { parseNumberFields } from '../src/utils/numberFields';

describe('parseNumberFields', () => {
  it('reads plain keys and "key=Label" pairs, separated by comma or newline', () => {
    expect(parseNumberFields('aufgaben, offen=Offene Aufgaben\nnotizen')).toEqual([
      { key: 'aufgaben', label: 'aufgaben' },
      { key: 'offen', label: 'Offene Aufgaben' },
      { key: 'notizen', label: 'notizen' },
    ]);
  });

  it('skips empty items and repeated keys', () => {
    expect(parseNumberFields(' , aufgaben,,aufgaben=Nochmal ,')).toEqual([{ key: 'aufgaben', label: 'aufgaben' }]);
  });

  it('is empty for an empty string', () => {
    expect(parseNumberFields('')).toEqual([]);
  });

  it('falls back to the key when the label after = is empty', () => {
    expect(parseNumberFields('aufgaben=')).toEqual([{ key: 'aufgaben', label: 'aufgaben' }]);
  });
});
