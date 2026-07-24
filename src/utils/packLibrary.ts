/* ==========================================================
   Pure pack-library logic. Free of Obsidian imports (Node-
   testable). Pointers (activeLore/LootPackId) are the truth;
   customLore/customLootPool are the applied cache these
   functions keep in sync.
   ========================================================== */
import type { InstalledPack, KuroLoreFragment, KuroPack, KuroSettings, Lang } from '../types';
import { t } from '../i18n';

/** Structural equality for a lore array (level/title/text per fragment). */
export function sameLore(a: KuroLoreFragment[] | undefined, b: KuroLoreFragment[] | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((f, i) => f.level === b[i].level && f.title === b[i].title && f.text === b[i].text);
}

export interface NameDeps {
  gothicLore: KuroLoreFragment[];
  cozyLore: KuroLoreFragment[];
  lang: Lang;
}

/** Human name for an incoming pack: explicit name > content-match > localized fallback. */
export function resolvePackName(pack: KuroPack, deps: NameDeps): string {
  if (pack.name?.trim()) return pack.name.trim();
  if (pack.lore) {
    if (sameLore(pack.lore, deps.gothicLore)) return 'Gothic-Cyberpunk';
    if (sameLore(pack.lore, deps.cozyLore)) return 'Cozy';
  }
  return t('pack.name.imported', deps.lang);
}

/** Add a pack to the library. Does not activate it. */
export function installPack(settings: KuroSettings, pack: KuroPack, id: string, deps: NameDeps): KuroSettings {
  const entry: InstalledPack = { id, name: resolvePackName(pack, deps) };
  if (pack.lore !== undefined) entry.lore = pack.lore;
  if (pack.loot !== undefined) entry.loot = pack.loot;
  return { ...settings, packLibrary: [...settings.packLibrary, entry] };
}

/** Apply a pack: set pointer + cache for each section it carries; others untouched. */
export function activatePack(settings: KuroSettings, id: string): KuroSettings {
  const entry = settings.packLibrary.find((p) => p.id === id);
  if (!entry) return settings;
  const next: KuroSettings = { ...settings };
  if (entry.lore !== undefined) { next.customLore = entry.lore; next.activeLorePackId = id; }
  if (entry.loot !== undefined) { next.customLootPool = entry.loot; next.activeLootPackId = id; }
  return next;
}

/** Remove a pack. If it was active for a section, that section reverts to factory. */
export function deletePack(settings: KuroSettings, id: string): KuroSettings {
  const next: KuroSettings = { ...settings, packLibrary: settings.packLibrary.filter((p) => p.id !== id) };
  if (next.activeLorePackId === id) { next.activeLorePackId = null; next.customLore = null; }
  if (next.activeLootPackId === id) { next.activeLootPackId = null; next.customLootPool = null; }
  return next;
}

/** Revert one section to factory default: clear its pointer + cache. Library untouched. */
export function resetSection(settings: KuroSettings, section: 'lore' | 'loot'): KuroSettings {
  const next: KuroSettings = { ...settings };
  if (section === 'lore') { next.customLore = null; next.activeLorePackId = null; }
  else { next.customLootPool = null; next.activeLootPackId = null; }
  return next;
}

/** One-time: seed the library from a pre-feature customLore/customLootPool. Idempotent. */
export function migrateToLibrary(settings: KuroSettings, deps: NameDeps): KuroSettings {
  if (settings.packLibrary.length > 0) return settings;
  if (settings.customLore == null && settings.customLootPool == null) return settings;
  const lib: InstalledPack[] = [];
  const next: KuroSettings = { ...settings };
  if (settings.customLore != null) {
    const name = resolvePackName({ kuroPack: 1, lore: settings.customLore }, deps);
    lib.push({ id: 'lib-migrated-lore', name, lore: settings.customLore });
    next.activeLorePackId = 'lib-migrated-lore';
  }
  if (settings.customLootPool != null) {
    lib.push({ id: 'lib-migrated-loot', name: t('pack.name.importedLoot', deps.lang), loot: settings.customLootPool });
    next.activeLootPackId = 'lib-migrated-loot';
  }
  next.packLibrary = lib;
  return next;
}

/** Apply an imported pack: lore/loot go into the library (installed + activated);
    habits are applied directly (not part of the library). A pack with neither
    lore nor loot creates no library entry. Returns new settings. */
export function importPack(settings: KuroSettings, pack: KuroPack, id: string, deps: NameDeps): KuroSettings {
  let s = settings;
  if (pack.lore !== undefined || pack.loot !== undefined) {
    s = activatePack(installPack(s, pack, id, deps), id);
  }
  if (pack.habits !== undefined) {
    s = { ...s, habits: pack.habits };
  }
  return s;
}

/**
 * View state for a library row's "Activate" button: true only when the pack
 * carries at least one section that is NOT already pointing at it. A pack whose
 * every carried section is active — or that carries nothing — has nothing left
 * to activate, so the button is disabled. Pure (Obsidian-free) so the render
 * layer only has to call setDisabled().
 */
export function canActivatePack(settings: KuroSettings, pack: InstalledPack): boolean {
  const loreStale = pack.lore !== undefined && settings.activeLorePackId !== pack.id;
  const lootStale = pack.loot !== undefined && settings.activeLootPackId !== pack.id;
  return loreStale || lootStale;
}

/** Active pack name per section, or the localized factory-default label. */
export function activeNames(settings: KuroSettings, lang: Lang): { lore: string; loot: string } {
  const nameOf = (pid: string | null): string =>
    pid ? (settings.packLibrary.find((p) => p.id === pid)?.name ?? t('pack.name.factory', lang))
        : t('pack.name.factory', lang);
  return { lore: nameOf(settings.activeLorePackId), loot: nameOf(settings.activeLootPackId) };
}
