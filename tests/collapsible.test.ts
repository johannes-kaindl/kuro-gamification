import { resolveCollapsed } from '../src/vendor/kit-obsidian/collapsible';

describe('resolveCollapsed', () => {
  it('uses the default when no storage', () => {
    expect(resolveCollapsed('lore', true, undefined)).toBe(true);
    expect(resolveCollapsed('lore', false, undefined)).toBe(false);
  });
  it('uses the stored value when present', () => {
    const storage = { getCollapsed: () => false, setCollapsed: () => {} };
    expect(resolveCollapsed('lore', true, storage)).toBe(false);
  });
  it('falls back to default when nothing is stored', () => {
    const storage = { getCollapsed: () => undefined, setCollapsed: () => {} };
    expect(resolveCollapsed('lore', true, storage)).toBe(true);
  });
});
