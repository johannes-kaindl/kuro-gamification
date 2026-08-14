/* ==========================================================
   Verlaufs-Zustand für eine Obsidian-Sitzung — pure, kein
   Obsidian-Import.

   BEWUSST NICHT PERSISTIERT: ein wachsender Verlauf in data.json
   gefährdet die Datei mit den Schema-Migrationen und wäre trotz
   Token-Kosten kein verlässliches Gedächtnis, weil er ohnehin
   gekappt werden müsste. Dafür gibt es den Merkzettel (kuroNotes).
   ========================================================== */
import type { LlmMessage } from './kuroPrompt';

export type ChatRole = 'user' | 'assistant' | 'error';

export interface ChatEntry {
  role: ChatRole;
  text: string;
  /** Technisches Detail, unter einer Fehlerzeile abgesetzt dargestellt. */
  detail?: string;
}

export class ChatSession {
  private list: ChatEntry[] = [];
  /** Laufende Antwort während eines Streams, sonst null. */
  streaming: string | null = null;
  busy = false;

  get entries(): readonly ChatEntry[] { return [...this.list]; }

  append(e: ChatEntry): void { this.list.push(e); }

  /** Prompt-History: nur user/assistant. Fehlerzeilen sind UI-lokal —
   *  sonst erklärt sich das Modell die eigenen Ausfälle. */
  historyForPrompt(): LlmMessage[] {
    return this.list
      .filter((e): e is ChatEntry & { role: 'user' | 'assistant' } => e.role !== 'error')
      .map((e) => ({ role: e.role, content: e.text }));
  }

  reset(): void {
    this.list = [];
    this.streaming = null;
    this.busy = false;
  }
}
