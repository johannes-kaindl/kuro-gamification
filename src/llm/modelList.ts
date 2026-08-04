/* ==========================================================
   Modell-Liste eines OpenAI-kompatiblen Endpunkts lesen — pure.
   ========================================================== */

/** Ids aus einer /v1/models-Antwort ziehen; unbekannte Formen ergeben []. */
export function parseModelList(json: unknown): string[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id === 'string' && id !== '') ids.push(id);
  }
  return ids.sort((a, b) => a.localeCompare(b));
}
