import * as fs from 'node:fs';
import * as path from 'node:path';
import { validatePack } from '../src/engine/PackValidator';
import { DEFAULT_LEVELS } from '../src/data/default-levels';
import { COZY_LORE, GOTHIC_LORE } from '../src/data/default-lore';
import type { KuroLoreFragment } from '../src/types';

const packsDir = path.resolve(__dirname, '../packs');
const levels = DEFAULT_LEVELS.map((l) => l.level);

describe('distributed pack files', () => {
  for (const file of ['gothic-lore.kuro.json', 'cozy-lore.kuro.json']) {
    it(`${file} is a valid pack with no warnings`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(packsDir, file), 'utf8'));
      const r = validatePack(raw, { loreLevels: levels });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings).toEqual([]);
    });
  }
});

/* Drift-Guard: the bundled pack files a user downloads must stay identical to
   the in-code lore constants. Edit one without the other → this fails. */
describe('bundled pack files mirror their in-code lore constants', () => {
  const cases: Array<[string, KuroLoreFragment[]]> = [
    ['gothic-lore.kuro.json', GOTHIC_LORE],
    ['cozy-lore.kuro.json', COZY_LORE],
  ];
  for (const [file, constant] of cases) {
    it(`${file}'s lore array equals its in-code constant`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(packsDir, file), 'utf8'));
      expect(raw.lore).toEqual(constant);
    });
  }
});
