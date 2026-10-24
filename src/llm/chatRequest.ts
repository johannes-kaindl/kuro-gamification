/* ==========================================================
   Aus den Nachrichten des Kit-Chatfensters werden Verlauf und Frage
   für `buildMessages` — pure, kein Obsidian-Import.

   Das Fenster reicht `messages` an `send`: nur abgeschlossene Runden
   (`historyForModel` aus chat-history; Fehlerzeilen und abgebrochene
   Antworten sind UI-lokal, sonst erklärt sich das Modell die eigenen
   Ausfälle), die Frage als letzte Nachricht.
   ========================================================== */
import type { ChatModelMessage } from '../vendor/kit/chat-history';
import type { LlmMessage } from './kuroPrompt';

export interface ChatRequestParts {
  history: LlmMessage[];
  question: string;
}

export function splitChatMessages(messages: readonly ChatModelMessage[]): ChatRequestParts {
  const last = messages[messages.length - 1];
  const history: LlmMessage[] = [];
  for (const m of messages.slice(0, -1)) {
    // `ChatModelMessage.role` kennt auch `tool`; Kuro hat keine Werkzeuge, `LlmMessage` kennt sie nicht.
    if (m.role === 'user' || m.role === 'assistant') history.push({ role: m.role, content: m.content });
  }
  // Das Kit reicht den Text ungetrimmt; die alte Eingabe trimmte.
  return { history, question: last === undefined ? '' : last.content.trim() };
}
