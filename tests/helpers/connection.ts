/* Gemeinsamer Aufbau der Chat-Tests: ein Plugin mit echtem onload (Manager optional) und eine
   Verbindung mit den ECHTEN Optionen des Plugins (`kuroConnectionOptions`), aber eingespritztem
   Transport — gesendet wird nie, der Transport zeichnet den Body auf. */
import KuroPlugin from '../../src/main';
import { kuroConnectionOptions } from '../../src/llm/kuroConnection';
import { createLlmConnection, type LlmConnectionOptions } from '../../src/vendor/kit-obsidian/llm-connection';
import type { SseTransport } from '../../src/vendor/kit-obsidian/chat-client';
import type { ClockPort } from '../../src/vendor/kit-obsidian/clock';
import type { BackendId } from '../../src/vendor/kit/sampling-profiles';

export async function makePlugin(manager: unknown = null): Promise<any> {
  const app = {
    vault: { on: () => ({}) },
    workspace: { onLayoutReady: () => {}, getLeavesOfType: () => [], getRightLeaf: () => null, revealLeaf: () => {} },
    plugins: { plugins: manager ? { 'llm-endpoint-manager': { api: manager } } : {} },
  };
  const plugin: any = new (KuroPlugin as any)();
  plugin.app = app;
  plugin.manifest = { id: 'kuro-gamification', version: '0' };
  await plugin.onload();
  return plugin;
}

/** `realClock` greift auf `window` zu, das es in jests node-Umgebung nicht gibt (siehe AGENTS.md § Companion-Chat). */
export const nodeClock: ClockPort = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
};

export const sse = (text: string): string => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
export const sseReasoning = (text: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: text } }] })}\n\n`;
export const sseFinish = (reason: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: reason }] })}\n\n`;

export interface Wire { url: string; body: Record<string, any>; headers: Record<string, string> }

/** Transport, der antwortet (`chunks`, `status`) und die Anfragen mitschreibt. */
export function recordingTransport(chunks: string[], status = 200): { transport: SseTransport; sent: Wire[] } {
  const sent: Wire[] = [];
  const transport: SseTransport = {
    async postStream(url, body, headers, onChunk) {
      sent.push({ url, body: body as Record<string, any>, headers });
      for (const c of chunks) onChunk(c);
      return status;
    },
  };
  return { transport, sent };
}

/** Setzt `plugin.llm` auf eine Verbindung mit den Optionen des Plugins und dem gegebenen Transport.
 *  Lokale Zeilen gelten als erreichbar; das Backend wird vorgegeben (sonst fragte die Probe das Netz). */
export function useTransport(plugin: any, transport: SseTransport, extra: Partial<LlmConnectionOptions> = {}, backend: BackendId = 'unknown'): void {
  plugin.llm = createLlmConnection({
    ...kuroConnectionOptions({
      app: plugin.app, pluginId: 'kuro-gamification',
      settings: () => plugin.data.settings, persist: () => plugin.persist(),
    }),
    clock: nodeClock,
    probe: async () => true,
    backendOf: async () => backend,
    transports: { http: transport, fallback: 'none' },
    ...extra,
  });
}
