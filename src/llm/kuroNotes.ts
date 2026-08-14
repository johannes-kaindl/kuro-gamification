/* ==========================================================
   Merkzettel-Regeln — pure, kein Obsidian-Import.

   Der Merkzettel ist Kuros Langzeitgedächtnis: wenige kuratierte
   Sätze, die in jedem Prompt mitgehen. Bewusst KEIN gespeicherter
   Gesprächsverlauf — der wüchse mit der Nutzung, müsste gekappt
   werden und wäre trotz Token-Kosten kein verlässliches Gedächtnis.

   Eintragen ist immer deterministisch (Präfix, Knopf oder
   Einstellungen), nie modellgesteuert: lokale Modelle sind bei
   strukturierter Ausgabe unzuverlässig, und der Mensch soll immer
   wissen, was über ihn gespeichert wurde.
   ========================================================== */

export const MAX_NOTES = 20;
export const MAX_NOTE_LEN = 200;

/** Präfixe, mit denen eine Chat-Nachricht einen Merkzettel-Eintrag anlegt. */
export const NOTE_PREFIXES = ['merk dir:', 'merke dir:', 'remember:'] as const;

/** Ist noch Platz auf dem Merkzettel? Pures Prädikat für setDisabled. */
export function canAddNote(notes: string[]): boolean {
  return notes.length < MAX_NOTES;
}

/** Auf eine Zeile bringen und auf MAX_NOTE_LEN kappen. */
export function normalizeNote(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_LEN);
}

/**
 * Eintrag anhängen. Gibt IMMER ein neues Array zurück; bei vollem
 * Merkzettel oder leerem Eintrag unverändert — nie wird still der
 * älteste Eintrag verworfen. Ein Merkzettel, der heimlich vergisst,
 * ist schlimmer als einer, der voll ist.
 */
export function addNote(notes: string[], raw: string): string[] {
  const note = normalizeNote(raw);
  if (note === '' || !canAddNote(notes)) return [...notes];
  return [...notes, note];
}

/** Erkennt "merk dir: …" am Anfang einer Nachricht; sonst null. */
export function extractNoteFromMessage(msg: string): string | null {
  const trimmed = msg.trimStart();
  const lower = trimmed.toLowerCase();
  for (const prefix of NOTE_PREFIXES) {
    if (!lower.startsWith(prefix)) continue;
    const note = normalizeNote(trimmed.slice(prefix.length));
    return note === '' ? null : note;
  }
  return null;
}
