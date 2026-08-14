import { parseSSE } from '../src/vendor/kit/sse';
import { ThinkSplitter } from '../src/vendor/kit/think-splitter';
import { normalizeEndpoint } from '../src/vendor/kit/endpoint';
import { suppressParams } from '../src/vendor/kit/reasoning';

/* Smoke-Test für die vendored Kit-Module: sichert ab, dass die Kopien
   importierbar sind und sich so verhalten, wie KuroChatClient es annimmt.
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
