import { Notice } from 'obsidian';
import { parseSSE } from '../src/vendor/kit/sse';
import { ThinkSplitter } from '../src/vendor/kit/think-splitter';
import { normalizeEndpoint } from '../src/vendor/kit/endpoint';
import { suppressParams } from '../src/vendor/kit/reasoning';
import { writeClipboard } from '../src/vendor/kit/clipboard';
import { copyToClipboard } from '../src/vendor/kit-obsidian/clipboard';

/* Smoke-Test für die vendored Kit-Module: sichert ab, dass die Kopien
   importierbar sind und sich so verhalten, wie Kuros Chat es annimmt.
   Schlägt hier etwas fehl, gilt die Kit-Datei — nie die Vendor-Kopie anpassen. */

describe('vendored kit modules', () => {
  it('parseSSE extracts content deltas and keeps the incomplete rest', () => {
    const raw =
      'data: {"choices":[{"delta":{"content":"Hallo"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":" Welt"}}]}\n\n' +
      'data: {"choices":[{"delta":{"cont';
    const out = parseSSE(raw);
    expect(out.content.join('')).toBe('Hallo Welt');
    expect(out.rest.length).toBeGreaterThan(0);
    expect(out.done).toBe(false);
  });

  it('parseSSE reports done on the [DONE] sentinel', () => {
    expect(parseSSE('data: [DONE]\n\n').done).toBe(true);
  });

  /* Seit code-kit 0.5.0 liest parseSSE `choices[0].message`, wenn `delta` fehlt — manche
     Server schicken trotz `stream: true` volle Message-Objekte. DAS ist der Teil der 0.5.0-
     Erweiterung, den Kuros Chat erreicht (über den Kit-Client): er liest `parsed.content`. Vorher kam bei
     solchen Servern gar kein Text an, ohne Fehlermeldung. */
  it('parseSSE falls back to choices[0].message when delta is absent', () => {
    const out = parseSSE('data: {"choices":[{"message":{"content":"voll"}}]}\n\n');
    expect(out.content.join('')).toBe('voll');
  });

  /* Die drei Reasoning-Feldvarianten derselben 0.5.0-Erweiterung, als Charakterisierung.
     Der Kit-Client liefert Reasoning; Kuro zeigt es bewusst nicht (`onReasoning` fehlt). Der Test
     haelt die Kit-Zusage fest, nicht eine Faehigkeit dieses Plugins. */
  it('parseSSE reads reasoning from all three delta field variants', () => {
    const of = (b: string) => parseSSE(b).reasoning.join('');
    expect(of('data: {"choices":[{"delta":{"reasoning_content":"ds"}}]}\n\n')).toBe('ds');
    expect(of('data: {"choices":[{"delta":{"reasoning":"mlx"}}]}\n\n')).toBe('mlx');
    expect(of('data: {"choices":[{"delta":{"thinking":"fork"}}]}\n\n')).toBe('fork');
  });

  it('ThinkSplitter separates a think block from the answer', () => {
    const s = new ThinkSplitter();
    const a = s.push('<think>nachdenken</think>Antwort');
    expect(a.content).toBe('Antwort');
    expect(a.reasoning).toContain('nachdenken');
  });

  it('ThinkSplitter buffers a tag split across pushes', () => {
    const s = new ThinkSplitter();
    expect(s.push('vor<thi').content).toBe('vor');
    expect(s.push('nk>drin</think>nach').content).toBe('nach');
  });

  it('normalizeEndpoint strips a trailing slash', () => {
    expect(normalizeEndpoint('http://localhost:1234/')).toBe('http://localhost:1234');
  });

  it('suppressParams returns nothing when suppression is off', () => {
    expect(Object.keys(suppressParams(false))).toHaveLength(0);
  });

  it('suppressParams returns parameters when suppression is on', () => {
    expect(Object.keys(suppressParams(true)).length).toBeGreaterThan(0);
  });
});

/* Clipboard: die Faelle, die die drei Aufrufstellen (DataIoModal, PackIoModal,
   SettingsTab) tatsaechlich treffen koennen.

   Testumgebung ist `node` (jest.config.js): `navigator` gibt es dort global (Node >= 21),
   `navigator.clipboard` ist `undefined`. Erreichbar ist damit der Falsy-Guard des Kits
   (pure/clipboard.ts), NICHT der catch um den Property-Read — wer den pruefen will, muss
   `navigator` im Test selbst entfernen. Der Erfolgspfad braucht eine echte Clipboard-API
   und ist hier nicht darstellbar; er gehoert in den GUI-Smoke. */
describe('vendored clipboard modules', () => {
  beforeEach(() => { Notice.instances.length = 0; });

  it('navigator.clipboard fehlt hier — die Voraussetzung aller folgenden Faelle', () => {
    expect(navigator.clipboard).toBeUndefined();
  });

  it('writeClipboard meldet "unavailable" SYNCHRON und resolved false', async () => {
    const seen: Array<{ reason: string; error: unknown }> = [];
    const pending = writeClipboard('x', {
      onFailed: (reason, error) => seen.push({ reason, error }),
    });
    // Noch vor jedem await: der unavailable-Pfad ruft onFailed synchron. Das ist
    // load-bearing (Kit-Modulkopf) — ein Deferred-Aufruf braeche im Kit einen fremden
    // Test still, und hier stuende `ta.select()` erst nach dem Klick-Tick.
    expect(seen).toHaveLength(1);
    expect(seen[0].reason).toBe('unavailable');
    expect(seen[0].error).toBeInstanceOf(Error); // `error` ist IMMER gesetzt
    await expect(pending).resolves.toBe(false);
  });

  it('writeClipboard ruft onCopied nicht, wenn nicht kopiert wurde', async () => {
    let copied = false;
    await writeClipboard('x', { onCopied: () => { copied = true; } });
    expect(copied).toBe(false);
  });

  it('copyToClipboard zeigt ohne failedMessage den englischen Kit-Default', async () => {
    // Dokumentiert, wogegen `failedMessage: null` an allen drei Stellen entscheidet:
    // eine englische Notice in einer sonst zweisprachigen Oberflaeche.
    await copyToClipboard('x');
    expect(Notice.instances).toEqual(['Copy failed']);
  });

  it('copyToClipboard mit failedMessage: null bleibt still und meldet ortsnah', async () => {
    let selected = false;
    const ok = await copyToClipboard('x', {
      copiedMessage: 'Kopiert',
      failedMessage: null,
      onFailed: () => { selected = true; },
    });
    expect(ok).toBe(false);
    expect(Notice.instances).toEqual([]); // weder Erfolgs- noch Fehler-Notice
    expect(selected).toBe(true);          // stattdessen das ta.select() der Aufrufstelle
  });
});
