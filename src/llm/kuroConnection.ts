/* ==========================================================
   Kuros LLM-Anbindung als Optionen für `createLlmConnection` (obsidian-kit 0.51.2): was DIESES
   Plugin der Verbindung sagt — Modus companion, Budget, Settings-Namen, Fehlerart am Limit.
   Eigene Datei, damit die goldenen Requests und der Speicherpfad gegen die echten Optionen
   laufen (mit eingespritztem Transport) statt gegen eine Nachbildung.

   Reasoning wird bewusst nicht angezeigt: der Aufrufer reicht kein `onReasoning`.
   ========================================================== */
import type { App } from 'obsidian';
import type { KuroSettings } from '../types';
import type { LlmConnectionOptions, LlmConnectionSettings } from '../vendor/kit-obsidian/llm-connection';
import { COMPANION_MAX_TOKENS, MODE } from './requestSettings';

export interface KuroConnectionHost {
  app: App;
  pluginId: string;
  settings(): KuroSettings;
  persist(): Promise<void>;
}

export function kuroConnectionOptions(host: KuroConnectionHost): LlmConnectionOptions {
  return {
    app: host.app,
    pluginId: host.pluginId,
    caller: 'kuro-gamification',
    capability: 'chat',
    mode: MODE,
    maxTokens: COMPANION_MAX_TOKENS,
    // „Am Limit ohne Text“ bleibt eine eigene Fehlerart (chat.err.truncated); mit Text ist es ein Ergebnis mit Hinweis.
    truncated: 'error',
    lang: () => host.settings().language,
    // Die Settings heißen hier `chat…`; die Verbindung kennt `endpoints`/`choice`/`model`/`request`.
    getSettings: () => {
      const s = host.settings();
      return { endpoints: s.chatEndpoints, choice: s.chatChoice, request: s.request };
    },
    // Erst in die Settings schreiben, dann speichern: die Endpunkt-Liste liest ihre Zeilen danach zurück.
    persist: (patch: Partial<LlmConnectionSettings>) => {
      const s = host.settings();
      if (patch.endpoints !== undefined) s.chatEndpoints = patch.endpoints;
      if (patch.choice !== undefined) s.chatChoice = patch.choice;
      if (patch.request !== undefined) s.request = patch.request;
      return host.persist();
    },
  };
}
