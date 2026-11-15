/* Ein Verlauf-Speicher ohne Platte für Tests, die ein Chat-Fenster bauen, aber den Verlauf nicht prüfen (Aufbewahrung 0, aus). */
import type { ChatArchive } from '../../src/vendor/kit/chat-archive-store';

export function fakeArchive(keep = 0): ChatArchive {
  return {
    enabled: () => keep > 0,
    save: async () => ({ name: 'x.json' }),
    list: async () => ({ entries: [], unreadable: 0 }),
    load: async () => null,
    remove: async () => false,
    exportNote: async () => null,
  } as ChatArchive;
}

/** Ein `app` mit dem, was die Einstellungszeilen des Verlaufs lesen (`vault.configDir`, Ordner-Vorschläge). */
export const fakeApp = { vault: { configDir: '.obsidian', getAllFolders: () => [] } };
